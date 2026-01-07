-- Drop the existing function first because we are changing the return type
DROP FUNCTION IF EXISTS public.get_student_for_login(text);

CREATE OR REPLACE FUNCTION public.get_student_for_login(identifier text)
RETURNS TABLE (
  id uuid,
  school_id uuid,
  name text,
  class text,
  gender text,
  parent_name text,
  parent_phone text,
  date_of_birth date,
  enrollment_date date,
  status text,
  balance numeric,
  created_at timestamptz,
  admission_no text,
  pin text,
  photo_url text,
  school_name text,
  current_exam_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.school_id,
    s.name,
    s.class,
    s.gender,
    s.parent_name,
    s.parent_phone,
    s.date_of_birth,
    s.enrollment_date,
    s.status,
    s.balance,
    s.created_at,
    s.admission_no,
    s.pin,
    s.photo_url,
    sc.name as school_name,
    ers.status as current_exam_status
  FROM public.students s
  JOIN public.schools sc ON s.school_id = sc.id
  LEFT JOIN public.exam_report_status ers 
    ON s.school_id = ers.school_id 
    AND s.class = ers.class_name
  WHERE (s.admission_no = identifier OR s.pin = identifier OR s.id::text = identifier)
  ORDER BY ers.created_at DESC -- Get the latest exam status if multiple exist
  LIMIT 1;
END;
$$;
