-- Migration: 20260313000004_cleanup_duplicate_payments.sql
-- Description: Auto-rejects pending payments for invoices that are already Paid.

-- 1. Reject pending payments linked directly via invoice_id to Paid invoices
UPDATE public.payments
SET status = 'rejected', 
    admin_remarks = 'Auto-cleanup: Invoice already Paid',
    updated_at = now()
WHERE status = 'pending' 
  AND invoice_id IN (SELECT id FROM public.invoices WHERE status = 'Paid');

-- 2. Reject pending payments linked via payment_links to Paid invoices
UPDATE public.payments
SET status = 'rejected',
    admin_remarks = 'Auto-cleanup: Invoice already Paid',
    updated_at = now()
WHERE status = 'pending'
  AND id IN (
    SELECT payment_id 
    FROM public.payment_links pl
    JOIN public.invoices i ON pl.invoice_id = i.id
    WHERE i.status = 'Paid'
  );
