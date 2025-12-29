-- Add feeding credit column to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS feeding_credit DECIMAL(10,2) DEFAULT 0.00;

-- Create feeding logs table
CREATE TABLE IF NOT EXISTS feeding_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    school_id UUID REFERENCES schools(id),
    student_id UUID REFERENCES students(id),
    date DATE NOT NULL,
    status TEXT DEFAULT 'PAID', -- 'PAID'
    amount DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, date)
);

-- Enable RLS
ALTER TABLE feeding_logs ENABLE ROW LEVEL SECURITY;

-- Policies for feeding_logs
CREATE POLICY "Enable all access for authenticated users" ON feeding_logs
    FOR ALL USING (auth.role() = 'authenticated');
