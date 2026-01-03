-- Robust Delete Function V4
-- - Returns a JSON report of what was deleted
-- - Handles missing tables gracefully (skips them instead of failing)
-- - Verifies deletion

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
        -- Level 4
        'transactions', 'attendance', 'exam_results', 'exam_submissions', 'subject_assignments',
        -- Level 3
        'students', 'classes', 'subjects', 'teachers', 
        -- Level 2
        'notices', 'message_logs', 'billing_history', 'referrals',
        -- Level 1
        'profiles'
    ];
    t TEXT;
BEGIN
    -- 1. Security Check
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only Super Admins can perform this action.';
    END IF;

    RAISE NOTICE 'Starting deletion for school: %', target_school_id;

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
