import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Package,
  Wrench,
  Coffee,
  Fuel,
  Layers,
  Users,
  HelpCircle,
  IndianRupee,
  Plus,
  UploadCloud,
  Receipt,
  Car,
  Calendar,
  User,
  Phone,
  FileText,
  X,
  CheckCircle2,
  Clock,
  Paperclip,
} from "lucide-react";
import {
  ExpenseCategory,
  ExpenseFormData,
  PaymentMode,
  SpenderType,
  EXPENSE_CATEGORIES,
} from "@/types/expenses";
import { supabase } from "@/integrations/supabase/client";

interface RecordExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ExpenseFormData) => Promise<any>;
  defaultCategory?: ExpenseCategory;
  defaultAmount?: number;
  defaultTitle?: string;
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

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 2500, 5000];

export function RecordExpenseModal({
  open,
  onOpenChange,
  onSubmit,
  defaultCategory = "petty_cash",
  defaultAmount,
  defaultTitle = "",
}: RecordExpenseModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [amount, setAmount] = useState<string>(defaultAmount ? String(defaultAmount) : "");
  const [category, setCategory] = useState<ExpenseCategory>(defaultCategory);
  const [title, setTitle] = useState(defaultTitle);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [vendorName, setVendorName] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [workOrderId, setWorkOrderId] = useState<string>("none");
  const [notes, setNotes] = useState("");

  // Spender / Employee State
  const [spentByType, setSpentByType] = useState<SpenderType>("garage");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("custom");
  const [employeeName, setEmployeeName] = useState("");
  const [employeePhone, setEmployeePhone] = useState("");
  const [isReimbursed, setIsReimbursed] = useState(false);

  // Optional Bill Document State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptName, setReceiptName] = useState("");
  const [receiptType, setReceiptType] = useState("");
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Sync defaults when modal opens
  useEffect(() => {
    if (open) {
      if (defaultAmount) setAmount(String(defaultAmount));
      if (defaultCategory) setCategory(defaultCategory);
      if (defaultTitle) setTitle(defaultTitle);
      fetchRecentWorkOrders();
      fetchEmployees();
    }
  }, [open, defaultAmount, defaultCategory, defaultTitle]);

  const fetchRecentWorkOrders = async () => {
    try {
      const { data } = await supabase
        .from("work_orders")
        .select("id, service_type, vehicles(vehicle_number, model)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setWorkOrders(data);
    } catch (e) {
      // Ignore
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data } = await supabase
        .from("employees")
        .select("id, name, phone, email")
        .order("name");
      if (data && data.length > 0) {
        setEmployeesList(data);
      }
    } catch (e) {
      // Ignore
    }
  };

  const handleQuickAmountClick = (val: number) => {
    setAmount(String(val));
  };

  const handleSpenderTypeChange = (type: SpenderType) => {
    setSpentByType(type);
    if (type === "garage") {
      setIsReimbursed(true);
      setEmployeeName("");
      setEmployeePhone("");
      setSelectedEmployeeId("custom");
    } else {
      setIsReimbursed(false); // Employees paying out of pocket default to needing reimbursement
    }
  };

  const handleEmployeeSelect = (empId: string) => {
    setSelectedEmployeeId(empId);
    if (empId === "custom") {
      // Clear for manual typing
      setEmployeeName("");
      setEmployeePhone("");
      return;
    }
    const emp = employeesList.find((e) => e.id === empId);
    if (emp) {
      setEmployeeName(emp.name || "");
      setEmployeePhone(emp.phone || "");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setReceiptName(file.name);
    setReceiptType(file.type || "application/octet-stream");

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setReceiptUrl("");
    setReceiptName("");
    setReceiptType("");
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      // Handle file upload if attached
      let finalReceiptUrl = receiptUrl;
      let finalReceiptName = receiptName;
      let finalReceiptType = receiptType;

      if (selectedFile) {
        finalReceiptName = selectedFile.name;
        finalReceiptType = selectedFile.type || "application/octet-stream";
        try {
          const fileExt = selectedFile.name.split(".").pop();
          const cleanName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
          const filePath = `expense-receipts/${Date.now()}_${cleanName}`;

          const { error: uploadError } = await supabase.storage
            .from("payment-proofs")
            .upload(filePath, selectedFile, { upsert: true });

          if (!uploadError) {
            const { data } = supabase.storage
              .from("payment-proofs")
              .getPublicUrl(filePath);
            finalReceiptUrl = data.publicUrl;
          } else {
            // Fallback to base64 so document is always preserved
            finalReceiptUrl = await readFileAsBase64(selectedFile);
          }
        } catch (err) {
          finalReceiptUrl = await readFileAsBase64(selectedFile);
        }
      }

      const payload: ExpenseFormData = {
        amount: numAmount,
        category,
        title: title.trim(),
        payment_mode: paymentMode,
        vendor_name: vendorName.trim() || undefined,
        expense_date: expenseDate,
        work_order_id: workOrderId !== "none" ? workOrderId : undefined,
        notes: notes.trim() || undefined,

        // Spender / Employee details
        spent_by_type: spentByType,
        employee_id:
          spentByType === "employee" && selectedEmployeeId !== "custom"
            ? selectedEmployeeId
            : undefined,
        employee_name:
          spentByType !== "garage" && employeeName.trim()
            ? employeeName.trim()
            : undefined,
        employee_phone:
          spentByType !== "garage" && employeePhone.trim()
            ? employeePhone.trim()
            : undefined,
        is_reimbursed: spentByType === "garage" ? true : isReimbursed,

        // Optional Bill Document
        receipt_url: finalReceiptUrl || undefined,
        receipt_name: finalReceiptName || undefined,
        receipt_type: finalReceiptType || undefined,
      };

      await onSubmit(payload);

      // Reset form
      setAmount("");
      setTitle("");
      setVendorName("");
      setNotes("");
      setReceiptUrl("");
      setReceiptName("");
      setReceiptType("");
      setSelectedFile(null);
      setFilePreview(null);
      setSpentByType("garage");
      setEmployeeName("");
      setEmployeePhone("");
      setSelectedEmployeeId("custom");
      setIsReimbursed(false);
      setWorkOrderId("none");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 rounded-xl">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Record Garage Expense</DialogTitle>
              <DialogDescription className="text-xs">
                Log shop expenditures, staff petrol, or spares to track accurate Net Profit & Loss
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Amount input & Quick Chips */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Amount Spent (INR) *
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground font-bold">
                ₹
              </div>
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="pl-8 text-2xl font-black tracking-tight h-12 bg-muted/30 focus-visible:ring-rose-500"
                autoFocus
              />
            </div>
            {/* Quick Amount Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => handleQuickAmountClick(amt)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                    amount === String(amt)
                      ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                      : "bg-muted/40 hover:bg-muted text-foreground border-border/60"
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
          </div>

          {/* Category Dropdown */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Expense Category *
            </Label>
            <Select value={category} onValueChange={(val: ExpenseCategory) => setCategory(val)}>
              <SelectTrigger className="h-10 bg-muted/20">
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat.iconName] || HelpCircle;
                  return (
                    <SelectItem key={cat.key} value={cat.key}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" style={{ color: cat.color }} />
                        <span className="font-medium">{cat.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Title / Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Description / Purpose *
            </Label>
            <Input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Petrol for test drive, Dot 4 Brake fluid, Tea for mechanics, EB bill..."
              className="h-10 bg-muted/20"
            />
          </div>

          {/* Paid By (Spender Selection) */}
          <div className="p-3.5 bg-muted/25 border border-border/70 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-rose-500" />
                Who Paid for this? *
              </Label>
              <span className="text-[11px] text-muted-foreground font-medium">
                {spentByType === "garage"
                  ? "Garage Petty Cash Drawer"
                  : spentByType === "employee"
                  ? "Employee Out-of-Pocket"
                  : "External / Custom Person"}
              </span>
            </div>

            {/* Segmented Selector */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSpenderTypeChange("garage")}
                className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                  spentByType === "garage"
                    ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                    : "bg-background text-foreground border-border/60 hover:bg-muted/50"
                }`}
              >
                Garage / Shop
              </button>
              <button
                type="button"
                onClick={() => handleSpenderTypeChange("employee")}
                className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                  spentByType === "employee"
                    ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                    : "bg-background text-foreground border-border/60 hover:bg-muted/50"
                }`}
              >
                Employee / Staff
              </button>
              <button
                type="button"
                onClick={() => handleSpenderTypeChange("custom")}
                className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                  spentByType === "custom"
                    ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                    : "bg-background text-foreground border-border/60 hover:bg-muted/50"
                }`}
              >
                Custom Person
              </button>
            </div>

            {/* Employee Specific Details */}
            {spentByType === "employee" && (
              <div className="space-y-3 pt-2 border-t border-border/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">
                      Select Staff Member
                    </Label>
                    <Select
                      value={selectedEmployeeId}
                      onValueChange={handleEmployeeSelect}
                    >
                      <SelectTrigger className="h-9 bg-background text-xs">
                        <SelectValue placeholder="Choose employee..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">+ Enter Custom / Other Staff</SelectItem>
                        {employeesList.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id} className="text-xs">
                            {emp.name} {emp.phone ? `(${emp.phone})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">
                      Employee Name *
                    </Label>
                    <Input
                      value={employeeName}
                      onChange={(e) => setEmployeeName(e.target.value)}
                      placeholder="e.g., Ramesh (Driver)"
                      required={spentByType === "employee"}
                      className="h-9 bg-background text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    Phone Number (Contact / UPI)
                  </Label>
                  <Input
                    type="tel"
                    value={employeePhone}
                    onChange={(e) => setEmployeePhone(e.target.value)}
                    placeholder="e.g., +91 98401 23456"
                    className="h-9 bg-background text-xs"
                  />
                </div>

                {/* Reimbursement Checkbox */}
                <div className="p-2.5 bg-background rounded-lg border border-border/60 flex items-start gap-2.5">
                  <Checkbox
                    id="reimbursed-check"
                    checked={isReimbursed}
                    onCheckedChange={(checked) => setIsReimbursed(!!checked)}
                    className="mt-0.5 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                  />
                  <div className="space-y-0.5 leading-none">
                    <label
                      htmlFor="reimbursed-check"
                      className="text-xs font-semibold text-foreground cursor-pointer"
                    >
                      {isReimbursed
                        ? "Settled: Reimbursed to employee already"
                        : "Pending Reimbursement: Garage owes employee payback"}
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      {isReimbursed
                        ? "Paid back from shop cash drawer or bank."
                        : `Employee spent personal money. Shop owes ₹${amount || "0"} back.`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Person Details */}
            {spentByType === "custom" && (
              <div className="space-y-3 pt-2 border-t border-border/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">
                      Person / Contractor Name *
                    </Label>
                    <Input
                      value={employeeName}
                      onChange={(e) => setEmployeeName(e.target.value)}
                      placeholder="e.g., Kumar (External Driver)"
                      required={spentByType === "custom"}
                      className="h-9 bg-background text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      Phone Number (Optional)
                    </Label>
                    <Input
                      type="tel"
                      value={employeePhone}
                      onChange={(e) => setEmployeePhone(e.target.value)}
                      placeholder="e.g., +91 98400 11223"
                      className="h-9 bg-background text-xs"
                    />
                  </div>
                </div>

                <div className="p-2.5 bg-background rounded-lg border border-border/60 flex items-start gap-2.5">
                  <Checkbox
                    id="custom-reimbursed-check"
                    checked={isReimbursed}
                    onCheckedChange={(checked) => setIsReimbursed(!!checked)}
                    className="mt-0.5 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                  />
                  <div className="space-y-0.5 leading-none">
                    <label
                      htmlFor="custom-reimbursed-check"
                      className="text-xs font-semibold text-foreground cursor-pointer"
                    >
                      {isReimbursed ? "Payment Settled" : "Pending Settlement"}
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      {isReimbursed
                        ? "Amount has been settled with this person."
                        : "Shop needs to pay/reimburse this person."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payment Mode & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Payment Mode *
              </Label>
              <Select
                value={paymentMode}
                onValueChange={(val: PaymentMode) => setPaymentMode(val)}
              >
                <SelectTrigger className="h-10 bg-muted/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash (Petty Cash)</SelectItem>
                  <SelectItem value="upi">UPI / Online Transfer</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer (NEFT / RTGS)</SelectItem>
                  <SelectItem value="card">Card (POS / Debit / Credit)</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Date Spent *
              </Label>
              <Input
                type="date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="h-10 bg-muted/20"
              />
            </div>
          </div>

          {/* Vendor / Payee & Linked Job Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Paid To / Vendor / Station
              </Label>
              <Input
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="e.g., Bharat Petroleum, Metro Spares, Tea stall"
                className="h-10 bg-muted/20 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Car className="h-3 w-3 text-muted-foreground" /> Link to Job Card (Optional)
              </Label>
              <Select value={workOrderId} onValueChange={setWorkOrderId}>
                <SelectTrigger className="h-10 bg-muted/20 text-xs truncate">
                  <SelectValue placeholder="General Garage (No vehicle)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General Workshop Expense</SelectItem>
                  {workOrders.map((wo) => {
                    const plate = wo.vehicles?.vehicle_number || "Vehicle";
                    const model = wo.vehicles?.model ? ` - ${wo.vehicles.model}` : "";
                    return (
                      <SelectItem key={wo.id} value={wo.id} className="text-xs">
                        {plate} {model} ({wo.service_type || "Repair"})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Optional Bill / Document Upload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                Upload Bill or Document (Optional)
              </Label>
              <span className="text-[10px] text-muted-foreground">
                Images (JPG, PNG) or PDF up to 10MB
              </span>
            </div>

            {/* Hidden Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,application/pdf"
              className="hidden"
            />

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border/80 hover:border-rose-400/80 rounded-xl p-4 text-center cursor-pointer transition-colors bg-muted/15 hover:bg-muted/30"
              >
                <div className="flex flex-col items-center justify-center space-y-1.5">
                  <div className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-full">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div className="text-xs font-semibold text-foreground">
                    Click to attach invoice, petrol slip, or receipt
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Supports camera photos, screenshots, and PDF bills (Optional)
                  </p>
                </div>
              </div>
            ) : (
              <div className="border border-border/80 rounded-xl p-3 bg-muted/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  {filePreview ? (
                    <img
                      src={filePreview}
                      alt="Receipt Preview"
                      className="h-12 w-12 object-cover rounded-lg border border-border shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-lg flex items-center justify-center shrink-0">
                      <FileText className="h-6 w-6" />
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-foreground truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || "Document"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Change
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveFile}
                    className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    title="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Internal Notes / Remarks (Optional)
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Petrol bill for car TN-09-AB-1234 test drive. Spoke to customer."
              className="resize-none h-16 bg-muted/20 text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !amount || !title.trim()}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              {submitting ? "Saving..." : "Save Expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
