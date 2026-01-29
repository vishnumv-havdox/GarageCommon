-- Migration: Cancel/Unreserve Part Request
-- Date: 2026-01-30
-- Description: Adds a function to reject/cancel a part request and restore reserved stock

CREATE OR REPLACE FUNCTION public.reject_part_request(
    _request_id UUID,
    _admin_id UUID,
    _notes TEXT DEFAULT 'Request rejected / cancelled'
) RETURNS void AS $$
DECLARE
    v_item_id UUID;
    v_approved_qty INTEGER;
    v_status TEXT;
BEGIN
    -- Get request details
    SELECT item_id, approved_qty, status 
    INTO v_item_id, v_approved_qty, v_status 
    FROM public.part_requests 
    WHERE id = _request_id;

    IF v_status = 'issued' THEN
        RAISE EXCEPTION 'Cannot reject an already issued part. Use return instead.';
    END IF;

    -- 1. If it was already approved/reserved, restore stock
    IF v_status = 'approved' AND v_approved_qty > 0 THEN
        UPDATE public.inventory 
        SET available_qty = available_qty + v_approved_qty,
            reserved_qty = reserved_qty - v_approved_qty,
            updated_at = now()
        WHERE id = v_item_id;

        -- Log cancellation transaction
        INSERT INTO public.inventory_transactions (item_id, type, quantity, reference_id, performed_by, notes)
        VALUES (v_item_id, 'adjustment', v_approved_qty, _request_id, _admin_id, 'Reservation cancelled: ' || _notes);
    END IF;

    -- 2. Update request status
    UPDATE public.part_requests 
    SET status = 'rejected',
        notes = _notes,
        updated_at = now()
    WHERE id = _request_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.reject_part_request(UUID, UUID, TEXT) TO authenticated;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
