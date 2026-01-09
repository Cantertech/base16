-- Table to store finalized report card details (Remarks, Promotion, Position)
CREATE TABLE IF NOT EXISTS public.student_report_cards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class TEXT NOT NULL,
    term TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    teacher_remark TEXT,
    principal_remark TEXT,
    promotion_status TEXT,
    position_in_class INTEGER,
    total_students INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, student_id, term, academic_year)
);

-- RLS
ALTER TABLE public.student_report_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access for authenticated users" ON public.student_report_cards;
CREATE POLICY "Access for authenticated users" 
ON public.student_report_cards FOR ALL 
USING (auth.role() = 'authenticated');


-- Function to Upsert Report Card Details
CREATE OR REPLACE FUNCTION save_student_report(
    p_school_id UUID,
    p_student_id UUID,
    p_class TEXT,
    p_term TEXT,
    p_year TEXT,
    p_teacher_remark TEXT,
    p_principal_remark TEXT,
    p_promotion_status TEXT,
    p_position INTEGER,
    p_total_students INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    INSERT INTO public.student_report_cards (
        school_id, student_id, class, term, academic_year,
        teacher_remark, principal_remark, promotion_status, 
        position_in_class, total_students, updated_at
    )
    VALUES (
        p_school_id, p_student_id, p_class, p_term, p_year,
        p_teacher_remark, p_principal_remark, p_promotion_status,
        p_position, p_total_students, NOW()
    )
    ON CONFLICT (school_id, student_id, term, academic_year)
    DO UPDATE SET 
        teacher_remark = EXCLUDED.teacher_remark,
        principal_remark = EXCLUDED.principal_remark,
        promotion_status = EXCLUDED.promotion_status,
        position_in_class = EXCLUDED.position_in_class,
        total_students = EXCLUDED.total_students,
        updated_at = NOW();

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION save_student_report TO authenticated;
NOTIFY pgrst, 'reload schema';
