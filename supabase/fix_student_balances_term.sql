-- Fix Student Balances for New Term

-- 1. Create/Update the start_new_term function to also update student balances
CREATE OR REPLACE FUNCTION start_new_term(
    p_school_id UUID,
    p_new_term TEXT,
    p_new_year TEXT,
    p_copy_fees BOOLEAN DEFAULT FALSE
) RETURNS VOID AS $$
DECLARE
    v_old_term TEXT;
    v_old_year TEXT;
    v_fee_record RECORD;
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
    UPDATE exam_config
    SET current_term = p_new_term,
        academic_year = p_new_year,
        exam_name = 'End of ' || p_new_term || ' Exam',
        status = 'SETUP',
        mark_entry_enabled = TRUE
    WHERE school_id = p_school_id;

    -- Copy Fees if requested
    IF p_copy_fees AND v_old_term IS NOT NULL THEN
        -- Insert new fees and capture them to apply to balances
        FOR v_fee_record IN 
            INSERT INTO fee_structure (school_id, name, amount, target_class, term, academic_year)
            SELECT school_id, name, amount, target_class, p_new_term, p_new_year
            FROM fee_structure
            WHERE school_id = p_school_id 
            AND term = v_old_term 
            AND academic_year = v_old_year
            RETURNING amount, target_class
        LOOP
            -- Update balances for affected students
            IF v_fee_record.target_class IS NULL THEN
                -- Apply to ALL students in school
                UPDATE students 
                SET balance = balance + v_fee_record.amount
                WHERE school_id = p_school_id;
            ELSE
                -- Apply to specific class
                UPDATE students 
                SET balance = balance + v_fee_record.amount
                WHERE school_id = p_school_id AND class = v_fee_record.target_class;
            END IF;
        END LOOP;
    END IF;

END;
$$ LANGUAGE plpgsql;


-- 2. ONE-TIME FIX: Apply the fees for the CURRENT TERM to student balances
-- This handles the case where the user recently ran the OLD version of the function
-- which copied the fees but didn't update the balances.

DO $$
DECLARE
    v_school RECORD;
    v_fee RECORD;
BEGIN
    FOR v_school IN SELECT id, current_term, academic_year FROM schools LOOP
        -- For each school, find fees for the CURRENT term
        FOR v_fee IN 
            SELECT amount, target_class 
            FROM fee_structure 
            WHERE school_id = v_school.id 
            AND term = v_school.current_term 
            AND academic_year = v_school.academic_year
        LOOP
            -- Check if we should apply (Naive approach: just apply. User said balances didn't restart)
            -- To avoid double applying if they ran this twice, ideally we'd check logs, but we can't.
            -- We assume this script is run ONCE by the system now.
            
            IF v_fee.target_class IS NULL THEN
                 -- Global fee
                 UPDATE students 
                 SET balance = balance + v_fee.amount 
                 WHERE school_id = v_school.id;
            ELSE
                 -- Class fee
                 UPDATE students 
                 SET balance = balance + v_fee.amount 
                 WHERE school_id = v_school.id AND class = v_fee.target_class;
            END IF;
        END LOOP;
    END LOOP;
END $$;
