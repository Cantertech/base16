-- Robust Delete Function V5 (Updated for Silas Access)
-- - Returns a JSON report of what was deleted
-- - Handles missing tables gracefully (skips them instead of failing)
-- - Verifies deletion
-- - Security: Allows 'super_admin' role OR email starting with 'silas'

-- FIX: Drop the old function first because we are changing the return type from VOID to JSONB
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
    user_email TEXT;
BEGIN
    -- 1. Security Check
    user_email := auth.jwt() ->> 'email';
    
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    ) AND (
        -- Allow "silas" or emails starting with "silas"
        COALESCE(user_email, '') NOT ILIKE 'silas%'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only Super Admins can perform this action. Current User: %', user_email;
    END IF;

    RAISE NOTICE 'Starting deletion for school: % by user %', target_school_id, user_email;

    -- 2. Delete from child tables safely
    FOREACH t IN ARRAY tables LOOP
        BEGIN
            EXECUTE format('DELETE FROM %I WHERE school_id = $1', t) USING target_school_id;
            GET DIAGNOSTICS current_count = ROW_COUNT;
            
            -- Only add to result if valid
            IF current_count > 0 THEN
                result := jsonb_set(result, ARRAY[t], to_jsonb(current_count));
            END IF;
        EXCEPTION 
            WHEN undefined_table THEN
                -- Table doesn't exist, ignore
                RAISE NOTICE 'Table % does not exist, skipping.', t;
            WHEN OTHERS THEN
                RAISE WARNING 'Error deleting from %: %', t, SQLERRM;
        END;
    END LOOP;

    -- 3. Delete the school
    DELETE FROM schools WHERE id = target_school_id;
    GET DIAGNOSTICS current_count = ROW_COUNT;
    result := jsonb_set(result, '{schools}', to_jsonb(current_count));

    -- 4. Verify
    IF current_count = 0 THEN
        RAISE EXCEPTION 'School ID % not found or could not be deleted. Check if ID matches.', target_school_id;
    END IF;

    RETURN result;
END;
$$;
