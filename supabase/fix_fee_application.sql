-- Function to apply a new fee amount to students' existing balances
-- This is used when a new Fee Item is added to the Fee Structure.

CREATE OR REPLACE FUNCTION public.add_fee_to_students(
  p_school_id uuid,
  p_amount numeric,
  p_target_class text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate input
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN;
  END IF;

  -- 1. Apply to ALL students in the school if no class specified
  IF p_target_class IS NULL OR p_target_class = '' THEN
    UPDATE public.students
    SET balance = COALESCE(balance, 0) + p_amount
    WHERE school_id = p_school_id;
    
  -- 2. Apply ONLY to students in the specific class
  ELSE
    UPDATE public.students
    SET balance = COALESCE(balance, 0) + p_amount
    WHERE school_id = p_school_id
    AND class = p_target_class;
  END IF;
END;
$$;

-- Grant permissions explicitly
GRANT EXECUTE ON FUNCTION public.add_fee_to_students(uuid, numeric, text) TO authenticated;
