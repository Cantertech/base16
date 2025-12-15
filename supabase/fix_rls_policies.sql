-- Fix RLS policies to allow Admins to create Profiles and Teachers for others

-- 1. PROFILES: Allow admins to insert new profiles
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."profiles";
CREATE POLICY "Enable insert for admins" ON "public"."profiles"
FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin' OR role = 'super_admin'
  )
  OR auth.uid() = id -- Allow users to insert their own profile (standard flow)
);

-- 2. PROFILES: Allow admins to update any profile
DROP POLICY IF EXISTS "Enable update for users based on email" ON "public"."profiles";
CREATE POLICY "Enable update for admins" ON "public"."profiles"
FOR UPDATE USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin' OR role = 'super_admin'
  )
  OR auth.uid() = id
);

-- 3. TEACHERS: Allow admins to insert/update teachers
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON "public"."teachers";
CREATE POLICY "Enable all access for admins" ON "public"."teachers"
FOR ALL USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin' OR role = 'super_admin'
  )
);

-- 4. Enable read access for everyone (simplifies things for now)
CREATE POLICY "Enable read access for all users" ON "public"."profiles"
FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."teachers"
FOR SELECT USING (true);
