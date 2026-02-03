-- Migration: Enhanced Return Tracking
-- Description: Adds returned_qty to part_requests and improves process_part_return robustness

-- 1. Add returned_qty to part_requests
ALTER TABLE public.part_requests 
ADD COLUMN IF NOT EXISTS returned_qty INTEGER DEFAULT 0;

-- 2. Backfill current_work_order_id for legacy issued units (Best effort)
-- This attempts to link issued units to the most likely work order
WITH issued_matches AS (
    SELECT 
        iu.id as unit_id,
        pr.work_order_id
    FROM public.inventory_units iu
    JOIN public.part_requests pr ON pr.item_id = iu.inventory_id
    WHERE iu.status = 'issued' 
      AND iu.current_work_order_id IS NULL
      AND pr.issued_qty > 0
    ORDER BY pr.created_at DESC
)
UPDATE public.inventory_units
SET current_work_order_id = im.work_order_id
FROM issued_matches im
WHERE public.inventory_units.id = im.unit_id;

-- 3. Robust process_part_return
CREATE OR REPLACE FUNCTION public.process_part_return(
    _return_id UUID,
    _status TEXT,
    _admin_id UUID,
    _notes TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_item_id UUID;
    v_qty INTEGER;
    v_condition TEXT;
    v_wo_id UUID;
    v_request_id UUID;
BEGIN
    IF _status NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Invalid status. Must be approved or rejected.';
    END IF;

    SELECT inventory_id, quantity, condition, work_order_id 
    INTO v_item_id, v_qty, v_condition, v_wo_id 
    FROM public.inventory_returns 
    WHERE id = _return_id;

    -- Update return request status
    UPDATE public.inventory_returns 
    SET status = _status,
        approved_by = _admin_id,
        notes = _notes,
        updated_at = now()
    WHERE id = _return_id;

    IF _status = 'approved' THEN
        -- 1. Restore inventory stock counts
        UPDATE public.inventory 
        SET quantity = quantity + v_qty,
            available_qty = CASE WHEN v_condition != 'damaged' THEN available_qty + v_qty ELSE available_qty END,
            updated_at = now()
        WHERE id = v_item_id;

        -- 2. Deduct from work_order_parts
        UPDATE public.work_order_parts 
        SET quantity = quantity - v_qty
        WHERE work_order_id = v_wo_id AND inventory_id = v_item_id;
        
        DELETE FROM public.work_order_parts 
        WHERE work_order_id = v_wo_id AND inventory_id = v_item_id AND quantity <= 0;

        -- 3. Sync Part Request (Employee Page fix)
        SELECT id INTO v_request_id 
        FROM public.part_requests 
        WHERE work_order_id = v_wo_id AND item_id = v_item_id AND status IN ('issued', 'approved')
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_request_id IS NOT NULL THEN
            UPDATE public.part_requests 
            SET returned_qty = COALESCE(returned_qty, 0) + v_qty,
                updated_at = now()
            WHERE id = v_request_id;
        END IF;

        -- 4. Revert Units (QR Management fix)
        -- Fallback: If current_work_order_id is NULL (legacy), still try to find issued units for this item
        UPDATE public.inventory_units
        SET status = 'available',
            current_work_order_id = NULL,
            updated_at = now()
        WHERE id IN (
            SELECT id FROM public.inventory_units 
            WHERE inventory_id = v_item_id 
              AND status = 'issued' 
              AND (current_work_order_id = v_wo_id OR current_work_order_id IS NULL)
            LIMIT v_qty
        );

        -- 5. Log transaction
        INSERT INTO public.inventory_transactions (item_id, type, quantity, reference_id, performed_by, notes)
        VALUES (v_item_id, 'return', v_qty, _return_id, _admin_id, 'Part return approved. Condition: ' || v_condition);

        -- 6. Invoicing Logic
        UPDATE public.invoice_items ii
        SET quantity = ii.quantity - v_qty,
            taxable_value = (ii.quantity - v_qty) * ii.unit_price,
            cgst_amount = ((ii.quantity - v_qty) * ii.unit_price) * (COALESCE(ii.cgst_rate, 9.0) / 100),
            sgst_amount = ((ii.quantity - v_qty) * ii.unit_price) * (COALESCE(ii.sgst_rate, 9.0) / 100),
            total = (ii.quantity - v_qty) * ii.unit_price + 
                    (((ii.quantity - v_qty) * ii.unit_price) * (COALESCE(ii.cgst_rate, 9.0) / 100)) +
                    (((ii.quantity - v_qty) * ii.unit_price) * (COALESCE(ii.sgst_rate, 9.0) / 100))
        FROM public.invoices i
        WHERE ii.invoice_id = i.id 
          AND i.work_order_id = v_wo_id 
          AND i.status = 'Draft'
          AND ii.description = (SELECT item_name FROM public.inventory WHERE id = v_item_id)
          AND ii.type = 'part';

        DELETE FROM public.invoice_items ii
        USING public.invoices i
        WHERE ii.invoice_id = i.id 
          AND i.work_order_id = v_wo_id 
          AND i.status = 'Draft'
          AND ii.quantity <= 0
          AND ii.description = (SELECT item_name FROM public.inventory WHERE id = v_item_id)
          AND ii.type = 'part';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Sync existing approved returns to part_requests (Fix current state)
WITH approved_returns_sum AS (
    SELECT 
        work_order_id, 
        inventory_id, 
        SUM(quantity) as total_returned
    FROM public.inventory_returns
    WHERE status = 'approved'
    GROUP BY work_order_id, inventory_id
)
UPDATE public.part_requests pr
SET returned_qty = ars.total_returned
FROM approved_returns_sum ars
WHERE pr.work_order_id = ars.work_order_id 
  AND pr.item_id = ars.inventory_id;

-- 5. Data repair for units (Optional/Best Effort)
-- If there are more units marked 'issued' for a WO than (Issued - Returned) in PR, 
-- reset some units to 'available' to match the actual used count.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT 
            pr.work_order_id, 
            pr.item_id, 
            (SELECT count(*) FROM public.inventory_units WHERE inventory_id = pr.item_id AND status = 'issued' AND (current_work_order_id = pr.work_order_id OR current_work_order_id IS NULL)) as units_issued,
            (pr.issued_qty - COALESCE(pr.returned_qty, 0)) as actual_used
        FROM public.part_requests pr
        WHERE pr.issued_qty > 0
    ) LOOP
        IF r.units_issued > r.actual_used THEN
            UPDATE public.inventory_units
            SET status = 'available',
                current_work_order_id = NULL
            WHERE id IN (
                SELECT id FROM public.inventory_units 
                WHERE inventory_id = r.item_id 
                  AND status = 'issued' 
                  AND (current_work_order_id = r.work_order_id OR current_work_order_id IS NULL)
                LIMIT (r.units_issued - r.actual_used)
            );
        END IF;
    END LOOP;
END $$;

