
-- Backfill Exam Submissions from existing Results
-- This restores the 'Submitted' status for any class/subject that has marks entered.

INSERT INTO public.exam_submissions (school_id, class, subject, term, academic_year, status, submitted_at)
SELECT DISTINCT 
    r.school_id, 
    r.class, 
    r.subject, 
    r.term, 
    r.academic_year, 
    'Submitted', 
    NOW()
FROM public.exam_results r
ON CONFLICT (school_id, class, subject, term, academic_year) DO NOTHING;

-- Output confirmation
SELECT count(*) as restored_submissions FROM public.exam_submissions;
