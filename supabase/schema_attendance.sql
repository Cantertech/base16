-- Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT CHECK (status IN ('Present', 'Absent', 'Late')),
    class TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(student_id, date)
);

-- Enable RLS
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view attendance for their school" ON attendance
    FOR SELECT USING (school_id IN (
        SELECT school_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert attendance for their school" ON attendance
    FOR INSERT WITH CHECK (school_id IN (
        SELECT school_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update attendance for their school" ON attendance
    FOR UPDATE USING (school_id IN (
        SELECT school_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete attendance for their school" ON attendance
    FOR DELETE USING (school_id IN (
        SELECT school_id FROM profiles WHERE id = auth.uid()
    ));
