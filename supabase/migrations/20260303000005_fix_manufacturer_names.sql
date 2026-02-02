-- Migration: 20260303000005_fix_manufacturer_names
-- Description: Consolidates duplicate manufacturers (e.g. TATA vs Tata Motors) and ensures consistent naming.

DO $$
DECLARE
    tata_id UUID;
    tm_id UUID;
    eicher_id UUID;
    em_id UUID;
    force_id UUID;
    fm_id UUID;
BEGIN
    -- 1. Fix TATA -> Tata Motors
    SELECT id INTO tata_id FROM public.vehicle_manufacturers WHERE name = 'TATA';
    SELECT id INTO tm_id FROM public.vehicle_manufacturers WHERE name = 'Tata Motors';
    
    IF tata_id IS NOT NULL AND tm_id IS NOT NULL THEN
        -- Move models from TATA to Tata Motors
        UPDATE public.vehicle_models SET manufacturer_id = tm_id WHERE manufacturer_id = tata_id;
        -- Delete old TATA
        DELETE FROM public.vehicle_manufacturers WHERE id = tata_id;
    ELSIF tata_id IS NOT NULL AND tm_id IS NULL THEN
        -- Just rename if target doesn't exist
        UPDATE public.vehicle_manufacturers SET name = 'Tata Motors' WHERE id = tata_id;
    END IF;

    -- 2. Fix EICHER -> Eicher Motors
    SELECT id INTO eicher_id FROM public.vehicle_manufacturers WHERE name = 'EICHER';
    SELECT id INTO em_id FROM public.vehicle_manufacturers WHERE name = 'Eicher Motors';
    
    IF eicher_id IS NOT NULL AND em_id IS NOT NULL THEN
        UPDATE public.vehicle_models SET manufacturer_id = em_id WHERE manufacturer_id = eicher_id;
        DELETE FROM public.vehicle_manufacturers WHERE id = eicher_id;
    ELSIF eicher_id IS NOT NULL AND em_id IS NULL THEN
        UPDATE public.vehicle_manufacturers SET name = 'Eicher Motors' WHERE id = eicher_id;
    END IF;

    -- 3. Fix FORCE -> Force Motors
    SELECT id INTO force_id FROM public.vehicle_manufacturers WHERE name = 'FORCE';
    SELECT id INTO fm_id FROM public.vehicle_manufacturers WHERE name = 'Force Motors';
    
    IF force_id IS NOT NULL AND fm_id IS NOT NULL THEN
        UPDATE public.vehicle_models SET manufacturer_id = fm_id WHERE manufacturer_id = force_id;
        DELETE FROM public.vehicle_manufacturers WHERE id = force_id;
    ELSIF force_id IS NOT NULL AND fm_id IS NULL THEN
        UPDATE public.vehicle_manufacturers SET name = 'Force Motors' WHERE id = force_id;
    END IF;

END $$;
