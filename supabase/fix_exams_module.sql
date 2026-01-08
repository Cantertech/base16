-- FIX EXAMS MODULE: Enable Persistence & Visualization

-- 1. Ensure exam_config table exists (Source of Truth for Toggle)
CREATE TABLE IF NOT EXISTS public.exam_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    mark_entry_enabled BOOLEAN DEFAULT true,
    current_term TEXT DEFAULT 'First Term',
    academic_year TEXT DEFAULT '2024/2025',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id)
);

-- 2. Toggle Function (Updates the config table)
DROP FUNCTION IF EXISTS toggle_mark_entry(uuid, boolean);

CREATE OR REPLACE FUNCTION toggle_mark_entry(target_school_id UUID, enable BOOLEAN)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.exam_config (school_id, mark_entry_enabled, updated_at)
    VALUES (target_school_id, enable, NOW())
    ON CONFLICT (school_id) 
    DO UPDATE SET mark_entry_enabled = enable, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant Permissions
GRANT ALL ON public.exam_config TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_mark_entry TO authenticated;

-- 4. Submission Overview Function
-- Shows which subjects have marks entered by teachers
DROP FUNCTION IF EXISTS get_exam_submission_overview(uuid);

CREATE OR REPLACE FUNCTION get_exam_submission_overview(target_school_id UUID)
RETURNS TABLE (
    class_name TEXT,
    subject_name TEXT,
    teacher_name TEXT,
    status TEXT,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.name::TEXT as class_name,
        s.name::TEXT as subject_name,
        COALESCE(p.name, 'Unassigned')::TEXT as teacher_name,
        CASE 
            WHEN COUNT(er.id) > 0 THEN 'Submitted'::TEXT
            ELSE 'Pending'::TEXT
        END as status,
        MAX(er.updated_at) as updated_at
    FROM teacher_assignments ta
    JOIN classes c ON ta.class_id = c.id
    JOIN subjects s ON ta.subject_id = s.id
    LEFT JOIN profiles p ON ta.teacher_id = p.id
    LEFT JOIN exam_results er ON 
        er.school_id = target_school_id AND 
        er.class = c.name AND 
        er.subject = s.name
    WHERE c.school_id = target_school_id
    GROUP BY c.name, s.name, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_exam_submission_overview TO authenticated;


