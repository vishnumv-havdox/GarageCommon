-- Appointment Date Management Enhancement
-- Add support for tracking requested vs scheduled dates and customer feedback

-- ============================================================================
-- 1. ADD NEW COLUMNS TO APPOINTMENTS TABLE
-- ============================================================================

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS requested_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS customer_response TEXT CHECK (customer_response IN ('accepted', 'reschedule_requested', 'cancelled_by_customer')),
ADD COLUMN IF NOT EXISTS customer_response_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reschedule_reason TEXT,
ADD COLUMN IF NOT EXISTS new_preferred_date TIMESTAMPTZ;

-- Update existing appointments to set requested_date = scheduled_at
UPDATE appointments 
SET requested_date = scheduled_at 
WHERE requested_date IS NULL;

-- Create index for faster queries on customer responses
CREATE INDEX IF NOT EXISTS idx_appointments_customer_response ON appointments(customer_response) WHERE customer_response IS NOT NULL;

-- ============================================================================
-- 2. RPC FUNCTION: ACCEPT ASSIGNED DATE
-- ============================================================================

CREATE OR REPLACE FUNCTION accept_appointment_date(
  appointment_id UUID
) RETURNS VOID AS $$
DECLARE
  customer_user_id UUID;
BEGIN
  -- Get customer_id from appointment
  SELECT customer_id INTO customer_user_id
  FROM appointments WHERE id = appointment_id;
  
  -- Update appointment
  UPDATE appointments
  SET customer_response = 'accepted',
      customer_response_at = NOW()
  WHERE id = appointment_id;
  
  -- Log in history
  INSERT INTO appointment_history (
    appointment_id, action_type, notes, changed_by
  ) VALUES (
    appointment_id, 
    'customer_accepted_date', 
    'Customer accepted the assigned date', 
    customer_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. RPC FUNCTION: REQUEST RESCHEDULE
-- ============================================================================

CREATE OR REPLACE FUNCTION request_appointment_reschedule(
  appointment_id UUID,
  new_date TIMESTAMPTZ,
  reason TEXT
) RETURNS VOID AS $$
DECLARE
  customer_user_id UUID;
BEGIN
  -- Get customer_id from appointment
  SELECT customer_id INTO customer_user_id
  FROM appointments WHERE id = appointment_id;
  
  -- Update appointment
  UPDATE appointments
  SET customer_response = 'reschedule_requested',
      customer_response_at = NOW(),
      new_preferred_date = new_date,
      reschedule_reason = reason
  WHERE id = appointment_id;
  
  -- Log in history
  INSERT INTO appointment_history (
    appointment_id, action_type, notes, changed_by
  ) VALUES (
    appointment_id, 
    'reschedule_requested', 
    'Customer requested reschedule to ' || to_char(new_date, 'YYYY-MM-DD HH12:MI AM') || ': ' || reason, 
    customer_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. RPC FUNCTION: CANCEL BY CUSTOMER
-- ============================================================================

CREATE OR REPLACE FUNCTION cancel_appointment_by_customer(
  appointment_id UUID,
  reason TEXT
) RETURNS VOID AS $$
DECLARE
  customer_user_id UUID;
BEGIN
  -- Get customer_id from appointment
  SELECT customer_id INTO customer_user_id
  FROM appointments WHERE id = appointment_id;
  
  -- Update appointment
  UPDATE appointments
  SET customer_response = 'cancelled_by_customer',
      customer_response_at = NOW(),
      status = 'cancelled',
      reschedule_reason = reason,
      status_updated_by = customer_user_id
  WHERE id = appointment_id;
  
  -- Log in history
  INSERT INTO appointment_history (
    appointment_id, action_type, notes, changed_by
  ) VALUES (
    appointment_id, 
    'cancelled_by_customer', 
    'Customer cancelled appointment: ' || reason, 
    customer_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. RPC FUNCTION: ADMIN APPROVES RESCHEDULE REQUEST
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_reschedule_request(
  appointment_id UUID,
  admin_id UUID
) RETURNS VOID AS $$
DECLARE
  new_date TIMESTAMPTZ;
  old_date TIMESTAMPTZ;
BEGIN
  -- Get the new preferred date and old scheduled date
  SELECT new_preferred_date, scheduled_at INTO new_date, old_date
  FROM appointments WHERE id = appointment_id;
  
  -- Update appointment with new date and clear customer response
  UPDATE appointments
  SET scheduled_at = new_date,
      customer_response = NULL,
      customer_response_at = NULL,
      new_preferred_date = NULL,
      reschedule_reason = NULL,
      status_updated_by = admin_id
  WHERE id = appointment_id;
  
  -- Log in history
  INSERT INTO appointment_history (
    appointment_id, action_type, notes, changed_by
  ) VALUES (
    appointment_id, 
    'reschedule_approved', 
    'Admin approved customer reschedule request. Changed from ' || 
    to_char(old_date, 'YYYY-MM-DD HH12:MI AM') || ' to ' || 
    to_char(new_date, 'YYYY-MM-DD HH12:MI AM'), 
    admin_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. RPC FUNCTION: ADMIN REJECTS RESCHEDULE REQUEST
-- ============================================================================

CREATE OR REPLACE FUNCTION reject_reschedule_request(
  appointment_id UUID,
  admin_id UUID,
  rejection_reason TEXT
) RETURNS VOID AS $$
BEGIN
  -- Clear customer response but keep the appointment as is
  UPDATE appointments
  SET customer_response = NULL,
      customer_response_at = NULL,
      new_preferred_date = NULL,
      reschedule_reason = NULL,
      status_updated_by = admin_id
  WHERE id = appointment_id;
  
  -- Log in history
  INSERT INTO appointment_history (
    appointment_id, action_type, notes, changed_by
  ) VALUES (
    appointment_id, 
    'reschedule_rejected', 
    'Admin rejected customer reschedule request: ' || rejection_reason, 
    admin_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
