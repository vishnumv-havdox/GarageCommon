
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

// Load environment variables (you might need to adjust path or hardcode for test)
// Assuming .env is in project root
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://qyfihvkpqrzuskjzqhzd.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "YOUR_ANON_KEY_HERE_IF_NOT_IN_ENV";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
    console.log("Testing simplified work_orders query...");

    // 1. Check if we can fetch work_orders with driver_id column
    const { data: simpleData, error: simpleError } = await supabase
        .from("work_orders")
        .select("id, driver_id")
        .limit(1);

    if (simpleError) {
        console.error("Error fetching simple data (driver_id check):", simpleError);
    } else {
        console.log("Simple data fetched successfully:", simpleData);
    }

    // 2. Check the relationship query
    console.log("Testing relationship query...");
    const { data: relData, error: relError } = await supabase
        .from("work_orders")
        .select(`
        id,
        driver:drivers(name)
    `)
        .limit(1);

    if (relError) {
        console.error("Error fetching relationship data:", relError);
    } else {
        console.log("Relationship data fetched successfully:", relData);
    }
}

testQuery();
