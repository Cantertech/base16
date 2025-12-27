-- Create a stored procedure to allow super admins to reset user passwords
CREATE OR REPLACE FUNCTION reset_school_admin_password(target_school_id UUID, new_password TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- 1. Check if the executing user is a super admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Access denied: Only super admins can perform this action';
    END IF;

    -- 2. Find the admin user for the specified school
    SELECT id INTO target_user_id
    FROM profiles
    WHERE school_id = target_school_id AND role = 'admin'
    LIMIT 1;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'No admin found for the specified school';
    END IF;

    -- 3. Update the user's password in auth.users
    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf'))
    WHERE id = target_user_id;

END;
$$;
