-- EXAMS ENHANCEMENT: Empty Reports Support - VERSION 10

-- 1A. CONFIGURATION TABLE (Existing)
CREATE TABLE IF NOT EXISTS public.exam_config (
    school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
    mark_entry_enabled boolean DEFAULT false,
    current_term text DEFAULT 'Term 1 2026',
    updated_at timestamptz DEFAULT NOW()
);
ALTER TABLE public.exam_config ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view exam config') THEN
        CREATE POLICY "Users can view exam config" ON public.exam_config
            FOR SELECT USING (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update exam config') THEN
        CREATE POLICY "Admins can update exam config" ON public.exam_config
            FOR UPDATE USING (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid()));
    END IF;
END $$;

-- 1B. REPORT STATUS TABLE (Existing)
CREATE TABLE IF NOT EXISTS public.exam_report_status (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
    class_name text NOT NULL,
    term text NOT NULL DEFAULT 'Term 1 2026',
    status text DEFAULT 'Draft' CHECK (status IN ('Draft', 'Approved', 'Released')),
    released_at timestamptz,
    created_at timestamptz DEFAULT NOW(),
    UNIQUE(school_id, class_name, term)
);
ALTER TABLE public.exam_report_status ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage report statuses') THEN
        CREATE POLICY "Admins can manage report statuses" ON public.exam_report_status
            USING (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Parents can view released reports') THEN
        CREATE POLICY "Parents can view released reports" ON public.exam_report_status
            FOR SELECT USING (status = 'Released');
    END IF;
END $$;


-- 2. get_student_results (Existing Robust Logic)
DROP FUNCTION IF EXISTS public.get_student_results(uuid);

CREATE OR REPLACE FUNCTION public.get_student_results(target_student_id uuid)
RETURNS TABLE (
    subject text,
    class_score numeric,
    exam_score numeric,
    total numeric,
    class text,
    created_at timestamptz,
    grade text,
    term text,
    academic_year text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_school_id uuid;
    v_student_class text;
    v_is_released boolean;
BEGIN
    SELECT school_id, class INTO v_school_id, v_student_class 
    FROM public.students WHERE id = target_student_id;

    -- Check if student's class is released
    SELECT EXISTS (
        SELECT 1 FROM public.exam_report_status ers
        WHERE ers.school_id = v_school_id
        AND LOWER(TRIM(ers.class_name)) = LOWER(TRIM(v_student_class))
        AND ers.status = 'Released'
    ) INTO v_is_released;

    RETURN QUERY
    SELECT 
        er.subject, 
        er.class_score, 
        er.exam_score, 
        er.total, 
        er.class, 
        er.created_at,
        CASE 
            WHEN er.total >= 80 THEN 'A'
            WHEN er.total >= 70 THEN 'B'
            WHEN er.total >= 60 THEN 'C'
            WHEN er.total >= 50 THEN 'D'
            ELSE 'E'
        END as grade,
        er.term,
        er.academic_year
    FROM public.exam_results er
    WHERE er.student_id = target_student_id
    AND (
        v_is_released = TRUE
        OR EXISTS (
            SELECT 1 FROM public.exam_report_status ers 
            WHERE ers.school_id = er.school_id 
            AND LOWER(TRIM(ers.class_name)) = LOWER(TRIM(er.class))
            AND ers.status = 'Released'
        )
    )
    ORDER BY er.created_at DESC;
END;
$$;


-- 3. NEW: get_student_released_terms
-- Returns the LIST of Terms/Reports that are officially Released for this student.
-- This allows the frontend to show "Term 1 Report" even if there are 0 exam results yet.
CREATE OR REPLACE FUNCTION public.get_student_released_terms(target_student_id uuid)
RETURNS TABLE (
    term text,
    status text,
    class_name text,
    released_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_school_id uuid;
    v_student_class text;
BEGIN
    SELECT school_id, class INTO v_school_id, v_student_class 
    FROM public.students WHERE id = target_student_id;

    RETURN QUERY
    SELECT 
        ers.term,
        ers.status,
        ers.class_name,
        ers.released_at
    FROM public.exam_report_status ers
    WHERE ers.school_id = v_school_id
    AND LOWER(TRIM(ers.class_name)) = LOWER(TRIM(v_student_class))
    AND ers.status = 'Released'
    ORDER BY ers.released_at DESC;
END;
$$;


-- 4. Submission Overview (Existing)
CREATE OR REPLACE FUNCTION public.get_exam_submission_overview(target_school_id uuid)
RETURNS TABLE (
    class_name text,
    subject_name text,
    teacher_name text,
    status text,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        es.class,
        es.subject,
        p.full_name as teacher_name,
        es.status,
        es.updated_at
    FROM public.exam_submissions es
    LEFT JOIN public.profiles p ON es.teacher_id = p.id
    WHERE es.school_id = target_school_id
    ORDER BY es.status, es.class;
END;
$$;

-- 5. Publish Results (Existing)
CREATE OR REPLACE FUNCTION public.publish_class_results(
    target_school_id uuid, 
    target_class text,
    p_term text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.exam_report_status (school_id, class_name, term, status, released_at)
    VALUES (target_school_id, target_class, p_term, 'Released', NOW())
    ON CONFLICT (school_id, class_name, term)
    DO UPDATE SET status = 'Released', released_at = NOW();
    
    INSERT INTO public.notices (school_id, title, message, priority, audience, date)
    VALUES (
        target_school_id, 
        'Exam Results Released', 
        'The results for ' || p_term || ' associated with ' || target_class || ' have been released.', 
        'Urgent', 
        'All Staff', 
        CURRENT_DATE
    );
    RETURN TRUE;
END;
$$;

-- 6. Toggle Entry (Existing)
CREATE OR REPLACE FUNCTION public.toggle_mark_entry(target_school_id uuid, enable boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.exam_config (school_id, mark_entry_enabled)
    VALUES (target_school_id, enable)
    ON CONFLICT (school_id)
    DO UPDATE SET mark_entry_enabled = enable, updated_at = NOW();
    RETURN TRUE;
END;
$$;

-- 7. Get Student Fee Structure (Real Data)
DROP FUNCTION IF EXISTS public.get_student_fee_structure(uuid);

CREATE OR REPLACE FUNCTION public.get_student_fee_structure(target_student_id uuid)
RETURNS TABLE (
    fee_name text,
    amount numeric,
    status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_school_id uuid;
    v_student_class text;
    v_balance numeric;
    v_total_fees numeric := 0;
    v_paid_so_far numeric := 0;
    r RECORD;
BEGIN
    SELECT school_id, class, balance INTO v_school_id, v_student_class, v_balance 
    FROM public.students WHERE id = target_student_id;
    
    SELECT COALESCE(SUM(fs.amount), 0) INTO v_total_fees
    FROM public.fee_structure fs
    WHERE fs.school_id = v_school_id
    AND (fs.target_class IS NULL OR fs.target_class = v_student_class);
    
    v_paid_so_far := GREATEST(0, v_total_fees - v_balance);

    FOR r IN 
        SELECT fs.name, fs.amount
        FROM public.fee_structure fs
        WHERE fs.school_id = v_school_id
        AND (fs.target_class IS NULL OR fs.target_class = v_student_class)
        ORDER BY fs.created_at ASC
    LOOP
        IF v_paid_so_far >= r.amount THEN
            status := 'Paid';
            v_paid_so_far := v_paid_so_far - r.amount;
        ELSIF v_paid_so_far > 0 THEN
            status := 'Partial';
            v_paid_so_far := 0; 
        ELSE
            status := 'Unpaid';
        END IF;

        fee_name := r.name;
        amount := r.amount;
        RETURN NEXT;
    END LOOP;
    
    RETURN;
END;
$$;


-- Grant Permissions
GRANT ALL ON public.exam_report_status TO authenticated;
GRANT SELECT ON public.exam_report_status TO anon; 

GRANT ALL ON public.exam_config TO authenticated;
GRANT SELECT ON public.exam_config TO anon;

GRANT EXECUTE ON FUNCTION public.get_exam_submission_overview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_class_results(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_mark_entry(uuid, boolean) TO authenticated;

-- CRITICAL: Allow Parents (anon/authenticated) to call these
GRANT EXECUTE ON FUNCTION public.get_student_results(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_results(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_student_results(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_student_fee_structure(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_fee_structure(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_student_fee_structure(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_student_released_terms(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_released_terms(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_student_released_terms(uuid) TO service_role;
