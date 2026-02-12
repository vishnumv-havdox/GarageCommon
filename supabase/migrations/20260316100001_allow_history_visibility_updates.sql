-- Allow customers to update hidden_from_customer flag on their own appointment history
-- Allow admins to update hidden_from_admin flag on any appointment history

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Users can update their appointment history visibility" ON appointment_history;
DROP POLICY IF EXISTS "Admins can update appointment history visibility" ON appointment_history;
DROP POLICY IF EXISTS "Customers can hide their own appointment history" ON appointment_history;
DROP POLICY IF EXISTS "Admins can hide appointment history" ON appointment_history;

-- Create policy for customers to update hidden_from_customer
CREATE POLICY "Customers can hide their own appointment history"
ON appointment_history
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM appointments
        WHERE appointments.id = appointment_history.appointment_id
        AND appointments.customer_id IN (
            SELECT id FROM customers WHERE user_id = auth.uid()
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM appointments
        WHERE appointments.id = appointment_history.appointment_id
        AND appointments.customer_id IN (
            SELECT id FROM customers WHERE user_id = auth.uid()
        )
    )
);

-- Create policy for admins to update hidden_from_admin
CREATE POLICY "Admins can hide appointment history"
ON appointment_history
FOR UPDATE
USING (
    has_role(auth.uid(), 'admin')
)
WITH CHECK (
    has_role(auth.uid(), 'admin')
);
