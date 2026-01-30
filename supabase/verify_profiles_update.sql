-- Check if profiles table exists and has name column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'name') THEN
        -- If somehow missing (unlikely given App.tsx works), add it
        ALTER TABLE profiles ADD COLUMN name TEXT;
    END IF;
END $$;

-- Enable RLS if not enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Ensure users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Ensure users can read their own profile (and maybe others for collaboration?)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

-- If you have a 'public' profiles requirement (e.g. for impersonation or admin view), adjust accordingly.
-- But for "Settings > Administrator Name", the above is sufficient.
