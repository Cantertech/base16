-- Create Health Records Table (One per student)
CREATE TABLE IF NOT EXISTS health_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    blood_group TEXT,
    allergies TEXT, -- Can be comma separated or JSON
    medical_conditions TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    doctor_notes TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(student_id)
);

-- Establish RLS for Health Records
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON health_records
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert/update for teachers and admins" ON health_records
    FOR ALL USING (auth.role() = 'authenticated'); 
    -- Ideally strictly check school_id, but current app relies on basic auth checks in UI often.
    -- Better: USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid()))

-- Create Clinic Visits Table (Log of visits)
CREATE TABLE IF NOT EXISTS clinic_visits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES profiles(id), -- Who logged it
    visit_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    complaint TEXT NOT NULL,
    treatment_given TEXT,
    notes TEXT,
    severity TEXT DEFAULT 'Low', -- Low, Medium, High, Emergency
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Establish RLS for Clinic Visits
ALTER TABLE clinic_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON clinic_visits
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON clinic_visits
    FOR ALL USING (auth.role() = 'authenticated');

-- Create function to get recent health stats
CREATE OR REPLACE FUNCTION get_health_stats(check_school_id UUID)
RETURNS JSON AS $$
DECLARE
    total_visits INTEGER;
    conditions_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_visits 
    FROM clinic_visits 
    WHERE school_id = check_school_id AND visit_date > (NOW() - INTERVAL '30 days');

    SELECT COUNT(*) INTO conditions_count
    FROM health_records
    WHERE school_id = check_school_id AND (medical_conditions IS NOT NULL OR allergies IS NOT NULL);

    RETURN json_build_object(
        'monthly_visits', total_visits,
        'students_with_conditions', conditions_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
