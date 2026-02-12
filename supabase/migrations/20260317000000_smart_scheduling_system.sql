-- Smart Scheduling System: Capacity Management & Garage Metrics
-- This migration adds capacity configuration and real-time availability RPCs

-- ============================================================================
-- 1. CAPACITY SETTINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.capacity_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_type TEXT NOT NULL CHECK (setting_type IN ('global', 'service_type', 'time_slot')),
    service_type_id UUID REFERENCES public.service_types(id) ON DELETE CASCADE,
    time_slot_start TIME,
    time_slot_end TIME,
    max_appointments_per_hour INTEGER DEFAULT 4,
    max_appointments_per_day INTEGER DEFAULT 20,
    max_vehicles_per_slot INTEGER DEFAULT 2,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_capacity_settings_type ON public.capacity_settings(setting_type, is_active);
CREATE INDEX IF NOT EXISTS idx_capacity_settings_service ON public.capacity_settings(service_type_id) WHERE service_type_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.capacity_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read capacity settings" ON public.capacity_settings
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage capacity settings" ON public.capacity_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

-- Insert default global capacity settings
INSERT INTO public.capacity_settings (setting_type, max_appointments_per_hour, max_appointments_per_day, notes)
VALUES ('global', 4, 20, 'Default capacity limits')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. GARAGE METRICS RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_garage_metrics(
    target_date DATE DEFAULT CURRENT_DATE
) RETURNS JSON AS $$
DECLARE
    metrics JSON;
