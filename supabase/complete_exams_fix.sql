-- COMPLETE EXAMS MODULE FIX
-- Run this script to fix the 400 Bad Request error and ensure tables exist.

-- 1. Ensure Table Exists
CREATE TABLE IF NOT EXISTS public.exam_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL,
    teacher_id UUID REFERENCES title(id), -- Note: typically references profiles or auth.users
    class TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT DEFAULT 'Pending', -- 'Pending', 'Submitted', 'Approved', 'Rejected'
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    feedback TEXT,
    UNIQUE(school_id, class, subject)
);

-- Fix foreign key if needed (assuming profiles table exists for teachers)
-- ALTER TABLE exam_submissions DROP CONSTRAINT IF EXISTS exam_submissions_teacher_id_fkey;
-- ALTER TABLE exam_submissions ADD CONSTRAINT exam_submissions_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES profiles(id);


-- 2. DROP conflicting functions
DROP FUNCTION IF EXISTS get_exam_submission_overview(uuid) CASCADE;
DROP FUNCTION IF EXISTS submit_exam_marks(uuid, text, text);

-- 3. Create Submission Overview Function (Correct Parameter Name: p_school_id)
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


-- 4. Create Submit Function
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

-- 5. Permissions
GRANT ALL ON public.exam_submissions TO authenticated;
GRANT EXECUTE ON FUNCTION get_exam_submission_overview TO authenticated;
GRANT EXECUTE ON FUNCTION submit_exam_marks TO authenticated;

-- 6. Force Cache Reload
NOTIFY pgrst, 'reload schema';
