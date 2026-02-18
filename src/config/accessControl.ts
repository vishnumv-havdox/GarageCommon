/**
 * Centralized Access Control Configuration
 * 
 * This is the single source of truth for authorization rules.
 * All pages and routes should reference this configuration.
 * 
 * Format:
 * - path: The route path
 * - allowedRoles: Array of roles that can access this page
 * - redirectTo: Where to redirect if access is denied
 * - description: Human-readable description
 */

import type { UserRole } from "@/hooks/useAuth";

export interface AccessRule {
  path: string;
  allowedRoles: UserRole[];
  redirectTo: string;
  description: string;
  exact?: boolean;
}

// Define all access rules in one place
export const accessControlConfig: AccessRule[] = [
  // Auth routes (no auth required)
  {
    path: "/auth",
    allowedRoles: [],
    redirectTo: "/dashboard",
    description: "Login page - accessible to all (redirects if logged in)",
    exact: true,
  },
  {
    path: "/inventory/login",
    allowedRoles: [],
    redirectTo: "/inventory/room",
    description: "Inventory Room specialized login",
    exact: true,
  },

  // Dashboard - accessible to all authenticated users
  {
    path: "/dashboard",
    allowedRoles: ["admin", "staff", "customer"],
    redirectTo: "/auth",
    description: "Main dashboard - all authenticated users",
  },

  // Admin routes
  {
    path: "/admin",
    allowedRoles: ["admin", "manager"],
    redirectTo: "/dashboard",
    description: "Admin dashboard",
    exact: true,
  },
  {
    path: "/admin/users",
    allowedRoles: ["admin"],
    redirectTo: "/dashboard",
    description: "User management - admins only",
  },
  {
    path: "/admin/employees",
    allowedRoles: ["admin"],
    redirectTo: "/dashboard",
    description: "Employee management - admins only",
  },
  {
    path: "/admin/customers",
    allowedRoles: ["admin", "manager"],
    redirectTo: "/dashboard",
    description: "Customer management - admin and manager",
  },
  {
    path: "/admin/vehicles",
    allowedRoles: ["admin", "manager"],
    redirectTo: "/dashboard",
    description: "Vehicle management - admin and manager only",
  },
  {
    path: "/admin/work-orders",
    allowedRoles: ["admin", "manager"],
    redirectTo: "/dashboard",
    description: "Work order management - admin and manager only",
  },
  {
    path: "/admin/work-orders/:id",
    allowedRoles: ["admin", "manager"],
    redirectTo: "/dashboard",
    description: "Work order detail view",
  },
  {
    path: "/admin/analytics",
    allowedRoles: ["admin"],
    redirectTo: "/dashboard",
    description: "Company performance analytics - admins only",
  },
  {
    path: "/admin/progress",
    allowedRoles: ["admin", "manager", "staff"],
    redirectTo: "/dashboard",
    description: "Work order progress tracking - admin, manager, and staff",
  },
  {
    path: "/admin/inventory",
    allowedRoles: ["admin"],
    redirectTo: "/dashboard",
    description: "Inventory management - admins only",
  },
  {
    path: "/admin/invoices",
    allowedRoles: ["admin", "manager", "staff"],
    redirectTo: "/dashboard",
    description: "Invoice management - admin, manager, and staff",
  },
  {
    path: "/admin/invoices/:id",
    allowedRoles: ["admin", "manager", "staff"],
    redirectTo: "/dashboard",
    description: "Invoice Editor - admin, manager, and staff",
  },
  {
    path: "/admin/invoice-analytics",
    allowedRoles: ["admin", "manager"],
    redirectTo: "/dashboard",
    description: "Invoice Analytics and Financial Insights - admin and manager",
  },
  {
    path: "/admin/analytics-dashboard",
    allowedRoles: ["admin", "manager"],
    redirectTo: "/dashboard",
    description: "Unified Customer & Vehicle Analytics - admin and manager",
  },
  {
    path: "/admin/customers/:id/ledger",
    allowedRoles: ["admin", "manager"],
    redirectTo: "/dashboard",
    description: "Detailed Customer Ledger and Financial History",
  },
  {
    path: "/admin/ledger",
    allowedRoles: ["admin", "manager"],
    redirectTo: "/dashboard",
    description: "Customer Ledger Overview",
  },
  {
    path: "/admin/access-control",
    allowedRoles: ["admin"],
    redirectTo: "/dashboard",
    description: "Access control settings - admins only",
  },
  {
    path: "/admin/attendance",
    allowedRoles: ["admin", "manager"],
    redirectTo: "/dashboard",
    description: "Attendance management - admin and manager only",
  },
  {
    path: "/admin/salary",
    allowedRoles: ["admin", "manager"],
    redirectTo: "/dashboard",
    description: "Salary and payout management - admin and manager only",
  },
  {
    path: "/admin/services",
    allowedRoles: ["admin", "manager"],
    redirectTo: "/dashboard",
    description: "Services Master management - admin and manager",
  },
  {
    path: "/admin/booking-catalog",
    allowedRoles: ["admin", "manager"],
    redirectTo: "/dashboard",
    description: "Customer-facing Service Catalog",
  },
  {
    path: "/admin/appointments",
    allowedRoles: ["admin", "manager"],
    redirectTo: "/dashboard",
    description: "Appointment Management",
  },

  {
    path: "/admin/requests",
    allowedRoles: ["admin", "manager"],
    redirectTo: "/dashboard",
    description: "Request Inbox - Pending Approvals",
  },
  {
    path: "/admin/requests/confirmation",
    allowedRoles: ["admin", "manager"],
    redirectTo: "/dashboard",
    description: "Request Approval Confirmation",
  },
  {
    path: "/admin/settings",
    allowedRoles: ["admin", "manager"],
    redirectTo: "/dashboard",
    description: "Company profile and document settings - admin and manager",
  },
  {
    path: "/inventory",
    allowedRoles: ["admin", "manager"],
    redirectTo: "/dashboard",
    description: "Inventory management shortcut",
  },
  {
    path: "/inventory/room",
    allowedRoles: ["admin", "manager", "staff"],
    redirectTo: "/dashboard",
    description: "Physical inventory room scanning - staff access",
  },

  // Staff routes
  {
    path: "/staff",
    allowedRoles: ["staff"],
    redirectTo: "/dashboard",
    description: "Staff dashboard",
    exact: true,
  },
  {
    path: "/staff/attendance",
    allowedRoles: ["staff", "admin", "manager"],
    redirectTo: "/dashboard",
    description: "Staff self-service attendance",
    exact: true,
  },

  // Customer routes
  {
    path: "/customer",
    allowedRoles: ["customer"],
    redirectTo: "/dashboard",
    description: "Customer portal",
    exact: true,
  },

  // Catch-all
  {
    path: "*",
    allowedRoles: [],
    redirectTo: "/dashboard",
    description: "404 page - redirects to dashboard",
  },
];

