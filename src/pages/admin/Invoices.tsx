import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Edit,
  Loader2,
  Search,
  Receipt,
  XCircle,
  CheckCircle,
  IndianRupee,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { generateInvoicePDF } from "@/utils/pdfGenerator";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom"; // Add import

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
               customer:customers(name, phone),
               work_order:work_orders(vehicle:vehicles(vehicle_number))
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
                      work_order:work_orders(id, vehicle:vehicles(vehicle_number, model))
                  `)
          .order('created_at', { ascending: false });

        if (activeTab === 'drafts') {
          query = query.eq('status', 'Draft');
        } else if (activeTab === 'finalized') {
          query = query.neq('status', 'Draft'); // Show all non-drafts
        } else if (activeTab === 'all') {
          // No filter, show all
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
        // Filter out work orders that already have an OPEN invoice? 
        // Currently allow multiple invoices per WO? Ideally one active invoice.
        .order('created_at', { ascending: false });

      if (woError) throw woError;

      // Filter WOs that don't have an invoice yet
      // We check against the invoice list we just fetched (assuming it contains ALL relevant invoices or we fetch check)
      // Note: If pagination existed, this client-side filtering would be insufficient. For now it's fine.
      const existingInvoiceWoIds = new Set(currentInvoices.map((i: any) => i.work_order_id));
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

      // 2. Update Invoice Status
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({ status: 'Paid' })
        .eq('id', verifyPayment.invoice_id);

      if (invoiceError) throw invoiceError;

      toast({ title: "Payment Approved", description: "Invoice marked as Paid." });
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

      // 2. Update Invoice Status (Revert to Finalized/Unpaid)
      // Assuming status 'generated' or logic handles it. 
      // If previous status was 'Generated' or just not 'Paid'.
      // We'll set it to 'Generated' (which displays as Unpaid in customer view usually).
      // Or just leave it as whatever it was before 'Payment Verification Pending' if we tracked it.
      // But 'Generated' is safe.
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({ status: 'Generated' })
        .eq('id', verifyPayment.invoice_id);

      if (invoiceError) throw invoiceError;

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
            invoiceItems.push({
              invoice_id: invoiceId,
              work_order_service_id: service.id,
              description: task.task_name,
              quantity: 1,
              unit_price: index === 0 ? service.estimated_cost : 0,
              total: index === 0 ? service.estimated_cost : 0,
              type: 'service',
              category: service.service_type
            });
          });
        } else {
          invoiceItems.push({
            invoice_id: invoiceId,
            work_order_service_id: service.id,
            description: "",
            quantity: 1,
            unit_price: service.estimated_cost,
            total: service.estimated_cost,
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

  // Merge Invoices and Unbilled WOs for "All" view
  const allItems = activeTab === 'all'
    ? [
      ...invoices,
      ...pendingWorkOrders.map(wo => ({
        id: `virtual-${wo.id}`,
        is_virtual: true,
        work_order_id: wo.id,
        created_at: wo.created_at,
        status: 'Ready to Bill',
        type: 'invoice', // Default virtual type
        invoice_number: 'Pending',
        bill_number: null,
        total: 0,
        customer: wo.vehicle?.customer,
        work_order: wo
      }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : invoices;

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
      inv.work_order?.vehicle?.vehicle_number?.toLowerCase().includes(query)
    );
    return statusMatch && searchMatch && typeMatch;
  });

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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Invoices</TabsTrigger>
              <TabsTrigger value="drafts">Drafts</TabsTrigger>
              <TabsTrigger value="finalized">Finalized & Paid</TabsTrigger>
              <TabsTrigger value="verification">Verification & Payments</TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              {activeTab === 'all' && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Ready to Bill">Ready to Bill</SelectItem>
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
                <div className="rounded-md border">
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
                            <div>{payment.invoice?.bill_number ? `Bill #${payment.invoice.bill_number}` : payment.invoice?.invoice_number}</div>
                            <div className="text-xs text-muted-foreground">{payment.invoice?.work_order?.vehicle?.vehicle_number}</div>
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
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Verify Payment
                </DialogTitle>
                <DialogDescription>
                  Review payment details for Invoice #{verifyPayment?.invoice?.bill_number || verifyPayment?.invoice?.invoice_number}
                </DialogDescription>
              </DialogHeader>

              {verifyPayment && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                      <h3 className="font-medium flex items-center gap-2 border-b pb-2">
                        <IndianRupee className="h-4 w-4" /> Payment Details
                      </h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-muted-foreground">Amount:</span>
                        <span className="font-bold">₹{verifyPayment.amount?.toLocaleString()}</span>

                        <span className="text-muted-foreground">Method:</span>
                        <span>{verifyPayment.payment_method}</span>

                        <span className="text-muted-foreground">Date:</span>
                        <span>{format(new Date(verifyPayment.created_at), "PP p")}</span>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                      <h3 className="font-medium flex items-center gap-2 border-b pb-2">
                        <FileText className="h-4 w-4" /> Invoice Details
                      </h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-muted-foreground">Customer:</span>
                        <span>{verifyPayment.invoice?.customer?.name}</span>

                        <span className="text-muted-foreground">Phone:</span>
                        <span>{verifyPayment.invoice?.customer?.phone}</span>

                        <span className="text-muted-foreground">Vehicle:</span>
                        <span>{verifyPayment.invoice?.work_order?.vehicle?.vehicle_number}</span>
                      </div>
                      <div className="pt-2">
                        <Button variant="outline" size="sm" className="w-full" asChild>
                          <a href={`/admin/invoices/${verifyPayment.invoice_id}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3 w-3 mr-2" /> View Full Invoice
                          </a>
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Rejection Remarks (Optional)</label>
                      <Input
                        placeholder="Reason for rejection..."
                        value={rejectRemarks}
                        onChange={(e) => setRejectRemarks(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-medium">Proof of Payment</h3>
                    <div className="border rounded-lg overflow-hidden bg-black/5 flex items-center justify-center min-h-[300px]">
                      {verifyPayment.proof_url ? (
                        <a href={verifyPayment.proof_url} target="_blank" rel="noreferrer">
                          <img
                            src={verifyPayment.proof_url}
                            alt="Payment Proof"
                            className="max-w-full max-h-[400px] object-contain cursor-zoom-in hover:scale-105 transition-transform"
                          />
                        </a>
                      ) : (
                        <div className="text-muted-foreground text-sm">No image uploaded</div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground text-center">Click image to view full size</p>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="destructive" onClick={handleRejectPayment} disabled={processingPayment}>
                  {processingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Reject Payment
                </Button>
                <Button className="bg-green-600 hover:bg-green-700" onClick={handleAcceptPayment} disabled={processingPayment}>
                  {processingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Approve Payment
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
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bill No.</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell className="font-medium">
                {inv.type === 'quotation'
                  ? (inv.quotation_number ? `QTN-${inv.quotation_number}` : 'Draft QTN')
                  : (inv.bill_number ? `INV-${inv.bill_number}` : `Draft #${inv.invoice_number}`)
                }
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={inv.type === 'quotation' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                  {inv.type === 'quotation' ? 'Quotation' : 'Invoice'}
                </Badge>
              </TableCell>
              <TableCell>{format(new Date(inv.created_at), "MMM d, yyyy")}</TableCell>
              <TableCell>
                <div>{inv.customer?.name}</div>
                <div className="text-xs text-muted-foreground">{inv.customer?.company_name}</div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{inv.work_order?.vehicle?.vehicle_number}</Badge>
                <div className="text-xs text-muted-foreground mt-1">{inv.work_order?.vehicle?.model}</div>
              </TableCell>
              <TableCell className="font-bold">
                ₹{inv.total?.toLocaleString()}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    inv.status === 'Paid' ? 'default' :
                      inv.status === 'Draft' ? 'secondary' :
                        inv.status === 'Ready to Bill' ? 'outline' :
                          'destructive'
                  }
                  className={inv.status === 'Ready to Bill' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                >
                  {inv.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {inv.is_virtual ? (
                    <>
                      <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => navigate(`/admin/work-orders/${inv.work_order_id}`)}>
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      <Button size="sm" className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => onGenerate?.(inv.work_order_id)}>
                        <Plus className="h-3.5 w-3.5" /> Generate
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* Link to Editor - implementation pending */}
                      <Button variant="ghost" size="icon" title="Edit/View" onClick={() => {
                        const cleanPath = `/admin/invoices/${inv.id}`.trim();
                        console.log("Navigating to:", cleanPath);
                        navigate(cleanPath);
                      }}>
                        <Eye className="h-4 w-4 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => generateInvoicePDF(inv.work_order_id)} title="Download PDF">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/invoices/${inv.id}`)} title="Edit Invoice">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm(`Are you sure you want to DELETE Invoice #${inv.bill_number ?? 'Draft'}?`)) {
                            const { error } = await supabase.from('invoices').delete().eq('id', inv.id);
                            if (error) {
                              toast({ variant: "destructive", title: "Error", description: error.message });
                            } else {
                              toast({ title: "Deleted", description: "Invoice deleted successfully." });
                              onRefresh();
                            }
                          }
                        }}
                        title="Delete Invoice"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div >
  );
}
