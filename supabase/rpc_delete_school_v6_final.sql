-- Robust Delete Function V6 (Final Silas Fix)
-- - Uses a more direct approach to identifying the privileged user
-- - Checks profiles table for email if JWT fails

-- FIX: Drop the old function
DROP FUNCTION IF EXISTS delete_school_permanently(uuid);

CREATE OR REPLACE FUNCTION delete_school_permanently(target_school_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB := '{}'::jsonb;
    current_count INT;
    tables TEXT[] := ARRAY[
        -- Level 4 (Childmost tables)
        'transactions', 'attendance', 'exam_results', 'exam_submissions', 'subject_assignments', 'feeding_logs',
        -- Level 3
        'students', 'classes', 'subjects', 'teachers', 
        -- Level 2
        'notices', 'message_logs', 'billing_history', 'referrals',
        -- Level 1
        'profiles'
    ];
    t TEXT;
    
    -- Variables for auth check
    v_user_id UUID;
    v_jwt_email TEXT;
    v_profile_email TEXT; 
    v_role TEXT;
BEGIN
    -- 1. Get Auth Context
    v_user_id := auth.uid();
    v_jwt_email := auth.jwt() ->> 'email';
    
    -- Try to fetch role and email from profiles if JWT extraction failed or just to be sure
    SELECT email, role INTO v_profile_email, v_role
    FROM profiles
    WHERE id = v_user_id;
    
    -- 2. Security Check Logic
    -- Pass if:
    -- A) Role is 'super_admin'
    -- B) JWT Email starts with 'silas'
    -- C) Profile Email starts with 'silas'
    
    IF (v_role = 'super_admin') OR 
       (v_jwt_email ILIKE 'silas%') OR 
       (v_profile_email ILIKE 'silas%') THEN
       
       RAISE NOTICE 'Access Granted. Deleting school % (User: %, Email: %, Context: %)', target_school_id, v_user_id, COALESCE(v_jwt_email, v_profile_email), 'RpcV6';
       
    ELSE
       RAISE EXCEPTION 'Access Denied: Only Super Admins can perform this action. (UID: %, JWT Email: %, Profile Email: %, Role: %)', v_user_id, v_jwt_email, v_profile_email, v_role;
    END IF;


    -- 3. Delete from child tables safely
    FOREACH t IN ARRAY tables LOOP
        BEGIN
            EXECUTE format('DELETE FROM %I WHERE school_id = $1', t) USING target_school_id;
            GET DIAGNOSTICS current_count = ROW_COUNT;
            
            IF current_count > 0 THEN
                result := jsonb_set(result, ARRAY[t], to_jsonb(current_count));
            END IF;
        EXCEPTION 
            WHEN undefined_table THEN
                RAISE NOTICE 'Table % does not exist, skipping.', t;
            WHEN OTHERS THEN
                RAISE WARNING 'Error deleting from %: %', t, SQLERRM;
        END;
    END LOOP;

    -- 4. Delete the school
    DELETE FROM schools WHERE id = target_school_id;
    GET DIAGNOSTICS current_count = ROW_COUNT;
    result := jsonb_set(result, '{schools}', to_jsonb(current_count));

    -- 5. Verify
    IF current_count = 0 THEN
        RAISE EXCEPTION 'School ID % not found or could not be deleted. Check if ID matches.', target_school_id;
    END IF;

    RETURN result;
END;
$$;
