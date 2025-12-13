-- Create billing_history table
CREATE TABLE IF NOT EXISTS public.billing_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Paid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view billing history for their school" ON public.billing_history
    FOR SELECT USING (school_id IN (
        SELECT school_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Admins can insert billing history for their school" ON public.billing_history
    FOR INSERT WITH CHECK (school_id IN (
        SELECT school_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ));
