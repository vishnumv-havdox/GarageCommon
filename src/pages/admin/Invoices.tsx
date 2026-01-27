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
  Search,
  Download,
  Eye,
  Receipt,
  Calendar as CalendarIcon,
  IndianRupee,
  Loader2,
  Edit,
  Trash2,
  ExternalLink,
  XCircle,
  CheckCircle
} from "lucide-react";
import { format } from "date-fns";
import { generateInvoicePDF } from "@/utils/pdfGenerator";
import { useNavigate } from "react-router-dom"; // Add import

export default function AdminInvoices() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("drafts");
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
        }

        const { data: invoicesData, error: invoicesError } = await query;
        if (invoicesError) throw invoicesError;
        setInvoices(invoicesData || []);
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

      // Filter WOs that don't have an invoice yet (optional logic depending on requirements)
      // For now, list all eligible WOs 
      setPendingWorkOrders(woData || []);

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
          invoice_number: `INV-${Date.now()}`, // Temporary unique ID until finalized or replaced by bill_number
          customer_id: wo.vehicle_id ? (await getCustomerId(wo.vehicle_id)) : null, // Helper needed or fetch WO with customer
          work_order_id: wo.id,
          status: 'Draft',
          subtotal: 0, // Will update after items
          total: 0,
          bill_number: undefined // Let DB sequence handle it (or trigger) -> Wait, we defined default nextval
        })
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
    const { data: services } = await supabase
      .from('work_order_services')
      .select('*')
      .eq('work_order_id', workOrderId);

    if (!services || services.length === 0) return;

    // 2. Fetch Tasks
    const { data: tasks } = await supabase
      .from('work_order_tasks')
      .select('*')
      .eq('work_order_id', workOrderId);

    const invoiceItems: any[] = [];

    services.forEach(service => {
      // Find tasks for this service
      const serviceTasks = tasks?.filter(t => t.service_id === service.id) || [];

      if (serviceTasks.length > 0) {
        // Create items for each task
        serviceTasks.forEach((task, index) => {
          invoiceItems.push({
            invoice_id: invoiceId,
            work_order_service_id: service.id,
            description: task.task_name, // Use specific task name
            quantity: 1,
            // Assign cost to the first task to preserve total (user can redistribute)
            unit_price: index === 0 ? service.estimated_cost : 0,
            total: index === 0 ? service.estimated_cost : 0,
            type: 'service',
            category: service.service_type
          });
        });
      } else {
        // No tasks? Fallback to Service Type
        invoiceItems.push({
          invoice_id: invoiceId,
          work_order_service_id: service.id,
          description: "", // Leave empty for manual entry
          quantity: 1,
          unit_price: service.estimated_cost,
          total: service.estimated_cost,
          type: 'service',
          category: service.service_type
        });
      }
    });

    if (invoiceItems.length > 0) {
      const { error } = await supabase.from('invoice_items').insert(invoiceItems);
      if (error) console.error("Error syncing items:", error);

      // Update Invoice Totals
      const total = invoiceItems.reduce((acc, item) => acc + (item.total || 0), 0);
      await supabase.from('invoices').update({ subtotal: total, total: total }).eq('id', invoiceId);
    }
  }

  const filteredInvoices = invoices.filter(inv => {
    const query = searchTerm.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(query) ||
      inv.bill_number?.toString().includes(query) ||
      inv.customer?.name?.toLowerCase().includes(query) ||
      inv.work_order?.vehicle?.vehicle_number?.toLowerCase().includes(query)
    );
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
                    Generate Invoice
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
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
            </div>

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

function InvoiceTable({ invoices, type, onRefresh }: { invoices: any[], type: 'draft' | 'finalized', onRefresh: () => void }) {
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
              <TableCell className="font-medium">#{inv.bill_number || '-'}</TableCell>
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
                <Badge variant={inv.status === 'Paid' ? 'default' : inv.status === 'Draft' ? 'secondary' : 'destructive'}>
                  {inv.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
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
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
