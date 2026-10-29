-- Migration: Fix issue_part_request to auto-reserve from available stock if shortfall exists
-- Description: When issuing parts directly or if reserved_qty is out of sync, auto-adjusts from available_qty if sufficient stock exists.

CREATE OR REPLACE FUNCTION public.issue_part_request(
    _request_id UUID,
    _issued_qty INTEGER,
    _employee_id UUID
) RETURNS void AS $$
DECLARE
    v_item_id UUID;
    v_reserved INTEGER;
    v_available INTEGER;
    v_wo_id UUID;
    v_unit_price NUMERIC;
    v_item_name TEXT;
    v_current_issued INTEGER;
    v_approved_qty INTEGER;
    v_new_status TEXT;
    v_needed INTEGER;
BEGIN
    SELECT item_id, work_order_id, COALESCE(issued_qty, 0), COALESCE(approved_qty, 0)
    INTO v_item_id, v_wo_id, v_current_issued, v_approved_qty 
    FROM public.part_requests WHERE id = _request_id;
    
    SELECT COALESCE(reserved_qty, 0), COALESCE(available_qty, 0), unit_price, item_name 
    INTO v_reserved, v_available, v_unit_price, v_item_name 
    FROM public.inventory WHERE id = v_item_id;

    -- If not enough reserved stock, but available stock exists, auto-reserve the shortfall
    IF _issued_qty > v_reserved THEN
        v_needed := _issued_qty - v_reserved;
        IF v_available >= v_needed THEN
            -- Adjust reservation from available
            UPDATE public.inventory
            SET available_qty = available_qty - v_needed,
                reserved_qty = reserved_qty + v_needed,
                updated_at = now()
            WHERE id = v_item_id;
            
            v_reserved := v_reserved + v_needed;
        ELSE
            RAISE EXCEPTION 'Cannot issue % units. Only % reserved and % available in inventory.', 
                _issued_qty, v_reserved, v_available;
        END IF;
    END IF;
    
    -- Determine new status
    IF (v_current_issued + _issued_qty) >= v_approved_qty THEN
        v_new_status := 'issued';
    ELSE
        v_new_status := 'approved'; -- Keep as approved so it appears in the scanner list
    END IF;

    -- Update request
    UPDATE public.part_requests 
    SET issued_qty = COALESCE(issued_qty, 0) + _issued_qty,
        status = v_new_status,
        updated_at = now()
    WHERE id = _request_id;

    -- Deduct from physical stock
    UPDATE public.inventory 
    SET reserved_qty = GREATEST(0, reserved_qty - _issued_qty),
        quantity = quantity - _issued_qty,
        updated_at = now()
    WHERE id = v_item_id;

    -- Add to work_order_parts for invoicing
    INSERT INTO public.work_order_parts (work_order_id, inventory_id, part_name, quantity, unit_price, added_by)
    VALUES (v_wo_id, v_item_id, v_item_name, _issued_qty, v_unit_price, _employee_id);

    -- Log transaction
    INSERT INTO public.inventory_transactions (item_id, type, quantity, reference_id, performed_by, notes)
    VALUES (v_item_id, 'issue', _issued_qty, _request_id, _employee_id, 'Part scanned and issued to work order');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
