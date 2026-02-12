-- Add visibility flags to appointment_history table
-- This allows customers and admins to hide history records independently
ALTER TABLE appointment_history
ADD COLUMN IF NOT EXISTS hidden_from_customer BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS hidden_from_admin BOOLEAN DEFAULT false;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
