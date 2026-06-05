-- Create a stored procedure to allow super admins to manually activate subscriptions with custom durations
CREATE OR REPLACE FUNCTION public.super_admin_activate_subscriptions(
    p_school_id UUID,
    p_module_ids TEXT[],
    p_duration_months INT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with database owner privileges to bypass RLS
AS $$
DECLARE
    v_expires_at TIMESTAMPTZ;
    v_module_id TEXT;
    v_current_user_email TEXT;
BEGIN
    -- 1. Check permissions: Super Admin role OR 'silas' email fallback
    v_current_user_email := auth.jwt() ->> 'email';
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    ) THEN
        IF (v_current_user_email NOT ILIKE '%silas%') AND (v_current_user_email != 'silas@222') THEN
             RAISE EXCEPTION 'Access denied: Only super admins can perform this action.';
        END IF;
    END IF;

    -- 2. Calculate expires_at date
    IF p_duration_months <= 0 THEN
        v_expires_at := 'infinity';
    ELSE
        v_expires_at := now() + (p_duration_months || ' months')::interval;
    END IF;

    -- 3. Loop through module IDs and upsert subscriptions
    FOREACH v_module_id IN ARRAY p_module_ids LOOP
        INSERT INTO public.school_subscriptions (school_id, module_id, status, expires_at)
        VALUES (p_school_id, v_module_id, 'active', v_expires_at)
        ON CONFLICT (school_id, module_id)
        DO UPDATE SET 
            status = 'active', 
            expires_at = v_expires_at,
            updated_at = now();
    END LOOP;

    RETURN json_build_object('success', true, 'message', 'Subscriptions updated successfully.');
END;
$$;
