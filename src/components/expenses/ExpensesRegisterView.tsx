import React, { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IndianRupee,
  Plus,
  Search,
  Filter,
  Trash2,
  Calendar,
  Building2,
  Package,
  Wrench,
  Coffee,
  Fuel,
  Layers,
  Users,
  HelpCircle,
  Download,
  Wallet,
  ArrowUpRight,
  TrendingDown,
  Sparkles,
  Paperclip,
  FileText,
  User,
  Phone,
  CheckCircle2,
  Clock,
  Eye,
} from "lucide-react";
import {
  GarageExpense,
  ExpenseCategory,
  ExpenseFormData,
  EXPENSE_CATEGORIES,
} from "@/types/expenses";
import { RecordExpenseModal } from "./RecordExpenseModal";
import { ViewBillModal } from "./ViewBillModal";

interface ExpensesRegisterViewProps {
  expenses: GarageExpense[];
  onAddExpense: (data: ExpenseFormData) => Promise<any>;
  onDeleteExpense: (id: string) => Promise<boolean>;
  onToggleReimbursement?: (id: string) => Promise<boolean>;
  dateFilterRange?: { from?: Date; to?: Date };
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Building2,
  Package,
  Wrench,
  Coffee,
  Fuel,
  Layers,
  Users,
  HelpCircle,
};

