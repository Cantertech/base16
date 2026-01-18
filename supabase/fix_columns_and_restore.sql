-- FIX Missing Columns & Restore Data (Final Attempt)

-- 1. Ensure Columns Exist (Idempotent)
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS term TEXT,
ADD COLUMN IF NOT EXISTS academic_year TEXT;

-- 2. Backfill null transactions (Safety step)
UPDATE transactions t
SET term = s.current_term,
    academic_year = s.academic_year
FROM schools s
WHERE t.school_id = s.id
AND t.term IS NULL;

-- 3. FIX: Update the switch_school_term function
CREATE OR REPLACE FUNCTION switch_school_term(
    p_school_id UUID,
    p_new_term TEXT,
    p_new_year TEXT,
    p_copy_fees BOOLEAN DEFAULT FALSE
) RETURNS VOID AS $$
DECLARE
    v_old_term TEXT;
    v_old_year TEXT;
    v_fee RECORD;
BEGIN
    -- 1. Get Old Term Info
    SELECT current_term, academic_year INTO v_old_term, v_old_year
    FROM schools WHERE id = p_school_id;

    -- 2. ARCHIVE OLD BALANCES
    IF v_old_term IS NOT NULL THEN
        INSERT INTO student_term_balances (school_id, student_id, term, academic_year, balance)
        SELECT school_id, id, v_old_term, v_old_year, balance
        FROM students
        WHERE school_id = p_school_id
        ON CONFLICT (student_id, term, academic_year) 
        DO UPDATE SET balance = EXCLUDED.balance;
    END IF;

    -- 3. UPDATE SCHOOL CONFIG
    UPDATE schools 
    SET current_term = p_new_term,
        academic_year = p_new_year,
        term_start_date = CURRENT_DATE
    WHERE id = p_school_id;
    
    -- Sync Exam Config
    UPDATE exam_config
    SET current_term = p_new_term,
        academic_year = p_new_year,
        exam_name = 'End of ' || p_new_term || ' Exam',
        status = 'SETUP',
        mark_entry_enabled = TRUE
    WHERE school_id = p_school_id;

    -- 4. RESTORE NEW BALANCES
    UPDATE students s
    SET balance = COALESCE(
        (SELECT stb.balance 
         FROM student_term_balances stb 
         WHERE stb.student_id = s.id 
         AND stb.term = p_new_term 
         AND stb.academic_year = p_new_year), 
        0
    )
    WHERE s.school_id = p_school_id;

    -- 5. COPY FEES (Optional)
    IF p_copy_fees AND v_old_term IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM fee_structure WHERE school_id = p_school_id AND term = p_new_term AND academic_year = p_new_year) THEN
            
            INSERT INTO fee_structure (school_id, name, amount, target_class, term, academic_year)
            SELECT school_id, name, amount, target_class, p_new_term, p_new_year
            FROM fee_structure
            WHERE school_id = p_school_id 
            AND term = v_old_term 
            AND academic_year = v_old_year;
            
            FOR v_fee IN 
                SELECT amount, target_class 
                FROM fee_structure 
                WHERE school_id = p_school_id 
                AND term = p_new_term 
                AND academic_year = p_new_year
            LOOP
                IF v_fee.target_class IS NULL THEN
                     UPDATE students SET balance = balance + v_fee.amount WHERE school_id = p_school_id;
                ELSE
                     UPDATE students SET balance = balance + v_fee.amount WHERE school_id = p_school_id AND class = v_fee.target_class;
                END IF;
            END LOOP;
        END IF;
    END IF;

END;
$$ LANGUAGE plpgsql;


-- 4. DATA RESTORATION: Rebuild Balances
DO $$
DECLARE
    v_school RECORD;
    v_term RECORD;
    v_student RECORD;
    v_paid NUMERIC;
    v_fees_total NUMERIC;
    v_calc_balance NUMERIC;
BEGIN
    FOR v_school IN SELECT id, current_term, academic_year FROM schools LOOP
        
        -- Identify all unique terms
        FOR v_term IN 
            SELECT DISTINCT term, academic_year FROM fee_structure WHERE school_id = v_school.id
            UNION 
            SELECT DISTINCT term, academic_year FROM transactions WHERE school_id = v_school.id
        LOOP
            -- For each student
            FOR v_student IN SELECT id, class FROM students WHERE school_id = v_school.id LOOP
                
                -- A. Sum Fees
                SELECT COALESCE(SUM(amount), 0) INTO v_fees_total
                FROM fee_structure
                WHERE school_id = v_school.id
                AND term = v_term.term
                AND academic_year = v_term.academic_year
                AND (target_class IS NULL OR target_class = v_student.class);

                -- B. Sum Payments
                SELECT COALESCE(SUM(amount), 0) INTO v_paid
                FROM transactions
                WHERE school_id = v_school.id
                AND student_id = v_student.id
                AND term = v_term.term
                AND academic_year = v_term.academic_year;

                -- C. Net Balance
                v_calc_balance := v_fees_total - v_paid;

                -- D. Archive
                IF v_term.term IS NOT NULL THEN
                    INSERT INTO student_term_balances (school_id, student_id, term, academic_year, balance)
                    VALUES (v_school.id, v_student.id, v_term.term, v_term.academic_year, v_calc_balance)
                    ON CONFLICT (student_id, term, academic_year)
                    DO UPDATE SET balance = EXCLUDED.balance;
                END IF;

            END LOOP;
        END LOOP;

        -- Force Sync Current Students
        UPDATE students s
        SET balance = COALESCE(
            (SELECT stb.balance 
             FROM student_term_balances stb 
             WHERE stb.student_id = s.id 
             AND stb.term = v_school.current_term 
             AND stb.academic_year = v_school.academic_year), 
            0
        )
        WHERE s.school_id = v_school.id;
        
    END LOOP;
END $$;
