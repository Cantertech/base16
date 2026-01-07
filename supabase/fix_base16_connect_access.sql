-- Function to allow public/anon users to look up a student by ID or Admission No
-- This bypasses RLS safely by being SECURITY DEFINER and only returning the specific match.

CREATE OR REPLACE FUNCTION public.get_student_for_login(identifier text)
RETURNS SETOF public.students
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- basic input validation to prevent full table dumps if empty string passed (optional but good)
  IF identifier IS NULL OR trim(identifier) = '' THEN
    RETURN;
  END IF;

  -- Check if input looks like UUID
  IF identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN QUERY
      SELECT *
      FROM public.students
      WHERE id = identifier::uuid OR admission_no = identifier
      LIMIT 1;
  ELSE
      RETURN QUERY
      SELECT *
      FROM public.students
      WHERE admission_no = identifier
      LIMIT 1;
  END IF;
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_student_for_login(text) TO anon, authenticated, service_role;
