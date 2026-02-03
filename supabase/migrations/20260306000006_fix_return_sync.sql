-- Migration: Fix Return Sync and Unit Tracking
-- Description: Adds current_work_order_id to units and ensures process_part_return syncs all tables

-- 1. Add current_work_order_id to inventory_units
ALTER TABLE public.inventory_units 
ADD COLUMN IF NOT EXISTS current_work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL;

-- 2. Update scan_and_issue_unit to track WO
CREATE OR REPLACE FUNCTION public.scan_and_issue_unit(
    _qr_code TEXT,
    _work_order_id UUID,
    _employee_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_unit RECORD;
    v_request RECORD;
BEGIN
    -- 1. Find Unit
    SELECT * INTO v_unit FROM public.inventory_units WHERE qr_code = _qr_code;
    
    IF v_unit IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'QR Code not found in Unit Database');
    END IF;

    IF v_unit.status != 'available' THEN
        RETURN jsonb_build_object('success', false, 'code', 'ALREADY_USED', 'message', 'Unit is ' || v_unit.status);
    END IF;

    -- 2. Find Approved Request for this Item and WO
    -- Check for both 'approved' and 'issued' (for multi-part issuance)
    SELECT * INTO v_request 
    FROM public.part_requests 
    WHERE work_order_id = _work_order_id 
      AND item_id = v_unit.inventory_id 
      AND status IN ('approved', 'issued')
      AND issued_qty < approved_qty
    LIMIT 1;

    IF v_request IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_APPROVED', 'message', 'Item not approved or quota exceeded for this Work Order');
    END IF;

    -- 3. Issue the Part
    PERFORM public.issue_part_request(v_request.id, 1, _employee_id);

    -- 4. Mark Unit as Issued and link to WO
    UPDATE public.inventory_units 
    SET status = 'issued', 
        current_work_order_id = _work_order_id,
        updated_at = now() 
    WHERE id = v_unit.id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Unit issued successfully', 
        'item_name', (SELECT item_name FROM public.inventory WHERE id = v_unit.inventory_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update process_part_return to sync everything
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
        -- Total quantity is always restored since it's a physical return
        UPDATE public.inventory 
        SET quantity = quantity + v_qty,
            -- available_qty only increased if not damaged
            available_qty = CASE WHEN v_condition != 'damaged' THEN available_qty + v_qty ELSE available_qty END,
            updated_at = now()
        WHERE id = v_item_id;

        -- 2. Deduct from work_order_parts
        UPDATE public.work_order_parts 
        SET quantity = quantity - v_qty
        WHERE work_order_id = v_wo_id AND inventory_id = v_item_id;
        
        -- Delete if quantity hits 0
        DELETE FROM public.work_order_parts 
        WHERE work_order_id = v_wo_id AND inventory_id = v_item_id AND quantity <= 0;

        -- 3. Sync Part Request (Employee Page fix)
        -- Find the relevant part request that was issued/partial
        SELECT id INTO v_request_id 
        FROM public.part_requests 
        WHERE work_order_id = v_wo_id AND item_id = v_item_id AND status IN ('issued', 'approved')
        LIMIT 1;

        IF v_request_id IS NOT NULL THEN
            UPDATE public.part_requests 
            SET issued_qty = GREATEST(0, issued_qty - v_qty),
                -- Ensure status allows further scanning if not fully issued anymore
                status = 'approved', 
                updated_at = now()
            WHERE id = v_request_id;
        END IF;

        -- 4. Revert Units (QR Management fix)
        -- Mark v_qty units as available
        UPDATE public.inventory_units
        SET status = 'available',
            current_work_order_id = NULL,
            updated_at = now()
        WHERE id IN (
            SELECT id FROM public.inventory_units 
            WHERE inventory_id = v_item_id 
              AND status = 'issued' 
              AND current_work_order_id = v_wo_id
            LIMIT v_qty
        );

        -- 5. Log transaction
        INSERT INTO public.inventory_transactions (item_id, type, quantity, reference_id, performed_by, notes)
        VALUES (v_item_id, 'return', v_qty, _return_id, _admin_id, 'Part return approved. Condition: ' || v_condition);

        -- 6. Update invoice_items (Existing logic)
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
