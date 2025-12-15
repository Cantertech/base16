-- 1. Enable pgcrypto in public schema just in case
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Drop the old function to ensure a clean slate
DROP FUNCTION IF EXISTS create_teacher_user;

-- 3. Recreate the function with explicit search_path and error handling
CREATE OR REPLACE FUNCTION create_teacher_user(
    email text,
    password text,
    name text,
    school_id uuid,
    phone text,
    subject text,
    assigned_class text,
    salary numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions -- IMPORTANT: Fixes "Database error querying schema"
AS $$
DECLARE
    new_user_id uuid;
    v_instance_id uuid;
    v_exists boolean;
BEGIN
    -- Get instance_id dynamically
    SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;
    IF v_instance_id IS NULL THEN
        v_instance_id := '00000000-0000-0000-0000-000000000000';
    END IF;

    -- Check if user exists
    SELECT EXISTS (SELECT 1 FROM auth.users WHERE auth.users.email = create_teacher_user.email) INTO v_exists;

    IF v_exists THEN
        -- Get existing ID
        SELECT id INTO new_user_id FROM auth.users WHERE auth.users.email = create_teacher_user.email;
        
        -- UPDATE existing user
        UPDATE auth.users
        SET encrypted_password = crypt(password, gen_salt('bf')),
            raw_user_meta_data = jsonb_build_object('full_name', name, 'role', 'teacher', 'school_id', school_id),
            updated_at = now(),
            email_confirmed_at = now() -- Ensure confirmed
        WHERE id = new_user_id;
    ELSE
        -- INSERT new user
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            recovery_token,
            is_super_admin
        )
        VALUES (
            v_instance_id,
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            email,
            crypt(password, gen_salt('bf')),
            now(),
            '{"provider": "email", "providers": ["email"]}',
            jsonb_build_object('full_name', name, 'role', 'teacher', 'school_id', school_id),
            now(),
            now(),
            '',
            '',
            false
        )
        RETURNING id INTO new_user_id;
    END IF;

    -- Upsert Profile
    INSERT INTO public.profiles (id, school_id, role, full_name, email, phone_number)
    VALUES (new_user_id, school_id, 'teacher', name, email, phone)
    ON CONFLICT (id) DO UPDATE
    SET 
        school_id = EXCLUDED.school_id,
        role = 'teacher',
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone_number = EXCLUDED.phone_number;

    -- Upsert Teacher Record
    INSERT INTO public.teachers (id, school_id, name, email, phone, subject, assigned_class, status, salary, password)
    VALUES (new_user_id, school_id, name, email, phone, subject, assigned_class, 'Active', salary, password)
    ON CONFLICT (id) DO UPDATE
    SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        subject = EXCLUDED.subject,
        assigned_class = EXCLUDED.assigned_class,
        salary = EXCLUDED.salary,
        password = EXCLUDED.password;

    RETURN new_user_id;
END;
$$;
