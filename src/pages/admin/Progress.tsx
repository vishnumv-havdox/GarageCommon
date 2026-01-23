import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LogOut, Users, Shield, Search, ClipboardList,
  Clock, CheckCircle2, Wrench, Truck, AlertTriangle,
  TrendingUp, Activity, BarChart3, RefreshCw, Eye, ExternalLink, MoreVertical,
  Play, CheckCircle, ClipboardCheck, User
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavLink, useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface WorkOrderProgress {
  id: string;
  service_type: string;
  description: string;
  status: string;
  priority: string;
  current_stage: string | null;
  created_at: string;
  updated_at: string;
  vehicle_number: string | null;
  vehicle_model: string | null;
  customer_name: string | null;
  stages: Array<{
    id: string;
    stage: string;
    status: string;
  }>;
  services?: Array<{
    id: string;
    service_type: string;
    employees: Array<{
      id: string;
      employee_id: string;
      status: string;
      employee: { name: string; position?: { department?: string } } | null;
    }>;
  }>;
}

export default function AdminProgress() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState<WorkOrderProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [realtimeData, setRealtimeData] = useState<any>(null);

  const fetchWorkOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("work_orders")
        .select(`
          *,
          vehicle:vehicles(vehicle_number, model, customers(name)),
          stages:work_order_stages(id, stage, status, started_at, completed_at),
          services:work_order_services(
            id, 
            service_type,
            employees:work_order_service_employees(
              id, 
              employee_id, 
              status,
              employee:employees(id, name, position:positions(id, name, department))
            )
          )
        `)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const processed: WorkOrderProgress[] = (data || []).map((wo: any) => ({
        id: wo.id,
        service_type: wo.service_type,
        description: wo.description,
        status: wo.status,
        priority: wo.priority,
        current_stage: wo.current_stage,
        created_at: wo.created_at,
        updated_at: wo.updated_at,
        vehicle_number: wo.vehicle?.vehicle_number,
        vehicle_model: wo.vehicle?.model,
        customer_name: wo.vehicle?.customers?.name,
        stages: wo.stages || [],
        services: wo.services || []
      }));

      setWorkOrders(processed);
    } catch (error: any) {
      console.error("Fetch error:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch progress data" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchRealtimeData = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_realtime_status_indicators');
      if (error) throw error;
      setRealtimeData(data);
    } catch (error: any) {
      console.error("Realtime fetch error:", error);
    }
  }, []);

  useEffect(() => {
    fetchWorkOrders();
    fetchRealtimeData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchRealtimeData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchWorkOrders, fetchRealtimeData]);

  const calculateProgress = (stages: any[]) => {
    const completed = stages.filter(s => s.status === 'completed').length;
    return stages.length > 0 ? (completed / stages.length) * 100 : 0;
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "pending") return <Badge variant="outline">Pending</Badge>;
    if (s === "in progress" || s === "accepted") return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
    if (s === "pending approval") return <Badge className="bg-orange-100 text-orange-800">Pending Approval</Badge>;
    if (s === "approved" || s === "completed" || s === "delivered") return <Badge className="bg-green-100 text-green-800">Finalized</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const p = priority.toLowerCase();
    if (p === "urgent") return <Badge variant="destructive">Urgent</Badge>;
    if (p === "high") return <Badge className="bg-red-100 text-red-800">High</Badge>;
    if (p === "medium") return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
    return <Badge variant="outline">Low</Badge>;
  };

  const getEmployeeCount = (workOrder: WorkOrderProgress) => {
    let count = 0;
    workOrder.services?.forEach(service => {
      count += service.employees?.length || 0;
    });
    return count;
  };

  const getDepartmentNames = (workOrder: WorkOrderProgress) => {
    const departments = new Set<string>();
    workOrder.services?.forEach(service => {
      service.employees?.forEach(emp => {
        if (emp.employee?.position?.department) {
          departments.add(emp.employee.position.department);
        }
      });
    });
    return Array.from(departments).join(", ") || "Unassigned";
  };

  const formatLastActivity = (updatedAt: string) => {
    try {
      return formatDistanceToNow(new Date(updatedAt), { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  const filteredOrders = workOrders.filter(wo => {
    const matchesSearch =
      wo.service_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.vehicle_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.id.includes(searchTerm);
    const matchesStatus = statusFilter === "all" || wo.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || wo.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const stats = {
    active: workOrders.filter(wo => wo.status !== 'Completed' && wo.status !== 'Delivered').length,
    pendingApproval: workOrders.filter(wo => wo.status === 'Pending Approval').length,
    urgent: workOrders.filter(wo => wo.priority === 'Urgent' && wo.status !== 'Completed').length,
    overdue: workOrders.filter(wo => {
      const daysSinceCreated = (Date.now() - new Date(wo.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCreated > 7 && wo.status !== 'Completed' && wo.status !== 'Delivered';
    }).length,
  };

  const realtimeStageCounts = realtimeData?.stage_counts || {};

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        <aside className="w-64 min-h-screen bg-card border-r flex flex-col hidden lg:flex">
          <div className="p-4 border-b">
            <NavLink to="/admin" className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><Shield className="h-6 w-6 text-primary" /></div>
              <div><h1 className="font-bold">AMMA AUTO</h1><p className="text-xs text-muted-foreground">Admin Panel</p></div>
            </NavLink>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            <NavLink to="/admin" end className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}><Users className="h-5 w-5" />Dashboard</NavLink>
            <NavLink to="/admin/work-orders" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}><ClipboardList className="h-5 w-5" />Work Orders</NavLink>
            <NavLink to="/admin/analytics" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}><BarChart3 className="h-5 w-5" />Performance</NavLink>
            <NavLink to="/admin/progress" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}><Activity className="h-5 w-5" />Progress</NavLink>
          </nav>
          <div className="p-4 border-t">
            <div className="flex items-center gap-3 mb-3"><Badge variant="default">Admin</Badge><span className="text-sm truncate">{user?.full_name || user?.email}</span></div>
            <Button onClick={signOut} variant="outline" className="w-full" size="sm"><LogOut className="h-4 w-4 mr-2" />Logout</Button>
          </div>
        </aside>

        <main className="flex-1 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Activity className="h-8 w-8 text-primary" />
                Operational Monitoring
              </h1>
              <p className="text-muted-foreground mt-1">Real-time status overview of all workshop operations</p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={fetchRealtimeData} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Live Refresh
              </Button>
              <Button asChild variant="default">
                <NavLink to="/admin/analytics">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Company Performance
                </NavLink>
              </Button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <Card className="bg-blue-50/50 border-blue-100">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Active Work Orders</p>
                    <p className="text-3xl font-bold text-blue-900">{stats.active}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full"><Activity className="h-6 w-6 text-blue-600" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-orange-50/50 border-orange-100">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600">Pending Approvals</p>
                    <p className="text-3xl font-bold text-orange-900">{stats.pendingApproval}</p>
                  </div>
                  <div className="p-3 bg-orange-100 rounded-full"><Clock className="h-6 w-6 text-orange-600" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-red-50/50 border-red-100">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-600">Urgent Priorities</p>
                    <p className="text-3xl font-bold text-red-900">{stats.urgent}</p>
                  </div>
                  <div className="p-3 bg-red-100 rounded-full"><AlertTriangle className="h-6 w-6 text-red-600" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-purple-50/50 border-purple-100">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">Overdue Jobs</p>
                    <p className="text-3xl font-bold text-purple-900">{stats.overdue}</p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-full"><TrendingUp className="h-6 w-6 text-purple-600" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-50/50 border-green-100">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">Total Orders</p>
                    <p className="text-3xl font-bold text-green-900">{workOrders.length}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full"><ClipboardList className="h-6 w-6 text-green-600" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Real-Time Stage Distribution */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Live Stage Distribution</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {['Inspection', 'Repair', 'Review', 'Quality Check', 'Delivery'].map((stage) => {
                const count = realtimeStageCounts[stage] || 0;
                const isActive = count > 0;
                return (
                  <div 
                    key={stage}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isActive 
                        ? 'bg-primary/5 border-primary/30' 
                        : 'bg-muted/30 border-muted'
                    }`}
                  >
                    <p className="text-sm text-muted-foreground">{stage}</p>
                    <p className={`text-2xl font-bold ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                      {count}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Work Flow Monitoring</CardTitle>
                  <p className="text-sm text-muted-foreground">Detailed status tracking across all service stages. Click a row to view details.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search orders..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none pr-8 relative bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Pending Approval">Needs Review</option>
                    <option value="Completed">Completed</option>
                  </select>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none pr-8 relative bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                  >
                    <option value="all">All Priority</option>
                    <option value="Urgent">Urgent</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Work Order</TableHead>
                    <TableHead>Customer & Vehicle</TableHead>
                    <TableHead>Service Type(s)</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Current Stage</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8">Loading monitoring data...</TableCell></TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No active work orders found.</TableCell></TableRow>
                  ) : (
                    filteredOrders.map((wo) => {
                      const progress = calculateProgress(wo.stages);
                      return (
                        <TableRow 
                          key={wo.id} 
                          className="group hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/admin/work-orders/${wo.id}`)}
                        >
                          <TableCell>
                            <div className="font-medium">{wo.service_type}</div>
                            <div className="text-xs text-muted-foreground font-mono">#{wo.id.slice(0, 8)}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{wo.customer_name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Truck className="h-3 w-3" /> {wo.vehicle_number} • {wo.vehicle_model}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="outline" className="text-xs">
                                {wo.service_type}
                              </Badge>
                              {wo.services && wo.services.length > 1 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{wo.services.length - 1}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {getDepartmentNames(wo) || "Unassigned"}
                            </span>
                          </TableCell>
                          <TableCell>{getStatusBadge(wo.status)}</TableCell>
                          <TableCell>{getPriorityBadge(wo.priority)}</TableCell>
                          <TableCell className="w-[140px]">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-medium">
                                <span>{Math.round(progress)}%</span>
                                <span className="text-muted-foreground">{wo.stages.filter(s => s.status === 'completed').length}/5</span>
                              </div>
                              <Progress value={progress} className="h-1.5" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-normal border-primary/20 bg-primary/5">
                              {wo.current_stage || 'Not Started'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{getEmployeeCount(wo)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {formatLastActivity(wo.updated_at)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

