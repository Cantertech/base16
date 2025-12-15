-- 1. First, let's clean up the potentially corrupted user again
DO $$
DECLARE
    target_email TEXT := 'silaskwarteng17@gmail.com'; -- The email that is failing
    user_id UUID;
BEGIN
    SELECT id INTO user_id FROM auth.users WHERE email = target_email;
    IF user_id IS NOT NULL THEN
        DELETE FROM public.teachers WHERE id = user_id;
        DELETE FROM public.profiles WHERE id = user_id;
        DELETE FROM auth.users WHERE id = user_id;
    END IF;
END $$;

-- 2. Now, let's update the function to be smarter about the instance_id
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
AS $$
DECLARE
    new_user_id uuid;
    v_instance_id uuid;
BEGIN
    -- Dynamically get the instance_id from an existing user (like the admin)
    -- This ensures we match the correct Supabase instance configuration
    SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;
    
    -- Fallback if table is empty (unlikely)
    IF v_instance_id IS NULL THEN
        v_instance_id := '00000000-0000-0000-0000-000000000000';
    END IF;

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
