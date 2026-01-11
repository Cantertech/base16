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

-- 3. Function to Purchase (Create Invoice Request)
CREATE OR REPLACE FUNCTION request_sms_purchase(
    p_school_id UUID,
    p_quantity INTEGER,
    p_amount NUMERIC
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.sms_transactions (school_id, quantity, amount, status)
    VALUES (p_school_id, p_quantity, p_amount, 'Pending')
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