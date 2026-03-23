-- Add other_fees column if not exists
ALTER TABLE public.student_report_cards 
ADD COLUMN IF NOT EXISTS other_fees DECIMAL(10,2);

-- Drop existing functions to avoid "not unique" errors during signature changes
-- We drop by specific signatures to clean up overloads
DROP FUNCTION IF EXISTS public.save_student_report(uuid,uuid,text,text,text,text,text,text,integer,integer);
DROP FUNCTION IF EXISTS public.save_student_report(uuid,uuid,text,text,text,text,text,text,integer,integer,integer,integer,text,numeric,text,text);
DROP FUNCTION IF EXISTS public.save_student_report(uuid,uuid,text,text,text,text,text,text,integer,integer,integer,integer,text,numeric,text,text,numeric);

-- Create the NEW unified function with all fields including other_fees
CREATE OR REPLACE FUNCTION public.save_student_report(
    p_school_id UUID,
    p_student_id UUID,
    p_class TEXT,
    p_term TEXT,
    p_year TEXT,
    p_teacher_remark TEXT,
    p_principal_remark TEXT,
    p_promotion_status TEXT,
    p_position INTEGER,
    p_total_students INTEGER,
    p_attendance_present INTEGER DEFAULT NULL,
    p_attendance_total INTEGER DEFAULT NULL,
    p_next_class TEXT DEFAULT NULL,
    p_pupil_bill DECIMAL DEFAULT NULL,
    p_conduct TEXT DEFAULT NULL,
    p_interest TEXT DEFAULT NULL,
    p_other_fees DECIMAL DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
    INSERT INTO public.student_report_cards (
        school_id, student_id, class, term, academic_year,
        teacher_remark, principal_remark, promotion_status, 
        position_in_class, total_students, 
        attendance_present, attendance_total, next_class,
        pupil_bill, other_fees, conduct, interest,
        updated_at
    )
    VALUES (
        p_school_id, p_student_id, p_class, p_term, p_year,
        p_teacher_remark, p_principal_remark, p_promotion_status,
        p_position, p_total_students,
        p_attendance_present, p_attendance_total, p_next_class,
        p_pupil_bill, p_other_fees, p_conduct, p_interest,
        NOW()
    )
    ON CONFLICT (school_id, student_id, term, academic_year)
    DO UPDATE SET 
        teacher_remark = EXCLUDED.teacher_remark,
        principal_remark = EXCLUDED.principal_remark,
        promotion_status = EXCLUDED.promotion_status,
        position_in_class = EXCLUDED.position_in_class,
        total_students = EXCLUDED.total_students,
        attendance_present = EXCLUDED.attendance_present,
        attendance_total = EXCLUDED.attendance_total,
        next_class = EXCLUDED.next_class,
        pupil_bill = EXCLUDED.pupil_bill,
        other_fees = EXCLUDED.other_fees,
        conduct = EXCLUDED.conduct,
        interest = EXCLUDED.interest,
        updated_at = NOW();

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.save_student_report TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_student_report TO service_role;
