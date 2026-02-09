import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testQueueFlip() {
    console.log("--- Testing Employee Queue Flip ---");

    // 1. Find an employee with active work
    const { data: employees } = await supabase.from('employees').select('id, name').limit(10);
    if (!employees || employees.length === 0) return console.log("No employees found");

    let targetEmp = null;
    for (const emp of employees) {
        const { data: workload } = await supabase.rpc('get_employee_active_workload', { p_employee_id: emp.id });
        if (workload && workload.length > 0) {
            targetEmp = emp;
            console.log(`Found target employee: ${emp.name} with ${workload.length} active jobs`);
            console.log("Initial Workload Positions:", workload.map(w => ({ id: w.assignment_id, pos: w.queue_position })));
            break;
        }
    }

    if (!targetEmp) return console.log("No employee with active workload found for test");

    // 2. Simulate assigning them to a new service with position 2
    // We need a dummy service record
    const { data: service } = await supabase.from('work_order_services').select('id').limit(1).single();
    if (!service) return console.log("No services found");

    console.log(`\nSimulating assignment to Service ${service.id} at Position 1...`);

    // Call the RPC that WorkOrderForm uses
    const { error: rpcError } = await supabase.rpc('insert_work_order_service_employee', {
        p_service_id: service.id,
        p_employee_id: targetEmp.id,
        p_status: 'Assigned',
        p_queue_position: 1
    });

    if (rpcError) {
        console.error("RPC Error:", rpcError);
        return;
    }

    // 3. Check workload again
    const { data: finalWorkload } = await supabase.rpc('get_employee_active_workload', { p_employee_id: targetEmp.id });
    console.log("\nWorkload Positions after new assignment at Pos 2:");
    console.log(finalWorkload?.map(w => ({ id: w.assignment_id, pos: w.queue_position })));

    // Cleanup (optional, but good practice to remove the test assignment)
    // Find the new assignment
    const newAssignment = finalWorkload?.find(w => w.service_id === service.id);
    if (newAssignment) {
        await supabase.from('work_order_service_employees').delete().eq('id', newAssignment.assignment_id);
        console.log("\nCleanup: Removed test assignment.");
    }
}

testQueueFlip();