export function ExpensesRegisterView({
  expenses,
  onAddExpense,
  onDeleteExpense,
  onToggleReimbursement,
  dateFilterRange,
}: ExpensesRegisterViewProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [pendingReimbursementOnly, setPendingReimbursementOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewBillExpense, setViewBillExpense] = useState<GarageExpense | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const [presetModal, setPresetModal] = useState<{
    open: boolean;
    amount?: number;
    category?: ExpenseCategory;
    title?: string;
  }>({ open: false });

  // Pending Reimbursements Calculation
  const pendingReimbursements = useMemo(() => {
    return expenses.filter(
      (e) => (e.spent_by_type === "employee" || e.spent_by_type === "custom") && !e.is_reimbursed
    );
  }, [expenses]);

  const pendingReimbursementTotal = useMemo(() => {
    return pendingReimbursements.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [pendingReimbursements]);

  // Filter expenses by search, category, date, and reimbursement status
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      // Pending reimbursement only filter
      if (pendingReimbursementOnly) {
        if (exp.is_reimbursed || exp.spent_by_type === "garage") return false;
      }
      // Category filter
      if (selectedCategory !== "all" && exp.category !== selectedCategory) {
        return false;
      }
      // Search filter
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesTitle = exp.title.toLowerCase().includes(query);
        const matchesVendor = exp.vendor_name?.toLowerCase().includes(query) || false;
        const matchesNumber = exp.expense_number?.toLowerCase().includes(query) || false;
        const matchesEmployee =
          exp.employee_name?.toLowerCase().includes(query) ||
          exp.employee_phone?.toLowerCase().includes(query) ||
          false;
        if (!matchesTitle && !matchesVendor && !matchesNumber && !matchesEmployee) return false;
      }
      // Date filter
      if (dateFilterRange?.from || dateFilterRange?.to) {
        const expDate = new Date(exp.expense_date);
        if (dateFilterRange.from && expDate < dateFilterRange.from) return false;
        if (dateFilterRange.to) {
          const toEndOfDay = new Date(dateFilterRange.to);
          toEndOfDay.setHours(23, 59, 59, 999);
          if (expDate > toEndOfDay) return false;
        }
      }
      return true;
    });
  }, [expenses, selectedCategory, search, dateFilterRange, pendingReimbursementOnly]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const cashTotal = filteredExpenses
      .filter((e) => e.payment_mode === "cash")
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const digitalTotal = total - cashTotal;

    // Top Category
    const categoryTotals: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });
    const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    const topCatKey = sortedCats[0]?.[0];
    const topCatMeta = EXPENSE_CATEGORIES.find((c) => c.key === topCatKey);
    const topCatAmount = sortedCats[0]?.[1] || 0;

    return {
      total,
      cashTotal,
      digitalTotal,
      topCategory: topCatMeta ? `${topCatMeta.label} (₹${topCatAmount.toLocaleString()})` : "N/A",
    };
  }, [filteredExpenses]);

  // Fast Quick Add Handlers
  const handleTriggerQuickAdd = (
    amount: number,
    category: ExpenseCategory,
    title: string
  ) => {
    setPresetModal({
      open: true,
      amount,
      category,
      title,
    });
  };

  const handleSettleReimbursement = async (id: string) => {
    if (!onToggleReimbursement) return;
    setSettlingId(id);
    try {
      await onToggleReimbursement(id);
    } finally {
      setSettlingId(null);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      "Expense Number",
      "Date",
      "Description",
      "Category",
      "Paid By",
      "Employee / Spender",
      "Phone Number",
      "Reimbursement Status",
      "Payment Mode",
      "Vendor",
      "Amount (INR)",
      "Has Bill Document",
      "Notes",
    ];
    const rows = filteredExpenses.map((e) => [
      e.expense_number || e.id,
      e.expense_date,
      `"${e.title.replace(/"/g, '""')}"`,
      EXPENSE_CATEGORIES.find((c) => c.key === e.category)?.label || e.category,
      e.spent_by_type || "garage",
      `"${(e.employee_name || "").replace(/"/g, '""')}"`,
      `"${(e.employee_phone || "").replace(/"/g, '""')}"`,
      e.spent_by_type === "garage" ? "N/A (Shop Direct)" : e.is_reimbursed ? "Reimbursed" : "Pending Payback",
      e.payment_mode,
      `"${(e.vendor_name || "").replace(/"/g, '""')}"`,
      e.amount,
      e.receipt_url ? "Yes" : "No",
      `"${(e.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `garage_expenses_${new Date().toISOString().split("T")[0]}.csv`);
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Top Metric Cards for Outflows */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Outflow
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-rose-600 tracking-tight">
              ₹{stats.total.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Across {filteredExpenses.length} recorded expense(s)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Cash Drawer Spent
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground tracking-tight">
              ₹{stats.cashTotal.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {stats.total > 0
                ? `${((stats.cashTotal / stats.total) * 100).toFixed(0)}% paid in physical cash`
                : "No cash spent"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Online / UPI Spent
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <IndianRupee className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground tracking-tight">
              ₹{stats.digitalTotal.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              GPay, UPI & Bank Transfer outflows
            </p>
          </CardContent>
        </Card>

        {/* Pending Reimbursement Dues Card */}
        <Card
          onClick={() => setPendingReimbursementOnly(!pendingReimbursementOnly)}
          className={`cursor-pointer transition-all border shadow-sm ${
            pendingReimbursements.length > 0
              ? pendingReimbursementOnly
                ? "bg-amber-100/50 dark:bg-amber-950/40 border-amber-500 shadow-md ring-2 ring-amber-500/20"
                : "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 hover:border-amber-400"
              : "bg-card border-border/70"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Staff Payback Due
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
              ₹{pendingReimbursementTotal.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
              <span>{pendingReimbursements.length} pending staff claim(s)</span>
              <span className="text-[10px] underline font-semibold text-amber-700 dark:text-amber-400">
                {pendingReimbursementOnly ? "Showing Only Dues" : "Filter Dues"}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Petty Cash Fast-Action Bar */}
      <div className="p-3.5 bg-gradient-to-r from-rose-50/60 via-amber-50/40 to-background dark:from-rose-950/20 dark:via-amber-950/10 dark:to-background border border-rose-200/60 dark:border-rose-900/40 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-rose-500/10 text-rose-600 rounded-xl">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">
              Quick Expenditure Logger
            </div>
            <div className="text-[11px] text-muted-foreground">
              Fast 1-click entries for staff petrol, parts, cleaning & tea
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              handleTriggerQuickAdd(50, "petty_cash", "Tea & Snacks for Mechanics")
            }
            className="h-8 text-xs bg-card hover:bg-muted font-medium border-border/70"
          >
            + ₹50 Tea
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              handleTriggerQuickAdd(200, "petty_cash", "Shop Cleaning & Waste Oil Disposal")
            }
            className="h-8 text-xs bg-card hover:bg-muted font-medium border-border/70"
          >
            + ₹200 Cleaning
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              handleTriggerQuickAdd(500, "fuel_transport", "Vehicle Pickup / Delivery Petrol")
            }
            className="h-8 text-xs bg-card hover:bg-muted font-medium border-border/70"
          >
            + ₹500 Staff Petrol
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              handleTriggerQuickAdd(1000, "local_spares", "Urgent Local Spares / Consumables")
            }
            className="h-8 text-xs bg-card hover:bg-muted font-medium border-border/70"
          >
            + ₹1,000 Spares
          </Button>
          <Button
            size="sm"
            onClick={() => setModalOpen(true)}
            className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1 ml-auto md:ml-2 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" /> + New Expense
          </Button>
        </div>
      </div>

      {/* Search, Filter & Actions Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by description, staff name, phone, vendor..."
              className="pl-8 h-9 text-xs bg-background"
            />
          </div>
          {search && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearch("")}
              className="h-9 text-xs"
            >
              Clear
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Pending Staff Dues */}
          {pendingReimbursements.length > 0 && (
            <Button
              variant={pendingReimbursementOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setPendingReimbursementOnly(!pendingReimbursementOnly)}
              className={`h-9 text-xs gap-1.5 font-medium ${
                pendingReimbursementOnly
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "border-amber-300 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              {pendingReimbursementOnly ? "Showing Dues Only" : `Staff Dues (${pendingReimbursements.length})`}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-9 text-xs gap-1.5 font-medium"
            disabled={filteredExpenses.length === 0}
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => setSelectedCategory("all")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
            selectedCategory === "all"
              ? "bg-foreground text-background shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          All Categories ({expenses.length})
        </button>
        {EXPENSE_CATEGORIES.map((cat) => {
          const count = expenses.filter((e) => e.category === cat.key).length;
          const isSelected = selectedCategory === cat.key;
          const Icon = CATEGORY_ICONS[cat.iconName] || HelpCircle;
          return (
            <button
              type="button"
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                isSelected
                  ? "bg-rose-600 text-white shadow-sm font-bold"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{cat.label}</span>
              <span className="text-[10px] opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Expense Ledger Table */}
      <Card className="border-border/70 shadow-sm overflow-hidden">
        <CardHeader className="p-4 bg-muted/20 border-b border-border/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold">Expenditure Register</CardTitle>
            <CardDescription className="text-xs">
              Showing {filteredExpenses.length} transaction(s) totaling ₹
              {stats.total.toLocaleString()}
            </CardDescription>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs font-bold w-[110px]">Date</TableHead>
                <TableHead className="text-xs font-bold w-[120px]">Ref / Voucher</TableHead>
                <TableHead className="text-xs font-bold">Purpose & Spender Details</TableHead>
                <TableHead className="text-xs font-bold w-[140px]">Category</TableHead>
                <TableHead className="text-xs font-bold w-[110px]">Payment Mode</TableHead>
                <TableHead className="text-xs font-bold w-[130px]">Vendor / Payee</TableHead>
                <TableHead className="text-xs font-bold text-center w-[90px]">Bill Doc</TableHead>
                <TableHead className="text-xs font-bold text-right w-[120px]">
                  Amount (₹)
                </TableHead>
                <TableHead className="text-xs font-bold text-right w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="max-w-xs mx-auto space-y-3">
                      <div className="h-12 w-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 mx-auto flex items-center justify-center">
                        <Wallet className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-sm text-foreground">
                          No expenditures found
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {search || selectedCategory !== "all" || pendingReimbursementOnly
                            ? "Try resetting your search or filters"
                            : "Record shop rent, staff petrol, or petty cash to start tracking real profit"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setModalOpen(true)}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" /> + Log First Expense
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((exp) => {
                  const catMeta = EXPENSE_CATEGORIES.find((c) => c.key === exp.category);
                  const Icon = catMeta ? CATEGORY_ICONS[catMeta.iconName] || HelpCircle : HelpCircle;
                  const isStaffExpense = exp.spent_by_type === "employee" || exp.spent_by_type === "custom";

                  return (
                    <TableRow key={exp.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {exp.expense_date}
                      </TableCell>
                      <TableCell className="text-xs font-mono font-semibold text-foreground whitespace-nowrap">
                        {exp.expense_number || "EXP-AUTO"}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-semibold text-foreground">{exp.title}</div>

                        {/* Staff / Employee Spender Details */}
                        {isStaffExpense && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900/60">
                              <User className="h-3 w-3" />
                              <span>{exp.employee_name || "Staff Member"}</span>
                              {exp.employee_phone && (
                                <span className="opacity-80 flex items-center gap-0.5 ml-0.5">
                                  (<Phone className="h-2.5 w-2.5" /> {exp.employee_phone})
                                </span>
                              )}
                            </span>

                            {/* Reimbursement Badge & Action */}
                            {exp.is_reimbursed ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 gap-1 px-1.5 py-0"
                              >
                                <CheckCircle2 className="h-2.5 w-2.5" /> Settled
                              </Badge>
                            ) : (
                              <div className="inline-flex items-center gap-1">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 gap-1 px-1.5 py-0"
                                >
                                  <Clock className="h-2.5 w-2.5" /> Pending Payback
                                </Badge>
                                {onToggleReimbursement && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={settlingId === exp.id}
                                    onClick={() => handleSettleReimbursement(exp.id)}
                                    className="h-5 px-1.5 text-[10px] text-amber-700 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-semibold"
                                  >
                                    {settlingId === exp.id ? "Settling..." : "Mark Settled"}
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {exp.notes && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-sm mt-0.5">
                            {exp.notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold gap-1 px-2 py-0.5 border ${
                            catMeta?.bgColor || "bg-muted"
                          }`}
                        >
                          <Icon className="h-3 w-3" />
                          <span>{catMeta?.label || exp.category}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        <span className="text-muted-foreground font-medium">
                          {exp.payment_mode === "cash" && "Cash"}
                          {exp.payment_mode === "upi" && "UPI / Online"}
                          {exp.payment_mode === "bank_transfer" && "Bank Transfer"}
                          {exp.payment_mode === "card" && "Card"}
                          {exp.payment_mode === "cheque" && "Cheque"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {exp.vendor_name || <span className="italic text-muted-foreground/60">—</span>}
                      </TableCell>

                      {/* Bill / Document Button */}
                      <TableCell className="text-xs text-center whitespace-nowrap">
                        {exp.receipt_url ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setViewBillExpense(exp)}
                            className="h-7 text-[11px] gap-1 px-2 bg-rose-50/60 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60 hover:bg-rose-100"
                            title="View attached bill or receipt"
                          >
                            <FileText className="h-3 w-3" />
                            <span>View Bill</span>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">—</span>
                        )}
                      </TableCell>

                      <TableCell className="text-xs font-extrabold text-right text-rose-600 whitespace-nowrap">
                        ₹{exp.amount?.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteExpense(exp.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-rose-600"
                          title="Delete expense"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Record Expense Modals */}
      <RecordExpenseModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={onAddExpense}
      />

      <RecordExpenseModal
        open={presetModal.open}
        onOpenChange={(open) => setPresetModal((prev) => ({ ...prev, open }))}
        onSubmit={onAddExpense}
        defaultAmount={presetModal.amount}
        defaultCategory={presetModal.category}
        defaultTitle={presetModal.title}
      />

      {/* View Bill / Document Modal */}
      <ViewBillModal
        open={!!viewBillExpense}
        onOpenChange={(open) => !open && setViewBillExpense(null)}
        expense={viewBillExpense}
      />
    </div>
  );
}
