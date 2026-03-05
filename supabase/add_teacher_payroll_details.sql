ALTER TABLE teachers 
ADD COLUMN allowances JSONB DEFAULT '[]'::jsonb,
ADD COLUMN deductions JSONB DEFAULT '[]'::jsonb;
