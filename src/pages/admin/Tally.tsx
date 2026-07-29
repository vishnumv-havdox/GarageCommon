import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format, subDays } from "date-fns";
import { 
  Download, 
  FileSpreadsheet, 
  FileCode, 
  Settings2, 
  Receipt, 
  Calendar, 
  Search, 
  ArrowUpDown,
  BookOpen
} from "lucide-react";

export default function AdminTally() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  
  // Date Filters
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));
  
  // Export Configurations (Stored in LocalStorage)
  const [ledgerMap, setLedgerMap] = useState({
    salesLedger: localStorage.getItem("tally_sales_ledger") || "Sales Account",
    cgstLedger: localStorage.getItem("tally_cgst_ledger") || "CGST",
    sgstLedger: localStorage.getItem("tally_sgst_ledger") || "SGST",
    igstLedger: localStorage.getItem("tally_igst_ledger") || "IGST",
    roundOffLedger: localStorage.getItem("tally_round_off_ledger") || "Round Off",
    bankLedger: localStorage.getItem("tally_bank_ledger") || "Bank A/c",
  });

  const [exportType, setExportType] = useState<"sales" | "receipts">("sales");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchInvoices();
  }, [fromDate, toDate, statusFilter]);

  // Load settings on mount to ensure fresh ledger mappings
  useEffect(() => {
    setLedgerMap({
      salesLedger: localStorage.getItem("tally_sales_ledger") || "Sales Account",
      cgstLedger: localStorage.getItem("tally_cgst_ledger") || "CGST",
      sgstLedger: localStorage.getItem("tally_sgst_ledger") || "SGST",
      igstLedger: localStorage.getItem("tally_igst_ledger") || "IGST",
      roundOffLedger: localStorage.getItem("tally_round_off_ledger") || "Round Off",
      bankLedger: localStorage.getItem("tally_bank_ledger") || "Bank A/c",
    });
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("invoices")
        .select(`
          *,
          customer:customers(name, company_name, phone),
          work_order:work_orders(
            vehicle:vehicles(vehicle_number, model)
          )
        `)
        .gte("created_at", `${fromDate}T00:00:00Z`)
        .lte("created_at", `${toDate}T23:59:59Z`)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setInvoices(data || []);
    } catch (err: any) {
      console.error("Error fetching invoices for Tally:", err);
      toast({
        variant: "destructive",
        title: "Error fetching data",
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Option A - Export Columnar CSV
  const handleExportColumnarCSV = () => {
    if (invoices.length === 0) {
      toast({ variant: "destructive", title: "No data", description: "No invoices found in selected range." });
      return;
    }

    const headers = [
      "Date",
      "Voucher No",
      "Voucher Type",
      "Party Ledger Name",
      "Sales Ledger Name",
      "Taxable Value",
      "CGST Ledger",
      "CGST Amount",
      "SGST Ledger",
      "SGST Amount",
      "IGST Ledger",
      "IGST Amount",
      "Round Off Ledger",
      "Round Off Amount",
      "Gross Total",
      "Narration"
    ];

    const rows = invoices.map(inv => {
      const partyName = inv.customer?.company_name || inv.customer?.name || "Suspense Ledger";
      const invoiceDate = format(new Date(inv.created_at), "dd-MM-yyyy");
      const vchNo = inv.bill_number ? `Bill-${inv.bill_number}` : inv.invoice_number;
      
      const subtotal = inv.subtotal || 0;
      const taxTotal = inv.tax || 0;
      const cgst = Number((taxTotal / 2).toFixed(2));
      const sgst = Number((taxTotal / 2).toFixed(2));
      const total = inv.total || 0;
      
      // Calculate Round Off
      const roundOff = Number((total - (subtotal + taxTotal)).toFixed(2));
      const vehicleInfo = inv.work_order?.vehicle ? `(Vehicle: ${inv.work_order.vehicle.vehicle_number} ${inv.work_order.vehicle.model})` : "";
      const narration = `Sales Invoice ${vchNo} ${vehicleInfo}`.trim();

      if (exportType === "sales") {
        return [
          invoiceDate,
          vchNo,
          "Sales",
          partyName,
          ledgerMap.salesLedger,
          subtotal.toFixed(2),
          ledgerMap.cgstLedger,
          cgst.toFixed(2),
          ledgerMap.sgstLedger,
          sgst.toFixed(2),
          ledgerMap.igstLedger,
          "0.00",
          ledgerMap.roundOffLedger,
          roundOff.toFixed(2),
          total.toFixed(2),
          narration
        ];
      } else {
        // Receipt Voucher
        return [
          invoiceDate,
          `RCPT-${vchNo}`,
          "Receipt",
          partyName,
          ledgerMap.bankLedger,
          total.toFixed(2),
          "", "", "", "", "", "", "", "", 
          total.toFixed(2),
          `Payment received for ${vchNo}`
        ];
      }
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    downloadFile(csvContent, `Tally_${exportType}_columnar_${fromDate}_to_${toDate}.csv`, "text/csv");
  };

  // Option A - Export Multi-Row Journal/Voucher CSV
  const handleExportMultiRowCSV = () => {
    if (invoices.length === 0) {
      toast({ variant: "destructive", title: "No data", description: "No invoices found in selected range." });
      return;
    }

    const headers = ["Date", "Voucher No", "Voucher Type", "Ledger Name", "Debit Amount", "Credit Amount", "Narration"];
    const rows: any[] = [];

    invoices.forEach(inv => {
      const partyName = inv.customer?.company_name || inv.customer?.name || "Suspense Ledger";
      const invoiceDate = format(new Date(inv.created_at), "dd-MM-yyyy");
      const vchNo = inv.bill_number ? `Bill-${inv.bill_number}` : inv.invoice_number;
      
      const subtotal = inv.subtotal || 0;
      const taxTotal = inv.tax || 0;
      const cgst = Number((taxTotal / 2).toFixed(2));
      const sgst = Number((taxTotal / 2).toFixed(2));
      const total = inv.total || 0;
      const roundOff = Number((total - (subtotal + taxTotal)).toFixed(2));
      
      const vehicleInfo = inv.work_order?.vehicle ? `(Vehicle: ${inv.work_order.vehicle.vehicle_number} ${inv.work_order.vehicle.model})` : "";
      const narration = `Invoice ${vchNo} ${vehicleInfo}`.trim();

      if (exportType === "sales") {
        // 1. Customer Ledger Debit
        rows.push([invoiceDate, vchNo, "Sales", partyName, total.toFixed(2), "0.00", narration]);
        
        // 2. Sales Credit
        rows.push([invoiceDate, vchNo, "Sales", ledgerMap.salesLedger, "0.00", subtotal.toFixed(2), narration]);
        
        // 3. CGST Credit
        if (cgst > 0) {
          rows.push([invoiceDate, vchNo, "Sales", ledgerMap.cgstLedger, "0.00", cgst.toFixed(2), narration]);
        }
        
        // 4. SGST Credit
        if (sgst > 0) {
          rows.push([invoiceDate, vchNo, "Sales", ledgerMap.sgstLedger, "0.00", sgst.toFixed(2), narration]);
        }
        
        // 5. Round Off Debit/Credit
        if (roundOff !== 0) {
          const dr = roundOff > 0 ? "0.00" : Math.abs(roundOff).toFixed(2);
          const cr = roundOff > 0 ? roundOff.toFixed(2) : "0.00";
          rows.push([invoiceDate, vchNo, "Sales", ledgerMap.roundOffLedger, dr, cr, narration]);
        }
      } else {
        // Receipt Voucher Multi-Row
        // 1. Bank Debit
        rows.push([invoiceDate, `RCPT-${vchNo}`, "Receipt", ledgerMap.bankLedger, total.toFixed(2), "0.00", `Payment recd for ${vchNo}`]);
        // 2. Customer Credit
        rows.push([invoiceDate, `RCPT-${vchNo}`, "Receipt", partyName, "0.00", total.toFixed(2), `Payment recd for ${vchNo}`]);
      }
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    downloadFile(csvContent, `Tally_${exportType}_multirow_${fromDate}_to_${toDate}.csv`, "text/csv");
  };

  // Option B - Export Tally XML
  const handleExportXML = () => {
    if (invoices.length === 0) {
      toast({ variant: "destructive", title: "No data", description: "No invoices found in selected range." });
      return;
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE>\n  <HEADER>\n    <TALLYREQUEST>Import Data</TALLYREQUEST>\n  </HEADER>\n  <BODY>\n    <IMPORTDATA>\n      <REQUESTDESC>\n        <REPORTNAME>Vouchers</REPORTNAME>\n      </REQUESTDESC>\n      <REQUESTDATA>\n`;

    invoices.forEach(inv => {
      const partyName = escapeXml(inv.customer?.company_name || inv.customer?.name || "Suspense Ledger");
      const invoiceDate = format(new Date(inv.created_at), "yyyyMMdd");
      const vchNo = escapeXml(inv.bill_number ? `Bill-${inv.bill_number}` : inv.invoice_number);
      
      const subtotal = inv.subtotal || 0;
      const taxTotal = inv.tax || 0;
      const cgst = Number((taxTotal / 2).toFixed(2));
      const sgst = Number((taxTotal / 2).toFixed(2));
      const total = inv.total || 0;
      const roundOff = Number((total - (subtotal + taxTotal)).toFixed(2));
      
      const vehicleInfo = inv.work_order?.vehicle ? `Vehicle: ${inv.work_order.vehicle.vehicle_number} ${inv.work_order.vehicle.model}` : "";
      const narration = escapeXml(`Invoice ${vchNo} ${vehicleInfo}`.trim());

      if (exportType === "sales") {
        xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
        xml += `          <VOUCHER VCHTYPE="Sales" ACTION="Create">\n`;
        xml += `            <DATE>${invoiceDate}</DATE>\n`;
        xml += `            <VOUCHERNUMBER>${vchNo}</VOUCHERNUMBER>\n`;
        xml += `            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>\n`;
        xml += `            <PARTYLEDGERNAME>${partyName}</PARTYLEDGERNAME>\n`;
        xml += `            <NARRATION>${narration}</NARRATION>\n`;
        
        // Ledger Entries list (Customer Dr, Sales/GST Cr)
        // Customer Entry (Debit - Positive inside Tally XML requires negative prefix)
        xml += `            <ALLLEDGERENTRIES.LIST>\n`;
        xml += `              <LEDGERNAME>${partyName}</LEDGERNAME>\n`;
        xml += `              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>\n`;
        xml += `              <AMOUNT>-${total.toFixed(2)}</AMOUNT>\n`;
        xml += `            </ALLLEDGERENTRIES.LIST>\n`;
        
        // Sales Entry (Credit)
        xml += `            <ALLLEDGERENTRIES.LIST>\n`;
        xml += `              <LEDGERNAME>${escapeXml(ledgerMap.salesLedger)}</LEDGERNAME>\n`;
        xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
        xml += `              <AMOUNT>${subtotal.toFixed(2)}</AMOUNT>\n`;
        xml += `            </ALLLEDGERENTRIES.LIST>\n`;
        
        // CGST Entry
        if (cgst > 0) {
          xml += `            <ALLLEDGERENTRIES.LIST>\n`;
          xml += `              <LEDGERNAME>${escapeXml(ledgerMap.cgstLedger)}</LEDGERNAME>\n`;
          xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
          xml += `              <AMOUNT>${cgst.toFixed(2)}</AMOUNT>\n`;
          xml += `            </ALLLEDGERENTRIES.LIST>\n`;
        }

        // SGST Entry
        if (sgst > 0) {
          xml += `            <ALLLEDGERENTRIES.LIST>\n`;
          xml += `              <LEDGERNAME>${escapeXml(ledgerMap.sgstLedger)}</LEDGERNAME>\n`;
          xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
          xml += `              <AMOUNT>${sgst.toFixed(2)}</AMOUNT>\n`;
          xml += `            </ALLLEDGERENTRIES.LIST>\n`;
        }

        // Round Off Entry
        if (roundOff !== 0) {
          xml += `            <ALLLEDGERENTRIES.LIST>\n`;
          xml += `              <LEDGERNAME>${escapeXml(ledgerMap.roundOffLedger)}</LEDGERNAME>\n`;
          // If negative, it means we debit roundoff. Positive roundoff inside Tally XML needs positive amount.
          const isDeemedPos = roundOff < 0 ? "Yes" : "No";
          xml += `              <ISDEEMEDPOSITIVE>${isDeemedPos}</ISDEEMEDPOSITIVE>\n`;
          xml += `              <AMOUNT>${roundOff.toFixed(2)}</AMOUNT>\n`;
          xml += `            </ALLLEDGERENTRIES.LIST>\n`;
        }

        xml += `          </VOUCHER>\n`;
        xml += `        </TALLYMESSAGE>\n`;
      } else {
        // XML for Receipt Voucher
        xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
        xml += `          <VOUCHER VCHTYPE="Receipt" ACTION="Create">\n`;
        xml += `            <DATE>${invoiceDate}</DATE>\n`;
        xml += `            <VOUCHERNUMBER>RCPT-${vchNo}</VOUCHERNUMBER>\n`;
        xml += `            <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>\n`;
        xml += `            <PARTYLEDGERNAME>${escapeXml(ledgerMap.bankLedger)}</PARTYLEDGERNAME>\n`;
        xml += `            <NARRATION>Payment received for invoice ${vchNo}</NARRATION>\n`;
        
        // Bank Ledger entry (Dr)
        xml += `            <ALLLEDGERENTRIES.LIST>\n`;
        xml += `              <LEDGERNAME>${escapeXml(ledgerMap.bankLedger)}</LEDGERNAME>\n`;
        xml += `              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>\n`;
        xml += `              <AMOUNT>-${total.toFixed(2)}</AMOUNT>\n`;
        xml += `            </ALLLEDGERENTRIES.LIST>\n`;
        
        // Customer Ledger entry (Cr)
        xml += `            <ALLLEDGERENTRIES.LIST>\n`;
        xml += `              <LEDGERNAME>${partyName}</LEDGERNAME>\n`;
        xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
        xml += `              <AMOUNT>${total.toFixed(2)}</AMOUNT>\n`;
        xml += `            </ALLLEDGERENTRIES.LIST>\n`;
        
        xml += `          </VOUCHER>\n`;
        xml += `        </TALLYMESSAGE>\n`;
      }
    });

    xml += `      </REQUESTDATA>\n    </IMPORTDATA>\n  </BODY>\n</ENVELOPE>`;

    downloadFile(xml, `Tally_${exportType}_export_${fromDate}_to_${toDate}.xml`, "application/xml");
  };

  const downloadFile = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: `${contentType};charset=utf-8;` });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const escapeXml = (unsafe: string) => {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case "<": return "&lt;";
        case ">": return "&gt;";
        case "&": return "&amp;";
        case "'": return "&apos;";
        case '"': return "&quot;";
        default: return c;
      }
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col lg:flex-row">
        <AdminSidebar />
        
        <main className="flex-1 p-4 lg:p-8 space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <BookOpen className="h-8 w-8 text-primary" />
                Tally Integration
              </h1>
              <p className="text-muted-foreground">Map ledgers and export billing transactions directly into Tally Prime</p>
            </div>
            <Button variant="outline" className="gap-2" onClick={() => navigate("/admin/settings?tab=tally")}>
              <Settings2 className="h-4 w-4 text-primary" />
              Configure Ledgers
            </Button>
          </div>

          <div className="space-y-6">
            <Card className="shadow-lg border-primary/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" />
                    Export Filters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>From Date</Label>
                      <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>To Date</Label>
                      <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Invoice Status</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="Draft">Draft</SelectItem>
                          <SelectItem value="Generated">Generated (Pending)</SelectItem>
                          <SelectItem value="Paid">Paid</SelectItem>
                          <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Voucher Type</Label>
                      <Select value={exportType} onValueChange={(val: any) => setExportType(val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sales Invoices" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sales">Sales Invoices</SelectItem>
                          <SelectItem value="receipts">Receipt Vouchers</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t">
                    <Button variant="outline" className="gap-2" onClick={handleExportColumnarCSV}>
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                      Export Columnar CSV
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={handleExportMultiRowCSV}>
                      <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                      Export Multi-Row CSV
                    </Button>
                    <Button variant="default" className="gap-2" onClick={handleExportXML}>
                      <FileCode className="h-4 w-4" />
                      Export Tally XML (.xml)
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Data Table */}
              <Card className="shadow-lg border-primary/10 overflow-hidden">
                <CardHeader className="border-b bg-muted/20">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-lg">Invoices in Range</CardTitle>
                      <CardDescription>Review transactions before Tally generation</CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-primary/5 text-primary text-xs font-semibold px-3 py-1">
                      {invoices.length} Invoices
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-[400px]">
                    <Table>
                      <TableHeader className="bg-muted/10 sticky top-0 z-10">
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Bill No</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                          <TableHead className="text-right">Tax</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground animate-pulse">
                              Loading transactions...
                            </TableCell>
                          </TableRow>
                        ) : invoices.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No invoices found matching criteria.
                            </TableCell>
                          </TableRow>
                        ) : (
                          invoices.map((inv) => (
                            <TableRow key={inv.id} className="hover:bg-muted/40 transition-colors">
                              <TableCell className="font-medium">
                                {format(new Date(inv.created_at), "dd-MM-yyyy")}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {inv.bill_number ? `Bill-${inv.bill_number}` : inv.invoice_number}
                              </TableCell>
                              <TableCell className="max-w-[150px] truncate">
                                <div className="font-medium text-sm truncate">
                                  {inv.customer?.company_name || inv.customer?.name}
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {inv.work_order?.vehicle?.vehicle_number || "No Vehicle"}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                ₹{(inv.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right">
                                ₹{(inv.tax || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right font-bold text-primary">
                                ₹{(inv.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge 
                                  variant={inv.status === "Paid" ? "default" : inv.status === "Draft" ? "secondary" : "outline"}
                                  className={
                                    inv.status === "Paid" 
                                      ? "bg-emerald-100 text-emerald-800 border-emerald-200" 
                                      : inv.status === "Cancelled" 
                                      ? "bg-red-100 text-red-800 border-red-200"
                                      : ""
                                  }
                                >
                                  {inv.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
