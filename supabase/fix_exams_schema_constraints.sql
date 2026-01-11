-- Fix Schema Constraints for Exams and Submissions

-- 1. Ensure unique constraint for exam_results (Enables upsert)
-- We use a specific name to avoid auto-generated name conflicts
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'exam_results_unique_idx'
    ) THEN
        ALTER TABLE public.exam_results 
        ADD CONSTRAINT exam_results_unique_idx 
        UNIQUE (student_id, class, subject, term, academic_year);
    END IF;
END $$;

-- 2. Ensure unique constraint for exam_submissions (Enables tracking status per class/subject)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'exam_submissions_unique_idx'
    ) THEN
        ALTER TABLE public.exam_submissions 
        ADD CONSTRAINT exam_submissions_unique_idx 
        UNIQUE (school_id, class, subject);
    END IF;
END $$;

-- 3. Create Robust Submit RPC (Version 2)
CREATE OR REPLACE FUNCTION submit_exam_marks_v2(
    p_school_id UUID, 
    p_class TEXT, 
    p_subject TEXT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.exam_submissions (school_id, teacher_id, class, subject, status, submitted_at)
    VALUES (p_school_id, auth.uid(), p_class, p_subject, 'Submitted', NOW())
    ON CONFLICT (school_id, class, subject)
    DO UPDATE SET 
        status = 'Submitted', 
        submitted_at = NOW(), 
        teacher_id = auth.uid(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION submit_exam_marks_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION submit_exam_marks_v2 TO anon;
