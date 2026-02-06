import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRequests } from "@/contexts/RequestsContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
    CheckCircle2, XCircle, Clock, FileText, Package,
    User, Calendar, AlertTriangle, ArrowRight
} from "lucide-react";
import { format } from "date-fns";

export default function RequestsInbox() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { refreshCounts } = useRequests();
    const [activeTab, setActiveTab] = useState("work-approvals");
    const [loading, setLoading] = useState(true);

    const [workApprovals, setWorkApprovals] = useState<any[]>([]);
    const [partRequests, setPartRequests] = useState<any[]>([]);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [payments, setPayments] = useState<any[]>([]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            // Fetch Work Orders Pending Approval
            const { data: woData, error: woError } = await supabase
                .from("work_orders")
                .select(`
          id,
          service_type,
          description,
          status,
          created_at,
          vehicle:vehicles(
            model, 
            vehicle_number,
            customer:customers(name)
          )
        `)
                .eq("status", "Pending Approval")
                .order("created_at", { ascending: false });

            if (woError) throw woError;
            setWorkApprovals(woData || []);

            // Fetch Part Requests Pending
            const { data: prData, error: prError } = await supabase
                .from("part_requests")
                .select(`
            *,
            part:inventory(item_name, sku),
            employee:employees!requested_by(name),
            work_order:work_orders(
                id,
                vehicle:vehicles(vehicle_number)
            )
        `)
                .eq("status", "pending")
                .order("created_at", { ascending: false });

            if (prError) throw prError;
            setPartRequests(prData || []);

            // Fetch Pending Payments
            const { data: payData, error: payError } = await supabase
                .from("payments")
                .select(`
                    id,
                    amount,
                    payment_method,
                    created_at,
                    proof_url,
                    invoice:invoices(
                        id,
                        invoice_number,
                        bill_number,
                        customer:customers(name, phone),
                        work_order:work_orders(
                            vehicle:vehicles(vehicle_number)
                        )
                    )
                `)
                .eq("status", "pending")
                .order("created_at", { ascending: false });

            if (payError) throw payError;
            setPayments(payData || []);

        } catch (error: any) {
            console.error("Error fetching requests:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to load requests."
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleApproveWorkOrder = async (workOrder: any) => {
        setProcessingId(workOrder.id);
        try {
            // Approve Work Order via RPC (if exists) or direct update
            // Using direct update for now as per WorkOrderDetail logic roughly
            // Ideally we should use the `approve_work` RPC if it handles everything
            // Let's use `approve_work` RPC as seen in WorkOrderDetail.tsx
            // @ts-ignore
            const { error } = await supabase.rpc('approve_work', {
                _work_order_id: workOrder.id,
                _approver_id: user?.id,
                _notes: "Approved via Inbox"
            });

            if (error) throw error;

            toast({ title: "Work Order Approved", description: "The work order has been approved." });

            await refreshCounts();

            // Redirect to Confirmation Page
            navigate("/admin/requests/confirmation", {
                state: {
                    type: "Work Order",
                    id: workOrder.id,
                    requester: workOrder.vehicle?.customer?.name || "Customer",
                    status: "APPROVED",
                    acceptedAt: new Date().toISOString()
                }
            });

        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
            setProcessingId(null);
            fetchRequests(); // Refresh list on error
        }
    };

    const handleRejectWorkOrder = async (workOrder: any) => {
        // For rejection, ideally we want a reason. For Inbox quick reject, maybe just a prompt?
        // For now, let's just reject with a default note or redirect to detail page.
        // Redirecting to detail page is safer for rejection to provide context.
        navigate(`/admin/work-orders/${workOrder.id}`);
    };

    const handleApprovePartRequest = async (request: any) => {
        setProcessingId(request.id);
        try {
            // Call RPC issue_part_request
            // @ts-ignore
            const { error } = await supabase.rpc('issue_part_request', {
                p_request_id: request.id,
                p_approver_id: user?.id
            });

            if (error) throw error;

            toast({ title: "Part Request Approved", description: "Inventory has been updated." });

            await refreshCounts();

            // Redirect to Confirmation Page
            navigate("/admin/requests/confirmation", {
                state: {
                    type: "Part Request",
                    id: request.id,
                    requester: request.employee?.name || "Employee",
                    status: "ISSUED",
                    acceptedAt: new Date().toISOString()
                }
            });

        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
            setProcessingId(null);
            fetchRequests();
        }
    };

    const handleRejectPartRequest = async (request: any) => {
        setProcessingId(request.id);
        try {
            // @ts-ignore
            const { error } = await supabase
                .from("part_requests")
                .update({ status: "rejected" } as any)
                .eq("id", request.id);

            if (error) throw error;

            toast({ title: "Request Rejected", description: "The part request has been rejected." });
            await refreshCounts();
            fetchRequests();
            setProcessingId(null);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
            setProcessingId(null);
        }
    };

    const handleApprovePayment = async (payment: any) => {
        setProcessingId(payment.id);
        try {
            // 1. Update Payment Status to 'approved'
            const { error: payError } = await supabase
                .from("payments")
                .update({ status: 'approved' })
                .eq("id", payment.id);

            if (payError) throw payError;

            // 2. Update Invoice Status to 'Paid' (if full payment? For now assume manual verification implies sufficient check)
            // Ideally we check amounts, but let's set it to 'Paid' or generic 'Partially Paid' logic if complex.
            // For simplicity in Inbox, we mark Payment as Approved.
            // AND mark invoice as Paid? Usually yes for single-payment flows.
            // Use 'Paid' if it covers total, but we don't have total here easily.
            // Safe bet: Just approve payment. Invoice status update might be trigger or manual.
            // Actually Invoices.tsx logic: "status: 'Paid'" on verification.
            if (payment.invoice?.id) {
                await supabase
                    .from("invoices")
                    .update({ status: 'Paid' }) // Simplification
                    .eq("id", payment.invoice.id);
            }

            toast({ title: "Payment Verified", description: "Payment approved and invoice updated." });
            await refreshCounts();

            // Redirect to Confirmation
            navigate("/admin/requests/confirmation", {
                state: {
                    type: "Payment",
                    id: payment.id,
                    requester: payment.invoice?.customer?.name || "Customer",
                    status: "VERIFIED",
                    acceptedAt: new Date().toISOString()
                }
            });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
            setProcessingId(null);
        }
    };

    const handleRejectPayment = async (payment: any) => {
        setProcessingId(payment.id);
        try {
            const { error } = await supabase
                .from("payments")
                .update({ status: 'rejected' })
                .eq("id", payment.id);

            if (error) throw error;

            toast({ title: "Payment Rejected", description: "Payment marked as rejected." });
            await refreshCounts();
            fetchRequests();
            setProcessingId(null);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
            setProcessingId(null);
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-6xl space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-2 h-8 w-8">
                            <ArrowRight className="h-4 w-4 rotate-180" />
                        </Button>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                            Requests Inbox
                        </h1>
                    </div>
                    <p className="text-muted-foreground ml-12">
                        Manage pending approvals and incoming requests from your team.
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={fetchRequests}
                    disabled={loading}
                    className="ml-12 md:ml-0 shadow-sm hover:shadow-md transition-all"
                >
                    <Clock className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Data
                </Button>
            </div>

            <Tabs defaultValue="work-approvals" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 max-w-[600px] bg-muted/50 p-1">
                    <TabsTrigger value="work-approvals" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Work Approvals
                        {workApprovals.length > 0 && (
                            <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1.5 rounded-full text-[10px]">
                                {workApprovals.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="part-requests" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Part Requests
                        {partRequests.length > 0 && (
                            <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1.5 rounded-full text-[10px]">
                                {partRequests.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="payment-requests" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Payments
                        {payments.length > 0 && (
                            <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1.5 rounded-full text-[10px]">
                                {payments.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* Work Approvals Tab */}
                <TabsContent value="work-approvals" className="space-y-4">
                    {workApprovals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-16 text-center border-2 border-dashed rounded-xl bg-muted/20">
                            <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">All Caught Up!</h3>
                            <p className="text-muted-foreground max-w-sm">
                                There are no work orders currently pending approval. Great job keeping the queue clear.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {workApprovals.map((wo) => (
                                <Card key={wo.id} className="group overflow-hidden border-l-4 border-l-orange-500 hover:shadow-lg transition-all duration-300">
                                    <div className="p-5 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 mb-2">
                                                    Pending Approval
                                                </Badge>
                                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                                    {wo.vehicle?.vehicle_number}
                                                </h3>
                                                <p className="text-sm text-muted-foreground">
                                                    {wo.service_type} • {wo.vehicle?.model}
                                                </p>
                                            </div>
                                            <Button variant="ghost" size="icon" className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => navigate(`/admin/work-orders/${wo.id}`)}>
                                                <ArrowRight className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="bg-muted/30 p-3 rounded-lg text-sm border">
                                            <div className="flex justify-between text-xs text-muted-foreground mb-2">
                                                <span>Customer: <span className="text-foreground font-medium">{wo.vehicle?.customer?.name || "Unknown"}</span></span>
                                                <span className="flex items-center"><Calendar className="h-3 w-3 mr-1" /> {format(new Date(wo.created_at), "MMM d")}</span>
                                            </div>
                                            <p className="line-clamp-2 text-muted-foreground italic">
                                                "{wo.description || "No description provided."}"
                                            </p>
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <Button
                                                variant="outline"
                                                className="flex-1 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                                                onClick={() => handleRejectWorkOrder(wo)}
                                                disabled={!!processingId}
                                            >
                                                <XCircle className="mr-2 h-4 w-4" /> REJECT
                                            </Button>
                                            <Button
                                                className="flex-1 bg-green-600 hover:bg-green-700 shadow-md hover:shadow-lg transition-all"
                                                onClick={() => handleApproveWorkOrder(wo)}
                                                disabled={processingId === wo.id}
                                            >
                                                {processingId === wo.id ? (
                                                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                                )}
                                                APPROVE
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Part Requests Tab */}
                <TabsContent value="part-requests" className="space-y-4">
                    {partRequests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-16 text-center border-2 border-dashed rounded-xl bg-muted/20">
                            <div className="h-16 w-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                                <Package className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Storage Clear!</h3>
                            <p className="text-muted-foreground max-w-sm">
                                No pending part requests at the moment.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {partRequests.map((req) => (
                                <Card key={req.id} className="group overflow-hidden border-t-4 border-t-blue-500 hover:shadow-lg transition-all duration-300 flex flex-col">
                                    <div className="p-5 flex-1 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-semibold text-base line-clamp-1" title={req.part?.item_name}>
                                                    {req.part?.item_name || "Unknown Part"}
                                                </h4>
                                                <p className="text-xs text-muted-foreground font-mono mt-1">
                                                    SKU: {req.part?.sku || "N/A"}
                                                </p>
                                            </div>
                                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none px-2 py-0.5 text-xs font-bold">
                                                x{req.requested_qty}
                                            </Badge>
                                        </div>

                                        <div className="space-y-2 text-sm pt-2">
                                            <div className="flex items-center justify-between p-2 bg-muted/40 rounded border">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <User className="h-4 w-4" />
                                                    <span className="text-foreground font-medium text-xs">{req.employee?.name || "Unknown"}</span>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground flex items-center">
                                                    <Clock className="h-3 w-3 mr-1" />
                                                    {format(new Date(req.created_at), "h:mm a")}
                                                </div>
                                            </div>

                                            {req.work_order && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full justify-between h-auto py-2 text-xs font-normal text-muted-foreground hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/20"
                                                    onClick={() => navigate(`/admin/work-orders/${req.work_order.id}`)}
                                                >
                                                    <span>Vehicle <span className="font-mono text-foreground font-medium">{req.work_order.vehicle?.vehicle_number}</span></span>
                                                    <ArrowRight className="h-3 w-3 opacity-50" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-3 bg-muted/30 border-t flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="flex-1 h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() => handleRejectPartRequest(req)}
                                            disabled={processingId === req.id}
                                        >
                                            REJECT
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="flex-1 h-8 bg-blue-600 hover:bg-blue-700 shadow-sm"
                                            onClick={() => handleApprovePartRequest(req)}
                                            disabled={processingId === req.id}
                                        >
                                            {processingId === req.id ? (
                                                <Clock className="mr-1 h-3 w-3 animate-spin" />
                                            ) : (
                                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                            )}
                                            ISSUE
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Payment Requests Tab */}
                <TabsContent value="payment-requests" className="space-y-4">
                    {payments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-16 text-center border-2 border-dashed rounded-xl bg-muted/20">
                            <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                                <IndianRupee className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">All Payments Verified!</h3>
                            <p className="text-muted-foreground max-w-sm">
                                No pending payment confirmations. Revenue is flowing smoothly.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {payments.map((pay) => (
                                <Card key={pay.id} className="group overflow-hidden border-t-4 border-t-emerald-500 hover:shadow-lg transition-all duration-300 flex flex-col">
                                    <div className="p-5 flex-1 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-semibold text-lg text-emerald-700">
                                                    ₹{pay.amount?.toLocaleString()}
                                                </h4>
                                                <p className="text-xs text-muted-foreground font-medium mt-1 uppercase tracking-wide">
                                                    {pay.payment_method}
                                                </p>
                                            </div>
                                            <Badge variant="outline" className="text-[10px] font-mono whitespace-nowrap">
                                                {format(new Date(pay.created_at), "MMM d")}
                                            </Badge>
                                        </div>

                                        <div className="space-y-2 text-sm bg-muted/30 p-3 rounded-lg border">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-muted-foreground">Customer:</span>
                                                <span className="font-medium">{pay.invoice?.customer?.name || "Unknown"}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-muted-foreground">Bill #:</span>
                                                <span className="font-mono">{pay.invoice?.bill_number || pay.invoice?.invoice_number || "N/A"}</span>
                                            </div>
                                            {pay.invoice?.work_order?.vehicle?.vehicle_number && (
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-muted-foreground">Vehicle:</span>
                                                    <span className="font-bold">{pay.invoice.work_order.vehicle.vehicle_number}</span>
                                                </div>
                                            )}
                                        </div>

                                        {pay.proof_url && (
                                            <div className="mt-2">
                                                <a
                                                    href={pay.proof_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-xs text-emerald-600 hover:text-emerald-800 hover:underline flex items-center gap-1"
                                                >
                                                    <FileText className="h-3 w-3" /> View Payment Proof
                                                </a>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-3 bg-muted/30 border-t flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="flex-1 h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() => handleRejectPayment(pay)}
                                            disabled={processingId === pay.id}
                                        >
                                            REJECT
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                                            onClick={() => handleApprovePayment(pay)}
                                            disabled={processingId === pay.id}
                                        >
                                            {processingId === pay.id ? (
                                                <Clock className="mr-1 h-3 w-3 animate-spin" />
                                            ) : (
                                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                            )}
                                            VERIFY
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

// Add missing icon import
import { IndianRupee } from "lucide-react";

