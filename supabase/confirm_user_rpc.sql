-- Function to manually confirm a user by email (Bypassing email verification)
CREATE OR REPLACE FUNCTION confirm_user_by_email(target_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE auth.users
    SET email_confirmed_at = now(),
        updated_at = now()
    WHERE email = target_email;
END;
$$;
