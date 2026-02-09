
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qyfihvkpqrzuskjzqhzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5ZmlodmtwcXJ6dXNranpxaHpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDU2MTg3NSwiZXhwIjoyMDgwMTM3ODc1fQ.Hgp6YQ_NwO7No7iGud9uQgMnXl3lGoPM0p4kN9B_SRU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectServices() {
    console.log("Inspecting 'work_order_services' table...");
    const { data, error } = await supabase
        .from('work_order_services')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching services:", error);
    } else {
        console.log("Service Record Sample:", data);
        if (data && data.length > 0) {
            console.log("Keys:", Object.keys(data[0]));
        }
    }
}

inspectServices();
