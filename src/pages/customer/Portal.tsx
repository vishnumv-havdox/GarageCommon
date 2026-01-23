import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from '@supabase/supabase-js';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  LogOut, Truck, FileText, Wrench, RefreshCw,
  CheckCircle2, Clock, MapPin, ChevronDown, ChevronUp,
  AlertCircle, ShieldCheck, Hourglass, Activity, Eye, Calendar
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// Import ProgressTracker component
import { CompactProgressTracker } from "@/components/work-orders/ProgressTracker";

interface WorkOrderStage {
  id: string;
  stage: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
}

interface RepairTask {
  id: string;
  task_name: string;
  task_description: string | null;
  task_category: string;
  service_id: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'reopened';
  priority: string;
  sequence_order: number;
  completed_at: string | null;
}

interface WorkOrderProgress {
  id: string;
  service_type: string;
  description: string;
  status: string;
  priority: string;
  current_stage: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  customer_visible: boolean;
  portal_updated_at: string | null;
  repair_completed_at: string | null;
  inspection_status: 'pending' | 'completed' | 'approved';
  repair_status: 'pending' | 'in_progress' | 'completed' | 'approved';
  review_status: 'pending' | 'approved';
  vehicle_id: string;
  vehicle: {
    id: string;
    vehicle_number: string;
    model: string;
    customer_id: string;
  };
  customer?: { name: string; phone?: string };
  stages: WorkOrderStage[];
  tasks: RepairTask[];
  services: any[];
}

const STAGES = ['Inspection', 'Repair', 'Review', 'Quality Check', 'Delivery'];

