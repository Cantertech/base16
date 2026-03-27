-- Add columns for report card flexibility
ALTER TABLE public.student_report_cards 
ADD COLUMN IF NOT EXISTS items_to_bring TEXT,
ADD COLUMN IF NOT EXISTS next_term_reopens TEXT,
ADD COLUMN IF NOT EXISTS extra_bill_items JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS extra_report_sections JSONB DEFAULT '[]';

-- Update the save function to handle these new fields
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
    p_other_fees DECIMAL DEFAULT NULL,
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
        items_to_bring = EXCLUDED.items_to_bring,
        next_term_reopens = EXCLUDED.next_term_reopens,
        extra_bill_items = EXCLUDED.extra_bill_items,
        extra_report_sections = EXCLUDED.extra_report_sections,
        updated_at = NOW();

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the bulk save function
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
            (report_item->>'position')::INTEGER,
            (report_item->>'total_students')::INTEGER,
            (report_item->>'attendance_present')::INTEGER,
            (report_item->>'attendance_total')::INTEGER,
            (report_item->>'next_class'),
            (report_item->>'pupil_bill')::DECIMAL,
            (report_item->>'conduct'),
            (report_item->>'interest'),
            (report_item->>'other_fees')::DECIMAL,
            (report_item->>'items_to_bring'),
            (report_item->>'next_term_reopens'),
            COALESCE(report_item->'extra_bill_items', '[]'::JSONB),
            COALESCE(report_item->'extra_report_sections', '[]'::JSONB),
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
            items_to_bring = EXCLUDED.items_to_bring,
            next_term_reopens = EXCLUDED.next_term_reopens,
            extra_bill_items = EXCLUDED.extra_bill_items,
            extra_report_sections = EXCLUDED.extra_report_sections,
            updated_at = NOW();
    END LOOP;
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
