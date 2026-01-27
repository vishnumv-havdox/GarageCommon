import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { NavLink, useNavigate } from "react-router-dom";
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
  customer?: { name: string; phone?: string };
  created_at: string;
  notes?: string;
  estimated_cost?: number;
  accepted_at?: string | null;
  completed_at?: string | null;
  approved_at?: string | null;
  current_stage?: string | null;
}

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

  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    inProgress: 0,
    pendingApproval: 0,
    completed: 0
  });

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
            customers(name, phone)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map(d => {
        const doc = d as any;
        return {
          ...doc,
          customer: doc.vehicle?.customers
            ? doc.vehicle.customers
            : { name: "Unknown", phone: "" }
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
      const { error } = await supabase
        .from("work_orders")
        .update({ status } as any)
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

  const handleFormSuccess = () => {
    setShowForm(false);
    fetchWorkOrders();
    toast({ title: "Success", description: "Work order created successfully" });
  };

  const filteredOrders = workOrders.filter((o) =>
    o.service_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.vehicle?.vehicle_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.id.includes(searchTerm)
  );

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "pending") return <Badge variant="outline">Pending</Badge>;
    if (s === "in progress" || s === "accepted") return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
    if (s === "pending approval") return <Badge className="bg-orange-100 text-orange-800">Pending Approval</Badge>;
    if (s === "approved" || s === "completed" || s === "delivered") return <Badge className="bg-green-100 text-green-800">Finalized</Badge>;
    if (s === "rejected" || s === "cancelled") return <Badge variant="destructive">{status}</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
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
          <div className="grid grid-cols-4 gap-4 mb-6">
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

          <div className="mb-6 flex gap-4">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search work orders..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Work Orders ({filteredOrders.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No work orders found</div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((order) => (
                    <div key={order.id} className="border p-4 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="cursor-pointer flex-1" onClick={() => navigate(`/admin/work-orders/${order.id}`)}>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-lg">{order.service_type}</h3>
                            <Badge variant="outline" className="text-xs font-normal">#{order.id.slice(0, 6)}</Badge>
                            {getStatusBadge(order.status)}
                          </div>
                          <p className="text-sm text-foreground mb-1">{order.description}</p>
                          <p className="text-sm text-muted-foreground">
                            <User className="h-3 w-3 inline mr-1" /> {order.customer?.name} •
                            <Truck className="h-3 w-3 inline ml-2 mr-1" /> {order.vehicle?.vehicle_number}
                          </p>
                          <div className="mt-3 max-w-sm">
                            <CompactProgressTracker
                              currentStage={order.current_stage}
                              status={order.status}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 ml-4">
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
                          <div className="flex gap-2 mt-2">
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
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

