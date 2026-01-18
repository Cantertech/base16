-- Add Term Management V2

-- 1. Ensure schools has term_start_date
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS term_start_date DATE;

-- 2. Add term/year to attendance
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS term TEXT,
ADD COLUMN IF NOT EXISTS academic_year TEXT;

-- 3. Update get_student_attendance_summary to filter by Term
DROP FUNCTION IF EXISTS get_student_attendance_summary(UUID);

CREATE OR REPLACE FUNCTION get_student_attendance_summary(p_student_id UUID)
RETURNS JSON AS $$
DECLARE
    v_school_id UUID;
    v_term TEXT;
    v_year TEXT;
    v_present BIGINT;
    v_total BIGINT;
BEGIN
    -- Get student's school and current term context
    SELECT s.id, s.current_term, s.academic_year 
    INTO v_school_id, v_term, v_year
    FROM students st
    JOIN schools s ON st.school_id = s.id
    WHERE st.id = p_student_id;

    SELECT 
        COUNT(*) FILTER (WHERE status = 'Present'),
        COUNT(*)
    INTO v_present, v_total
    FROM attendance
    WHERE student_id = p_student_id
    AND term = v_term 
    AND academic_year = v_year;

    RETURN json_build_object(
        'present', COALESCE(v_present, 0),
        'total', COALESCE(v_total, 0)
    );
END;
$$ LANGUAGE plpgsql;

-- 4. Re-Apply start_new_term with safe column usage (idempotent replacement)
CREATE OR REPLACE FUNCTION start_new_term(
    p_school_id UUID,
    p_new_term TEXT,
    p_new_year TEXT,
    p_copy_fees BOOLEAN DEFAULT FALSE
) RETURNS VOID AS $$
DECLARE
    v_old_term TEXT;
    v_old_year TEXT;
BEGIN
    -- Get old term info
    SELECT current_term, academic_year INTO v_old_term, v_old_year
    FROM schools WHERE id = p_school_id;

    -- Update School Config
    UPDATE schools 
    SET current_term = p_new_term,
        academic_year = p_new_year,
        term_start_date = CURRENT_DATE
    WHERE id = p_school_id;
    
    -- Sync Exam Config table if it exists
    -- We check if table exists to avoid errors? No, table definitely exists in this schema.
    UPDATE exam_config
    SET current_term = p_new_term,
        academic_year = p_new_year,
        exam_name = 'End of ' || p_new_term || ' Exam',
        status = 'SETUP',
        mark_entry_enabled = TRUE
    WHERE school_id = p_school_id;

    -- Copy Fees if requested
    IF p_copy_fees AND v_old_term IS NOT NULL THEN
        INSERT INTO fee_structure (school_id, name, amount, target_class, term, academic_year)
        SELECT school_id, name, amount, target_class, p_new_term, p_new_year
        FROM fee_structure
        WHERE school_id = p_school_id 
        AND term = v_old_term 
        AND academic_year = v_old_year;
    END IF;

END;
$$ LANGUAGE plpgsql;
