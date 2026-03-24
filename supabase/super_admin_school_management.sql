-- Super Admin Management RPCs
-- Allows updating school and admin details bypassing standard RLS

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
    -- 1. Update School Basic Info
    UPDATE public.schools
    SET 
        name = p_school_name,
        email = p_school_email,
        phone = p_school_phone
    WHERE id = p_school_id;

    -- 2. Update Admin Profile
    UPDATE public.profiles
    SET 
        full_name = p_admin_name,
        email = p_admin_email
    WHERE school_id = p_school_id AND role = 'admin';
    
    -- Note: Updating auth.users email directly is suppressed. 
    -- If login changes are needed, use a dedicated Edge Function or Admin Auth API.
END;
$$;

GRANT EXECUTE ON FUNCTION public.super_admin_update_school_profile TO authenticated;
