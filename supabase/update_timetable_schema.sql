-- Add activity_name column for specifying 'Other' timetable entries
ALTER TABLE public.timetable_entries 
ADD COLUMN IF NOT EXISTS activity_name text;

-- Optional: Update RLS policies if they were strict about columns (Supabase usually isn't)
-- The existing policies use 'for all' or 'for select' which covers new columns automatically.
