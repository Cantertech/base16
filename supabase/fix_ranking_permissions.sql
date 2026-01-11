-- Grant execute permissions on ranking function to anon for Parent Portal access
GRANT EXECUTE ON FUNCTION public.get_student_class_rank(UUID, TEXT, TEXT, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_student_class_rank(UUID, TEXT, TEXT, TEXT, UUID) TO service_role;
