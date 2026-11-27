-- ==============================================================================
-- Enforce Per-Term Subscriptions on cvikeikqhxxkwdupglpp.supabase.co
-- Run this once in Supabase Dashboard -> SQL Editor
-- ==============================================================================

ALTER TABLE public.school_subscriptions
    ADD COLUMN IF NOT EXISTS term TEXT,
    ADD COLUMN IF NOT EXISTS academic_year TEXT;

CREATE OR REPLACE FUNCTION public.admin_switch_academic_term(
    p_school_id UUID,
    p_new_term TEXT,
    p_new_year TEXT,
    p_copy_fee_structure BOOLEAN DEFAULT true,
    p_roll_over_arrears BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_term TEXT;
    v_old_year TEXT;
    v_fee_count INTEGER := 0;
BEGIN
    IF p_new_term NOT IN ('First Term', 'Second Term', 'Third Term') THEN
        RAISE EXCEPTION 'Invalid term name: %', p_new_term;
    END IF;

    -- 1. Fetch current active session
    SELECT current_term, academic_year INTO v_old_term, v_old_year
    FROM public.schools
    WHERE id = p_school_id;

    -- 2. Sync academic_terms table
    UPDATE public.academic_terms
    SET is_current = false
    WHERE school_id = p_school_id;

    INSERT INTO public.academic_terms (
        school_id, academic_year, term, is_current, is_locked
    )
    VALUES (
        p_school_id, p_new_year, p_new_term, true, false
    )
    ON CONFLICT (school_id, academic_year, term)
    DO UPDATE SET
        is_current = true,
        is_locked = false;

    -- 3. Update schools table main configuration
    UPDATE public.schools
    SET current_term = p_new_term,
        academic_year = p_new_year
    WHERE id = p_school_id;

    -- 4. Expire per-term module/plan subscriptions when moving to a new term or academic year
    IF v_old_term IS DISTINCT FROM p_new_term OR v_old_year IS DISTINCT FROM p_new_year THEN
        UPDATE public.school_subscriptions
        SET status = 'expired',
            plan_type = 'modular',
            unlocked_modules = ARRAY[]::TEXT[],
            term = p_new_term,
            academic_year = p_new_year,
            updated_at = NOW()
        WHERE school_id = p_school_id;
    END IF;

    -- 5. Copy forward fee structure if requested and not yet existing for the new term
    IF p_copy_fee_structure AND v_old_term IS NOT NULL AND v_old_year IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.fee_structure
            WHERE school_id = p_school_id AND term = p_new_term AND academic_year = p_new_year
        ) THEN
            INSERT INTO public.fee_structure (
                school_id, name, amount, target_class, term, academic_year, is_mandatory
            )
            SELECT
                school_id, name, amount, target_class, p_new_term, p_new_year, is_mandatory
            FROM public.fee_structure
            WHERE school_id = p_school_id
              AND term = v_old_term
              AND academic_year = v_old_year;

            GET DIAGNOSTICS v_fee_count = ROW_COUNT;

            UPDATE public.students s
            SET balance = balance + COALESCE(
                (SELECT SUM(fs.amount)
                 FROM public.fee_structure fs
                 WHERE fs.school_id = p_school_id
                   AND fs.term = p_new_term
                   AND fs.academic_year = p_new_year
                   AND (fs.target_class IS NULL OR fs.target_class = s.class)
                   AND fs.is_mandatory = true),
                0
            )
            WHERE s.school_id = p_school_id AND s.status = 'Active';
        END IF;
    END IF;

    -- 6. If arrears are NOT rolled over, reset balances to only the new term fees
    IF NOT p_roll_over_arrears THEN
        UPDATE public.students s
        SET balance = COALESCE(
            (SELECT SUM(fs.amount)
             FROM public.fee_structure fs
             WHERE fs.school_id = p_school_id
               AND fs.term = p_new_term
               AND fs.academic_year = p_new_year
               AND (fs.target_class IS NULL OR fs.target_class = s.class)
               AND fs.is_mandatory = true),
            0
        )
        WHERE s.school_id = p_school_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'previous_session', jsonb_build_object('term', v_old_term, 'year', v_old_year),
        'active_session', jsonb_build_object('term', p_new_term, 'year', p_new_year),
        'fees_copied', v_fee_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_switch_academic_term(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN) TO authenticated;
