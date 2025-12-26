-- Ensure exam_results table exists and is robust
CREATE TABLE IF NOT EXISTS public.exam_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    class TEXT NOT NULL,
    subject TEXT NOT NULL,
    term TEXT NOT NULL DEFAULT 'First Term',
    academic_year TEXT NOT NULL DEFAULT '2024/2025',
    class_score NUMERIC DEFAULT 0,
    exam_score NUMERIC DEFAULT 0,
    total NUMERIC GENERATED ALWAYS AS (class_score + exam_score) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist (for existing tables)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exam_results' AND column_name = 'term') THEN
        ALTER TABLE public.exam_results ADD COLUMN term TEXT NOT NULL DEFAULT 'First Term';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exam_results' AND column_name = 'academic_year') THEN
        ALTER TABLE public.exam_results ADD COLUMN academic_year TEXT NOT NULL DEFAULT '2024/2025';
    END IF;
END $$;

-- Create a unique constraint to prevent duplicate entries for the same student/subject/class/term/year
-- This is critical for the UPSERT operation to work correctly and preserve history
ALTER TABLE public.exam_results 
DROP CONSTRAINT IF EXISTS exam_results_student_subject_class_key;

ALTER TABLE public.exam_results 
DROP CONSTRAINT IF EXISTS exam_results_student_subject_class_term_year_key;

ALTER TABLE public.exam_results
ADD CONSTRAINT exam_results_student_subject_class_term_year_key UNIQUE (student_id, class, subject, term, academic_year);

-- Enable RLS
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

-- Policies

-- 1. View Policies
DROP POLICY IF EXISTS "Users can view exam results from their school" ON public.exam_results;
CREATE POLICY "Users can view exam results from their school"
ON public.exam_results FOR SELECT
USING (
    school_id IN (
        SELECT school_id FROM public.profiles
        WHERE id = auth.uid()
    )
);

-- 2. Insert/Update Policies (Teachers & Admins)
DROP POLICY IF EXISTS "School staff can insert exam results" ON public.exam_results;
CREATE POLICY "School staff can insert exam results"
ON public.exam_results FOR INSERT
WITH CHECK (
    school_id IN (
        SELECT school_id FROM public.profiles
        WHERE id = auth.uid()
    )
);

DROP POLICY IF EXISTS "School staff can update exam results" ON public.exam_results;
CREATE POLICY "School staff can update exam results"
ON public.exam_results FOR UPDATE
USING (
    school_id IN (
        SELECT school_id FROM public.profiles
        WHERE id = auth.uid()
    )
);

-- Ensure schools table has exam_config column
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS exam_config JSONB DEFAULT '{}'::jsonb;

-- Grant permissions
GRANT ALL ON public.exam_results TO authenticated;
GRANT ALL ON public.exam_results TO service_role;
