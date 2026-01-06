-- Fix profiles role constraint to allow 'super_admin'
DO $$ BEGIN
    ALTER TABLE profiles 
    DROP CONSTRAINT IF EXISTS profiles_role_check;
    
    ALTER TABLE profiles 
    ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('admin', 'teacher', 'super_admin'));
    
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;
