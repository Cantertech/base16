-- Enhancement for Student Remarks and Conduct - VERSION 1
-- This adds missing columns and a bulk upsert function for teacher remarks

-- 1. Ensure columns exist in student_report_cards
ALTER TABLE public.student_report_cards 
ADD COLUMN IF NOT EXISTS conduct TEXT,
ADD COLUMN IF NOT EXISTS interest TEXT,
ADD COLUMN IF NOT EXISTS attendance_present INTEGER,
ADD COLUMN IF NOT EXISTS attendance_total INTEGER,
ADD COLUMN IF NOT EXISTS next_class TEXT,
ADD COLUMN IF NOT EXISTS pupil_bill NUMERIC,
ADD COLUMN IF NOT EXISTS other_fees NUMERIC;

-- 2. Create Bulk Upsert Function
CREATE OR REPLACE FUNCTION public.save_student_reports_bulk(p_reports JSONB)
RETURNS JSONB AS $$
DECLARE
    r JSONB;
BEGIN
    FOR r IN SELECT * FROM jsonb_array_elements(p_reports)
    LOOP
        INSERT INTO public.student_report_cards (
            school_id, student_id, class, term, academic_year,
            teacher_remark, principal_remark, conduct, interest,
            attendance_present, attendance_total, updated_at
        )
        VALUES (
            (r->>'school_id')::UUID,
            (r->>'student_id')::UUID,
            (r->>'class'),
            (r->>'term'),
            (r->>'academic_year'),
            (r->>'teacher_remark'),
            (r->>'principal_remark'),
            (r->>'conduct'),
            (r->>'interest'),
            (r->>'attendance_present')::INTEGER,
            (r->>'attendance_total')::INTEGER,
            NOW()
        )
        ON CONFLICT (school_id, student_id, term, academic_year)
        DO UPDATE SET 
            teacher_remark = COALESCE(EXCLUDED.teacher_remark, student_report_cards.teacher_remark),
            principal_remark = COALESCE(EXCLUDED.principal_remark, student_report_cards.principal_remark),
            conduct = COALESCE(EXCLUDED.conduct, student_report_cards.conduct),
            interest = COALESCE(EXCLUDED.interest, student_report_cards.interest),
            attendance_present = COALESCE(EXCLUDED.attendance_present, student_report_cards.attendance_present),
            attendance_total = COALESCE(EXCLUDED.attendance_total, student_report_cards.attendance_total),
            updated_at = NOW();
    END LOOP;

    RETURN jsonb_build_object('success', true, 'count', jsonb_array_length(p_reports));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.save_student_reports_bulk TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_student_reports_bulk TO service_role;
