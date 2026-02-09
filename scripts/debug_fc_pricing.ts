import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugPricing() {
    console.log("--- Debugging Pricing for 'FC - Full Painting' ---");

    // 1. Find Service
    const { data: allServices } = await supabase
        .from('service_types')
        .select('*');

    console.log("All Services:", allServices?.map(s => s.name));

    const { data: services } = await supabase
        .from('service_types')
        .select('*')
        .eq('name', 'FC - Full Painting');

    if (!services || services.length === 0) {
        console.log("Service not found");
        return;
    }

    const service = services[0];
    console.log("Service Found:", { id: service.id, name: service.name, base_price: service.base_price });

    // 2. Find Tasks
    const { data: tasks } = await supabase
        .from('task_templates')
        .select('*')
        .eq('service_type_id', service.id);

    console.log("\nTasks Found:", tasks?.map(t => ({ id: t.id, name: t.name, price: t.price })));

    // 3. Find Pricing Rules for this service
    const { data: rules } = await supabase
        .from('pricing_rules')
        .select(`
            *,
            task_templates(name),
            vehicle_categories(name)
        `)
        .eq('service_type_id', service.id);

    console.log("\nPricing Rules Found for Service:", rules?.map(r => ({
        id: r.id,
        task_name: (r.task_templates as any)?.name,
        category: (r.vehicle_categories as any)?.name,
        modifier: r.modifier_type,
        value: r.modifier_value
    })));

    // 4. Find all Truck categories
    const { data: cats } = await supabase
        .from('vehicle_categories')
        .select('*')
        .ilike('name', '%Truck%');

    console.log("\nTruck Categories Found:", cats?.map(c => ({ id: c.id, name: c.name })));

    if (cats && cats.length > 0) {
        const cId = cats[0].id;

        // Find a vehicle of this category
        const { data: vList } = await supabase
            .from('vehicles')
            .select(`
                id,
                vehicle_number,
                vehicle_models!inner (
                    vehicle_types!inner (
                        category_id
                    )
                )
            `)
            .eq('vehicle_models.vehicle_types.category_id', cId)
            .limit(1);

        if (vList && vList.length > 0) {
            const vId = vList[0].id;
            console.log(`\nFound Truck Vehicle: ${vList[0].vehicle_number} (ID: ${vId})`);

            // NOW RUN THE EXACT ENGINE RESOLUTION LOGIC
            const { data: vehicle } = await supabase
                .from('vehicles')
                .select(`
                    model_id,
                    vehicle_models (
                        vehicle_type_id,
                        vehicle_types (
                            category_id
                        )
                    )
                `)
                .eq('id', vId)
                .single();

            console.log("\nRaw Vehicle Data from Engine Query:", JSON.stringify(vehicle, null, 2));

            if (vehicle?.vehicle_models) {
                const rawModel = vehicle.vehicle_models;
                const model = Array.isArray(rawModel) ? rawModel[0] : rawModel;
                const vTypeId = model?.vehicle_type_id;

                const rawType = model?.vehicle_types;
                const vType = Array.isArray(rawType) ? rawType[0] : rawType;
                const vCatId = vType?.category_id;

                console.log("\nResolved for Pricing:", {
                    vTypeId,
                    vCatId,
                    expectedCatId: cId
                });
            }
        } else {
            console.log("\nNo vehicles found for Truck category.");
        }
    }
}

debugPricing();
