-- Function to fetch student results
CREATE OR REPLACE FUNCTION public.get_student_results(target_student_id uuid)
RETURNS TABLE (
    subject text,
    class_score numeric,
    exam_score numeric,
    total numeric,
    class text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    er.subject, er.class_score, er.exam_score, er.total, er.class, er.created_at
  FROM public.exam_results er
  WHERE er.student_id = target_student_id
  ORDER BY er.created_at DESC;
END;
$$;

-- Function to fetch school notices for a student
CREATE OR REPLACE FUNCTION public.get_student_notices(target_student_id uuid)
RETURNS TABLE (
    id uuid,
    title text,
    message text,
    priority text,
    date date,
    audience text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  -- Get school_id from student
  SELECT school_id INTO v_school_id FROM public.students WHERE id = target_student_id;
  
  IF v_school_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      n.id, n.title, n.message, n.priority, n.date, n.audience
    FROM public.notices n
    WHERE n.school_id = v_school_id
    ORDER BY n.date DESC
    LIMIT 20;
  END IF;
END;
$$;

-- Grant execution to anon (public) for these functions as they are used in the public portal
GRANT EXECUTE ON FUNCTION public.get_student_results(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_student_notices(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_student_results(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_notices(uuid) TO authenticated;
