-- Fix Exam Config Schema

-- 1. Check/Add columns to exam_config
ALTER TABLE exam_config 
ADD COLUMN IF NOT EXISTS current_term TEXT,
ADD COLUMN IF NOT EXISTS academic_year TEXT;

-- 2. Update existing records in exam_config with data from schools (if available and null)
-- This ensures the config is in sync with the school.
UPDATE exam_config e
SET current_term = s.current_term,
    academic_year = s.academic_year
FROM schools s
WHERE e.school_id = s.id
AND (e.current_term IS NULL OR e.academic_year IS NULL);

-- 3. Redefine start_new_term function to ensure it targets the correct columns
-- (Previously defined in schema_term_management_v2.sql, but we re-apply to be safe and explicit about columns)

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
    
    -- Sync Exam Config table
    -- Explicitly setting columns that we ensured exist above
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
