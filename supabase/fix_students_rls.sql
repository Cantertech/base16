-- Check and Fix Students RLS for Super Admin

-- 1. Verify is_super_admin function exists
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Explicitly drop and recreate the policy for students
DROP POLICY IF EXISTS "Super Admin Access" ON public.students;

CREATE POLICY "Super Admin Access" ON public.students
FOR ALL
USING ( public.is_super_admin() )
WITH CHECK ( public.is_super_admin() );

-- 3. Also do it for profiles, just in case
DROP POLICY IF EXISTS "Super Admin Access" ON public.profiles;

CREATE POLICY "Super Admin Access" ON public.profiles
FOR ALL
USING ( public.is_super_admin() )
WITH CHECK ( public.is_super_admin() );

-- 4. DIAGNOSTIC: Check for students with NULL school_id
-- If this returns a number > 0, you have orphaned students that won't show up in any school dashboard.
SELECT count(*) as "Orphaned Students (NULL school_id)" FROM public.students WHERE school_id IS NULL;

-- 5. DIAGNOSTIC: Check total students visible to you now
SELECT count(*) as "Total Visible Students" FROM public.students;
