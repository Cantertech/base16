-- Add columns to schools table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'motto') THEN
        ALTER TABLE schools ADD COLUMN motto TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'theme_color') THEN
        ALTER TABLE schools ADD COLUMN theme_color TEXT DEFAULT 'blue';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'referral_code') THEN
        ALTER TABLE schools ADD COLUMN referral_code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'referral_preference') THEN
        ALTER TABLE schools ADD COLUMN referral_preference TEXT DEFAULT 'CASH' CHECK (referral_preference IN ('CASH', 'CREDIT'));
    END IF;
END $$;

-- Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  referrer_name TEXT NOT NULL,
  referee_school_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Paid', 'Completed')),
  reward_amount NUMERIC DEFAULT 0,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for referrals
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Policies for referrals
CREATE POLICY "Users can view referrals for their school" ON referrals
  FOR SELECT USING (auth.uid() IN (
    SELECT id FROM profiles WHERE school_id = referrals.school_id
  ));

CREATE POLICY "Admins can insert referrals" ON referrals
  FOR INSERT WITH CHECK (auth.uid() IN (
    SELECT id FROM profiles WHERE school_id = referrals.school_id AND role = 'admin'
  ));
