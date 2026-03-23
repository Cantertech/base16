-- Add status and reversal tracking to transactions
ALTER TABLE IF EXISTS transactions 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Completed',
ADD COLUMN IF NOT EXISTS reversal_note TEXT;

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
