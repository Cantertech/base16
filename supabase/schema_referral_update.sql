-- Add referral_code_used to schools table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'referral_code_used') THEN
        ALTER TABLE schools ADD COLUMN referral_code_used TEXT;
    END IF;
END $$;

-- Function to process referral securely
CREATE OR REPLACE FUNCTION process_referral(
    p_referral_code TEXT,
    p_new_school_id UUID,
    p_new_school_name TEXT
) RETURNS VOID AS $$
DECLARE
    v_referrer_school_id UUID;
BEGIN
    -- Find the school that owns this code
    SELECT id INTO v_referrer_school_id
    FROM schools
    WHERE referral_code = p_referral_code
    LIMIT 1;

    -- If found, record the referral
    IF v_referrer_school_id IS NOT NULL THEN
        INSERT INTO referrals (school_id, referrer_name, referee_school_name, status, reward_amount)
        VALUES (v_referrer_school_id, p_new_school_name, p_new_school_name, 'Pending', 100);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if referral code exists
CREATE OR REPLACE FUNCTION check_referral_code(p_code TEXT) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM schools WHERE referral_code = p_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
