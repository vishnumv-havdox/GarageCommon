-- Migration: Track Issued By for Units
-- Description: Adds issued_by column to inventory_units and updates scan_and_issue_unit

-- 1. Add issued_by to inventory_units
ALTER TABLE public.inventory_units 
ADD COLUMN IF NOT EXISTS issued_by UUID REFERENCES public.employees(id) ON DELETE SET NULL;

-- 2. Update scan_and_issue_unit to track issuer
CREATE OR REPLACE FUNCTION public.scan_and_issue_unit(
    _qr_code TEXT,
    _work_order_id UUID,
    _employee_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_unit RECORD;
    v_request RECORD;
BEGIN
    SELECT * INTO v_unit FROM public.inventory_units WHERE qr_code = _qr_code;
    IF v_unit IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'QR Code not found');
    END IF;
    IF v_unit.status != 'available' THEN
        RETURN jsonb_build_object('success', false, 'code', 'ALREADY_USED', 'message', 'Unit is ' || v_unit.status);
    END IF;

    SELECT * INTO v_request 
    FROM public.part_requests 
    WHERE work_order_id = _work_order_id 
      AND item_id = v_unit.inventory_id 
      AND status IN ('approved', 'issued')
      AND issued_qty < approved_qty
    LIMIT 1;

    IF v_request IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_APPROVED', 'message', 'Item not approved or quota exceeded');
    END IF;

    PERFORM public.issue_part_request(v_request.id, 1, _employee_id);

    UPDATE public.inventory_units 
    SET status = 'issued', 
        current_work_order_id = _work_order_id,
        issued_by = _employee_id,
        updated_at = now() 
    WHERE id = v_unit.id;

    RETURN jsonb_build_object('success', true, 'message', 'Unit issued successfully', 'item_name', (SELECT item_name FROM public.inventory WHERE id = v_unit.inventory_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Clear issued_by on return
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
        RAISE EXCEPTION 'Invalid status.';
    END IF;

    SELECT inventory_id, quantity, condition, work_order_id 
    INTO v_item_id, v_qty, v_condition, v_wo_id 
    FROM public.inventory_returns 
    WHERE id = _return_id;

    UPDATE public.inventory_returns 
    SET status = _status, approved_by = _admin_id, notes = _notes, updated_at = now()
    WHERE id = _return_id;

    IF _status = 'approved' THEN
        UPDATE public.inventory 
        SET quantity = quantity + v_qty,
            available_qty = CASE WHEN v_condition != 'damaged' THEN available_qty + v_qty ELSE available_qty END,
            updated_at = now()
        WHERE id = v_item_id;

        UPDATE public.work_order_parts SET quantity = quantity - v_qty
        WHERE work_order_id = v_wo_id AND inventory_id = v_item_id;
        DELETE FROM public.work_order_parts WHERE work_order_id = v_wo_id AND inventory_id = v_item_id AND quantity <= 0;

        SELECT id INTO v_request_id FROM public.part_requests 
        WHERE work_order_id = v_wo_id AND item_id = v_item_id AND status IN ('issued', 'approved')
        ORDER BY created_at DESC LIMIT 1;

        IF v_request_id IS NOT NULL THEN
            UPDATE public.part_requests SET returned_qty = COALESCE(returned_qty, 0) + v_qty, updated_at = now()
            WHERE id = v_request_id;
        END IF;

        UPDATE public.inventory_units
        SET status = 'available',
            current_work_order_id = NULL,
            issued_by = NULL,
            updated_at = now()
        WHERE id IN (
            SELECT id FROM public.inventory_units 
            WHERE inventory_id = v_item_id AND status = 'issued' AND (current_work_order_id = v_wo_id OR current_work_order_id IS NULL)
            LIMIT v_qty
        );

        INSERT INTO public.inventory_transactions (item_id, type, quantity, reference_id, performed_by, notes)
        VALUES (v_item_id, 'return', v_qty, _return_id, _admin_id, 'Part return approved');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