/**
 * Get access rule for a specific path
 */
export function getAccessRule(path: string): AccessRule | undefined {
  // First try to find exact match
  const exactMatch = accessControlConfig.find(
    rule => rule.exact && rule.path === path
  );
  if (exactMatch) return exactMatch;

  // Then try prefix match
  return accessControlConfig.find(
    rule => !rule.exact && path.startsWith(rule.path)
  );
}

/**
 * Check if a role has access to a path
 */
export function hasAccess(path: string, role: UserRole | undefined): boolean {
  const rule = getAccessRule(path);
  if (!rule) return false;
  if (rule.allowedRoles.length === 0) return true; // No role required
  return rule.allowedRoles.includes(role as UserRole);
}

/**
 * Get redirect path for unauthorized access
 */
export function getRedirectPath(path: string, userRole: UserRole | undefined): string {
  const rule = getAccessRule(path);
  if (!rule) return "/dashboard";

  // If no role required, no redirect needed
  if (rule.allowedRoles.length === 0) return "";

  // If user has no role, redirect to auth
  if (!userRole) return "/auth";

  // User has a role but not allowed - check if they have any access
  // Return the most privileged route they can access
  if (userRole === "admin") return "/admin";
  if (userRole === "manager") return "/admin";
  if (userRole === "staff") return "/staff";
  if (userRole === "customer") return "/customer";

  return rule.redirectTo;
}

