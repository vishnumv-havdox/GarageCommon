
import { createClient } from '@supabase/supabase-client'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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

    // 4. Try calling the RPC manually (dry run check)
    // We'll just look at what it WOULD do if we ran it for a broad range
    console.log("----------------------------------");
}

debugPayouts();
