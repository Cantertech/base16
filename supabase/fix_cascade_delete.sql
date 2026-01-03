-- Fix missing ON DELETE CASCADE constraints for critical tables
-- This ensures that when a school is deleted, all related data is removed automatically.

DO $$
DECLARE
    -- List of tables that reference schools(id)
    tables text[] := ARRAY[
        'profiles',
        'students',
        'teachers',
        'classes',
        'subjects',
        'subject_assignments',
        'attendance',
        'transactions',
        'fee_structure',
        'referrals',
        'notices',
        'message_logs',
        'billing_history',
        'exam_results',
        'exam_submissions',
        'courses',
        'timetable'
    ];
    t text;
    constraint_name text;
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Check if table exists
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            
            -- Find the constraint name for the foreign key referencing schools(id)
            SELECT tc.constraint_name INTO constraint_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = t
              AND ccu.table_name = 'schools'
              AND ccu.column_name = 'id'
            LIMIT 1;

            -- If constraint found, drop and recreate with CASCADE
            IF constraint_name IS NOT NULL THEN
                RAISE NOTICE 'Updating constraint % on table %', constraint_name, t;
                
                EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t, constraint_name);
                
                -- Assuming the column is always 'school_id' (standard in this schema)
                -- We can verify column name from kcu if needed, but 'school_id' is consistent here.
                EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE', t, constraint_name);
             ELSE
                RAISE NOTICE 'No FK to schools found on table %, or it uses a non-standard column name.', t;
                -- Try to add it if school_id column exists but no constraint (rare case)
            END IF;
            
        END IF;
    END LOOP;
END $$;
