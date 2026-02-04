-- Create RPC function to approve all pending staff assignments for a work order at once
-- This eliminates the need to approve each assignment individually

CREATE OR REPLACE FUNCTION public.approve_all_pending_assignments(
    p_work_order_id uuid,
    p_approver_id uuid
)
RETURNS TABLE (
    approved_count integer,
    assignment_ids uuid[]
) AS $$
DECLARE
    v_approved_count integer;
    v_assignment_ids uuid[];
BEGIN
    -- Update all pending assignments for this work order
    WITH updated AS (
        UPDATE public.work_order_service_employees
        SET 
            status = 'Accepted',
            accepted_at = now(),
            accepted_by = p_approver_id
        WHERE service_id IN (
            SELECT id 
            FROM public.work_order_services 
            WHERE work_order_id = p_work_order_id
        )
        AND status = 'Pending'
        RETURNING id
    )
    SELECT 
        COUNT(*)::integer,
        ARRAY_AGG(id)
    INTO v_approved_count, v_assignment_ids
    FROM updated;

    -- Return the count and IDs of approved assignments
    RETURN QUERY SELECT v_approved_count, v_assignment_ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.approve_all_pending_assignments(uuid, uuid) TO authenticated;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
