/**
 * ============================================================
 * CENTRALIZED USER CREATION SYSTEM
 * ============================================================
 * 
 * This is the SINGLE SOURCE OF TRUTH for user creation.
 * All pages (Users, Employees, Customers) use this config.
 * 
 * KEY PRINCIPLES:
 * - Each page creates ONE specific user type
 * - Role is AUTO-ASSIGNED (no manual selection)
 * - Auth user + role + profile created together
 * - Linked to appropriate table with user_id
 */

import type { UserRole } from "@/hooks/useAuth";

// ============================================================
// USER TYPE DEFINITIONS
// ============================================================

export type UserType = "admin" | "employee" | "customer";

export interface UserCreationConfig {
  userType: UserType;
  displayName: string;
  role: UserRole;           // Auto-assigned role
  authTable: string;        // Where auth metadata goes (profiles)
  linkTable: string;        // Where domain data goes
  linkColumn: string;       // Column to link auth user
  authMetaField: string;    // Field name in user_metadata
  description: string;
}

// ============================================================
// CENTRALIZED CONFIGURATION
// ============================================================

export const userCreationConfig: Record<UserType, UserCreationConfig> = {
  admin: {
    userType: "admin",
    displayName: "Admin User",
    role: "admin",
    authTable: "profiles",
    linkTable: "profiles",
    linkColumn: "id",
    authMetaField: "full_name",
    description: "System administrators with full access",
  },
  employee: {
    userType: "employee",
    displayName: "Employee",
    role: "staff",
    authTable: "profiles",
    linkTable: "employees",
    linkColumn: "user_id",
    authMetaField: "name",
    description: "Staff members with limited access",
  },
  customer: {
    userType: "customer",
    displayName: "Customer",
    role: "customer",
    authTable: "profiles",
    linkTable: "customers",
    linkColumn: "user_id",
    authMetaField: "name",
    description: "Customers with portal access only",
  },
};

// ============================================================
// PAGE TO USER TYPE MAPPING
// ============================================================

