import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Receipt,
  User,
  CreditCard,
  Calendar,
  X,
} from "lucide-react";
import { format } from "date-fns";

export interface OpenInvoiceItem {
  id: string;
  bill_number: number | null;
  created_at: string;
  total: number;
  total_deductions: number;
  existingPaid: number;
  balance: number;
  status: string;
  service_type?: string;
  vehicle_number?: string;
}

export interface RecordCustomerPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string;
  customerName?: string;
  onSuccess?: () => void;
}

export function RecordCustomerPaymentModal({
  open,
  onOpenChange,
  customerId: initialCustomerId,
  customerName: initialCustomerName,
  onSuccess,
}: RecordCustomerPaymentModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<{ id: string; name: string; company_name?: string; phone?: string }[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || "");
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string; company_name?: string } | null>(null);

  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [openInvoices, setOpenInvoices] = useState<OpenInvoiceItem[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load customer list if no customerId was provided
  useEffect(() => {
    if (open) {
      if (!initialCustomerId) {
        loadCustomers();
      } else {
        setSelectedCustomerId(initialCustomerId);
      }
    }
  }, [open, initialCustomerId]);

  // Load invoices when customer changes
  useEffect(() => {
    if (selectedCustomerId && open) {
      loadCustomerInvoices(selectedCustomerId);
    } else {
      setOpenInvoices([]);
      setAllocations({});
    }
  }, [selectedCustomerId, open]);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, company_name, phone")
        .order("name");
      if (error) throw error;
      setCustomers(data || []);
    } catch (err: any) {
      console.error("Failed to load customers:", err);
    }
  };

  const loadCustomerInvoices = async (cId: string) => {
    setLoadingInvoices(true);
    try {
      // 1. Fetch Customer info if not already loaded
      const { data: cData } = await supabase
        .from("customers")
        .select("id, name, company_name")
        .eq("id", cId)
        .single();
      if (cData) setSelectedCustomer(cData);

      // 2. Fetch Invoices
      const { data: invoicesData, error: invError } = await supabase
        .from("invoices")
        .select(`
          id,
          bill_number,
          created_at,
          total,
          total_deductions,
          status,
          type,
          work_order:work_orders(
            id,
            service_type,
            vehicle:vehicles(vehicle_number)
          )
        `)
        .eq("customer_id", cId)
        .neq("status", "cancelled")
        .neq("status", "Paid")
        .order("created_at", { ascending: true }); // FIFO: oldest first

      if (invError) throw invError;

      const invoiceList = invoicesData || [];
      const invoiceIds = invoiceList.map((i) => i.id);

      if (invoiceIds.length === 0) {
        setOpenInvoices([]);
        setAllocations({});
        setLoadingInvoices(false);
        return;
      }

      // 3. Fetch Linked Payments
      const { data: paymentLinks } = await supabase
        .from("payment_links")
        .select("invoice_id, amount_applied, payment:payments(id, status)")
        .in("invoice_id", invoiceIds);

      // 4. Fetch Direct Payments
      const { data: directPayments } = await supabase
        .from("payments")
        .select("id, invoice_id, amount, status")
        .in("invoice_id", invoiceIds)
        .eq("status", "approved");

      // 5. Aggregate Balances
      const calculatedItems: OpenInvoiceItem[] = invoiceList.map((inv: any) => {
        const links = (paymentLinks || []).filter(
          (l: any) => l.invoice_id === inv.id && l.payment?.status?.toLowerCase() === "approved"
        );
        const linkedPaid = links.reduce((sum: number, l: any) => sum + (Number(l.amount_applied) || 0), 0);
        const linkedPaymentIds = new Set(links.map((l: any) => l.payment?.id));

        const directPaid = (directPayments || [])
          .filter(
            (p: any) =>
              p.invoice_id === inv.id &&
              !linkedPaymentIds.has(p.id) &&
              p.status?.toLowerCase() === "approved"
          )
          .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

        const totalPaid = linkedPaid + directPaid;
        const total = Number(inv.total) || 0;
        const deductions = Number(inv.total_deductions) || 0;
        const balance = Math.max(0, total - totalPaid - deductions);

        return {
          id: inv.id,
          bill_number: inv.bill_number,
          created_at: inv.created_at,
          total,
          total_deductions: deductions,
          existingPaid: totalPaid,
          balance,
          status: inv.status,
          service_type: inv.work_order?.service_type,
          vehicle_number: inv.work_order?.vehicle?.vehicle_number,
        };
      }).filter(item => item.balance > 0.01); // Only keep items with positive remaining balance

      setOpenInvoices(calculatedItems);

      // Initialize empty allocations
      const initialAlloc: Record<string, number> = {};
      calculatedItems.forEach((item) => {
        initialAlloc[item.id] = 0;
      });
      setAllocations(initialAlloc);

      // If paymentAmount is already typed, trigger FIFO auto-allocate
      if (paymentAmount && Number(paymentAmount) > 0) {
        runFifoAllocation(Number(paymentAmount), calculatedItems);
      }
    } catch (err: any) {
      console.error("Error loading open invoices:", err);
      toast({
        variant: "destructive",
        title: "Failed to load open bills",
        description: err.message,
      });
    } finally {
      setLoadingInvoices(false);
    }
  };

  const runFifoAllocation = (amount: number, items: OpenInvoiceItem[] = openInvoices) => {
    let remaining = amount;
    const newAlloc: Record<string, number> = {};

    for (const item of items) {
      if (remaining <= 0) {
        newAlloc[item.id] = 0;
      } else {
        const canApply = Math.min(item.balance, remaining);
        newAlloc[item.id] = Number(canApply.toFixed(2));
        remaining -= canApply;
      }
    }
    setAllocations(newAlloc);
  };

  const handlePaymentAmountChange = (val: string) => {
    setPaymentAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      runFifoAllocation(num);
    } else {
      const resetAlloc: Record<string, number> = {};
      openInvoices.forEach((i) => (resetAlloc[i.id] = 0));
      setAllocations(resetAlloc);
    }
  };

  const handleManualAllocationChange = (invoiceId: string, val: string) => {
    const num = parseFloat(val);
    const safeVal = isNaN(num) ? 0 : Math.max(0, num);
    setAllocations((prev) => ({
      ...prev,
      [invoiceId]: safeVal,
    }));
  };

  const totalOutstanding = useMemo(() => {
    return openInvoices.reduce((sum, inv) => sum + inv.balance, 0);
  }, [openInvoices]);

  const totalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }, [allocations]);

  const parsedPaymentAmount = parseFloat(paymentAmount) || 0;
  const unallocatedAmount = Math.max(0, parsedPaymentAmount - totalAllocated);
  const overAllocatedAmount = Math.max(0, totalAllocated - parsedPaymentAmount);

  const handleSubmit = async () => {
    if (!selectedCustomerId) {
      toast({ variant: "destructive", title: "Select a customer" });
      return;
    }

    if (parsedPaymentAmount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid payment amount greater than zero.",
      });
      return;
    }

    if (overAllocatedAmount > 0.01) {
      toast({
        variant: "destructive",
        title: "Over-allocated Amount",
        description: `Total allocated (₹${totalAllocated.toLocaleString()}) exceeds payment amount (₹${parsedPaymentAmount.toLocaleString()}) by ₹${overAllocatedAmount.toFixed(2)}.`,
      });
      return;
    }

    const appliedEntries = Object.entries(allocations)
      .filter(([_, amt]) => (amt || 0) > 0.01)
      .map(([invoiceId, amt]) => {
        const inv = openInvoices.find((i) => i.id === invoiceId);
        return {
          invoiceId,
          amount: amt,
          invoice: inv,
        };
      });

    setIsSubmitting(true);
    try {
      // 1. Upload optional proof file if selected
      let uploadedProofUrl = "";
      if (proofFile) {
        try {
          const fileExt = proofFile.name.split('.').pop() || 'png';
          const fileName = `admin-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `receipts/${fileName}`;
          const { error: uploadError } = await supabase.storage
            .from('payment-proofs')
            .upload(filePath, proofFile);
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('payment-proofs')
              .getPublicUrl(filePath);
            uploadedProofUrl = publicUrl || "";
          }
        } catch (uploadErr) {
          console.warn("Could not upload proof image, proceeding with empty proof_url", uploadErr);
        }
      }

      // 2. Map UI payment method to DB allowed enum ('Cash', 'UPI', 'Bank Transfer')
      const remarksParts = [];
      let dbPaymentMethod: 'Cash' | 'UPI' | 'Bank Transfer' = 'Cash';
      if (paymentMethod === 'UPI') {
        dbPaymentMethod = 'UPI';
      } else if (paymentMethod === 'Bank Transfer') {
        dbPaymentMethod = 'Bank Transfer';
      } else if (paymentMethod === 'Cheque') {
        dbPaymentMethod = 'Bank Transfer';
        remarksParts.push('[Cheque]');
      } else if (paymentMethod === 'Card') {
        dbPaymentMethod = 'Bank Transfer';
        remarksParts.push('[Card Payment]');
      } else {
        dbPaymentMethod = 'Cash';
      }

      if (notes.trim()) remarksParts.push(notes.trim());
      if (referenceNumber.trim()) remarksParts.push(`Ref: ${referenceNumber.trim()}`);
      if (appliedEntries.length > 0) {
        remarksParts.push(`Applied across ${appliedEntries.length} bill(s)`);
      } else {
        remarksParts.push("Unallocated advance on account");
      }

      // 3. Insert Payment into `payments` table
      const { data: paymentRecord, error: pError } = await (supabase as any)
        .from("payments")
        .insert({
          amount: parsedPaymentAmount,
          payment_method: dbPaymentMethod,
          proof_url: uploadedProofUrl || "", // Satisfies database NOT NULL constraint
          status: "approved", // Counter payments recorded by admin/staff are pre-approved
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
          admin_remarks: remarksParts.join(" • "),
          invoice_id: appliedEntries.length === 1 ? appliedEntries[0].invoiceId : null,
        })
        .select()
        .single();

      if (pError) throw pError;

      // 2. Link Invoices in `payment_links`
      if (appliedEntries.length > 0 && paymentRecord) {
        const linksToInsert = appliedEntries.map((entry) => ({
          payment_id: paymentRecord.id,
          invoice_id: entry.invoiceId,
          amount_applied: entry.amount,
        }));

        const { error: plError } = await (supabase as any)
          .from("payment_links")
          .insert(linksToInsert);

        if (plError) throw plError;

        // 3. Update Invoice statuses (Paid vs Partial)
        for (const entry of appliedEntries) {
          if (!entry.invoice) continue;
          const newTotalPaid = entry.invoice.existingPaid + entry.amount;
          const isFullyPaid = newTotalPaid + entry.invoice.total_deductions >= entry.invoice.total - 0.01;
          const newStatus = isFullyPaid ? "Paid" : "Partial";

          const { error: invUpdateError } = await supabase
            .from("invoices")
            .update({ status: newStatus } as any)
            .eq("id", entry.invoiceId);

          if (invUpdateError) {
            console.error(`Failed to update invoice ${entry.invoiceId}:`, invUpdateError);
          }
        }
      }

      toast({
        title: "Payment Recorded Successfully",
        description: `₹${parsedPaymentAmount.toLocaleString()} credited via ${paymentMethod} across ${appliedEntries.length} bill(s).`,
      });

      // Reset modal state
      setPaymentAmount("");
      setReferenceNumber("");
      setNotes("");
      setProofFile(null);
      setProofPreview(null);
      setAllocations({});
      onOpenChange(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error("Failed to record payment:", err);
      toast({
        variant: "destructive",
        title: "Payment Failed",
        description: err.message || "Could not record payment.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <IndianRupee className="h-5 w-5 text-emerald-600" />
            Record Customer Payment
          </DialogTitle>
          <DialogDescription className="text-xs">
            Receive counter / lump-sum payments and auto-allocate across open bills or keep on account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* Customer Selection */}
          {!initialCustomerId ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Customer</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Choose a customer..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name} {c.company_name ? `(${c.company_name})` : ""} {c.phone ? `• ${c.phone}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-bold text-foreground">
                    {initialCustomerName || selectedCustomer?.name || "Customer"}
                  </p>
                  {selectedCustomer?.company_name && (
                    <p className="text-[11px] text-muted-foreground">{selectedCustomer.company_name}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Total Outstanding Balance
                </span>
                <span className="text-sm font-extrabold text-destructive font-mono">
                  ₹{totalOutstanding.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Payment Details Card */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-muted/20 border space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-primary" />
              Payment Information
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Payment Amount (₹) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-muted-foreground">₹</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e) => handlePaymentAmountChange(e.target.value)}
                    className="pl-7 h-9 font-mono font-bold text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="UPI">UPI / QR Code</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer (IMPS/NEFT)</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Card">Debit / Credit Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Payment Date</Label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Transaction Reference / Cheque #</Label>
                <Input
                  placeholder="e.g. UPI Ref, UTR, Cheque No."
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Notes / Remarks</Label>
                <Input
                  placeholder="e.g. Counter payment received from customer"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Receipt / Proof Slip (Optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setProofFile(file);
                      if (file && file.type.startsWith('image/')) {
                        setProofPreview(URL.createObjectURL(file));
                      } else {
                        setProofPreview(null);
                      }
                    }}
                    className="h-8 text-xs file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-[11px] file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                  />
                  {proofFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setProofFile(null);
                        setProofPreview(null);
                      }}
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive shrink-0"
                      title="Clear attached proof"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {proofPreview && (
                  <div className="mt-1 flex items-center gap-2">
                    <img src={proofPreview} alt="Proof preview" className="h-9 w-9 object-cover rounded border border-slate-200" />
                    <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{proofFile?.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Allocation Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-emerald-600" />
                  Bill Allocation (FIFO Auto-Applied)
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  The payment amount is automatically distributed to the oldest unpaid bills first. You can also adjust manual amounts below.
                </p>
              </div>
              {parsedPaymentAmount > 0 && openInvoices.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => runFifoAllocation(parsedPaymentAmount)}
                  className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/5"
                >
                  <Sparkles className="h-3 w-3" /> Re-apply FIFO
                </Button>
              )}
            </div>

            {loadingInvoices ? (
              <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading open bills...
              </div>
            ) : openInvoices.length === 0 ? (
              <div className="p-6 text-center rounded-lg border border-dashed text-xs text-muted-foreground bg-muted/20">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto mb-2 opacity-80" />
                This customer has no open or partially paid bills!
                {parsedPaymentAmount > 0 && (
                  <p className="text-primary font-medium mt-1">
                    This ₹{parsedPaymentAmount.toLocaleString()} payment will be recorded as advance / credit on account.
                  </p>
                )}
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-[11px]">
                      <TableHead className="py-2">Bill / Date</TableHead>
                      <TableHead className="py-2">Vehicle / Job</TableHead>
                      <TableHead className="py-2 text-right">Total Bill</TableHead>
                      <TableHead className="py-2 text-right">Current Due</TableHead>
                      <TableHead className="py-2 text-right w-36">Apply Amount (₹)</TableHead>
                      <TableHead className="py-2 text-right">Remaining Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openInvoices.map((inv) => {
                      const applied = allocations[inv.id] || 0;
                      const remainingDue = Math.max(0, inv.balance - applied);
                      const isFullySettled = remainingDue <= 0.01 && applied > 0;

                      return (
                        <TableRow key={inv.id} className="text-xs">
                          <TableCell className="py-2.5 font-medium">
                            <span className="font-bold text-foreground block">
                              {inv.bill_number ? `BILL-${inv.bill_number}` : "Draft Bill"}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {format(new Date(inv.created_at), "dd MMM yyyy")}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5 text-[11px]">
                            {inv.vehicle_number ? (
                              <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 h-4">
                                {inv.vehicle_number}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                            {inv.service_type && (
                              <span className="block text-[10px] text-muted-foreground truncate max-w-[140px]">
                                {inv.service_type}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5 text-right font-mono text-muted-foreground">
                            ₹{inv.total.toLocaleString()}
                          </TableCell>
                          <TableCell className="py-2.5 text-right font-mono font-semibold text-destructive">
                            ₹{inv.balance.toLocaleString()}
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1.5 text-[11px] text-muted-foreground">₹</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max={inv.balance}
                                value={allocations[inv.id] !== undefined ? allocations[inv.id] : 0}
                                onChange={(e) => handleManualAllocationChange(inv.id, e.target.value)}
                                className={`h-7 pl-6 text-right font-mono text-xs font-bold ${
                                  applied > 0 ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300" : ""
                                }`}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 text-right font-mono">
                            {isFullySettled ? (
                              <Badge className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 text-[10px] h-5">
                                Fully Paid
                              </Badge>
                            ) : (
                              <span className="text-xs font-semibold text-foreground">
                                ₹{remainingDue.toFixed(2)}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Allocation Summary Bar */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-muted/40 border text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Amount Received
                </span>
                <span className="text-sm font-extrabold text-foreground font-mono">
                  ₹{parsedPaymentAmount.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Allocated to Bills
                </span>
                <span className="text-sm font-extrabold text-emerald-600 font-mono">
                  ₹{totalAllocated.toLocaleString()}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  {overAllocatedAmount > 0.01 ? "Over-allocated" : "Unallocated (Advance)"}
                </span>
                <span
                  className={`text-sm font-extrabold font-mono ${
                    overAllocatedAmount > 0.01 ? "text-destructive" : "text-primary"
                  }`}
                >
                  ₹{overAllocatedAmount > 0.01 ? overAllocatedAmount.toFixed(2) : unallocatedAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {overAllocatedAmount > 0.01 && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  The allocated total exceeds the payment amount. Please reduce bill amounts or increase payment amount.
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t pt-3 flex flex-row items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || parsedPaymentAmount <= 0 || overAllocatedAmount > 0.01}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving Payment...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> Confirm & Record Payment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
