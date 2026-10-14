export type ExpenseCategory =
  | "rent_utilities"
  | "local_spares"
  | "tools_equipment"
  | "petty_cash"
  | "fuel_transport"
  | "outside_jobwork"
  | "staff_welfare"
  | "miscellaneous";

export type PaymentMode = "cash" | "upi" | "bank_transfer" | "card" | "cheque";
export type SpenderType = "garage" | "employee" | "custom";

export interface ExpenseCategoryMeta {
  key: ExpenseCategory;
  label: string;
  iconName: string;
  color: string;
  bgColor: string;
  description: string;
}

export interface GarageExpense {
  id: string;
  expense_number?: string;
  category: ExpenseCategory;
  title: string;
  amount: number;
  payment_mode: PaymentMode;
  vendor_name?: string;
  expense_date: string; // YYYY-MM-DD
  receipt_url?: string;
  receipt_name?: string;
  receipt_type?: string;
  work_order_id?: string;
  work_order_label?: string;

  // Employee / Spender tracking
  spent_by_type?: SpenderType;
  employee_id?: string;
  employee_name?: string;
  employee_phone?: string;
  is_reimbursed?: boolean;
  reimbursed_at?: string;

  notes?: string;
  created_at: string;
  created_by?: string;
}

export interface ExpenseFormData {
  category: ExpenseCategory;
  title: string;
  amount: number;
  payment_mode: PaymentMode;
  vendor_name?: string;
  expense_date: string;
  receipt_url?: string;
  receipt_name?: string;
  receipt_type?: string;
  work_order_id?: string;

  // Employee / Spender tracking
  spent_by_type?: SpenderType;
  employee_id?: string;
  employee_name?: string;
  employee_phone?: string;
  is_reimbursed?: boolean;

  notes?: string;
}

export const EXPENSE_CATEGORIES: ExpenseCategoryMeta[] = [
  {
    key: "rent_utilities",
    label: "Rent & Utilities",
    iconName: "Building2",
    color: "#3b82f6",
    bgColor: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
    description: "Garage rent, electricity (EB), water, internet bills",
  },
  {
    key: "local_spares",
    label: "Local Spares & Parts",
    iconName: "Package",
    color: "#f59e0b",
    bgColor: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
    description: "Urgent auto parts, brake pads, fluids, consumables bought locally",
  },
  {
    key: "tools_equipment",
    label: "Tools & Equipment",
    iconName: "Wrench",
    color: "#8b5cf6",
    bgColor: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300",
    description: "Diagnostic tools, lift servicing, air compressor, hand tools",
  },
  {
    key: "petty_cash",
    label: "Petty Cash & Refreshments",
    iconName: "Coffee",
    color: "#10b981",
    bgColor: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
    description: "Daily tea, snacks, drinking water, workshop cleaning supplies",
  },
  {
    key: "fuel_transport",
    label: "Fuel & Conveyance",
    iconName: "Fuel",
    color: "#ef4444",
    bgColor: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300",
    description: "Customer pickup fuel, parts delivery bike petrol, freight",
  },
  {
    key: "outside_jobwork",
    label: "Outside Job Work",
    iconName: "Layers",
    color: "#06b6d4",
    bgColor: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300",
    description: "Lathe machining, head facing, radiator repair, outside AC gas",
  },
  {
    key: "staff_welfare",
    label: "Staff Welfare & Meals",
    iconName: "Users",
    color: "#ec4899",
    bgColor: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300",
    description: "Mechanic overtime meals, staff uniforms, safety gear",
  },
  {
    key: "miscellaneous",
    label: "Miscellaneous",
    iconName: "HelpCircle",
    color: "#6b7280",
    bgColor: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
    description: "Other general workshop expenses",
  },
];
