
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SURL = process.env.VITE_SUPABASE_URL || "";
const SKEY = process.env.VITE_SUPABASE_ANON_KEY || "";

if (!SURL || !SKEY) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(SURL, SKEY);

const WORK_ORDER_ID = "6b009cad-8653-4410-936d-c51e6515a966";

async function main() {
    console.log("Checking stages for WO:", WORK_ORDER_ID);

    // 1. Fetch current stages
    const { data: stages, error } = await supabase
        .from('work_order_stages')
        .select('*')
        .eq('work_order_id', WORK_ORDER_ID)
        .order('created_at');

    if (error) {
        console.error("Fetch error:", error);
        return;
    }

    console.table(stages);

    // 2. Try RPC
    console.log("\nCalling update_work_order_stage RPC...");
    const { error: rpcError } = await supabase.rpc('update_work_order_stage', {
        p_work_order_id: WORK_ORDER_ID,
        p_completed_stages: ['Inspection'],
        p_approver_id: null
    });

    if (rpcError) {
        console.error("RPC Error:", rpcError);
    } else {
        console.log("RPC Success (204)");
    }

    // 3. Fetch again
    const { data: stages2 } = await supabase
        .from('work_order_stages')
        .select('*')
        .eq('work_order_id', WORK_ORDER_ID)
        .order('created_at');

    console.table(stages2);
}

main();
