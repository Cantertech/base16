-- Add currency column to schools table
ALTER TABLE schools ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GHS';
