-- Enable Super Admin "God Mode" Access for all relevant tables
-- This allows a user with role 'super_admin' in the profiles table to VIEW, UPDATE, DELETE, and INSERT on all school data.

DO $$
DECLARE
    -- Verified list of existing tables
    tables text[] := ARRAY[
        'schools', 'profiles', 'students', 'teachers', 'classes', 'subjects', 
        'subject_assignments', 'exam_results', 'exam_submissions', 
        'fee_structure', 'transactions', 'attendance', 
        'notices', 'message_logs', 'billing_history', 'referrals'
    ];
    t text;
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Check if table exists before trying to modify it
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Drop existing policy if it exists to avoid conflicts
            BEGIN
                EXECUTE format('DROP POLICY IF EXISTS "Super Admin Access" ON public.%I', t);
            EXCEPTION WHEN OTHERS THEN
                NULL;
            END;

            -- Create the new policy
            EXECUTE format('
                CREATE POLICY "Super Admin Access" ON public.%I
                FOR ALL
                USING (
                    (SELECT role FROM public.profiles WHERE id = auth.uid()) = ''super_admin''
                )
                WITH CHECK (
                    (SELECT role FROM public.profiles WHERE id = auth.uid()) = ''super_admin''
                );
            ', t);
        END IF;
    END LOOP;
END $$;
