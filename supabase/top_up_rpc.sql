CREATE OR REPLACE FUNCTION public.top_up_wallet(p_school_id uuid, p_amount numeric, p_reference text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Add to wallet
    UPDATE public.school_wallets
    SET balance = balance + p_amount, updated_at = NOW()
    WHERE school_id = p_school_id;

    -- If no wallet existed, create one
    IF NOT FOUND THEN
        INSERT INTO public.school_wallets (school_id, balance)
        VALUES (p_school_id, p_amount);
    END IF;

    -- Log transaction
    INSERT INTO public.wallet_transactions (school_id, amount, type, reference)
    VALUES (p_school_id, p_amount, 'topup', p_reference);

    RETURN true;
END;
$$;
