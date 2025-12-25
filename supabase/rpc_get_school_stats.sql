-- Create a robust function to fetch schools with counts, bypassing RLS for the counts
-- This ensures the Super Admin Dashboard always shows correct numbers

CREATE OR REPLACE FUNCTION public.get_admin_school_stats()
RETURNS TABLE (
    id UUID,
    name TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    next_payment_due TIMESTAMP WITH TIME ZONE,
    last_payment_date TIMESTAMP WITH TIME ZONE,
    admin_name TEXT,
    admin_email TEXT,
    student_count BIGINT,
    teacher_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with superuser privileges
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.status,
        s.created_at,
        s.next_payment_due::TIMESTAMP WITH TIME ZONE,
        s.last_payment_date::TIMESTAMP WITH TIME ZONE,
        -- Get the first admin's details (or null)
        (SELECT p.full_name FROM profiles p WHERE p.school_id = s.id AND p.role = 'admin' LIMIT 1) as admin_name,
        (SELECT p.email FROM profiles p WHERE p.school_id = s.id AND p.role = 'admin' LIMIT 1) as admin_email,
        -- Count students
        (SELECT count(*) FROM students st WHERE st.school_id = s.id) as student_count,
        -- Count teachers
        (SELECT count(*) FROM profiles pr WHERE pr.school_id = s.id AND pr.role = 'teacher') as teacher_count
    FROM 
        schools s
    ORDER BY 
        s.created_at DESC;
END;
$$;
