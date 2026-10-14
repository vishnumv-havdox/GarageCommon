import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Download,
  ExternalLink,
  Printer,
  Calendar,
  User,
  Phone,
  IndianRupee,
  Building2,
  Receipt,
} from "lucide-react";
import { GarageExpense, EXPENSE_CATEGORIES } from "@/types/expenses";

interface ViewBillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: GarageExpense | null;
}

export function ViewBillModal({
  open,
  onOpenChange,
  expense,
}: ViewBillModalProps) {
  if (!expense) return null;

  const isPdf =
    expense.receipt_type === "application/pdf" ||
    expense.receipt_name?.toLowerCase().endsWith(".pdf") ||
    expense.receipt_url?.includes(".pdf");

  const handlePrint = () => {
    if (!expense.receipt_url) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    if (isPdf) {
      printWindow.location.href = expense.receipt_url;
    } else {
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt - ${expense.expense_number || "EXP"}</title>
            <style>
              body { font-family: sans-serif; padding: 20px; text-align: center; }
              img { max-width: 100%; max-height: 80vh; margin-top: 20px; border: 1px solid #ccc; }
              .header { text-align: left; max-width: 600px; margin: 0 auto; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>${expense.title}</h2>
              <p><strong>Voucher:</strong> ${expense.expense_number || "-"} | <strong>Date:</strong> ${expense.expense_date}</p>
              <p><strong>Amount:</strong> ₹${expense.amount.toLocaleString()} | <strong>Vendor:</strong> ${expense.vendor_name || "-"}</p>
              ${expense.employee_name ? `<p><strong>Paid by Staff:</strong> ${expense.employee_name} (${expense.employee_phone || "-"})</p>` : ""}
            </div>
            <img src="${expense.receipt_url}" onload="window.print();" />
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleDownload = () => {
    if (!expense.receipt_url) return;
    const link = document.createElement("a");
    link.href = expense.receipt_url;
    link.download = expense.receipt_name || `${expense.expense_number || "expense"}_bill`;
    link.target = "_blank";
    link.click();
  };

  const categoryMeta = EXPENSE_CATEGORIES.find((c) => c.key === expense.category);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-bold">
                  {expense.title}
                </DialogTitle>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {expense.expense_number || "EXP-VOUCHER"}
                </Badge>
              </div>
              <DialogDescription className="text-xs mt-0.5">
                Expense bill & documentation voucher
              </DialogDescription>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-rose-600">
                ₹{expense.amount.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase font-bold">
                {expense.payment_mode}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Expense Metadata Bar */}
        <div className="p-3 bg-muted/30 border border-border/60 rounded-xl space-y-2 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                Date Spent
              </span>
              <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                <Calendar className="h-3 w-3 text-muted-foreground" /> {expense.expense_date}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                Category
              </span>
              <span className="font-semibold text-foreground block mt-0.5">
                {categoryMeta?.label || expense.category}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                Vendor / Payee
              </span>
              <span className="font-semibold text-foreground block mt-0.5 truncate">
                {expense.vendor_name || "General"}
              </span>
            </div>
          </div>

          {/* Employee Spender Info if applicable */}
          {expense.spent_by_type === "employee" && (
            <div className="pt-2 border-t border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-muted-foreground">Paid by Employee:</span>
                <span className="font-bold text-foreground">
                  {expense.employee_name || "Staff Member"}
                </span>
                {expense.employee_phone && (
                  <span className="text-muted-foreground flex items-center gap-0.5 ml-1">
                    (<Phone className="h-2.5 w-2.5" /> {expense.employee_phone})
                  </span>
                )}
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] font-bold ${
                  expense.is_reimbursed
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {expense.is_reimbursed ? "Reimbursed to Staff" : "Pending Reimbursement"}
              </Badge>
            </div>
          )}
        </div>

        {/* Bill Preview Area */}
        <div className="space-y-2 pt-1">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Attached Bill Document</span>
            {expense.receipt_name && (
              <span className="text-[11px] font-normal lowercase text-muted-foreground">
                {expense.receipt_name}
              </span>
            )}
          </div>

          {expense.receipt_url ? (
            <div className="border border-border/70 rounded-xl overflow-hidden bg-muted/10 p-2 text-center">
              {isPdf ? (
                <div className="py-12 space-y-3">
                  <FileText className="h-14 w-14 text-rose-500 mx-auto" />
                  <div>
                    <div className="text-sm font-bold text-foreground">
                      PDF Bill Attached
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {expense.receipt_name || "Invoice / Bill Document"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(expense.receipt_url, "_blank")}
                    className="text-xs gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open PDF in New Tab
                  </Button>
                </div>
              ) : (
                <div className="relative group max-h-[50vh] overflow-auto flex items-center justify-center bg-black/5 dark:bg-white/5 rounded-lg p-2">
                  <img
                    src={expense.receipt_url}
                    alt="Receipt Bill"
                    className="max-h-[46vh] max-w-full object-contain rounded shadow-sm"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground text-xs space-y-1">
              <Receipt className="h-8 w-8 mx-auto opacity-40 text-muted-foreground" />
              <p className="font-medium">No Bill Document Attached</p>
              <p className="text-[11px] opacity-70">
                This expense was logged without a physical receipt photo.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          {expense.receipt_url && (
            <div className="flex items-center gap-2 mr-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="text-xs gap-1"
              >
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="text-xs gap-1"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            </div>
          )}
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
