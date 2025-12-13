-- Create fee_structure table if it doesn't exist
CREATE TABLE IF NOT EXISTS fee_structure (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    target_class TEXT, -- If NULL, applies to all classes. If set, applies only to that class.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for fee_structure
ALTER TABLE fee_structure ENABLE ROW LEVEL SECURITY;

-- Policies for fee_structure
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'fee_structure' AND policyname = 'Admins can manage fee structure'
    ) THEN
        CREATE POLICY "Admins can manage fee structure" ON fee_structure
            FOR ALL
            USING (auth.uid() IN (
                SELECT id FROM profiles 
                WHERE school_id = fee_structure.school_id AND role = 'admin'
            ));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'fee_structure' AND policyname = 'Everyone can view fee structure'
    ) THEN
        CREATE POLICY "Everyone can view fee structure" ON fee_structure
            FOR SELECT
            USING (auth.uid() IN (
                SELECT id FROM profiles 
                WHERE school_id = fee_structure.school_id
            ));
    END IF;
END
$$;

-- Add missing columns to transactions table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'method') THEN
        ALTER TABLE transactions ADD COLUMN method TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'reference') THEN
        ALTER TABLE transactions ADD COLUMN reference TEXT;
    END IF;
END
$$;
