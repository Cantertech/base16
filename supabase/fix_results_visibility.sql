-- Fix get_student_results to strictly join on released term status
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
BEGIN
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
    JOIN public.exam_report_status ers ON 
        ers.school_id = er.school_id 
        AND LOWER(TRIM(ers.class_name)) = LOWER(TRIM(er.class))
        AND ers.term = er.term
    WHERE er.student_id = target_student_id
    AND ers.status = 'Released'
    ORDER BY er.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_results(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_results(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_student_results(uuid) TO service_role;
