
-- 1. Recreate Exam Submissions Table with Term/Year
DROP TABLE IF EXISTS public.exam_submissions CASCADE;

CREATE TABLE public.exam_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    class TEXT NOT NULL,
    subject TEXT NOT NULL,
    term TEXT NOT NULL DEFAULT 'First Term',
    academic_year TEXT NOT NULL DEFAULT '2024/2025',
    status TEXT DEFAULT 'Submitted',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, class, subject, term, academic_year)
);

GRANT ALL ON public.exam_submissions TO authenticated;

-- 2. Update Submit Function
DROP FUNCTION IF EXISTS submit_exam_marks(uuid, text, text);

CREATE OR REPLACE FUNCTION submit_exam_marks_v3(
    p_school_id UUID, 
    p_class TEXT, 
    p_subject TEXT,
    p_term TEXT,
    p_year TEXT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.exam_submissions (school_id, teacher_id, class, subject, term, academic_year, status, submitted_at)
    VALUES (p_school_id, auth.uid(), p_class, p_subject, p_term, p_year, 'Submitted', NOW())
    ON CONFLICT (school_id, class, subject, term, academic_year)
    DO UPDATE SET status = 'Submitted', submitted_at = NOW(), teacher_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION submit_exam_marks_v3 TO authenticated;

-- 3. Update Custom Overview Function (V2 replacement)
-- We keep the name 'get_exam_submission_overview_v2' but update signature/logic
DROP FUNCTION IF EXISTS get_exam_submission_overview_v2(uuid);

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
    CROSS JOIN subjects s
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
