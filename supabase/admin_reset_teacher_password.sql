-- Ensure pgcrypto is available for hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Stored procedure to allow school admins to reset teacher passwords
CREATE OR REPLACE FUNCTION admin_reset_teacher_password(target_teacher_id UUID, new_password TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_school_id UUID;
    target_school_id UUID;
BEGIN
    -- 1. Verify caller is an admin or super admin
    SELECT school_id INTO caller_school_id
    FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'super_admin');

    IF caller_school_id IS NULL THEN
        RAISE EXCEPTION 'Access denied: Only admins can perform this action.';
    END IF;

    -- 2. Verify target teacher exists and belongs to the same school
    SELECT t.school_id INTO target_school_id
    FROM public.teachers t
    WHERE t.id = target_teacher_id;

    IF target_school_id IS NULL THEN
        RAISE EXCEPTION 'Target teacher not found.';
    END IF;

    -- Check if schools match, or if it's a super_admin (who can reset anyone)
    IF (target_school_id != caller_school_id) AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
        RAISE EXCEPTION 'Permission denied: Cannot reset password for a teacher in another school.';
    END IF;

    -- 3. Update the password in auth.users
    -- We use crypt to hash the password exactly how Supabase Auth expects it (bcrypt)
    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf'))
    WHERE id = target_teacher_id;

    -- 4. Update the plain text password in the teachers table for reference
    UPDATE public.teachers
    SET password = new_password
    WHERE id = target_teacher_id;

END;
$$;