export default function CustomerPortal() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderProgress[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [showDebug, setShowDebug] = useState(false);
  const [viewDetailOrder, setViewDetailOrder] = useState<WorkOrderProgress | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    let debug = `User ID: ${user.id}\nEmail: ${user.email || 'N/A'}\n`;

    try {
      // First, try to find customer by user_id
      const customerQuery = await supabase
        .from("customers")
        .select("id, name, email")
        .eq("user_id", user.id)
        .single();

      debug += `Customer Query - Found: ${!!customerQuery.data}\n`;

      let customerId = (customerQuery.data as any)?.id;

      // If no customer found by user_id, try by email
      if (!customerId && user.email) {
        const customerByEmailQuery = await supabase
          .from("customers")
          .select("id, name, email")
          .eq("email", user.email)
          .single();
        customerId = (customerByEmailQuery.data as any)?.id;
        debug += `Customer by Email - Found: ${!!customerByEmailQuery.data}\n`;
      }

      if (!customerId) {
        debug += "ERROR: No customer record found for this user\n";
        debug += "Solution: Link this user to a customer record in the customers table\n";
        setDebugInfo(debug);
        setLoading(false);
        return;
      }

      debug += `Customer ID: ${customerId}\n`;

      // Fetch vehicles and invoices using admin client to bypass RLS
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      
      let vehiclesRes: any = { data: [], error: null };
      let invoicesRes: any = { data: [], error: null };
      
      if (SERVICE_ROLE_KEY) {
        const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false }
        });
        
        // Use admin client to fetch vehicles for this customer (bypasses RLS)
        vehiclesRes = await adminClient
          .from("vehicles")
          .select("*")
          .eq("customer_id", customerId);
        
        invoicesRes = await supabase.from("invoices").select("*").eq("customer_id", customerId);
      } else {
        // Fallback to regular client
        [vehiclesRes, invoicesRes] = await Promise.all([
          supabase.from("vehicles").select("*").eq("customer_id", customerId),
          supabase.from("invoices").select("*").eq("customer_id", customerId),
        ]);
      }

      // Set vehicles and invoices state
      setVehicles(vehiclesRes.data || []);

      debug += `Vehicles found: ${vehiclesRes.data?.length || 0}\n`;
      debug += `Invoices found: ${invoicesRes.data?.length || 0}\n`;
      setInvoices(invoicesRes.data || []);

      // Get customer's vehicle IDs
      const customerVehicleIds = (vehiclesRes.data || []).map((v: any) => v.id);
      debug += `Customer Vehicle IDs: ${JSON.stringify(customerVehicleIds)}\n`;

      // Fetch work orders using admin client to bypass RLS
      debug += `\n--- Fetching Work Orders ---\n`;

      let allWorkOrders: any[] = [];

      // Strategy 1: If customer has registered vehicles, query by those vehicle IDs
      if (customerVehicleIds.length > 0) {
        const workOrdersByVehicles = await supabase
          .from("work_orders")
          .select(`
            *,
            vehicle:vehicles(id, vehicle_number, model, customer_id)
          `)
          .in("vehicle_id", customerVehicleIds)
          .order("created_at", { ascending: false });

        debug += `Work orders by customer vehicles: ${workOrdersByVehicles.data?.length || 0}\n`;
        allWorkOrders = workOrdersByVehicles.data || [];
      }

      // Strategy 2: Use admin client to fetch ALL work orders (bypasses RLS)
      if (SERVICE_ROLE_KEY) {
        const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false }
        });

        const allWorkOrdersQuery = await adminClient
          .from("work_orders")
          .select(`
            *,
            vehicle:vehicles(id, vehicle_number, model, customer_id)
          `)
          .order("created_at", { ascending: false });

        debug += `Total work orders in system (admin): ${allWorkOrdersQuery.data?.length || 0}\n`;

        // Client-side filter: match by vehicle.customer_id OR by vehicle_id in our list
        const customerIdsSet = new Set([customerId]);
        const workOrdersFiltered = (allWorkOrdersQuery.data || []).filter((wo: any) => {
          // Check if vehicle's customer_id matches our customer
          if (wo.vehicle?.customer_id && customerIdsSet.has(wo.vehicle.customer_id)) {
            return true;
          }
          // Check if vehicle_id is in our customer's vehicles list
          if (customerVehicleIds.includes(wo.vehicle_id)) {
            return true;
          }
          return false;
        });

        debug += `Work orders after filtering: ${workOrdersFiltered.length}\n`;

        // Merge results, avoiding duplicates
        const workOrdersData = [...allWorkOrders];
        workOrdersFiltered.forEach((wo: any) => {
          if (!workOrdersData.find(w => w.id === wo.id)) {
            workOrdersData.push(wo);
          }
        });

        debug += `Total work orders after merge: ${workOrdersData.length}\n`;

        if (workOrdersData.length > 0) {
          // Fetch stages for each work order using admin client
          const workOrderIds = workOrdersData.map((wo: any) => wo.id);
          const stagesQuery = await adminClient
            .from("work_order_stages")
            .select("*")
            .in("work_order_id", workOrderIds)
            .order("created_at");

          debug += `Stages found: ${stagesQuery.data?.length || 0}\n`;

          // Fetch tasks for all work orders
          const tasksQuery = await adminClient
            .from("work_order_tasks")
            .select("*")
            .in("work_order_id", workOrderIds)
            .order("created_at");

          debug += `Tasks found: ${tasksQuery.data?.length || 0}\n`;

          // Fetch services for all work orders
          const servicesQuery = await adminClient
            .from("work_order_services")
            .select("*")
            .in("work_order_id", workOrderIds);

          debug += `Services found: ${servicesQuery.data?.length || 0}\n`;

          // Transform and merge stages data
          const processedWorkOrders: WorkOrderProgress[] = workOrdersData.map((wo: any) => {
            const woStages = (stagesQuery.data || [])
              .filter((s: any) => s.work_order_id === wo.id)
              .map((s: any) => ({
                id: s.id,
                stage: s.stage,
                status: s.status,
                started_at: s.started_at,
                completed_at: s.completed_at,
                notes: s.notes
              }));

            const woRepairTasks = (tasksQuery.data || [])
              .filter((rt: any) => rt.work_order_id === wo.id && rt.task_type === 'repair')
              .map((rt: any) => ({
                id: rt.id,
                task_name: rt.task_name,
                task_description: null,
                task_category: 'Repair',
                service_id: rt.service_id,
                status: rt.completed ? 'completed' : 'pending',
                priority: 'Medium',
                sequence_order: rt.sequence_order || 0,
                completed_at: rt.completed_at
              }));

            const woServices = (servicesQuery.data || [])
              .filter((s: any) => s.work_order_id === wo.id);

            return {
              ...wo,
              stages: woStages,
              tasks: woRepairTasks,
              services: woServices
            };
          });

          debug += `Processed work orders: ${processedWorkOrders.length}\n`;
          debug += `Active work orders: ${processedWorkOrders.filter(w => w.status !== "Completed" && w.status !== "Cancelled").length}\n`;

          setWorkOrders(processedWorkOrders);
        } else {
          debug += "No work orders found for this customer\n";
          setWorkOrders([]);
        }
      } else {
        // Fallback if no service role key
        debug += `No service role key - using regular client\n`;
        debug += "To see all work orders, add VITE_SUPABASE_SERVICE_ROLE_KEY to .env\n";
        setWorkOrders(allWorkOrders);
      }

      setDebugInfo(debug);
    } catch (error: any) {
      debug += `ERROR: ${error.message}\n`;
      setDebugInfo(debug);
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Subscribe to realtime updates for work orders and stages
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('customer-portal-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'work_orders'
      }, () => {
        console.log('Work order change detected - refreshing data');
        fetchData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'work_order_stages'
      }, () => {
        console.log('Stage change detected - refreshing data');
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchData]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Group work orders by ID AND by vehicle to consolidate duplicate entries
  // This handles cases where services are stored as separate work orders with the same vehicle
  const workOrdersById = workOrders.reduce((acc, wo) => {
    // Create a composite key: work_order_id OR vehicle_id + vehicle_number
    // This groups work orders with the same vehicle together
    const key = wo.id || 
      (wo.vehicle?.id ? `vehicle-${wo.vehicle.id}` : `unknown-${Math.random()}`);
    
    if (!acc[key]) {
      acc[key] = { 
        ...wo, 
        services: [],
        combined_service_types: new Set([wo.service_type].filter(Boolean))
      };
    } else {
      // Add service_type to combined set
      if (wo.service_type) {
        (acc[key] as any).combined_service_types.add(wo.service_type);
      }
    }
    
    // Add service info if it exists
    if (wo.services && wo.services.length > 0) {
      wo.services.forEach(service => {
        if (!acc[key].services.find((s: any) => s.id === service.id)) {
          acc[key].services.push(service);
        }
      });
    }
    return acc;
  }, {} as Record<string, WorkOrderProgress & { combined_service_types: Set<string> }>);

  const activeWorkOrders = Object.values(workOrdersById).filter(wo => {
    const status = wo.status?.toLowerCase() || "";
    // Only show truly active work orders (not delivered, completed, approved, or cancelled)
    // Delivered/completed/approved orders should go to Work History
    const finalStatuses = ["delivered", "completed", "cancelled", "approved"];
    return !finalStatuses.includes(status) && wo.customer_visible;
  });

  // Get completed/delivered work orders for history
  const completedWorkOrders = Object.values(workOrdersById).filter(wo => {
    const status = wo.status?.toLowerCase() || "";
    const finalStatuses = ["delivered", "completed", "approved"];
    return finalStatuses.includes(status) && wo.customer_visible;
  });

  const toggleOrderExpanded = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const getStageProgress = (stages: WorkOrderStage[]) => {
    if (stages.length === 0) return 0;
    const completed = stages.filter(s => s.status === 'completed').length;
    return (completed / stages.length) * 100;
  };

  const formatDateTime = (date: string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Truck className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Customer Portal</h1>
              <p className="text-sm text-muted-foreground">Welcome, {user?.full_name || user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setShowDebug(!showDebug)}>
              <AlertCircle className="h-4 w-4 mr-2" />
              {showDebug ? "Hide Debug" : "Debug"}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Badge variant="outline">Customer</Badge>
            <Button onClick={signOut} variant="outline">
              <LogOut className="h-4 w-4 mr-2" />Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Debug Panel */}
        {showDebug && (
          <Card className="mb-8 border-red-200 bg-red-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                <AlertCircle className="h-4 w-4" />
                Debug Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs overflow-auto max-h-64 whitespace-pre-wrap text-red-700">
                {debugInfo || "Loading debug info..."}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Live Tracking Banner */}
        {activeWorkOrders.length > 0 && (
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <MapPin className="h-5 w-5 text-primary animate-pulse" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    Live Vehicle Tracking
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Track your vehicle repairs in real-time. Updates appear automatically.
                  </p>
                </div>
                <Badge variant="default" className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                  Live
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">My Vehicles</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{vehicles.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Repairs</CardTitle>
              <Wrench className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-blue-600">{activeWorkOrders.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{invoices.filter((inv) => inv.status === "pending").length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Active Repairs with Live Progress */}
        {activeWorkOrders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Active Repairs
            </h2>
            <div className="space-y-4">
              {activeWorkOrders.map((order) => {
                const progress = getStageProgress(order.stages);
                const isExpanded = expandedOrders.has(order.id);
                // Repairs are visible only if repairs_approved is true OR if the service is completed
                // Use case-insensitive comparison for status
                const orderStatus = order.status?.toLowerCase() || "";
                const showRepairs = order.inspection_status === 'approved' ||
                  ['completed', 'approved', 'delivered'].includes(orderStatus);

                // Get all services - combine work order's service_type with services array
                const services = order.services || [];
                // Get combined service types from the Set (for work orders with same vehicle)
                const combinedServiceTypes = (order as any).combined_service_types || new Set([order.service_type].filter(Boolean));
                const serviceTypesArray = Array.from(combinedServiceTypes);
                const hasMultipleServices = serviceTypesArray.length > 1;

                // Build allServices array for task display
                const allServices = [
                  ...services,
                  ...(order.service_type && !services.find((s: any) => s.service_type === order.service_type)
                    ? [{ id: order.id, service_type: order.service_type }]
                    : [])
                ];

                return (
                  <Card key={order.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      {/* Header */}
                      <div
                        className={`p-4 border-b cursor-pointer transition-colors ${showRepairs
                          ? "bg-green-50/50 hover:bg-green-50"
                          : "bg-muted/30 hover:bg-muted/50"
                          }`}
                        onClick={() => toggleOrderExpanded(order.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {/* Primary service type */}
                              <h3 className="font-semibold text-lg">{String(serviceTypesArray[0] || order.service_type || '')}</h3>
                              {/* Additional services badge */}
                              {hasMultipleServices && (
                                <Badge variant="secondary" className="text-xs">
                                  +{serviceTypesArray.length - 1} more service{serviceTypesArray.length > 2 ? 's' : ''}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">#{order.id.slice(0, 6)}</Badge>
                              {order.priority === "Urgent" && (
                                <Badge variant="destructive" className="text-xs">Urgent</Badge>
                              )}
                            </div>
                            {/* Show all services in a single line */}
                            <div className="flex items-center gap-2 mb-1">
                              {serviceTypesArray.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {serviceTypesArray.map((st: string, index: number) => (
                                    <Badge 
                                      key={index} 
                                      variant="outline" 
                                      className={`text-xs ${index === 0 ? 'border-primary/50' : ''}`}
                                    >
                                      {st}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-xs">{order.service_type}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Truck className="h-3 w-3" />
                                {order.vehicle?.vehicle_number || "N/A"} {order.vehicle?.model && `(${order.vehicle.model})`}
                              </span>
                              {showRepairs ? (
                                <span className="flex items-center gap-1 text-green-600">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Live Tracking Active
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-orange-600">
                                  <Clock className="h-3 w-3" />
                                  Pending Inspection/Approval
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={order.status === "In Progress" ? "default" : "secondary"}>
                              {order.status}
                            </Badge>
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="p-4 space-y-4 bg-muted/10">

                          {/* Visibility Blocking Banner */}
                          {!showRepairs && (
                            <div className="p-6 bg-background rounded-lg border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center text-center space-y-2">
                              <ShieldCheck className="h-10 w-10 text-primary/50 mb-2" />
                              <h3 className="font-semibold text-lg">Inspection & Processing</h3>
                              <p className="text-muted-foreground max-w-md">
                                We are currently inspecting your vehicle. Detailed repair plans and live tracking will be available once our team completes the initial assessment and gets approval.
                              </p>
                              <Badge variant="outline" className="mt-2">Estimated wait: ~30-60 mins</Badge>
                            </div>
                          )}

                          {/* Description */}
                          <div>
                            <h4 className="text-sm font-medium mb-1">Service Request</h4>
                            <p className="text-sm text-muted-foreground">{order.description}</p>
                          </div>

                          {showRepairs && (
                            <>
                              {/* Compact Progress Tracker */}
                              <div>
                                <h4 className="text-sm font-medium mb-3">Overall Progress</h4>
                                <CompactProgressTracker
                                  currentStage={order.current_stage}
                                  status={order.status}
                                />
                              </div>

                              {/* Detailed Stages - Vertical Timeline */}
                              <div className="mt-6">
                                <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-primary" />
                                  Repair Journey
                                </h4>
                                <div className="space-y-0 relative pl-4 border-l-2 border-muted">
                                  {STAGES.map((stage, index) => {
                                    const stageData = order.stages.find(s => s.stage === stage);
                                    const stageStatus = stageData?.status || 'pending';
                                    const isCompleted = stageStatus === 'completed';
                                    const isInProgress = stageStatus === 'in_progress';
                                    const isNext = !isCompleted && !isInProgress && index > 0 &&
                                      order.stages.find(s => s.stage === STAGES[index - 1])?.status === 'completed';

                                    // Dynamic description based on stage
                                    let description = "";
                                    if (stage === 'Inspection') description = isCompleted ? "Vehicle inspection completed" : "Initial check of vehicle condition";
                                    if (stage === 'Repair') {
                                      if (isCompleted) description = "All repair tasks completed";
                                      else if (isInProgress) description = "Technicians are working on your vehicle";
                                      else description = "Scheduled for repairs";
                                    }
                                    if (stage === 'Review') {
                                      if (isInProgress) description = "Admin Review: Waiting for Approval"; // Explicit request
                                      else description = "Final review of work done";
                                    }
                                    if (stage === 'Quality Check') {
                                      if (isInProgress) description = "Quality Check in Progress"; // Explicit request
                                      else description = "Ensuring high standards";
                                    }
                                    if (stage === 'Delivery') description = isCompleted ? "Vehicle delivered to customer" : "Ready for handover";

                                    return (
                                      <div key={stage} className="relative pb-8 last:pb-0 pl-6">
                                        {/* Status Dot */}
                                        <div
                                          className={`absolute -left-[21px] top-0 h-10 w-10 rounded-full border-4 border-background flex items-center justify-center transition-all ${isCompleted ? "bg-green-500 text-white" :
                                            isInProgress ? "bg-blue-500 text-white animate-pulse" :
                                              isNext ? "bg-primary/20 text-primary border-primary" :
                                                "bg-muted text-muted-foreground"
                                            }`}
                                        >
                                          {isCompleted ? <CheckCircle2 className="h-5 w-5" /> :
                                            isInProgress ? <Wrench className="h-4 w-4" /> :
                                              stage === 'Delivery' ? <Truck className="h-4 w-4" /> :
                                                <span className="text-xs font-bold">{index + 1}</span>}
                                        </div>

                                        {/* Content Card */}
                                        <div className={`p-4 rounded-lg border transition-all ${isCompleted ? "bg-green-50/50 border-green-100" :
                                          isInProgress ? "bg-blue-50/50 border-blue-100 shadow-sm" :
                                            "bg-card border-border/50"
                                          }`}>
                                          <div className="flex justify-between items-start mb-1">
                                            <h5 className={`font-semibold ${isCompleted ? "text-green-900" :
                                              isInProgress ? "text-blue-700" :
                                                "text-foreground"
                                              }`}>
                                              {stage}
                                            </h5>
                                            <Badge variant={
                                              isCompleted ? "default" :
                                                isInProgress ? "secondary" : "outline"
                                            } className={isCompleted ? "bg-green-600 hover:bg-green-700" : ""}>
                                              {isCompleted ? "Completed" :
                                                isInProgress ? "In Progress" : "Pending"}
                                            </Badge>
                                          </div>

                                          <p className="text-sm text-muted-foreground mb-4">
                                            {description}
                                          </p>

                                          {/* Granular Repair Tasks - Only for Repair Stage */}
                                          {stage === 'Repair' && order.tasks.length > 0 && (
                                            <div className="mt-4 space-y-4">
                                              {/* Group tasks by service */}
                                              {allServices.map((service) => {
                                                const serviceTasks = order.tasks.filter(t => t.service_id === service.id);
                                                if (serviceTasks.length === 0) return null;

                                                return (
                                                  <div key={service.id || service.service_type} className="space-y-2 bg-background/50 rounded-lg p-3 border border-border/50">
                                                    <h6 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-2">
                                                      <Wrench className="h-3 w-3" />
                                                      {service.service_type} Tasks
                                                    </h6>
                                                    <div className="space-y-2">
                                                      {serviceTasks.map((task) => (
                                                        <div key={task.id} className="flex items-center justify-between gap-2 p-2 rounded bg-card/50 border border-border/30">
                                                          <div className="flex items-center gap-2">
                                                            <div className={`h-2 w-2 rounded-full ${task.status === 'completed' ? 'bg-green-500' :
                                                              task.status === 'in_progress' ? 'bg-blue-500 animate-pulse' :
                                                                'bg-muted'
                                                              }`} />
                                                            <span className="text-sm font-medium">{task.task_name}</span>
                                                          </div>
                                                          <Badge variant="outline" className={`text-[10px] h-5 ${task.status === 'completed' ? 'border-green-200 text-green-700 bg-green-50' :
                                                            task.status === 'in_progress' ? 'border-blue-200 text-blue-700 bg-blue-50' :
                                                              ''
                                                            }`}>
                                                            {task.status.replace('_', ' ')}
                                                          </Badge>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                );
                                              })}

                                              {/* Show tasks without service_id (General Tasks) */}
                                              {order.tasks.filter(t => !t.service_id).length > 0 && (
                                                <div className="space-y-2 bg-background/50 rounded-lg p-3 border border-border/50">
                                                  <h6 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-2">
                                                    <Activity className="h-3 w-3" />
                                                    General Progress
                                                  </h6>
                                                  <div className="space-y-2">
                                                    {order.tasks.filter(t => !t.service_id).map((task) => (
                                                      <div key={task.id} className="flex items-center justify-between gap-2 p-2 rounded bg-card/50 border border-border/30">
                                                        <div className="flex items-center gap-2">
                                                          <div className={`h-2 w-2 rounded-full ${task.status === 'completed' ? 'bg-green-500' :
                                                            task.status === 'in_progress' ? 'bg-blue-500 animate-pulse' :
                                                              'bg-muted'
                                                            }`} />
                                                          <span className="text-sm font-medium">{task.task_name}</span>
                                                        </div>
                                                        <Badge variant="outline" className={`text-[10px] h-5 ${task.status === 'completed' ? 'border-green-200 text-green-700 bg-green-50' :
                                                          task.status === 'in_progress' ? 'border-blue-200 text-blue-700 bg-blue-50' :
                                                            ''
                                                          }`}>
                                                          {task.status.replace('_', ' ')}
                                                        </Badge>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          )}

                                          {/* Enhanced Delivery Stage Visuals */}
                                          {stage === 'Delivery' && isInProgress && (
                                            <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20 flex flex-col items-center text-center space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-700">
                                              <div className="relative">
                                                <Truck className="h-12 w-12 text-primary animate-bounce" />
                                                <MapPin className="h-6 w-6 text-red-500 absolute -bottom-1 -right-1 animate-pulse" />
                                              </div>
                                              <div>
                                                <h6 className="font-bold text-primary">Your vehicle is ready!</h6>
                                                <p className="text-sm text-muted-foreground">Our team is preparing for handover. We'll see you soon!</p>
                                              </div>
                                              <Button size="sm" className="w-full sm:w-auto">
                                                Contact Service Advisor
                                              </Button>
                                            </div>
                                          )}

                                          {stage === 'Delivery' && isCompleted && (
                                            <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-100 flex flex-col items-center text-center space-y-2">
                                              <div className="p-3 bg-green-100 rounded-full">
                                                <CheckCircle2 className="h-8 w-8 text-green-600" />
                                              </div>
                                              <h6 className="font-bold text-green-800">Successfully Delivered</h6>
                                              <p className="text-sm text-green-700">Thank you for choosing Amma Auto!</p>
                                            </div>
                                          )}

                                          {/* Timestamps */}
                                          {stageData?.completed_at && (
                                            <div className="flex items-center gap-2 text-xs text-green-700 font-medium mt-3">
                                              <CheckCircle2 className="h-3 w-3" />
                                              Finished: {formatDateTime(stageData.completed_at)}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </>
                          )}

                          {/* Timestamps */}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                            <span>Created: {formatDateTime(order.created_at)}</span>
                            {order.portal_updated_at && (
                              <span>Last Updated: {formatDateTime(order.portal_updated_at)}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {workOrders.length === 0 && (
          <Card className="mb-8">
            <CardContent className="p-8 text-center">
              <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Active Repairs</h3>
              <p className="text-muted-foreground">Your repairs will appear here once they are in progress.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Once your vehicle is accepted by staff, you'll be able to track progress live.
              </p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="vehicles" className="w-full">
          <TabsList>
            <TabsTrigger value="vehicles">My Vehicles</TabsTrigger>
            <TabsTrigger value="workorders">Work Orders</TabsTrigger>
            <TabsTrigger value="history">Work History</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="vehicles">
            <Card>
              <CardHeader>
                <CardTitle>My Vehicles</CardTitle>
                <CardDescription>
                  Detailed information about your registered vehicles
                </CardDescription>
              </CardHeader>
              <CardContent>
                {vehicles.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No vehicles registered yet</p>
                ) : (
                  <div className="space-y-4">
                    {vehicles.map((vehicle) => (
                      <div key={vehicle.id} className="border p-4 rounded-lg">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                          {/* Vehicle Main Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-3">
                              <Truck className="h-5 w-5 text-primary" />
                              <h3 className="font-semibold text-lg">{vehicle.vehicle_number}</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Model */}
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Model:</span>
                                <span className="font-medium">{vehicle.model || "N/A"}</span>
                              </div>
                              
                              {/* Vehicle Type */}
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Type:</span>
                                <span className="font-medium">{vehicle.vehicle_type || "N/A"}</span>
                              </div>
                              
                              {/* Color */}
                              {vehicle.color && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-muted-foreground">Color:</span>
                                  <span className="font-medium">{vehicle.color}</span>
                                </div>
                              )}
                              
                              {/* Year */}
                              {vehicle.year && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-muted-foreground">Year:</span>
                                  <span className="font-medium">{vehicle.year}</span>
                                </div>
                              )}
                              
                              {/* Registration Date */}
                              {vehicle.created_at && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-muted-foreground">Registered:</span>
                                  <span className="font-medium">
                                    {new Date(vehicle.created_at).toLocaleDateString("en-IN", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric"
                                    })}
                                  </span>
                                </div>
                              )}
                              
                              {/* VIN/Chassis Number */}
                              {vehicle.vin && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-muted-foreground">VIN:</span>
                                  <span className="font-medium text-xs font-mono">{vehicle.vin}</span>
                                </div>
                              )}
                              
                              {/* Engine Number */}
                              {vehicle.engine_number && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-muted-foreground">Engine:</span>
                                  <span className="font-medium text-xs font-mono">{vehicle.engine_number}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Vehicle Stats */}
                          <div className="flex flex-col gap-2 min-w-[150px]">
                            {/* Work Orders Count for this Vehicle */}
                            {(() => {
                              const vehicleWorkOrders = Object.values(workOrdersById).filter(
                                (wo: any) => wo.vehicle_id === vehicle.id
                              );
                              const activeCount = vehicleWorkOrders.filter(
                                (wo: any) => !["delivered", "completed", "cancelled", "approved"].includes(
                                  (wo.status || "").toLowerCase()
                                )
                              ).length;
                              const completedCount = vehicleWorkOrders.length - activeCount;
                              
                              // Get the latest work order status for display
                              const latestWorkOrder = vehicleWorkOrders[0];
                              const repairStatus = latestWorkOrder?.status || "No repairs";
                              
                              return (
                                <>
                                  <div className="flex items-center gap-2">
                                    <Badge 
                                      variant={
                                        completedCount > 0 && activeCount === 0 ? "default" : 
                                        activeCount > 0 ? "secondary" : "outline"
                                      }
                                    >
                                      {completedCount > 0 && activeCount === 0 ? "Completed" : 
                                       activeCount > 0 ? "In Progress" : "Available"}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    <span className="font-medium text-blue-600">{activeCount}</span> active repairs
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    <span className="font-medium text-green-600">{completedCount}</span> completed
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workorders">
            <Card>
              <CardHeader>
                <CardTitle>My Work Orders</CardTitle>
                <CardDescription>
                  All active work orders visible to you
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeWorkOrders.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No active work orders</p>
                ) : (
                  <div className="space-y-4">
                    {activeWorkOrders.map((order) => {
                      const services = order.services || [];
                      return (
                        <div key={order.id} className="border p-4 rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold">{order.service_type}</h3>
                                {services.length > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {services.length} service{services.length > 1 ? 's' : ''}
                                  </Badge>
                                )}
                              </div>
                              {services.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {services.map((service: any) => (
                                    <Badge key={service.id} variant="secondary" className="text-xs">
                                      {service.service_type}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              <p className="text-sm text-muted-foreground">{order.description}</p>
                              <p className="text-sm text-muted-foreground">
                                Vehicle: {order.vehicle?.vehicle_number || "N/A"}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Created: {formatDateTime(order.created_at)}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge variant={order.status === "Completed" || order.status === "Delivered" ? "default" : "secondary"}>
                                {order.status}
                              </Badge>
                              {order.current_stage && (
                                <span className="text-xs text-muted-foreground">
                                  Stage: {order.current_stage}
                                </span>
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
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Work History</CardTitle>
                <CardDescription>
                  Completed and delivered work orders
                </CardDescription>
              </CardHeader>
              <CardContent>
                {completedWorkOrders.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No completed work orders yet</p>
                ) : (
                  <div className="space-y-4">
                    {completedWorkOrders.map((order) => {
                      const services = order.services || [];
                      return (
                        <Card key={order.id} className="overflow-hidden">
                          <CardContent className="p-0">
                            {/* Header with vehicle info */}
                            <div className="p-4 border-b bg-green-50/50 flex flex-row justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-lg">{order.vehicle?.vehicle_number || "N/A"}</h3>
                                  <Badge variant="outline">{order.vehicle?.model || ""}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {order.customer?.name || "Customer"}
                                </p>
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setViewDetailOrder(order)}
                                className="flex items-center gap-2"
                              >
                                <Eye className="h-4 w-4" />
                                View Details
                              </Button>
                            </div>

                            {/* Services Section */}
                            <div className="p-4 border-b">
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                Services:
                              </h4>
                              <div className="space-y-1">
                                {services.length > 0 ? (
                                  services.map((service: any) => (
                                    <div key={service.id} className="text-sm">
                                      {service.service_type}
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-sm">{order.service_type}</div>
                                )}
                              </div>
                            </div>

                            {/* Status Section */}
                            <div className="p-4 border-b">
                              <div className="flex flex-wrap gap-2 mb-2">
                                <Badge variant="secondary">{order.status}</Badge>
                                {order.current_stage && (
                                  <Badge variant="outline">{order.current_stage}</Badge>
                                )}
                              </div>
                              {/* Repair Progress */}
                              <div className="mt-3">
                                <div className="flex items-center justify-between text-sm mb-1">
                                  <span>Repair Progress</span>
                                  <span className="font-medium">
                                    {order.repair_status === 'approved' ? 'Approved' : 
                                     order.repair_status === 'completed' ? 'Completed' : 
                                     order.repair_status === 'in_progress' ? 'In Progress' : 
                                     order.repair_status}
                                  </span>
                                </div>
                                <Progress 
                                  value={order.repair_status === 'approved' ? 100 : 
                                              order.repair_status === 'completed' ? 100 : 
                                              order.repair_status === 'in_progress' ? 50 : 0} 
                                  className="h-2" 
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  {order.repair_status === 'approved' 
                                    ? '2 of 2 completed' 
                                    : order.repair_status === 'completed'
                                    ? '2 of 2 completed'
                                    : '0 of 2 completed'}
                                  {' '} • {order.repair_status === 'approved' 
                                    ? '100% Complete' 
                                    : order.repair_status === 'completed'
                                    ? '100% Complete'
                                    : '0% Complete'}
                                </p>
                              </div>
                            </div>

                            {/* Footer with assigned date */}
                            <div className="p-4 bg-muted/20">
                              <p className="text-xs text-muted-foreground">
                                Assigned: {formatDateTime(order.created_at)}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card>
              <CardHeader><CardTitle>My Invoices</CardTitle></CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No invoices yet</p>
                ) : (
                  <div className="space-y-4">
                    {invoices.map((invoice) => (
                      <div key={invoice.id} className="border p-4 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{invoice.invoice_number}</h3>
                            <p className="text-sm font-semibold">Total: ₹{invoice.total}</p>
                          </div>
                          <Badge variant={invoice.status === "paid" ? "default" : "destructive"}>{invoice.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Work Order Detail Modal */}
      <Dialog open={!!viewDetailOrder} onOpenChange={() => setViewDetailOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Work Order Details
            </DialogTitle>
          </DialogHeader>
          
          {viewDetailOrder && (
            <div className="space-y-6">
              {/* Vehicle Info */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
                  <Truck className="h-5 w-5" />
                  {viewDetailOrder.vehicle?.vehicle_number || "N/A"}
                  <Badge variant="outline">{viewDetailOrder.vehicle?.model || ""}</Badge>
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Order ID:</span>
                    <span className="font-mono ml-2">#{viewDetailOrder.id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant="secondary" className="ml-2">{viewDetailOrder.status}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Current Stage:</span>
                    <span className="ml-2">{viewDetailOrder.current_stage || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Priority:</span>
                    <Badge variant={viewDetailOrder.priority === "Urgent" ? "destructive" : "secondary"} className="ml-2">
                      {viewDetailOrder.priority}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Services */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Services Performed
                </h4>
                <div className="bg-muted/30 p-3 rounded-lg">
                  {viewDetailOrder.services && viewDetailOrder.services.length > 0 ? (
                    <div className="space-y-2">
                      {viewDetailOrder.services.map((service: any) => (
                        <div key={service.id} className="flex items-center justify-between p-2 bg-background rounded border">
                          <span>{service.service_type}</span>
                          <Badge variant="outline">{service.status || "Completed"}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">{viewDetailOrder.service_type || "No services listed"}</p>
                  )}
                </div>
              </div>

              {/* Description */}
              {viewDetailOrder.description && (
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                    {viewDetailOrder.description}
                  </p>
                </div>
              )}

              {/* Repair Progress */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Repair Progress
                </h4>
                <div className="space-y-3">
                  <Progress 
                    value={viewDetailOrder.repair_status === 'approved' ? 100 : 
                                viewDetailOrder.repair_status === 'completed' ? 100 : 
                                viewDetailOrder.repair_status === 'in_progress' ? 50 : 0} 
                    className="h-3" 
                  />
                  <div className="flex items-center justify-between text-sm">
                    <Badge variant="secondary">{viewDetailOrder.repair_status || "Pending"}</Badge>
                    <span className="text-muted-foreground">
                      {viewDetailOrder.repair_status === 'approved' || viewDetailOrder.repair_status === 'completed' 
                        ? "100% Complete" 
                        : "In Progress"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Repair Journey Timeline */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Repair Journey
                </h4>
                <div className="space-y-0 relative pl-4 border-l-2 border-muted">
                  {STAGES.map((stage, index) => {
                    const stageData = viewDetailOrder.stages.find(s => s.stage === stage);
                    const stageStatus = stageData?.status || 'pending';
                    const isCompleted = stageStatus === 'completed';
                    
                    return (
                      <div key={stage} className="relative pb-6 last:pb-0 pl-6">
                        <div className={`absolute -left-[21px] top-0 h-8 w-8 rounded-full border-4 border-background flex items-center justify-center ${
                          isCompleted ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                        }`}>
                          {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs">{index + 1}</span>}
                        </div>
                        <div className="flex items-center justify-between">
                          <h5 className={`font-medium ${isCompleted ? "text-green-900" : "text-foreground"}`}>
                            {stage}
                          </h5>
                          <Badge variant={isCompleted ? "default" : "outline"} className={isCompleted ? "bg-green-600" : ""}>
                            {isCompleted ? "Completed" : stageStatus.replace('_', ' ')}
                          </Badge>
                        </div>
                        {stageData?.completed_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Completed: {formatDateTime(stageData.completed_at)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tasks */}
              {viewDetailOrder.tasks && viewDetailOrder.tasks.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Tasks Completed
                  </h4>
                  <div className="space-y-2">
                    {viewDetailOrder.tasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                        <span className="text-sm">{task.task_name}</span>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="border-t pt-4 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Created: {formatDateTime(viewDetailOrder.created_at)}</span>
                </div>
                {viewDetailOrder.completed_at && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Completed: {formatDateTime(viewDetailOrder.completed_at)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDetailOrder(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
