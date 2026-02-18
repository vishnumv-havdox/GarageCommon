import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRequests } from "@/contexts/RequestsContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
    CheckCircle2, XCircle, Clock, FileText, Package,
    User, Calendar, ArrowRight, IndianRupee,
    ChevronRight, Inbox, Zap, ShieldCheck
} from "lucide-react";
import { format } from "date-fns";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

export default function RequestsInbox() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { refreshCounts } = useRequests();
    const [activeTab, setActiveTab] = useState("work-approvals");
    const [loading, setLoading] = useState(true);

    const [workApprovals, setWorkApprovals] = useState<any[]>([]);
    const [partRequests, setPartRequests] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [payments, setPayments] = useState<any[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<any[]>([]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
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
          ),
          assigned_employee:employees!assigned_to(name)
        `)
                .eq("status", "Pending Approval")
                .order("created_at", { ascending: false });

            if (woError) throw woError;
            setWorkApprovals(woData || []);

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
                        total,
                        total_deductions,
                        customer:customers(name, phone),
                        work_order:work_orders(
                            vehicle:vehicles(vehicle_number)
                        )
                    ),
                    deduction_amount
                `)
                .eq("status", "pending")
                .order("created_at", { ascending: false });

            if (payError) throw payError;
            setPayments(payData || []);

            const today = new Date();
            today.setHours(23, 59, 59, 999);

            const { data: appData, error: appError } = await supabase
                .from("appointments")
                .select(`
                    *,
                    customer:customers(name, phone, company_name),
                    vehicle:vehicles(vehicle_number, model),
                    services:appointment_services(service_name)
                `)
                .or(`status.eq.pending,and(status.eq.confirmed,scheduled_at.lte.${today.toISOString()})`)
                .order("created_at", { ascending: false });

            if (appError) throw appError;
            setAppointments(appData || []);

            // Fetch leave requests
            const { data: leaveData, error: leaveError } = await supabase
                .from("leave_requests")
                .select(`
                    *,
                    employee:employees(name)
                `)
                .eq("status", "pending")
                .order("created_at", { ascending: false });

            if (leaveError) throw leaveError;
            setLeaveRequests(leaveData || []);

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

    const location = useLocation();
    const queryTab = new URLSearchParams(location.search).get("tab");

    useEffect(() => {
        if (queryTab) {
            setActiveTab(queryTab);
        }
    }, [queryTab]);

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleApproveWorkOrder = async (workOrder: any) => {
        setProcessingId(workOrder.id);
        try {
            // @ts-ignore
            const { error } = await supabase.rpc('approve_work', {
                p_work_order_id: workOrder.id,
                p_approver_id: user?.id,
                p_notes: "Approved via Inbox"
            });
            if (error) throw error;
            toast({ title: "Work Order Approved", description: "The work order has been approved." });
            await refreshCounts();
            navigate("/admin/requests/confirmation", {
                state: {
                    type: "Work Order",
                    id: workOrder.id,
                    requester: workOrder.assigned_employee?.name || workOrder.vehicle?.customer?.name || "Customer",
                    status: "APPROVED",
                    acceptedAt: new Date().toISOString()
                }
            });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
            setProcessingId(null);
            fetchRequests();
        }
    };

    const handleRejectWorkOrder = async (workOrder: any) => {
        navigate(`/admin/work-orders/${workOrder.id}`);
    };

    const handleApprovePartRequest = async (request: any) => {
        setProcessingId(request.id);
        try {
            // Resolve employee_id for issue_part_request
            const { data: emp } = await supabase.from("employees").select("id").eq("user_id", user?.id).single();
            if (!emp) throw new Error("Employee record not found for your account");

            // @ts-ignore
            const { error } = await supabase.rpc('issue_part_request', {
                _request_id: request.id,
                _issued_qty: request.requested_qty,
                _employee_id: (emp as any).id
            });
            if (error) throw error;
            toast({ title: "Part Request Approved", description: "Inventory has been updated." });
            await refreshCounts();
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
            const { error } = await (supabase.from("part_requests") as any).update({ status: "rejected" }).eq("id", request.id);
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
            const { error: payError } = await (supabase.from("payments") as any).update({ status: 'approved' }).eq("id", payment.id);
            if (payError) throw payError;

            const { data: links } = await supabase.from("payment_links").select("*, invoice:invoices(*)").eq("payment_id", payment.id);
            const invoicesToUpdate = links || (payment.invoice ? [{
                invoice_id: payment.invoice.id,
                amount_applied: payment.amount,
                invoice: payment.invoice
            }] : []);

            for (const link of invoicesToUpdate as any[]) {
                const inv = link.invoice || payment.invoice;
                if (!inv) continue;
                let newDeductions = (inv.total_deductions || 0);
                if (payment.deduction_amount > 0 && invoicesToUpdate.length === 1) {
                    newDeductions += payment.deduction_amount;
                }
                const { data: allInvoiceLinks } = await supabase.from("payment_links").select("*, payment:payments(status)").eq("invoice_id", inv.id);
                const totalPaid = (allInvoiceLinks as any[])?.reduce((sum, l) => {
                    if (l.payment?.status === 'approved' || l.payment_id === payment.id) {
                        return sum + (l.amount_applied || 0);
                    }
                    return sum;
                }, 0) || 0;
                const remainingBalance = Math.max(0, (inv.total || 0) - totalPaid - newDeductions);
                const newStatus = remainingBalance <= 0 ? 'Paid' : 'Partial';
                await (supabase.from("invoices") as any).update({
                    status: newStatus,
                    total_deductions: newDeductions
                } as any).eq("id", inv.id);
            }

            toast({ title: "Payment Verified", description: "Payment approved and invoices updated." });
            await refreshCounts();
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
            console.error("Error approving payment:", error);
            toast({ variant: "destructive", title: "Error", description: error.message });
            setProcessingId(null);
        }
    };

    const handleRejectPayment = async (payment: any) => {
        setProcessingId(payment.id);
        try {
            const { error } = await (supabase.from("payments") as any).update({ status: 'rejected' }).eq("id", payment.id);
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

    const handleApproveAppointment = async (app: any) => {
        setProcessingId(app.id);
        try {
            const { error } = await (supabase.from("appointments") as any).update({ status: 'confirmed' }).eq("id", app.id);
            if (error) throw error;
            toast({ title: "Appointment Approved", description: `Appointment for ${app.customer?.name} confirmed.` });
            await refreshCounts();
            fetchRequests();
            setProcessingId(null);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
            setProcessingId(null);
        }
    };

    const handleRejectAppointment = async (app: any) => {
        setProcessingId(app.id);
        try {
            const { error } = await (supabase.from("appointments") as any).update({ status: 'rejected' }).eq("id", app.id);
            if (error) throw error;
            toast({ title: "Appointment Rejected", description: "The request has been rejected." });
            await refreshCounts();
            fetchRequests();
            setProcessingId(null);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
            setProcessingId(null);
        }
    };

    const handleApproveLeave = async (request: any) => {
        setProcessingId(request.id);
        try {
            const { error } = await (supabase.from("leave_requests") as any).update({ status: 'approved' }).eq("id", request.id);
            if (error) throw error;
            toast({ title: "Leave Approved", description: `Leave for ${request.employee?.name} has been approved.` });
            await refreshCounts();
            fetchRequests();
            setProcessingId(null);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
            setProcessingId(null);
        }
    };

    const handleRejectLeave = async (request: any) => {
        setProcessingId(request.id);
        try {
            const { error } = await (supabase.from("leave_requests") as any).update({ status: 'rejected' }).eq("id", request.id);
            if (error) throw error;
            toast({ title: "Leave Rejected", description: "The leave request has been rejected." });
            await refreshCounts();
            fetchRequests();
            setProcessingId(null);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
            setProcessingId(null);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row min-h-screen bg-[#f8fafc] dark:bg-[#020617]">
            <AdminSidebar />

            <div className="flex-1 transition-all duration-300">
                <main className="p-4 md:p-8 lg:p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {/* Glassmorphic Header */}
                    <header className="relative p-6 rounded-3xl bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl border border-white dark:border-slate-800 shadow-[0_8px_32px_rgba(0,0,0,0.05)] overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                        <Inbox className="w-6 h-6" />
                                    </div>
                                    <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic">
                                        Inbox <span className="text-primary tracking-widest not-italic font-light opacity-50 ml-1">HUB</span>
                                    </h1>
                                </div>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-lg">
                                    High-performance approval center. Manage work orders, inventory requests, and revenue verification.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                onClick={fetchRequests}
                                disabled={loading}
                                className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-all rounded-2xl h-12 px-6"
                            >
                                <Zap className={`mr-2 h-4 w-4 text-primary ${loading ? 'animate-spin' : ''}`} />
                                <span className="font-bold tracking-wider text-xs">SYNCHRONIZE DATA</span>
                            </Button>
                        </div>
                    </header>

                    <Tabs defaultValue="work-approvals" value={activeTab} onValueChange={setActiveTab} className="space-y-8">
                        <TabsList className="flex items-center gap-2 bg-slate-200/50 dark:bg-slate-800/50 p-1.5 rounded-2xl w-fit border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-lg">
                            <TabsTrigger
                                value="work-approvals"
                                className="px-6 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg font-bold text-xs uppercase tracking-widest transition-all"
                            >
                                Work Orders
                                {workApprovals.length > 0 && (
                                    <Badge className={`ml-2 border-none rounded-md px-1.5 py-0.5 text-[10px] transition-colors ${activeTab === 'work-approvals' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                                        {workApprovals.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger
                                value="appointments"
                                className="px-6 py-2.5 rounded-xl data-[state=active]:bg-yellow-600 data-[state=active]:text-white data-[state=active]:shadow-lg font-bold text-xs uppercase tracking-widest transition-all"
                            >
                                Appointments
                                {appointments.length > 0 && (
                                    <Badge className={`ml-2 border-none rounded-md px-1.5 py-0.5 text-[10px] transition-colors ${activeTab === 'appointments' ? 'bg-white/20 text-white' : 'bg-yellow-600/10 text-yellow-600'}`}>
                                        {appointments.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger
                                value="part-requests"
                                className="px-6 py-2.5 rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg font-bold text-xs uppercase tracking-widest transition-all"
                            >
                                Part Requests
                                {partRequests.length > 0 && (
                                    <Badge className={`ml-2 border-none rounded-md px-1.5 py-0.5 text-[10px] transition-colors ${activeTab === 'part-requests' ? 'bg-white/20 text-white' : 'bg-blue-600/10 text-blue-600'}`}>
                                        {partRequests.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger
                                value="payment-requests"
                                className="px-6 py-2.5 rounded-xl data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg font-bold text-xs uppercase tracking-widest transition-all"
                            >
                                Payments
                                {payments.length > 0 && (
                                    <Badge className={`ml-2 border-none rounded-md px-1.5 py-0.5 text-[10px] transition-colors ${activeTab === 'payment-requests' ? 'bg-white/20 text-white' : 'bg-emerald-600/10 text-emerald-600'}`}>
                                        {payments.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger
                                value="leave-requests"
                                className="px-6 py-2.5 rounded-xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg font-bold text-xs uppercase tracking-widest transition-all"
                            >
                                Leave
                                {leaveRequests.length > 0 && (
                                    <Badge className={`ml-2 border-none rounded-md px-1.5 py-0.5 text-[10px] transition-colors ${activeTab === 'leave-requests' ? 'bg-white/20 text-white' : 'bg-indigo-600/10 text-indigo-600'}`}>
                                        {leaveRequests.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        </TabsList>

                        <div className="relative min-h-[400px]">
                            {/* Work Approvals Content */}
                            <TabsContent value="work-approvals" className="animate-in fade-in slide-in-from-left-4 duration-500 mt-0">
                                {workApprovals.length === 0 ? (
                                    <EmptyState icon={<ShieldCheck className="w-10 h-10" />} title="Operational Green" description="No work orders are currently awaiting approval. System clear." />
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {workApprovals.map((wo) => (
                                            <RequestCard
                                                key={wo.id}
                                                accent="orange"
                                                id={wo.id}
                                                title={wo.vehicle?.vehicle_number}
                                                subtitle={`${wo.service_type} • ${wo.vehicle?.model}`}
                                                description={wo.description}
                                                meta={`Customer: ${wo.vehicle?.customer?.name || "Unknown"}`}
                                                date={wo.created_at}
                                                onApprove={() => handleApproveWorkOrder(wo)}
                                                onReject={() => handleRejectWorkOrder(wo)}
                                                onView={() => navigate(`/admin/work-orders/${wo.id}`)}
                                                loading={processingId === wo.id}
                                            />
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            {/* Appointments Content */}
                            <TabsContent value="appointments" className="animate-in fade-in slide-in-from-left-4 duration-500 mt-0">
                                {appointments.length === 0 ? (
                                    <EmptyState icon={<Calendar className="w-10 h-10" />} title="All Caught Up" description="No new appointment requests to review." />
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {appointments.map((app) => (
                                            <RequestCard
                                                key={app.id}
                                                accent={app.status === 'confirmed' ? "emerald" : "orange"}
                                                id={app.id}
                                                title={app.customer?.name || "New Customer"}
                                                subtitle={`${app.vehicle?.vehicle_number || "New Vehicle"} • ${app.vehicle?.model || ""}`}
                                                description={app.status === 'confirmed' ? "CONFIRMED: Waiting for Job Card" : app.notes}
                                                badge={app.status === 'confirmed' ? "NEEDS JOB CARD" : "PENDING"}
                                                meta={`Scheduled: ${format(new Date(app.scheduled_at), "MMM d, h:mm a")}`}
                                                subMeta={app.customer?.company_name ? `Company: ${app.customer.company_name}` : undefined}
                                                extraInfo={app.services?.map((s: any) => s.service_name).join(", ")}
                                                date={app.created_at}
                                                onApprove={app.status === 'confirmed' ? () => navigate('/admin/work-orders') : () => handleApproveAppointment(app)}
                                                onReject={() => handleRejectAppointment(app)}
                                                onView={() => navigate(app.status === 'confirmed' ? `/admin/work-orders` : `/admin/appointments`)}
                                                approveLabel={app.status === 'confirmed' ? "OPEN JOB CARD" : "CONFIRM"}
                                                loading={processingId === app.id}
                                            />
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            {/* Part Requests Content */}
                            <TabsContent value="part-requests" className="animate-in fade-in slide-in-from-left-4 duration-500 mt-0">
                                {partRequests.length === 0 ? (
                                    <EmptyState icon={<Package className="w-10 h-10" />} title="Inventory Optimized" description="All part requests have been fulfilled or resolved." />
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {partRequests.map((req) => (
                                            <RequestCard
                                                key={req.id}
                                                accent="blue"
                                                id={req.id}
                                                title={req.part?.item_name || "Unknown Part"}
                                                subtitle={`SKU: ${req.part?.sku || "N/A"}`}
                                                badge={`QTY: ${req.requested_qty}`}
                                                meta={`Requester: ${req.employee?.name || "Unknown"}`}
                                                subMeta={req.work_order ? `Vehicle: ${req.work_order.vehicle?.vehicle_number}` : undefined}
                                                date={req.created_at}
                                                onApprove={() => handleApprovePartRequest(req)}
                                                onReject={() => handleRejectPartRequest(req)}
                                                approveLabel="ISSUE"
                                                loading={processingId === req.id}
                                            />
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            {/* Payments Content */}
                            <TabsContent value="payment-requests" className="animate-in fade-in slide-in-from-left-4 duration-500 mt-0">
                                {payments.length === 0 ? (
                                    <EmptyState icon={<IndianRupee className="w-10 h-10" />} title="Treasury Balanced" description="No pending payment verifications found in the queue." />
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {payments.map((pay) => (
                                            <RequestCard
                                                key={pay.id}
                                                accent="emerald"
                                                id={pay.id}
                                                title={`₹${pay.amount?.toLocaleString()}`}
                                                subtitle={pay.payment_method}
                                                meta={`Customer: ${pay.invoice?.customer?.name || "Unknown"}`}
                                                subMeta={`Bill: ${pay.invoice?.bill_number || "N/A"}`}
                                                extraInfo={pay.deduction_amount > 0 ? `Deduction: ₹${pay.deduction_amount.toLocaleString()}` : undefined}
                                                proofUrl={pay.proof_url}
                                                date={pay.created_at}
                                                onApprove={() => handleApprovePayment(pay)}
                                                onReject={() => handleRejectPayment(pay)}
                                                approveLabel="VERIFY"
                                                loading={processingId === pay.id}
                                            />
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            {/* Leave Requests Content */}
                            <TabsContent value="leave-requests" className="animate-in fade-in slide-in-from-left-4 duration-500 mt-0">
                                {leaveRequests.length === 0 ? (
                                    <EmptyState icon={<Calendar className="w-10 h-10" />} title="All Clear" description="No pending leave requests to review." />
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {leaveRequests.map((req) => (
                                            <RequestCard
                                                key={req.id}
                                                accent="indigo"
                                                id={req.id}
                                                title={req.employee?.name || "Unknown Staff"}
                                                subtitle={`${req.leave_type.toUpperCase()} LEAVE`}
                                                description={req.reason}
                                                meta={`From: ${format(new Date(req.start_date), "MMM d")}`}
                                                subMeta={`To: ${format(new Date(req.end_date), "MMM d")}`}
                                                date={req.created_at}
                                                onApprove={() => handleApproveLeave(req)}
                                                onReject={() => handleRejectLeave(req)}
                                                approveLabel="APPROVE"
                                                loading={processingId === req.id}
                                            />
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </div>
                    </Tabs>
                </main>
            </div>
        </div>
    );
}

// Reuseable Components for consistent UI

function EmptyState({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/30 dark:bg-slate-900/10 backdrop-blur-sm">
            <div className="p-5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 dark:text-slate-600 mb-6 animate-pulse">
                {icon}
            </div>
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 uppercase italic tracking-wider mb-2">{title}</h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-xs">{description}</p>
        </div>
    );
}

function RequestCard({
    accent, title, subtitle, description, meta, subMeta, badge, date,
    onApprove, onReject, onView, approveLabel = "APPROVE", loading, proofUrl, extraInfo
}: any) {
    const accentColors: any = {
        orange: "border-orange-500 bg-orange-500/5 text-orange-600",
        blue: "border-blue-500 bg-blue-500/5 text-blue-600",
        emerald: "border-emerald-500 bg-emerald-500/5 text-emerald-600",
        indigo: "border-indigo-500 bg-indigo-500/5 text-indigo-600"
    };

    const btnColors: any = {
        orange: "bg-orange-600 hover:bg-orange-700 shadow-orange-500/20",
        blue: "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20",
        emerald: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20",
        indigo: "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20"
    };

    return (
        <Card className={`group relative flex flex-col overflow-hidden border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900/40 hover:border-transparent hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-500`}>
            {/* Animated Bottom Glow */}
            <div className={`absolute -bottom-10 left-1/2 -translate-x-1/2 w-3/4 h-20 blur-[60px] opacity-0 group-hover:opacity-40 transition-opacity duration-700 ${accentColors[accent].split(' ')[1]}`} />

            <div className="p-6 flex-1 space-y-5 relative z-10">
                <div className="flex justify-between items-start gap-3">
                    <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full animate-pulse ${accentColors[accent].split(' ')[2]}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Request ID: {Math.random().toString(36).substr(2, 6).toUpperCase()}</span>
                        </div>
                        <h4 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-1 leading-tight group-hover:text-primary transition-colors">
                            {title}
                        </h4>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tighter">
                            {subtitle}
                        </p>
                    </div>
                    {badge && (
                        <Badge className={`${accentColors[accent]} border shadow-sm font-black text-[10px] rounded-lg px-2 py-1`}>
                            {badge}
                        </Badge>
                    )}
                </div>

                {description && (
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 italic text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                        "{description}"
                    </div>
                )}

                <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <User className="w-3.5 h-3.5 opacity-60" />
                        <span>{meta}</span>
                    </div>
                    {subMeta && (
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                            <Calendar className="w-3.5 h-3.5 opacity-60" />
                            <span>{subMeta}</span>
                        </div>
                    )}
                    {extraInfo && (
                        <div className="flex items-center gap-2 text-[10px] font-black text-orange-500 uppercase tracking-widest bg-orange-500/10 w-fit px-2 py-0.5 rounded-md">
                            <Zap className="w-3 h-3" />
                            {extraInfo}
                        </div>
                    )}
                </div>

                {proofUrl && (
                    <a
                        href={proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:text-primary/80 transition-colors py-1 group/link"
                    >
                        <FileText className="w-3.5 h-3.5" />
                        VIEW PAYMENT PROOF
                        <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </a>
                )}
            </div>

            <div className="p-4 pt-2 flex items-center gap-3 relative z-10">
                <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-11 font-black text-[10px] tracking-[0.2em] rounded-xl text-slate-400 hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all uppercase"
                    onClick={onReject}
                    disabled={loading}
                >
                    <XCircle className="w-4 h-4" />
                </Button>

                <Button
                    size="sm"
                    className={`flex-[3] h-11 font-black text-[10px] tracking-[0.2em] rounded-xl text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 uppercase ${btnColors[accent]}`}
                    onClick={onApprove}
                    disabled={loading}
                >
                    {loading ? (
                        <Clock className="w-4 h-4 animate-spin" />
                    ) : (
                        <CheckCircle2 className="w-4 h-4" />
                    )}
                    {approveLabel}
                </Button>

                {onView && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-primary hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-white/10"
                        onClick={onView}
                    >
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                )}
            </div>

            <div className="absolute top-2 right-4 text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                {format(new Date(date), "h:mm a")}
            </div>
        </Card>
    );
}
