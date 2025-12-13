-- 1. Classes Table
CREATE TABLE IF NOT EXISTS classes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    section TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist to avoid errors
DROP POLICY IF EXISTS "Users can view classes from their school" ON classes;
DROP POLICY IF EXISTS "Admins can manage classes" ON classes;

CREATE POLICY "Users can view classes from their school" ON classes
    FOR SELECT USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage classes" ON classes
    FOR ALL USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- 2. Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    type TEXT CHECK (type IN ('Core', 'Elective')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view subjects from their school" ON subjects;
DROP POLICY IF EXISTS "Admins can manage subjects" ON subjects;

CREATE POLICY "Users can view subjects from their school" ON subjects
    FOR SELECT USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage subjects" ON subjects
    FOR ALL USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- 3. Subject Assignments Table
CREATE TABLE IF NOT EXISTS subject_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE subject_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view assignments from their school" ON subject_assignments;
DROP POLICY IF EXISTS "Admins can manage assignments" ON subject_assignments;

CREATE POLICY "Users can view assignments from their school" ON subject_assignments
    FOR SELECT USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage assignments" ON subject_assignments
    FOR ALL USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- 4. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    type TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure new columns exist (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'method') THEN
        ALTER TABLE transactions ADD COLUMN method TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'reference') THEN
        ALTER TABLE transactions ADD COLUMN reference TEXT;
    END IF;
END $$;

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view transactions from their school" ON transactions;
DROP POLICY IF EXISTS "Admins can manage transactions" ON transactions;

CREATE POLICY "Users can view transactions from their school" ON transactions
    FOR SELECT USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage transactions" ON transactions
    FOR ALL USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));
