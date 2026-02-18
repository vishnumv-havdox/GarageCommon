import { supabase } from "@/integrations/supabase/client";

export interface DuplicatePhoneResult {
    isDuplicate: boolean;
    existingUser?: {
        id: string;
        name: string;
        phone: string;
        type: 'customer' | 'employee' | 'driver';
        email?: string;
        company_name?: string;
    };
}

/**
 * Check if a phone number is already used in the system
 * Searches across customers, employees, and drivers
 */
export async function checkDuplicatePhone(phone: string): Promise<DuplicatePhoneResult> {
    const cleaned = phone.replace(/\D/g, '');

    if (cleaned.length !== 10) {
        return { isDuplicate: false };
    }

    try {
        // Check customers
        const { data: customers } = await supabase
            .from('customers')
            .select('id, name, phone, email, company_name')
            .eq('phone', cleaned)
            .limit(1);

        if (customers && customers.length > 0) {
            return {
                isDuplicate: true,
                existingUser: {
                    id: customers[0].id,
                    name: customers[0].name,
                    phone: customers[0].phone,
                    type: 'customer',
                    email: customers[0].email,
                    company_name: customers[0].company_name
                }
            };
        }

        // Check employees
        const { data: employees } = await supabase
            .from('employees')
            .select('id, name, phone, email')
            .eq('phone', cleaned)
            .limit(1);

        if (employees && employees.length > 0) {
            return {
                isDuplicate: true,
                existingUser: {
                    id: employees[0].id,
                    name: employees[0].name,
                    phone: employees[0].phone,
                    type: 'employee',
                    email: employees[0].email
                }
            };
        }

        // Check drivers
        const { data: drivers } = await supabase
            .from('drivers')
            .select('id, name, contact_number')
            .eq('contact_number', cleaned)
            .eq('is_active', true)
            .limit(1);

        if (drivers && drivers.length > 0) {
            return {
                isDuplicate: true,
                existingUser: {
                    id: drivers[0].id,
                    name: drivers[0].name,
                    phone: drivers[0].contact_number,
                    type: 'driver'
                }
            };
        }

        return { isDuplicate: false };
    } catch (error) {
        console.error('Error checking duplicate phone:', error);
        return { isDuplicate: false };
    }
}
