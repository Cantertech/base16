-- Fix Parent Portal Results Fetching

-- 1. Ensure Status Table exists
CREATE TABLE IF NOT EXISTS public.exam_report_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL,
    class_name TEXT NOT NULL,
    term TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    status TEXT DEFAULT 'Pending', -- 'Released'
    released_at TIMESTAMPTZ,
    UNIQUE(school_id, class_name, term, academic_year)
);

-- 2. Define get_student_results to respect Release Status
DROP FUNCTION IF EXISTS get_student_results(uuid);

CREATE OR REPLACE FUNCTION get_student_results(target_student_id UUID)
RETURNS TABLE (
    subject TEXT,
    class_score NUMERIC,
    exam_score NUMERIC,
    total NUMERIC,
    class TEXT,
    created_at TIMESTAMPTZ,
    term TEXT,
    academic_year TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        er.subject,
        er.class_score,
        er.exam_score,
        (COALESCE(er.class_score, 0) + COALESCE(er.exam_score, 0)) as total,
        er.class,
        COALESCE(er.published_at, NOW()) as created_at,
        er.term,
        er.academic_year
    FROM exam_results er
    JOIN exam_report_status ers ON 
        er.school_id = ers.school_id AND 
        er.class = ers.class_name AND
        er.term = ers.term AND
        er.academic_year = ers.academic_year
    WHERE er.student_id = target_student_id
      AND ers.status = 'Released';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_student_results TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_results TO anon; -- Allow unauthenticated if using public API logic, else authenticated

-- 3. Define get_student_released_terms (if missing)
DROP FUNCTION IF EXISTS get_student_released_terms(uuid);

CREATE OR REPLACE FUNCTION get_student_released_terms(target_student_id UUID)
RETURNS TABLE (
    term TEXT,
    status TEXT,
    class_name TEXT,
    released_at TIMESTAMPTZ
) AS $$
BEGIN
    -- Derive terms from student's class or enrollment history?
    -- Simplified: Check all released terms for the student's CURRENT class (or past results?)
    -- Ideally, we join on exam_results to find which terms the student participated in.
    RETURN QUERY
    SELECT DISTINCT
        ers.term,
        ers.status,
        ers.class_name,
        ers.released_at
    FROM exam_report_status ers
    JOIN exam_results er ON 
        er.school_id = ers.school_id AND 
        er.class = ers.class_name AND
        er.term = ers.term
    WHERE er.student_id = target_student_id 
      AND ers.status = 'Released';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_student_released_terms TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_released_terms TO anon;
