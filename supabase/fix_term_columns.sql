-- Fix missing columns for Term Management

-- 1. Add columns to 'schools' table
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS current_term TEXT DEFAULT 'First Term',
ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT TO_CHAR(NOW(), 'YYYY') || '/' || TO_CHAR(NOW() + INTERVAL '1 year', 'YYYY');

-- 2. Add columns to 'fee_structure' table (if missed)
ALTER TABLE fee_structure 
ADD COLUMN IF NOT EXISTS term TEXT, 
ADD COLUMN IF NOT EXISTS academic_year TEXT;

-- 3. Add columns to 'attendance' table (if missed)
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS term TEXT,
ADD COLUMN IF NOT EXISTS academic_year TEXT;

-- 4. Re-attempt Backfill for Attendance
UPDATE attendance a
SET term = s.current_term,
    academic_year = s.academic_year
FROM schools s
WHERE a.school_id = s.id
AND a.term IS NULL;

-- 5. Backfill Fee Structure (if needed)
UPDATE fee_structure f
SET term = s.current_term,
    academic_year = s.academic_year
FROM schools s
WHERE f.school_id = s.id
AND f.term IS NULL;
