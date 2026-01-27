// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
    ArrowLeft, Wrench, Users, ClipboardList, IndianRupee,
    CheckCircle2, XCircle, Clock, Trash2, Shield, User,
    Truck, AlertTriangle, RefreshCw, ChevronRight, Plus, X, Edit, Play,
    Bell, ShieldCheck
} from "lucide-react";
import { ProgressTracker } from "@/components/work-orders/ProgressTracker";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface ServiceDetail {
    id: string;
    service_type: string;
    status: string;
    estimated_cost: number;
    tasks: {
        id: string;
        task_name: string;
        completed: boolean;
        is_predefined: boolean;
        completed_at?: string | null;
        task_type?: string;
    }[];
    employees: {
        id: string;
        employee_id: string;
        status: string;
        assigned_at?: string | null;
        accepted_at?: string | null;
        employee: { id: string; name: string; position?: { department?: string } } | null;
    }[];
}

interface WorkOrder {
    id: string;
    service_type: string;
    description: string;
    status: string;
    priority: string;
    vehicle_id: string;
    vehicle: { vehicle_number: string; model: string; customer_id: string } | null;
    customer: { id: string; name: string; phone?: string; email?: string; address?: string } | null;
    created_at: string;
    notes?: string;
    estimated_cost?: number;
    accepted_at?: string | null;
    completed_at?: string | null;
    approved_at?: string | null;
    current_stage: string | null;
    inspection_status: 'pending' | 'completed' | 'approved';
    repair_status: 'pending' | 'in_progress' | 'completed' | 'approved';
    review_status: 'pending' | 'approved';
    customer_visible: boolean;
    completed_by_admin: boolean;
    stages?: Array<{
        id: string;
        stage: string;
        status: string;
        started_at: string | null;
        completed_at: string | null;
        notes: string | null;
    }>;
    tasks?: Array<{
        id: string;
        task_name: string;
        task_type: 'inspection' | 'repair' | 'testing' | 'quality';
        assigned_employee_id: string | null;
        completed: boolean;
        completed_at: string | null;
    }>;
}

interface Employee {
    id: string;
    name: string;
    email: string;
    position?: { id: string; name: string; department: string };
}

const STAGES = ['Inspection', 'Repair', 'Review', 'Quality Check', 'Delivery'];

