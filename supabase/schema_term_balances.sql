-- Term-Based Student Balances System

-- 1. Create a student_term_balances table
-- This table tracks how much a student owes for a SPECIFIC term.
-- The main `students.balance` column will now act as a "cache" or "current view" 
-- that is updated whenever the term is switched.

CREATE TABLE IF NOT EXISTS student_term_balances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    balance NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, term, academic_year)
);

-- 2. Enable RLS
ALTER TABLE student_term_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view term balances" ON student_term_balances;
CREATE POLICY "Users can view term balances" ON student_term_balances 
    FOR SELECT USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage term balances" ON student_term_balances;
CREATE POLICY "Admins can manage term balances" ON student_term_balances 
    FOR ALL USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid()));


-- 3. Create Function to Switch Term Context (The Core Logic)
-- When we switch terms, we need to:
-- a) Save the CURRENT balance into student_term_balances for the OLD term.
-- b) Load the saved balance from student_term_balances for the NEW term (or 0 if new).
-- c) Update the main students table to reflect this new reality.

CREATE OR REPLACE FUNCTION switch_school_term(
    p_school_id UUID,
    p_new_term TEXT,
    p_new_year TEXT,
    p_copy_fees BOOLEAN DEFAULT FALSE
) RETURNS VOID AS $$
DECLARE
    v_old_term TEXT;
    v_old_year TEXT;
    v_student RECORD;
    v_fee RECORD;
BEGIN
    -- 1. Get Old Term Info
    SELECT current_term, academic_year INTO v_old_term, v_old_year
    FROM schools WHERE id = p_school_id;

    -- 2. ARCHIVE OLD BALANCES
    -- For every student, save their current 'balance' into the term history table
    IF v_old_term IS NOT NULL THEN
        INSERT INTO student_term_balances (school_id, student_id, term, academic_year, balance)
        SELECT school_id, id as student_id, v_old_term, v_old_year, balance
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

    -- 4. RESTORE NEW BALANCES & APPLY NEW FEES
    -- For every student, update their main 'balance' column.
    -- If they have history for the new term, load it. If not, start at 0.
    
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


    -- 5. COPY FEE STRUCTURE (If requested and not already existing for target)
    -- Only copy if we haven't already set up fees for this term (avoid duplicates)
    IF p_copy_fees AND v_old_term IS NOT NULL THEN
        -- Only insert if fees don't exist yet for this term
        IF NOT EXISTS (SELECT 1 FROM fee_structure WHERE school_id = p_school_id AND term = p_new_term AND academic_year = p_new_year) THEN
            
            INSERT INTO fee_structure (school_id, name, amount, target_class, term, academic_year)
            SELECT school_id, name, amount, target_class, p_new_term, p_new_year
            FROM fee_structure
            WHERE school_id = p_school_id 
            AND term = v_old_term 
            AND academic_year = v_old_year;
            
            -- NOW APPLY THESE NEW FEES TO THE (JUST RESET) BALANCES
            -- We loop through the copied fees and add them to the fresh balances
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

-- 4. Replace the old function name logic by routing start_new_term to this new logic
CREATE OR REPLACE FUNCTION start_new_term(
    p_school_id UUID,
    p_new_term TEXT,
    p_new_year TEXT,
    p_copy_fees BOOLEAN DEFAULT FALSE
) RETURNS VOID AS $$
BEGIN
    PERFORM switch_school_term(p_school_id, p_new_term, p_new_year, p_copy_fees);
END;
$$ LANGUAGE plpgsql;
