import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";
import {
  Trash2, Eye, ArrowLeft, Calendar, FileText, Wrench, IndianRupee,
  CheckCircle2, XCircle, Clock, User, Truck, RefreshCw, AlertTriangle,
  BarChart3, Activity, MoreVertical, Play, CheckCircle,
  ClipboardCheck, Clock5, Plus, Receipt
} from "lucide-react";
import { WorkOrderForm } from "@/components/forms/WorkOrderForm";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { CompactProgressTracker } from "@/components/work-orders/ProgressTracker";
import { SearchInput } from "@/components/shared/SearchInput";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
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
import { format, isPast, isToday } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRequests } from "@/contexts/RequestsContext";

import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Types
interface WorkOrder {
  id: string;
  service_type: string;
  description: string;
  status: string;
  priority: string;
  vehicle?: { vehicle_number: string; model: string; customer_id: string };
  customer?: { name: string; phone?: string; company_name?: string };
  created_at: string;
  notes?: string;
  estimated_cost?: number;
  accepted_at?: string | null;
  completed_at?: string | null;
  approved_at?: string | null;
  current_stage?: string | null;
  estimated_delivery_date?: string | null;
  is_reopened?: boolean;
  reopen_reason?: string;
}

// Delivery Status Types
type DeliveryStatus = 'overdue' | 'urgent' | 'soon' | 'normal' | 'none';

interface DeliveryInfo {
  status: DeliveryStatus;
  timeRemaining: number;
  formatted: string;
  color: string;
}

// Utility Functions for Delivery Time
const getDeliveryStatus = (deliveryDate: string | null, currentTime: number): DeliveryInfo => {
  if (!deliveryDate) {
    return {
      status: 'none',
      timeRemaining: 0,
      formatted: 'No delivery date',
      color: 'text-muted-foreground'
    };
  }

  const deliveryTime = new Date(deliveryDate).getTime();
  const timeRemaining = deliveryTime - currentTime;
  const hoursRemaining = timeRemaining / (1000 * 60 * 60);

  if (timeRemaining < 0) {
    return {
      status: 'overdue',
      timeRemaining,
      formatted: formatCountdown(Math.abs(timeRemaining), true),
      color: 'text-red-600'
    };
  } else if (hoursRemaining < 6) {
    return {
      status: 'urgent',
      timeRemaining,
      formatted: formatCountdown(timeRemaining, false),
      color: 'text-red-600'
    };
  } else if (hoursRemaining < 24) {
    return {
      status: 'soon',
      timeRemaining,
      formatted: formatCountdown(timeRemaining, false),
      color: 'text-orange-600'
    };
  } else {
    return {
      status: 'normal',
      timeRemaining,
      formatted: formatCountdown(timeRemaining, false),
      color: 'text-green-600'
    };
  }
};

const formatCountdown = (ms: number, isOverdue: boolean): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / (24 * 60 * 60));
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);

  const prefix = isOverdue ? 'Overdue by ' : '';

  if (days > 0) {
    return `${prefix}${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${prefix}${hours}h ${minutes}m`;
  } else {
    return `${prefix}${minutes}m`;
  }
};

interface ServiceDetail {
  id: string;
  service_type: string;
  status: string;
  estimated_cost: number;
  tasks: {
    id: string;
    task_name: string;
    status: string;
    is_predefined: boolean;
    completed_at?: string | null;
  }[];
  employees: {
    id: string;
    employee_id: string;
    status: string;
    employee: { name: string } | null;
    assigned_at?: string | null;
    accepted_at?: string | null;
  }[];
}

