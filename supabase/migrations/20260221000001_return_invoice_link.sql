-- Migration: Part Return Invoice Synchronization
-- Date: 2026-02-21
-- Description: Updates the process_part_return function to automatically adjust Draft invoices when parts are returned.

CREATE OR REPLACE FUNCTION public.process_part_return(
    _return_id UUID,
    _status TEXT, -- 'approved', 'rejected'
    _admin_id UUID,
    _notes TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_item_id UUID;
    v_qty INTEGER;
    v_wo_id UUID;
    v_condition TEXT;
BEGIN
    -- 1. Get return request details
    SELECT inventory_id, quantity, work_order_id, condition 
    INTO v_item_id, v_qty, v_wo_id, v_condition 
    FROM public.inventory_returns 
    WHERE id = _return_id;

    -- Update request status
    UPDATE public.inventory_returns 
    SET status = _status, 
        approved_by = _admin_id, 
        notes = _notes,
        updated_at = now()
    WHERE id = _return_id;

    IF _status = 'approved' THEN
        -- 2. Update Inventory
        UPDATE public.inventory 
        SET quantity = quantity + v_qty,
            available_qty = CASE 
                WHEN v_condition = 'damaged' THEN available_qty 
                ELSE available_qty + v_qty 
            END,
            updated_at = now()
        WHERE id = v_item_id;

        -- 3. Deduct from work_order_parts 
        UPDATE public.work_order_parts 
        SET quantity = quantity - v_qty
        WHERE work_order_id = v_wo_id AND inventory_id = v_item_id;
        
        -- Delete if quantity hits 0
        DELETE FROM public.work_order_parts 
        WHERE work_order_id = v_wo_id AND inventory_id = v_item_id AND quantity <= 0;

        -- 4. Log transaction
        INSERT INTO public.inventory_transactions (item_id, type, quantity, reference_id, performed_by, notes)
        VALUES (v_item_id, 'return', v_qty, _return_id, _admin_id, 'Part return approved. Condition: ' || v_condition);

        -- 5. Update invoice_items if they exist and are in 'Draft' status
        -- We match by description (part_name) and work_order_id
        UPDATE public.invoice_items ii
        SET quantity = ii.quantity - v_qty,
            taxable_value = (ii.quantity - v_qty) * ii.unit_price,
            cgst_amount = ((ii.quantity - v_qty) * ii.unit_price) * (COALESCE(ii.cgst_rate, 9.0) / 100),
            sgst_amount = ((ii.quantity - v_qty) * ii.unit_price) * (COALESCE(ii.sgst_rate, 9.0) / 100),
            total = (ii.quantity - v_qty) * ii.unit_price + 
                    (((ii.quantity - v_qty) * ii.unit_price) * (COALESCE(ii.cgst_rate, 9.0) / 100)) +
                    (((ii.quantity - v_qty) * ii.unit_price) * (COALESCE(ii.sgst_rate, 9.0) / 100)),
            updated_at = now()
        FROM public.invoices i
        WHERE ii.invoice_id = i.id 
          AND i.work_order_id = v_wo_id 
          AND i.status = 'Draft'
          AND ii.description = (SELECT item_name FROM public.inventory WHERE id = v_item_id)
          AND ii.type = 'part';

        -- Delete invoice items if quantity hits 0
        DELETE FROM public.invoice_items ii
        USING public.invoices i
        WHERE ii.invoice_id = i.id 
          AND i.work_order_id = v_wo_id 
          AND i.status = 'Draft'
          AND ii.quantity <= 0
          AND ii.description = (SELECT item_name FROM public.inventory WHERE id = v_item_id)
          AND ii.type = 'part';
          
        -- 6. Trigger Invoice Header Re-calculation (optional, but good for total field consistency)
        UPDATE public.invoices i
        SET subtotal = (SELECT COALESCE(SUM(taxable_value), 0) FROM public.invoice_items WHERE invoice_id = i.id),
            tax = (SELECT COALESCE(SUM(cgst_amount + sgst_amount), 0) FROM public.invoice_items WHERE invoice_id = i.id),
            total = (SELECT COALESCE(SUM(total), 0) FROM public.invoice_items WHERE invoice_id = i.id),
            updated_at = now()
        WHERE i.work_order_id = v_wo_id AND i.status = 'Draft';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema
NOTIFY pgrst, 'reload schema';
