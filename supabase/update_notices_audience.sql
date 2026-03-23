-- Force Fix: Standardize all audience values to ensure the new constraint passes
-- 1. Temporarily remove the constraint
ALTER TABLE notices DROP CONSTRAINT IF EXISTS notices_audience_check;

-- 2. Map old 'Parents' to 'All Students' and fix any non-conforming or null values
UPDATE notices SET audience = 'All Students' WHERE audience = 'Parents';
UPDATE notices SET audience = 'All Staff' 
WHERE audience NOT IN ('All Staff', 'Teaching Staff', 'Admins Only', 'All Students', 'Specific Teacher');

-- 3. Add the expanded constraint back
ALTER TABLE notices ADD CONSTRAINT notices_audience_check 
  CHECK (audience = ANY (ARRAY['All Staff', 'Teaching Staff', 'Admins Only', 'All Students', 'Specific Teacher', 'Parents']));

-- 2. Add target_user_id for specific teacher notices
ALTER TABLE notices ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- 3. Add index for faster audience-based fetching
CREATE INDEX IF NOT EXISTS idx_notices_audience ON notices(audience);
CREATE INDEX IF NOT EXISTS idx_notices_target_user ON notices(target_user_id);

-- 4. Enable RLS and add basic security (if not already strictly handled by components)
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view relevant notices" ON notices;
CREATE POLICY "Users can view relevant notices" ON notices
  FOR SELECT USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) 
    AND (
      audience = 'All Staff'
      OR (audience = 'Admins Only' AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
      OR (audience = 'Teaching Staff' AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher')
      OR (audience = 'All Students' AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher')) -- Admins/Teachers see student notices
      OR (audience = 'Specific Teacher' AND target_user_id = auth.uid())
      OR (author_id = auth.uid()) -- Author can always see their own notice
    )
  );

DROP POLICY IF EXISTS "Admins can manage all notices" ON notices;
CREATE POLICY "Admins can manage all notices" ON notices
  FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Teachers can post to admins" ON notices;
CREATE POLICY "Teachers can post to admins" ON notices
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher'
    AND audience = 'Admins Only'
  );
