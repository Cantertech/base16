-- FIX EXAMS V2
-- Creating a new function version to bypass any caching or signature conflicts

DROP FUNCTION IF EXISTS get_exam_submission_overview_v2(uuid);

CREATE OR REPLACE FUNCTION get_exam_submission_overview_v2(p_school_id UUID)
RETURNS TABLE (
    class_name TEXT,
    subject_name TEXT,
    teacher_name TEXT,
    status TEXT,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.name::TEXT,
        s.name::TEXT,
        COALESCE(p.name, 'Unassigned')::TEXT,
        COALESCE(es.status, 'Pending')::TEXT,
        es.submitted_at
    FROM teacher_assignments ta
    JOIN classes c ON ta.class_id = c.id
    JOIN subjects s ON ta.subject_id = s.id
    LEFT JOIN profiles p ON ta.teacher_id = p.id
    LEFT JOIN exam_submissions es ON 
        es.school_id = p_school_id AND 
        es.class = c.name AND 
        es.subject = s.name
    WHERE c.school_id = p_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_exam_submission_overview_v2 TO authenticated;

NOTIFY pgrst, 'reload schema';