export default function WorkOrderDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
    const [details, setDetails] = useState<ServiceDetail[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);

    // Dialog states
    const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
    const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
    const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
    const [notesDialogOpen, setNotesDialogOpen] = useState(false);

    // Form states
    const [approvalNotes, setApprovalNotes] = useState("");
    const [approvalAction, setApprovalAction] = useState<"approve" | "reject">("approve");
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
    const [selectedServiceId, setSelectedServiceId] = useState<string>("");
    const [customerNotes, setCustomerNotes] = useState("");
    const [processingApproval, setProcessingApproval] = useState(false);
    const [noteType, setNoteType] = useState<"internal" | "customer" | "reach_out">("internal");

    const fetchDetails = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            // Fetch Work Order
            const { data: woData, error: woError } = await supabase
                .from("work_orders")
                .select(`
          *, 
          vehicle:vehicles(vehicle_number, model, customer_id, customers(id, name, phone, email, address))
        `)
                .eq("id", id)
                .single();

            if (woError) throw woError;

            const woDataRaw = woData as any;
            if (!woDataRaw) throw new Error("Work order not found");

            const vehicle = woDataRaw.vehicle;
            const customer = vehicle?.customers;
            setWorkOrder({
                ...woDataRaw,
                customer: customer || { id: "", name: "Unknown", phone: "", email: "", address: "" }
            } as any);

            // Fetch Services, Tasks, and Employees
            const { data: servicesData, error: sError } = await supabase
                .from("work_order_services")
                .select(`
          id,
          service_type,
          status,
          estimated_cost,
          id,
          service_type,
          status,
          estimated_cost,
          employees:work_order_service_employees(
            id, 
            employee_id, 
            status,
            assigned_at,
            accepted_at,
            employee:employees(id, name, position:positions(id, name, department))
          )
        `)
                .eq("work_order_id", id);

            if (sError) throw sError;
            setDetails((servicesData as any) || []);

            // Fetch Stages
            const { data: stagesData, error: stagesError } = await supabase
                .from("work_order_stages")
                .select("*")
                .eq("work_order_id", id)
                .order("created_at", { ascending: true });

            if (stagesError) throw stagesError;

            // Fetch Work Order Tasks
            const { data: tasksData, error: tasksError } = await supabase
                .from("work_order_tasks")
                .select("*")
                .eq("work_order_id", id)
                .order("created_at", { ascending: true });

            if (tasksError) throw tasksError;

            // Group tasks by service and set details
            const formattedServices = (servicesData as any || []).map((service: any) => ({
                ...service,
                tasks: (tasksData || [])
                    .filter((t: any) => t.service_id === service.id)
                    .map((t: any) => ({
                        id: t.id,
                        task_name: t.task_name,
                        completed: t.completed,
                        is_predefined: t.is_predefined,
                        completed_at: t.completed_at,
                        task_type: t.task_type
                    }))
            }));
            setDetails(formattedServices);

            // Fetch available employees
            const { data: empData, error: empError } = await supabase
                .from("employees")
                .select(`
                    id, name, email,
                    position:positions(id, name, department)
                `)
                .eq("status", "active");

            if (empError) throw empError;
            setEmployees((empData as any) || []);

            setWorkOrder(prev => prev ? {
                ...prev,
                stages: stagesData as any,
                tasks: tasksData as any
            } : null);
        } catch (error: any) {
            console.error("Fetch error:", error);
            toast({ variant: "destructive", title: "Error", description: error.message });
            navigate("/admin/work-orders");
        } finally {
            setLoading(false);
        }
    }, [id, navigate, toast]);

    useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);

    // Handle Accept Order
    const handleAcceptOrder = async () => {
        if (!id) return;
        try {
            const { error } = await supabase
                .from("work_orders")
                .update({
                    status: "In Progress",
                    accepted_at: new Date().toISOString()
                } as any)
                .eq("id", id);

            if (error) throw error;
            toast({ title: "Work Order Accepted", description: "Status updated to In Progress" });
            fetchDetails();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    // Handle Approve/Reject Work
    const handleApproveWork = async () => {
        if (!id) return;
        setProcessingApproval(true);
        try {
            // @ts-ignore
            await supabase.rpc('approve_work', {
                _work_order_id: id,
                _approver_id: user?.id,
                _notes: approvalNotes
            });

            toast({
                title: approvalAction === "approve" ? "Work Approved" : "Changes Requested",
                description: approvalAction === "approve"
                    ? "The work has been approved and is now visible to the customer."
                    : "The staff has been notified of the required changes."
            });

            setApprovalDialogOpen(false);
            setApprovalNotes("");
            fetchDetails();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setProcessingApproval(false);
        }
    };

    // Handle Advance Stage
    const handleAdvanceStage = async (nextStage: string) => {
        if (!id) return;
        try {
            // @ts-ignore
            const { error } = await supabase.rpc('advance_work_order_stage', {
                _work_order_id: id,
                _stage: nextStage,
                _employee_id: null
            });

            if (error) throw error;
            toast({ title: "Stage Advanced", description: `Moved to ${nextStage}` });
            fetchDetails();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    // eslint-disable @typescript-eslint/no-explicit-any
    // Handle Add Employee to Service
    const handleAddEmployee = async () => {
        if (!id || !selectedEmployeeId || !selectedServiceId) return;

        try {
            const { error } = await supabase
                .from("work_order_service_employees")
                .insert({
                    service_id: selectedServiceId,
                    employee_id: selectedEmployeeId,
                    status: "Assigned",
                    assigned_at: new Date().toISOString()
                });

            if (error) throw error;
            toast({ title: "Employee Added", description: "Employee has been assigned to this service" });
            setEmployeeDialogOpen(false);
            setSelectedEmployeeId("");
            setSelectedServiceId("");
            fetchDetails();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };
    // eslint-enable @typescript-eslint/no-explicit-any

    // Handle Remove Employee from Service
    const handleRemoveEmployee = async (assignmentId: string) => {
        try {
            const { error } = await supabase
                .from("work_order_service_employees")
                .delete()
                .eq("id", assignmentId);

            if (error) throw error;
            toast({ title: "Employee Removed", description: "Employee has been removed from this service" });
            fetchDetails();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    // Handle Accept for Staff (Admin Override)
    const handleAcceptForStaff = async (assignmentId: string, serviceId: string) => {
        try {
            const { error: empError } = await supabase.from("work_order_service_employees").update({
                status: "Accepted",
                accepted_at: new Date().toISOString()
            }).eq("id", assignmentId);

            if (empError) throw empError;

            const { error: serviceError } = await supabase.from("work_order_services").update({
                status: "In Progress",
                started_at: new Date().toISOString()
            }).eq("id", serviceId);

            if (serviceError) throw serviceError;

            toast({ title: "Assignment Accepted", description: "Admin has manually accepted this assignment" });
            fetchDetails();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    // Handle Update Customer Notes
    const handleUpdateNotes = async () => {
        if (!id) return;
        try {
            let finalizedNotes = customerNotes;
            if (noteType === "reach_out") {
                finalizedNotes = `[Reach Out - ${format(new Date(), "PPp")}]\n${customerNotes}\n\n${workOrder?.notes || ""}`;
            } else if (noteType === "customer") {
                finalizedNotes = `[Customer Update - ${format(new Date(), "PPp")}]\n${customerNotes}\n\n${workOrder?.notes || ""}`;
            } else if (noteType === "internal") {
                finalizedNotes = `[Employee Update - ${format(new Date(), "PPp")}]\n${customerNotes}\n\n${workOrder?.notes || ""}`;
            }

            const { error } = await supabase
                .from("work_orders")
                .update({ notes: finalizedNotes } as any)
                .eq("id", id);

            if (error) throw error;
            toast({ title: "Notes Updated", description: "Status notes have been updated" });
            setNotesDialogOpen(false);
            setCustomerNotes("");
            fetchDetails();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    // Handle Mark Delivered
    const handleMarkDelivered = async () => {
        if (!id) return;
        try {
            const { error } = await supabase
                .from("work_orders")
                .update({
                    status: "Completed",
                    completed_at: new Date().toISOString(),
                    current_stage: "Delivery"
                } as any)
                .eq("id", id);

            if (error) throw error;

            // Explicitly mark Delivery stage as completed
            await supabase.from("work_order_stages")
                .upsert({
                    work_order_id: id,
                    stage: 'Delivery',
                    status: 'completed',
                    completed_at: new Date().toISOString()
                }, { onConflict: 'work_order_id,stage' });

            toast({ title: "Work Delivered", description: "Work order marked as Completed" });
            fetchDetails();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    // Handle Delete Work Order
    const handleDelete = async () => {
        if (!id) return;
        try {
            const { error } = await supabase.from("work_orders").delete().eq("id", id);
            if (error) throw error;
            toast({ title: "Deleted", description: "Work order deleted successfully" });
            navigate("/admin/work-orders");
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    // Handle Complete Task (Unified)
    const handleToggleTask = async (taskId: string, completed: boolean) => {
        if (!id) return;
        try {
            // @ts-ignore
            const { error } = await supabase.rpc('update_work_order_task_status', {
                p_task_id: taskId,
                p_work_order_id: id,
                p_completed: completed,
                p_employee_id: user?.id
            });

            if (error) throw error;
            toast({ title: completed ? "Task Completed" : "Task Reopened", description: "Task status has been updated" });
            fetchDetails();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    // Handle Stage Approvals
    const handleApproveStage = async (stage: 'inspection' | 'repair' | 'review') => {
        if (!id) return;
        try {
            const rpcName = stage === 'inspection' ? 'approve_inspection_stage' :
                stage === 'repair' ? 'approve_repair_stage' :
                    'approve_review_stage';

            // @ts-ignore
            const { error } = await supabase.rpc(rpcName, {
                p_work_order_id: id,
                p_approver_id: user?.id
            });

            if (error) throw error;
            toast({ title: "Stage Approved", description: `${stage.charAt(0).toUpperCase() + stage.slice(1)} has been approved` });
            fetchDetails();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    // Handle Force Complete
    const handleForceComplete = async () => {
        if (!id) return;
        try {
            // @ts-ignore
            const { error } = await supabase.rpc('force_complete_repair', {
                p_work_order_id: id,
                p_admin_id: user?.id
            });

            if (error) throw error;
            toast({ title: "Repair Force Completed", description: "All repair tasks have been marked as complete" });
            fetchDetails();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    // Handle Toggle Customer Visibility
    const handleToggleVisibility = async (visible: boolean) => {
        if (!id) return;
        try {
            const { error } = await supabase
                .from("work_orders")
                .update({ customer_visible: visible } as any)
                .eq("id", id);

            if (error) throw error;
            toast({ title: visible ? "Visible to Customer" : "Hidden from Customer", description: "Visibility setting updated" });
            fetchDetails();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    const getStatusBadge = (status: string) => {
        const s = status.toLowerCase();
        if (s === "pending") return <Badge variant="outline">Pending</Badge>;
        if (s === "in progress" || s === "accepted") return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
        if (s === "pending approval") return <Badge className="bg-orange-100 text-orange-800">Pending Approval</Badge>;
        if (s === "approved" || s === "completed" || s === "delivered") return <Badge className="bg-green-100 text-green-800">Finalized</Badge>;
        if (s === "rejected" || s === "cancelled") return <Badge variant="destructive">{status}</Badge>;
        return <Badge variant="secondary">{status}</Badge>;
    };

    if (loading) return <div className="flex items-center justify-center min-h-screen">Loading work order...</div>;
    if (!workOrder) return <div className="flex items-center justify-center min-h-screen">Work order not found.</div>;

    const canApprove = workOrder.status === "Pending Approval";
    const canAccept = workOrder.status === "Pending";
    const currentStageIndex = STAGES.indexOf(workOrder.current_stage || 'Inspection');
    const nextStage = currentStageIndex < STAGES.length - 1 ? STAGES[currentStageIndex + 1] : null;

    return (
        <div className="min-h-screen bg-background">
            {/* Navigation Header */}
            <div className="border-b bg-card">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/progress")}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                Work Order #{workOrder.id.slice(0, 8)}
                                {getStatusBadge(workOrder.status)}
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {workOrder.vehicle?.vehicle_number} • {workOrder.vehicle?.model}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {canAccept && (
                            <Button className="bg-green-600 hover:bg-green-700" onClick={handleAcceptOrder}>
                                <CheckCircle2 className="h-4 w-4 mr-2" /> Accept for Workshop
                            </Button>
                        )}
                        {/* Header actions are now mostly stage-specific in the sidebar */}
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" className="text-destructive hover:bg-destructive/10">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogTitle>Delete Work Order?</AlertDialogTitle>
                                <AlertDialogDescription>This action cannot be undone. All associated data will be lost.</AlertDialogDescription>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8">
                {/* Progress Tracker Section */}
                <div className="mb-8">
                    <ProgressTracker
                        currentStage={workOrder.current_stage}
                        stagesData={workOrder.stages}
                        canAdvance={true}
                        isAdmin={true}
                        onAdvanceStage={handleAdvanceStage}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Overview Card */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2">
                                        <ClipboardList className="h-5 w-5" />
                                        General Information
                                    </CardTitle>
                                    <Button variant="outline" size="sm" onClick={() => {
                                        setCustomerNotes(workOrder.notes || "");
                                        setNotesDialogOpen(true);
                                    }}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit Notes
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Description</h4>
                                    <p>{workOrder.description}</p>
                                </div>
                                {workOrder.notes && (
                                    <div className="bg-muted/50 p-3 rounded-lg border">
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Internal Notes</h4>
                                        <div className="text-sm font-sans">
                                            {(() => {
                                                try {
                                                    const parsed = JSON.parse(workOrder.notes);
                                                    if (typeof parsed === 'object' && parsed !== null) {
                                                        return (
                                                            <div className="space-y-2">
                                                                {parsed.service_types && Array.isArray(parsed.service_types) && (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {parsed.service_types.map((type: string, i: number) => (
                                                                            <Badge key={i} variant="secondary" className="bg-white/50">{type}</Badge>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {Object.entries(parsed).map(([key, value]) => {
                                                                    if (key === 'service_types') return null;
                                                                    return (
                                                                        <div key={key} className="flex gap-2">
                                                                            <span className="font-semibold capitalize text-muted-foreground">
                                                                                {key.replace(/_/g, ' ')}:
                                                                            </span>
                                                                            <span>{String(value)}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        );
                                                    }
                                                    return <pre className="whitespace-pre-wrap font-sans">{workOrder.notes}</pre>;
                                                } catch (e) {
                                                    return <pre className="whitespace-pre-wrap font-sans">{workOrder.notes}</pre>;
                                                }
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Service Sections */}
                        <h2 className="text-xl font-bold flex items-center gap-2 mt-8">
                            <Wrench className="h-6 w-6 text-primary" />
                            Service Details
                        </h2>

                        {/* Assignment Overview Container */}
                        <div className="mb-6">
                            <Card className="border-l-4 border-l-blue-500 bg-blue-50/10 shadow-sm">
                                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b">
                                    <div className="flex items-center gap-2">
                                        <Users className="h-5 w-5 text-blue-600" />
                                        <CardTitle className="text-base font-semibold">Staff Assignment Requests</CardTitle>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] font-mono bg-white">
                                        {details.reduce((acc, s) => acc + (s.employees?.length || 0), 0)} TOTAL
                                    </Badge>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="grid grid-cols-1 md:grid-cols-2 max-h-[300px] overflow-y-auto">
                                        {details.some(s => s.employees && s.employees.length > 0) ? (
                                            details.flatMap(s => (s.employees || []).map(emp => (
                                                <div key={emp.id} className="p-4 border-b border-r last:border-b-0 group flex items-center justify-between hover:bg-muted/30 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-blue-700 shadow-sm">
                                                            {emp.employee?.name?.split(' ').map(n => n[0]).join('') || "E"}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-zinc-900">{emp.employee?.name}</div>
                                                            <div className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1 bg-muted/50 w-fit px-1.5 rounded">
                                                                <Wrench className="h-2 w-2" /> {s.service_type}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex flex-col items-end gap-1">
                                                            <Badge
                                                                variant={emp.status === 'Accepted' ? 'default' : 'secondary'}
                                                                className={`text-[9px] uppercase tracking-tighter px-2 h-4 border-0 ${emp.status === 'Accepted' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-500 hover:bg-orange-600 text-white'
                                                                    }`}
                                                            >
                                                                {emp.status === 'Accepted' ? 'Working' : 'Pending'}
                                                            </Badge>
                                                            {emp.accepted_at && (
                                                                <span className="text-[9px] text-muted-foreground font-mono">
                                                                    {format(new Date(emp.accepted_at), "MMM d, HH:mm")}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {emp.status !== 'Accepted' && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 text-[10px] bg-green-50 text-green-700 border-green-200 hover:bg-green-100 px-2"
                                                                    onClick={() => handleAcceptForStaff(emp.id, s.id)}
                                                                >
                                                                    <Play className="h-3 w-3 mr-1" /> Accept for Staff
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={() => handleRemoveEmployee(emp.id)}
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )))
                                        ) : (
                                            <div className="p-12 text-center text-muted-foreground text-sm col-span-2">
                                                <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                                No employees assigned to any services yet.
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-4">
                            {details.map((service) => (
                                <Card key={service.id} className="overflow-hidden border-l-4 border-l-primary">
                                    <CardHeader className="bg-muted/20 pb-4">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <CardTitle>{service.service_type}</CardTitle>
                                                <CardDescription>Section Status: {service.status}</CardDescription>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold flex items-center justify-end">
                                                    <IndianRupee className="h-4 w-4" /> {service.estimated_cost}
                                                </p>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Tasks List */}
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                        Component Tasks
                                                    </h4>
                                                    <Badge variant="outline">
                                                        {service.tasks.filter(t => t.completed).length}/{service.tasks.length}
                                                    </Badge>
                                                </div>
                                                <div className="space-y-2">
                                                    {service.tasks.map((task) => (
                                                        <div key={task.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors border text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <Checkbox
                                                                    id={`service-task-${task.id}`}
                                                                    checked={task.completed}
                                                                    onCheckedChange={(checked) => handleToggleTask(task.id, checked === true)}
                                                                />
                                                                <label
                                                                    htmlFor={`service-task-${task.id}`}
                                                                    className={cn("cursor-pointer", task.completed && "line-through text-muted-foreground")}
                                                                >
                                                                    {task.task_name}
                                                                </label>
                                                            </div>
                                                            {task.completed ? (
                                                                <Badge variant="default" className="bg-green-600 text-[10px] h-5">Done</Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-[10px] h-5">Pending</Badge>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Assigned Employees */}
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                                        <Users className="h-4 w-4 text-blue-600" />
                                                        Assigned Personnel
                                                    </h4>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedServiceId(service.id);
                                                            setEmployeeDialogOpen(true);
                                                        }}
                                                    >
                                                        <Plus className="h-3 w-3 mr-1" />
                                                        Add
                                                    </Button>
                                                </div>
                                                <div className="space-y-2">
                                                    {service.employees && service.employees.length > 0 ? (
                                                        service.employees.map((emp) => (
                                                            <div key={emp.id} className="flex items-center justify-between p-2 rounded bg-blue-50/50 border border-blue-100 text-sm">
                                                                <div className="flex items-center gap-2">
                                                                    <User className="h-4 w-4 text-blue-400" />
                                                                    <div>
                                                                        <span className="font-medium">{emp.employee?.name}</span>
                                                                        {emp.employee?.position?.department && (
                                                                            <span className="text-xs text-muted-foreground ml-1">
                                                                                ({emp.employee.position.department})
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="secondary" className="text-[10px]">{emp.status}</Badge>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                        onClick={() => handleRemoveEmployee(emp.id)}
                                                                    >
                                                                        <X className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground text-center py-4">No employees assigned</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Customer & Vehicle Info */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base uppercase tracking-wider text-muted-foreground">Customer & Vehicle</CardTitle>
                                    <Button variant="ghost" size="sm" onClick={() => setCustomerDialogOpen(true)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg"><User className="h-5 w-5 text-primary" /></div>
                                    <div>
                                        <h4 className="font-bold">{workOrder.customer?.name}</h4>
                                        <p className="text-sm text-muted-foreground">{workOrder.customer?.phone}</p>
                                        <p className="text-xs text-muted-foreground">{workOrder.customer?.email}</p>
                                        {workOrder.customer?.address && (
                                            <p className="text-xs text-muted-foreground mt-1">{workOrder.customer.address}</p>
                                        )}
                                    </div>
                                </div>
                                <Separator />
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg"><Truck className="h-5 w-5 text-primary" /></div>
                                    <div>
                                        <h4 className="font-bold">{workOrder.vehicle?.vehicle_number}</h4>
                                        <p className="text-sm text-muted-foreground">{workOrder.vehicle?.model}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Lifecycle & Metrics */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base uppercase tracking-wider text-muted-foreground">Lifecycle</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Priority</span>
                                    <Badge variant={workOrder.priority === "Urgent" ? "destructive" : "outline"}>{workOrder.priority}</Badge>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Est. Total</span>
                                    <span className="font-bold flex items-center">
                                        <IndianRupee className="h-3 w-3" /> {workOrder.estimated_cost || 0}
                                    </span>
                                </div>
                                <Separator />
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Created</span>
                                        <span>{format(new Date(workOrder.created_at), "MMM d, yyyy HH:mm")}</span>
                                    </div>
                                    {workOrder.accepted_at && (
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Accepted</span>
                                            <span>{format(new Date(workOrder.accepted_at), "MMM d, HH:mm")}</span>
                                        </div>
                                    )}
                                    {workOrder.completed_at && (
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Completed</span>
                                            <span>{format(new Date(workOrder.completed_at), "MMM d, HH:mm")}</span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Workflow Actions */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                    Workflow Actions
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs">Visible to Customer</span>
                                        <Switch
                                            checked={workOrder.customer_visible}
                                            onCheckedChange={handleToggleVisibility}
                                        />
                                    </div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Stage 1: Inspection Approval */}
                                <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Checkbox
                                            id="inspection-approval"
                                            checked={workOrder.inspection_status === 'approved'}
                                            onCheckedChange={async (checked) => {
                                                try {
                                                    // Update work_orders table
                                                    const { error: woError } = await supabase.from("work_orders").update({
                                                        inspection_status: checked ? 'approved' : 'pending'
                                                    } as any).eq("id", id);

                                                    if (woError) throw woError;

                                                    // Update or create work_order_stages record for customer portal
                                                    if (checked) {
                                                        await supabase.from("work_order_stages")
                                                            .upsert({
                                                                work_order_id: id,
                                                                stage: 'Inspection',
                                                                status: 'completed',
                                                                completed_at: new Date().toISOString()
                                                            }, { onConflict: 'work_order_id,stage' });
                                                    } else {
                                                        await supabase.from("work_order_stages")
                                                            .upsert({
                                                                work_order_id: id,
                                                                stage: 'Inspection',
                                                                status: 'pending',
                                                                completed_at: null
                                                            }, { onConflict: 'work_order_id,stage' });
                                                    }

                                                    toast({
                                                        title: checked ? "Inspection Approved" : "Inspection Unapproved",
                                                        description: checked ? "Inspection has been approved" : "Inspection status reset to pending"
                                                    });
                                                    fetchDetails();
                                                } catch (error: any) {
                                                    toast({ variant: "destructive", title: "Error", description: error.message });
                                                }
                                            }}
                                            className="h-5 w-5"
                                        />
                                        <label htmlFor="inspection-approval" className="flex items-center gap-2 cursor-pointer">
                                            <Shield className="h-4 w-4 text-green-600" />
                                            <span className="font-medium">Approve Inspection</span>
                                        </label>
                                    </div>
                                    <Badge variant={workOrder.inspection_status === 'approved' ? "default" : "outline"} className={workOrder.inspection_status === 'approved' ? "bg-green-600" : ""}>
                                        {workOrder.inspection_status === 'approved' ? 'Approved' : 'Pending'}
                                    </Badge>
                                </div>

                                {/* Stage 2: Repair Approval */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                id="repair-approval"
                                                checked={workOrder.repair_status === 'approved'}
                                                onCheckedChange={async (checked) => {
                                                    try {
                                                        // Update work_orders table
                                                        const { error: woError } = await supabase.from("work_orders").update({
                                                            repair_status: checked ? 'approved' : 'in_progress'
                                                        } as any).eq("id", id);

                                                        if (woError) throw woError;

                                                        // Update or create work_order_stages record for customer portal
                                                        if (checked) {
                                                            await supabase.from("work_order_stages")
                                                                .upsert({
                                                                    work_order_id: id,
                                                                    stage: 'Repair',
                                                                    status: 'completed',
                                                                    completed_at: new Date().toISOString()
                                                                }, { onConflict: 'work_order_id,stage' });
                                                        } else {
                                                            await supabase.from("work_order_stages")
                                                                .upsert({
                                                                    work_order_id: id,
                                                                    stage: 'Repair',
                                                                    status: 'in_progress',
                                                                    completed_at: null
                                                                }, { onConflict: 'work_order_id,stage' });
                                                        }

                                                        toast({
                                                            title: checked ? "Repair Approved" : "Repair Unapproved",
                                                            description: checked ? "Repair has been approved" : "Repair status reset to in progress"
                                                        });
                                                        fetchDetails();
                                                    } catch (error: any) {
                                                        toast({ variant: "destructive", title: "Error", description: error.message });
                                                    }
                                                }}
                                                className="h-5 w-5"
                                            />
                                            <label htmlFor="repair-approval" className="flex items-center gap-2 cursor-pointer">
                                                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                                                <span className="font-medium">Approve Repair Completion</span>
                                            </label>
                                        </div>
                                        <Badge variant={workOrder.repair_status === 'approved' ? "default" : "outline"} className={workOrder.repair_status === 'approved' ? "bg-blue-600" : ""}>
                                            {workOrder.repair_status === 'approved' ? 'Approved' : workOrder.repair_status === 'completed' ? 'Completed' : 'In Progress'}
                                        </Badge>
                                    </div>
                                    {workOrder.repair_status !== 'completed' && workOrder.repair_status !== 'approved' && (
                                        <Button className="w-full justify-start bg-orange-600 hover:bg-orange-700" onClick={handleForceComplete}>
                                            <AlertTriangle className="h-4 w-4 mr-2" /> Force Complete Repair
                                        </Button>
                                    )}
                                </div>

                                {/* Stage 3: Review Approval */}
                                <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Checkbox
                                            id="review-approval"
                                            checked={workOrder.review_status === 'approved'}
                                            onCheckedChange={async (checked) => {
                                                try {
                                                    // Update work_orders table
                                                    const { error: woError } = await supabase.from("work_orders").update({
                                                        review_status: checked ? 'approved' : 'pending'
                                                    } as any).eq("id", id);

                                                    if (woError) throw woError;

                                                    // Update or create work_order_stages record for customer portal
                                                    if (checked) {
                                                        await supabase.from("work_order_stages")
                                                            .upsert({
                                                                work_order_id: id,
                                                                stage: 'Review',
                                                                status: 'completed',
                                                                completed_at: new Date().toISOString()
                                                            }, { onConflict: 'work_order_id,stage' });
                                                    } else {
                                                        await supabase.from("work_order_stages")
                                                            .upsert({
                                                                work_order_id: id,
                                                                stage: 'Review',
                                                                status: 'pending',
                                                                completed_at: null
                                                            }, { onConflict: 'work_order_id,stage' });
                                                    }

                                                    toast({
                                                        title: checked ? "Review Approved" : "Review Unapproved",
                                                        description: checked ? "Review has been approved" : "Review status reset to pending"
                                                    });
                                                    fetchDetails();
                                                } catch (error: any) {
                                                    toast({ variant: "destructive", title: "Error", description: error.message });
                                                }
                                            }}
                                            className="h-5 w-5"
                                        />
                                        <label htmlFor="review-approval" className="flex items-center gap-2 cursor-pointer">
                                            <Shield className="h-4 w-4 text-purple-600" />
                                            <span className="font-medium">Approve Review</span>
                                        </label>
                                    </div>
                                    <Badge variant={workOrder.review_status === 'approved' ? "default" : "outline"} className={workOrder.review_status === 'approved' ? "bg-purple-600" : ""}>
                                        {workOrder.review_status === 'approved' ? 'Approved' : 'Pending'}
                                    </Badge>
                                </div>

                                {/* Stage 4: Quality Check/Evaluation */}
                                <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Checkbox
                                            id="quality-check"
                                            checked={workOrder.quality_check_status === 'completed'}
                                            onCheckedChange={async (checked) => {
                                                try {
                                                    // Update work_orders table
                                                    const { error: woError } = await supabase.from("work_orders").update({
                                                        quality_check_status: checked ? 'completed' : 'pending'
                                                    } as any).eq("id", id);

                                                    if (woError) throw woError;

                                                    // Update or create work_order_stages record for customer portal
                                                    if (checked) {
                                                        await supabase.from("work_order_stages")
                                                            .upsert({
                                                                work_order_id: id,
                                                                stage: 'Quality Check',
                                                                status: 'completed',
                                                                completed_at: new Date().toISOString()
                                                            }, { onConflict: 'work_order_id,stage' });
                                                    } else {
                                                        await supabase.from("work_order_stages")
                                                            .upsert({
                                                                work_order_id: id,
                                                                stage: 'Quality Check',
                                                                status: 'pending',
                                                                completed_at: null
                                                            }, { onConflict: 'work_order_id,stage' });
                                                    }

                                                    toast({
                                                        title: checked ? "Quality Check Completed" : "Quality Check Reset",
                                                        description: checked ? "Quality evaluation has been completed" : "Quality check status reset to pending"
                                                    });
                                                    fetchDetails();
                                                } catch (error: any) {
                                                    toast({ variant: "destructive", title: "Error", description: error.message });
                                                }
                                            }}
                                            className="h-5 w-5"
                                        />
                                        <label htmlFor="quality-check" className="flex items-center gap-2 cursor-pointer">
                                            <ShieldCheck className="h-4 w-4 text-indigo-600" />
                                            <span className="font-medium">Quality Check/Evaluation</span>
                                        </label>
                                    </div>
                                    <Badge variant={workOrder.quality_check_status === 'completed' ? "default" : "outline"} className={workOrder.quality_check_status === 'completed' ? "bg-indigo-600" : ""}>
                                        {workOrder.quality_check_status === 'completed' ? 'Completed' : 'Pending'}
                                    </Badge>
                                </div>

                                {/* Stage 5: Alert Customer for Delivery */}
                                <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Checkbox
                                            id="customer-alert"
                                            checked={workOrder.customer_notified === true}
                                            disabled={workOrder.quality_check_status !== 'completed'}
                                            onCheckedChange={async (checked) => {
                                                try {
                                                    // Update work_orders table - mark as Completed when customer is alerted
                                                    const updates: any = {
                                                        customer_notified: checked
                                                    };

                                                    if (checked) {
                                                        updates.customer_visible = true; // Ensure customer can see it
                                                    }

                                                    const { error: woError } = await supabase.from("work_orders").update(updates).eq("id", id);

                                                    if (woError) throw woError;

                                                    // Update delivery stage for customer portal
                                                    if (checked) {
                                                        await supabase.from("work_order_stages")
                                                            .upsert({
                                                                work_order_id: id,
                                                                stage: 'Delivery',
                                                                status: 'in_progress',
                                                                started_at: new Date().toISOString()
                                                            }, { onConflict: 'work_order_id,stage' });
                                                    } else {
                                                        await supabase.from("work_order_stages")
                                                            .upsert({
                                                                work_order_id: id,
                                                                stage: 'Delivery',
                                                                status: 'pending',
                                                                started_at: null
                                                            }, { onConflict: 'work_order_id,stage' });
                                                    }

                                                    toast({
                                                        title: checked ? "Customer Alerted" : "Alert Cancelled",
                                                        description: checked ? "Customer has been notified." : "Customer notification cancelled"
                                                    });
                                                    fetchDetails();
                                                } catch (error: any) {
                                                    toast({ variant: "destructive", title: "Error", description: error.message });
                                                }
                                            }}
                                            className="h-5 w-5"
                                        />
                                        <label htmlFor="customer-alert" className="flex items-center gap-2 cursor-pointer">
                                            <Bell className="h-4 w-4 text-amber-600" />
                                            <span className="font-medium">Alert Customer for Delivery</span>
                                        </label>
                                    </div>
                                    <Badge variant={workOrder.customer_notified ? "default" : "outline"} className={workOrder.customer_notified ? "bg-amber-600" : ""}>
                                        {workOrder.customer_notified ? 'Alerted' : 'Not Alerted'}
                                    </Badge>
                                </div>

                                {/* Stage 6: Mark as Delivered */}
                                <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Checkbox
                                            id="delivery-status"
                                            checked={workOrder.status === 'Completed'}
                                            disabled={!workOrder.customer_notified}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    handleMarkDelivered();
                                                } else {
                                                    // Unmark as delivered - reset to Pending Approval
                                                    supabase.from("work_orders").update({
                                                        status: 'Pending Approval',
                                                        completed_at: null
                                                    } as any).eq("id", id).then(() => {
                                                        toast({ title: "Delivery Unmarked", description: "Work order status reset to Pending Approval" });
                                                        fetchDetails();
                                                    });
                                                }
                                            }}
                                            className="h-5 w-5"
                                        />
                                        <label htmlFor="delivery-status" className="flex items-center gap-2 cursor-pointer">
                                            <Truck className="h-4 w-4 text-primary" />
                                            <span className="font-medium">Mark as Delivered</span>
                                        </label>
                                    </div>
                                    <Badge variant={workOrder.status === 'Completed' ? "default" : "outline"} className={workOrder.status === 'Completed' ? "bg-primary" : ""}>
                                        {workOrder.status === 'Completed' ? 'Completed' : 'Not Completed'}
                                    </Badge>
                                </div>

                                {/* Dynamic Task List (Audit) */}
                                {workOrder.tasks && workOrder.tasks.length > 0 && (
                                    <div className="pt-4 border-t mt-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Work Order Tasks</h4>
                                            <Badge variant="outline">
                                                {workOrder.tasks.filter(t => t.completed).length}/{workOrder.tasks.length}
                                            </Badge>
                                        </div>
                                        <div className="space-y-2">
                                            {workOrder.tasks.map((task) => (
                                                <div key={task.id} className="flex items-center space-x-2 p-1 hover:bg-muted/30 rounded transition-colors">
                                                    <Checkbox
                                                        id={task.id}
                                                        checked={task.completed}
                                                        onCheckedChange={(checked) => handleToggleTask(task.id, checked === true)}
                                                    />
                                                    <div className="flex-1">
                                                        <label
                                                            htmlFor={task.id}
                                                            className={cn("text-sm cursor-pointer block", task.completed && "line-through text-muted-foreground")}
                                                        >
                                                            {task.task_name}
                                                        </label>
                                                        <span className="text-[10px] text-muted-foreground uppercase">{task.task_type}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Updates & Communication */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base uppercase tracking-wider text-muted-foreground">Updates & Comm</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => {
                                        setSelectedServiceId(details[0]?.id || "");
                                        setEmployeeDialogOpen(true);
                                    }}
                                    disabled={details.length === 0}
                                >
                                    <Users className="h-4 w-4 mr-2" />
                                    Assign Employee
                                </Button>
                                <Button variant="outline" className="w-full justify-start" onClick={() => { setNoteType("reach_out"); setCustomerNotes(""); setNotesDialogOpen(true); }}>
                                    <Clock className="h-4 w-4 mr-2" /> Customer Reach Out
                                </Button>
                                <Button variant="outline" className="w-full justify-start" onClick={() => { setNoteType("customer"); setCustomerNotes(""); setNotesDialogOpen(true); }}>
                                    <User className="h-4 w-4 mr-2" /> Customer Update
                                </Button>
                                <Button variant="outline" className="w-full justify-start" onClick={() => { setNoteType("internal"); setCustomerNotes(""); setNotesDialogOpen(true); }}>
                                    <ClipboardList className="h-4 w-4 mr-2" /> Employee Update
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Approval/Rejection Dialog */}
            <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{approvalAction === "approve" ? "Approve Work" : "Reject Work - Request Changes"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">
                            {approvalAction === "approve"
                                ? "This will finalize the work and notify the customer for delivery/pickup."
                                : "Please specify what repairs or tasks need to be re-addressed by the team."}
                        </p>
                        <Textarea
                            placeholder="Add notes here..."
                            value={approvalNotes}
                            onChange={(e) => setApprovalNotes(e.target.value)}
                            rows={4}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>Cancel</Button>
                        <Button
                            className={approvalAction === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-destructive"}
                            onClick={handleApproveWork}
                            disabled={processingApproval}
                        >
                            {processingApproval ? "Processing..." : (approvalAction === "approve" ? "Confirm Approval" : "Submit Rejection")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Employee Dialog */}
            <Dialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign Employee</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Service Type</label>
                            <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select service" />
                                </SelectTrigger>
                                <SelectContent>
                                    {details.map((service) => (
                                        <SelectItem key={service.id} value={service.id}>
                                            {service.service_type}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Employee</label>
                            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select employee" />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map((emp) => (
                                        <SelectItem key={emp.id} value={emp.id}>
                                            {emp.name} ({emp.position?.department || 'No Department'})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEmployeeDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddEmployee} disabled={!selectedServiceId || !selectedEmployeeId}>
                            Assign Employee
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Customer Dialog */}
            <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Customer Information</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Name</label>
                                <Input value={workOrder.customer?.name || ""} disabled />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Phone</label>
                                <Input value={workOrder.customer?.phone || ""} disabled />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Email</label>
                                <Input value={workOrder.customer?.email || ""} disabled />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Vehicle</label>
                                <Input value={`${workOrder.vehicle?.vehicle_number} - ${workOrder.vehicle?.model}`} disabled />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Contact customer management to update customer details.</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCustomerDialogOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Notes Dialog */}
            <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {noteType === "reach_out" ? "Customer Reach Out" :
                                noteType === "customer" ? "Customer Update" :
                                    "Employee Update (Internal)"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Textarea
                            placeholder={
                                noteType === "reach_out" ? "Record what was discussed with the customer..." :
                                    noteType === "customer" ? "Enter information to be shared with the customer..." :
                                        "Add internal notes about this work order..."
                            }
                            value={customerNotes}
                            onChange={(e) => setCustomerNotes(e.target.value)}
                            rows={6}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpdateNotes}>Save Update</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

