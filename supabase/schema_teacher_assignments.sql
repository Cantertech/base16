-- Create teacher_assignments table
CREATE TABLE IF NOT EXISTS public.teacher_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL, -- Can be null if teaching ALL subjects
    is_class_teacher BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(teacher_id, class_id, subject_id)
);

-- RLS Policies
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage assignments" ON public.teacher_assignments
FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin' OR role = 'super_admin')
);

-- Teachers can view their own assignments
CREATE POLICY "Teachers can view own assignments" ON public.teacher_assignments
FOR SELECT USING (
  teacher_id = auth.uid()
);

-- Fix: ensure subjects table has RLS policy for reading
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read subjects" ON public.subjects FOR SELECT USING (true);
