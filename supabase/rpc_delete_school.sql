-- Create a secure RPC function to permanently delete a school
-- This bypasses RLS and handles all cleanup operations

CREATE OR REPLACE FUNCTION delete_school_permanently(target_school_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Verify that the user triggering this is a Super Admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only Super Admins can perform this action.';
    END IF;

    -- 2. Delete the school
    -- Because we already fixed the ON DELETE CASCADE constraints, this should automatically
    -- remove all related data (profiles, students, classes, etc.)
    DELETE FROM schools WHERE id = target_school_id;

    -- 3. Check if deletion happened
    IF NOT FOUND THEN
        RAISE EXCEPTION 'School not found or already deleted.';
    END IF;
END;
$$;
