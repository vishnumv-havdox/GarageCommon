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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
    ArrowLeft, Wrench, Users, ClipboardList, IndianRupee,
    CheckCircle2, XCircle, Clock, Trash2, Shield, User,
    Truck, AlertTriangle, RefreshCw, ChevronRight, Plus, X, Edit, Play,
    Bell, ShieldCheck, FileText, Calendar as CalendarIcon,
    ListOrdered, Search, TrendingUp, Info, Loader2, RotateCcw
} from "lucide-react";
import { ProgressTracker } from "@/components/work-orders/ProgressTracker";
import { PartRequestList } from "@/components/inventory/PartRequestList";
import { Progress } from "@/components/ui/progress";
import { EmployeeTracker } from "@/components/employees/EmployeeTracker";
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
import { generateWorkSlipPDF, generateInvoicePDF } from "@/utils/pdfGenerator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { WorkOrderForm } from "@/components/forms/WorkOrderForm";

interface ServiceDetail {
    id: string;
    service_type: string;
    status: string;
    estimated_cost: number;
    tasks: {
        id: string;
        task_name: string;
        price: number;
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
    tasks: {
        id: string;
        task_name: string;
        price: number;
        completed: boolean;
        is_predefined: boolean;
        completed_at?: string | null;
        task_type?: string;
        is_rejected?: boolean;
        rejection_reason?: string;
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
        is_rejected?: boolean;
        rejection_reason?: string;
    }>;
    is_reopened?: boolean;
    reopen_reason?: string;
    reopened_at?: string;
    reopened_by?: string;
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

    // Extension: Assignment stats and workload
    const [assignmentPosition, setAssignmentPosition] = useState("0");
    const [employeeWorkload, setEmployeeWorkload] = useState<any[]>([]);

    // Rejection & Reopen states
    const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
    const [selectedTasksForRejection, setSelectedTasksForRejection] = useState<string[]>([]);
    const [rejectionReason, setRejectionReason] = useState("");
    const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
    const [reopenReason, setReopenReason] = useState("");
    const [showConfigForm, setShowConfigForm] = useState(false);
    const [showAddServiceForm, setShowAddServiceForm] = useState(false);
    const [bulkApproving, setBulkApproving] = useState(false);
    const [employeeAttendance, setEmployeeAttendance] = useState<any>(null);
    const [loadingEmployeeData, setLoadingEmployeeData] = useState(false);
    const [empSearchTerm, setEmpSearchTerm] = useState("");

    // Extension: Employee Tracker Integration
    const [trackerOpen, setTrackerOpen] = useState(false);
    const [selectedTrackerEmployee, setSelectedTrackerEmployee] = useState<any>(null);

    const handleOpenTracker = (emp: any) => {
        // Handle both formats of employee data
        const formattedEmp = emp.employee ? {
            ...emp.employee,
            name: emp.employee.name,
            id: emp.employee_id || emp.employee.id
        } : emp;

        setSelectedTrackerEmployee(formattedEmp);
        setTrackerOpen(true);
    };

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
                        price: t.price || 0,
                        completed: t.is_completed || t.completed,
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

    useEffect(() => {
        if (selectedEmployeeId && employeeDialogOpen) {
            fetchEmployeeAssignmentInfo();
        }
    }, [selectedEmployeeId, employeeDialogOpen]);

    const fetchEmployeeAssignmentInfo = async () => {
        setLoadingEmployeeData(true);
        try {
            // 1. Fetch workload
            const { data: workload, error: wlError } = await supabase.rpc('get_employee_active_workload', {
                p_employee_id: selectedEmployeeId
            });
            if (wlError) throw wlError;
            setEmployeeWorkload(workload || []);

            // 2. Fetch attendance for today
            const today = format(new Date(), 'yyyy-MM-dd');
            const { data: attendance, error: attError } = await supabase
                .from('attendance')
                .select('*')
                .eq('employee_id', selectedEmployeeId)
                .eq('date', today)
                .maybeSingle();

            if (attError) throw attError;
            setEmployeeAttendance(attendance);

            // 3. Set default position (max + 1)
            const maxPos = workload?.reduce((max: number, item: any) => Math.max(max, (item.queue_position || 0)), 0) || 0;
            setAssignmentPosition((maxPos + 1).toString());

        } catch (error: any) {
            console.error("Error fetching employee info:", error);
        } finally {
            setLoadingEmployeeData(false);
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
                title: "Work Approved",
                description: "The work has been approved and is now visible to the customer."
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

    const handleRejectTasks = async () => {
        if (!id) return;
        if (selectedTasksForRejection.length === 0) {
            toast({ variant: "destructive", title: "Error", description: "Please select at least one task to reject." });
            return;
        }
        if (!rejectionReason) {
            toast({ variant: "destructive", title: "Error", description: "Please provide a reason for rejection." });
            return;
        }

        setProcessingApproval(true);
        try {
            const { error } = await supabase.rpc('reject_work_tasks', {
                p_work_order_id: id,
                p_task_ids: selectedTasksForRejection,
                p_reason: rejectionReason,
                p_approver_id: user?.id
            });

            if (error) throw error;

            toast({
                title: "Work Rejected",
                description: "The selected tasks have been rejected and staff has been notified."
            });

            setRejectionDialogOpen(false);
            setSelectedTasksForRejection([]);
            setRejectionReason("");
            fetchDetails();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setProcessingApproval(false);
        }
    };

    // Handle Reopen Work Order
    const handleReopenWorkOrder = () => {
        if (!reopenReason) {
            toast({
                title: "Reason Required",
                description: "Please provide a reason for reopening.",
                variant: "destructive"
            });
            return;
        }
        setReopenDialogOpen(false);
        setShowConfigForm(true);
    };

    // Handle Bulk Approve All Pending Assignments
    const handleBulkApprove = async () => {
        if (!id) return;

        setBulkApproving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            const { data, error } = await supabase.rpc('approve_all_pending_assignments', {
                p_work_order_id: id,
                p_approver_id: user.id
            });

            if (error) throw error;

            const approvedCount = data?.[0]?.approved_count || 0;

            toast({
                title: "Bulk Approval Successful",
                description: `${approvedCount} staff assignment${approvedCount !== 1 ? 's' : ''} approved and released to staff.`,
            });

            fetchDetails();
        } catch (error: any) {
            console.error("Bulk approval error:", error);
            toast({
                title: "Approval Failed",
                description: error.message || "Failed to approve assignments.",
                variant: "destructive"
            });
        } finally {
            setBulkApproving(false);
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
                    queue_position: parseInt(assignmentPosition) || 0,
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

    // Handle Revert Assignment (Reset to Assigned)
    const handleRevertAssignment = async (empId: string, serviceId: string) => {
        try {
            const { error: updateError } = await supabase
                .from('work_order_service_employees')
                .update({ status: 'Assigned', accepted_at: null })
                .eq('service_id', serviceId)
                .eq('employee_id', empId);

            if (updateError) throw updateError;

            toast({
                title: "Assignment Reverted",
                description: "Employee assignment status has been reset to 'Assigned'.",
            });
            fetchDetails();
        } catch (error: any) {
            console.error("Error reverting assignment:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to revert assignment: " + error.message
            });
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

            // Service status update should happen when STAFF accepts, not when Admin releases.
            // Keeping service as is.

            toast({ title: "Released to Staff", description: "Assignment is now pending staff acceptance" });
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

    // Handle Delete Service
    const handleDeleteService = async (serviceId: string) => {
        if (!confirm("Are you sure you want to delete this service? This will remove all associated tasks and assignments.")) return;
        try {
            const { error } = await supabase.from("work_order_services").delete().eq("id", serviceId);
            if (error) throw error;
            toast({ title: "Service Deleted", description: "Service removed successfully" });
            fetchDetails();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    // Handle Delete Task
    const handleDeleteTask = async (taskId: string) => {
        if (!confirm("Are you sure you want to delete this task?")) return;
        try {
            const { error } = await supabase.from("work_order_tasks").delete().eq("id", taskId);
            if (error) throw error;
            toast({ title: "Task Deleted", description: "Task removed successfully" });
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
                        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                Work Order #{workOrder.id.slice(0, 8)}
                                {getStatusBadge(workOrder.status)}
                                {workOrder.is_reopened && (
                                    <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-50 animate-pulse">
                                        <RefreshCw className="h-3 w-3 mr-1" /> Reopened
                                    </Badge>
                                )}
                            </h1>
                            {workOrder.is_reopened && workOrder.reopen_reason && (
                                <div className="mt-1 flex items-center gap-2 text-orange-600 text-[10px] font-medium uppercase tracking-wider">
                                    <Info className="h-3 w-3" /> Reason: {workOrder.reopen_reason}
                                </div>
                            )}
                            <p className="text-sm text-muted-foreground">
                                {workOrder.vehicle?.vehicle_number} • {workOrder.vehicle?.model}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={() => fetchDetails()} title="Refresh Details">
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" onClick={() => generateWorkSlipPDF(workOrder.id)} title="Download Work Slip">
                            <FileText className="h-4 w-4 mr-2" /> Slip
                        </Button>
                        <Button variant="outline" onClick={() => generateInvoicePDF(workOrder.id)} title="Download Tax Invoice">
                            <IndianRupee className="h-4 w-4 mr-2" /> Invoice
                        </Button>

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
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[10px] font-mono bg-white">
                                            {details.reduce((acc, s) => acc + (s.employees?.length || 0), 0)} TOTAL
                                        </Badge>
                                        {details.some(s => s.employees?.some(e => e.status === 'Assigned')) && (
                                            <Button
                                                size="sm"
                                                variant="default"
                                                className="h-7 text-[10px] bg-indigo-600 hover:bg-indigo-700 px-3"
                                                onClick={handleBulkApprove}
                                                disabled={bulkApproving}
                                            >
                                                {bulkApproving ? (
                                                    <>
                                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                        Approving...
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                                        Approve All Pending
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                    </div>
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
                                                            {emp.status === 'Assigned' && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 px-2"
                                                                    onClick={() => handleAcceptForStaff(emp.id, s.id)}
                                                                >
                                                                    <Play className="h-3 w-3 mr-1" /> Release to Staff
                                                                </Button>
                                                            )}
                                                            {emp.status === 'pending_acceptance' && (
                                                                <Badge variant="outline" className="h-7 text-[9px] bg-orange-50 text-orange-700 border-orange-200">
                                                                    <Clock className="h-3 w-3 mr-1" /> Waiting for Staff
                                                                </Badge>
                                                            )}
                                                            {(emp.status === 'Accepted' || emp.status === 'In Progress') && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                                                    title="Revert to Assigned"
                                                                    onClick={() => handleRevertAssignment(emp.id, s.id)}
                                                                >
                                                                    <RotateCcw className="h-4 w-4" />
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
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold">Service Details</h3>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs bg-primary/5 border-primary/20 hover:bg-primary/10"
                                    onClick={() => setShowAddServiceForm(true)}
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                    Add Service
                                </Button>
                            </div>
                            {details.map((service) => (
                                <Card key={service.id} className="overflow-hidden border-l-4 border-l-primary">
                                    <CardHeader className="bg-muted/20 pb-4">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <CardTitle className="flex items-center gap-2">
                                                    {service.service_type}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                        onClick={() => handleDeleteService(service.id)}
                                                        title="Delete Service"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </CardTitle>
                                                <CardDescription>Section Status: {service.status}</CardDescription>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold flex items-center justify-end">
                                                    <IndianRupee className="h-4 w-4" /> {service.tasks?.filter(t => t.completed).reduce((sum, task) => sum + (task.price || 0), 0) || 0}
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
                                                        {(service.tasks || []).filter(t => t.completed).length}/{(service.tasks || []).length}
                                                    </Badge>
                                                </div>
                                                <div className="space-y-2">
                                                    {(service.tasks || []).map((task) => (
                                                        <div key={task.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors border text-sm group">
                                                            <div className="flex items-center gap-2 flex-1">
                                                                <Checkbox
                                                                    id={`service-task-${task.id}`}
                                                                    checked={task.completed}
                                                                    onCheckedChange={(checked) => handleToggleTask(task.id, checked === true)}
                                                                />
                                                                <label
                                                                    htmlFor={`service-task-${task.id}`}
                                                                    className={cn("cursor-pointer flex-1", task.completed && "line-through text-muted-foreground")}
                                                                >
                                                                    {task.task_name}
                                                                </label>
                                                                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1 rounded">₹{task.price || 0}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {task.completed ? (
                                                                    <Badge variant="default" className="bg-green-600 text-[10px] h-5">Done</Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-[10px] h-5">Pending</Badge>
                                                                )}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    onClick={() => handleDeleteTask(task.id)}
                                                                    title="Delete Task"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </div>
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
                                                                    <div
                                                                        className="cursor-pointer hover:underline flex flex-col"
                                                                        onClick={() => handleOpenTracker(emp)}
                                                                    >
                                                                        <span className="font-medium text-blue-700">{emp.employee?.name}</span>
                                                                        {emp.employee?.position?.name && (
                                                                            <span className="text-[10px] text-muted-foreground">
                                                                                {emp.employee.position.name}
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

                            {/* [PART REQUEST SYSTEM] */}
                            <PartRequestList
                                workOrderId={id!}
                                isAdmin={user?.role === 'admin' || user?.role === 'manager'}
                            />
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
                                        <IndianRupee className="h-3 w-3" /> {details.reduce((total, service) =>
                                            total + (service.tasks?.filter(t => t.completed).reduce((sum, task) => sum + (task.price || 0), 0) || 0), 0
                                        )}
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
                                    <div className={cn(
                                        "flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors",
                                        workOrder.status === 'Pending Approval' && "animate-blink-blue border-primary/20"
                                    )}>
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

                                    {workOrder.status === 'Pending Approval' && (
                                        <Button
                                            variant="destructive"
                                            className="w-full"
                                            onClick={() => {
                                                const allTaskIds = details.flatMap(s => s.tasks.map(t => t.id));
                                                setSelectedTasksForRejection(allTaskIds);
                                                setRejectionDialogOpen(true);
                                            }}
                                        >
                                            <XCircle className="h-4 w-4 mr-2" /> Reject for Corrections
                                        </Button>
                                    )}

                                    {(workOrder.status === 'Approved' || workOrder.status === 'Completed') && (
                                        <Button
                                            variant="outline"
                                            className="w-full border-orange-500 text-orange-600 hover:bg-orange-50"
                                            onClick={() => setReopenDialogOpen(true)}
                                        >
                                            <RefreshCw className="h-4 w-4 mr-2" /> Reopen Work Order
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
                        <div className="space-y-4">
                            <label className="text-sm font-medium">Select Employee</label>

                            {/* Employee Search */}
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Search by name or department..."
                                    value={empSearchTerm}
                                    onChange={(e) => setEmpSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>

                            {/* Employee Card List */}
                            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {employees
                                    .filter(emp =>
                                        emp.name.toLowerCase().includes(empSearchTerm.toLowerCase()) ||
                                        emp.position?.department?.toLowerCase().includes(empSearchTerm.toLowerCase())
                                    )
                                    .map((emp) => {
                                        const isSelected = selectedEmployeeId === emp.id;
                                        return (
                                            <div
                                                key={emp.id}
                                                onClick={() => setSelectedEmployeeId(emp.id)}
                                                className={cn(
                                                    "flex flex-col p-3 rounded-lg border transition-all cursor-pointer gap-1",
                                                    isSelected
                                                        ? "bg-primary/10 border-primary ring-1 ring-primary shadow-sm"
                                                        : "bg-card hover:bg-muted border-border"
                                                )}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold",
                                                            isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                                        )}>
                                                            {emp.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold">{emp.name}</p>
                                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                                                                {emp.position?.name} • {emp.position?.department || 'General'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {isSelected && (
                                                            <div className="flex items-center gap-1.5 mr-2 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Next Pos:</span>
                                                                <Input
                                                                    type="number"
                                                                    value={assignmentPosition}
                                                                    onChange={(e) => setAssignmentPosition(e.target.value)}
                                                                    className="w-12 h-7 text-xs text-center font-black border-primary/30 p-0 bg-background"
                                                                    min="1"
                                                                />
                                                            </div>
                                                        )}
                                                        {isSelected && (
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground scale-110 animate-in zoom-in duration-200">
                                                                    <CheckCircle2 className="h-3 w-3" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Inline Assessment Stats */}
                                                {isSelected && (
                                                    <div className="mt-2 pt-2 border-t border-primary/20 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Status:</span>
                                                                {loadingEmployeeData ? (
                                                                    <div className="h-4 w-12 bg-muted animate-pulse rounded" />
                                                                ) : (
                                                                    <Badge className={cn(
                                                                        "h-4 text-[9px] font-bold uppercase py-0",
                                                                        employeeAttendance?.status === 'present' ? "bg-green-500" : "bg-red-500"
                                                                    )}>
                                                                        {employeeAttendance?.status || 'Not Marked'}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-5 text-[8px] text-blue-600 hover:text-blue-700 p-0"
                                                                onClick={() => handleOpenTracker(emp)}
                                                            >
                                                                Full Stats
                                                            </Button>
                                                        </div>

                                                        <div className="bg-muted/30 rounded-md p-2 border border-border/50">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Active Workload ({employeeWorkload.length})</span>
                                                            </div>
                                                            <div className="space-y-1 max-h-[100px] overflow-y-auto pr-1">
                                                                {loadingEmployeeData ? (
                                                                    <div className="space-y-1">
                                                                        <div className="h-3 bg-muted animate-pulse rounded w-full" />
                                                                        <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
                                                                    </div>
                                                                ) : employeeWorkload.length === 0 ? (
                                                                    <p className="text-[9px] text-muted-foreground italic py-1">Available for immediate work.</p>
                                                                ) : (
                                                                    employeeWorkload.map((wl: any, idx: number) => (
                                                                        <div key={idx} className="flex justify-between text-[9px] font-semibold opacity-80">
                                                                            <span>{wl.vehicle_number} - {wl.service_type}</span>
                                                                            <span className="text-primary">{wl.progress_percentage}%</span>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="bg-muted px-6 py-4 border-t">
                        <Button variant="ghost" onClick={() => setEmployeeDialogOpen(false)} className="text-xs">Cancel</Button>
                        <Button
                            onClick={handleAddEmployee}
                            disabled={!selectedServiceId || !selectedEmployeeId || loadingEmployeeData}
                            className="bg-primary hover:bg-primary/90 text-white shadow-md font-bold text-xs px-6"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Confirm Assignment
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
            {/* Selective Rejection Dialog */}
            <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Reject Work / Request Changes</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold flex items-center justify-between">
                                Select Tasks to Reject
                                <Button
                                    variant="link"
                                    className="h-auto p-0 text-xs"
                                    onClick={() => {
                                        const allTaskIds = details.flatMap(s => s.tasks.map(t => t.id));
                                        setSelectedTasksForRejection(
                                            selectedTasksForRejection.length === allTaskIds.length ? [] : allTaskIds
                                        );
                                    }}
                                >
                                    {selectedTasksForRejection.length === details.flatMap(s => s.tasks.map(t => t.id)).length ? "Deselect All" : "Select All"}
                                </Button>
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {details.map(service => (
                                    <div key={service.id} className="space-y-2">
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground bg-muted/50 p-1 rounded">{service.service_type}</p>
                                        <div className="grid grid-cols-1 gap-1">
                                            {service.tasks.map(task => (
                                                <div key={task.id} className="flex items-center space-x-2 p-1 hover:bg-muted/30 rounded">
                                                    <Checkbox
                                                        id={`reject-${task.id}`}
                                                        checked={selectedTasksForRejection.includes(task.id)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setSelectedTasksForRejection([...selectedTasksForRejection, task.id]);
                                                            } else {
                                                                setSelectedTasksForRejection(selectedTasksForRejection.filter(id => id !== task.id));
                                                            }
                                                        }}
                                                    />
                                                    <label htmlFor={`reject-${task.id}`} className="text-xs cursor-pointer flex-1">{task.task_name}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-primary/80 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                Rejection Reason / Instructions for Staff
                            </label>
                            <Textarea
                                placeholder="Explain why these tasks are being rejected and what needs to be fixed..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                rows={4}
                                className="resize-none"
                            />
                        </div>
                    </div>
                    <DialogFooter className="border-t pt-4">
                        <Button variant="ghost" onClick={() => setRejectionDialogOpen(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={handleRejectTasks}
                            disabled={processingApproval || selectedTasksForRejection.length === 0 || !rejectionReason}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {processingApproval ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Processing Rejection...
                                </>
                            ) : "Confirm & Send to Staff"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reopen Work Order Dialog */}
            {/* Enhanced Reopen Configuration Form */}
            <Dialog open={showConfigForm} onOpenChange={setShowConfigForm}>
                <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto p-0">
                    <DialogHeader className="px-6 pt-6 pb-0">
                        <DialogTitle className="sr-only">Configure Work Order</DialogTitle>
                    </DialogHeader>
                    <div className="p-6 pt-0">
                        <WorkOrderForm
                            initialWorkOrderId={id}
                            isReopening={true}
                            reopenReason={reopenReason}
                            onSuccess={() => {
                                setShowConfigForm(false);
                                setReopenReason("");
                                fetchDetails();
                            }}
                            onCancel={() => setShowConfigForm(false)}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add Service Dialog */}
            <Dialog open={showAddServiceForm} onOpenChange={setShowAddServiceForm}>
                <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto p-0">
                    <DialogHeader className="px-6 pt-6 pb-0">
                        <DialogTitle className="sr-only">Add Service</DialogTitle>
                    </DialogHeader>
                    <div className="p-6 pt-0">
                        <WorkOrderForm
                            initialWorkOrderId={id}
                            isReopening={false}
                            onSuccess={() => {
                                setShowAddServiceForm(false);
                                fetchDetails();
                            }}
                            onCancel={() => setShowAddServiceForm(false)}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <RefreshCw className="h-5 w-5 text-orange-500" />
                            Reopen Work Order
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
                            <div className="text-xs text-orange-700 space-y-1">
                                <p className="font-bold">Action Confirmation Required:</p>
                                <p>Reopening will set the status back to <span className="font-bold">In Progress</span> and allow modifications to services and tasks. Personnel assigned to these tasks will see them back in their active queue.</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Reason for Reopening</label>
                            <Textarea
                                placeholder="Briefly explain why this work order is being reopened (e.g., Customer requested extra work, Mistake in billing, etc.)"
                                value={reopenReason}
                                onChange={(e) => setReopenReason(e.target.value)}
                                rows={4}
                                className="resize-none"
                            />
                        </div>
                    </div>
                    <DialogFooter className="bg-muted/50 p-4 -mx-6 -mb-6 border-t mt-4">
                        <Button variant="ghost" onClick={() => setReopenDialogOpen(false)}>Wait, Cancel</Button>
                        <Button
                            className="bg-orange-600 hover:bg-orange-700 text-white shadow-lg"
                            onClick={handleReopenWorkOrder}
                            disabled={processingApproval || !reopenReason}
                        >
                            {processingApproval ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Reopening Order...
                                </>
                            ) : "Confirm & Reopen Work Order"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Employee Tracker Side Modal */}
            {
                selectedTrackerEmployee && (
                    <EmployeeTracker
                        employee={selectedTrackerEmployee}
                        open={trackerOpen}
                        onOpenChange={setTrackerOpen}
                    />
                )
            }
        </div >
    );
}

