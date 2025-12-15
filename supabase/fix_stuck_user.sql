-- Force delete a user by email (Run this in SQL Editor to clean up stuck users)
-- This is useful if you deleted a teacher from the dashboard but their Login Account got stuck.

DO $$
DECLARE
    target_email TEXT := 'silaskwarteng17@gmail.com'; -- <--- ENTER THE STUCK EMAIL HERE
    user_id UUID;
BEGIN
    -- Find the user ID
    SELECT id INTO user_id FROM auth.users WHERE email = target_email;
    
    IF user_id IS NOT NULL THEN
        -- Delete from all tables to ensure clean slate
        DELETE FROM public.teachers WHERE id = user_id;
        DELETE FROM public.profiles WHERE id = user_id;
        DELETE FROM auth.users WHERE id = user_id;
        RAISE NOTICE 'Successfully deleted user: %', target_email;
    ELSE
        RAISE NOTICE 'User % not found. Nothing to delete.', target_email;
    END IF;
END $$;
