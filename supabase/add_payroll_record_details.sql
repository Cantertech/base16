ALTER TABLE payroll_records 
ADD COLUMN allowances JSONB DEFAULT '[]'::jsonb,
ADD COLUMN deductions JSONB DEFAULT '[]'::jsonb;
