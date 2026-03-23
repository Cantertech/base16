-- Add missing columns to feeding_logs for partial payments and fees
ALTER TABLE feeding_logs ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE feeding_logs ADD COLUMN IF NOT EXISTS fee_amount DECIMAL(10,2) DEFAULT 0.00;

-- Ensure feeding_credit exists on students
ALTER TABLE students ADD COLUMN IF NOT EXISTS feeding_credit DECIMAL(10,2) DEFAULT 0.00;
