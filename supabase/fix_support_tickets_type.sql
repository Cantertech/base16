-- Fix: Add missing 'type' column to support_tickets table
-- This allows categorizing tickets (e.g., 'Feature Request', 'Bug', 'Support')
ALTER TABLE support_tickets 
ADD COLUMN IF NOT EXISTS type TEXT;

-- Create an index to make queries faster for the admin dashboard
CREATE INDEX IF NOT EXISTS idx_support_tickets_type ON support_tickets(type);