export default function AdminWorkOrders() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { urgentAppointments } = useRequests();

  // State
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'overdue' | 'today' | 'week' | 'none' | 'completed'>('all');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get('editId');
  const isCreating = searchParams.get('create') === 'true';
  const showForm = isCreating || !!editId;
  const urlFilter = searchParams.get('filter');

  // Scheduled Appointments (Upcoming)
  const [scheduledJobs, setScheduledJobs] = useState<any[]>([]);

  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    inProgress: 0,
    pendingApproval: 0,
    ready: 0,
    completed: 0,
    all: 0
  });

  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);

  // Reopen Dialog State
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [reopenOrderId, setReopenOrderId] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [showReopenConfig, setShowReopenConfig] = useState(false);

  // Update current time every minute for live countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  useEffect(() => { fetchWorkOrders(); }, []);

  const [activeTab, setActiveTab] = useState<"in_progress" | "ready" | "completed" | "all">("in_progress");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "created_at",
    direction: "desc",
  });

  const fetchWorkOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("work_orders")
        .select(`
          *, 
          vehicle:vehicles(
            vehicle_number, 
            model, 
            customer_id,
            customers(name, phone, company_name)
          ),
          driver:drivers(
            id,
            name,
            contact_number,
            driver_position
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map(d => {
        const doc = d as any;
        return {
          ...doc,
          customer: doc.vehicle?.customers
            ? {
              name: doc.vehicle.customers.name,
              phone: doc.vehicle.customers.phone,
              company_name: doc.vehicle.customers.company_name
            }
            : { name: "Unknown", phone: "", company_name: "" }
        };
      });

      setWorkOrders(mapped as any);

      const pending = mapped.filter((o: WorkOrder) => ["Pending", "New"].includes(o.status)).length;
      const inProgress = mapped.filter((o: WorkOrder) =>
        ["In Progress", "Accepted", "Under QC", "Inspection", "Repair", "Review", "Quality Check", "Pending Approval"].includes(o.status)
      ).length;
      const pendingApproval = mapped.filter((o: WorkOrder) => o.status === "Pending Approval").length;
      const ready = mapped.filter((o: WorkOrder) => ["Ready", "Ready for Delivery"].includes(o.status)).length;
      const completed = mapped.filter((o: WorkOrder) =>
        ["Approved", "Completed", "Delivered", "Finalized"].includes(o.status)
      ).length;

      setStats({ pending, inProgress, pendingApproval, ready, completed, all: mapped.length });

      // Fetch confirmed appointments as "Scheduled Jobs"
      const { data: appData } = await supabase
        .from('appointments')
        .select('*, customer:customers(name, company_name), vehicle:vehicles(vehicle_number, model)')
        .eq('status', 'confirmed')
        .order('scheduled_at', { ascending: true });

      if (appData) setScheduledJobs(appData);

    } catch (error: any) {
      console.error("Fetch error:", error);
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("work_orders").delete().eq("id", id);
      if (error) throw error;

      toast({ title: "Deleted", description: "Work order deleted successfully" });
      fetchWorkOrders();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const { error } = await (supabase.from("work_orders") as any)
        .update({ status: status as any })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Updated", description: `Status changed to ${status}` });
      fetchWorkOrders();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleAdvanceStageFromList = async (id: string, currentStage: string | null) => {
    // Basic advancement logic for list view
    const stages = ['Inspection', 'Repair', 'Review', 'Quality Check', 'Delivery'];
    const currentIndex = stages.indexOf(currentStage || 'Inspection');
    if (currentIndex < stages.length - 1) {
      const nextStage = stages[currentIndex + 1];
      try {
        // @ts-ignore
        const { error } = await supabase.rpc('advance_work_order_stage', {
          _work_order_id: id,
          _stage: nextStage,
          _employee_id: null
        });
        if (error) throw error;
        toast({ title: "Advanced", description: `Moved to ${nextStage}` });
        fetchWorkOrders();
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
    }
  };

  const handleReopenWorkOrder = () => {
    if (!reopenOrderId || !reopenReason) return;
    setReopenDialogOpen(false);
    setShowReopenConfig(true);
  };

  const handleFormSuccess = () => {
    setSearchParams({});
    setSelectedAppointment(null);
    fetchWorkOrders();
    toast({ title: "Success", description: "Work order created successfully" });
  };

  const handleOpenJobCard = (app: any) => {
    setSelectedAppointment(app);
    setSearchParams({ create: 'true' });
  };

  const filteredOrders = useMemo(() => {
    // First filter by search term
    let filtered = workOrders.filter((o) =>
      o.service_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.vehicle?.vehicle_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.id.includes(searchTerm)
    );

    // Then filter by URL status categories (Dashboard navigation)
    if (urlFilter) {
      filtered = filtered.filter((o) => {
        const s = o.status.toLowerCase();
        switch (urlFilter) {
          case 'new':
            return ['pending', 'new'].includes(s);
          case 'ongoing':
            return ['in progress', 'accepted', 'under qc', 'inspection', 'repair', 'review', 'quality check', 'pending approval'].includes(s);
          case 'ready':
            return ['ready', 'ready for delivery'].includes(s);
          case 'completed':
            return ['completed', 'delivered', 'approved'].includes(s);
          default:
            return true;
        }
      });
    }

    // Filter by Segmented Tab
    if (activeTab === 'in_progress') {
      filtered = filtered.filter(o =>
        !['completed', 'delivered', 'approved', 'cancelled', 'rejected', 'ready', 'ready for delivery', 'finalized'].includes(o.status.toLowerCase())
      );
    } else if (activeTab === 'ready') {
      filtered = filtered.filter(o =>
        ['ready', 'ready for delivery'].includes(o.status.toLowerCase())
      );
    } else if (activeTab === 'completed') {
      filtered = filtered.filter(o =>
        ['completed', 'delivered', 'approved', 'finalized'].includes(o.status.toLowerCase())
      );
    }
    // 'all' includes all statuses

    // Then filter by delivery date
    if (deliveryFilter !== 'all') {
      const now = currentTime;
      const todayStart = new Date(now).setHours(0, 0, 0, 0);
      const todayEnd = new Date(now).setHours(23, 59, 59, 999);
      const weekEnd = new Date(now).setDate(new Date(now).getDate() + 7);

      filtered = filtered.filter((o) => {
        if (deliveryFilter === 'none') {
          return !o.estimated_delivery_date;
        }

        if (!o.estimated_delivery_date) {
          return false;
        }

        const deliveryTime = new Date(o.estimated_delivery_date).getTime();

        switch (deliveryFilter) {
          case 'overdue':
            return deliveryTime < now && !['completed', 'delivered', 'approved', 'cancelled', 'rejected'].includes(o.status.toLowerCase());
          case 'today':
            return deliveryTime >= todayStart && deliveryTime <= todayEnd;
          case 'week':
            return deliveryTime >= now && deliveryTime <= weekEnd;
          case 'completed':
            return ['completed', 'delivered', 'approved'].includes(o.status.toLowerCase());
          default:
            return true;
        }
      });
    }

    // Sort Logic
    return filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortConfig.key) {
        case 'priority':
          const priorityOrder = { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
          const pA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 99;
          const pB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 99;
          comparison = pA - pB;
          break;
        case 'delivery':
          if (!a.estimated_delivery_date && !b.estimated_delivery_date) comparison = 0;
          else if (!a.estimated_delivery_date) comparison = 1;
          else if (!b.estimated_delivery_date) comparison = -1;
          else comparison = new Date(a.estimated_delivery_date).getTime() - new Date(b.estimated_delivery_date).getTime();
          break;
        case 'progress':
          const stageOrder = ['Brief', 'Inspection', 'Estimation', 'Approval', 'Repair', 'Review', 'Quality Check', 'Delivery', 'Completed'];
          const sA = stageOrder.indexOf(a.current_stage || '') !== -1 ? stageOrder.indexOf(a.current_stage || '') : 99;
          const sB = stageOrder.indexOf(b.current_stage || '') !== -1 ? stageOrder.indexOf(b.current_stage || '') : 99;
          comparison = sA - sB;
          break;
        case 'created_at':
        default:
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [workOrders, searchTerm, deliveryFilter, currentTime, activeTab, sortConfig]);

  const suggestions = useMemo(() => {
    const sets = [
      new Set(workOrders.map(o => o.service_type)),
      new Set(workOrders.map(o => o.vehicle?.vehicle_number)),
      new Set(workOrders.map(o => o.customer?.name)),
    ];
    return Array.from(new Set(sets.flatMap(s => Array.from(s)))).filter(Boolean);
  }, [workOrders]);

  // Get status badge variant
  const getStatusBadge = (order: WorkOrder) => {
    const s = order.status.toLowerCase();
    if (s === "pending") return <Badge variant="outline">Pending</Badge>;
    if (s === "in progress" || s === "accepted") return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
    if (s === "pending approval") return <Badge className="bg-orange-100 text-orange-800">Pending Approval</Badge>;
    if (s === "approved" || s === "completed" || s === "delivered") {
      return (
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-800">Finalized</Badge>
          {order.is_reopened && (
            <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-50 animate-pulse text-[10px]">
              <RefreshCw className="h-2 w-2 mr-1" /> Reopened
            </Badge>
          )}
        </div>
      );
    }
    if (s === "rejected" || s === "cancelled") return <Badge variant="destructive">{order.status}</Badge>;
    return <Badge variant="secondary">{order.status}</Badge>;
  };

  // List View
  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col lg:flex-row">
        <AdminSidebar />
        <main className="flex-1 p-4 lg:p-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold">Work Orders</h1>
              <p className="text-muted-foreground">Manage service work orders and approvals</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={fetchWorkOrders} title="Refresh List">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button onClick={() => setSearchParams({ create: 'true' })}><Plus className="h-4 w-4 mr-2" />Create Work Order</Button>
            </div>
          </div>

          {/* Clean Modern Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card
              className="bg-card border-border/70 shadow-sm hover:border-blue-500/40 transition-all cursor-pointer"
              onClick={() => setActiveTab("in_progress")}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">In Progress</p>
                  <p className="text-2xl font-extrabold text-foreground mt-1">{stats.inProgress}</p>
                  <p className="text-[11px] text-blue-600 font-medium mt-0.5">{stats.pending} awaiting triage</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                  <Wrench className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card
              className="bg-card border-border/70 shadow-sm hover:border-emerald-500/40 transition-all cursor-pointer"
              onClick={() => setActiveTab("ready")}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ready for Pickup</p>
                  <p className="text-2xl font-extrabold text-foreground mt-1">{stats.ready}</p>
                  <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Ready for billing</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                  <Truck className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card
              className="bg-card border-border/70 shadow-sm hover:border-amber-500/40 transition-all cursor-pointer"
              onClick={() => navigate("/admin/requests?tab=work-approvals")}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Needs Approval</p>
                  <p className="text-2xl font-extrabold text-foreground mt-1">{stats.pendingApproval}</p>
                  <p className="text-[11px] text-amber-600 font-medium mt-0.5">Pending review</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card
              className="bg-card border-border/70 shadow-sm hover:border-purple-500/40 transition-all cursor-pointer"
              onClick={() => setActiveTab("completed")}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completed</p>
                  <p className="text-2xl font-extrabold text-foreground mt-1">{stats.completed}</p>
                  <p className="text-[11px] text-purple-600 font-medium mt-0.5">{stats.all} total jobs</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>


          {urgentAppointments > 0 && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-red-800">Urgent: {urgentAppointments} Confirmed Appointment(s) Awaiting Job Card</h3>
                  <p className="text-sm text-red-600">These vehicles have arrived or are arriving today. Please open job cards immediately.</p>
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="font-bold"
                onClick={() => {
                  const el = document.getElementById('scheduled-arrivals');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                View Arrivals
              </Button>
            </div>
          )}

          {showForm && (
            <div className="mb-8 p-6 bg-card rounded-xl border-2 border-primary/20 shadow-xl animate-in slide-in-from-top-4 duration-300">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  {selectedAppointment ? 'Convert Appointment to Work Order' : 'Create New Work Order'}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => { setSearchParams({}); setSelectedAppointment(null); }}>
                  <XCircle className="h-4 w-4 mr-2" /> Cancel
                </Button>
              </div>
              <WorkOrderForm
                onSuccess={handleFormSuccess}
                onCancel={() => { setSearchParams({}); setSelectedAppointment(null); }}
                initialData={selectedAppointment ? {
                  customerId: selectedAppointment.customer?.id || selectedAppointment.customer_id,
                  vehicleId: selectedAppointment.vehicle?.id || selectedAppointment.vehicle_id,
                  description: selectedAppointment.notes,
                  serviceTypeNames: selectedAppointment.services?.map((s: any) => s.service_name) || [],
                  requestedServices: selectedAppointment.services?.map((s: any) => s.service_name) || []
                } : undefined}
              />
            </div>
          )}


          {/* Scheduled Appointments Section */}
          {scheduledJobs.length > 0 && (
            <div id="scheduled-arrivals" className="mb-8 space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2 text-primary">
                <Clock className="h-5 w-5" />
                Next Scheduled Arrivals (Appointments)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scheduledJobs.map(job => {
                  const isUrgent = isToday(new Date(job.scheduled_at)) || isPast(new Date(job.scheduled_at));
                  return (
                    <Card key={job.id} className={cn(
                      "border-primary/20 hover:shadow-md transition-shadow border-l-4 pb-2",
                      isUrgent ? "bg-red-50/50 border-l-red-500 shadow-sm" : "bg-primary/5 border-l-primary"
                    )}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <Badge className={isUrgent ? "bg-red-600 text-white" : "bg-primary text-white"}>
                            {isUrgent ? 'URGENT ARRIVAL' : 'Confirmed'}
                          </Badge>
                          <span className="text-xs font-bold text-primary flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(job.scheduled_at), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        <h4 className="font-bold text-lg">{job.vehicle?.vehicle_number || "N/A"}</h4>
                        <div className="mb-3">
                          <p className="text-sm font-semibold text-foreground">{job.customer?.name || "Unknown Customer"}</p>
                          {job.customer?.company_name && (
                            <p className="text-xs text-primary font-bold">{job.customer.company_name}</p>
                          )}
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button size="sm" className="h-8 bg-primary hover:bg-primary/90 text-white font-bold" onClick={() => handleOpenJobCard(job)}>
                            CREATE JOB CARD NOW
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => navigate('/admin/appointments')}>
                            Process in Appointments <ArrowLeft className="h-3 w-3 ml-1 rotate-180" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <Separator className="mt-6" />
            </div>
          )}

          <div className="mb-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
              <div className="relative max-w-md flex-1 w-full">
                <SearchInput
                  placeholder="Search work orders..."
                  value={searchTerm}
                  onChange={setSearchTerm}
                  suggestions={suggestions}
                />
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={sortConfig.key}
                  onValueChange={(value) => setSortConfig(prev => ({ ...prev, key: value }))}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="delivery">Delivery Date</SelectItem>
                    <SelectItem value="progress">Progress Stage</SelectItem>
                    <SelectItem value="created_at">Created Date</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))}
                  title={sortConfig.direction === 'asc' ? "Ascending" : "Descending"}
                >
                  {sortConfig.direction === 'asc' ? <ArrowLeft className="h-4 w-4 rotate-90" /> : <ArrowLeft className="h-4 w-4 -rotate-90" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Segmented Status Views */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <TabsList className="bg-muted/70 p-1 rounded-xl h-auto flex flex-nowrap overflow-x-auto no-scrollbar max-w-full">
                <TabsTrigger value="in_progress" className="rounded-lg text-xs font-semibold px-3 py-1.5 shrink-0 whitespace-nowrap">
                  In Progress
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 min-w-[20px] text-[10px]">
                    {stats.inProgress}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="ready" className="rounded-lg text-xs font-semibold px-3 py-1.5 shrink-0 whitespace-nowrap">
                  Ready for Pickup
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 min-w-[20px] text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {stats.ready}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="completed" className="rounded-lg text-xs font-semibold px-3 py-1.5 shrink-0 whitespace-nowrap">
                  Completed
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 min-w-[20px] text-[10px]">
                    {stats.completed}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="all" className="rounded-lg text-xs font-semibold px-3 py-1.5 shrink-0 whitespace-nowrap">
                  All Orders
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 min-w-[20px] text-[10px]">
                    {stats.all}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              {/* Delivery Filter Pills */}
              <div className="flex gap-1.5 flex-nowrap overflow-x-auto no-scrollbar max-w-full pb-1 sm:pb-0">
                <Button
                  variant={deliveryFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDeliveryFilter('all')}
                  className="text-xs h-8 px-2.5 rounded-lg shrink-0 whitespace-nowrap"
                >
                  All Dates
                </Button>
                <Button
                  variant={deliveryFilter === 'overdue' ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => setDeliveryFilter('overdue')}
                  className="text-xs h-8 px-2.5 rounded-lg gap-1 shrink-0 whitespace-nowrap"
                >
                  <AlertTriangle className="h-3 w-3" />
                  Overdue
                </Button>
                <Button
                  variant={deliveryFilter === 'today' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDeliveryFilter('today')}
                  className={deliveryFilter === 'today' ? 'bg-orange-600 hover:bg-orange-700 text-xs h-8 px-2.5 rounded-lg shrink-0 whitespace-nowrap' : 'text-xs h-8 px-2.5 rounded-lg shrink-0 whitespace-nowrap'}
                >
                  <Clock5 className="h-3 w-3 mr-1" />
                  Due Today
                </Button>
              </div>
            </div>
          </Tabs>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <div className="flex flex-col gap-1">
                <CardTitle>Work Orders ({filteredOrders.length})</CardTitle>
                <CardDescription>
                  {activeTab === 'active' ? 'Manage ongoing service requests' : 'View past service history'}
                </CardDescription>
              </div>
              {urlFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-primary"
                  onClick={() => navigate('/admin/work-orders')}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Clear Filter: {urlFilter}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No work orders found</div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((order) => {
                    const deliveryInfo = getDeliveryStatus(order.estimated_delivery_date, currentTime);
                    const isOverdueOrUrgent = deliveryInfo.status === 'overdue' || deliveryInfo.status === 'urgent';
                    const isFinalized = ['completed', 'approved', 'delivered', 'finalized'].includes(order.status.toLowerCase());

                    // Determine background color based on status
                    let bgClass = '';
                    if (isFinalized) {
                      bgClass = 'bg-green-50/50 border-green-200';
                    } else if (isOverdueOrUrgent) {
                      bgClass = 'border-red-300 bg-red-50/30';
                    }

                    return (
                      <div
                        key={order.id}
                        className={`border p-4 rounded-lg hover:bg-muted/50 transition-colors ${bgClass}`}
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start">
                          <div className="cursor-pointer flex-1 w-full" onClick={() => navigate(`/admin/work-orders/${order.id}`)}>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-semibold text-lg">{order.service_type}</h3>
                              <Badge variant="outline" className="text-xs font-normal">#{order.id.slice(0, 6)}</Badge>
                              {getStatusBadge(order)}
                              {!['completed', 'approved', 'delivered'].includes(order.status.toLowerCase()) && deliveryInfo.status === 'overdue' && (
                                <Badge className="bg-red-600 text-white text-xs animate-pulse">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  OVERDUE
                                </Badge>
                              )}
                              {!['completed', 'approved', 'delivered'].includes(order.status.toLowerCase()) && deliveryInfo.status === 'urgent' && (
                                <Badge className="bg-red-600 text-white text-xs">
                                  <Clock5 className="h-3 w-3 mr-1" />
                                  URGENT
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-foreground mb-1">{order.description}</p>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2 flex-wrap">
                              <span>
                                <User className="h-3 w-3 inline mr-1" /> {order.customer?.name}
                                {order.customer?.company_name && (
                                  <span className="font-medium text-foreground ml-1">• {order.customer.company_name}</span>
                                )}
                              </span>
                              <span>
                                <Truck className="h-3 w-3 inline mr-1" /> {order.vehicle?.vehicle_number}
                              </span>
                              {(order as any).driver && (
                                <span className="flex items-center gap-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                  <span className="font-medium text-foreground">{(order as any).driver.name}</span>
                                  {(order as any).driver.driver_position && (
                                    <span className="text-xs">({(order as any).driver.driver_position})</span>
                                  )}
                                </span>
                              )}
                              {!['completed', 'approved', 'delivered'].includes(order.status.toLowerCase()) && order.estimated_delivery_date && (
                                <span className={`flex items-center gap-1 font-semibold ${deliveryInfo.color}`}>
                                  <Clock5 className="h-3 w-3" />
                                  {deliveryInfo.formatted}
                                </span>
                              )}
                            </div>
                            <div className="mt-3 max-w-sm">
                              <CompactProgressTracker
                                currentStage={order.current_stage}
                                status={order.status}
                              />
                            </div>
                          </div>
                          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 mt-4 sm:mt-0 w-full sm:w-auto ml-0 sm:ml-4 border-t sm:border-t-0 pt-3 sm:pt-0 flex-wrap sm:flex-nowrap">
                            <div className="flex items-center gap-2">
                              <Badge variant={order.priority === "Urgent" ? "destructive" : "secondary"}>{order.priority}</Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {order.status === 'Pending' && (
                                    <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'In Progress')}>
                                      <Play className="h-4 w-4 mr-2" /> Accept Order
                                    </DropdownMenuItem>
                                  )}
                                  {order.status === 'Pending Approval' && (
                                    <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'Approved')}>
                                      <CheckCircle className="h-4 w-4 mr-2" /> Approve Work
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => handleAdvanceStageFromList(order.id, order.current_stage)}>
                                    <RefreshCw className="h-4 w-4 mr-2" /> Advance Stage
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => navigate(`/admin/work-orders/${order.id}`)}>
                                    <ClipboardCheck className="h-4 w-4 mr-2" /> Full Details
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="flex gap-2 mt-0 sm:mt-2">
                              {['ready', 'ready for delivery', 'completed', 'delivered', 'approved', 'finalized'].includes(order.status.toLowerCase()) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs font-semibold border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                  onClick={() => navigate(`/admin/invoices?workOrderId=${order.id}`)}
                                  title="1-Click Create / View Invoice"
                                >
                                  <Receipt className="h-3.5 w-3.5 mr-1" /> Invoice
                                </Button>
                              )}
                              <Button size="sm" variant="outline" onClick={() => navigate(`/admin/work-orders/${order.id}`)}>
                                <Eye className="h-4 w-4 mr-1" /> View Details
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive/90 hover:bg-destructive/10">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Work Order?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete work order <strong>#{order.id.slice(0, 8)}</strong>.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(order.id)} className="bg-destructive hover:bg-destructive/90">
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                            {["approved", "completed", "delivered"].includes(order.status.toLowerCase()) && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="w-full mt-0 sm:mt-1 bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200"
                                onClick={() => {
                                  setReopenOrderId(order.id);
                                  setReopenDialogOpen(true);
                                }}
                              >
                                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reopen Work Order
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reopen Dialog */}
          < Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen} >
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-orange-500" />
                  Reopen Work Order
                </DialogTitle>
                <DialogDescription>
                  This will set the work order status back to "In Progress" and notify staff.
                  Please state the reason for reopening.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <label htmlFor="reopen-reason" className="text-sm font-medium">Reason for Reopening</label>
                  <Textarea
                    id="reopen-reason"
                    placeholder="e.g., Customer requested additional work, or correction needed..."
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReopenDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleReopenWorkOrder}
                  disabled={!reopenReason.trim()}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Reopen Work Order
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Enhanced Reopen Configuration Form */}
          <Dialog open={showReopenConfig} onOpenChange={setShowReopenConfig}>
            <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto p-0">
              <div className="p-6">
                {reopenOrderId && (
                  <WorkOrderForm
                    initialWorkOrderId={reopenOrderId}
                    isReopening={true}
                    reopenReason={reopenReason}
                    onSuccess={() => {
                      setShowReopenConfig(false);
                      setReopenOrderId(null);
                      setReopenReason("");
                      fetchWorkOrders();
                    }}
                    onCancel={() => setShowReopenConfig(false)}
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}
