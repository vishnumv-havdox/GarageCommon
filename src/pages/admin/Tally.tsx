import { useState, useEffect, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { 
  format, 
  subDays, 
  startOfWeek, 
  startOfMonth, 
  endOfMonth, 
  subMonths 
} from "date-fns";
import { 
  Download, 
  FileSpreadsheet, 
  FileCode, 
  Settings2, 
  Receipt, 
  Calendar, 
  Search, 
  ArrowUpDown,
  BookOpen,
  Zap,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Users,
  CheckSquare,
  HelpCircle,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Server
} from "lucide-react";
import {
  LedgerMap,
  generateCustomersXml,
  generateVouchersXml,
  generateColumnarCsv,
  generateMultiRowCsv,
  sendXmlToTally,
  testTallyConnection,
  downloadFile
} from "@/utils/tallySync";

export default function AdminTally() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Date Filters
  const [fromDate, setFromDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [syncStatusFilter, setSyncStatusFilter] = useState<"all" | "pending" | "synced">("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [exportType, setExportType] = useState<"sales" | "receipts">("sales");

  // Direct Tally Connection Config
  const [tallyUrl, setTallyUrl] = useState(localStorage.getItem("tally_endpoint_url") || "http://localhost:9000");
  const [tallyStatus, setTallyStatus] = useState<"unknown" | "checking" | "connected" | "disconnected">("unknown");
  const [tallyCompany, setTallyCompany] = useState<string | null>(null);
  const [syncingDirect, setSyncingDirect] = useState(false);
  const [syncSummary, setSyncSummary] = useState<{
    lastAction?: string;
    success?: boolean;
    created?: number;
    altered?: number;
    errors?: number;
    message?: string;
  } | null>(null);

  // Ledger Configurations
  const [ledgerMap, setLedgerMap] = useState<LedgerMap>({
    salesLedger: localStorage.getItem("tally_sales_ledger") || "Sales Account",
    cgstLedger: localStorage.getItem("tally_cgst_ledger") || "CGST",
    sgstLedger: localStorage.getItem("tally_sgst_ledger") || "SGST",
    igstLedger: localStorage.getItem("tally_igst_ledger") || "IGST",
    roundOffLedger: localStorage.getItem("tally_round_off_ledger") || "Round Off",
    bankLedger: localStorage.getItem("tally_bank_ledger") || "Bank A/c",
  });
  const [showLedgerSettings, setShowLedgerSettings] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);

  // Fetch Invoices on filter change
  useEffect(() => {
    fetchInvoices();
  }, [fromDate, toDate, syncStatusFilter, paymentStatusFilter]);

  // Initial connection test
  useEffect(() => {
    checkConnection();
  }, [tallyUrl]);

  const checkConnection = async () => {
    setTallyStatus("checking");
    try {
      const res = await testTallyConnection(tallyUrl);
      if (res.connected) {
        setTallyStatus("connected");
        setTallyCompany(res.companyName || "Tally Prime Active");
      } else {
        setTallyStatus("disconnected");
        setTallyCompany(null);
      }
    } catch {
      setTallyStatus("disconnected");
      setTallyCompany(null);
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("invoices")
        .select(`
          *,
          customer:customers(id, name, company_name, phone, email, address, gst_number),
          work_order:work_orders(
            vehicle:vehicles(vehicle_number, model)
          )
        `)
        .gte("created_at", `${fromDate}T00:00:00Z`)
        .lte("created_at", `${toDate}T23:59:59Z`)
        .order("created_at", { ascending: false });

      if (paymentStatusFilter !== "all") {
        query = query.eq("status", paymentStatusFilter);
      }

      if (syncStatusFilter === "pending") {
        query = query.or("tally_synced.is.null,tally_synced.eq.false");
      } else if (syncStatusFilter === "synced") {
        query = query.eq("tally_synced", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      setInvoices(data || []);
      // Clear selections that are no longer in data
      setSelectedIds(prev => prev.filter(id => (data || []).some(inv => inv.id === id)));
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

  // Quick Date Presets
  const setDatePreset = (preset: "today" | "yesterday" | "this_week" | "this_month" | "last_month") => {
    const today = new Date();
    if (preset === "today") {
      const d = format(today, "yyyy-MM-dd");
      setFromDate(d);
      setToDate(d);
    } else if (preset === "yesterday") {
      const y = format(subDays(today, 1), "yyyy-MM-dd");
      setFromDate(y);
      setToDate(y);
    } else if (preset === "this_week") {
      setFromDate(format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"));
      setToDate(format(today, "yyyy-MM-dd"));
    } else if (preset === "this_month") {
      setFromDate(format(startOfMonth(today), "yyyy-MM-dd"));
      setToDate(format(today, "yyyy-MM-dd"));
    } else if (preset === "last_month") {
      const prev = subMonths(today, 1);
      setFromDate(format(startOfMonth(prev), "yyyy-MM-dd"));
      setToDate(format(endOfMonth(prev), "yyyy-MM-dd"));
    }
  };

  // Filtered invoices by search term
  const filteredInvoices = useMemo(() => {
    if (!searchQuery.trim()) return invoices;
    const q = searchQuery.toLowerCase().trim();
    return invoices.filter((inv) => {
      const billNo = (inv.bill_number ? `bill-${inv.bill_number}` : inv.invoice_number || "").toLowerCase();
      const customerName = (inv.customer?.company_name || inv.customer?.name || "").toLowerCase();
      const phone = (inv.customer?.phone || "").toLowerCase();
      const vehicle = (inv.work_order?.vehicle?.vehicle_number || "").toLowerCase();
      return billNo.includes(q) || customerName.includes(q) || phone.includes(q) || vehicle.includes(q);
    });
  }, [invoices, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const totalAmount = invoices.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
    const pendingCount = invoices.filter(i => !i.tally_synced).length;
    const syncedCount = invoices.filter(i => i.tally_synced).length;
    return {
      totalCount: invoices.length,
      totalAmount,
      pendingCount,
      syncedCount
    };
  }, [invoices]);

  // Checkbox handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredInvoices.map(i => i.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  // Save Ledger Settings
  const handleSaveLedgers = () => {
    localStorage.setItem("tally_sales_ledger", ledgerMap.salesLedger);
    localStorage.setItem("tally_cgst_ledger", ledgerMap.cgstLedger);
    localStorage.setItem("tally_sgst_ledger", ledgerMap.sgstLedger);
    localStorage.setItem("tally_igst_ledger", ledgerMap.igstLedger);
    localStorage.setItem("tally_round_off_ledger", ledgerMap.roundOffLedger);
    localStorage.setItem("tally_bank_ledger", ledgerMap.bankLedger);
    localStorage.setItem("tally_endpoint_url", tallyUrl);
    setShowLedgerSettings(false);
    toast({
      title: "Settings Saved",
      description: "Tally server configuration and ledger mappings updated successfully.",
    });
  };

  // --- OPTION 1: 1-CLICK DIRECT SYNC TO TALLY ---
  const handleDirectSync = async (targetInvoices: any[]) => {
    if (targetInvoices.length === 0) {
      toast({
        variant: "destructive",
        title: "No Invoices Selected",
        description: "Please select or filter invoices to sync into Tally."
      });
      return;
    }

    setSyncingDirect(true);
    setSyncSummary(null);

    try {
      const xml = generateVouchersXml(targetInvoices, ledgerMap, exportType);
      const result = await sendXmlToTally(xml, tallyUrl, true);

      if (result.success || result.created > 0) {
        // Mark as synced in Supabase
        const idsToUpdate = targetInvoices.map(i => i.id);
        const { error } = await supabase
          .from("invoices")
          .update({
            tally_synced: true,
            tally_synced_at: new Date().toISOString()
          })
          .in("id", idsToUpdate);

        if (error) console.error("Error updating tally_synced in DB:", error);

        // Update local state
        setInvoices(prev => prev.map(inv => idsToUpdate.includes(inv.id) ? { ...inv, tally_synced: true, tally_synced_at: new Date().toISOString() } : inv));
        setSelectedIds([]);

        setSyncSummary({
          lastAction: "Invoice Voucher Sync",
          success: true,
          created: result.created,
          altered: result.altered,
          errors: result.errors,
          message: `Successfully pushed ${result.created || targetInvoices.length} vouchers directly into Tally Prime!`
        });

        toast({
          title: "⚡ Direct Sync Completed",
          description: `Pushed ${targetInvoices.length} invoices to Tally Prime successfully.`,
        });
      } else {
        setSyncSummary({
          lastAction: "Invoice Voucher Sync",
          success: false,
          created: result.created,
          altered: result.altered,
          errors: result.errors,
          message: result.errorMessage || "Tally Prime rejected the voucher XML or port 9000 is unreachable."
        });

        toast({
          variant: "destructive",
          title: "Direct Sync Failed",
          description: result.errorMessage || "Could not push to Tally Prime. Check if Tally is open with port 9000.",
        });
      }
    } catch (err: any) {
      setSyncSummary({
        lastAction: "Invoice Voucher Sync",
        success: false,
        created: 0,
        altered: 0,
        errors: 1,
        message: err.message
      });
      toast({
        variant: "destructive",
        title: "Sync Error",
        description: err.message,
      });
    } finally {
      setSyncingDirect(false);
    }
  };

  // Direct Sync Customer Masters into Tally
  const handleSyncCustomerMastersDirect = async () => {
    setSyncingDirect(true);
    setSyncSummary(null);
    try {
      const { data: customerData, error } = await supabase
        .from("customers")
        .select("id, name, company_name, phone, email, address, gst_number")
        .order("name", { ascending: true });

      if (error) throw error;
      if (!customerData || customerData.length === 0) {
        toast({ title: "No Customers", description: "No customer records found to sync." });
        return;
      }

      const xml = generateCustomersXml(customerData);
      const result = await sendXmlToTally(xml, tallyUrl, true);

      if (result.success || result.created > 0 || (result.altered > 0 && result.errors === 0)) {
        setSyncSummary({
          lastAction: "Customer Masters Sync",
          success: true,
          created: result.created,
          altered: result.altered,
          errors: result.errors,
          message: `Synced ${customerData.length} customer ledgers under 'Sundry Debtors' in Tally Prime!`
        });
        toast({
          title: "Customer Ledgers Synced",
          description: `Customer master accounts updated in Tally Prime.`,
        });
      } else {
        setSyncSummary({
          lastAction: "Customer Masters Sync",
          success: false,
          created: result.created,
          altered: result.altered,
          errors: result.errors,
          message: result.errorMessage || "Tally Prime rejected the customer master XML."
        });
        toast({
          variant: "destructive",
          title: "Master Sync Failed",
          description: result.errorMessage || "Unable to sync customer masters to Tally.",
        });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error Syncing Masters",
        description: err.message,
      });
    } finally {
      setSyncingDirect(false);
    }
  };

  // --- OPTION 2: STREAMLINED FILE EXPORTS ---
  const handleExportVouchersXml = (targetInvoices: any[]) => {
    if (targetInvoices.length === 0) {
      toast({ variant: "destructive", title: "No Invoices", description: "No invoices to export." });
      return;
    }
    const xml = generateVouchersXml(targetInvoices, ledgerMap, exportType);
    downloadFile(xml, `Tally_${exportType}_vouchers_${fromDate}_to_${toDate}.xml`, "application/xml");
    toast({
      title: "XML Downloaded",
      description: `Downloaded ${targetInvoices.length} vouchers ready for Tally Prime Import.`,
    });
  };

  const handleExportCustomersXml = async () => {
    try {
      const { data: customerData, error } = await supabase
        .from("customers")
        .select("id, name, company_name, phone, email, address, gst_number")
        .order("name", { ascending: true });

      if (error) throw error;
      if (!customerData || customerData.length === 0) {
        toast({ title: "No Customers", description: "No customers found." });
        return;
      }

      const xml = generateCustomersXml(customerData);
      downloadFile(xml, `Tally_Customer_Masters_${format(new Date(), "yyyy-MM-dd")}.xml`, "application/xml");
      toast({
        title: "Customer Masters XML Exported",
        description: `Exported ${customerData.length} customer ledgers under Sundry Debtors.`,
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Export Failed", description: err.message });
    }
  };

  const handleExportColumnar = (targetInvoices: any[]) => {
    if (targetInvoices.length === 0) {
      toast({ variant: "destructive", title: "No Invoices", description: "No invoices to export." });
      return;
    }
    const csv = generateColumnarCsv(targetInvoices, ledgerMap, exportType);
    downloadFile(csv, `Tally_${exportType}_columnar_${fromDate}_to_${toDate}.csv`, "text/csv");
  };

  const handleExportMultiRow = (targetInvoices: any[]) => {
    if (targetInvoices.length === 0) {
      toast({ variant: "destructive", title: "No Invoices", description: "No invoices to export." });
      return;
    }
    const csv = generateMultiRowCsv(targetInvoices, ledgerMap, exportType);
    downloadFile(csv, `Tally_${exportType}_multirow_${fromDate}_to_${toDate}.csv`, "text/csv");
  };

  // Toggle or Update Sync Status in Supabase
  const handleUpdateSyncStatus = async (ids: string[], markAsSynced: boolean) => {
    try {
      const { error } = await supabase
        .from("invoices")
        .update({
          tally_synced: markAsSynced,
          tally_synced_at: markAsSynced ? new Date().toISOString() : null,
        })
        .in("id", ids);

      if (error) throw error;

      setInvoices(prev => prev.map(inv => ids.includes(inv.id) ? {
        ...inv,
        tally_synced: markAsSynced,
        tally_synced_at: markAsSynced ? new Date().toISOString() : null,
      } : inv));

      setSelectedIds([]);
      toast({
        title: markAsSynced ? "Marked as Synced" : "Marked as Unsynced",
        description: `Updated status for ${ids.length} invoice(s).`,
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update Failed", description: err.message });
    }
  };

  // Target invoices for current bulk action
  const selectedInvoicesList = useMemo(() => {
    if (selectedIds.length > 0) {
      return invoices.filter(inv => selectedIds.includes(inv.id));
    }
    return filteredInvoices;
  }, [invoices, selectedIds, filteredInvoices]);

  const unsyncedInvoicesList = useMemo(() => {
    return filteredInvoices.filter(inv => !inv.tally_synced);
  }, [filteredInvoices]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col lg:flex-row">
        <AdminSidebar />
        
        <main className="flex-1 p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-2xl border shadow-sm">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Tally Prime Integration</h1>
                  <p className="text-sm text-muted-foreground">
                    1-Click Direct Sync or Streamlined File Export for accounting
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => setShowHelpDialog(true)}
              >
                <HelpCircle className="h-4 w-4 text-primary" />
                Setup Guide
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => setShowLedgerSettings(true)}
              >
                <Settings2 className="h-4 w-4" />
                Ledger Settings
              </Button>
            </div>
          </div>

          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Bills</p>
                  <p className="text-2xl font-bold">{stats.totalCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">₹{stats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Receipt className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wider">Pending Sync</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pendingCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Needs push to Tally</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Clock className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wider">Synced to Tally</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.syncedCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Recorded in Tally</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tally Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                      tallyStatus === "connected" ? "bg-emerald-500 animate-pulse" :
                      tallyStatus === "checking" ? "bg-amber-500 animate-spin" :
                      "bg-rose-500"
                    }`} />
                    <p className="text-sm font-semibold truncate max-w-[120px]">
                      {tallyStatus === "connected" ? (tallyCompany || "Online") :
                       tallyStatus === "checking" ? "Checking..." :
                       "Offline"}
                    </p>
                  </div>
                  <button 
                    onClick={checkConnection}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 mt-1"
                  >
                    <RefreshCw className="h-3 w-3" /> Test Connection
                  </button>
                </div>
                <div className="h-10 w-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
                  <Server className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* DUAL OPTION ACTION PANEL */}
          <Tabs defaultValue="direct" className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <TabsList className="bg-muted p-1 rounded-xl">
                <TabsTrigger value="direct" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Option 1: 1-Click Direct Sync
                </TabsTrigger>
                <TabsTrigger value="export" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Download className="h-4 w-4 text-primary" />
                  Option 2: Streamlined File Export
                </TabsTrigger>
              </TabsList>

              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                Active Ledger: {ledgerMap.salesLedger}
              </Badge>
            </div>

            {/* TAB 1: 1-CLICK DIRECT SYNC */}
            <TabsContent value="direct">
              <Card className="border-amber-500/20 shadow-md bg-gradient-to-br from-card via-card to-amber-500/5">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-500" />
                        Direct Real-Time Push to Tally Prime
                      </CardTitle>
                      <CardDescription>
                        Sends vouchers directly into your running Tally Prime via HTTP (port 9000). No files to download or move!
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2 bg-background/80 px-3 py-1.5 rounded-lg border text-xs">
                      <span className="text-muted-foreground">Endpoint:</span>
                      <code className="font-mono text-primary font-semibold">{tallyUrl}</code>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-1">
                  {/* Status Banner */}
                  {tallyStatus === "connected" ? (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <div>
                          <span className="font-semibold">Tally Prime is connected!</span>
                          <span className="text-xs opacity-80 ml-2">Active Company: {tallyCompany || "Loaded"}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-emerald-500/20 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px]">
                        Ready to Sync
                      </Badge>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-sm gap-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                        <div>
                          <span className="font-semibold">Tally Prime not detected on port 9000.</span>
                          <span className="text-xs opacity-80 block sm:inline sm:ml-2">
                            Make sure Tally is open with Connectivity enabled, or use Option 2 File Export.
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={checkConnection}>
                          Retry Connection
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-primary" onClick={() => setShowHelpDialog(true)}>
                          How to enable?
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Sync Action Buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Button 
                      size="default" 
                      className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm"
                      disabled={syncingDirect || unsyncedInvoicesList.length === 0}
                      onClick={() => handleDirectSync(unsyncedInvoicesList)}
                    >
                      {syncingDirect ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      Sync All Unsynced ({unsyncedInvoicesList.length}) to Tally
                    </Button>

                    {selectedIds.length > 0 && (
                      <Button 
                        size="default" 
                        variant="secondary"
                        className="gap-2"
                        disabled={syncingDirect}
                        onClick={() => handleDirectSync(selectedInvoicesList)}
                      >
                        <CheckSquare className="h-4 w-4 text-primary" />
                        Sync Selected ({selectedIds.length}) to Tally
                      </Button>
                    )}

                    <Button 
                      variant="outline" 
                      size="default" 
                      className="gap-2 border-primary/20"
                      disabled={syncingDirect}
                      onClick={handleSyncCustomerMastersDirect}
                    >
                      <Users className="h-4 w-4 text-primary" />
                      Sync Customer Ledgers to Tally
                    </Button>
                  </div>

                  {/* Sync Result Feedback Box */}
                  {syncSummary && (
                    <div className={`p-4 rounded-xl border text-sm ${
                      syncSummary.success ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200" :
                      "bg-rose-500/10 border-rose-500/20 text-rose-900 dark:text-rose-200"
                    }`}>
                      <div className="flex items-start gap-2">
                        {syncSummary.success ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" /> : <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />}
                        <div className="space-y-1">
                          <p className="font-semibold">{syncSummary.message}</p>
                          <div className="flex gap-4 text-xs opacity-90">
                            <span>Created: <strong>{syncSummary.created || 0}</strong></span>
                            <span>Altered: <strong>{syncSummary.altered || 0}</strong></span>
                            <span>Errors: <strong>{syncSummary.errors || 0}</strong></span>
                          </div>
                          {!syncSummary.success && (
                            <p className="text-xs pt-1 opacity-80">
                              Tip: If party ledger is missing in Tally, click "Sync Customer Ledgers to Tally" first!
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: STREAMLINED FILE EXPORT */}
            <TabsContent value="export">
              <Card className="border shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Download className="h-5 w-5 text-primary" />
                    Streamlined Tally File Export (XML & Excel)
                  </CardTitle>
                  <CardDescription>
                    Export structured files to import manually into Tally Prime or share with your external accountant.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button 
                      variant="default" 
                      className="gap-2"
                      onClick={() => handleExportVouchersXml(selectedInvoicesList)}
                    >
                      <FileCode className="h-4 w-4" />
                      Export Invoices XML ({selectedInvoicesList.length})
                    </Button>

                    <Button 
                      variant="outline" 
                      className="gap-2"
                      onClick={handleExportCustomersXml}
                    >
                      <Users className="h-4 w-4 text-primary" />
                      Export Customer Masters XML
                    </Button>

                    <Button 
                      variant="outline" 
                      className="gap-2"
                      onClick={() => handleExportColumnar(selectedInvoicesList)}
                    >
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                      Export Columnar CSV
                    </Button>

                    <Button 
                      variant="outline" 
                      className="gap-2"
                      onClick={() => handleExportMultiRow(selectedInvoicesList)}
                    >
                      <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                      Export Multi-Row Journal
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    💡 <strong>Tip for accountants:</strong> In Tally Prime, press <strong>Alt + O (Import)</strong> → <strong>Transactions</strong> for invoices XML, and <strong>Masters</strong> for customer XML.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* FILTER & SEARCH BAR */}
          <Card className="border shadow-sm">
            <CardContent className="p-4 space-y-4">
              {/* Date Presets */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground mr-1">Quick Range:</span>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDatePreset("today")}>Today</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDatePreset("yesterday")}>Yesterday</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDatePreset("this_week")}>This Week</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDatePreset("this_month")}>This Month</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDatePreset("last_month")}>Last Month</Button>
              </div>

              {/* Main Filter Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">From Date</Label>
                  <Input 
                    type="date" 
                    value={fromDate} 
                    onChange={e => setFromDate(e.target.value)} 
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">To Date</Label>
                  <Input 
                    type="date" 
                    value={toDate} 
                    onChange={e => setToDate(e.target.value)} 
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tally Sync Status</Label>
                  <Select value={syncStatusFilter} onValueChange={(v: any) => setSyncStatusFilter(v)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Invoices</SelectItem>
                      <SelectItem value="pending">⏳ Pending (Unsynced)</SelectItem>
                      <SelectItem value="synced">✓ Synced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bill Payment Status</Label>
                  <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                      <SelectItem value="Generated">Generated (Pending)</SelectItem>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Search</Label>
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-3 text-muted-foreground" />
                    <Input 
                      placeholder="Bill #, Customer, Vehicle..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="h-9 pl-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* BATCH ACTION BAR (Appears when items are selected) */}
          {selectedIds.length > 0 && (
            <div className="bg-primary/10 border border-primary/20 p-3 rounded-xl flex items-center justify-between flex-wrap gap-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold">
                  {selectedIds.length} invoice(s) selected
                </span>
                <span className="text-xs text-muted-foreground">
                  (₹{selectedInvoicesList.reduce((acc, i) => acc + (Number(i.total) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })})
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button 
                  size="sm" 
                  className="h-8 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs"
                  onClick={() => handleDirectSync(selectedInvoicesList)}
                  disabled={syncingDirect}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Sync to Tally
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => handleExportVouchersXml(selectedInvoicesList)}
                >
                  <FileCode className="h-3.5 w-3.5" />
                  Download XML
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 gap-1.5 text-xs text-emerald-700 dark:text-emerald-400"
                  onClick={() => handleUpdateSyncStatus(selectedIds, true)}
                >
                  <Check className="h-3.5 w-3.5" />
                  Mark Synced
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 gap-1.5 text-xs text-amber-700 dark:text-amber-400"
                  onClick={() => handleUpdateSyncStatus(selectedIds, false)}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Mark Pending
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 text-xs text-muted-foreground"
                  onClick={() => setSelectedIds([])}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          )}

          {/* INVOICES DATA TABLE */}
          <Card className="border shadow-sm overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Invoices in Scope</CardTitle>
                <CardDescription className="text-xs">
                  Showing {filteredInvoices.length} of {invoices.length} invoices
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={fetchInvoices}
                  className="h-8 text-xs gap-1"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/10">
                      <TableHead className="w-[40px] text-center">
                        <Checkbox 
                          checked={filteredInvoices.length > 0 && selectedIds.length === filteredInvoices.length}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Bill No</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-center">Bill Status</TableHead>
                      <TableHead className="text-center">Tally Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-10 text-muted-foreground animate-pulse">
                          Loading invoices...
                        </TableCell>
                      </TableRow>
                    ) : filteredInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                          No invoices found matching criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInvoices.map((inv) => {
                        const isSelected = selectedIds.includes(inv.id);
                        return (
                          <TableRow 
                            key={inv.id} 
                            className={`hover:bg-muted/40 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                          >
                            <TableCell className="text-center">
                              <Checkbox 
                                checked={isSelected}
                                onCheckedChange={(chk: boolean) => handleSelectOne(inv.id, chk)}
                                aria-label={`Select ${inv.invoice_number}`}
                              />
                            </TableCell>
                            <TableCell className="text-xs font-medium whitespace-nowrap">
                              {format(new Date(inv.created_at), "dd-MM-yyyy")}
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold">
                              {inv.bill_number ? `Bill-${inv.bill_number}` : inv.invoice_number}
                            </TableCell>
                            <TableCell className="max-w-[160px]">
                              <div className="font-medium text-xs truncate">
                                {inv.customer?.company_name || inv.customer?.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {inv.customer?.gst_number ? `GST: ${inv.customer.gst_number}` : inv.customer?.phone || ""}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono">
                              {inv.work_order?.vehicle?.vehicle_number || "—"}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              ₹{(Number(inv.subtotal) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              ₹{(Number(inv.tax) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right text-xs font-bold text-primary">
                              ₹{(Number(inv.total) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant={inv.status === "Paid" ? "default" : "outline"}
                                className={`text-[10px] px-2 py-0.5 ${
                                  inv.status === "Paid" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200" :
                                  inv.status === "Cancelled" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200" :
                                  ""
                                }`}
                              >
                                {inv.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {inv.tally_synced ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[10px] gap-1 px-2">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Synced
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">
                                        Synced on: {inv.tally_synced_at ? format(new Date(inv.tally_synced_at), "dd-MM-yyyy HH:mm") : "Yes"}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-[10px] gap-1 px-2">
                                  <Clock className="h-3 w-3" />
                                  Pending
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                {!inv.tally_synced ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button 
                                          size="sm" 
                                          variant="ghost" 
                                          className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                                          onClick={() => handleDirectSync([inv])}
                                          disabled={syncingDirect}
                                        >
                                          <Zap className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>1-Click Direct Sync to Tally</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button 
                                          size="sm" 
                                          variant="ghost" 
                                          className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-600"
                                          onClick={() => handleUpdateSyncStatus([inv.id], false)}
                                        >
                                          <RefreshCw className="h-3 w-3" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Reset to Pending</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}

                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                        onClick={() => handleExportVouchersXml([inv])}
                                      >
                                        <Download className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Download XML</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* LEDGER SETTINGS DIALOG */}
          <Dialog open={showLedgerSettings} onOpenChange={setShowLedgerSettings}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-primary" />
                  Tally Ledger & Connection Settings
                </DialogTitle>
                <DialogDescription>
                  Map default ledger names to match your Tally Prime company chart of accounts.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tally Prime Server URL</Label>
                  <Input 
                    value={tallyUrl} 
                    onChange={e => setTallyUrl(e.target.value)} 
                    placeholder="http://localhost:9000"
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">Default port in Tally Prime connectivity is 9000.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Sales Ledger</Label>
                    <Input 
                      value={ledgerMap.salesLedger} 
                      onChange={e => setLedgerMap({ ...ledgerMap, salesLedger: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Bank / Cash Ledger</Label>
                    <Input 
                      value={ledgerMap.bankLedger} 
                      onChange={e => setLedgerMap({ ...ledgerMap, bankLedger: e.target.value })} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">CGST Ledger</Label>
                    <Input 
                      value={ledgerMap.cgstLedger} 
                      onChange={e => setLedgerMap({ ...ledgerMap, cgstLedger: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">SGST Ledger</Label>
                    <Input 
                      value={ledgerMap.sgstLedger} 
                      onChange={e => setLedgerMap({ ...ledgerMap, sgstLedger: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">IGST Ledger</Label>
                    <Input 
                      value={ledgerMap.igstLedger} 
                      onChange={e => setLedgerMap({ ...ledgerMap, igstLedger: e.target.value })} 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Round Off Ledger</Label>
                  <Input 
                    value={ledgerMap.roundOffLedger} 
                    onChange={e => setLedgerMap({ ...ledgerMap, roundOffLedger: e.target.value })} 
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <Button variant="outline" size="sm" onClick={() => setShowLedgerSettings(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveLedgers}>
                    Save Settings
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* SETUP GUIDE DIALOG */}
          <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Quick Tally Prime Setup Guide
                </DialogTitle>
                <DialogDescription>
                  How to use 1-Click Direct Sync or Streamlined File Import in minutes.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2 text-sm">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                  <h4 className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-600" />
                    How to enable 1-Click Direct Sync:
                  </h4>
                  <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                    <li>Open <strong>Tally Prime</strong> on your computer.</li>
                    <li>Press <strong>F1 (Help)</strong> → select <strong>Settings</strong> → <strong>Connectivity</strong>.</li>
                    <li>Set <strong>TallyPrime acts as</strong> to <strong>Both</strong> or <strong>Server</strong>.</li>
                    <li>Set <strong>Port</strong> to <strong>9000</strong>. Save changes (<kbd className="bg-muted px-1 rounded">Ctrl+A</kbd>).</li>
                    <li>Open your company in Tally Prime.</li>
                    <li>Click <strong>Sync Customer Ledgers</strong> (first time only), then click <strong>Sync Invoices</strong>!</li>
                  </ol>
                </div>

                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 space-y-2">
                  <h4 className="font-semibold flex items-center gap-1.5">
                    <Download className="h-4 w-4 text-primary" />
                    How to Import via File (Option 2):
                  </h4>
                  <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                    <li>Click <strong>Export Invoices XML</strong> (or Customer Masters XML).</li>
                    <li>In Tally Prime, press <strong>Alt + O (Import)</strong>.</li>
                    <li>Select <strong>Masters</strong> (for customers) or <strong>Transactions</strong> (for bills).</li>
                    <li>Paste the XML file path and press Enter. Done!</li>
                  </ol>
                </div>

                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setShowHelpDialog(false)}>
                    Got it!
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}
