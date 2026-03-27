
-- 1. Update get_exam_submission_overview_v3 to use subject_assignments
-- This fixes the issue where every class shows all subjects in the school (e.g. 22 subjects)
CREATE OR REPLACE FUNCTION get_exam_submission_overview_v3(
    p_school_id UUID,
    p_term TEXT,
    p_year TEXT
)
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
        COALESCE(
            (SELECT p.full_name FROM teacher_assignments ta 
             JOIN profiles p ON ta.teacher_id = p.id 
             WHERE ta.class_id = c.id AND ta.subject_id = s.id LIMIT 1),
            (SELECT p.full_name FROM teacher_assignments ta 
             JOIN profiles p ON ta.teacher_id = p.id 
             WHERE ta.class_id = c.id AND ta.is_class_teacher = true LIMIT 1),
            'Unassigned'
        )::TEXT as teacher_name,
        COALESCE(es.status, 'Pending')::TEXT,
        es.submitted_at
    FROM classes c
    -- JOIN with subject_assignments to only get subjects assigned to this class
    JOIN subject_assignments sa ON sa.class_id = c.id
    JOIN subjects s ON s.id = sa.subject_id
    -- LEFT JOIN with submissions to see status
    LEFT JOIN exam_submissions es ON 
        es.school_id = p_school_id AND 
        es.class = c.name AND 
        es.subject = s.name AND
        es.term = p_term AND
        es.academic_year = p_year
    WHERE c.school_id = p_school_id
      AND s.school_id = p_school_id
    ORDER BY c.name, s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_exam_submission_overview_v3 TO authenticated;

-- 2. Add an RPC to get all subjects for a specific class (helper for reports)
CREATE OR REPLACE FUNCTION get_class_subjects(p_school_id UUID, p_class_name TEXT)
RETURNS TABLE (subject_name TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT s.name::TEXT
    FROM subjects s
    JOIN subject_assignments sa ON s.id = sa.subject_id
    JOIN classes c ON sa.class_id = c.id
    WHERE c.school_id = p_school_id AND c.name = p_class_name
    UNION
    -- Also include subjects that have results already, just in case
    SELECT DISTINCT er.subject::TEXT
    FROM exam_results er
    WHERE er.school_id = p_school_id AND er.class = p_class_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_class_subjects TO authenticated;
