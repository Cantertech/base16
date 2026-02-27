-- SMS BILLING & CREDITS MODULE

-- 1. Add sms_balance column to schools table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'sms_balance') THEN
        ALTER TABLE schools ADD COLUMN sms_balance INTEGER DEFAULT 50; -- Start with 50 free
    END IF;
END $$;

-- 2. Create Transactions Table for SMS Purchases
CREATE TABLE IF NOT EXISTS public.sms_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    amount NUMERIC NOT NULL,
    rate NUMERIC DEFAULT 0.035,
    status TEXT DEFAULT 'Pending', -- 'Pending', 'Verified'
    payment_ref TEXT, -- Mobile Money Ref
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check CHECK (type IN ('topup', 'subscription_payment', 'refund', 'sms_purchase'));

-- 3. Function to Purchase (Create Invoice Request)
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

    -- Deduct from wallet
    UPDATE public.school_wallets 
    SET balance = balance - p_amount 
    WHERE school_id = p_school_id;

    -- Log into wallet transactions
    INSERT INTO public.wallet_transactions (school_id, amount, type, reference, description)
    VALUES (p_school_id, -p_amount, 'sms_purchase', 'SMS', 'Purchased ' || p_quantity || ' SMS credits');

    -- Credit the schools SMS balance
    UPDATE public.schools 
    SET sms_balance = COALESCE(sms_balance, 0) + p_quantity 
    WHERE id = p_school_id;

    -- Insert SMS receipt transaction as Verified
    INSERT INTO public.sms_transactions (school_id, quantity, amount, status)
    VALUES (p_school_id, p_quantity, p_amount, 'Verified')
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to Verify Transaction (Admin Use or Mock for now)
-- You (Super Admin) will manually run a query to update this status and balance.
-- Example: 
-- UPDATE sms_transactions SET status = 'Verified' WHERE id = '...';
-- UPDATE schools SET sms_balance = sms_balance + [qty] WHERE id = '...';

-- 5. Helper Check Balance View? 
-- Not needed, frontend queries schools table.

GRANT ALL ON public.sms_transactions TO authenticated;
GRANT EXECUTE ON FUNCTION request_sms_purchase TO authenticated;


-- 6. Deduct Credits (Called after successful send)
CREATE OR REPLACE FUNCTION deduct_sms_credits(p_school_id UUID, p_count INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE schools SET sms_balance = sms_balance - p_count WHERE id = p_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION deduct_sms_credits TO authenticated;
0243952102