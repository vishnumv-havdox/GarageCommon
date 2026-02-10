-- Migration: 20260313000007_refine_financial_analytics.sql
-- Description: Refine financial analytics to use actual payment data and fix realization rate

CREATE OR REPLACE FUNCTION public.get_financial_analytics_v2(
    p_start_date timestamptz DEFAULT (now() - interval '30 days'),
    p_end_date timestamptz DEFAULT now(),
    p_service_type text DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_total_revenue numeric;
    v_daily_revenue json;
    v_monthly_revenue json;
    v_yearly_revenue json;
    v_revenue_by_service json;
    v_avg_invoice numeric;
    v_pending_payments numeric;
    v_collected_payments numeric;
    v_total_deductions numeric;
    v_realization_rate numeric;
BEGIN
    -- 1. Total Billed Revenue (Gross)
    SELECT 
        COALESCE(SUM(total), 0),
        COALESCE(AVG(total), 0)
    INTO v_total_revenue, v_avg_invoice
    FROM public.invoices
    WHERE status != 'Draft'
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- 2. Daily Billed Revenue
    SELECT json_object_agg(date_key, amount) INTO v_daily_revenue
    FROM (
        SELECT to_char(created_at::date, 'YYYY-MM-DD') as date_key, SUM(total) as amount
        FROM public.invoices
        WHERE status != 'Draft'
        AND created_at BETWEEN p_start_date AND p_end_date
        GROUP BY created_at::date
        ORDER BY created_at::date
    ) d;

    -- 3. Revenue by Service Type
    SELECT json_object_agg(service_type, total) INTO v_revenue_by_service
    FROM (
        SELECT wo.service_type, SUM(inv.total) as total
        FROM public.invoices inv
        JOIN public.work_orders wo ON inv.work_order_id = wo.id
        WHERE inv.status != 'Draft'
        AND inv.created_at BETWEEN p_start_date AND p_end_date
        AND (p_service_type IS NULL OR wo.service_type = p_service_type)
        GROUP BY wo.service_type
    ) ss;

    -- 4. Actual Cash Collected (Net Revenue)
    -- Sum of amount_applied from approved payments in the period
    SELECT 
        COALESCE(SUM(pl.amount_applied), 0)
    INTO v_collected_payments
    FROM public.payment_links pl
    JOIN public.payments p ON pl.payment_id = p.id
    WHERE p.status = 'approved'
    AND p.created_at BETWEEN p_start_date AND p_end_date;

    -- 5. Total Deductions
    -- For invoices created in the period
    SELECT 
        COALESCE(SUM(total_deductions), 0)
    INTO v_total_deductions
    FROM public.invoices
    WHERE status != 'Draft'
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- 6. Total Outstanding (Billed - Collected - Deductions)
    -- This is tricky across periods, but for the period's invoices:
    SELECT 
        COALESCE(SUM(total - total_deductions), 0) - v_collected_payments
    INTO v_pending_payments
    FROM public.invoices
    WHERE status != 'Draft'
    AND created_at BETWEEN p_start_date AND p_end_date;
    
    -- Ensure pending is not negative (if payments from previous periods were high)
    v_pending_payments := GREATEST(0, v_pending_payments);

    -- 7. Calculate Realization Rate
    -- Realization Rate = (Collected) / (Total Billed In Period) * 100
    -- Or more accurately: Collected / (Collected + Deductions)
    IF (v_collected_payments + v_total_deductions) > 0 THEN
        v_realization_rate := (v_collected_payments / (v_collected_payments + v_total_deductions)) * 100;
    ELSE
        v_realization_rate := 100;
    END IF;

    v_result := json_build_object(
        'total_revenue', ROUND(v_total_revenue, 2), -- Billed
        'collected_payments', ROUND(v_collected_payments, 2), -- Net Cash
        'daily_revenue', v_daily_revenue,
        'revenue_by_service', v_revenue_by_service,
        'avg_invoice_value', ROUND(v_avg_invoice, 2),
        'pending_payments', ROUND(v_pending_payments, 2),
        'total_deductions', ROUND(v_total_deductions, 2),
        'realization_rate', ROUND(v_realization_rate, 2),
        'total_outstanding', ROUND(v_pending_payments, 2)
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
