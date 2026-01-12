
-- COMPREHENSIVE FIX FOR EXAM RESULTS SAVING
-- 1. Ensure columns exist
-- 2. Fix Unique Constraint to allow multiple terms
-- 3. Fix RLS policies
-- 4. Grant permissions

BEGIN;

-- 1. Add Columns if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exam_results' AND column_name = 'term') THEN
        ALTER TABLE public.exam_results ADD COLUMN term TEXT NOT NULL DEFAULT 'First Term';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exam_results' AND column_name = 'academic_year') THEN
        ALTER TABLE public.exam_results ADD COLUMN academic_year TEXT NOT NULL DEFAULT '2024/2025';
    END IF;
END $$;

-- 2. Reset Constraints (Drop all variations and create the correct one)
ALTER TABLE public.exam_results DROP CONSTRAINT IF EXISTS exam_results_student_id_class_subject_key;
ALTER TABLE public.exam_results DROP CONSTRAINT IF EXISTS exam_results_student_subject_class_key;
ALTER TABLE public.exam_results DROP CONSTRAINT IF EXISTS exam_results_student_id_class_subject_term_academic_year_key;

-- This is the constraint used by the Frontend Upsert
ALTER TABLE public.exam_results
ADD CONSTRAINT exam_results_student_id_class_subject_term_academic_year_key
UNIQUE (student_id, class, subject, term, academic_year);

-- 3. Update RLS Policies
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users based on school_id" ON public.exam_results;
DROP POLICY IF EXISTS "School staff can insert exam results" ON public.exam_results;
DROP POLICY IF EXISTS "School staff can update exam results" ON public.exam_results;
DROP POLICY IF EXISTS "School staff can select exam results" ON public.exam_results;

-- Create simple, powerful policies
CREATE POLICY "Staff can select results" ON public.exam_results
FOR SELECT USING (
    auth.uid() IN (
        SELECT id FROM profiles WHERE school_id = exam_results.school_id
    )
);

CREATE POLICY "Staff can insert results" ON public.exam_results
FOR INSERT WITH CHECK (
    auth.uid() IN (
        SELECT id FROM profiles WHERE school_id = exam_results.school_id
    ) OR 
    exists (select 1 from profiles where id = auth.uid() and school_id = exam_results.school_id)
);

CREATE POLICY "Staff can update results" ON public.exam_results
FOR UPDATE USING (
    exists (select 1 from profiles where id = auth.uid() and school_id = exam_results.school_id)
);

-- 4. Grant Permissions
GRANT ALL ON public.exam_results TO authenticated;
GRANT ALL ON public.exam_results TO anon;

COMMIT;

-- Debug Function to check if results exist (ignore RLS)
CREATE OR REPLACE FUNCTION debug_check_results(p_student_id UUID)
RETURNS TABLE (term text, class_score numeric, exam_score numeric) AS $$
BEGIN
    RETURN QUERY SELECT term, class_score, exam_score FROM exam_results WHERE student_id = p_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