BEGIN
    WITH metrics_data AS (
        SELECT
            -- Total work orders placed (all active statuses)
            COUNT(*) FILTER (
                WHERE status IN ('Pending', 'In Progress', 'Quality Check', 'Ready for Delivery', 'Reopened')
            ) AS work_orders_placed,
            
            -- Working vehicles (actively being worked on)
            COUNT(DISTINCT vehicle_id) FILTER (
                WHERE status = 'In Progress'
            ) AS working_vehicles,
            
            -- Completed but not delivered
            COUNT(DISTINCT vehicle_id) FILTER (
                WHERE status IN ('Quality Check', 'Ready for Delivery')
            ) AS completed_not_delivered,
            
            -- Today's deliveries
            COUNT(DISTINCT vehicle_id) FILTER (
                WHERE status = 'Delivered'
                AND DATE(completed_at) = target_date
            ) AS todays_deliveries,
            
            -- Total vehicles in garage (all non-delivered work orders)
            COUNT(DISTINCT vehicle_id) FILTER (
                WHERE status IN ('Pending', 'In Progress', 'Quality Check', 'Ready for Delivery', 'Reopened')
            ) AS total_vehicles_in_garage
        FROM public.work_orders
    )
    SELECT JSON_BUILD_OBJECT(
        'work_orders_placed', COALESCE(work_orders_placed, 0),
        'working_vehicles', COALESCE(working_vehicles, 0),
        'completed_not_delivered', COALESCE(completed_not_delivered, 0),
        'todays_deliveries', COALESCE(todays_deliveries, 0),
        'total_vehicles_in_garage', COALESCE(total_vehicles_in_garage, 0)
    ) INTO metrics
    FROM metrics_data;
    
    RETURN metrics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. TIME SLOT AVAILABILITY RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_time_slot_availability(
    target_date DATE,
    target_time TIME DEFAULT NULL,
    service_type_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    slot_data JSON;
    existing_appointments JSON;
    active_work_orders JSON;
    capacity_limit INTEGER;
    appointment_count INTEGER;
    active_work_count INTEGER;
    total_load INTEGER;
BEGIN
    -- Get capacity limit for this date/time
    SELECT COALESCE(max_appointments_per_day, 20) INTO capacity_limit
    FROM public.capacity_settings
    WHERE is_active = true
    AND setting_type = 'global'
    LIMIT 1;
    
    -- Count appointments scheduled for this date (not yet converted)
    SELECT COUNT(*), JSON_AGG(JSON_BUILD_OBJECT(
        'customer_name', c.name,
        'company_name', c.company_name,
        'vehicle_number', v.vehicle_number,
        'service_type', a.type,
        'status', a.status,
        'scheduled_time', a.scheduled_at
    )) INTO appointment_count, existing_appointments
    FROM public.appointments a
    LEFT JOIN public.customers c ON a.customer_id = c.id
    LEFT JOIN public.vehicles v ON a.vehicle_id = v.id
    WHERE DATE(a.scheduled_at) = target_date
    AND a.status IN ('pending', 'confirmed')
    AND a.status != 'converted';
    
    -- Count active work orders (work in progress on this date)
    SELECT COUNT(*), JSON_AGG(JSON_BUILD_OBJECT(
        'customer_name', c.name,
        'company_name', c.company_name,
        'vehicle_number', v.vehicle_number,
        'service_type', wo.service_type,
        'status', wo.status,
        'current_stage', wo.current_stage
    )) INTO active_work_count, active_work_orders
    FROM public.work_orders wo
    LEFT JOIN public.vehicles v ON wo.vehicle_id = v.id
    LEFT JOIN public.customers c ON v.customer_id = c.id
    WHERE wo.status IN ('Pending', 'In Progress', 'Quality Check', 'Ready for Delivery')
    AND (DATE(wo.started_at) = target_date OR wo.started_at IS NULL);
    
    total_load := COALESCE(appointment_count, 0) + COALESCE(active_work_count, 0);
    
    RETURN JSON_BUILD_OBJECT(
        'available_slots', capacity_limit - total_load,
        'total_capacity', capacity_limit,
        'appointments_scheduled', COALESCE(appointment_count, 0),
        'work_orders_active', COALESCE(active_work_count, 0),
        'total_load', total_load,
        'existing_appointments', COALESCE(existing_appointments, '[]'::JSON),
        'active_work_orders', COALESCE(active_work_orders, '[]'::JSON),
        'is_available', (capacity_limit - total_load) > 0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. SUGGEST AVAILABLE SLOTS RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.suggest_available_slots(
    target_date DATE,
    service_type_id UUID DEFAULT NULL,
    limit_count INTEGER DEFAULT 5
) RETURNS TABLE (
    suggested_date DATE,
    available_slots INTEGER,
    appointments_scheduled INTEGER,
    work_orders_active INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH date_range AS (
        SELECT generate_series(
            target_date,
            target_date + INTERVAL '14 days',
            INTERVAL '1 day'
        )::DATE AS check_date
    ),
    daily_counts AS (
        SELECT 
            dr.check_date,
            COUNT(a.id) FILTER (WHERE a.status IN ('pending', 'confirmed') AND a.status != 'converted') AS appt_count,
            COUNT(DISTINCT wo.vehicle_id) FILTER (WHERE wo.status IN ('Pending', 'In Progress', 'Quality Check', 'Ready for Delivery')) AS wo_count
        FROM date_range dr
        LEFT JOIN public.appointments a ON DATE(a.scheduled_at) = dr.check_date
        LEFT JOIN public.work_orders wo ON (DATE(wo.started_at) = dr.check_date OR wo.started_at IS NULL)
        GROUP BY dr.check_date
    )
    SELECT 
        dc.check_date,
        (20 - COALESCE(dc.appt_count, 0) - COALESCE(dc.wo_count, 0))::INTEGER AS available_slots,
        COALESCE(dc.appt_count, 0)::INTEGER AS appointments_scheduled,
        COALESCE(dc.wo_count, 0)::INTEGER AS work_orders_active
    FROM daily_counts dc
    WHERE (20 - COALESCE(dc.appt_count, 0) - COALESCE(dc.wo_count, 0)) > 0
    ORDER BY (COALESCE(dc.appt_count, 0) + COALESCE(dc.wo_count, 0)) ASC, dc.check_date ASC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. CAPACITY OVERVIEW RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_capacity_overview(
    start_date DATE,
    end_date DATE
) RETURNS TABLE (
    date DATE,
    total_appointments INTEGER,
    confirmed_appointments INTEGER,
    pending_appointments INTEGER,
    active_work_orders INTEGER,
    total_load INTEGER,
    capacity_utilization NUMERIC,
    is_overloaded BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH date_range AS (
        SELECT generate_series(start_date, end_date, INTERVAL '1 day')::DATE AS check_date
    ),
    daily_appointments AS (
        SELECT 
            DATE(scheduled_at) AS appt_date,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed,
            COUNT(*) FILTER (WHERE status = 'pending') AS pending
        FROM public.appointments
        WHERE DATE(scheduled_at) BETWEEN start_date AND end_date
        AND status NOT IN ('cancelled', 'rejected', 'converted')
        GROUP BY DATE(scheduled_at)
    ),
    daily_work_orders AS (
        SELECT 
            DATE(started_at) AS wo_date,
            COUNT(DISTINCT vehicle_id) AS active_wo
        FROM public.work_orders
        WHERE status IN ('Pending', 'In Progress', 'Quality Check', 'Ready for Delivery')
        GROUP BY DATE(started_at)
    )
    SELECT 
        dr.check_date,
        COALESCE(da.total, 0)::INTEGER AS total_appointments,
        COALESCE(da.confirmed, 0)::INTEGER AS confirmed_appointments,
        COALESCE(da.pending, 0)::INTEGER AS pending_appointments,
        COALESCE(dwo.active_wo, 0)::INTEGER AS active_work_orders,
        (COALESCE(da.total, 0) + COALESCE(dwo.active_wo, 0))::INTEGER AS total_load,
        ((COALESCE(da.total, 0) + COALESCE(dwo.active_wo, 0))::NUMERIC / 20 * 100)::NUMERIC AS capacity_utilization,
        ((COALESCE(da.total, 0) + COALESCE(dwo.active_wo, 0)) > 20)::BOOLEAN AS is_overloaded
    FROM date_range dr
    LEFT JOIN daily_appointments da ON dr.check_date = da.appt_date
    LEFT JOIN daily_work_orders dwo ON dr.check_date = dwo.wo_date
    ORDER BY dr.check_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
