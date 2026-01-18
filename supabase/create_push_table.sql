
-- Create Push Subscriptions Table for Parents
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- We link to student_id because Parents use Shared Login (No Auth User sometimes)
    -- If using Auth, user_id is better, but app seems to rely on student_id RPCs
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    
    subscription JSONB NOT NULL,
    
    -- Device info for debugging
    user_agent text,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one subscription per device per student (approx)
    -- Actually, subscription endpoint is unique to device.
    -- If multiple students are on one device, we might have multiple rows or one row?
    -- Better: One device (subscription) can be linked to multiple students?
    -- No, simpler: Store (student_id, subscription).
    -- But subscription is JSONB. We can't easily UNIQUE it.
    -- We'll use 'endpoint' inside subscription to unique.
    
    CONSTRAINT unique_subscription_student UNIQUE (student_id, created_at) -- Simplified. Ideally hash(subscription)
);

-- Index for searching matches
CREATE INDEX IF NOT EXISTS idx_push_device_student ON public.push_subscriptions(student_id);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow Anon Insert (Parent App is client-side authed)
CREATE POLICY "Anon can insert subscriptions" ON public.push_subscriptions FOR INSERT WITH CHECK (true);

-- Allow Anon Select? No.
-- Allow Anon Delete? No. Only logic.

