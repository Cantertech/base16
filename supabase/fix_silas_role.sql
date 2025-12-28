-- Fix the role for the user 'silas' to ensure they are a super_admin
BEGIN;

-- Update profiles table
UPDATE public.profiles
SET role = 'super_admin'
WHERE email ILIKE '%silas%';

-- Also ensure RLS doesn't block them (though policies should be fine for super_admin)
-- Just in case, grant them admin rights too if needed, but role='super_admin' is key.

COMMIT;

-- Verify (Log output)
DO $$
BEGIN
    RAISE NOTICE 'Updated roles for users matching "silas" to super_admin';
END $$;
