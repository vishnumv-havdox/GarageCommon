import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/adminClient";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
    CheckCircle2, XCircle, Clock, Trash2, Shield, User,
    Truck, AlertTriangle, AlertCircle, RefreshCw, ChevronRight, Plus, X, Edit, Play,
    Bell, ShieldCheck, FileText, Calendar as CalendarIcon,
    ListOrdered, Search, TrendingUp, Info, Loader2, RotateCcw,
    Wrench, ArrowLeft, ArrowRight, Users, ClipboardList, IndianRupee, Package, Camera,
    Receipt, Gauge, Phone, MessageSquare, Star, Eye, ExternalLink
} from "lucide-react";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableFooter } from "@/components/ui/table";
import { VehiclePlateBadge } from "@/components/shared/VehiclePlateBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { HavDoxLoader } from "@/components/brand/HavDoxLoader";
import { getBillingSettings } from "@/utils/billingSettings";
import { useRealtimeSync, broadcastDataUpdate } from "@/utils/realtimeSync";

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
    customer: { id: string; name: string; company_name?: string; phone?: string; email?: string; address?: string } | null;
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
    driver?: {
        id: string;
        name: string;
        contact_number?: string;
        driver_position?: string;
    } | null;
    advisor?: {
        name: string;
        phone?: string;
    } | Array<{
        name: string;
        phone?: string;
    }> | null;
    assigned_to?: string | null;
    odometer_reading?: number | null;
    next_service_due_km?: number | null;
    next_service_due_date?: string | null;
    contact_id?: string | null;
    contact?: {
        id: string;
        name: string;
        designation?: string;
        phone: string;
        alternate_phone?: string;
        email?: string;
        is_primary?: boolean;
    } | null;
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
    const billingSettings = useMemo(() => getBillingSettings(), []);

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

    // Add Task States
    const [addingTaskToServiceId, setAddingTaskToServiceId] = useState<string | null>(null);
    const [newTaskName, setNewTaskName] = useState("");
    const [newTaskPrice, setNewTaskPrice] = useState("");
    const [isAddingTask, setIsAddingTask] = useState(false);

    // Extension: Assignment stats and workload
    const [assignmentPosition, setAssignmentPosition] = useState("0");
    const [employeeWorkload, setEmployeeWorkload] = useState<any[]>([]);
    const [slipDialogOpen, setSlipDialogOpen] = useState(false);

    // Rejection & Reopen states
    const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
    const [selectedTasksForRejection, setSelectedTasksForRejection] = useState<string[]>([]);
    const [rejectionReason, setRejectionReason] = useState("");
    const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
    const [reopenReason, setReopenReason] = useState("");
    const [advisorDialogOpen, setAdvisorDialogOpen] = useState(false);
    const [isUpdatingAdvisor, setIsUpdatingAdvisor] = useState(false);

    const [predefinedTasks, setPredefinedTasks] = useState<any[]>([]);

    // New Extension States
    const [belongings, setBelongings] = useState<any[]>([]);
    const [photos, setPhotos] = useState<any[]>([]);

    // Next Service Targets Dialog States
    const [showServiceTargetDialog, setShowServiceTargetDialog] = useState(false);
    const [targetOdometer, setTargetOdometer] = useState<number>(0);
    const [targetNextKm, setTargetNextKm] = useState<number>(0);
    const [targetNextDate, setTargetNextDate] = useState<string>("");
    const [savingTargets, setSavingTargets] = useState(false);

    const handleOpenServiceTargetDialog = () => {
        setTargetOdometer(workOrder?.odometer_reading || 0);
        setTargetNextKm(workOrder?.next_service_due_km || 0);
        setTargetNextDate(workOrder?.next_service_due_date || "");
        setShowServiceTargetDialog(true);
    };

    const handleSaveServiceTargets = async () => {
        if (!id) return;
        setSavingTargets(true);
        try {
            const { error } = await supabase
                .from("work_orders")
                .update({
                    odometer_reading: targetOdometer || null,
                    next_service_due_km: targetNextKm || null,
                    next_service_due_date: targetNextDate || null
                } as any)
                .eq("id", id);

            if (error) throw error;

            if (workOrder?.vehicle_id) {
                await supabase
                    .from("vehicles")
                    .update({
                        kilometers_driven: targetOdometer || undefined,
                        next_service_km: targetNextKm || undefined,
                        next_service_date: targetNextDate || undefined
                    } as any)
                    .eq("id", workOrder.vehicle_id);
            }

            toast({ title: "Service Targets Updated", description: "Odometer & next service schedule saved." });
            setShowServiceTargetDialog(false);
            fetchDetails();
        } catch (err: any) {
            toast({ variant: "destructive", title: "Error", description: err.message });
        } finally {
            setSavingTargets(false);
        }
    };
    const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
    const [confirmedItems, setConfirmedItems] = useState<Record<string, boolean>>({});
    const [isConfirmingBelongings, setIsConfirmingBelongings] = useState(false);
    const [billingInfo, setBillingInfo] = useState({
        totalInvoiced: 0,
        totalPaid: 0,
        totalDeductions: 0,
        balance: 0,
        status: 'Unpaid' as 'Paid' | 'Partial' | 'Unpaid' | 'N/A'
    });
    const [activeTab, setActiveTab] = useState<"overview" | "workflow" | "parts" | "billing">("overview");
    const [previewImage, setPreviewImage] = useState<{ url: string; title: string; criteria?: string } | null>(null);

    // Unified tasks list across all services
    const allUnifiedTasks = useMemo(() => {
        return details.flatMap(s => (s.tasks || []).map(t => ({
            ...t,
            serviceId: s.id,
            serviceType: s.service_type,
            serviceStatus: s.status,
            serviceEmployees: s.employees || []
        })));
    }, [details]);

    const totalTasksCount = allUnifiedTasks.length;
    const completedTasksCount = allUnifiedTasks.filter(t => t.completed).length;
    const taskCompletionPct = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
    const totalTasksAmount = allUnifiedTasks.reduce((sum, t) => sum + (t.price || 0), 0);
    const arrivalPhotos = useMemo(() => photos.filter(p => p.photo_type === 'arrival'), [photos]);
    const issuePhotos = useMemo(() => photos.filter(p => p.photo_type !== 'arrival'), [photos]);

    useEffect(() => {
        const fetchPredefinedTasks = async () => {
            if (!addingTaskToServiceId) {
                setPredefinedTasks([]);
                return;
            }

            // Find service type id
            const service = details.find(s => s.id === addingTaskToServiceId);
            if (!service) return;

            // Resolve Service Type ID
            let typeId = null;
            // @ts-ignore
            if (service.service_type_id?.id) {
                // @ts-ignore
                typeId = service.service_type_id.id;
            } else {
                const { data: stData } = await supabase
                    .from('service_types')
                    .select('id')
                    .eq('name', service.service_type)
                    .single();
                typeId = stData?.id;
            }

            if (!typeId) return;

            // 1. Fetch Task Templates
            const { data: tasksData } = await supabase
                .from('task_templates')
                .select('*')
                .eq('service_type_id', typeId);

            if (!tasksData) return;

            // 2. Resolve Vehicle IDs for Pricing
            let vehicleTypeId = null;
            let vehicleCategoryId = null;

            // Try to resolve from loaded data if possible, or fetch
            // @ts-ignore
            const modelId = workOrder?.vehicle?.model_id;

            if (modelId) {
                const { data: vModelData } = await supabase
                    .from('vehicle_models')
                    .select(`
                        vehicle_type_id,
                        vehicle_types (
                            id,
                            category_id
                        )
                    `)
                    .eq('id', modelId)
                    .single();

                if (vModelData) {
                    vehicleTypeId = vModelData.vehicle_type_id;
                    // @ts-ignore
                    vehicleCategoryId = vModelData.vehicle_types?.category_id;
                }
            }

            // 3. Apply Pricing Rules
            let tasksWithPricing = tasksData.map(t => ({ ...t, effective_price: t.price }));

            if (vehicleCategoryId || vehicleTypeId) {
                const taskIds = tasksData.map(t => t.id);

                let query = supabase
                    .from('pricing_rules')
                    .select('*')
                    .in('task_template_id', taskIds);

                // Build OR query for applicability: (category match OR type match)
                // Note: deeply filtering ORs in Supabase JS can be tricky with .or(), doing client side filter might be safer for small datasets, 
                // but let's try direct query if simpler. 
                // Creating a simplified fetch:
                const { data: rulesData } = await query;

                if (rulesData && rulesData.length > 0) {
                    tasksWithPricing = tasksData.map(t => {
                        // Find most specific rule: Type > Category
                        const typeRule = rulesData.find(r => r.task_template_id === t.id && r.vehicle_type_id === vehicleTypeId);
                        const catRule = rulesData.find(r => r.task_template_id === t.id && r.vehicle_category_id === vehicleCategoryId);

                        const rule = typeRule || catRule;

                        if (rule) {
                            let finalPrice = t.price;
                            if (rule.modifier_type === 'fixed' || rule.modifier_type === 'override') {
                                finalPrice = rule.modifier_value;
                            } else if (rule.modifier_type === 'percentage') {
                                finalPrice = t.price * (1 + (rule.modifier_value / 100));
                            }
                            return {
                                ...t,
                                effective_price: finalPrice,
                                rule_applied: true
                            };
                        }
                        return { ...t, effective_price: t.price, rule_applied: false };
                    });
                }
            }

            setPredefinedTasks(tasksWithPricing);
        };

        fetchPredefinedTasks();
    }, [addingTaskToServiceId, details, workOrder]);

    const handlePredefinedTaskSelect = (taskId: string) => {
        const task = predefinedTasks.find(t => t.id === taskId);
        if (task) {
            setNewTaskName(task.name);
            setNewTaskPrice(task.effective_price?.toString() || "0"); // Use effective price
        }
    };

    const [searchParams, setSearchParams] = useSearchParams();
    const showConfigForm = searchParams.get('action') === 'configure';
    const showAddServiceForm = searchParams.get('action') === 'add-service';
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

    const fetchExtensions = useCallback(async () => {
        if (!id) return;
        try {
            const [pRes, bRes] = await Promise.all([
                supabase.from('work_order_photos').select('*').eq('work_order_id', id),
                supabase.from('work_order_belongings').select('*').eq('work_order_id', id)
            ]);
            if (pRes.data) setPhotos(pRes.data);
            if (bRes.data) {
                setBelongings(bRes.data);
                const initialConfirmed = {};
                bRes.data.forEach(item => {
                    if (item.confirmed_at) initialConfirmed[item.id] = true;
                });
                setConfirmedItems(initialConfirmed);
            }
        } catch (error) {
            console.error("Error fetching extensions:", error);
        }
    }, [id]);

    const fetchDetails = useCallback(async (isSilent = false) => {
        if (!id) return;
        if (!isSilent && !workOrder) setLoading(true);
        try {
            // Fetch Work Order
            const { data: woData, error: woError } = await supabase
                .from("work_orders")
                .select(`
          *,
          vehicle:vehicles(
            vehicle_number, 
            model, 
            vehicle_type, 
            customer_id, 
            model_id,
            customers(id, name, company_name, phone, email, address)
          ),
          driver:drivers(
            id,
            name,
            contact_number,
            driver_position
          ),
          advisor:employees!assigned_to(id, name, phone),
          contact:customer_contacts(
            id,
            name,
            designation,
            phone,
            alternate_phone,
            email,
            is_primary
          )
        `)
                .eq("id", id)
                .single();

            if (woError) throw woError;

            const woDataRaw = woData as any;
            if (!woDataRaw) throw new Error("Work order not found");

            const vehicle = woDataRaw.vehicle;
            const customer = vehicle?.customers;
            const woWithCustomer = {
                ...woDataRaw,
                customer: customer || { id: "", name: "Unknown", company_name: "", phone: "", email: "", address: "" }
            };

            // Fetch Services, Tasks, and Employees
            const { data: servicesData, error: sError } = await supabase
                .from("work_order_services")
                .select(`
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
            // No direct setDetails here, will be set in the final combined setWorkOrder call or separately if needed
            // But we keep setDetails for the formatted services later.
            const rawServices = (servicesData as any) || [];

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
                    id, name, email, phone,
                    position:positions(id, name, department)
                `)
                .eq("status", "active");

            if (empError) throw empError;
            const availableEmployees = (empData as any) || [];
            setEmployees(availableEmployees);

            // 5. Fetch Billing Info
            let billingInfo: any = { totalInvoiced: 0, totalPaid: 0, totalDeductions: 0, balance: 0, status: 'N/A' };
            const { data: invoices, error: invError } = await supabase
                .from('invoices')
                .select(`
                    id, 
                    total, 
                    total_deductions,
                    payment_links(amount_applied, payment:payments(*))
                `)
                .eq('work_order_id', id);

            if (!invError && invoices) {
                let totalInvoiced = 0;
                let totalPaid = 0;
                let totalDeductions = 0;

                (invoices as any[]).forEach((inv: any) => {
                    totalInvoiced += inv.total || 0;
                    totalDeductions += inv.total_deductions || 0;
                    inv.payment_links?.forEach((link: any) => {
                        if (link.payment?.status === 'approved') {
                            totalPaid += link.amount_applied || link.payment.amount;
                        }
                    });
                });

                const balance = totalInvoiced - totalPaid - totalDeductions;
                let status: any = 'Unpaid';
                if (totalPaid + totalDeductions >= totalInvoiced && totalInvoiced > 0) status = 'Paid';
                else if (totalPaid > 0 || totalDeductions > 0) status = 'Partial';
                else if (totalInvoiced === 0) status = 'N/A';

                billingInfo = { totalInvoiced, totalPaid, totalDeductions, balance, status };
                setBillingInfo(billingInfo);
            }

            // FINAL STATE UPDATE - Restore setWorkOrder
            setWorkOrder({
                ...woWithCustomer,
                stages: (stagesData as any) || [],
                tasks: (tasksData as any) || [],
                billingInfo: billingInfo
            } as any);

            setDetails(formattedServices);
            fetchExtensions();
        } catch (error: any) {
            console.error("Fetch error:", error);
            toast({ variant: "destructive", title: "Error", description: error.message });
            // Removed automatic navigate to allow seeing the error message
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [id, navigate, toast, workOrder]);

    useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);

    // Realtime synchronization on work_orders, part_requests, and inventory
    useRealtimeSync(["work_orders", "part_requests", "inventory"], () => {
        fetchDetails(true);
        fetchExtensions();
    });

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
                p_work_order_id: id,
                p_approver_id: user?.id,
                p_notes: approvalNotes
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
        setSearchParams({ action: 'configure' });
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

    // Handle Advance Stage (Bidirectionally synced with Workflow Actions, Status, and Services)
    const handleAdvanceStage = async (nextStage: string) => {
        if (!id || !workOrder) return;
        const newOverallStatus = nextStage === 'Inspection' ? 'Pending Approval' : (nextStage === 'Delivery' && workOrder.status === 'Completed' ? 'Completed' : 'In Progress');

        setWorkOrder(prev => prev ? {
            ...prev,
            current_stage: nextStage,
            status: newOverallStatus
        } : null);

        // Optimistically update service section statuses inside details
        setDetails(prev => prev.map(s => ({
            ...s,
            status: nextStage === 'Repair' ? 'In Progress' : (['Review', 'Quality Check', 'Delivery'].includes(nextStage) ? 'Completed' : s.status)
        })));

        try {
            const stageUpdates: any = {
                current_stage: nextStage,
                status: newOverallStatus
            };
            if (['Repair', 'Review', 'Quality Check', 'Delivery'].includes(nextStage)) {
                stageUpdates.inspection_status = 'approved';
            }
            if (['Review', 'Quality Check', 'Delivery'].includes(nextStage)) {
                stageUpdates.repair_status = 'approved';
            }
            if (['Quality Check', 'Delivery'].includes(nextStage)) {
                stageUpdates.review_status = 'approved';
            }
            if (nextStage === 'Delivery') {
                stageUpdates.quality_check_status = 'completed';
            }

            await supabase.from("work_orders").update(stageUpdates).eq("id", id);

            // Synchronize service status inside work_order_services table
            if (nextStage === 'Repair') {
                await supabase.from("work_order_services").update({
                    status: 'In Progress',
                    approved_at: new Date().toISOString()
                }).eq("work_order_id", id);
            } else if (['Review', 'Quality Check', 'Delivery'].includes(nextStage)) {
                await supabase.from("work_order_services").update({
                    status: 'Completed'
                }).eq("work_order_id", id);
            }

            try {
                // @ts-ignore
                await supabase.rpc('advance_work_order_stage', {
                    _work_order_id: id,
                    _stage: nextStage,
                    _employee_id: null
                });
            } catch (rpcErr) {
                console.warn("advance_work_order_stage note:", rpcErr);
            }

            const stageIdx = STAGES.indexOf(nextStage);
            for (let i = 0; i <= stageIdx; i++) {
                const sName = STAGES[i];
                const isCurrent = sName === nextStage;
                await supabase.from("work_order_stages").upsert({
                    work_order_id: id,
                    stage: sName,
                    status: isCurrent ? 'in_progress' : 'completed',
                    completed_at: isCurrent ? null : new Date().toISOString(),
                    started_at: new Date().toISOString()
                }, { onConflict: 'work_order_id,stage' });
            }

            toast({ title: "Stage Advanced", description: `Moved to ${nextStage}` });
            fetchDetails(true);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
            fetchDetails(true);
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

    const handleUpdateAdvisor = async (newAdvisorId: string) => {
        if (!id) return;
        setIsUpdatingAdvisor(true);
        try {
            const { error } = await supabase
                .from("work_orders")
                .update({ assigned_to: newAdvisorId })
                .eq("id", id);

            if (error) throw error;

            toast({
                title: "Advisor Updated",
                description: "The service advisor for this work order has been updated."
            });
            setAdvisorDialogOpen(false);
            fetchDetails();
        } catch (error: any) {
            toast({
                title: "Error updating advisor",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsUpdatingAdvisor(false);
        }
    };

    // Handle Mark Delivered
    const handleMarkDelivered = async () => {
        if (!id) return;

        // Mandatory Confirmation Alert for Belongings
        const unconfirmedBelonging = belongings.some(b => !confirmedItems[b.id]);
        if (belongings.length > 0 && unconfirmedBelonging) {
            setConfirmationDialogOpen(true);
            return;
        }

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

    // Handle Add New Task
    const handleAddTask = async () => {
        if (!addingTaskToServiceId || !newTaskName.trim()) return;
        setIsAddingTask(true);
        try {
            const price = parseFloat(newTaskPrice) || 0;
            const { error } = await supabase.from("work_order_tasks").insert({
                work_order_id: id,
                service_id: addingTaskToServiceId,
                task_name: newTaskName,
                price: price,
                task_type: 'repair',
                completed: false
            });

            if (error) throw error;

            toast({ title: "Task Added", description: "New task added successfully" });
            setAddingTaskToServiceId(null);
            setNewTaskName("");
            setNewTaskPrice("");
            fetchDetails();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setIsAddingTask(false);
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

    // Handle Complete Task (Unified - 0ms instantaneous optimistic toggle)
    const handleToggleTask = async (taskId: string, completed: boolean) => {
        if (!id) return;
        let targetServiceId = "";
        const updatedDetails = details.map(service => {
            const hasTask = (service.tasks || []).some(t => t.id === taskId);
            if (!hasTask) return service;
            targetServiceId = service.id;
            const updatedTasks = (service.tasks || []).map(task =>
                task.id === taskId ? { ...task, completed } : task
            );
            const allServiceTasksDone = updatedTasks.length > 0 && updatedTasks.every(t => t.completed);
            return {
                ...service,
                status: allServiceTasksDone ? 'Completed' : 'In Progress',
                tasks: updatedTasks
            };
        });

        const allTasks = updatedDetails.flatMap(s => s.tasks || []);
        const allTasksCompleted = allTasks.length > 0 && allTasks.every(t => t.completed);

        setDetails(updatedDetails);
        setWorkOrder(prev => {
            if (!prev) return null;
            return {
                ...prev,
                repair_status: allTasksCompleted ? 'completed' : (prev.repair_status === 'completed' ? 'in_progress' : prev.repair_status),
                tasks: (prev.tasks || []).map(task =>
                    task.id === taskId ? { ...task, completed } : task
                )
            };
        });

        try {
            // @ts-ignore
            const { error } = await supabase.rpc('update_work_order_task_status', {
                p_task_id: taskId,
                p_work_order_id: id,
                p_completed: completed,
                p_employee_id: user?.id
            });

            if (error) {
                await supabase.from("work_order_tasks").update({ completed } as any).eq("id", taskId);
            }

            // Sync service status inside work_order_services table
            if (targetServiceId) {
                const targetService = updatedDetails.find(s => s.id === targetServiceId);
                if (targetService) {
                    const isServiceDone = (targetService.tasks || []).every(t => t.completed);
                    await supabase.from("work_order_services").update({
                        status: isServiceDone ? 'Completed' : 'In Progress'
                    }).eq("id", targetServiceId);
                }
            }

            // Sync overall repair_status in work_orders
            if (allTasksCompleted) {
                await supabase.from("work_orders").update({
                    repair_status: 'completed'
                }).eq("id", id);
            } else if (!completed && workOrder?.repair_status === 'completed') {
                await supabase.from("work_orders").update({
                    repair_status: 'in_progress'
                }).eq("id", id);
            }

            toast({ title: completed ? "Task Completed" : "Task Reopened", description: "Task status and service progress updated" });
            fetchDetails(true);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
            fetchDetails(true);
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
            fetchDetails(true);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
            fetchDetails(true);
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
            fetchDetails(true);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
            fetchDetails(true);
        }
    };

    // Handle Toggle Customer Visibility
    const handleToggleVisibility = async (visible: boolean) => {
        if (!id || !workOrder) return;
        setWorkOrder(prev => prev ? { ...prev, customer_visible: visible } : null);
        try {
            const { error } = await supabase
                .from("work_orders")
                .update({ customer_visible: visible } as any)
                .eq("id", id);

            if (error) throw error;
            toast({ title: visible ? "Visible to Customer" : "Hidden from Customer", description: "Visibility setting updated" });
            fetchDetails(true);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
            fetchDetails(true);
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

    if (loading) return <HavDoxLoader variant="fullscreen" message="Loading work order details & job card..." />;
    if (!workOrder) return <div className="flex items-center justify-center min-h-screen">Work order not found.</div>;

    const canApprove = workOrder.status === "Pending Approval";
    const canAccept = workOrder.status === "Pending";
    const currentStageIndex = STAGES.indexOf(workOrder.current_stage || 'Inspection');
    const nextStage = currentStageIndex < STAGES.length - 1 ? STAGES[currentStageIndex + 1] : null;

    return (
        <div className="min-h-screen bg-background">
            {/* Sticky Navigation Header */}
            <div className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur-md shadow-sm">
                <div className="container mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl h-9 w-9">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex-1">
                            <h1 className="text-lg md:text-xl font-bold flex flex-wrap items-center gap-2">
                                Work Order #{workOrder.id.slice(0, 8)}
                                {getStatusBadge(workOrder.status)}
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold gap-1 text-xs">
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    Stage: {workOrder.current_stage || 'Inspection'}
                                </Badge>
                                {billingInfo.status !== 'N/A' && (
                                    <Badge variant={billingInfo.status === 'Paid' ? 'default' : billingInfo.status === 'Partial' ? 'secondary' : 'destructive'} className={billingInfo.status === 'Paid' ? 'bg-green-600' : ''}>
                                        {billingInfo.status} Payment
                                    </Badge>
                                )}
                                {workOrder.is_reopened && (
                                    <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-50 animate-pulse text-[10px]">
                                        <RefreshCw className="h-3 w-3 mr-1" /> Reopened
                                    </Badge>
                                )}
                            </h1>
                            <div className="flex items-center gap-3 mt-0.5">
                                <p className="text-xs text-muted-foreground font-medium">
                                    {workOrder.vehicle?.vehicle_number} • {workOrder.vehicle?.model}
                                </p>
                                <Separator orientation="vertical" className="h-3" />
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20">
                                    <User className="h-3 w-3 text-primary" />
                                    <span className="text-[10px] font-bold text-primary">
                                        Advisor: {(() => {
                                            const intakeData = (workOrder as any).advisor || (workOrder as any).assigned_employee || (workOrder as any).intake_person;
                                            const intake = Array.isArray(intakeData) ? intakeData[0] : intakeData;
                                            return intake?.name || (workOrder.assigned_to ? `ID: ${workOrder.assigned_to.slice(0, 8)}` : 'N/A');
                                        })()}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-3.5 w-3.5 ml-0.5 hover:bg-primary/20 hover:text-primary rounded-full"
                                        onClick={() => setAdvisorDialogOpen(true)}
                                    >
                                        <Edit className="h-2 w-2" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end items-center">
                        {nextStage && (
                            <Button
                                size="sm"
                                className="h-8 text-xs font-semibold gap-1 bg-primary text-primary-foreground"
                                onClick={() => handleAdvanceStage(nextStage)}
                            >
                                Advance to {nextStage} &rarr;
                            </Button>
                        )}

                        <Button
                            size="sm"
                            className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                            onClick={() => navigate(`/admin/invoices?workOrderId=${workOrder.id}`)}
                            title="Generate or view formal invoice"
                        >
                            <Receipt className="h-3.5 w-3.5" />
                            {billingInfo.totalInvoiced > 0 ? 'View Invoice' : 'Generate Bill'}
                        </Button>

                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setSlipDialogOpen(true)} title="Slip Print">
                            <FileText className="h-3.5 w-3.5" /> Slip
                        </Button>

                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => generateInvoicePDF(workOrder.id)} title="Download Tax Invoice">
                            <IndianRupee className="h-3.5 w-3.5" /> PDF
                        </Button>

                        <div className="flex flex-col items-end justify-center px-3 border-l ml-1">
                            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Balance</span>
                            <span className={`text-base font-black font-mono leading-none ${billingInfo.balance > 0 ? 'text-destructive' : 'text-green-600'}`}>
                                ₹{billingInfo.balance.toLocaleString()}
                            </span>
                        </div>

                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8" 
                            onClick={async () => {
                                setLoading(true);
                                try {
                                    await Promise.all([
                                        fetchDetails(),
                                        fetchExtensions()
                                    ]);
                                    toast({ title: "Refreshed", description: "Work order details synchronized." });
                                    broadcastDataUpdate("work_orders");
                                } finally {
                                    setLoading(false);
                                }
                            }} 
                            disabled={loading}
                            title="Refresh Details"
                        >
                            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                        </Button>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                                    <Trash2 className="h-3.5 w-3.5" />
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
                        status={workOrder.status}
                        stagesData={workOrder.stages}
                        canAdvance={true}
                        isAdmin={true}
                        onAdvanceStage={handleAdvanceStage}
                    />
                </div>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
                    <TabsList className="bg-muted/70 p-1 rounded-xl h-auto flex flex-nowrap overflow-x-auto no-scrollbar gap-1 max-w-full w-full justify-start sm:justify-center">
                        <TabsTrigger value="overview" className="rounded-lg text-xs font-semibold px-4 py-2 gap-2 shrink-0 whitespace-nowrap">
                            <ClipboardList className="h-4 w-4" />
                            Job Card & Tasks
                            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                                {totalTasksCount}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="workflow" className="rounded-lg text-xs font-semibold px-4 py-2 gap-2 shrink-0 whitespace-nowrap">
                            <ShieldCheck className="h-4 w-4" />
                            Workflow Actions
                            <Badge variant="outline" className={cn(
                                "ml-1 text-[10px] px-1.5 py-0 h-4 font-mono",
                                workOrder.status === 'Completed' ? "bg-green-100 text-green-700 border-green-300" : "bg-primary/10 text-primary border-primary/20"
                            )}>
                                {workOrder.current_stage || workOrder.status}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="parts" className="rounded-lg text-xs font-semibold px-4 py-2 gap-2 shrink-0 whitespace-nowrap">
                            <Package className="h-4 w-4" />
                            Parts & Materials
                        </TabsTrigger>
                        <TabsTrigger value="billing" className="rounded-lg text-xs font-semibold px-4 py-2 gap-2 shrink-0 whitespace-nowrap">
                            <Receipt className="h-4 w-4" />
                            Billing & Notes
                            {billingInfo.balance > 0 && (
                                <span className="h-2 w-2 rounded-full bg-rose-500 ml-1" />
                            )}
                        </TabsTrigger>
                    </TabsList>

                    {/* Tab 1: Job Card & Tasks (Overview) */}
                    <TabsContent value="overview" className="space-y-6">
                        {/* LIVE WORKFLOW STATUS & STAGE RIBBON */}
                        <div className="rounded-xl border bg-gradient-to-r from-card via-muted/20 to-card p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5">
                                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                    <ShieldCheck className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Stage:</span>
                                        <Badge variant="outline" className="font-bold text-xs bg-primary/10 text-primary border-primary/30 px-2 py-0.5">
                                            {workOrder.current_stage || 'Inspection'}
                                        </Badge>
                                        <span className="text-muted-foreground text-xs">•</span>
                                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Workflow Status:</span>
                                        <Badge variant="outline" className={cn(
                                            "font-bold text-xs px-2 py-0.5",
                                            workOrder.status === 'Completed' ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-950/40 dark:text-green-400" :
                                            workOrder.status === 'In Progress' ? "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-400" :
                                            workOrder.status === 'Cancelled' ? "bg-red-100 text-red-700 border-red-300" :
                                            "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400"
                                        )}>
                                            {workOrder.status}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {workOrder.current_stage === 'Inspection' && "Vehicle intake inspection active. Approve inspection in Workflow Actions to advance to Repair."}
                                        {workOrder.current_stage === 'Repair' && "Active repair in progress. Check off tasks below in real time or approve stages in Workflow Actions."}
                                        {workOrder.current_stage === 'Review' && "Repair work finished. Job card is under internal review and cost verification."}
                                        {workOrder.current_stage === 'Quality Check' && "Final quality control inspection active before customer delivery."}
                                        {workOrder.current_stage === 'Delivery' && "Vehicle is approved and ready for customer handover and invoice settlement."}
                                        {(!workOrder.current_stage || !['Inspection', 'Repair', 'Review', 'Quality Check', 'Delivery'].includes(workOrder.current_stage)) && "Workflow status is linked to job card tasks and stage approvals."}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                                    <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                    <span>Workflow Linked</span>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs font-semibold gap-1.5 h-8 border-primary/20 hover:bg-primary/10 text-primary"
                                    onClick={() => setActiveTab('workflow')}
                                >
                                    <span>Workflow Actions</span>
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>

                        {/* 1. WORK ORDER TASKS TABLE - TOP PRIORITY */}
                        <Card className="border-2 border-primary/20 shadow-sm overflow-hidden">
                            <CardHeader className="bg-muted/30 pb-4 border-b">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <Wrench className="h-5 w-5 text-primary" />
                                            <CardTitle className="text-lg font-bold">Work Order Tasks & Operations</CardTitle>
                                            <Badge variant="outline" className="font-mono text-xs bg-card">
                                                {completedTasksCount} / {totalTasksCount} Done
                                            </Badge>
                                        </div>
                                        <CardDescription className="text-xs mt-1">
                                            Click any checkbox to immediately update task completion without refreshing the page.
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="hidden sm:flex flex-col items-end mr-2">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Progress</span>
                                            <span className="text-sm font-black font-mono text-primary">{taskCompletionPct}%</span>
                                        </div>
                                        <div className="w-24 hidden sm:block">
                                            <Progress value={taskCompletionPct} className="h-2" />
                                        </div>
                                        {details.length > 0 && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 text-xs bg-primary/5 hover:bg-primary/10 border-primary/30 text-primary font-semibold gap-1"
                                                onClick={() => setAddingTaskToServiceId(details[0].id)}
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                                Add Task
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {allUnifiedTasks.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/20 hover:bg-muted/20">
                                                    <TableHead className="w-14 text-center">Status</TableHead>
                                                    <TableHead>Task Name & Operation</TableHead>
                                                    <TableHead>Service Group</TableHead>
                                                    <TableHead>Assigned Mechanics</TableHead>
                                                    <TableHead className="text-right">Price</TableHead>
                                                    <TableHead className="w-16 text-center">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {allUnifiedTasks.map((task) => (
                                                    <TableRow
                                                        key={task.id}
                                                        className={cn(
                                                            "transition-colors hover:bg-muted/30",
                                                            task.completed && "bg-muted/10 text-muted-foreground"
                                                        )}
                                                    >
                                                        <TableCell className="text-center py-3">
                                                            <Checkbox
                                                                id={`table-task-${task.id}`}
                                                                checked={task.completed}
                                                                onCheckedChange={(checked) => handleToggleTask(task.id, checked === true)}
                                                                className="h-5 w-5 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="py-3">
                                                            <div className="flex flex-col">
                                                                <label
                                                                    htmlFor={`table-task-${task.id}`}
                                                                    className={cn(
                                                                        "font-semibold text-sm cursor-pointer select-none text-foreground",
                                                                        task.completed && "line-through text-muted-foreground font-normal"
                                                                    )}
                                                                >
                                                                    {task.task_name}
                                                                </label>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    {task.task_type && (
                                                                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 uppercase tracking-wider font-semibold">
                                                                            {task.task_type}
                                                                        </Badge>
                                                                    )}
                                                                    {task.is_predefined && (
                                                                        <span className="text-[10px] text-muted-foreground italic">Standard</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-3">
                                                            <Badge variant="outline" className="text-xs bg-muted/40 font-medium border-border/80">
                                                                {task.serviceType}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="py-3">
                                                            {task.serviceEmployees && task.serviceEmployees.length > 0 ? (
                                                                <div className="flex flex-wrap items-center gap-1.5">
                                                                    {task.serviceEmployees.map((emp) => (
                                                                        <div
                                                                            key={emp.id}
                                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-[11px] font-medium text-blue-700 dark:text-blue-300"
                                                                        >
                                                                            <User className="h-3 w-3 text-blue-500" />
                                                                            <span>{emp.employee?.name || 'Staff'}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground italic">Unassigned</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right py-3 font-mono font-semibold text-sm">
                                                            ₹{(task.price || 0).toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className="text-center py-3">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => handleDeleteTask(task.id)}
                                                                title="Delete Task"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                            <TableFooter className="bg-muted/40 font-medium">
                                                <TableRow>
                                                    <TableCell colSpan={4} className="py-3">
                                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                            <span>Total {totalTasksCount} tasks recorded ({completedTasksCount} completed)</span>
                                                            <span className="font-semibold text-foreground uppercase tracking-wider text-[11px]">Tasks Subtotal:</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right py-3 font-mono font-bold text-base text-primary">
                                                        ₹{totalTasksAmount.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell></TableCell>
                                                </TableRow>
                                            </TableFooter>
                                        </Table>
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-muted-foreground">
                                        <Wrench className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm font-semibold">No tasks added to this work order yet.</p>
                                        <p className="text-xs text-muted-foreground mt-1">Add tasks under the service sections below to get started.</p>
                                        {details.length > 0 && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="mt-3 text-xs"
                                                onClick={() => setAddingTaskToServiceId(details[0].id)}
                                            >
                                                <Plus className="h-3.5 w-3.5 mr-1" /> Add First Task
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* 2. GENERAL INFORMATION - BELOW TASKS */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-6">
                                <Card className="shadow-sm">
                                    <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
                                        <CardTitle className="text-base font-bold flex items-center gap-2">
                                            <ClipboardList className="h-5 w-5 text-primary" />
                                            General Information & Vehicle
                                        </CardTitle>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-xs"
                                                onClick={() => setCustomerDialogOpen(true)}
                                            >
                                                <Edit className="h-3.5 w-3.5 mr-1" /> Edit Customer
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-xs"
                                                onClick={() => {
                                                    setCustomerNotes(workOrder.notes || "");
                                                    setNotesDialogOpen(true);
                                                }}
                                            >
                                                <Edit className="h-3.5 w-3.5 mr-1" /> Edit Notes
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-4 space-y-4">
                                        {/* Description / Customer Complaints */}
                                        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                            <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                                <AlertCircle className="h-3.5 w-3.5" />
                                                Customer Complaints & Work Description
                                            </h4>
                                            <p className="text-sm font-medium text-foreground whitespace-pre-wrap leading-relaxed">
                                                {workOrder.description || "No specific complaints recorded."}
                                            </p>
                                        </div>

                                        {/* Internal / Intake Notes */}
                                        {workOrder.notes && (
                                            <div className="bg-muted/40 p-3.5 rounded-xl border space-y-2">
                                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Intake Notes & Configuration</h4>
                                                <div className="text-sm font-sans">
                                                    {(() => {
                                                        try {
                                                            const parsed = JSON.parse(workOrder.notes);
                                                            if (typeof parsed === 'object' && parsed !== null) {
                                                                return (
                                                                    <div className="space-y-2">
                                                                        {parsed.service_types && Array.isArray(parsed.service_types) && (
                                                                            <div className="flex flex-wrap gap-1.5">
                                                                                {parsed.service_types.map((type: string, i: number) => (
                                                                                    <Badge key={i} variant="secondary" className="text-xs bg-background/80 border">{type}</Badge>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                                                                            {Object.entries(parsed).map(([key, value]) => {
                                                                                if (key === 'service_types') return null;
                                                                                return (
                                                                                    <div key={key} className="flex gap-2 p-1.5 bg-background/60 rounded border">
                                                                                        <span className="font-semibold capitalize text-muted-foreground">
                                                                                            {key.replace(/_/g, ' ')}:
                                                                                        </span>
                                                                                        <span className="font-medium text-foreground">{String(value)}</span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                            return <pre className="whitespace-pre-wrap font-sans text-xs">{workOrder.notes}</pre>;
                                                        } catch (e) {
                                                            return <pre className="whitespace-pre-wrap font-sans text-xs">{workOrder.notes}</pre>;
                                                        }
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Right Column: Customer & Vehicle Snapshot */}
                            <div className="space-y-6">
                                <Card className="shadow-sm">
                                    <CardHeader className="pb-3 border-b">
                                        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                                            Vehicle & Customer Snapshot
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4 pt-4">
                                        {/* Vehicle Badge & Model */}
                                        <div className="flex items-center justify-between">
                                            <VehiclePlateBadge plateNumber={workOrder.vehicle?.vehicle_number || 'UNKNOWN'} />
                                            <span className="text-xs font-semibold text-muted-foreground">
                                                {workOrder.vehicle?.model || 'Vehicle'}
                                            </span>
                                        </div>

                                        <Separator />

                                        {/* Customer Details */}
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                                                <User className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-sm truncate">{workOrder.customer?.name || 'Customer'}</h4>
                                                {workOrder.customer?.company_name && (
                                                    <p className="text-xs text-muted-foreground truncate">🏢 {workOrder.customer.company_name}</p>
                                                )}
                                                <div className="flex items-center gap-2 mt-1">
                                                    <p className="text-xs text-muted-foreground">{workOrder.customer?.phone || 'No phone'}</p>
                                                    {workOrder.customer?.phone && (
                                                        <div className="flex gap-1 ml-auto">
                                                            <a
                                                                href={`tel:${workOrder.customer.phone}`}
                                                                className="p-1 rounded hover:bg-green-100 text-green-700 dark:hover:bg-green-950/40"
                                                                title="Call customer"
                                                            >
                                                                <Phone className="h-3 w-3" />
                                                            </a>
                                                            <a
                                                                href={`https://wa.me/91${workOrder.customer.phone.replace(/\D/g, '')}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-1 rounded hover:bg-emerald-100 text-emerald-700 dark:hover:bg-emerald-950/40"
                                                                title="WhatsApp customer"
                                                            >
                                                                <MessageSquare className="h-3 w-3" />
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <Separator />

                                        {/* Advisor & Driver Details */}
                                        <div className="space-y-2 text-xs">
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">Service Advisor:</span>
                                                <span className="font-semibold text-foreground">
                                                    {(() => {
                                                        const intakeData = (workOrder as any).advisor || (workOrder as any).assigned_employee || (workOrder as any).intake_person;
                                                        const intake = Array.isArray(intakeData) ? intakeData[0] : intakeData;
                                                        return intake?.name || 'Assigned';
                                                    })()}
                                                </span>
                                            </div>
                                            {workOrder.driver && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-muted-foreground">Driver:</span>
                                                    <span className="font-semibold text-foreground">
                                                        {workOrder.driver.name} ({workOrder.driver.driver_position || 'Driver'})
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <Separator />

                                        {/* Next Service & Mileage Tracking */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                                    <Gauge className="h-3.5 w-3.5 text-primary" /> Service Targets
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 text-[10px] text-primary px-1.5"
                                                    onClick={handleOpenServiceTargetDialog}
                                                >
                                                    <Edit className="h-2.5 w-2.5 mr-1" /> Update
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div className="p-2 rounded-lg bg-muted/40 border">
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Odometer</p>
                                                    <p className="font-bold text-foreground mt-0.5">
                                                        {workOrder.odometer_reading ? `${workOrder.odometer_reading.toLocaleString()} KM` : '—'}
                                                    </p>
                                                </div>
                                                <div className="p-2 rounded-lg bg-primary/5 border border-primary/20">
                                                    <p className="text-[10px] text-primary uppercase font-bold">Next Service</p>
                                                    <p className="font-bold text-primary mt-0.5">
                                                        {workOrder.next_service_due_km ? `${workOrder.next_service_due_km.toLocaleString()} KM` : '—'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        {/* 3. SERVICE DETAILS BREAKDOWN - BELOW GENERAL INFORMATION */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <Wrench className="h-5 w-5 text-primary" />
                                        Service Details Breakdown
                                    </h3>
                                    <p className="text-xs text-muted-foreground">Component services and assigned mechanics for this job card</p>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs bg-primary/5 border-primary/20 hover:bg-primary/10 font-semibold"
                                    onClick={() => setSearchParams({ action: 'add-service' })}
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                    Add Service
                                </Button>
                            </div>

                            {details.map((service) => (
                                <Card key={service.id} className="overflow-hidden border-l-4 border-l-primary shadow-sm">
                                    <CardHeader className="bg-muted/20 pb-3">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <CardTitle className="flex items-center gap-2 text-base font-bold">
                                                    {service.service_type}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                        onClick={() => handleDeleteService(service.id)}
                                                        title="Delete Service"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </CardTitle>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs text-muted-foreground font-medium">Status:</span>
                                                    <Badge variant="outline" className={cn(
                                                        "text-[10px] font-bold px-2 py-0.5",
                                                        service.status === 'Completed' ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-950/40 dark:text-green-400" :
                                                        service.status === 'In Progress' ? "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-400" :
                                                        "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400"
                                                    )}>
                                                        {service.status || 'Pending'}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-base font-bold flex items-center justify-end font-mono">
                                                    <IndianRupee className="h-3.5 w-3.5" /> {(service.tasks || []).reduce((sum, task) => sum + (task.price || 0), 0) || 0}
                                                </p>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Tasks in this service */}
                                            <div className="space-y-2.5">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
                                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                                        Component Tasks
                                                    </h4>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-6 text-[10px] px-2 font-semibold"
                                                            onClick={() => setAddingTaskToServiceId(service.id)}
                                                        >
                                                            <Plus className="h-3 w-3 mr-1" /> Add Task
                                                        </Button>
                                                        <Badge variant="outline" className="text-[10px]">
                                                            {(service.tasks || []).filter(t => t.completed).length}/{(service.tasks || []).length}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {(service.tasks || []).map((task) => (
                                                        <div key={task.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors border text-sm group">
                                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                <Checkbox
                                                                    id={`service-task-${task.id}`}
                                                                    checked={task.completed}
                                                                    onCheckedChange={(checked) => handleToggleTask(task.id, checked === true)}
                                                                />
                                                                <label
                                                                    htmlFor={`service-task-${task.id}`}
                                                                    className={cn("cursor-pointer flex-1 truncate text-xs font-medium", task.completed && "line-through text-muted-foreground")}
                                                                >
                                                                    {task.task_name}
                                                                </label>
                                                                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">₹{task.price || 0}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 ml-2">
                                                                {task.completed ? (
                                                                    <Badge variant="default" className="bg-green-600 text-[9px] h-4 px-1.5">Done</Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5">Pending</Badge>
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

                                            {/* Assigned Employees in this service */}
                                            <div className="space-y-2.5">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
                                                        <Users className="h-3.5 w-3.5 text-blue-600" />
                                                        Assigned Personnel
                                                    </h4>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-6 text-[10px] px-2 font-semibold"
                                                        onClick={() => {
                                                            setSelectedServiceId(service.id);
                                                            setEmployeeDialogOpen(true);
                                                        }}
                                                    >
                                                        <Plus className="h-3 w-3 mr-1" />
                                                        Assign Mechanic
                                                    </Button>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {service.employees && service.employees.length > 0 ? (
                                                        service.employees.map((emp) => (
                                                            <div key={emp.id} className="flex items-center justify-between p-2 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-xs">
                                                                <div className="flex items-center gap-2">
                                                                    <User className="h-3.5 w-3.5 text-blue-500" />
                                                                    <div
                                                                        className="cursor-pointer hover:underline flex flex-col"
                                                                        onClick={() => handleOpenTracker(emp)}
                                                                    >
                                                                        <span className="font-semibold text-blue-700 dark:text-blue-300">{emp.employee?.name}</span>
                                                                        {emp.employee?.position?.name && (
                                                                            <span className="text-[9px] text-muted-foreground">
                                                                                {emp.employee.position.name}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{emp.status}</Badge>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                        onClick={() => handleRemoveEmployee(emp.id)}
                                                                        title="Remove assignment"
                                                                    >
                                                                        <X className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground text-center py-4 italic border border-dashed rounded-lg">No mechanics assigned yet</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* 4. VEHICLE CONDITION IMAGES & BELONGINGS - SEPARATED BY CRITERIA */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Camera className="h-5 w-5 text-primary" />
                                Vehicle Condition & Inspection Records
                            </h3>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Criteria 1: Arrival Condition Photos */}
                                <Card className="shadow-sm border">
                                    <CardHeader className="bg-muted/30 pb-3 border-b">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                                <Camera className="h-4 w-4 text-emerald-600" />
                                                Arrival Condition Photos
                                            </CardTitle>
                                            <Badge variant="secondary" className="text-[10px]">
                                                {arrivalPhotos.length} Photos
                                            </Badge>
                                        </div>
                                        <CardDescription className="text-xs">
                                            Photos captured when the vehicle entered the workshop
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-4">
                                        {arrivalPhotos.length > 0 ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                {arrivalPhotos.map((photo) => (
                                                    <div
                                                        key={photo.id}
                                                        className="group relative aspect-square rounded-xl overflow-hidden border bg-background shadow-sm hover:ring-2 hover:ring-primary/40 transition-all flex flex-col justify-end"
                                                    >
                                                        <img
                                                            src={photo.photo_url}
                                                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                            alt="Arrival inspection"
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        <div className="relative p-2 w-full flex items-center justify-between z-10">
                                                            <Badge className="text-[8px] h-3.5 px-1 bg-black/60 text-white border-0 uppercase tracking-wider">
                                                                Arrival
                                                            </Badge>
                                                            <Button
                                                                size="sm"
                                                                className="h-6 text-[10px] px-2 bg-primary/90 hover:bg-primary text-white shadow-md font-semibold gap-1 opacity-90 group-hover:opacity-100"
                                                                onClick={() => setPreviewImage({
                                                                    url: photo.photo_url,
                                                                    title: "Arrival Condition Photo",
                                                                    criteria: "Arrival Inspection"
                                                                })}
                                                            >
                                                                <Eye className="h-3 w-3" />
                                                                View
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-6 text-center text-muted-foreground border border-dashed rounded-lg">
                                                <Camera className="h-6 w-6 mx-auto mb-1 opacity-40" />
                                                <p className="text-xs">No arrival inspection photos recorded.</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Criteria 2: Reported Issue / Damage Photos */}
                                <Card className="shadow-sm border">
                                    <CardHeader className="bg-muted/30 pb-3 border-b">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                                Reported Issue & Damage Photos
                                            </CardTitle>
                                            <Badge variant="secondary" className="text-[10px]">
                                                {issuePhotos.length} Photos
                                            </Badge>
                                        </div>
                                        <CardDescription className="text-xs">
                                            Photos documenting customer complaints, scratches, or component damages
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-4">
                                        {issuePhotos.length > 0 ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                {issuePhotos.map((photo) => (
                                                    <div
                                                        key={photo.id}
                                                        className="group relative aspect-square rounded-xl overflow-hidden border bg-background shadow-sm hover:ring-2 hover:ring-primary/40 transition-all flex flex-col justify-end"
                                                    >
                                                        <img
                                                            src={photo.photo_url}
                                                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                            alt="Reported issue"
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        <div className="relative p-2 w-full flex items-center justify-between z-10">
                                                            <Badge className="text-[8px] h-3.5 px-1 bg-amber-600 text-white border-0 uppercase tracking-wider">
                                                                Issue
                                                            </Badge>
                                                            <Button
                                                                size="sm"
                                                                className="h-6 text-[10px] px-2 bg-primary/90 hover:bg-primary text-white shadow-md font-semibold gap-1 opacity-90 group-hover:opacity-100"
                                                                onClick={() => setPreviewImage({
                                                                    url: photo.photo_url,
                                                                    title: "Reported Issue Photo",
                                                                    criteria: "Reported Damage / Issue"
                                                                })}
                                                            >
                                                                <Eye className="h-3 w-3" />
                                                                View
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-6 text-center text-muted-foreground border border-dashed rounded-lg">
                                                <AlertTriangle className="h-6 w-6 mx-auto mb-1 opacity-40" />
                                                <p className="text-xs">No issue or damage photos recorded.</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Belongings Section */}
                            {belongings.length > 0 && (
                                <Card className="shadow-sm border">
                                    <CardHeader className="bg-muted/30 pb-3 border-b">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                                <Package className="h-4 w-4 text-primary" />
                                                Customer Belongings Recorded at Intake
                                            </CardTitle>
                                            <Badge variant="outline" className="text-[10px]">
                                                {belongings.length} Items
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {belongings.map((item) => (
                                                <div key={item.id} className="flex items-center gap-3 p-2.5 bg-muted/20 border rounded-xl group hover:border-primary/40 transition-colors">
                                                    <div
                                                        className="w-12 h-12 rounded-lg border overflow-hidden bg-background shrink-0 cursor-pointer"
                                                        onClick={() => item.photo_url && setPreviewImage({
                                                            url: item.photo_url,
                                                            title: item.item_name,
                                                            criteria: "Belonging"
                                                        })}
                                                    >
                                                        <img src={item.photo_url} className="w-full h-full object-cover" alt={item.item_name} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold truncate">{item.item_name}</p>
                                                        <p className="text-[10px] text-muted-foreground truncate">{item.description || 'No description'}</p>
                                                        <div className="mt-1">
                                                            {item.confirmed_at ? (
                                                                <Badge variant="outline" className="text-[9px] bg-green-50 text-green-700 border-green-200 gap-1 h-4 px-1.5">
                                                                    <CheckCircle2 className="h-2.5 w-2.5" /> Returned
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-[9px] bg-yellow-50 text-yellow-700 border-yellow-200 h-4 px-1.5">
                                                                    Pending Return
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {item.photo_url && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                                                            onClick={() => setPreviewImage({
                                                                url: item.photo_url,
                                                                title: item.item_name,
                                                                criteria: "Belonging"
                                                            })}
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </TabsContent>

                    {/* Tab 2: Workflow Actions (Dedicated Tab as requested) */}
                    <TabsContent value="workflow" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-6">
                                {/* Stage Gate Approvals */}
                                <Card className="border-2 border-primary/20 shadow-sm">
                                    <CardHeader className="bg-muted/30 pb-4 border-b">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div>
                                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                                    <ShieldCheck className="h-5 w-5 text-primary" />
                                                    Stage Gate Approvals & Progress Controls
                                                </CardTitle>
                                                <CardDescription className="text-xs mt-1">
                                                    Check or uncheck stages to advance the work order. Toggles update immediately in real-time without refreshing the page.
                                                </CardDescription>
                                            </div>
                                            <div className="flex items-center gap-2 p-1.5 px-3 bg-background rounded-lg border shadow-sm">
                                                <span className="text-xs font-semibold text-muted-foreground">Visible to Customer</span>
                                                <Switch
                                                    checked={workOrder.customer_visible}
                                                    onCheckedChange={handleToggleVisibility}
                                                />
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4 pt-4">
                                        {/* Stage 1: Inspection Approval */}
                                        <div className="flex items-center justify-between p-3.5 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <Checkbox
                                                    id="inspection-approval"
                                                    checked={workOrder.inspection_status === 'approved'}
                                                    onCheckedChange={async (checked) => {
                                                        const isApproved = checked === true;
                                                        // 1. Optimistic instant UI update
                                                        setWorkOrder(prev => prev ? {
                                                            ...prev,
                                                            inspection_status: isApproved ? 'approved' : 'pending',
                                                            status: isApproved && prev.status === 'Pending Approval' ? 'In Progress' : prev.status,
                                                            current_stage: isApproved && prev.current_stage === 'Inspection' ? 'Repair' : (!isApproved && prev.current_stage === 'Repair' ? 'Inspection' : prev.current_stage)
                                                        } : null);

                                                        // Optimistically update all services to In Progress if advancing from Inspection
                                                        if (isApproved) {
                                                            setDetails(prev => {
                                                                if (!prev) return null;
                                                                return {
                                                                    ...prev,
                                                                    services: (prev.services || []).map((s: any) => ({
                                                                        ...s,
                                                                        status: s.status === 'Pending Approval' || s.status === 'Pending' ? 'In Progress' : s.status
                                                                    }))
                                                                };
                                                            });
                                                        }

                                                        try {
                                                            const updates: any = {
                                                                inspection_status: isApproved ? 'approved' : 'pending'
                                                            };
                                                            if (isApproved) {
                                                                if (workOrder.status === 'Pending Approval') {
                                                                    updates.status = 'In Progress';
                                                                }
                                                                if (workOrder.current_stage === 'Inspection') {
                                                                    updates.current_stage = 'Repair';
                                                                }
                                                            } else if (!isApproved && workOrder.current_stage === 'Repair') {
                                                                updates.current_stage = 'Inspection';
                                                            }

                                                            const { error: woError } = await supabase.from("work_orders").update(updates).eq("id", id);
                                                            if (woError) throw woError;

                                                            if (isApproved) {
                                                                await supabase.from("work_order_services")
                                                                    .update({ status: 'In Progress' })
                                                                    .eq("work_order_id", id)
                                                                    .in("status", ['Pending Approval', 'Pending', 'pending']);
                                                            }

                                                            await supabase.from("work_order_stages").upsert({
                                                                work_order_id: id,
                                                                stage: 'Inspection',
                                                                status: isApproved ? 'completed' : 'pending',
                                                                completed_at: isApproved ? new Date().toISOString() : null
                                                            }, { onConflict: 'work_order_id,stage' });

                                                            toast({
                                                                title: isApproved ? "Inspection Approved" : "Inspection Reset",
                                                                description: isApproved ? "Inspection approved, advancing stage to Repair and status to In Progress." : "Inspection reset to pending."
                                                            });
                                                            fetchDetails(true);
                                                        } catch (error: any) {
                                                            toast({ variant: "destructive", title: "Error", description: error.message });
                                                            fetchDetails(true);
                                                        }
                                                    }}
                                                    className="h-5 w-5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                                />
                                                <label htmlFor="inspection-approval" className="flex items-center gap-2 cursor-pointer">
                                                    <Shield className="h-4 w-4 text-green-600" />
                                                    <span className="font-semibold text-sm">1. Approve Intake Inspection</span>
                                                </label>
                                            </div>
                                            <Badge variant={workOrder.inspection_status === 'approved' ? "default" : "outline"} className={workOrder.inspection_status === 'approved' ? "bg-green-600" : ""}>
                                                {workOrder.inspection_status === 'approved' ? 'Approved' : 'Pending'}
                                            </Badge>
                                        </div>

                                        {/* Stage 2: Repair Approval */}
                                        <div className="space-y-2">
                                            <div className={cn(
                                                "flex items-center justify-between p-3.5 rounded-xl border bg-card hover:bg-muted/30 transition-colors",
                                                workOrder.status === 'Pending Approval' && "animate-blink-blue border-primary/20"
                                            )}>
                                                <div className="flex items-center gap-3">
                                                    <Checkbox
                                                        id="repair-approval"
                                                        checked={workOrder.repair_status === 'approved'}
                                                        onCheckedChange={async (checked) => {
                                                            const isApproved = checked === true;
                                                            // 1. Optimistic update
                                                            setWorkOrder(prev => prev ? {
                                                                ...prev,
                                                                repair_status: isApproved ? 'approved' : 'in_progress',
                                                                status: isApproved ? 'In Progress' : prev.status,
                                                                current_stage: isApproved ? 'Review' : 'Repair'
                                                            } : null);

                                                            if (isApproved) {
                                                                setDetails(prev => {
                                                                    if (!prev) return null;
                                                                    return {
                                                                        ...prev,
                                                                        services: (prev.services || []).map((s: any) => ({
                                                                            ...s,
                                                                            status: 'Completed'
                                                                        }))
                                                                    };
                                                                });
                                                            }

                                                            try {
                                                                const updates: any = {
                                                                    repair_status: isApproved ? 'approved' : 'in_progress'
                                                                };
                                                                if (isApproved) {
                                                                    updates.status = 'In Progress';
                                                                    updates.current_stage = 'Review';
                                                                } else {
                                                                    updates.current_stage = 'Repair';
                                                                }

                                                                const { error: woError } = await supabase.from("work_orders").update(updates).eq("id", id);
                                                                if (woError) throw woError;

                                                                if (isApproved) {
                                                                    await supabase.from("work_order_services").update({
                                                                        status: 'Completed',
                                                                        completed_at: new Date().toISOString()
                                                                    }).eq("work_order_id", id);
                                                                }

                                                                await supabase.from("work_order_stages").upsert({
                                                                    work_order_id: id,
                                                                    stage: 'Repair',
                                                                    status: isApproved ? 'completed' : 'in_progress',
                                                                    completed_at: isApproved ? new Date().toISOString() : null
                                                                }, { onConflict: 'work_order_id,stage' });

                                                                toast({
                                                                    title: isApproved ? "Repair Approved" : "Repair Reset",
                                                                    description: isApproved ? "Repair approved, advancing stage to Review." : "Repair status reset to in progress."
                                                                });
                                                                fetchDetails(true);
                                                            } catch (error: any) {
                                                                toast({ variant: "destructive", title: "Error", description: error.message });
                                                                fetchDetails(true);
                                                            }
                                                        }}
                                                        className="h-5 w-5 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                                    />
                                                    <label htmlFor="repair-approval" className="flex items-center gap-2 cursor-pointer">
                                                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                                                        <span className="font-semibold text-sm">2. Approve Repair Completion</span>
                                                    </label>
                                                </div>
                                                <Badge variant={workOrder.repair_status === 'approved' ? "default" : "outline"} className={workOrder.repair_status === 'approved' ? "bg-blue-600" : ""}>
                                                    {workOrder.repair_status === 'approved' ? 'Approved' : workOrder.repair_status === 'completed' ? 'Completed' : 'In Progress'}
                                                </Badge>
                                            </div>

                                            {workOrder.repair_status !== 'completed' && workOrder.repair_status !== 'approved' && (
                                                <Button className="w-full justify-start bg-orange-600 hover:bg-orange-700 h-9 text-xs" onClick={handleForceComplete}>
                                                    <AlertTriangle className="h-3.5 w-3.5 mr-2" /> Force Complete Repair
                                                </Button>
                                            )}
                                        </div>

                                        {/* Stage 3: Review Approval */}
                                        <div className="flex items-center justify-between p-3.5 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <Checkbox
                                                    id="review-approval"
                                                    checked={workOrder.review_status === 'approved'}
                                                    onCheckedChange={async (checked) => {
                                                        const isApproved = checked === true;
                                                        setWorkOrder(prev => prev ? {
                                                            ...prev,
                                                            review_status: isApproved ? 'approved' : 'pending',
                                                            current_stage: isApproved ? 'Quality Check' : 'Review'
                                                        } : null);

                                                        try {
                                                            const updates: any = {
                                                                review_status: isApproved ? 'approved' : 'pending',
                                                                current_stage: isApproved ? 'Quality Check' : 'Review'
                                                            };

                                                            const { error: woError } = await supabase.from("work_orders").update(updates).eq("id", id);
                                                            if (woError) throw woError;

                                                            await supabase.from("work_order_stages").upsert({
                                                                work_order_id: id,
                                                                stage: 'Review',
                                                                status: isApproved ? 'completed' : 'pending',
                                                                completed_at: isApproved ? new Date().toISOString() : null
                                                            }, { onConflict: 'work_order_id,stage' });

                                                            toast({
                                                                title: isApproved ? "Review Approved" : "Review Reset",
                                                                description: isApproved ? "Review approved, advancing stage to Quality Check." : "Review status reset to pending."
                                                            });
                                                            fetchDetails(true);
                                                        } catch (error: any) {
                                                            toast({ variant: "destructive", title: "Error", description: error.message });
                                                            fetchDetails(true);
                                                        }
                                                    }}
                                                    className="h-5 w-5 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                                                />
                                                <label htmlFor="review-approval" className="flex items-center gap-2 cursor-pointer">
                                                    <Shield className="h-4 w-4 text-purple-600" />
                                                    <span className="font-semibold text-sm">3. Approve Review & Evaluation</span>
                                                </label>
                                            </div>
                                            <Badge variant={workOrder.review_status === 'approved' ? "default" : "outline"} className={workOrder.review_status === 'approved' ? "bg-purple-600" : ""}>
                                                {workOrder.review_status === 'approved' ? 'Approved' : 'Pending'}
                                            </Badge>
                                        </div>

                                        {/* Stage 4: Quality Check */}
                                        <div className="flex items-center justify-between p-3.5 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <Checkbox
                                                    id="quality-check"
                                                    checked={workOrder.quality_check_status === 'completed'}
                                                    onCheckedChange={async (checked) => {
                                                        const isCompleted = checked === true;
                                                        setWorkOrder(prev => prev ? {
                                                            ...prev,
                                                            quality_check_status: isCompleted ? 'completed' : 'pending',
                                                            current_stage: isCompleted ? 'Delivery' : 'Quality Check'
                                                        } : null);

                                                        try {
                                                            const updates: any = {
                                                                quality_check_status: isCompleted ? 'completed' : 'pending',
                                                                current_stage: isCompleted ? 'Delivery' : 'Quality Check'
                                                            };

                                                            const { error: woError } = await supabase.from("work_orders").update(updates).eq("id", id);
                                                            if (woError) throw woError;

                                                            await supabase.from("work_order_stages").upsert({
                                                                work_order_id: id,
                                                                stage: 'Quality Check',
                                                                status: isCompleted ? 'completed' : 'pending',
                                                                completed_at: isCompleted ? new Date().toISOString() : null
                                                            }, { onConflict: 'work_order_id,stage' });

                                                            toast({
                                                                title: isCompleted ? "Quality Check Completed" : "Quality Check Reset",
                                                                description: isCompleted ? "QC completed, advancing stage to Delivery." : "Quality check reset to pending."
                                                            });
                                                            fetchDetails(true);
                                                        } catch (error: any) {
                                                            toast({ variant: "destructive", title: "Error", description: error.message });
                                                            fetchDetails(true);
                                                        }
                                                    }}
                                                    className="h-5 w-5 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                                />
                                                <label htmlFor="quality-check" className="flex items-center gap-2 cursor-pointer">
                                                    <ShieldCheck className="h-4 w-4 text-indigo-600" />
                                                    <span className="font-semibold text-sm">4. Quality Check & Inspection Signoff</span>
                                                </label>
                                            </div>
                                            <Badge variant={workOrder.quality_check_status === 'completed' ? "default" : "outline"} className={workOrder.quality_check_status === 'completed' ? "bg-indigo-600" : ""}>
                                                {workOrder.quality_check_status === 'completed' ? 'Completed' : 'Pending'}
                                            </Badge>
                                        </div>

                                        {/* Stage 5: Alert Customer for Delivery */}
                                        <div className="flex items-center justify-between p-3.5 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <Checkbox
                                                    id="customer-alert"
                                                    checked={workOrder.customer_notified === true}
                                                    disabled={workOrder.quality_check_status !== 'completed'}
                                                    onCheckedChange={async (checked) => {
                                                        const isNotified = checked === true;
                                                        setWorkOrder(prev => prev ? {
                                                            ...prev,
                                                            customer_notified: isNotified,
                                                            customer_visible: isNotified ? true : prev.customer_visible,
                                                            current_stage: isNotified ? 'Delivery' : prev.current_stage
                                                        } : null);

                                                        try {
                                                            const updates: any = {
                                                                customer_notified: isNotified
                                                            };
                                                            if (isNotified) {
                                                                updates.customer_visible = true;
                                                                updates.current_stage = 'Delivery';
                                                            }

                                                            const { error: woError } = await supabase.from("work_orders").update(updates).eq("id", id);
                                                            if (woError) throw woError;

                                                            await supabase.from("work_order_stages").upsert({
                                                                work_order_id: id,
                                                                stage: 'Delivery',
                                                                status: isNotified ? 'in_progress' : 'pending',
                                                                started_at: isNotified ? new Date().toISOString() : null
                                                            }, { onConflict: 'work_order_id,stage' });

                                                            toast({
                                                                title: isNotified ? "Customer Alerted" : "Alert Cancelled",
                                                                description: isNotified ? "Customer has been notified for vehicle handover." : "Notification reset."
                                                            });
                                                            fetchDetails(true);
                                                        } catch (error: any) {
                                                            toast({ variant: "destructive", title: "Error", description: error.message });
                                                            fetchDetails(true);
                                                        }
                                                    }}
                                                    className="h-5 w-5 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                                                />
                                                <label htmlFor="customer-alert" className="flex items-center gap-2 cursor-pointer">
                                                    <Bell className="h-4 w-4 text-amber-600" />
                                                    <span className="font-semibold text-sm">5. Alert Customer for Vehicle Delivery</span>
                                                </label>
                                            </div>
                                            <Badge variant={workOrder.customer_notified ? "default" : "outline"} className={workOrder.customer_notified ? "bg-amber-600" : ""}>
                                                {workOrder.customer_notified ? 'Alerted' : 'Not Alerted'}
                                            </Badge>
                                        </div>

                                        {/* Stage 6: Mark as Delivered */}
                                        <div className="flex items-center justify-between p-3.5 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <Checkbox
                                                    id="delivery-status"
                                                    checked={workOrder.status === 'Completed'}
                                                    disabled={!workOrder.customer_notified}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            handleMarkDelivered();
                                                        } else {
                                                            setWorkOrder(prev => prev ? {
                                                                ...prev,
                                                                status: 'Pending Approval',
                                                                completed_at: null
                                                            } : null);
                                                            supabase.from("work_orders").update({
                                                                status: 'Pending Approval',
                                                                completed_at: null
                                                            } as any).eq("id", id).then(() => {
                                                                toast({ title: "Delivery Unmarked", description: "Work order status reset to Pending Approval" });
                                                                fetchDetails(true);
                                                            });
                                                        }
                                                    }}
                                                    className="h-5 w-5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                />
                                                <label htmlFor="delivery-status" className="flex items-center gap-2 cursor-pointer">
                                                    <Truck className="h-4 w-4 text-primary" />
                                                    <span className="font-semibold text-sm">6. Mark as Delivered & Complete Handover</span>
                                                </label>
                                            </div>
                                            <Badge variant={workOrder.status === 'Completed' ? "default" : "outline"} className={workOrder.status === 'Completed' ? "bg-primary" : ""}>
                                                {workOrder.status === 'Completed' ? 'Completed' : 'Not Completed'}
                                            </Badge>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Staff Assignment Requests */}
                                <Card className="border-l-4 border-l-blue-500 bg-blue-50/10 shadow-sm">
                                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b">
                                        <div className="flex items-center gap-2">
                                            <Users className="h-5 w-5 text-primary" />
                                            <CardTitle className="text-base font-semibold">Staff Assignment Requests</CardTitle>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-[10px] font-mono bg-card">
                                                {details.reduce((acc, s) => acc + (s.employees?.length || 0), 0)} TOTAL
                                            </Badge>
                                            {details.some(s => s.employees?.some(e => e.status === 'Assigned')) && (
                                                <Button
                                                    size="sm"
                                                    variant="default"
                                                    className="h-7 text-[10px] bg-primary hover:bg-primary/90 text-primary-foreground px-3 font-semibold"
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
                                                            <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary shadow-sm text-xs">
                                                                {emp.employee?.name?.split(' ').map(n => n[0]).join('') || "E"}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-bold text-foreground">{emp.employee?.name}</div>
                                                                <div className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1 bg-muted/50 w-fit px-1.5 rounded">
                                                                    <Wrench className="h-2 w-2" /> {s.service_type}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex flex-col items-end gap-1">
                                                                {(() => {
                                                                    const isFinished = ['completed', 'delivered', 'cancelled', 'rejected'].includes(workOrder?.status?.toLowerCase() || '') || s.status?.toLowerCase() === 'completed';
                                                                    const displayStatus = isFinished ? 'Completed' : (emp.status === 'Accepted' ? 'Working' : 'Pending');
                                                                    const badgeClass = isFinished
                                                                        ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                                                                        : (emp.status === 'Accepted' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600 text-white');

                                                                    return (
                                                                        <Badge
                                                                            variant={'default'}
                                                                            className={`text-[9px] uppercase tracking-tighter px-2 h-4 border-0 ${badgeClass}`}
                                                                        >
                                                                            {displayStatus}
                                                                        </Badge>
                                                                    );
                                                                })()}
                                                                {emp.accepted_at && (
                                                                    <span className="text-[9px] text-muted-foreground font-mono">
                                                                        {format(new Date(emp.accepted_at), "MMM d, h:mm a")}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                {emp.status === 'Assigned' && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-7 text-[10px] bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 px-2"
                                                                        onClick={() => handleAcceptForStaff(emp.id, s.id)}
                                                                    >
                                                                        <Play className="h-3 w-3 mr-1" /> Release
                                                                    </Button>
                                                                )}
                                                                {emp.status === 'pending_acceptance' && (
                                                                    <Badge variant="outline" className="h-7 text-[9px] bg-orange-50 text-orange-700 border-orange-200">
                                                                        <Clock className="h-3 w-3 mr-1" /> Waiting
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

                            {/* Right Column: Administrative Actions & Notes */}
                            <div className="space-y-6">
                                <Card className="shadow-sm">
                                    <CardHeader className="pb-3 border-b">
                                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                            Administrative Actions
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 pt-4">
                                        {workOrder.status === 'Pending Approval' && (
                                            <Button
                                                variant="destructive"
                                                className="w-full text-xs h-9 justify-start"
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
                                                className="w-full border-orange-500 text-orange-600 hover:bg-orange-50 text-xs h-9 justify-start"
                                                onClick={() => setReopenDialogOpen(true)}
                                            >
                                                <RefreshCw className="h-4 w-4 mr-2" /> Reopen Work Order
                                            </Button>
                                        )}

                                        <Button
                                            variant="outline"
                                            className="w-full justify-start text-xs h-9"
                                            onClick={() => {
                                                setSelectedServiceId(details[0]?.id || "");
                                                setEmployeeDialogOpen(true);
                                            }}
                                            disabled={details.length === 0}
                                        >
                                            <Users className="h-4 w-4 mr-2 text-primary" />
                                            Assign Personnel
                                        </Button>

                                        <Button
                                            variant="outline"
                                            className="w-full justify-start text-xs h-9"
                                            onClick={() => { setNoteType("reach_out"); setCustomerNotes(""); setNotesDialogOpen(true); }}
                                        >
                                            <Clock className="h-4 w-4 mr-2 text-amber-600" /> Customer Reach Out
                                        </Button>

                                        <Button
                                            variant="outline"
                                            className="w-full justify-start text-xs h-9"
                                            onClick={() => { setNoteType("customer"); setCustomerNotes(""); setNotesDialogOpen(true); }}
                                        >
                                            <User className="h-4 w-4 mr-2 text-blue-600" /> Customer Update
                                        </Button>

                                        <Button
                                            variant="outline"
                                            className="w-full justify-start text-xs h-9"
                                            onClick={() => { setNoteType("internal"); setCustomerNotes(""); setNotesDialogOpen(true); }}
                                        >
                                            <ClipboardList className="h-4 w-4 mr-2 text-purple-600" /> Internal Staff Update
                                        </Button>
                                    </CardContent>
                                </Card>

                                {/* Lifecycle Details */}
                                <Card className="shadow-sm">
                                    <CardHeader className="pb-3 border-b">
                                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                            Work Order Lifecycle
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 pt-4 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Priority:</span>
                                            <Badge variant={workOrder.priority === "Urgent" ? "destructive" : "outline"} className="text-[10px]">
                                                {workOrder.priority || 'Normal'}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Stage:</span>
                                            <Badge variant="secondary" className="font-mono text-[10px]">
                                                {workOrder.current_stage || 'Inspection'}
                                            </Badge>
                                        </div>
                                        <Separator />
                                        <div className="flex items-center justify-between text-muted-foreground">
                                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Created:</span>
                                            <span className="font-medium text-foreground">{format(new Date(workOrder.created_at), "MMM d, yyyy h:mm a")}</span>
                                        </div>
                                        {workOrder.accepted_at && (
                                            <div className="flex items-center justify-between text-muted-foreground">
                                                <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Accepted:</span>
                                                <span className="font-medium text-foreground">{format(new Date(workOrder.accepted_at), "MMM d, h:mm a")}</span>
                                            </div>
                                        )}
                                        {workOrder.completed_at && (
                                            <div className="flex items-center justify-between text-muted-foreground">
                                                <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Completed:</span>
                                                <span className="font-medium text-foreground">{format(new Date(workOrder.completed_at), "MMM d, h:mm a")}</span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>

                    {/* Tab 3: Parts & Materials */}
                    <TabsContent value="parts" className="space-y-6">
                        <div className="space-y-6">
                            <PartRequestList
                                workOrderId={id!}
                                isAdmin={user?.role === 'admin' || user?.role === 'manager'}
                            />
                        </div>
                    </TabsContent>

                    {/* Tab 4: Billing & Notes */}
                    <TabsContent value="billing" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-6">
                                <Card className="border-border/70 shadow-sm">
                                    <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
                                        <div>
                                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                                <Receipt className="h-5 w-5 text-emerald-600" />
                                                Billing & Payment Summary
                                            </CardTitle>
                                            <CardDescription className="text-xs">
                                                Invoice status, customer ledger link, and balance breakdown
                                            </CardDescription>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 gap-1.5"
                                                onClick={() => navigate(`/admin/invoices?workOrderId=${workOrder.id}`)}
                                            >
                                                <Receipt className="h-4 w-4" />
                                                {billingInfo.totalInvoiced > 0 ? 'Open Invoice' : 'Create Invoice'}
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-6">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            <div className="p-4 rounded-xl bg-muted/40 border">
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">Total Invoiced</span>
                                                <span className="text-xl font-extrabold text-foreground font-mono mt-1 block">
                                                    ₹{billingInfo.totalInvoiced.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="p-4 rounded-xl bg-muted/40 border">
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">Collected</span>
                                                <span className="text-xl font-extrabold text-emerald-600 font-mono mt-1 block">
                                                    ₹{billingInfo.totalPaid.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="p-4 rounded-xl bg-muted/40 border">
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">Adjustments</span>
                                                <span className="text-xl font-extrabold text-amber-600 font-mono mt-1 block">
                                                    ₹{billingInfo.totalDeductions.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="p-4 rounded-xl bg-muted/40 border">
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">Balance Due</span>
                                                <span className={`text-xl font-extrabold font-mono mt-1 block ${billingInfo.balance > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                                                    ₹{billingInfo.balance.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>

                                        {billingSettings.enable_dual_gst ? (
                                            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 text-xs text-blue-900 dark:text-blue-300">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200 border-blue-300 dark:border-blue-700 text-[10px] font-semibold">
                                                        2 GST Rates Mode
                                                    </Badge>
                                                    <span className="font-medium">Service GST: <strong>{billingSettings.service_gst_rate}%</strong> ({billingSettings.service_gst_rate / 2}% CGST + {billingSettings.service_gst_rate / 2}% SGST)</span>
                                                    <span className="text-muted-foreground/40">•</span>
                                                    <span className="font-medium">Spare Bill GST: <strong>{billingSettings.spare_gst_rate}%</strong> ({billingSettings.spare_gst_rate / 2}% CGST + {billingSettings.spare_gst_rate / 2}% SGST)</span>
                                                </div>
                                                <span className="text-[11px] text-muted-foreground">Configured in Settings</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border text-xs text-muted-foreground">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className="text-[10px]">Single GST Rate</Badge>
                                                    <span>Standard Rate: <strong>{billingSettings.single_gst_rate}% GST</strong> applied uniformly across services & spares</span>
                                                </div>
                                                <span className="text-[11px] text-muted-foreground">Configured in Settings</span>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-muted/20 border">
                                            <div className="space-y-1">
                                                <p className="text-xs font-bold text-foreground">Formal Invoice & Documents</p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    Print workshop job slip or download computer-generated GST tax invoice.
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" onClick={() => setSlipDialogOpen(true)} className="h-8 text-xs gap-1">
                                                    <FileText className="h-3.5 w-3.5" /> Print Work Slip
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => generateInvoicePDF(workOrder.id)} className="h-8 text-xs gap-1">
                                                    <IndianRupee className="h-3.5 w-3.5" /> Download Tax Invoice
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="space-y-6">
                                <Card className="border-border/70 shadow-sm">
                                    <CardHeader className="pb-3 border-b">
                                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            Customer Account
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 space-y-3">
                                        <div>
                                            <h4 className="font-bold text-sm">{workOrder.customer?.name}</h4>
                                            {workOrder.customer?.company_name && (
                                                <p className="text-xs text-muted-foreground">{workOrder.customer.company_name}</p>
                                            )}
                                        </div>
                                        {workOrder.customer?.id && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full text-xs font-semibold h-8"
                                                onClick={() => navigate(`/admin/customers/${workOrder.customer?.id}/ledger`)}
                                            >
                                                View Customer Statement / Ledger &rarr;
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Approval/Rejection Dialog */}
            {/* Advisor Edit Dialog */}
            <Dialog open={advisorDialogOpen} onOpenChange={setAdvisorDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Update Service Advisor</DialogTitle>
                        <DialogDescription>
                            Select the advisor responsible for this work order.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Select Employee</Label>
                            <Select
                                value={selectedEmployeeId || (workOrder?.assigned_to || "")}
                                onValueChange={setSelectedEmployeeId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Advisor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map((emp) => (
                                        <SelectItem key={emp.id} value={emp.id}>
                                            {emp.name} {emp.email === user?.email ? "(Me)" : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {user?.email && employees.find(e => e.email === user.email) && (
                            <Button
                                variant="outline"
                                className="w-full text-xs"
                                onClick={() => {
                                    const me = employees.find(e => e.email === user.email);
                                    if (me) handleUpdateAdvisor(me.id);
                                }}
                                disabled={isUpdatingAdvisor}
                            >
                                Assign to Me
                            </Button>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAdvisorDialogOpen(false)}>Cancel</Button>
                        <Button
                            onClick={() => handleUpdateAdvisor(selectedEmployeeId)}
                            disabled={!selectedEmployeeId || isUpdatingAdvisor}
                        >
                            {isUpdatingAdvisor ? "Updating..." : "Update Advisor"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
            <Dialog open={showConfigForm} onOpenChange={(open) => !open && setSearchParams({})}>
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
                                setSearchParams({});
                                setReopenReason("");
                                fetchDetails();
                            }}
                            onCancel={() => setSearchParams({})}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add Service Dialog */}
            <Dialog open={showAddServiceForm} onOpenChange={(open) => !open && setSearchParams({})}>
                <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto p-0">
                    <DialogHeader className="px-6 pt-6 pb-0">
                        <DialogTitle className="sr-only">Add Service</DialogTitle>
                    </DialogHeader>
                    <div className="p-6 pt-0">
                        <WorkOrderForm
                            initialWorkOrderId={id}
                            isReopening={false}
                            onSuccess={() => {
                                setSearchParams({});
                                fetchDetails();
                            }}
                            onCancel={() => setSearchParams({})}
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
            {/* Add Task Dialog */}
            <Dialog open={!!addingTaskToServiceId} onOpenChange={(open) => !open && setAddingTaskToServiceId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Task</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {predefinedTasks.length > 0 && (
                            <div className="grid gap-2">
                                <Label>Select Predefined Task</Label>
                                <Select onValueChange={handlePredefinedTaskSelect}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a task..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {predefinedTasks.map(task => (
                                            <SelectItem key={task.id} value={task.id}>
                                                {task.name} - ₹{task.effective_price} {task.rule_applied ? '(Category Price)' : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label htmlFor="new-task-price">Price</Label>
                            <Input
                                id="new-task-price"
                                type="number"
                                value={newTaskPrice}
                                onChange={(e) => setNewTaskPrice(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddingTaskToServiceId(null)}>Cancel</Button>
                        <Button onClick={handleAddTask} disabled={!newTaskName.trim() || isAddingTask}>
                            {isAddingTask && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Add Task
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Slip Copy Selection Dialog */}
            <Dialog open={slipDialogOpen} onOpenChange={setSlipDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Generate Slip Print</DialogTitle>
                        <DialogDescription>
                            Choose the type of slip copy you want to generate.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <Button
                            variant="outline"
                            className="flex flex-col items-center gap-4 h-auto py-8 hover:border-primary hover:bg-primary/5 transition-all group"
                            onClick={() => {
                                generateWorkSlipPDF(workOrder.id, 'customer');
                                setSlipDialogOpen(false);
                            }}
                        >
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <User className="h-6 w-6 text-primary" />
                            </div>
                            <div className="text-center">
                                <div className="font-bold">Customer Copy</div>
                                <div className="text-[10px] text-muted-foreground mt-1 px-2">Includes pricing details and company information</div>
                            </div>
                        </Button>
                        <Button
                            variant="outline"
                            className="flex flex-col items-center gap-4 h-auto py-8 hover:border-primary hover:bg-primary/5 transition-all group"
                            onClick={() => {
                                generateWorkSlipPDF(workOrder.id, 'workshop');
                                setSlipDialogOpen(false);
                            }}
                        >
                            <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                <Wrench className="h-6 w-6 text-blue-600" />
                            </div>
                            <div className="text-center">
                                <div className="font-bold">Workshop Copy</div>
                                <div className="text-[10px] text-muted-foreground mt-1 px-2">Job card with driver & staff info, no pricing</div>
                            </div>
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delivery Confirmation Dialog */}
            <Dialog open={confirmationDialogOpen} onOpenChange={setConfirmationDialogOpen}>
                <DialogContent className="max-w-md rounded-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Package className="h-6 w-6 text-primary" />
                            Final Item Verification
                        </DialogTitle>
                        <DialogDescription>
                            The following items must be verified and returned to the customer before the vehicle is released.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                        {belongings.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 p-3 border rounded-xl bg-muted/10">
                                <div className="w-14 h-14 rounded-lg overflow-hidden border bg-background shadow-sm">
                                    <img src={item.photo_url} className="w-full h-full object-cover" alt={item.item_name} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-sm truncate">{item.item_name}</h4>
                                    <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <Checkbox
                                        id={`confirm-modal-${item.id}`}
                                        checked={!!confirmedItems[item.id]}
                                        onCheckedChange={(checked) => {
                                            setConfirmedItems(prev => ({ ...prev, [item.id]: !!checked }));
                                        }}
                                        className="h-5 w-5 rounded-md"
                                    />
                                    <Label htmlFor={`confirm-modal-${item.id}`} className="text-[9px] font-bold uppercase text-muted-foreground">Returned</Label>
                                </div>
                            </div>
                        ))}
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button variant="ghost" onClick={() => setConfirmationDialogOpen(false)} className="sm:flex-1">Discard</Button>
                        <Button
                            className="bg-primary text-primary-foreground sm:flex-[2]"
                            disabled={!belongings.every(b => confirmedItems[b.id]) || isConfirmingBelongings}
                            onClick={async () => {
                                setIsConfirmingBelongings(true);
                                try {
                                    const client = supabaseAdmin || supabase;
                                    const { error } = await client
                                        .from('work_order_belongings')
                                        .update({ confirmed_at: new Date().toISOString() })
                                        .in('id', belongings.map(b => b.id));

                                    if (error) throw error;
                                    setConfirmationDialogOpen(false);
                                    handleMarkDelivered();
                                } catch (error: any) {
                                    toast({ variant: "destructive", title: "Error", description: error.message });
                                } finally {
                                    setIsConfirmingBelongings(false);
                                }
                            }}
                        >
                            {isConfirmingBelongings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Confirm & Complete Delivery
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Update Next Service Targets Dialog */}
            <Dialog open={showServiceTargetDialog} onOpenChange={setShowServiceTargetDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Gauge className="h-5 w-5 text-primary" />
                            Update Vehicle Service Targets
                        </DialogTitle>
                        <DialogDescription>
                            Record the vehicle odometer reading and configure when the next service is due.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Current Odometer (KM)</Label>
                            <Input
                                type="number"
                                value={targetOdometer || ''}
                                onChange={(e) => {
                                    const km = parseInt(e.target.value) || 0;
                                    setTargetOdometer(km);
                                    if (!targetNextKm || targetNextKm <= km) {
                                        setTargetNextKm(km + 10000);
                                    }
                                }}
                                placeholder="e.g. 50000"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold">Next Service Target (KM)</Label>
                                <div className="flex gap-1.5 text-[11px] text-primary">
                                    <button type="button" onClick={() => setTargetNextKm((targetOdometer || 0) + 5000)} className="hover:underline font-medium">+5,000</button>
                                    <button type="button" onClick={() => setTargetNextKm((targetOdometer || 0) + 10000)} className="hover:underline font-medium ml-1">+10,000</button>
                                </div>
                            </div>
                            <Input
                                type="number"
                                value={targetNextKm || ''}
                                onChange={(e) => setTargetNextKm(parseInt(e.target.value) || 0)}
                                placeholder="e.g. 60000"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold">Next Service Due Date</Label>
                                <div className="flex gap-1.5 text-[11px] text-primary">
                                    <button type="button" onClick={() => {
                                        const d = new Date();
                                        d.setMonth(d.getMonth() + 3);
                                        setTargetNextDate(d.toISOString().split('T')[0]);
                                    }} className="hover:underline font-medium">+3 Months</button>
                                    <button type="button" onClick={() => {
                                        const d = new Date();
                                        d.setMonth(d.getMonth() + 6);
                                        setTargetNextDate(d.toISOString().split('T')[0]);
                                    }} className="hover:underline font-medium ml-1">+6 Months</button>
                                </div>
                            </div>
                            <Input
                                type="date"
                                value={targetNextDate}
                                onChange={(e) => setTargetNextDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowServiceTargetDialog(false)} disabled={savingTargets}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveServiceTargets} disabled={savingTargets}>
                            {savingTargets ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Save Targets"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Vehicle Condition Photo Lightbox Preview Dialog */}
            <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
                <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black/95 border-neutral-800 text-white shadow-2xl">
                    <div className="relative flex flex-col items-center">
                        <div className="w-full flex items-center justify-between px-4 py-3 bg-neutral-900/90 border-b border-neutral-800">
                            <div className="flex items-center gap-2">
                                <Camera className="h-4 w-4 text-primary" />
                                <span className="text-sm font-semibold text-white">{previewImage?.title || 'Condition Photo'}</span>
                                {previewImage?.criteria && (
                                    <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary border-0 font-medium">
                                        {previewImage.criteria}
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {previewImage?.url && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 gap-1.5"
                                        onClick={() => window.open(previewImage.url, '_blank')}
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        Open Original
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="p-4 w-full flex items-center justify-center max-h-[75vh] overflow-auto">
                            {previewImage?.url && (
                                <img
                                    src={previewImage.url}
                                    alt={previewImage.title || 'Vehicle condition preview'}
                                    className="max-h-[70vh] max-w-full rounded-lg object-contain shadow-2xl"
                                />
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}
