-- Enable Offline Payment Verification Support

BEGIN;

-- 1. Add payment_config to schools table
-- This will store { "momo_number": "...", "bank_details": "...", "instructions": "..." }
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS payment_config JSONB DEFAULT '{}'::jsonb;

-- 2. Add status to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Completed';

-- Add check constraint for transaction status if it doesn't exist (using a safe approach)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_status_check') THEN
        ALTER TABLE public.transactions
        ADD CONSTRAINT transactions_status_check 
        CHECK (status IN ('Completed', 'Pending', 'Failed', 'Cancelled'));
    END IF;
END $$;

-- 3. Create RPC for Parents/Students to submit payment verification
CREATE OR REPLACE FUNCTION public.submit_payment_verification(
    p_student_id uuid,
    p_amount numeric,
    p_reference text,
    p_method text -- 'Mobile Money', 'Bank Transfer', etc.
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_school_id uuid;
    v_student_name text;
    v_class text;
BEGIN
    -- Get student details
    SELECT school_id, name, class INTO v_school_id, v_student_name, v_class
    FROM public.students 
    WHERE id = p_student_id;

    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Student not found';
    END IF;

    -- Insert Pending Transaction
    INSERT INTO public.transactions (
        school_id,
        student_id,
        amount,
        type,
        method,
        reference,
        status,
        date
    ) VALUES (
        v_school_id,
        p_student_id,
        p_amount,
        'Payment',
        p_method,
        p_reference,
        'Pending',
        CURRENT_DATE
    );

    -- Notify Admins
    INSERT INTO public.notices (
        school_id,
        title,
        message,
        priority,
        audience,
        date
    ) VALUES (
        v_school_id,
        'Payment Verification Request',
        'New payment of ' || p_amount || ' from ' || v_student_name || ' (' || v_class || '). Ref: ' || p_reference || '. Verify now.',
        'Urgent',
        'Admins Only',
        CURRENT_DATE
    );

    RETURN TRUE;
END;
$$;

-- 4. Grant Permissions
GRANT EXECUTE ON FUNCTION public.submit_payment_verification(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_verification(uuid, numeric, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_payment_verification(uuid, numeric, text, text) TO service_role;

-- 5. Ensure Parents can read school payment config
-- We might need a helper function to avoid exposing entire schools table to anon if RLS is strict
CREATE OR REPLACE FUNCTION public.get_school_payment_config(target_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (SELECT payment_config FROM public.schools WHERE id = target_school_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_school_payment_config(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_school_payment_config(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_school_payment_config(uuid) TO service_role;

COMMIT;
