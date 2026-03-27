-- Final Fix for Student Report Cards Schema - VERSION 2
-- This ensures all columns exist and functions are correctly updated without overloading errors

-- 1. Ensure all columns exist in student_report_cards
ALTER TABLE public.student_report_cards 
ADD COLUMN IF NOT EXISTS conduct TEXT,
ADD COLUMN IF NOT EXISTS interest TEXT,
ADD COLUMN IF NOT EXISTS attendance_present INTEGER,
ADD COLUMN IF NOT EXISTS attendance_total INTEGER,
ADD COLUMN IF NOT EXISTS next_class TEXT,
ADD COLUMN IF NOT EXISTS pupil_bill NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_fees NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS items_to_bring TEXT,
ADD COLUMN IF NOT EXISTS next_term_reopens TEXT,
ADD COLUMN IF NOT EXISTS extra_bill_items JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS extra_report_sections JSONB DEFAULT '[]';

-- 2. Drop old versions to prevent "function not unique" errors during grants
-- Old 10-parameter version
DROP FUNCTION IF EXISTS public.save_student_report(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER);
-- Previous 21-parameter version (with DECIMAL/NUMERIC variations)
DROP FUNCTION IF EXISTS public.save_student_report(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, DECIMAL, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.save_student_report(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, NUMERIC, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, JSONB);

-- 3. Create single save function (Latest Version)
CREATE OR REPLACE FUNCTION public.save_student_report(
    p_school_id UUID,
    p_student_id UUID,
    p_class TEXT,
    p_term TEXT,
    p_year TEXT,
    p_teacher_remark TEXT,
    p_principal_remark TEXT DEFAULT NULL,
    p_promotion_status TEXT DEFAULT NULL,
    p_position INTEGER DEFAULT 0,
    p_total_students INTEGER DEFAULT 0,
    p_attendance_present INTEGER DEFAULT NULL,
    p_attendance_total INTEGER DEFAULT NULL,
    p_next_class TEXT DEFAULT NULL,
    p_pupil_bill NUMERIC DEFAULT NULL,
    p_conduct TEXT DEFAULT NULL,
    p_interest TEXT DEFAULT NULL,
    p_other_fees NUMERIC DEFAULT NULL,
    p_items_to_bring TEXT DEFAULT NULL,
    p_next_term_reopens TEXT DEFAULT NULL,
    p_extra_bill_items JSONB DEFAULT '[]',
    p_extra_report_sections JSONB DEFAULT '[]'
)
RETURNS JSONB AS $$
BEGIN
    INSERT INTO public.student_report_cards (
        school_id, student_id, class, term, academic_year,
        teacher_remark, principal_remark, promotion_status, 
        position_in_class, total_students, 
        attendance_present, attendance_total, next_class,
        pupil_bill, other_fees, conduct, interest,
        items_to_bring, next_term_reopens, extra_bill_items,
        extra_report_sections,
        updated_at
    )
    VALUES (
        p_school_id, p_student_id, p_class, p_term, p_year,
        p_teacher_remark, p_principal_remark, p_promotion_status,
        p_position, p_total_students,
        p_attendance_present, p_attendance_total, p_next_class,
        p_pupil_bill, p_other_fees, p_conduct, p_interest,
        p_items_to_bring, p_next_term_reopens, p_extra_bill_items,
        p_extra_report_sections,
        NOW()
    )
    ON CONFLICT (school_id, student_id, term, academic_year)
    DO UPDATE SET 
        teacher_remark = COALESCE(EXCLUDED.teacher_remark, student_report_cards.teacher_remark),
        principal_remark = COALESCE(EXCLUDED.principal_remark, student_report_cards.principal_remark),
        promotion_status = COALESCE(EXCLUDED.promotion_status, student_report_cards.promotion_status),
        position_in_class = COALESCE(EXCLUDED.position_in_class, student_report_cards.position_in_class),
        total_students = COALESCE(EXCLUDED.total_students, student_report_cards.total_students),
        attendance_present = COALESCE(EXCLUDED.attendance_present, student_report_cards.attendance_present),
        attendance_total = COALESCE(EXCLUDED.attendance_total, student_report_cards.attendance_total),
        next_class = COALESCE(EXCLUDED.next_class, student_report_cards.next_class),
        pupil_bill = COALESCE(EXCLUDED.pupil_bill, student_report_cards.pupil_bill),
        other_fees = COALESCE(EXCLUDED.other_fees, student_report_cards.other_fees),
        conduct = COALESCE(EXCLUDED.conduct, student_report_cards.conduct),
        interest = COALESCE(EXCLUDED.interest, student_report_cards.interest),
        items_to_bring = COALESCE(EXCLUDED.items_to_bring, student_report_cards.items_to_bring),
        next_term_reopens = COALESCE(EXCLUDED.next_term_reopens, student_report_cards.next_term_reopens),
        extra_bill_items = COALESCE(EXCLUDED.extra_bill_items, student_report_cards.extra_bill_items),
        extra_report_sections = COALESCE(EXCLUDED.extra_report_sections, student_report_cards.extra_report_sections),
        updated_at = NOW();

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update bulk save function (signature is JSONB)
CREATE OR REPLACE FUNCTION public.save_student_reports_bulk(p_reports JSONB)
RETURNS JSONB AS $$
DECLARE
    report_item JSONB;
BEGIN
    FOR report_item IN SELECT * FROM jsonb_array_elements(p_reports)
    LOOP
        INSERT INTO public.student_report_cards (
            school_id, student_id, class, term, academic_year,
            teacher_remark, principal_remark, promotion_status, 
            position_in_class, total_students, 
            attendance_present, attendance_total, next_class,
            pupil_bill, other_fees, conduct, interest,
            items_to_bring, next_term_reopens, extra_bill_items,
            extra_report_sections,
            updated_at
        )
        VALUES (
            (report_item->>'school_id')::UUID,
            (report_item->>'student_id')::UUID,
            (report_item->>'class'),
            (report_item->>'term'),
            (report_item->>'academic_year'),
            (report_item->>'teacher_remark'),
            (report_item->>'principal_remark'),
            (report_item->>'promotion_status'),
            COALESCE((report_item->>'position'), '0')::INTEGER,
            COALESCE((report_item->>'total_students'), '0')::INTEGER,
            (report_item->>'attendance_present')::INTEGER,
            (report_item->>'attendance_total')::INTEGER,
            (report_item->>'next_class'),
            (report_item->>'pupil_bill')::NUMERIC,
            (report_item->>'other_fees')::NUMERIC,
            (report_item->>'conduct'),
            (report_item->>'interest'),
            (report_item->>'items_to_bring'),
            (report_item->>'next_term_reopens'),
            COALESCE(report_item->'extra_bill_items', '[]'::JSONB),
            COALESCE(report_item->'extra_report_sections', '[]'::JSONB),
            NOW()
        )
        ON CONFLICT (school_id, student_id, term, academic_year)
        DO UPDATE SET 
            teacher_remark = COALESCE(EXCLUDED.teacher_remark, student_report_cards.teacher_remark),
            principal_remark = COALESCE(EXCLUDED.principal_remark, student_report_cards.principal_remark),
            promotion_status = COALESCE(EXCLUDED.promotion_status, student_report_cards.promotion_status),
            position_in_class = COALESCE(EXCLUDED.position_in_class, student_report_cards.position_in_class),
            total_students = COALESCE(EXCLUDED.total_students, student_report_cards.total_students),
            attendance_present = COALESCE(EXCLUDED.attendance_present, student_report_cards.attendance_present),
            attendance_total = COALESCE(EXCLUDED.attendance_total, student_report_cards.attendance_total),
            next_class = COALESCE(EXCLUDED.next_class, student_report_cards.next_class),
            pupil_bill = COALESCE(EXCLUDED.pupil_bill, student_report_cards.pupil_bill),
            other_fees = COALESCE(EXCLUDED.other_fees, student_report_cards.other_fees),
            conduct = COALESCE(EXCLUDED.conduct, student_report_cards.conduct),
            interest = COALESCE(EXCLUDED.interest, student_report_cards.interest),
            items_to_bring = COALESCE(EXCLUDED.items_to_bring, student_report_cards.items_to_bring),
            next_term_reopens = COALESCE(EXCLUDED.next_term_reopens, student_report_cards.next_term_reopens),
            extra_bill_items = COALESCE(EXCLUDED.extra_bill_items, student_report_cards.extra_bill_items),
            extra_report_sections = COALESCE(EXCLUDED.extra_report_sections, student_report_cards.extra_report_sections),
            updated_at = NOW();
    END LOOP;
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grant Permissions (Specifying arguments to avoid "not unique" error)
GRANT EXECUTE ON FUNCTION public.save_student_report(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, NUMERIC, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_student_reports_bulk(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_student_report(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, NUMERIC, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_student_reports_bulk(JSONB) TO service_role;

NOTIFY pgrst, 'reload schema';

