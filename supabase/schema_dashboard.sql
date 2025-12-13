-- 1. Create Classes Table
CREATE TABLE IF NOT EXISTS classes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    section TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view classes from their school" ON classes
    FOR SELECT USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage classes" ON classes
    FOR ALL USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- 2. Create Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    type TEXT CHECK (type IN ('Core', 'Elective')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view subjects from their school" ON subjects
    FOR SELECT USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage subjects" ON subjects
    FOR ALL USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- 3. Create Subject Assignments Table (Linking Subjects to Classes)
CREATE TABLE IF NOT EXISTS subject_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE subject_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assignments from their school" ON subject_assignments
    FOR SELECT USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage assignments" ON subject_assignments
    FOR ALL USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- 4. Create Transactions Table (Student Fees)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    type TEXT NOT NULL, -- e.g., 'Tuition', 'Exam Fee', 'Uniform'
    method TEXT, -- e.g., 'Cash', 'MoMo', 'Bank Deposit'
    reference TEXT, -- e.g., Receipt Number
    date DATE DEFAULT CURRENT_DATE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transactions from their school" ON transactions
    FOR SELECT USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage transactions" ON transactions
    FOR ALL USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));
