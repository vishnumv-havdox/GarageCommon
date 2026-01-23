-- Add quality check and customer notification fields to work_orders table
-- Migration: 20260123150000_add_quality_check_and_customer_notification.sql

-- Add quality_check_status column
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS quality_check_status TEXT DEFAULT 'pending' CHECK (quality_check_status IN ('pending', 'completed'));

-- Add customer_notified column
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS customer_notified BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN work_orders.quality_check_status IS 'Status of quality check/evaluation before delivery';
COMMENT ON COLUMN work_orders.customer_notified IS 'Whether customer has been alerted for delivery';
