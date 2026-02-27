-- 1. System Modules (The Pricing Tiers)
CREATE TABLE IF NOT EXISTS public.system_modules (
    id text PRIMARY KEY,
    name text NOT NULL,
    description text,
    price_ghs numeric(10, 2) NOT NULL DEFAULT 0.00,
    created_at timestamptz DEFAULT now()
);

-- Insert the Pricing Tiers
INSERT INTO public.system_modules (id, name, price_ghs) VALUES 
('core_system', 'Core System', 0.00),
('revenue_guard', 'Revenue Guard', 60.00),
('academic_engine', 'Academic Engine', 40.00),
('daily_tracker', 'Daily Tracker', 30.00),
('prestige_pack', 'Prestige Pack', 20.00),
('complete_bundle', 'The Complete Bundle', 120.00)
ON CONFLICT (id) DO UPDATE 
SET price_ghs = EXCLUDED.price_ghs, name = EXCLUDED.name;

-- 2. School Wallets (Virtual Balances)
CREATE TABLE IF NOT EXISTS public.school_wallets (
    school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
    balance numeric(10, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Trigger to automatically update the wallet's updated_at timestamp
CREATE OR REPLACE FUNCTION update_wallet_timestamp() RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_update_wallet_timestamp ON public.school_wallets;
CREATE TRIGGER trg_update_wallet_timestamp
BEFORE UPDATE ON public.school_wallets
FOR EACH ROW EXECUTE PROCEDURE update_wallet_timestamp();

-- 3. Wallet Transactions (Ledger for Auditing)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id uuid NOT NULL REFERENCES public.school_wallets(school_id) ON DELETE CASCADE,
    amount numeric(10, 2) NOT NULL, -- Positive for topup (Paystack webhook), Negative for deduction
    type text NOT NULL CHECK (type IN ('topup', 'subscription_payment', 'refund')),
    reference text, -- Paystack Ref ID or Module ID
    description text,
    created_at timestamptz DEFAULT now()
);

-- 4. School Subscriptions (Independent module tracking)
CREATE TABLE IF NOT EXISTS public.school_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    module_id text NOT NULL REFERENCES public.system_modules(id) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'past_due')),
    expires_at timestamptz,
    auto_renew boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(school_id, module_id)
);

-- Row Level Security (RLS) configuration

ALTER TABLE public.system_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read system modules" ON public.system_modules FOR SELECT USING (true);

ALTER TABLE public.school_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their school wallet" ON public.school_wallets
FOR SELECT USING (
  school_id IN (
    SELECT school_id FROM public.profiles WHERE id = auth.uid()
  )
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their school transactions" ON public.wallet_transactions
FOR SELECT USING (
  school_id IN (
    SELECT school_id FROM public.profiles WHERE id = auth.uid()
  )
);

ALTER TABLE public.school_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their school subscriptions" ON public.school_subscriptions
FOR SELECT USING (
  school_id IN (
    SELECT school_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- RPC Function for Activation
CREATE OR REPLACE FUNCTION public.activate_module(
    p_school_id uuid,
    p_module_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Essential: Runs with DB Admin privileges to safely execute deductions
AS $$
DECLARE
    v_module_price numeric(10,2);
    v_wallet_balance numeric(10,2);
    v_new_balance numeric(10,2);
    v_expires_at timestamptz;
BEGIN
    -- 1. Fetch the module price
    SELECT price_ghs INTO v_module_price 
    FROM public.system_modules 
    WHERE id = p_module_id;

    IF v_module_price IS NULL THEN
        RAISE EXCEPTION 'Module % not found', p_module_id;
    END IF;

    -- 2. Handle 'Free Forever' tier
    IF v_module_price = 0 THEN
        INSERT INTO public.school_subscriptions (school_id, module_id, status, expires_at)
        VALUES (p_school_id, p_module_id, 'active', 'infinity')
        ON CONFLICT (school_id, module_id)
        DO UPDATE SET status = 'active', expires_at = 'infinity', updated_at = now();
        
        RETURN json_build_object('success', true, 'message', 'Free module activated successfully.');
    END IF;

    -- 3. Lock the wallet row to prevent race conditions during concurrent requests
    SELECT balance INTO v_wallet_balance 
    FROM public.school_wallets 
    WHERE school_id = p_school_id
    FOR UPDATE;

    IF v_wallet_balance IS NULL THEN
        RAISE EXCEPTION 'Wallet not found for school %', p_school_id;
    END IF;

    -- 4. Reject if funds are insufficient
    IF v_wallet_balance < v_module_price THEN
        RETURN json_build_object('success', false, 'message', 'Insufficient wallet balance.');
    END IF;

    -- 5. Deduct balance from Wallet
    UPDATE public.school_wallets 
    SET balance = balance - v_module_price
    WHERE school_id = p_school_id
    RETURNING balance INTO v_new_balance;

    -- 6. Record transaction in ledger
    INSERT INTO public.wallet_transactions (school_id, amount, type, reference, description)
    VALUES (p_school_id, -v_module_price, 'subscription_payment', p_module_id, 'Activation of ' || p_module_id);

    -- 7. Upsert the Module Subscription (Add 30 Days)
    v_expires_at := now() + interval '30 days';

    INSERT INTO public.school_subscriptions (school_id, module_id, status, expires_at)
    VALUES (p_school_id, p_module_id, 'active', v_expires_at)
    ON CONFLICT (school_id, module_id)
    DO UPDATE SET 
        status = 'active', 
        -- If user is renewing early, safely append 30 days onto their existing expiry time
        expires_at = CASE 
            WHEN school_subscriptions.status = 'active' AND school_subscriptions.expires_at > now() 
            THEN school_subscriptions.expires_at + interval '30 days'
            ELSE EXCLUDED.expires_at 
        END,
        updated_at = now()
    RETURNING expires_at INTO v_expires_at;

    -- Return JSON success details
    RETURN json_build_object(
        'success', true, 
        'message', 'Module activated successfully.',
        'new_balance', v_new_balance,
        'expires_at', v_expires_at
    );
END;
$$;
