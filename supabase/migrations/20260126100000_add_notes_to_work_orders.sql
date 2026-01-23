-- Migration: 20260126100000_add_notes_to_work_orders.sql
-- Description: Add notes column to work_orders table to store JSON metadata or general notes

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'work_orders'
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE public.work_orders ADD COLUMN notes text;
    END IF;
END $$;
