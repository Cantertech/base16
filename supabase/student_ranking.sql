-- Function to Calculate Student Position
CREATE OR REPLACE FUNCTION get_student_class_rank(
    p_school_id UUID,
    p_class TEXT,
    p_term TEXT,
    p_year TEXT,
    p_student_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_rank BIGINT;
    v_total BIGINT;
BEGIN
    -- Calculate Rank based on Total Aggregate Score
    WITH student_scores AS (
        SELECT 
            student_id,
            SUM(COALESCE(class_score, 0) + COALESCE(exam_score, 0)) as total_marks
        FROM exam_results
        WHERE school_id = p_school_id
          AND class = p_class
          AND term = p_term
          AND academic_year = p_year
        GROUP BY student_id
    ),
    rankings AS (
        SELECT 
            student_id,
            RANK() OVER (ORDER BY total_marks DESC) as rank
        FROM student_scores
    )
    SELECT rank INTO v_rank FROM rankings WHERE student_id = p_student_id;

    -- Get total count of students who have results in this context
    SELECT COUNT(DISTINCT student_id) INTO v_total 
    FROM exam_results 
    WHERE school_id = p_school_id AND class = p_class AND term = p_term AND academic_year = p_year;

    RETURN jsonb_build_object('position', COALESCE(v_rank, 0), 'total_students', COALESCE(v_total, 0));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_student_class_rank TO authenticated;
