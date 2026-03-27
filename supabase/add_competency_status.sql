
-- ADD COMPETENCY STATUS COLUMN
ALTER TABLE public.exam_results ADD COLUMN IF NOT EXISTS competency_status TEXT;

-- Update get_student_results to return competency_status
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
    academic_year text,
    competency_status text
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
        er.academic_year,
        er.competency_status
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
