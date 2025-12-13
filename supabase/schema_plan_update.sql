-- Add subscription_plan to schools table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'subscription_plan') THEN
        ALTER TABLE schools ADD COLUMN subscription_plan TEXT DEFAULT 'Small School';
    END IF;
END $$;
