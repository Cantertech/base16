-- Create Demo Bookings Table
CREATE TABLE IF NOT EXISTS public.demo_bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name TEXT NOT NULL,
    school_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    role TEXT,
    email TEXT,
    message TEXT,
    status TEXT DEFAULT 'pending', -- pending, contacted, closed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.demo_bookings ENABLE ROW LEVEL SECURITY;

-- Allow anon to insert (since it's a public form)
DROP POLICY IF EXISTS "Allow anon insert booking" ON public.demo_bookings;
CREATE POLICY "Allow anon insert booking" ON public.demo_bookings
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Allow authenticated users (admins) to select
DROP POLICY IF EXISTS "Allow authenticated view booking" ON public.demo_bookings;
CREATE POLICY "Allow authenticated view booking" ON public.demo_bookings
    FOR SELECT
    TO authenticated
    USING (true);

-- Grant permissions (just in case)
GRANT SELECT, INSERT ON public.demo_bookings TO anon;
GRANT ALL ON public.demo_bookings TO authenticated;
GRANT ALL ON public.demo_bookings TO service_role;
