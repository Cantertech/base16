-- Update System Module Prices
INSERT INTO public.system_modules (id, name, price_ghs) VALUES 
('academic_engine', 'Academic & Parent App', 50.00),
('daily_tracker', 'Feeding & Daily Tracker', 40.00),
('complete_bundle', 'The Complete Bundle (Unlock All)', 150.00)
ON CONFLICT (id) DO UPDATE 
SET price_ghs = EXCLUDED.price_ghs;

-- Fix Super Admin School Stats RPC
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
        (SELECT p.full_name FROM profiles p WHERE p.school_id = s.id AND p.role = 'admin' LIMIT 1)::TEXT as admin_name,
        (SELECT p.email FROM profiles p WHERE p.school_id = s.id AND p.role = 'admin' LIMIT 1)::TEXT as admin_email,
        s.email as school_email,
        s.phone as school_phone,
        (SELECT count(*) FROM students st WHERE st.school_id = s.id)::BIGINT as student_count,
        (SELECT count(*) FROM profiles pr WHERE pr.school_id = s.id AND pr.role = 'teacher')::BIGINT as teacher_count,
        COALESCE(s.sms_balance, 0)::INTEGER as sms_balance,
        COALESCE((SELECT sw.balance FROM school_wallets sw WHERE sw.school_id = s.id), 0.00)::NUMERIC as wallet_balance,
        (SELECT count(*) FROM school_subscriptions ss WHERE ss.school_id = s.id AND ss.status = 'active')::BIGINT as active_modules_count
    FROM 
        schools s
    ORDER BY 
        s.created_at DESC;
END;
$$;
