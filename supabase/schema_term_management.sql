-- Add Term Management Capabilities

-- 1. Add Term/Year columns to fee_structure to allow term-specific fees
ALTER TABLE fee_structure 
ADD COLUMN IF NOT EXISTS term TEXT, 
ADD COLUMN IF NOT EXISTS academic_year TEXT;

-- 2. Backfill existing fees with the school's current term info
DO $$
DECLARE 
    r RECORD;
BEGIN
    FOR r IN SELECT id, current_term, academic_year FROM schools LOOP
        -- Only update if term is null
        UPDATE fee_structure
        SET term = COALESCE(r.current_term, 'First Term'), 
            academic_year = COALESCE(r.academic_year, EXTRACT(YEAR FROM NOW())::text)
        WHERE school_id = r.id AND term IS NULL;
    END LOOP;
END $$;

-- 3. Create RPC to Start New Term
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
        academic_year = p_new_year
    WHERE id = p_school_id;
    
    -- Sync Exam Config table if it exists
    -- We update the exam name to match the new term too, to avoid confusion?
    -- E.g. "End of [New Term] Exam"
    UPDATE exam_config
    SET current_term = p_new_term,
        academic_year = p_new_year,
        exam_name = 'End of ' || p_new_term || ' Exam', -- Heuristic default
        status = 'SETUP', -- Reset status to setup
        mark_entry_enabled = TRUE -- Re-enable entry? Or disable until setup? Maybe Enable.
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
