-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to create a teacher user (Auth + Profile + Teacher Record)
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
SECURITY DEFINER -- Runs with privileges of the creator (superuser/admin)
AS $$
DECLARE
    new_user_id uuid;
BEGIN
    -- 1. Create user in auth.users
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
        recovery_token
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        email,
        crypt(password, gen_salt('bf')),
        now(), -- Auto-confirm email
        '{"provider": "email", "providers": ["email"]}',
        jsonb_build_object('full_name', name, 'role', 'teacher', 'school_id', school_id),
        now(),
        now(),
        '',
        ''
    )
    RETURNING id INTO new_user_id;

    -- 2. Create profile
    INSERT INTO public.profiles (id, school_id, role, full_name, email, phone_number)
    VALUES (new_user_id, school_id, 'teacher', name, email, phone)
    ON CONFLICT (id) DO UPDATE
    SET 
        school_id = EXCLUDED.school_id,
        role = 'teacher',
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone_number = EXCLUDED.phone_number;

    -- 3. Create teacher record
    INSERT INTO public.teachers (id, school_id, name, email, phone, subject, assigned_class, status, salary, password)
    VALUES (new_user_id, school_id, name, email, phone, subject, assigned_class, 'Active', salary, password);

    RETURN new_user_id;
END;
$$;

-- Function to delete a teacher user (Clean up Auth + Profile + Teacher)
CREATE OR REPLACE FUNCTION delete_teacher_user(teacher_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Delete from auth.users (This usually cascades to profiles/teachers if FKs are set, but let's be sure)
    DELETE FROM public.teachers WHERE id = teacher_id;
    DELETE FROM public.profiles WHERE id = teacher_id;
    DELETE FROM auth.users WHERE id = teacher_id;
END;
$$;
