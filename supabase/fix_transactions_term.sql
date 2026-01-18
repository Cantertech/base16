-- Fix Transactions for Term Management

-- 1. Add Term/Year columns to transactions
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS term TEXT,
ADD COLUMN IF NOT EXISTS academic_year TEXT;

-- 2. Backfill existing transactions with current school term info
-- This associates all valid past history with the "current" (presumably first/setup) term.
-- When the user eventually clicks "Start New Term", these will stay behind, achieving the "Reset".
UPDATE transactions t
SET term = s.current_term,
    academic_year = s.academic_year
FROM schools s
WHERE t.school_id = s.id
AND t.term IS NULL;
