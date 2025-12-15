-- Add the missing phone_number column to the profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone_number TEXT;
