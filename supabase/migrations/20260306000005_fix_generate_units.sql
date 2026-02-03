-- Update generate_inventory_units to ensure uniqueness
CREATE OR REPLACE FUNCTION public.generate_inventory_units(
    _inventory_id UUID,
    _quantity INTEGER,
    _sku TEXT
) RETURNS void AS $$
DECLARE
    i INTEGER;
    v_qr TEXT;
BEGIN
    FOR i IN 1.._quantity LOOP
        -- Generate strict unique QR: SKU-TIMESTAMP-INDEX-RANDOM
        -- Using clock_timestamp() for better entropy, and 'i' to guarantee uniqueness within batch
        v_qr := _sku || '-' || to_char(clock_timestamp(), 'YYMMDDHH24MISS') || '-' || i || '-' || substring(md5(random()::text) from 1 for 3);
        
        BEGIN
            INSERT INTO public.inventory_units (inventory_id, qr_code, status)
            VALUES (_inventory_id, v_qr, 'available');
        EXCEPTION WHEN unique_violation THEN
            -- Retry once with different random or just skip (though index should prevent it)
            v_qr := _sku || '-' || to_char(clock_timestamp(), 'YYMMDDHH24MISS') || '-' || i || '-' || substring(md5(random()::text) from 1 for 4);
            INSERT INTO public.inventory_units (inventory_id, qr_code, status)
            VALUES (_inventory_id, v_qr, 'available');
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
