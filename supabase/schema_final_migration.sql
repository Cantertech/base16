-- 1. Update Schools Table with new columns
DO $$
BEGIN
    -- General Config
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'motto') THEN
        ALTER TABLE schools ADD COLUMN motto TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'theme_color') THEN
        ALTER TABLE schools ADD COLUMN theme_color TEXT DEFAULT 'blue';
    END IF;
    
    -- Referral System
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'referral_code') THEN
        ALTER TABLE schools ADD COLUMN referral_code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'referral_preference') THEN
        ALTER TABLE schools ADD COLUMN referral_preference TEXT DEFAULT 'CASH' CHECK (referral_preference IN ('CASH', 'CREDIT'));
    END IF;

    -- Communication System
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'sms_balance') THEN
        ALTER TABLE schools ADD COLUMN sms_balance INTEGER DEFAULT 0;
    END IF;
END $$;

-- 2. Create Referrals Table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  referrer_name TEXT NOT NULL,
  referee_school_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Paid', 'Completed', 'Applied')),
  reward_amount NUMERIC DEFAULT 0,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view referrals for their school" ON referrals;
CREATE POLICY "Users can view referrals for their school" ON referrals
  FOR SELECT USING (auth.uid() IN (
    SELECT id FROM profiles WHERE school_id = referrals.school_id
  ));

DROP POLICY IF EXISTS "Admins can insert referrals" ON referrals;
CREATE POLICY "Admins can insert referrals" ON referrals
  FOR INSERT WITH CHECK (auth.uid() IN (
    SELECT id FROM profiles WHERE school_id = referrals.school_id AND role = 'admin'
  ));

-- 3. Create Notices Table
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

ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view notices from their school" ON notices;
CREATE POLICY "Users can view notices from their school" ON notices
  FOR SELECT USING (auth.uid() IN (
    SELECT id FROM profiles WHERE school_id = notices.school_id
  ));

DROP POLICY IF EXISTS "Admins can insert notices" ON notices;
CREATE POLICY "Admins can insert notices" ON notices
  FOR INSERT WITH CHECK (auth.uid() IN (
    SELECT id FROM profiles WHERE school_id = notices.school_id AND role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can delete notices" ON notices;
CREATE POLICY "Admins can delete notices" ON notices
  FOR DELETE USING (auth.uid() IN (
    SELECT id FROM profiles WHERE school_id = notices.school_id AND role = 'admin'
  ));

-- 4. Create Message Logs Table
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

ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view message logs from their school" ON message_logs;
CREATE POLICY "Users can view message logs from their school" ON message_logs
  FOR SELECT USING (auth.uid() IN (
    SELECT id FROM profiles WHERE school_id = message_logs.school_id
  ));

DROP POLICY IF EXISTS "Admins can insert message logs" ON message_logs;
CREATE POLICY "Admins can insert message logs" ON message_logs
  FOR INSERT WITH CHECK (auth.uid() IN (
    SELECT id FROM profiles WHERE school_id = message_logs.school_id AND role = 'admin'
  ));

-- 5. Create Billing History Table
CREATE TABLE IF NOT EXISTS public.billing_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Paid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view billing history for their school" ON public.billing_history;
CREATE POLICY "Users can view billing history for their school" ON public.billing_history
    FOR SELECT USING (school_id IN (
        SELECT school_id FROM public.profiles WHERE id = auth.uid()
    ));

DROP POLICY IF EXISTS "Admins can insert billing history for their school" ON public.billing_history;
CREATE POLICY "Admins can insert billing history for their school" ON public.billing_history
    FOR INSERT WITH CHECK (school_id IN (
        SELECT school_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ));
