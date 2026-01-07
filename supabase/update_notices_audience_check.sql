-- Update notices table check constraint to include 'Parents'
ALTER TABLE public.notices 
DROP CONSTRAINT IF EXISTS notices_audience_check;

ALTER TABLE public.notices
ADD CONSTRAINT notices_audience_check 
CHECK (audience IN ('All Staff', 'Teaching Staff', 'Admins Only', 'Parents'));
