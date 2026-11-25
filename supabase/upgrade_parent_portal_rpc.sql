-- ==============================================================================
-- Upgrade Parent Portal RPC for base16-connect on cvikeikqhxxkwdupglpp
-- Run this once in Supabase Dashboard -> SQL Editor
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_parent_portal_student_data(
    p_identifier TEXT,
    p_pin TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_student RECORD;
    v_school RECORD;
    v_report RECORD;
    v_report_cards JSONB;
    v_results JSONB;
    v_transactions JSONB;
    v_released_terms JSONB;
    v_notices JSONB;
    v_fee_structure JSONB;
    v_att_present BIGINT := 0;
    v_att_total BIGINT := 0;
    v_ident TEXT := TRIM(COALESCE(p_identifier, ''));
BEGIN
    IF v_ident = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please enter a Student ID or Phone Number.');
    END IF;

    -- 1. Look up student by admission_no, UUID, or parent_phone
    SELECT * INTO v_student
    FROM public.students
    WHERE (
        UPPER(TRIM(COALESCE(admission_no, ''))) = UPPER(v_ident)
        OR id::text = v_ident
        OR REPLACE(TRIM(COALESCE(parent_phone, '')), ' ', '') = REPLACE(v_ident, ' ', '')
    )
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_student IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Student not found. Please check your Student ID or phone number.');
    END IF;

    -- Verify PIN strictly whenever the student has a PIN configured
    IF v_student.pin IS NOT NULL AND TRIM(v_student.pin) <> '' THEN
        IF p_pin IS NULL OR TRIM(p_pin) = '' OR TRIM(v_student.pin) <> TRIM(p_pin) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Incorrect or missing PIN. Please check with the school.');
        END IF;
    END IF;

    -- 2. Look up school details
    SELECT id, name, motto, logo_url, brand_color, current_term, academic_year, currency, payment_config
    INTO v_school
    FROM public.schools
    WHERE id = v_student.school_id;

    -- 3. Released terms for this student's class
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'term', ers.term,
        'status', ers.status,
        'class_name', ers.class_name,
        'released_at', ers.released_at
    )), '[]'::jsonb) INTO v_released_terms
    FROM public.exam_report_status ers
    WHERE ers.school_id = v_student.school_id
      AND UPPER(TRIM(ers.class_name)) = UPPER(TRIM(v_student.class))
      AND ers.status = 'Released';

    -- 4. Latest active report card + all report cards for this student
    SELECT * INTO v_report
    FROM public.student_report_cards
    WHERE student_id = v_student.id
      AND term = v_school.current_term
      AND academic_year = v_school.academic_year
    LIMIT 1;

    SELECT COALESCE(jsonb_agg(to_jsonb(rc)), '[]'::jsonb)
    INTO v_report_cards
    FROM public.student_report_cards rc
    WHERE rc.student_id = v_student.id;

    -- 5. Exam results (previous terms always visible; current term only when released for this class)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'subject', er.subject,
        'class_score', er.class_score,
        'exam_score', er.exam_score,
        'total', er.total,
        'class', er.class,
        'term', er.term,
        'academic_year', er.academic_year,
        'created_at', er.created_at,
        'competency_status', er.competency_status
    )), '[]'::jsonb) INTO v_results
    FROM public.exam_results er
    WHERE er.student_id = v_student.id
      AND (
          -- Previous academic years or previous terms in the school's history
          (
              COALESCE(TRIM(er.academic_year), '') <> COALESCE(TRIM(v_school.academic_year), '')
              OR UPPER(TRIM(COALESCE(er.term, ''))) <> UPPER(TRIM(COALESCE(v_school.current_term, '')))
          )
          OR EXISTS (
              SELECT 1 FROM public.exam_report_status ers
              WHERE ers.school_id = v_student.school_id
                AND UPPER(TRIM(ers.class_name)) = UPPER(TRIM(er.class))
                AND UPPER(TRIM(ers.term)) = UPPER(TRIM(er.term))
                AND ers.status = 'Released'
          )
      );

    -- 6. Recent payment transactions (include status, term, academic_year, channel, payer_name)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', t.id,
        'date', t.date,
        'amount', t.amount,
        'method', t.method,
        'reference', t.reference,
        'type', t.type,
        'status', COALESCE(t.status, 'Completed'),
        'term', t.term,
        'academic_year', t.academic_year,
        'channel', t.channel,
        'payer_name', t.payer_name
    )), '[]'::jsonb) INTO v_transactions
    FROM (
        SELECT id, date, amount, method, reference, type, status, term, academic_year, channel, payer_name
        FROM public.transactions
        WHERE student_id = v_student.id
        ORDER BY date DESC, created_at DESC
        LIMIT 50
    ) t;

    -- 7. School notices for Parents / Everyone
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', n.id,
        'title', n.title,
        'message', n.message,
        'priority', COALESCE(n.category, 'Normal'),
        'date', to_char(n.created_at, 'YYYY-MM-DD'),
        'audience', COALESCE(n.target_audience, 'All')
    )), '[]'::jsonb) INTO v_notices
    FROM (
        SELECT id, title, message, category, target_audience, created_at
        FROM public.app_notifications
        WHERE school_id = v_student.school_id
          AND (target_audience IN ('Parents', 'All', 'Everyone') OR target_audience IS NULL)
        ORDER BY created_at DESC
        LIMIT 15
    ) n;

    -- 8. Attendance summary
    SELECT
        COUNT(*) FILTER (WHERE status = 'Present'),
        COUNT(*)
    INTO v_att_present, v_att_total
    FROM public.attendance
    WHERE student_id = v_student.id;

    -- 9. Fee structure for student's class & current term
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', f.id,
        'name', f.name,
        'amount', f.amount,
        'target_class', f.target_class,
        'term', f.term,
        'academic_year', f.academic_year,
        'is_mandatory', COALESCE(f.is_mandatory, true)
    )), '[]'::jsonb) INTO v_fee_structure
    FROM public.fee_structure f
    WHERE f.school_id = v_student.school_id
      AND (f.target_class IS NULL OR UPPER(TRIM(f.target_class)) = UPPER(TRIM(v_student.class)) OR f.target_class = 'All Classes');

    RETURN jsonb_build_object(
        'success', true,
        'student', jsonb_build_object(
            'id', v_student.id,
            'school_id', v_student.school_id,
            'name', v_student.name,
            'class', v_student.class,
            'admission_no', v_student.admission_no,
            'balance', COALESCE(v_student.balance, 0),
            'parent_name', v_student.parent_name,
            'parent_phone', v_student.parent_phone,
            'photo_url', v_student.photo_url
        ),
        'school', jsonb_build_object(
            'id', v_school.id,
            'name', v_school.name,
            'motto', v_school.motto,
            'logo_url', v_school.logo_url,
            'current_term', v_school.current_term,
            'academic_year', v_school.academic_year,
            'currency', v_school.currency,
            'payment_config', v_school.payment_config
        ),
        'report_card', to_jsonb(v_report),
        'report_cards', v_report_cards,
        'exam_results', v_results,
        'released_terms', v_released_terms,
        'transactions', v_transactions,
        'notices', v_notices,
        'attendance', jsonb_build_object(
            'present', v_att_present,
            'total', v_att_total
        ),
        'fee_structure', v_fee_structure
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_parent_portal_student_data(TEXT, TEXT) TO anon, authenticated;
