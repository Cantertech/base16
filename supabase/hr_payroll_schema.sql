CREATE TABLE IF NOT EXISTS teacher_attendance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('Present', 'Absent', 'Late', 'On Leave', 'Half Day')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(school_id, teacher_id, date)
);

CREATE TABLE IF NOT EXISTS payroll_records (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    month VARCHAR(20) NOT NULL,
    base_salary NUMERIC(10,2) DEFAULT 0,
    days_absent INTEGER DEFAULT 0,
    absent_deduction NUMERIC(10,2) DEFAULT 0,
    bonus NUMERIC(10,2) DEFAULT 0,
    other_deductions NUMERIC(10,2) DEFAULT 0,
    net_salary NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Draft',
    payment_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(school_id, teacher_id, month)
);

ALTER TABLE teacher_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Enable read access for authenticated users on teacher_attendance" ON teacher_attendance;
    DROP POLICY IF EXISTS "Enable all access for authenticated users on teacher_attendance" ON teacher_attendance;
    DROP POLICY IF EXISTS "Enable read access for authenticated users on payroll_records" ON payroll_records;
    DROP POLICY IF EXISTS "Enable all access for authenticated users on payroll_records" ON payroll_records;
END $$;

CREATE POLICY "Enable read access for authenticated users on teacher_attendance" ON teacher_attendance FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users on teacher_attendance" ON teacher_attendance FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users on payroll_records" ON payroll_records FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users on payroll_records" ON payroll_records FOR ALL USING (auth.role() = 'authenticated');
