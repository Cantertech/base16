-- Fix RLS policies for Schools table to allow Admin updates

-- 1. Ensure RLS is enabled
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- 2. Allow Admins to VIEW their own school
DROP POLICY IF EXISTS "Admins can view their own school" ON public.schools;
CREATE POLICY "Admins can view their own school" ON public.schools
    FOR SELECT USING (
        id IN (
            SELECT school_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- 3. Allow Admins to UPDATE their own school (Crucial for saving config)
DROP POLICY IF EXISTS "Admins can update their own school" ON public.schools;
CREATE POLICY "Admins can update their own school" ON public.schools
    FOR UPDATE USING (
        id IN (
            SELECT school_id FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 4. Ensure exam_config column exists (Idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'exam_config') THEN
        ALTER TABLE public.schools ADD COLUMN exam_config JSONB DEFAULT '{
            "current_term": "First Term",
            "academic_year": "2024/2025",
            "weights": { "class": 30, "exam": 70 },
            "grading": [
                { "grade": "A", "min": 80, "max": 100, "remark": "Excellent" },
                { "grade": "B", "min": 70, "max": 79, "remark": "Very Good" },
                { "grade": "C", "min": 60, "max": 69, "remark": "Good" },
                { "grade": "D", "min": 50, "max": 59, "remark": "Credit" },
                { "grade": "E", "min": 40, "max": 49, "remark": "Pass" },
                { "grade": "F", "min": 0, "max": 39, "remark": "Fail" }
            ]
        }'::jsonb;
    END IF;
END $$;
