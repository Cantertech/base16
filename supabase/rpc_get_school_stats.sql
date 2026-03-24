-- FIX-UP FOR SUPER ADMIN DASHBOARD
-- Ensures all required columns exist and recreates the school stats function

-- 1. Ensure required columns exist on schools table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'email') THEN
        ALTER TABLE schools ADD COLUMN email TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'phone') THEN
        ALTER TABLE schools ADD COLUMN phone TEXT;
    END IF;
END $$;

-- 2. Recreate the school stats function with a clean state
DROP FUNCTION IF EXISTS public.get_admin_school_stats();

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
    school_email TEXT,
    school_phone TEXT,
    student_count BIGINT,
    teacher_count BIGINT,
    sms_balance INTEGER,
    wallet_balance NUMERIC,
    active_modules_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
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
        (SELECT p.full_name FROM profiles p WHERE p.school_id = s.id AND p.role = 'admin' LIMIT 1) as admin_name,
        (SELECT p.email FROM profiles p WHERE p.school_id = s.id AND p.role = 'admin' LIMIT 1) as admin_email,
        s.email as school_email,
        s.phone as school_phone,
        (SELECT count(*) FROM students st WHERE st.school_id = s.id) as student_count,
        (SELECT count(*) FROM profiles pr WHERE pr.school_id = s.id AND pr.role = 'teacher') as teacher_count,
        COALESCE(s.sms_balance, 0) as sms_balance,
        (SELECT COALESCE(sw.balance, 0) FROM school_wallets sw WHERE sw.school_id = s.id) as wallet_balance,
        (SELECT count(*) FROM school_subscriptions ss WHERE ss.school_id = s.id AND ss.status = 'active') as active_modules_count
    FROM 
        schools s
    ORDER BY 
        s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_school_stats TO authenticated;

-- 3. Ensure the update profile function exists
CREATE OR REPLACE FUNCTION public.super_admin_update_school_profile(
    p_school_id UUID,
    p_school_name TEXT,
    p_school_email TEXT,
    p_school_phone TEXT,
    p_admin_name TEXT,
    p_admin_email TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.schools
    SET 
        name = p_school_name,
        email = p_school_email,
        phone = p_school_phone
    WHERE id = p_school_id;

    UPDATE public.profiles
    SET 
        full_name = p_admin_name,
        email = p_admin_email
    WHERE school_id = p_school_id AND role = 'admin';
END;
$$;

GRANT EXECUTE ON FUNCTION public.super_admin_update_school_profile TO authenticated;
