-- Function to allow public/anon users to fetch transactions for a specific student
-- This bypasses RLS safely by being SECURITY DEFINER and only returning records for the given student ID.

CREATE OR REPLACE FUNCTION public.get_student_transactions(target_student_id uuid)
RETURNS TABLE (
    id uuid,
    amount numeric,
    date date,
    type text,
    method text,
    reference text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.amount,
    t.date,
    t.type,
    t.method,
    t.reference,
    t.created_at
  FROM public.transactions t
  WHERE t.student_id = target_student_id
  ORDER BY t.date DESC, t.created_at DESC;
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_student_transactions(uuid) TO anon, authenticated, service_role;
