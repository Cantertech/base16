-- ==============================================================================
-- FIX: DEDICATED SUBJECT-TO-CLASS ASSIGNMENTS TABLE
-- ==============================================================================
-- This fixes the issue where assigning classes to a subject fails when no teacher
-- has been assigned to the class yet. It decouples the curriculum (which class does
-- which subject) from staff allocation (which teacher teaches it).

-- 1. Drop the legacy view if it was previously created as a view over teacher_assignments
DROP VIEW IF EXISTS public.subject_assignments CASCADE;

-- 2. Create the standalone subject_assignments table
CREATE TABLE IF NOT EXISTS public.subject_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_subject_class UNIQUE (subject_id, class_id)
);

-- 3. Indexes for rapid lookups
CREATE INDEX IF NOT EXISTS idx_subject_assignments_lookup ON public.subject_assignments(school_id, subject_id, class_id);
CREATE INDEX IF NOT EXISTS idx_subject_assignments_class ON public.subject_assignments(class_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.subject_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Schools can manage subject assignments" ON public.subject_assignments;
CREATE POLICY "Schools can manage subject assignments" ON public.subject_assignments
    USING (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid()));

GRANT ALL ON public.subject_assignments TO authenticated, service_role, anon;

-- 5. Also make teacher_id optional in teacher_assignments so any unassigned class/subject record never crashes
ALTER TABLE public.teacher_assignments ALTER COLUMN teacher_id DROP NOT NULL;
