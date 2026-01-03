-- Enhanced Secure Delete Function (V2)
-- explicitly deletes children to ensure no constraint holds back the deletion
-- and verifies the deletion count.

CREATE OR REPLACE FUNCTION delete_school_permanently(target_school_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    row_count int;
BEGIN
    -- 1. Security Check
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only Super Admins can perform this action.';
    END IF;

    -- 2. Explicitly delete from child tables (Reverse dependency order)
    -- This handles cases where ON DELETE CASCADE might be missing or failing silently
    
    -- Level 4 (Deepest dependencies)
    DELETE FROM transactions WHERE school_id = target_school_id;
    DELETE FROM attendance WHERE school_id = target_school_id;
    DELETE FROM exam_results WHERE school_id = target_school_id;
    DELETE FROM exam_submissions WHERE school_id = target_school_id;
    DELETE FROM subject_assignments WHERE school_id = target_school_id;
    
    -- Level 3
    DELETE FROM students WHERE school_id = target_school_id;
    DELETE FROM classes WHERE school_id = target_school_id;
    DELETE FROM subjects WHERE school_id = target_school_id;
    DELETE FROM teachers WHERE school_id = target_school_id;
    
    -- Level 2
    DELETE FROM notices WHERE school_id = target_school_id;
    DELETE FROM message_logs WHERE school_id = target_school_id;
    DELETE FROM billing_history WHERE school_id = target_school_id;
    DELETE FROM referrals WHERE school_id = target_school_id;
    
    -- Level 1 (Profiles - linked to Auth)
    DELETE FROM profiles WHERE school_id = target_school_id;

    -- 3. Finally delete the school
    DELETE FROM schools WHERE id = target_school_id;
    
    GET DIAGNOSTICS row_count = ROW_COUNT;

    -- 4. Verify
    IF row_count = 0 THEN
        RAISE EXCEPTION 'School not found or could not be deleted.';
    END IF;
END;
$$;
