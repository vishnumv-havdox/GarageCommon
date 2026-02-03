-- RPC for Scanning and Issuing Units
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
    SELECT * INTO v_request 
    FROM public.part_requests 
    WHERE work_order_id = _work_order_id 
      AND item_id = v_unit.inventory_id 
      AND status = 'approved' -- partials are still 'approved' per my previous fix
      AND issued_qty < approved_qty
    LIMIT 1;

    IF v_request IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_APPROVED', 'message', 'Item not approved or quota exceeded for this Work Order');
    END IF;

    -- 3. Issue the Part
    -- We call the existing issue_part_request function which handles inventory deduction
    -- Note: issue_part_request handles 'reserved' deduction.
    -- Unit tracking is an additional layer.
    PERFORM public.issue_part_request(v_request.id, 1, _employee_id);

    -- 4. Mark Unit as Issued
    UPDATE public.inventory_units 
    SET status = 'issued', updated_at = now() 
    WHERE id = v_unit.id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Unit issued successfully', 
        'item_name', (SELECT item_name FROM public.inventory WHERE id = v_unit.inventory_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
