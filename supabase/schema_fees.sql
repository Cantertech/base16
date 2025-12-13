-- Create fee_structure table
CREATE TABLE IF NOT EXISTS fee_structure (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    target_class TEXT, -- If NULL, applies to all classes. If set, applies only to that class.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE fee_structure ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage fee structure" ON fee_structure
    FOR ALL
    USING (auth.uid() IN (
        SELECT id FROM profiles 
        WHERE school_id = fee_structure.school_id AND role = 'admin'
    ));

CREATE POLICY "Everyone can view fee structure" ON fee_structure
    FOR SELECT
    USING (auth.uid() IN (
        SELECT id FROM profiles 
        WHERE school_id = fee_structure.school_id
    ));
