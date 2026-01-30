
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugPayouts() {
    console.log("--- Payout System Diagnostics ---");

    // 1. Check Employees
    const { data: employees, error: empErr } = await supabase.from('employees').select('id, name, status');
    console.log(`Total Employees: ${employees?.length || 0}`);
    console.log("Employees Sample:", employees?.slice(0, 3));

    // 2. Check Salary Configs
    const { data: configs, error: confErr } = await supabase.from('employee_salary_configs').select('*');
    if (confErr) {
        console.error("Error fetching configs:", confErr);
    } else {
        console.log(`Total Salary Configs: ${configs.length}`);
        console.log("Configs Sample:", configs.slice(0, 3));
    }

    // 3. Check Payouts
    const { data: payouts, error: payErr } = await supabase.from('employee_payouts').select('*');
    if (payErr) {
        console.error("Error fetching payouts:", payErr);
    } else {
        console.log(`Total Payouts in DB: ${payouts.length}`);
    }

    // 4. Check Work Orders (Delivered status)
    const { count: deliveredCount } = await supabase.from('work_orders').select('*', { count: 'exact', head: true }).eq('status', 'delivered');
    console.log(`Total 'delivered' Work Orders: ${deliveredCount}`);

    console.log("----------------------------------");
}

debugPayouts();
