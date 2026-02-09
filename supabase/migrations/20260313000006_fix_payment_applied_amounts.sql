-- Migration: fix_incorrect_payment_applied_amounts
-- Fixes cases where amount_applied was set to the full invoice total (including deductions) 
-- instead of the actual cash paid.

UPDATE payment_links pl
SET amount_applied = p.amount
FROM payments p
WHERE pl.payment_id = p.id
AND p.deduction_amount > 0
AND (
    SELECT count(*) 
    FROM payment_links pl2 
    WHERE pl2.payment_id = p.id
) = 1
AND pl.amount_applied > p.amount;

-- Update invoice statuses if they were incorrectly marked as Paid but now have balance
-- (Though usually they are still 'Paid' if deductions + new paid = total)
UPDATE invoices i
SET status = CASE 
    WHEN (total - (SELECT COALESCE(SUM(amount_applied), 0) FROM payment_links pl WHERE pl.invoice_id = i.id) - total_deductions) <= 0 THEN 'Paid'
    WHEN (SELECT COALESCE(SUM(amount_applied), 0) FROM payment_links pl WHERE pl.invoice_id = i.id) > 0 THEN 'Partial'
    ELSE 'Unpaid'
END;
