-- Fix Exam Config Table Columns

-- 1. Ensure `exam_config` is a table (create if not exists to be sure, though error implies it exists)
CREATE TABLE IF NOT EXISTS exam_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL UNIQUE
);

-- 2. Add missing columns
ALTER TABLE exam_config 
ADD COLUMN IF NOT EXISTS exam_name TEXT DEFAULT 'End of Term Exam',
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'SETUP',
ADD COLUMN IF NOT EXISTS mark_entry_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS current_term TEXT,
ADD COLUMN IF NOT EXISTS academic_year TEXT;

-- 3. Ensure RLS is enabled and policies exist (just in case new table)
ALTER TABLE exam_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view exam config" ON exam_config;
CREATE POLICY "Users can view exam config" ON exam_config FOR SELECT USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can update exam config" ON exam_config;
CREATE POLICY "Admins can update exam config" ON exam_config FOR UPDATE USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can insert exam config" ON exam_config;
CREATE POLICY "Admins can insert exam config" ON exam_config FOR INSERT WITH CHECK (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid()));

-- 4. Re-run the update logic to sync existing schools
UPDATE exam_config e
SET exam_name = 'End of ' || s.current_term || ' Exam',
    current_term = s.current_term,
    academic_year = s.academic_year
FROM schools s
WHERE e.school_id = s.id
AND e.exam_name = 'End of Term Exam'; -- Only update defaults
