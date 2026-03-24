-- SMS BILLING & CREDITS MODULE
-- Updated to support Manual Approval Flow

-- 1. Ensure sms_balance exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'sms_balance') THEN
        ALTER TABLE schools ADD COLUMN sms_balance INTEGER DEFAULT 50; 
    END IF;
END $$;

-- 2. SMS Transactions Table (Ensure status defaults to Pending)
CREATE TABLE IF NOT EXISTS public.sms_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    amount NUMERIC NOT NULL,
    rate NUMERIC DEFAULT 0.035,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Verified', 'Rejected')),
    payment_ref TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Update request_sms_purchase to set status to PENDING and reserve funds
CREATE OR REPLACE FUNCTION request_sms_purchase(
    p_school_id UUID,
    p_quantity INTEGER,
    p_amount NUMERIC
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_wallet_balance NUMERIC;
BEGIN
    -- Check Wallet Balance
    SELECT balance INTO v_wallet_balance 
    FROM public.school_wallets 
    WHERE school_id = p_school_id 
    FOR UPDATE;

    IF v_wallet_balance IS NULL OR v_wallet_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient wallet balance for SMS purchase.';
    END IF;

    -- Deduct from wallet upfront to "reserve" funds for the request
    UPDATE public.school_wallets 
    SET balance = balance - p_amount 
    WHERE school_id = p_school_id;

    -- Log into wallet transactions as 'Pending SMS Approval'
    INSERT INTO public.wallet_transactions (school_id, amount, type, reference, description)
    VALUES (p_school_id, -p_amount, 'sms_purchase', 'SMS (REQ)', 'SMS Request (' || p_quantity || ' credits). Pending Admin Approval.');

    -- Insert into SMS Transactions as PENDING
    -- NOTICE: We do NOT increment schools.sms_balance here anymore.
    INSERT INTO public.sms_transactions (school_id, quantity, amount, status)
    VALUES (p_school_id, p_quantity, p_amount, 'Pending')
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to Verify Transaction (Admin Use)
CREATE OR REPLACE FUNCTION verify_sms_transaction(p_transaction_id UUID)
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

    -- Credit school's SMS balance NOW
    UPDATE public.schools
    SET sms_balance = COALESCE(sms_balance, 0) + v_quantity
    WHERE id = v_school_id;

    -- (Optional) Update the description in wallet transactions to 'Verified'
    UPDATE public.wallet_transactions 
    SET description = 'SMS Purchase Verified and Credits Assigned'
    WHERE school_id = v_school_id AND reference = 'SMS (REQ)' 
    AND created_at >= (NOW() - INTERVAL '1 hour'); -- Find the recent one

    RETURN json_build_object('success', true, 'message', 'Credits verified and added!');
END;
$$;

GRANT ALL ON public.sms_transactions TO authenticated;
GRANT EXECUTE ON FUNCTION request_sms_purchase TO authenticated;
GRANT EXECUTE ON FUNCTION verify_sms_transaction TO authenticated;

-- 5. Deduct Credits (Called after successful send)
CREATE OR REPLACE FUNCTION deduct_sms_credits(p_school_id UUID, p_count INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE schools SET sms_balance = sms_balance - p_count WHERE id = p_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION deduct_sms_credits TO authenticated;