-- Ensure Teachers table has RLS enabled
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- Re-create the policy just in case it's missing or broken
DROP POLICY IF EXISTS "Users can view teachers from their school" ON teachers;
CREATE POLICY "Users can view teachers from their school"
  ON teachers FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM profiles
      WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage teachers" ON teachers;
CREATE POLICY "Admins can manage teachers"
  ON teachers FOR ALL
  USING (
    school_id IN (
      SELECT school_id FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Also ensure Students table is secure
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
