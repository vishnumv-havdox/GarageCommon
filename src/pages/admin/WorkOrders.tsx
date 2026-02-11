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
  LogOut, Users, Shield, Plus, Search, ClipboardList,
  Trash2, Eye, ArrowLeft, Calendar, FileText, Wrench, IndianRupee,
  CheckCircle2, XCircle, Clock, User, Truck, RefreshCw, AlertTriangle,
  BarChart3, Activity, MoreVertical, Play, CheckCircle,
  ClipboardCheck, Clock5
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
import { format } from "date-fns";

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

  // State
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'overdue' | 'today' | 'week' | 'none' | 'completed'>('all');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [searchParams] = useSearchParams();
  const urlFilter = searchParams.get('filter');

  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    inProgress: 0,
    pendingApproval: 0,
    completed: 0
  });

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

      // Calculate stats
      const pending = mapped.filter((o: WorkOrder) => o.status === "Pending").length;
      const inProgress = mapped.filter((o: WorkOrder) =>
        o.status === "In Progress" || o.status === "Accepted"
      ).length;
      const pendingApproval = mapped.filter((o: WorkOrder) => o.status === "Pending Approval").length;
      const completed = mapped.filter((o: WorkOrder) =>
        o.status === "Approved" || o.status === "Completed"
      ).length;
      setStats({ pending, inProgress, pendingApproval, completed });
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
    setShowForm(false);
    fetchWorkOrders();
    toast({ title: "Success", description: "Work order created successfully" });
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

    // Sort by delivery date (earliest first)
    return filtered.sort((a, b) => {
      if (!a.estimated_delivery_date && !b.estimated_delivery_date) return 0;
      if (!a.estimated_delivery_date) return 1;
      if (!b.estimated_delivery_date) return -1;
      return new Date(a.estimated_delivery_date).getTime() - new Date(b.estimated_delivery_date).getTime();
    });
  }, [workOrders, searchTerm, deliveryFilter, currentTime]);

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
              <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" />Create Work Order</Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold">{stats.pending}</p>
                  </div>
                  <Clock className="h-8 w-8 text-muted-foreground/30" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">In Progress</p>
                    <p className="text-2xl font-bold">{stats.inProgress}</p>
                  </div>
                  <RefreshCw className="h-8 w-8 text-blue-500/30" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Approval</p>
                    <p className="text-2xl font-bold">{stats.pendingApproval}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-500/30" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Finalized</p>
                    <p className="text-2xl font-bold">{stats.completed}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-500/30" />
                </div>
              </CardContent>
            </Card>
          </div>

          {showForm && <div className="mb-8"><WorkOrderForm onSuccess={handleFormSuccess} onCancel={() => setShowForm(false)} /></div>}

          <div className="mb-6 space-y-4">
            <div className="relative max-w-md flex-1">
              <SearchInput
                placeholder="Search work orders by type, vehicle, or customer..."
                value={searchTerm}
                onChange={setSearchTerm}
                suggestions={suggestions}
              />
            </div>

            {/* Delivery Filter Tabs */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={deliveryFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDeliveryFilter('all')}
                className="text-xs"
              >
                All Orders
              </Button>
              <Button
                variant={deliveryFilter === 'overdue' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDeliveryFilter('overdue')}
                className={deliveryFilter === 'overdue' ? 'bg-red-600 hover:bg-red-700' : 'text-xs'}
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                Overdue
              </Button>
              <Button
                variant={deliveryFilter === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDeliveryFilter('completed')}
                className={deliveryFilter === 'completed' ? 'bg-green-600 hover:bg-green-700' : 'text-xs'}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Completed
              </Button>
              <Button
                variant={deliveryFilter === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDeliveryFilter('today')}
                className={deliveryFilter === 'today' ? 'bg-orange-600 hover:bg-orange-700' : 'text-xs'}
              >
                <Clock5 className="h-3 w-3 mr-1" />
                Due Today
              </Button>
              <Button
                variant={deliveryFilter === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDeliveryFilter('week')}
                className="text-xs"
              >
                <Calendar className="h-3 w-3 mr-1" />
                Due This Week
              </Button>
              <Button
                variant={deliveryFilter === 'none' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDeliveryFilter('none')}
                className="text-xs"
              >
                No Date Set
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Work Orders ({filteredOrders.length})</CardTitle>
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
          <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
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
