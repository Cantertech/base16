-- RPC to verify SMS transactions and credit school balance
CREATE OR REPLACE FUNCTION public.verify_sms_transaction(p_transaction_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_school_id UUID;
    v_quantity INTEGER;
    v_status TEXT;
BEGIN
    -- Check if transaction exists and is pending
    SELECT school_id, quantity, status INTO v_school_id, v_quantity, v_status
    FROM public.sms_transactions
    WHERE id = p_transaction_id;

    IF v_school_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Transaction not found');
    END IF;

    IF v_status = 'Verified' THEN
        RETURN json_build_object('success', false, 'message', 'Transaction already verified');
    END IF;

    -- Update transaction status
    UPDATE public.sms_transactions
    SET status = 'Verified',
        updated_at = NOW()
    WHERE id = p_transaction_id;

    -- Credit school's SMS balance
    UPDATE public.schools
    SET sms_balance = COALESCE(sms_balance, 0) + v_quantity
    WHERE id = v_school_id;

    RETURN json_build_object('success', true, 'message', 'Transaction verified and credits added successfully');
END;
$$;

-- Ensure super_admin can see everything in sms_transactions
DROP POLICY IF EXISTS "Super admins can view all sms transactions" ON public.sms_transactions;
CREATE POLICY "Super admins can view all sms transactions" ON public.sms_transactions
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    )
);

-- Ensure schools can view their own pending/verified transactions (already exists in some form usually, but let's be safe)
DROP POLICY IF EXISTS "Schools can view their own sms transactions" ON public.sms_transactions;
CREATE POLICY "Schools can view their own sms transactions" ON public.sms_transactions
FOR ALL TO authenticated
USING (
    school_id IN (
        SELECT school_id FROM public.profiles WHERE id = auth.uid()
    )
);