// Which user type each page creates
export const pageUserType: Record<string, UserType> = {
  "/admin/users": "admin",      // Users page → only admins
  "/admin/employees": "employee", // Employees page → only staff
  "/admin/customers": "customer", // Customers page → only customers
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get config for a specific user type
 */
export function getUserConfig(userType: UserType): UserCreationConfig {
  const config = userCreationConfig[userType];
  if (!config) {
    throw new Error(`Invalid user type: ${userType}`);
  }
  return config;
}

/**
 * Get config for current page
 */
export function getPageUserConfig(pathname: string): UserCreationConfig | null {
  const userType = pageUserType[pathname];
  if (!userType) return null;
  return getUserConfig(userType);
}

/**
 * Get allowed roles for a user type (always single role)
 */
export function getAllowedRoles(userType: UserType): UserRole[] {
  return [getUserConfig(userType).role];
}

/**
 * Check if role is allowed for user type
 */
export function isRoleAllowed(userType: UserType, role: UserRole): boolean {
  return getUserConfig(userType).role === role;
}

// ============================================================
// USER CREATION WORKFLOW
// ============================================================

export interface CreateUserResult {
  success: boolean;
  authUserId?: string;
  error?: string;
}

/**
 * Centralized user creation workflow
 * Handles: Auth user → Role assignment → Profile → Domain table
 */
export async function createUser(
  userType: UserType,
  data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    // Employee-specific
    positionId?: string;
    accessLevel?: "admin" | "manager" | "staff";
    salary?: number;
    // Customer-specific
    companyName?: string;
    address?: string;
    attendanceSelfService?: boolean;
  },
  supabaseAdmin: any
): Promise<CreateUserResult> {
  const config = getUserConfig(userType);

  try {
    // Step 1: Create auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        [config.authMetaField]: data.fullName,
        phone: data.phone || "",
      },
    });

    if (authError) {
      return { success: false, error: authError.message };
    }

    const userId = authUser.user.id;

    // Step 2: Assign role in user_roles (use upsert to handle duplicates)
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({
        user_id: userId,
        role: config.role,
      }, { onConflict: 'user_id' });

    if (roleError) {
      return { success: false, error: `Auth created but role failed: ${roleError.message}` };
    }

    // Step 3: Create profile record (use upsert to handle duplicates)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        email: data.email,
        full_name: data.fullName,
        phone: data.phone || null,
      }, { onConflict: 'id' });

    if (profileError) {
      return { success: false, error: `Auth+role created but profile failed: ${profileError.message}` };
    }

    // Step 4: Create domain-specific record (use upsert to handle duplicates)
    if (userType === "employee") {
      const { error: employeeError } = await supabaseAdmin
        .from("employees")
        .upsert({
          user_id: userId,
          name: data.fullName,
          email: data.email,
          phone: data.phone || null,
          position_id: data.positionId,
          access_level: data.accessLevel || "staff",
          salary: data.salary || null,
          status: "active",
          attendance_self_service: data.attendanceSelfService || false,
        }, { onConflict: 'user_id' });

      if (employeeError) {
        return { success: false, error: `Auth+role+profile created but employee failed: ${employeeError.message}` };
      }
    } else if (userType === "customer") {
      const { error: customerError } = await supabaseAdmin
        .from("customers")
        .upsert({
          user_id: userId,
          name: data.fullName,
          email: data.email,
          phone: data.phone || null,
          company_name: data.companyName || null,
          address: data.address || null,
        }, { onConflict: 'user_id' });

      if (customerError) {
        return { success: false, error: `Auth+role+profile created but customer failed: ${customerError.message}` };
      }
    }
    // admin: No additional table (already in profiles)

    return { success: true, authUserId: userId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Update existing user across all tables
 */
export async function updateUser(
  userType: UserType,
  userId: string,
  data: {
    email?: string;
    fullName?: string;
    phone?: string;
    password?: string;
    // Employee-specific
    positionId?: string;
    accessLevel?: "admin" | "manager" | "staff";
    salary?: number;
    address?: string;
    joiningDate?: string;
    emergencyContact?: string;
    aadhaarNumber?: string;
    panNumber?: string;
    dateOfBirth?: string;
    bloodGroup?: string;
    payType?: string;
    // Customer-specific
    companyName?: string;
    address_customer?: string;
    attendanceSelfService?: boolean;
  },
  supabaseAdmin: any
): Promise<CreateUserResult> {
  const config = getUserConfig(userType);

  try {
    // Step 1: Update auth user metadata or password if needed
    if (data.fullName || data.phone || data.email || data.password) {
      const updateData: any = {};
      if (data.fullName) updateData.user_metadata = { ...updateData.user_metadata, [config.authMetaField]: data.fullName };
      if (data.phone) updateData.user_metadata = { ...updateData.user_metadata, phone: data.phone };
      if (data.email) updateData.email = data.email;
      if (data.password) updateData.password = data.password;

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);
      if (authError) return { success: false, error: authError.message };
    }

    // Step 2: Update role if access level changed (for employees)
    if (userType === "employee" && data.accessLevel) {
      // NOTE: We keep the auth role as 'staff' but the domain access_level can vary
      // In this system, user_roles.role stays 'staff', but employees.access_level defines granular permissions
    }

    // Step 3: Update profile
    if (data.fullName || data.email || data.phone) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          email: data.email,
          full_name: data.fullName,
          phone: data.phone,
        })
        .eq("id", userId);
      if (profileError) return { success: false, error: profileError.message };
    }

    // Step 4: Update domain-specific table
    if (userType === "employee") {
      const { error: employeeError } = await supabaseAdmin
        .from("employees")
        .update({
          name: data.fullName,
          email: data.email,
          phone: data.phone,
          position_id: data.positionId,
          access_level: data.accessLevel,
          salary: data.salary,
          address: data.address,
          joining_date: data.joiningDate,
          emergency_contact: data.emergencyContact,
          aadhaar_number: data.aadhaarNumber,
          pan_number: data.panNumber,
          date_of_birth: data.dateOfBirth,
          blood_group: data.bloodGroup,
          pay_type: data.payType,
          attendance_self_service: data.attendanceSelfService,
        })
        .eq("user_id", userId);

      if (employeeError) return { success: false, error: employeeError.message };
    } else if (userType === "customer") {
      const { error: customerError } = await supabaseAdmin
        .from("customers")
        .update({
          name: data.fullName,
          email: data.email,
          phone: data.phone,
          company_name: data.companyName,
          address: data.address_customer,
        })
        .eq("user_id", userId);

      if (customerError) return { success: false, error: customerError.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================================
// PAGE-SPECIFIC FIELD CONFIGURATIONS
// ============================================================

export interface FieldConfig {
  name: string;
  label: string;
  required: boolean;
  type?: string;
  placeholder?: string;
  options?: { value: string; label: string }[]; // For select
}

export function getPageFields(userType: UserType): FieldConfig[] {
  const baseFields: FieldConfig[] = [
    { name: "fullName", label: "Full Name", required: true, placeholder: "Enter full name" },
    { name: "email", label: "Email", required: true, type: "email", placeholder: "Enter email" },
    { name: "password", label: "Password", required: true, type: "password", placeholder: "Min 6 characters" },
    { name: "phone", label: "Phone", required: false, type: "tel", placeholder: "Phone number" },
  ];

  if (userType === "employee") {
    return [
      ...baseFields,
      { name: "positionId", label: "Position", required: true, options: [] }, // Options populated from positions table
      {
        name: "accessLevel", label: "Access Level", required: true, options: [
          { value: "staff", label: "Staff" },
          { value: "manager", label: "Manager" },
          // Admin NOT included for employees
        ]
      },
      { name: "salary", label: "Monthly Salary", required: false, type: "number", placeholder: "Salary" },
      { name: "joiningDate", label: "Joining Date", required: true, type: "date" },
      { name: "address", label: "Address", required: false, type: "textarea", placeholder: "Full address" },
      { name: "emergencyContact", label: "Emergency Contact", required: false, placeholder: "Name & Phone" },
      { name: "aadhaarNumber", label: "Aadhaar Card", required: false, placeholder: "12-digit Aadhaar" },
      { name: "panNumber", label: "PAN Card", required: false, placeholder: "PAN number" },
      { name: "dateOfBirth", label: "Date of Birth", required: false, type: "date" },
      { name: "bloodGroup", label: "Blood Group", required: false, placeholder: "e.g., A+ve" },
    ];
  }

  if (userType === "customer") {
    return [
      ...baseFields,
      { name: "companyName", label: "Company Name", required: false, placeholder: "Company name" },
      { name: "address", label: "Address", required: false, type: "textarea", placeholder: "Full address" },
    ];
  }

  // admin: Only base fields (no extra fields)
  return baseFields;
}

// ============================================================
// ACCESS CONTROL INTEGRATION
// ============================================================

export function getAccessControlInfo(userType: UserType) {
  const config = getUserConfig(userType);

  return {
    role: config.role,
    routes: [
      { path: "/admin", access: ["admin"] },
      { path: "/admin/users", access: ["admin"] },
      { path: "/admin/employees", access: ["admin"] },
      { path: "/admin/customers", access: ["admin", "staff"] },
      { path: "/admin/vehicles", access: ["admin", "staff"] },
      { path: "/admin/work-orders", access: ["admin", "staff"] },
      { path: "/admin/inventory", access: ["admin"] },
      { path: "/admin/invoices", access: ["admin", "staff"] },
      { path: "/staff", access: ["staff"] },
      { path: "/customer", access: ["customer"] },
    ],
  };
}
