-- EXAMS SUBMISSION WORKFLOW
-- 1. Create Submissions Tracker Table
CREATE TABLE IF NOT EXISTS public.exam_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Allow teacher delete
    class TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT DEFAULT 'Submitted',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, class, subject)
);

-- 2. Teacher Submit Function
CREATE OR REPLACE FUNCTION submit_exam_marks(
    p_school_id UUID, 
    p_class TEXT, 
    p_subject TEXT
) RETURNS VOID AS $$
BEGIN
    -- Assumes current user is the teacher
    INSERT INTO public.exam_submissions (school_id, teacher_id, class, subject, status, submitted_at)
    VALUES (p_school_id, auth.uid(), p_class, p_subject, 'Submitted', NOW())
    ON CONFLICT (school_id, class, subject)
    DO UPDATE SET status = 'Submitted', submitted_at = NOW(), teacher_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update Submission Overview to use this table
DROP FUNCTION IF EXISTS get_exam_submission_overview(uuid);

CREATE OR REPLACE FUNCTION get_exam_submission_overview(target_school_id UUID)
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
        es.school_id = target_school_id AND 
        es.class = c.name AND 
        es.subject = s.name
    WHERE c.school_id = target_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT ALL ON public.exam_submissions TO authenticated;
GRANT EXECUTE ON FUNCTION submit_exam_marks TO authenticated;
