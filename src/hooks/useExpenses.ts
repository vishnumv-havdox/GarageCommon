import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { GarageExpense, ExpenseFormData, EXPENSE_CATEGORIES } from "@/types/expenses";

const LOCAL_STORAGE_KEY = "amma_garage_expenses_cache_v2";

const DEFAULT_INITIAL_EXPENSES: GarageExpense[] = [
  {
    id: "init-exp-1",
    expense_number: "EXP-2026-0001",
    category: "petty_cash",
    title: "Morning Refreshments for Floor Mechanics",
    amount: 120,
    payment_mode: "cash",
    vendor_name: "Amman Tea Stall",
    expense_date: new Date().toISOString().split("T")[0],
    spent_by_type: "garage",
    is_reimbursed: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "init-exp-2",
    expense_number: "EXP-2026-0002",
    category: "fuel_transport",
    title: "Petrol for Customer Car Delivery Bike",
    amount: 350,
    payment_mode: "cash",
    vendor_name: "HP Petrol Station",
    expense_date: new Date().toISOString().split("T")[0],
    spent_by_type: "employee",
    employee_name: "Karthik (Driver)",
    employee_phone: "+91 98401 23456",
    is_reimbursed: false, // Pending reimbursement!
    notes: "Driver paid out of personal pocket for quick delivery run",
    created_at: new Date().toISOString(),
  },
  {
    id: "init-exp-3",
    expense_number: "EXP-2026-0003",
    category: "local_spares",
    title: "Dot 4 Brake Fluid & WD-40 Spray Cans",
    amount: 850,
    payment_mode: "upi",
    vendor_name: "Metro Auto Spares",
    expense_date: new Date().toISOString().split("T")[0],
    spent_by_type: "garage",
    is_reimbursed: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "init-exp-4",
    expense_number: "EXP-2026-0004",
    category: "outside_jobwork",
    title: "Brake Rotor Skimming & Facing (Lathe work)",
    amount: 1400,
    payment_mode: "upi",
    vendor_name: "Shri Ganesh Precision Lathe Works",
    expense_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    spent_by_type: "garage",
    is_reimbursed: true,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export function useExpenses() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<GarageExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingLocalStorage, setUsingLocalStorage] = useState(false);

  // Load local storage fallback
  const getStoredLocal = (): GarageExpense[] => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Failed to load local expenses", e);
    }
    return DEFAULT_INITIAL_EXPENSES;
  };

  const saveToLocal = (items: GarageExpense[]) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Failed to save local expenses", e);
    }
  };

  // Fetch expenses
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("garage_expenses" as any)
        .select("*")
        .order("expense_date", { ascending: false });

      if (error) {
        const local = getStoredLocal();
        setExpenses(local);
        setUsingLocalStorage(true);
      } else if (data && data.length > 0) {
        setExpenses(data as GarageExpense[]);
        setUsingLocalStorage(false);
        saveToLocal(data as GarageExpense[]);
      } else {
        const local = getStoredLocal();
        setExpenses(local);
        setUsingLocalStorage(false);
      }
    } catch (err) {
      const local = getStoredLocal();
      setExpenses(local);
      setUsingLocalStorage(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Add Expense
  const addExpense = async (formData: ExpenseFormData): Promise<GarageExpense | null> => {
    try {
      const seqNum = Math.floor(1000 + Math.random() * 9000);
      const generatedExpNumber = `EXP-${new Date().getFullYear()}-${seqNum}`;

      const newExpensePayload = {
        category: formData.category,
        title: formData.title,
        amount: Number(formData.amount),
        payment_mode: formData.payment_mode,
        vendor_name: formData.vendor_name || null,
        expense_date: formData.expense_date,
        receipt_url: formData.receipt_url || null,
        receipt_name: formData.receipt_name || null,
        receipt_type: formData.receipt_type || null,
        work_order_id: formData.work_order_id || null,

        // Spender details
        spent_by_type: formData.spent_by_type || "garage",
        employee_id: formData.employee_id || null,
        employee_name: formData.employee_name || null,
        employee_phone: formData.employee_phone || null,
        is_reimbursed: formData.is_reimbursed ?? (formData.spent_by_type === "garage"),
        reimbursed_at: formData.is_reimbursed ? new Date().toISOString() : null,

        notes: formData.notes || null,
        created_by: user?.id || null,
        created_at: new Date().toISOString(),
      };

      let createdItem: GarageExpense | null = null;

      try {
        const { data, error } = await supabase
          .from("garage_expenses" as any)
          .insert(newExpensePayload)
          .select()
          .single();

        if (!error && data) {
          createdItem = data as GarageExpense;
        }
      } catch (e) {
        // Fallback to local
      }

      if (!createdItem) {
        createdItem = {
          id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `exp-${Date.now()}`,
          expense_number: generatedExpNumber,
          ...newExpensePayload,
        } as GarageExpense;
      }

      const updated = [createdItem, ...expenses];
      setExpenses(updated);
      saveToLocal(updated);

      toast({
        title: "Expense Recorded",
        description: `₹${Number(formData.amount).toLocaleString()} logged under ${
          EXPENSE_CATEGORIES.find((c) => c.key === formData.category)?.label || "Expenses"
        }.`,
      });

      return createdItem;
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to record expense",
        description: err?.message || "An unexpected error occurred.",
      });
      return null;
    }
  };

  // Toggle Reimbursement Status
  const toggleReimbursement = async (id: string): Promise<boolean> => {
    const item = expenses.find((e) => e.id === id);
    if (!item) return false;

    const newStatus = !item.is_reimbursed;
    const nowIso = newStatus ? new Date().toISOString() : null;

    try {
      if (!id.startsWith("init-exp-")) {
        try {
          const { error } = await supabase
            .from("garage_expenses" as any)
            .update({ is_reimbursed: newStatus, reimbursed_at: nowIso })
            .eq("id", id);
          if (error && error.code !== "22P02") {
            console.warn("Could not sync reimbursement to Supabase:", error);
          }
        } catch (e) {
          // Ignore network / syntax errors
        }
      }

      const updated = expenses.map((e) =>
        e.id === id ? { ...e, is_reimbursed: newStatus, reimbursed_at: nowIso || undefined } : e
      );
      setExpenses(updated);
      saveToLocal(updated);

      toast({
        title: newStatus ? "Reimbursement Settled" : "Marked as Pending Reimbursement",
        description: newStatus
          ? `Settled payment to ${item.employee_name || "staff"}.`
          : `Marked as awaiting payback to ${item.employee_name || "staff"}.`,
      });
      return true;
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: err.message,
      });
      return false;
    }
  };

  // Delete Expense
  const deleteExpense = async (id: string): Promise<boolean> => {
    try {
      if (!id.startsWith("init-exp-")) {
        try {
          const { error } = await supabase
            .from("garage_expenses" as any)
            .delete()
            .eq("id", id);
          if (error && error.code !== "22P02") {
            console.warn("Could not delete expense from Supabase:", error);
          }
        } catch (e) {
          // Ignore network / syntax errors
        }
      }

      const updated = expenses.filter((e) => e.id !== id);
      setExpenses(updated);
      saveToLocal(updated);

      toast({
        title: "Expense Removed",
        description: "The expenditure record has been deleted.",
      });
      return true;
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: err.message,
      });
      return false;
    }
  };

  // Update Expense
  const updateExpense = async (id: string, formData: Partial<ExpenseFormData>): Promise<boolean> => {
    try {
      if (!id.startsWith("init-exp-")) {
        try {
          const { error } = await supabase
            .from("garage_expenses" as any)
            .update(formData)
            .eq("id", id);
          if (error && error.code !== "22P02") {
            console.warn("Could not update expense in Supabase:", error);
          }
        } catch (e) {
          // Ignore network / syntax errors
        }
      }

      const updated = expenses.map((item) =>
        item.id === id ? { ...item, ...formData, amount: Number(formData.amount ?? item.amount) } : item
      );
      setExpenses(updated);
      saveToLocal(updated);

      toast({
        title: "Expense Updated",
        description: "Changes have been saved successfully.",
      });
      return true;
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: err.message,
      });
      return false;
    }
  };

  return {
    expenses,
    loading,
    usingLocalStorage,
    addExpense,
    updateExpense,
    deleteExpense,
    toggleReimbursement,
    refreshExpenses: fetchExpenses,
  };
}
