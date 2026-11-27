-- ==============================================================================
-- Multi-Tenant Row Level Security (RLS) for cvikeikqhxxkwdupglpp.supabase.co
-- Run this once in Supabase Dashboard -> SQL Editor
-- Ensures School A can NEVER read or modify School B's data.
-- Uses SECURITY DEFINER helpers to prevent RLS recursion on public.profiles.
-- ==============================================================================

-- 1. Non-recursive auth helper functions
CREATE OR REPLACE FUNCTION public.auth_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT school_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    );
$$;

GRANT EXECUTE ON FUNCTION public.auth_school_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_is_super_admin() TO authenticated;

-- 2. Profiles table (no recursion via helper functions)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School isolation for profiles select" ON public.profiles;
DROP POLICY IF EXISTS "School isolation for profiles insert" ON public.profiles;
DROP POLICY IF EXISTS "School isolation for profiles update" ON public.profiles;
DROP POLICY IF EXISTS "School isolation for profiles delete" ON public.profiles;

CREATE POLICY "School isolation for profiles select"
ON public.profiles FOR SELECT TO authenticated
USING (
    id = auth.uid()
    OR school_id = public.auth_school_id()
    OR public.auth_is_super_admin()
);

CREATE POLICY "School isolation for profiles insert"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (
    (
        id = auth.uid()
        AND role = 'admin'
        AND school_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.schools s
            WHERE s.id = school_id AND s.status = 'pending'
        )
    )
    OR (school_id = public.auth_school_id() AND public.auth_user_role() = 'admin' AND role <> 'super_admin')
    OR public.auth_is_super_admin()
);

CREATE POLICY "School isolation for profiles update"
ON public.profiles FOR UPDATE TO authenticated
USING (
    id = auth.uid()
    OR (school_id = public.auth_school_id() AND public.auth_user_role() = 'admin')
    OR public.auth_is_super_admin()
)
WITH CHECK (
    (
        id = auth.uid()
        AND role = public.auth_user_role()
        AND school_id IS NOT DISTINCT FROM public.auth_school_id()
    )
    OR (school_id = public.auth_school_id() AND public.auth_user_role() = 'admin' AND role <> 'super_admin')
    OR public.auth_is_super_admin()
);

CREATE POLICY "School isolation for profiles delete"
ON public.profiles FOR DELETE TO authenticated
USING (
    (school_id = public.auth_school_id() AND public.auth_user_role() = 'admin')
    OR public.auth_is_super_admin()
);

-- 3. Schools table
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School isolation for schools select" ON public.schools;
DROP POLICY IF EXISTS "School isolation for schools insert" ON public.schools;
DROP POLICY IF EXISTS "School isolation for schools update" ON public.schools;

CREATE POLICY "School isolation for schools select"
ON public.schools FOR SELECT TO authenticated
USING (id = public.auth_school_id() OR public.auth_is_super_admin());

CREATE POLICY "School isolation for schools insert"
ON public.schools FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "School isolation for schools update"
ON public.schools FOR UPDATE TO authenticated
USING (id = public.auth_school_id() OR public.auth_is_super_admin())
WITH CHECK (id = public.auth_school_id() OR public.auth_is_super_admin());

-- 4. Standard school-scoped tables (full CRUD within own school)
DO $$
DECLARE
    tbl TEXT;
    tables_list TEXT[] := ARRAY[
        'students',
        'classes',
        'subjects',
        'teacher_assignments',
        'exam_results',
        'exam_submissions',
        'student_report_cards',
        'fee_structure',
        'student_invoices',
        'transactions',
        'payment_requests',
        'payroll_records',
        'academic_terms',
        'app_notifications',
        'guardians'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_list LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "School isolation policy" ON public.%I;', tbl);
            EXECUTE format(
                'CREATE POLICY "School isolation policy" ON public.%I FOR ALL TO authenticated ' ||
                'USING (school_id = public.auth_school_id() OR public.auth_is_super_admin()) ' ||
                'WITH CHECK (school_id = public.auth_school_id() OR public.auth_is_super_admin());',
                tbl
            );
        END IF;
    END LOOP;
END $$;

-- 5. student_guardians (scoped via student_id -> students.school_id)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_guardians') THEN
        ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "School isolation for student_guardians" ON public.student_guardians;
        CREATE POLICY "School isolation for student_guardians"
        ON public.student_guardians FOR ALL TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.students s
                WHERE s.id = student_id
                  AND (s.school_id = public.auth_school_id() OR public.auth_is_super_admin())
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.students s
                WHERE s.id = student_id
                  AND (s.school_id = public.auth_school_id() OR public.auth_is_super_admin())
            )
        );
    END IF;
END $$;

-- 6. Read-only billing history tables for schools (writes only via service_role / Edge Functions)
DO $$
DECLARE
    btbl TEXT;
    billing_tables TEXT[] := ARRAY[
        'school_billing_invoices',
        'sms_purchases',
        'school_wallet_transactions'
    ];
BEGIN
    FOREACH btbl IN ARRAY billing_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = btbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', btbl);
            EXECUTE format('DROP POLICY IF EXISTS "School read own billing" ON public.%I;', btbl);
            EXECUTE format(
                'CREATE POLICY "School read own billing" ON public.%I FOR SELECT TO authenticated ' ||
                'USING (school_id = public.auth_school_id() OR public.auth_is_super_admin());',
                btbl
            );
        END IF;
    END LOOP;
END $$;
