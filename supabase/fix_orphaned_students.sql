-- Assign orphaned students to the first active school found.
-- WARNING: Only run this if you are sure all orphans belong to the first school.
-- Ideally, you should manually update them if you have multiple schools.

UPDATE public.students
SET school_id = (SELECT id FROM public.schools WHERE status = 'active' LIMIT 1)
WHERE school_id IS NULL;
