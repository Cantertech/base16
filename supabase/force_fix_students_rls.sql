-- FORCE FIX: Grant Super Admin Access to Students Table
-- Run this in the Supabase SQL Editor

BEGIN;

-- 1. Ensure the helper function exists and is secure
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Checks if the current user has the 'super_admin' role in the profiles table
  -- SECURITY DEFINER ensures this runs with admin privileges, bypassing RLS on the profiles table itself
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop conflicting policies on the 'students' table
-- We drop common names to ensure we start fresh
DROP POLICY IF EXISTS "Super Admin Access" ON public.students;
DROP POLICY IF EXISTS "Super Admins can view all students" ON public.students;
DROP POLICY IF EXISTS "Enable read access for super admins" ON public.students;

-- 3. Create the definitive Super Admin policy for students
CREATE POLICY "Super Admin Access" ON public.students
FOR ALL
USING ( public.is_super_admin() )
WITH CHECK ( public.is_super_admin() );

-- 4. Do the same for 'profiles' (needed to see teachers)
DROP POLICY IF EXISTS "Super Admin Access" ON public.profiles;
CREATE POLICY "Super Admin Access" ON public.profiles
FOR ALL
USING ( public.is_super_admin() )
WITH CHECK ( public.is_super_admin() );

-- 5. Do the same for 'schools' (needed to see schools)
DROP POLICY IF EXISTS "Super Admin Access" ON public.schools;
CREATE POLICY "Super Admin Access" ON public.schools
FOR ALL
USING ( public.is_super_admin() )
WITH CHECK ( public.is_super_admin() );

COMMIT;

-- 6. VERIFICATION (Results will appear in the "Results" tab)
SELECT 
  auth.uid() as "Your User ID",
  (SELECT role FROM public.profiles WHERE id = auth.uid()) as "Your Role (Must be 'super_admin')",
  (SELECT count(*) FROM public.students) as "Total Visible Students";