/**
 * Get all routes accessible by a role
 */
export function getAccessibleRoutes(role: UserRole): AccessRule[] {
  return accessControlConfig.filter(
    rule => rule.allowedRoles.length === 0 || rule.allowedRoles.includes(role)
  );
}

/**
 * Navigation items based on user role
 */
export interface NavItem {
  label: string;
  path: string;
  icon?: React.ElementType;
  roles: UserRole[];
  end?: boolean;
}

export const navConfig: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", roles: ["admin", "staff", "customer"], end: true },
  { label: "Inbox", path: "/admin/requests", icon: Inbox, roles: ["admin", "manager"] },
  { label: "Appointments", path: "/admin/appointments", icon: Calendar, roles: ["admin", "manager"] },
  { label: "Users", path: "/admin/users", icon: Shield, roles: ["admin"] },
  { label: "Employees", path: "/admin/employees", icon: UserCog, roles: ["admin"] },
  { label: "Customers", path: "/admin/customers", icon: Users, roles: ["admin", "manager"] },
  { label: "Vehicles", path: "/admin/vehicles", icon: Truck, roles: ["admin", "manager"] },
  { label: "Work Orders", path: "/admin/work-orders", icon: FileText, roles: ["admin", "manager"] },
  { label: "Ledger", path: "/admin/ledger", icon: BookText, roles: ["admin", "manager"] },
  { label: "Performance", path: "/admin/analytics", icon: BarChart3, roles: ["admin"] },
  { label: "Progress", path: "/admin/progress", icon: Activity, roles: ["admin", "manager", "staff"] },
  { label: "Inventory", path: "/admin/inventory", icon: Package, roles: ["admin"] },
  { label: "Inventory Room", path: "/inventory/room", icon: QrCode, roles: ["admin", "manager"] },
  { label: "Invoices", path: "/admin/invoices", icon: Receipt, roles: ["admin", "manager", "staff"] },
  { label: "Financials", path: "/admin/invoice-analytics", icon: BarChart3, roles: ["admin", "manager"] },
  { label: "360° Analytics", path: "/admin/analytics-dashboard", icon: PieChart, roles: ["admin", "manager"] },
  { label: "Configuration", path: "/admin/settings", icon: Settings, roles: ["admin", "manager"] },
  { label: "Attendance", path: "/admin/attendance", icon: CalendarCheck, roles: ["admin", "manager"] },
  { label: "Salary & Payouts", path: "/admin/salary", icon: Banknote, roles: ["admin", "manager"] },
  { label: "Services Master", path: "/admin/services", icon: Wrench, roles: ["admin", "manager"] },
  { label: "Booking Catalog", path: "/admin/booking-catalog", icon: BookOpen, roles: ["admin", "manager"] },
  { label: "Access Control", path: "/admin/access-control", icon: Shield, roles: ["admin"] },
  { label: "Staff Portal", path: "/staff", icon: Briefcase, roles: ["staff"] },
  { label: "Attendance", path: "/staff/attendance", icon: CalendarCheck, roles: ["staff"] },
  { label: "My Portal", path: "/customer", icon: User, roles: ["customer"] },
];

// Import icons
import {
  Shield, UserCog, Users, Truck, FileText, Package, Receipt,
  Briefcase, User, Settings, Activity, BarChart3, PieChart, QrCode,
  CalendarCheck, Banknote, Wrench, Inbox, BookText, BookOpen, Calendar
} from "lucide-react";
