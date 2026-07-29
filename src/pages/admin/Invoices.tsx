import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Plus,
  Eye,
  Download,
  Trash2,
  MoreHorizontal,
  Edit,
  Loader2,
  Search,
  Receipt,
  XCircle,
  CheckCircle,
  IndianRupee,
  ExternalLink
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { generateInvoicePDF } from "@/utils/pdfGenerator";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom"; // Add import
import { SearchInput } from "@/components/shared/SearchInput";

export default function AdminInvoices() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all"); // 'all', 'invoice', 'quotation'
  const navigate = useNavigate(); // Add hook

  // Data
  const [invoices, setInvoices] = useState<any[]>([]);
  const [pendingWorkOrders, setPendingWorkOrders] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);

  // Search/Filter
  const [searchTerm, setSearchTerm] = useState("");

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<string>("");
  const [creationType, setCreationType] = useState<'invoice' | 'quotation'>('invoice'); // New state
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  // Verification State
  const [verifyPayment, setVerifyPayment] = useState<any | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    let currentInvoices: any[] = [];
    try {
      // 1. Fetch Invoices based on tab
      if (activeTab === 'verification') {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payments')
          .select(`
            *,
            invoice:invoices(
               id, invoice_number, bill_number, total, 
               customer:customers(name, phone)
            ),
            payment_links(
              id,
              invoice_id,
              amount_applied,
              invoice:invoices(
                id, invoice_number, bill_number, total,
                customer:customers(name, phone),
                work_order:work_orders(vehicle:vehicles(vehicle_number))
              )
            )
          `)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (paymentsError) throw paymentsError;
        setPendingPayments(paymentsData || []);
      } else {
        let query = supabase
          .from('invoices')
          .select(`
                      *,
                      customer:customers(name, company_name, phone),
                      work_order:work_orders(id, is_reopened, vehicle:vehicles(vehicle_number, model))
                  `)
          .order('created_at', { ascending: false });

        if (activeTab === 'drafts') {
          query = query.eq('status', 'Draft');
        } else if (activeTab === 'finalized') {
          query = query.neq('status', 'Draft'); // Show all non-drafts
        }

        const { data: invoicesData, error: invoicesError } = await query;
        if (invoicesError) throw invoicesError;
        currentInvoices = invoicesData || [];
        setInvoices(currentInvoices);
      }

      // 2. Fetch Pending Work Orders
      const { data: woData, error: woError } = await supabase
        .from('work_orders')
        .select(`
          *,
          vehicle: vehicles(
            vehicle_number,
            model,
            customer: customers(name, company_name)
          )
            `)
        .not('status', 'in', '("Cancelled")')
        .order('created_at', { ascending: false });

      if (woError) throw woError;

      // Always fetch all invoice work_order_ids to compute unbilled WOs accurately
      const { data: allInvWoIds, error: allInvWoIdsError } = await supabase
        .from('invoices')
        .select('work_order_id');

      if (allInvWoIdsError) throw allInvWoIdsError;

      const existingInvoiceWoIds = new Set(allInvWoIds?.map((i: any) => i.work_order_id) || []);
      const unbilledWOs = (woData || []).filter((wo: any) => !existingInvoiceWoIds.has(wo.id));

      setPendingWorkOrders(unbilledWOs);

    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptPayment = async () => {
    if (!verifyPayment) return;
    setProcessingPayment(true);
    try {
      // 1. Update Payment Status
      const { error: paymentError } = await supabase
        .from('payments')
        .update({
          status: 'approved',
          verified_by: user?.id,
          verified_at: new Date().toISOString()
        })
        .eq('id', verifyPayment.id);

      if (paymentError) throw paymentError;

      // 2. Update all linked Invoices Status
      const linkedInvoiceIds = verifyPayment.payment_links?.map((l: any) => l.invoice_id) || [];
      if (verifyPayment.invoice_id) linkedInvoiceIds.push(verifyPayment.invoice_id);

      const uniqueInvoiceIds = Array.from(new Set(linkedInvoiceIds)).filter(id => id); // Filter out null/undefined

      if (uniqueInvoiceIds.length > 0) {
        // If there's a deduction, we should record it on the invoices?
        // For simplicity now, we mark all as Paid. 
        // In a more complex system, we'd record 'total_deductions' on the invoice.
        const { error: invoiceError } = await supabase
          .from('invoices')
          .update({
            status: 'Paid',
            // If it's a single invoice with deduction, record it
            ...(uniqueInvoiceIds.length === 1 && verifyPayment.deduction_amount > 0 ? {
              total_deductions: (verifyPayment.invoice?.total_deductions || 0) + verifyPayment.deduction_amount
            } : {})
          })
          .in('id', uniqueInvoiceIds);

        if (invoiceError) throw invoiceError;

        // 3. Auto-reject other pending payments for these invoices (Duplicate requests)
        // Find payments linked via payment_links
        const { data: linkedDuplicates } = await supabase
          .from('payment_links')
          .select('payment_id')
          .in('invoice_id', uniqueInvoiceIds);

        const linkedPaymentIds = linkedDuplicates?.map((l: any) => l.payment_id) || [];

        // Find payments linked directly via invoice_id
        const { data: directDuplicates } = await supabase
          .from('payments')
          .select('id')
          .in('invoice_id', uniqueInvoiceIds)
          .eq('status', 'pending');

        const directPaymentIds = directDuplicates?.map((p: any) => p.id) || [];

        // Combine and filter unique IDs to reject
        const idsToReject = Array.from(new Set([...linkedPaymentIds, ...directPaymentIds]))
          .filter(id => id !== verifyPayment.id);

        if (idsToReject.length > 0) {
          const { error: rejectError } = await supabase
            .from('payments')
            .update({
              status: 'rejected',
              admin_remarks: 'Auto-rejected: Invoice marked as Paid via another request'
            })
            .in('id', idsToReject)
            .eq('status', 'pending'); // Double check status is pending

          if (rejectError) console.error("Error auto-rejecting duplicates:", rejectError);
        }
      }

      toast({ title: "Payment Approved", description: `${uniqueInvoiceIds.length} Invoice(s) marked as Paid.` });
      setVerifyPayment(null);
      fetchData(); // Refresh list

    } catch (error: any) {
      console.error("Error approving payment:", error);
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!verifyPayment) return;
    setProcessingPayment(true);
    try {
      // 1. Update Payment Status
      const { error: paymentError } = await supabase
        .from('payments')
        .update({
          status: 'rejected',
          admin_remarks: rejectRemarks,
          verified_by: user?.id,
          verified_at: new Date().toISOString()
        })
        .eq('id', verifyPayment.id);

      if (paymentError) throw paymentError;

      // 2. Update all linked Invoices Status (Revert to Finalized/Unpaid)
      const linkedInvoiceIds = verifyPayment.payment_links?.map((l: any) => l.invoice_id) || [];
      if (verifyPayment.invoice_id) linkedInvoiceIds.push(verifyPayment.invoice_id);

      const uniqueInvoiceIds = Array.from(new Set(linkedInvoiceIds)).filter(id => id); // Filter out null/undefined

      if (uniqueInvoiceIds.length > 0) {
        const { error: invoiceError } = await supabase
          .from('invoices')
          .update({ status: 'Generated' })
          .in('id', uniqueInvoiceIds);

        if (invoiceError) throw invoiceError;
      }

      toast({ title: "Payment Rejected", description: "Customer will be notified." });
      setVerifyPayment(null);
      setRejectRemarks("");
      fetchData();

    } catch (error: any) {
      console.error("Error rejecting payment:", error);
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!selectedWorkOrder) return;
    setCreatingInvoice(true);
    try {
      // 1. Get Work Order Details
      const { data: wo, error: woError } = await supabase
        .from('work_orders')
        .select('*')
        .eq('id', selectedWorkOrder)
        .single();
      if (woError) throw woError;

      // 2. Create Invoice Record
      const { data: newInvoice, error: invError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: `${creationType === 'quotation' ? 'QTN' : 'INV'}-${Date.now()}`,
          customer_id: wo.vehicle_id ? (await getCustomerId(wo.vehicle_id)) : null,
          work_order_id: wo.id,
          status: 'Draft',
          type: creationType, // 'invoice' or 'quotation'
          subtotal: 0,
          total: 0,
        } as any)
        .select()
        .single();

      if (invError) throw invError;

      // 3. Sync Work Order Services to Invoice Items
      await syncWorkOrderItems(newInvoice.id, wo.id);

      toast({ title: "Success", description: "Invoice created successfully." });
      setIsCreateOpen(false);
      setActiveTab("drafts");
      fetchData();
    } catch (error: any) {
      console.error("Create invoice error:", error);
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setCreatingInvoice(false);
    }
  };

  // Helper to get customer ID from vehicle (since WO links to vehicle)
  // Actually fetches WO with customerrelation usually, but let's do a quick fetch
  const getCustomerId = async (vehicleId: string) => {
    const { data } = await supabase.from('vehicles').select('customer_id').eq('id', vehicleId).single();
    return data?.customer_id;
  }

  const syncWorkOrderItems = async (invoiceId: string, workOrderId: string) => {
    // 1. Fetch Services
    const { data: services }: any = await supabase
      .from('work_order_services')
      .select('*')
      .eq('work_order_id', workOrderId);

    // 2. Fetch Tasks
    const { data: tasks }: any = await supabase
      .from('work_order_tasks')
      .select('*')
      .eq('work_order_id', workOrderId);

    // 3. Fetch Parts
    const { data: parts }: any = await supabase
      .from('work_order_parts')
      .select('*')
      .eq('work_order_id', workOrderId);

    const invoiceItems: any[] = [];

    // Add Services and Tasks
    if (services && services.length > 0) {
      services.forEach(service => {
        const serviceTasks = tasks?.filter(t => t.service_id === service.id) || [];
        if (serviceTasks.length > 0) {
          serviceTasks.forEach((task, index) => {
            const finalPrice = service.billing_price || service.estimated_cost;
            invoiceItems.push({
              invoice_id: invoiceId,
              work_order_service_id: service.id,
              description: task.task_name,
              quantity: 1,
              unit_price: index === 0 ? finalPrice : 0,
              total: index === 0 ? finalPrice : 0,
              type: 'service',
              category: service.service_type
            });
          });
        } else {
          const finalPrice = service.billing_price || service.estimated_cost;
          invoiceItems.push({
            invoice_id: invoiceId,
            work_order_service_id: service.id,
            description: "",
            quantity: 1,
            unit_price: finalPrice,
            total: finalPrice,
            type: 'service',
            category: service.service_type
          });
        }
      });
    }

    // Add Parts
    if (parts && parts.length > 0) {
      parts.forEach(part => {
        invoiceItems.push({
          invoice_id: invoiceId,
          description: part.part_name,
          quantity: part.quantity,
          unit_price: part.unit_price,
          total: part.quantity * part.unit_price,
          type: 'part',
          category: 'Spare'
        });
      });
    }

    if (invoiceItems.length > 0) {
      const { error } = await supabase.from('invoice_items').insert(invoiceItems as any);
      if (error) console.error("Error syncing items:", error);

      // Update Invoice Totals
      const total = invoiceItems.reduce((acc, item) => acc + (item.total || 0), 0);
      await supabase.from('invoices').update({ subtotal: total, total: total } as any).eq('id', invoiceId);
    }
  }

  // Merge Invoices and Unbilled WOs for different views
  const allItems = useMemo(() => {
    if (activeTab === 'ready_to_bill') {
      return pendingWorkOrders.map(wo => ({
        id: `virtual-${wo.id}`,
        is_virtual: true,
        work_order_id: wo.id,
        created_at: wo.created_at,
        status: 'Ready to Bill',
        type: 'invoice',
        invoice_number: 'Pending',
        bill_number: null,
        total: 0,
        customer: wo.vehicle?.customer,
        work_order: wo
      }));
    }
    return invoices;
  }, [invoices, pendingWorkOrders, activeTab]);

  const filteredInvoices = allItems.filter(inv => {
    const query = searchTerm.toLowerCase();
    const statusMatch = statusFilter === 'all' || inv.status === statusFilter;
    const typeMatch = typeFilter === 'all' || inv.type === typeFilter;

    // For "Ready to Bill", map specific status
    if (statusFilter === 'Ready to Bill' && inv.status !== 'Ready to Bill') return false;

    const searchMatch = (
      inv.invoice_number?.toLowerCase().includes(query) ||
      inv.bill_number?.toString().includes(query) ||
      inv.customer?.name?.toLowerCase().includes(query) ||
      inv.customer?.company_name?.toLowerCase().includes(query) ||
      inv.customer?.phone?.toLowerCase().includes(query) ||
      inv.work_order?.vehicle?.vehicle_number?.toLowerCase().includes(query) ||
      inv.work_order?.vehicle?.model?.toLowerCase().includes(query) ||
      inv.work_order_id?.toLowerCase().includes(query)
    );
    return statusMatch && searchMatch && typeMatch;
  });

  // Collect suggestions
  const suggestions = useMemo(() => {
    const sets = [
      new Set(invoices.map(i => i.customer?.name)),
      new Set(invoices.map(i => i.customer?.company_name)),
      new Set(invoices.map(i => i.bill_number?.toString())),
      new Set(invoices.map(i => i.work_order?.vehicle?.vehicle_number)),
      new Set(pendingWorkOrders.map(wo => wo.vehicle?.vehicle_number)),
      new Set(pendingWorkOrders.map(wo => wo.vehicle?.customer?.name))
    ];
    return Array.from(new Set(sets.flatMap(s => Array.from(s)))).filter(Boolean);
  }, [invoices, pendingWorkOrders]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col lg:flex-row">
        <AdminSidebar />
        <main className="flex-1 p-4 lg:p-8 space-y-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Receipt className="h-8 w-8 text-primary" />
                Invoices
              </h1>
              <p className="text-muted-foreground">Manage billing and payments</p>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> Create Invoice
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Invoice</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">

                  {/* Type Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Document Type</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div
                        className={`border rounded-lg p-4 cursor-pointer flex flex-col items-center gap-2 transition-all ${creationType === 'invoice' ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted'}`}
                        onClick={() => setCreationType('invoice')}
                      >
                        <FileText className="h-6 w-6 text-primary" />
                        <span className="font-medium">Tax Invoice</span>
                        <span className="text-xs text-muted-foreground text-center">With GST & Final Bill</span>
                      </div>
                      <div
                        className={`border rounded-lg p-4 cursor-pointer flex flex-col items-center gap-2 transition-all ${creationType === 'quotation' ? 'ring-2 ring-orange-500 bg-orange-50' : 'hover:bg-muted'}`}
                        onClick={() => setCreationType('quotation')}
                      >
                        <FileText className="h-6 w-6 text-orange-500" />
                        <span className="font-medium">Quotation</span>
                        <span className="text-xs text-muted-foreground text-center">Estimate (No GST initially)</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Work Order</label>
                    <Select onValueChange={setSelectedWorkOrder} value={selectedWorkOrder}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a pending work order..." />
                      </SelectTrigger>
                      <SelectContent>
                        {pendingWorkOrders.map((wo) => (
                          <SelectItem key={wo.id} value={wo.id}>
                            {wo.vehicle?.vehicle_number} - {wo.vehicle?.model} ({wo.vehicle?.customer?.name}) {wo.vehicle?.customer?.company_name ? `- ${wo.vehicle.customer.company_name}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleCreateInvoice}
                    disabled={!selectedWorkOrder || creatingInvoice}
                    className="w-full"
                  >
                    {creatingInvoice && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate {creationType === 'quotation' ? 'Quotation' : 'Invoice'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="relative overflow-hidden border bg-background/40 backdrop-blur-md shadow-sm transition-all duration-300 hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Invoiced (Gross)</CardTitle>
                <div className="p-2 rounded-lg bg-blue-500/10 dark:bg-blue-500/20">
                  <IndianRupee className="h-4 w-4 text-blue-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400">
                  ₹{Math.round(invoices.filter(i => i.status !== 'Draft' && i.status !== 'Cancelled').reduce((sum, i) => sum + (i.total || 0), 0)).toLocaleString('en-IN')}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Excludes drafts & cancelled</p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border bg-background/40 backdrop-blur-md shadow-sm transition-all duration-300 hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pending Verifications</CardTitle>
                <div className="p-2 rounded-lg bg-amber-500/10 dark:bg-amber-500/20">
                  <Loader2 className={`h-4 w-4 text-amber-500 ${pendingPayments.length > 0 ? 'animate-spin' : ''}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-extrabold tracking-tight ${pendingPayments.length > 0 ? 'text-amber-500 animate-pulse' : 'text-slate-700 dark:text-slate-300'}`}>
                  {pendingPayments.length}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Payments awaiting approval</p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border bg-background/40 backdrop-blur-md shadow-sm transition-all duration-300 hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Draft Estimates</CardTitle>
                <div className="p-2 rounded-lg bg-slate-500/10 dark:bg-slate-500/20">
                  <FileText className="h-4 w-4 text-slate-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold tracking-tight text-slate-700 dark:text-slate-300">
                  {invoices.filter(i => i.status === 'Draft').length}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Unfinalized drafts/quotations</p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border bg-background/40 backdrop-blur-md shadow-sm transition-all duration-300 hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ready to Bill</CardTitle>
                <div className="p-2 rounded-lg bg-purple-500/10 dark:bg-purple-500/20">
                  <CheckCircle className="h-4 w-4 text-purple-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold tracking-tight text-purple-600 dark:text-purple-400">
                  {pendingWorkOrders.length}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Work orders ready for invoice</p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-muted/50 p-1 border">
              <TabsTrigger value="all">All Invoices</TabsTrigger>
              <TabsTrigger value="drafts">Drafts</TabsTrigger>
              <TabsTrigger value="ready_to_bill" className="relative">
                Ready to Bill
                {pendingWorkOrders.length > 0 && (
                  <Badge className="ml-2 bg-purple-500 hover:bg-purple-600 text-white border-none text-[10px] h-4 px-1.5 min-w-[16px] flex items-center justify-center">
                    {pendingWorkOrders.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="finalized">Finalized & Paid</TabsTrigger>
              <TabsTrigger value="verification" className="relative">
                Verification & Payments
                {pendingPayments.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <SearchInput
                  placeholder="Search invoices by customer, vehicle, bill #, etc..."
                  value={searchTerm}
                  onChange={setSearchTerm}
                  suggestions={suggestions}
                />
              </div>
              {activeTab === 'all' && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Generated">Generated (Pending)</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {activeTab === 'all' && (
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Filter by Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="invoice">Invoices</SelectItem>
                    <SelectItem value="quotation">Quotations</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <TabsContent value="all" className="space-y-4">
              <InvoiceTable
                invoices={filteredInvoices}
                type="all"
                onRefresh={fetchData}
                onGenerate={(woId) => {
                  setSelectedWorkOrder(woId);
                  setIsCreateOpen(true);
                }}
              />
            </TabsContent>

            <TabsContent value="drafts" className="space-y-4">
              <InvoiceTable invoices={filteredInvoices} type="draft" onRefresh={fetchData} />
            </TabsContent>

            <TabsContent value="ready_to_bill" className="space-y-4">
              <InvoiceTable
                invoices={filteredInvoices}
                type="all"
                onRefresh={fetchData}
                onGenerate={(woId) => {
                  setSelectedWorkOrder(woId);
                  setCreationType('invoice');
                  setIsCreateOpen(true);
                }}
              />
            </TabsContent>

            <TabsContent value="finalized" className="space-y-4">
              <InvoiceTable invoices={filteredInvoices} type="finalized" onRefresh={fetchData} />
            </TabsContent>
            {/* Verification Tab */}
            <TabsContent value="verification">
              {loading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : pendingPayments.length > 0 ? (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{format(new Date(payment.created_at), "MMM d, yyyy")}</TableCell>
                          <TableCell>
                            <div className="font-medium">{payment.invoice?.customer?.name}</div>
                            <div className="text-xs text-muted-foreground">{payment.invoice?.customer?.phone}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {payment.payment_links && payment.payment_links.length > 1
                                  ? "Multiple Invoices"
                                  : (payment.invoice?.bill_number ? `Bill #${payment.invoice.bill_number}` : (payment.invoice?.invoice_number || 'N/A'))
                                }
                              </span>
                              {payment.payment_links && payment.payment_links.length > 1 && (
                                <Badge variant="outline" className="w-fit text-[10px] mt-1 bg-blue-50 text-blue-700 border-blue-200">
                                  {payment.payment_links.length} Bills
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>₹{payment.amount?.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{payment.payment_method}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" onClick={() => setVerifyPayment(payment)}>
                              Verify
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg bg-muted/20">
                  <CheckCircle className="h-10 w-10 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">All Caught Up</h3>
                  <p className="text-muted-foreground">No pending payment verifications.</p>
                </div>
              )}
            </TabsContent>

          </Tabs>

          {/* Verification Dialog */}
          <Dialog open={!!verifyPayment} onOpenChange={(open) => !open && setVerifyPayment(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-lg">
              <DialogHeader className="border-b pb-4 mb-4">
                <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                  <Receipt className="h-5 w-5 text-primary" />
                  Verify Customer Payment
                </DialogTitle>
                <DialogDescription>
                  Verify transaction details and payment proof for Invoice #{verifyPayment?.invoice?.bill_number || verifyPayment?.invoice?.invoice_number}
                </DialogDescription>
              </DialogHeader>

              {verifyPayment && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  {/* Left Column (Details) */}
                  <div className="lg:col-span-3 space-y-4">
                    <div className="p-5 border rounded-xl bg-card shadow-sm space-y-4">
                      <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b pb-2">
                        <IndianRupee className="h-4 w-4 text-primary" /> Transaction summary
                      </h3>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                        <span className="text-muted-foreground">Billed Customer:</span>
                        <span className="font-semibold text-right">{verifyPayment.invoice?.customer?.name}</span>

                        <span className="text-muted-foreground">Amount Transferred:</span>
                        <span className="font-extrabold text-lg text-emerald-600 dark:text-emerald-400 text-right">₹{verifyPayment.amount?.toLocaleString()}</span>

                        {verifyPayment.deduction_amount > 0 && (
                          <>
                            <span className="text-amber-600 font-semibold">Reported Deduction:</span>
                            <span className="font-bold text-amber-600 text-right">₹{verifyPayment.deduction_amount?.toLocaleString()}</span>

                            <span className="text-muted-foreground">Deduction Reason:</span>
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 justify-self-end">{verifyPayment.deduction_reason}</Badge>

                            <span className="text-muted-foreground">Settlement Status:</span>
                            <Badge variant="outline" className="text-[10px] justify-self-end">{verifyPayment.is_final_settlement ? 'Full & Final' : 'Partial Payment'}</Badge>

                            <Separator className="col-span-2 my-1" />
                            <span className="font-semibold text-muted-foreground">Total Cumulative Value:</span>
                            <span className="font-bold text-right">₹{(verifyPayment.amount + verifyPayment.deduction_amount).toLocaleString()}</span>
                          </>
                        )}

                        <span className="text-muted-foreground">Payment Mode:</span>
                        <span className="font-medium text-right">{verifyPayment.payment_method}</span>

                        <span className="text-muted-foreground">Receipt Timestamp:</span>
                        <span className="text-right text-xs text-muted-foreground">{format(new Date(verifyPayment.created_at), "PP p")}</span>
                      </div>
                    </div>

                    <div className="p-5 border rounded-xl bg-card shadow-sm space-y-4">
                      <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b pb-2">
                        <FileText className="h-4 w-4 text-primary" /> Affected Bills
                      </h3>
                      <div className="space-y-2">
                        {verifyPayment.payment_links && verifyPayment.payment_links.length > 0 ? (
                          verifyPayment.payment_links.map((link: any) => (
                            <div key={link.id} className="text-sm p-3 bg-background rounded-lg border flex items-center justify-between shadow-xs">
                              <div>
                                <p className="font-semibold">{link.invoice?.bill_number ? `Bill #${link.invoice.bill_number}` : (link.invoice?.invoice_number || 'N/A')}</p>
                                <p className="text-[10px] text-muted-foreground">{link.invoice?.customer?.name} • {link.invoice?.work_order?.vehicle?.vehicle_number}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-bold">₹{link.invoice?.total?.toLocaleString()}</span>
                                <Button variant="outline" size="icon" className="h-7 w-7" asChild>
                                  <a href={`/admin/invoices/${link.invoice?.id}`} target="_blank" rel="noreferrer">
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </Button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm p-3 bg-background rounded-lg border flex items-center justify-between shadow-xs">
                            <div>
                              <p className="font-semibold">{verifyPayment.invoice?.bill_number ? `Bill #${verifyPayment.invoice.bill_number}` : (verifyPayment.invoice?.invoice_number || 'N/A')}</p>
                              <p className="text-[10px] text-muted-foreground">{verifyPayment.invoice?.customer?.name} • {verifyPayment.invoice?.work_order?.vehicle?.vehicle_number}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold">₹{verifyPayment.invoice?.total?.toLocaleString()}</span>
                              <Button variant="outline" size="icon" className="h-7 w-7" asChild>
                                <a href={`/admin/invoices/${verifyPayment.invoice_id}`} target="_blank" rel="noreferrer">
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-muted-foreground">Admin Rejection remarks</label>
                      <Input
                        placeholder="State reason for rejecting payment..."
                        value={rejectRemarks}
                        onChange={(e) => setRejectRemarks(e.target.value)}
                        className="bg-card"
                      />
                    </div>
                  </div>

                  {/* Right Column (Receipt Photo) */}
                  <div className="lg:col-span-2 flex flex-col space-y-2">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Proof of Transfer</h3>
                    <div className="border border-slate-200/50 rounded-xl overflow-hidden bg-muted/30 flex items-center justify-center min-h-[320px] shadow-inner relative group">
                      {verifyPayment.proof_url ? (
                        <a href={verifyPayment.proof_url} target="_blank" rel="noreferrer" className="w-full h-full flex items-center justify-center p-2">
                          <img
                            src={verifyPayment.proof_url}
                            alt="Payment Proof"
                            className="max-w-full max-h-[380px] object-contain rounded shadow transition-all duration-300 group-hover:scale-[1.02] cursor-zoom-in"
                          />
                        </a>
                      ) : (
                        <div className="text-muted-foreground text-sm flex flex-col items-center gap-2">
                          <XCircle className="h-8 w-8 text-slate-400" />
                          <span>No transaction proof uploaded</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">Click payment document to preview fullscreen</p>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 border-t pt-4 mt-4">
                <Button variant="outline" onClick={() => setVerifyPayment(null)} className="mr-auto">
                  Back
                </Button>
                <Button variant="destructive" onClick={handleRejectPayment} disabled={processingPayment}>
                  {processingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Reject Payment
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAcceptPayment} disabled={processingPayment}>
                  {processingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Approve & Release
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}

function InvoiceTable({ invoices, type, onRefresh, onGenerate }: { invoices: any[], type: 'draft' | 'finalized' | 'all', onRefresh: () => void, onGenerate?: (woId: string) => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  // Reset selection on data refresh or type change
  useEffect(() => {
    setSelectedIds([]);
  }, [invoices, type]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(invoices.map(i => i.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(pid => pid !== id));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const { error } = await supabase.from('invoices').delete().eq('id', deleteTarget.id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Deleted", description: "Invoice deleted successfully." });
      onRefresh();
    }
    setDeleteTarget(null);
  };

  const confirmBulkDelete = async () => {
    const { error } = await supabase.from('invoices').delete().in('id', selectedIds);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Deleted", description: `${selectedIds.length} invoices deleted.` });
      onRefresh();
      setSelectedIds([]);
    }
    setShowBulkDelete(false);
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg bg-muted/20 h-64">
        <Receipt className="h-10 w-10 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No {type} invoices found</h3>
        <p className="text-muted-foreground">Create a new invoice from a work order to get started.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          {selectedIds.length > 0 ? `${selectedIds.length} selected` : `Total ${invoices.length} invoices`}
        </div>
        {selectedIds.length > 0 && (
          <Button variant="destructive" size="sm" onClick={() => setShowBulkDelete(true)}>
            <Trash2 className="h-4 w-4 mr-2" /> Delete Selected ({selectedIds.length})
          </Button>
        )}
      </div>

      <div className="border border-slate-200/50 rounded-xl overflow-hidden bg-card/65 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedIds.length === invoices.length && invoices.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="font-semibold text-slate-800">Bill No.</TableHead>
              <TableHead className="font-semibold text-slate-800">Type</TableHead>
              <TableHead className="font-semibold text-slate-800">Date</TableHead>
              <TableHead className="font-semibold text-slate-800">Client & Vehicle</TableHead>
              <TableHead className="font-semibold text-slate-800">Amount</TableHead>
              <TableHead className="font-semibold text-slate-800">Status</TableHead>
              <TableHead className="text-right font-semibold text-slate-800">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow 
                key={inv.id} 
                data-state={selectedIds.includes(inv.id) ? "selected" : ""}
                className="transition-colors hover:bg-muted/40 data-[state=selected]:bg-muted/65 group cursor-pointer"
                onDoubleClick={() => {
                  if (inv.is_virtual) {
                    navigate(`/admin/work-orders/${inv.work_order_id}`);
                  } else {
                    const cleanPath = `/admin/invoices/${inv.id}`.trim();
                    navigate(cleanPath);
                  }
                }}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(inv.id)}
                    onCheckedChange={(checked) => handleSelectOne(inv.id, !!checked)}
                  />
                </TableCell>
                <TableCell className="font-semibold text-slate-900">
                  {inv.type === 'quotation'
                    ? (inv.quotation_number ? `QTN-${inv.quotation_number}` : 'Draft QTN')
                    : (inv.bill_number ? `INV-${inv.bill_number}` : `Draft #${inv.invoice_number}`)
                  }
                  {inv.work_order?.is_reopened && (
                    <Badge variant="outline" className="ml-2 border-orange-500 text-orange-600 bg-orange-50 text-[10px] h-4 py-0">Reopened</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={inv.type === 'quotation' ? 'bg-orange-500/10 text-orange-600 border-orange-500/20 font-semibold' : 'bg-blue-500/10 text-blue-600 border-blue-500/20 font-semibold'}>
                    {inv.type === 'quotation' ? 'Quotation' : 'Invoice'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{format(new Date(inv.created_at), "MMM d, yyyy")}</TableCell>
                <TableCell>
                  <div className="font-semibold text-slate-800">{inv.customer?.name}</div>
                  {inv.customer?.company_name && (
                    <div className="text-xs text-muted-foreground">{inv.customer?.company_name}</div>
                  )}
                  <div className="flex gap-2 items-center mt-1 text-[11px]">
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono font-medium border-slate-200 bg-slate-50 text-slate-600">
                      {inv.work_order?.vehicle?.vehicle_number}
                    </Badge>
                    <span className="text-muted-foreground font-medium">{inv.work_order?.vehicle?.model}</span>
                  </div>
                </TableCell>
                <TableCell className="font-extrabold text-slate-900">
                  ₹{inv.total?.toLocaleString()}
                </TableCell>
                <TableCell>
                  {(() => {
                    let badgeClass = "";
                    switch (inv.status) {
                      case "Paid":
                        badgeClass = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400";
                        break;
                      case "Draft":
                        badgeClass = "bg-slate-500/10 text-slate-600 border-slate-500/20";
                        break;
                      case "Ready to Bill":
                        badgeClass = "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400";
                        break;
                      case "Generated":
                        badgeClass = "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400";
                        break;
                      case "Cancelled":
                      default:
                        badgeClass = "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400";
                        break;
                    }
                    return (
                      <Badge variant="outline" className={`font-semibold tracking-wide shadow-xs py-0.5 px-2 ${badgeClass}`}>
                        {inv.status === "Generated" ? "Generated (Pending)" : inv.status}
                      </Badge>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end opacity-80 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        {inv.is_virtual ? (
                          <>
                            <DropdownMenuItem onClick={() => navigate(`/admin/work-orders/${inv.work_order_id}`)}>
                              <Eye className="mr-2 h-4 w-4" /> View Work Order
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onGenerate?.(inv.work_order_id)}>
                              <Plus className="mr-2 h-4 w-4" /> Generate Invoice
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={() => {
                              const cleanPath = `/admin/invoices/${inv.id}`.trim();
                              navigate(cleanPath);
                            }}>
                              <Eye className="mr-2 h-4 w-4" /> View/Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => generateInvoicePDF(inv.work_order_id)}>
                              <Download className="mr-2 h-4 w-4" /> Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(inv);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Invoice
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete
              <b> {deleteTarget?.type === 'quotation' ? 'Quotation' : 'Invoice'} #{deleteTarget?.bill_number || deleteTarget?.invoice_number || 'Draft'}</b>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} Invoices?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the <b>{selectedIds.length} selected invoices</b>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} className="bg-destructive hover:bg-destructive/90">
              Delete All Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

}
