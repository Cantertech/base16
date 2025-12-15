-- Minimal script to clean and recreate the user
-- This bypasses the function and inserts directly to ensure no function logic errors.

DO $$
DECLARE
    target_email TEXT := 'silaskwarteng17@gmail.com';
    new_id UUID := gen_random_uuid();
    v_school_id UUID;
BEGIN
    -- 1. Get a valid school_id (from the first school found)
    SELECT id INTO v_school_id FROM schools LIMIT 1;
    
    -- 2. Cleanup existing
    DELETE FROM public.teachers WHERE email = target_email;
    DELETE FROM public.profiles WHERE email = target_email;
    DELETE FROM auth.users WHERE email = target_email;

    -- 3. Insert into auth.users (Minimal fields)
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        new_id,
        'authenticated',
        'authenticated',
        target_email,
        crypt('password123', gen_salt('bf')), -- Ensure pgcrypto is enabled!
        now(),
        now(),
        now(),
        '{"provider": "email", "providers": ["email"]}',
        jsonb_build_object('full_name', 'Silas Teacher', 'role', 'teacher', 'school_id', v_school_id),
        false
    );

    -- 4. Insert into profiles
    INSERT INTO public.profiles (id, school_id, role, full_name, email)
    VALUES (new_id, v_school_id, 'teacher', 'Silas Teacher', target_email);

    -- 5. Insert into teachers
    INSERT INTO public.teachers (id, school_id, name, email, status, password)
    VALUES (new_id, v_school_id, 'Silas Teacher', target_email, 'Active', 'password123');

    RAISE NOTICE 'User recreated with ID: %', new_id;
END $$;
