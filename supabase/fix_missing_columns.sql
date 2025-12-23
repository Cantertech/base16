-- Add missing columns to schools table and update cache
DO $$
BEGIN
    -- Currency Column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'currency') THEN
        ALTER TABLE schools ADD COLUMN currency TEXT DEFAULT 'GHS';
    END IF;

    -- Subscription Plan Column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'subscription_plan') THEN
        ALTER TABLE schools ADD COLUMN subscription_plan TEXT DEFAULT 'Small School';
    END IF;

    -- Brand Color (Just in case)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'brand_color') THEN
        ALTER TABLE schools ADD COLUMN brand_color TEXT DEFAULT 'blue';
    END IF;
    
    -- Logo URL (Just in case)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'logo_url') THEN
        ALTER TABLE schools ADD COLUMN logo_url TEXT;
    END IF;

    -- Force schema cache reload (Supabase sometimes needs this)
    NOTIFY pgrst, 'reload schema';
END $$;
