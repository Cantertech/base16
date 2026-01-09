-- FINAL FIX for Exams Module
-- This script resets the function signatures to ensure they work correctly.

-- 1. DROP old versions of the functions (aggressive cleanup)
DROP FUNCTION IF EXISTS get_exam_submission_overview(uuid); -- Old signature
DROP FUNCTION IF EXISTS submit_exam_marks(uuid, text, text);

-- 2. Create Parameterized Submission Overview Function (matches p_school_id)
CREATE OR REPLACE FUNCTION get_exam_submission_overview(p_school_id UUID)
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

-- 3. Ensure Submit Function exists (re-run just in case)
CREATE OR REPLACE FUNCTION submit_exam_marks(
    p_school_id UUID, 
    p_class TEXT, 
    p_subject TEXT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.exam_submissions (school_id, teacher_id, class, subject, status, submitted_at)
    VALUES (p_school_id, auth.uid(), p_class, p_subject, 'Submitted', NOW())
    ON CONFLICT (school_id, class, subject)
    DO UPDATE SET status = 'Submitted', submitted_at = NOW(), teacher_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Reload Schema Cache to prevent 400 Errors
NOTIFY pgrst, 'reload schema';

GRANT EXECUTE ON FUNCTION get_exam_submission_overview TO authenticated;
GRANT EXECUTE ON FUNCTION submit_exam_marks TO authenticated;
