-- Migration: Release Unissued Reserved Stock
-- Date: 2026-01-30
-- Description: Adds a function to release unissued reserved units back to available stock

CREATE OR REPLACE FUNCTION public.release_unissued_reservation(
    _request_id UUID,
    _admin_id UUID
) RETURNS void AS $$
DECLARE
    v_item_id UUID;
    v_approved_qty INTEGER;
    v_issued_qty INTEGER;
    v_remaining INTEGER;
BEGIN
    SELECT item_id, approved_qty, issued_qty 
    INTO v_item_id, v_approved_qty, v_issued_qty 
    FROM public.part_requests 
    WHERE id = _request_id;

    v_remaining := v_approved_qty - v_issued_qty;

    IF v_remaining <= 0 THEN
        RAISE EXCEPTION 'No remaining reservation to release.';
    END IF;

    -- 1. Restore stock to available pool
    UPDATE public.inventory 
    SET available_qty = available_qty + v_remaining,
        reserved_qty = reserved_qty - v_remaining,
        updated_at = now()
    WHERE id = v_item_id;

    -- 2. Update request so approved == issued (closing the reservation gap)
    UPDATE public.part_requests 
    SET approved_qty = issued_qty,
        notes = COALESCE(notes, '') || ' (Remainder ' || v_remaining || ' unissued units released back to stock at ' || now()::text || ')',
        updated_at = now()
    WHERE id = _request_id;

    -- 3. Log transaction
    INSERT INTO public.inventory_transactions (item_id, type, quantity, reference_id, performed_by, notes)
    VALUES (v_item_id, 'adjustment', v_remaining, _request_id, _admin_id, 'Released ' || v_remaining || ' unissued reserved units back to stock');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.release_unissued_reservation(UUID, UUID) TO authenticated;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
