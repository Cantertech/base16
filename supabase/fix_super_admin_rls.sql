-- Fix Super Admin RLS with a Security Definer Function
-- This resolves potential recursion issues where the policy tries to query the table it's protecting.

-- 1. Create a secure function to check super admin status
-- SECURITY DEFINER means this function runs with the privileges of the database owner, bypassing RLS.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Re-apply the policies using this secure function
DO $$
DECLARE
    -- Verified list of existing tables
    tables text[] := ARRAY[
        'schools', 'profiles', 'students', 'teachers', 'classes', 'subjects', 
        'subject_assignments', 'exam_results', 'exam_submissions', 
        'fee_structure', 'transactions', 'attendance', 
        'notices', 'message_logs', 'billing_history', 'referrals'
    ];
    t text;
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Check if table exists
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Drop existing policy
            BEGIN
                EXECUTE format('DROP POLICY IF EXISTS "Super Admin Access" ON public.%I', t);
            EXCEPTION WHEN OTHERS THEN NULL; END;

            -- Create new policy using the function
            EXECUTE format('
                CREATE POLICY "Super Admin Access" ON public.%I
                FOR ALL
                USING ( public.is_super_admin() )
                WITH CHECK ( public.is_super_admin() );
            ', t);
        END IF;
    END LOOP;
END $$;
