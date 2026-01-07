-- EXAMS ENHANCEMENT: Report Status & Release Logic - VERSION 4

-- 1A. CONFIGURATION TABLE (New)
-- Controls whether mark entry is open and what the current term is.
CREATE TABLE IF NOT EXISTS public.exam_config (
    school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
    mark_entry_enabled boolean DEFAULT false,
    current_term text DEFAULT 'Term 1 2026',
    updated_at timestamptz DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.exam_config ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users (Admins/Teachers) can view
-- Check if policy exists before creating to avoid errors on re-run
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


-- 1B. REPORT STATUS TABLE
-- This controls whether parents can see the results ('Released')
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

-- Enable RLS
ALTER TABLE public.exam_report_status ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage report statuses') THEN
        CREATE POLICY "Admins can manage report statuses" ON public.exam_report_status
            USING (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Parents can view released reports') THEN
        CREATE POLICY "Parents can view released reports" ON public.exam_report_status
            FOR SELECT
            USING (status = 'Released');
    END IF;
END $$;


-- 2. Update get_student_results to respect Release status
-- DROP FIRST to handle return type change
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
    v_class text;
BEGIN
    -- Get student context
    SELECT school_id, class INTO v_school_id, v_class 
    FROM public.students WHERE id = target_student_id;

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
    LEFT JOIN public.exam_report_status ers 
        ON er.school_id = ers.school_id 
        -- Use robust matching (trimmed, case-insensitive) to ensure data aligns
        AND LOWER(TRIM(er.class)) = LOWER(TRIM(ers.class_name))
    WHERE er.student_id = target_student_id
    -- ONLY show if status is Released.
    AND ers.status = 'Released'
    ORDER BY er.created_at DESC;
END;
$$;


-- 3. RPC for Admin: Get Submission Status Overview
-- Returns list of teachers/subjects and their submission status
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

-- 4. RPC to Release Results (Admin Action)
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
    
    -- Simulate notification by inserting into internal notices
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

-- 5. RPC to Toggle Mark Entry (Admin Action)
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

-- Grant Permissions
GRANT ALL ON public.exam_report_status TO authenticated;
GRANT ALL ON public.exam_report_status TO service_role;
GRANT ALL ON public.exam_config TO authenticated;
GRANT ALL ON public.exam_config TO service_role;
GRANT EXECUTE ON FUNCTION public.get_exam_submission_overview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_class_results(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_mark_entry(uuid, boolean) TO authenticated;
