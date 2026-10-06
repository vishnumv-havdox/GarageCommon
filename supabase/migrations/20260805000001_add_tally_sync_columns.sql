-- Migration: 20260805000001_add_tally_sync_columns
-- Description: Adds tally_synced and tally_synced_at to invoices table to track export status

ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS tally_synced boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS tally_synced_at timestamptz;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
