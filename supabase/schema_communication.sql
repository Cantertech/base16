-- Create notices table
CREATE TABLE IF NOT EXISTS notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('All Staff', 'Teaching Staff', 'Admins Only')),
  priority TEXT NOT NULL CHECK (priority IN ('Normal', 'Urgent')),
  date DATE DEFAULT CURRENT_DATE,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create message_logs table
CREATE TABLE IF NOT EXISTS message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Delivered', 'Failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add sms_balance to schools table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'sms_balance') THEN
        ALTER TABLE schools ADD COLUMN sms_balance INTEGER DEFAULT 0;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;

-- Policies for notices
CREATE POLICY "Users can view notices from their school" ON notices
  FOR SELECT USING (auth.uid() IN (
    SELECT id FROM profiles WHERE school_id = notices.school_id
  ));

CREATE POLICY "Admins can insert notices" ON notices
  FOR INSERT WITH CHECK (auth.uid() IN (
    SELECT id FROM profiles WHERE school_id = notices.school_id AND role = 'admin'
  ));

CREATE POLICY "Admins can delete notices" ON notices
  FOR DELETE USING (auth.uid() IN (
    SELECT id FROM profiles WHERE school_id = notices.school_id AND role = 'admin'
  ));

-- Policies for message_logs
CREATE POLICY "Users can view message logs from their school" ON message_logs
  FOR SELECT USING (auth.uid() IN (
    SELECT id FROM profiles WHERE school_id = message_logs.school_id
  ));

CREATE POLICY "Admins can insert message logs" ON message_logs
  FOR INSERT WITH CHECK (auth.uid() IN (
    SELECT id FROM profiles WHERE school_id = message_logs.school_id AND role = 'admin'
  ));
