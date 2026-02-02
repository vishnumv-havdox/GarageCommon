import { supabase } from "@/lib/supabase";

export interface PricingResult {
    calculatedPrice: number;
    basePrice: number;
    appliedRules: Array<{
        name: string;
        modifier_type: 'fixed' | 'percentage' | 'override';
        modifier_value: number;
        task_name?: string;
    }>;
    taskBreakdown?: Array<{
        taskId: string;
        name: string;
        basePrice: number;
        calculatedPrice: number;
        appliedRule?: string;
    }>;
}

/**
 * Pricing Engine: Calculates dynamic service prices based on vehicle and customer context.
 * Logic Hierarchy: Customer Specific > Vehicle Type > Vehicle Category > Service Base Fallback
 */
export const calculateServicePrice = async (
    serviceId: string,
    vehicleId?: string,
    customerId?: string
): Promise<PricingResult> => {
    try {
        // 1. Fetch Service Base Data AND Tasks
        const { data: service, error: sError } = await supabase
            .from('service_types')
            .select(`
                base_price,
                task_templates (
                    id, name, price, is_active
                )
            `)
            .eq('id', serviceId)
            .single();

        if (sError) throw sError;

        // Base Price fallback (if no tasks)
        // If there are tasks, the base price is the sum of tasks.
        // However, the master base_price might be manually set in some future version.
        // For now, we trust the task_templates sum if they exist.

        let basePrice = Number(service.base_price) || 0;
        const tasks = service.task_templates || [];

        // If tasks exist, recalculate base price from tasks to be sure
        if (tasks.length > 0) {
            basePrice = tasks.filter((t: any) => t.is_active).reduce((sum: number, t: any) => sum + (t.price || 0), 0);
        }

        if (!vehicleId && !customerId) {
            return {
                calculatedPrice: basePrice,
                basePrice,
                appliedRules: [],
                taskBreakdown: tasks.map((t: any) => ({
                    taskId: t.id,
                    name: t.name,
                    basePrice: t.price || 0,
                    calculatedPrice: t.price || 0
                }))
            };
        }

        // 2. Resolve Vehicle Context
        let vehicleCategoryId = null;
        let vehicleTypeId = null;

        if (vehicleId) {
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
                .eq('id', vehicleId)
                .single();

            if (vehicle?.vehicle_models) {
                const model = vehicle.vehicle_models as any;
                vehicleTypeId = model.vehicle_type_id;
                vehicleCategoryId = model.vehicle_types?.category_id;
            }
        }

        // 3. Fetch Applicable Pricing Rules
        const { data: rules, error: rError } = await supabase
            .from('pricing_rules')
            .select('*')
            .eq('service_type_id', serviceId)
            .eq('is_active', true)
            .or(`customer_id.eq.${customerId || 'null'},vehicle_type_id.eq.${vehicleTypeId || 'null'},vehicle_category_id.eq.${vehicleCategoryId || 'null'}`)
            .order('priority', { ascending: false });

        if (rError) throw rError;

        // 4. Calculate Price
        // Strategy: 
        // A. If there are Task-Specific Rules, apply them to individual tasks.
        // B. If there is a Service-Level Rule (applies to whole service), it overrides everything else logic-wise if it's an Override, 
        //    or acts as a modifier on the sum.

        // HOWEVER, simplest logic for user:
        // 1. Calculate cost of each task (apply task rules if any)
        // 2. Sum them up.
        // 3. Apply Service-Level rules to the Total (if any).

        let appliedRules: any[] = [];
        let taskBreakdown: any[] = [];
        let runningTotal = 0;

        // Step A: Calculate per-task prices
        if (tasks.length > 0) {
            for (const task of tasks) {
                if (!task.is_active) continue;

                let taskPrice = Number(task.price) || 0;
                let appliedRuleInfo = undefined;

                // Find rule for this task
                const taskRule = rules?.find(r => r.task_template_id === task.id && (
                    r.customer_id === customerId ||
                    r.vehicle_type_id === vehicleTypeId ||
                    r.vehicle_category_id === vehicleCategoryId
                ));

                if (taskRule) {
                    if (taskRule.modifier_type === 'fixed') {
                        taskPrice += Number(taskRule.modifier_value);
                    } else if (taskRule.modifier_type === 'percentage') {
                        taskPrice += (taskPrice * (Number(taskRule.modifier_value) / 100));
                    } else if (taskRule.modifier_type === 'override') {
                        taskPrice = Number(taskRule.modifier_value);
                    }

                    appliedRuleInfo = taskRule.name;
                    appliedRules.push({
                        name: taskRule.name,
                        modifier_type: taskRule.modifier_type,
                        modifier_value: taskRule.modifier_value,
                        task_name: task.name
                    });
                }

                taskBreakdown.push({
                    taskId: task.id,
                    name: task.name,
                    basePrice: task.price || 0,
                    calculatedPrice: taskPrice,
                    appliedRule: appliedRuleInfo
                });
                runningTotal += taskPrice;
            }
        } else {
            runningTotal = basePrice;
        }

        // Step B: Apply Service-Level Rules (Global Overrides)
        // Only look for rules where task_template_id is NULL
        const serviceRules = rules?.filter(r => !r.task_template_id);

        if (serviceRules && serviceRules.length > 0) {
            const bestRule = serviceRules.find(r => r.customer_id === customerId) ||
                serviceRules.find(r => r.vehicle_type_id === vehicleTypeId) ||
                serviceRules.find(r => r.vehicle_category_id === vehicleCategoryId);

            if (bestRule) {
                if (bestRule.modifier_type === 'fixed') {
                    runningTotal += Number(bestRule.modifier_value);
                } else if (bestRule.modifier_type === 'percentage') {
                    runningTotal += (runningTotal * (Number(bestRule.modifier_value) / 100));
                } else if (bestRule.modifier_type === 'override') {
                    runningTotal = Number(bestRule.modifier_value);
                }
                appliedRules.push({
                    name: bestRule.name,
                    modifier_type: bestRule.modifier_type,
                    modifier_value: bestRule.modifier_value,
                    task_name: "Service Level"
                });
            }
        }

        return {
            calculatedPrice: Math.round(runningTotal * 100) / 100,
            basePrice,
            appliedRules,
            taskBreakdown
        };

    } catch (error) {
        console.error("Pricing Engine Error:", error);
        // Safe fallback to base price
        return { calculatedPrice: 0, basePrice: 0, appliedRules: [] };
    }
};
/**
 * Applicability Service: Checks if a service is applicable to a specific vehicle.
 */
