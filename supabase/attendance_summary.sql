CREATE OR REPLACE FUNCTION get_student_attendance_summary(p_student_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_present BIGINT;
    v_total BIGINT;
BEGIN
    -- Total days marked for this student
    SELECT COUNT(*) INTO v_total
    FROM attendance
    WHERE student_id = p_student_id;

    -- Total days Present
    SELECT COUNT(*) INTO v_present
    FROM attendance
    WHERE student_id = p_student_id
      AND status = 'Present';
      
    RETURN jsonb_build_object('present', COALESCE(v_present, 0), 'total', COALESCE(v_total, 0));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_student_attendance_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_attendance_summary TO anon;
