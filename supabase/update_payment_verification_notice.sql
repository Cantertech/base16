-- Update submit_payment_verification to insert a notice for admins
-- This function is called by the Parent App (FeesTab.tsx)
-- Updated to accept 'p_notes' for better context (e.g. "Feeding Fees")

CREATE OR REPLACE FUNCTION public.submit_payment_verification(
    p_student_id UUID,
    p_amount NUMERIC,
    p_reference TEXT,
    p_method TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_school_id UUID;
    v_student_name TEXT;
    v_class TEXT;
    v_description TEXT;
BEGIN
    -- 1. Get Student Details (including school_id)
    SELECT school_id, name, class INTO v_school_id, v_student_name, v_class
    FROM public.students
    WHERE id = p_student_id;

    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Student not found';
    END IF;

    -- Construct Description
    v_description := 'Fee Payment - Pending Verification';
    IF p_notes IS NOT NULL AND p_notes <> '' THEN
        v_description := v_description || ' (' || p_notes || ')';
    END IF;

    -- 2. Insert Transaction (Pending)
    INSERT INTO public.transactions (
        school_id,
        student_id,
        amount,
        type,
        method,
        reference,
        status,
        date,
        description
    ) VALUES (
        v_school_id,
        p_student_id,
        p_amount,
        'Fee Payment',
        p_method,
        p_reference,
        'Pending', -- Important: Mark as Pending
        CURRENT_DATE,
        v_description
    );

    -- 3. Insert Notice for Admin
    -- We include the notes in the message so Admin knows what it is for immediately (e.g. Feeding)
    INSERT INTO public.notices (
        school_id,
        title,
        message,
        priority,
        audience,
        date,
        author_id, -- Can be NULL as per schema
        created_at
    ) VALUES (
        v_school_id,
        'Payment Verification Request',
        'New payment of GH₵' || p_amount || ' from ' || COALESCE(v_student_name, 'Student') || ' (' || COALESCE(v_class, 'N/A') || '). Ref: ' || p_reference || '. ' || COALESCE(p_notes, '') || '. Verify now.',
        'Urgent',
        'Admins Only',
        CURRENT_DATE,
        NULL,
        NOW()
    );

END;
$$;