export const checkServiceApplicability = async (
    serviceId: string,
    vehicleId: string
): Promise<boolean> => {
    try {
        const { data: vehicle } = await supabase
            .from('vehicles')
            .select(`
        model_id,
        model_id,
        vehicle_models (
          manufacturer_id,
          vehicle_type_id,
          vehicle_types (
            category_id
          )
        )
      `)
            .eq('id', vehicleId)
            .single();

        if (!vehicle?.vehicle_models) return true; // Default to visible if vehicle not resolved

        const model = vehicle.vehicle_models as any;
        const vTypeId = model.vehicle_type_id;
        const vCatId = model.vehicle_types?.category_id;
        const vMfrId = model.manufacturer_id;

        // Fetch applicability mappings for this service
        const { data: mappings } = await supabase
            .from('service_vehicle_applicability')
            .select('*')
            .eq('service_type_id', serviceId);

        // If no mappings exist, default to universal visibility
        if (!mappings || mappings.length === 0) return true;

        // Check if any mapping matches the vehicle context
        // Priority: Type > Category > Manufacturer
        // Logic: specific rule matches if it matches specific ID or if it's universal (null) but we have specific columns now.
        // Actually, the logic is inclusive: The service is APPLICABLE if there is a mapping record that Matches our vehicle.

        return mappings.some(m => {
            // 1. Strict Manufacturer Check: If mapping has manufacturer_id, it MUST match.
            if (m.vehicle_manufacturer_id && m.vehicle_manufacturer_id !== vMfrId) return false;

            // 2. Strict Type/Category Check (as before)
            // If type is specified, it must match.
            if (m.vehicle_type_id && m.vehicle_type_id !== vTypeId) return false;

            // If category is specified, it must match.
            if (m.vehicle_category_id && m.vehicle_category_id !== vCatId) return false;

            // If we passed all defined constraints in this mapping row, it is a match.
            return true;
        });

    } catch (error) {
        console.error("Applicability Check Error:", error);
        return true; // Safe fallback to visible
    }
};
