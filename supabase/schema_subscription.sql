-- Add Subscription Management Columns to Schools Table

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'subscription_plan') THEN
        ALTER TABLE schools ADD COLUMN subscription_plan TEXT DEFAULT 'Monthly';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'next_payment_due') THEN
        -- Default new columns to 30 days from now to prevent immediate lockout of existing users
        ALTER TABLE schools ADD COLUMN next_payment_due DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'last_payment_date') THEN
        ALTER TABLE schools ADD COLUMN last_payment_date DATE DEFAULT CURRENT_DATE;
    END IF;
END $$;
