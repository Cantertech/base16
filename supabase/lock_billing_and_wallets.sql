-- ==============================================================================
-- Revenue & Wallet Protection for cvikeikqhxxkwdupglpp.supabase.co
-- Run this once in Supabase Dashboard -> SQL Editor
-- Prevents school admins from tampering with wallet_balance, sms_balance, or
-- subscription_plan directly from the browser REST API.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.protect_school_billing_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_super_admin BOOLEAN := false;
BEGIN
    -- Allow service_role and SECURITY DEFINER RPCs (current_user is postgres/service_role, not 'authenticated')
    IF current_user = 'authenticated' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        ) INTO v_is_super_admin;

        IF NOT COALESCE(v_is_super_admin, false) THEN
            IF NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance
               OR NEW.sms_balance IS DISTINCT FROM OLD.sms_balance
               OR NEW.subscription_plan IS DISTINCT FROM OLD.subscription_plan
               OR NEW.next_payment_due IS DISTINCT FROM OLD.next_payment_due THEN
                RAISE EXCEPTION 'Direct modification of billing or balance fields is not permitted.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_school_billing_columns ON public.schools;

CREATE TRIGGER trg_protect_school_billing_columns
BEFORE UPDATE ON public.schools
FOR EACH ROW
EXECUTE FUNCTION public.protect_school_billing_columns();

-- Restrict school_subscriptions direct writes from authenticated clients
ALTER TABLE public.school_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Schools can insert own subscriptions" ON public.school_subscriptions;
DROP POLICY IF EXISTS "Schools can update own subscriptions" ON public.school_subscriptions;
DROP POLICY IF EXISTS "Schools can manage own subscriptions" ON public.school_subscriptions;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'school_subscriptions' AND policyname = 'Schools can view own subscriptions'
    ) THEN
        CREATE POLICY "Schools can view own subscriptions"
        ON public.school_subscriptions
        FOR SELECT
        TO authenticated
        USING (
            school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
        );
    END IF;
END $$;
