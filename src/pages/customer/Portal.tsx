// @ts-nocheck
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from '@supabase/supabase-js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  XCircle,
  X,
  Clock,
  FileText,
  Package,
  User,
  Calendar,
  ArrowRight,
  IndianRupee,
  ChevronRight,
  Inbox,
  ShieldCheck,
  Download,
  Eye,
  CreditCard,
  Hourglass,
  AlertCircle,
  Upload,
  History,
  Truck,
  Wrench,
  Activity,
  Car,
  Search,
  LayoutDashboard,
  LogOut,
  GripVertical,
  Wallet,
  Gauge,
  QrCode,
  Archive,
  Zap,
  Plus,
  Trash2,
  Camera
} from "lucide-react";
import logo from "@/assets/logo.png";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { generateInvoicePDF } from "@/utils/pdfGenerator";

// Import Table components
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { BookAppointmentDialog } from "@/components/forms/BookAppointmentDialog";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
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


// Import ProgressTracker component
import { CompactProgressTracker } from "@/components/work-orders/ProgressTracker";
import { DriverHistoryDialog } from "@/components/drivers/DriverHistoryDialog";

// Service History interface
interface ServiceHistory {
  id: string;
  vehicle_id: string;
  work_order_id: string;
  service_type: string;
  service_description: string | null;
  work_summary: string | null;
  status: string;
  service_date: string;
  delivery_date: string | null;
  approved_by: string | null;
  created_at: string;
  vehicle?: {
    id: string;
    vehicle_number: string;
    model: string;
    customer_id: string;
  };
}

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
  driver?: {
    name: string;
    contact_number?: string;
  };
  stages: WorkOrderStage[];
  customer_notified?: boolean;
  tasks: RepairTask[];
  services: any[];
  photos: any[];
  belongings: any[];
}

const STAGES = ['Inspection', 'Repair', 'Review', 'Quality Check', 'Delivery'];

export default function CustomerPortal() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderProgress[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]); // Add employees state
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [showDebug, setShowDebug] = useState(false);
  const [viewDetailOrder, setViewDetailOrder] = useState<WorkOrderProgress | null>(null);
  const [viewVehicleHistory, setViewVehicleHistory] = useState<any | null>(null);
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [historySortBy, setHistorySortBy] = useState<"date" | "vehicle" | "status">("date");
  const [activeTab, setActiveTab] = useState("vehicles");
  const [hasSetInitialTab, setHasSetInitialTab] = useState(false);

  // Service History State
  const [serviceHistory, setServiceHistory] = useState<ServiceHistory[]>([]);
  const [viewingVehicleHistory, setViewingVehicleHistory] = useState<{
    vehicleId: string;
    vehicleNumber: string;
    history: ServiceHistory[];
  } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Payment State
  const [profile, setProfile] = useState<any>(null);
  const [payingInvoice, setPayingInvoice] = useState<any | null>(null);
  const [payingInvoices, setPayingInvoices] = useState<any[]>([]); // New state for multi-bill
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [deductionReason, setDeductionReason] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "Bank Transfer" | "Cash">("UPI");
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Invoice View State
  const [viewingInvoice, setViewingInvoice] = useState<any | null>(null);
  const [viewingInvoiceItems, setViewingInvoiceItems] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [viewingInvoicePayments, setViewingInvoicePayments] = useState<any[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  // Activity History State
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);

  // Reschedule dialog state
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<any | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [rescheduleReason, setRescheduleReason] = useState("");

  // Driver History State
  const [drivers, setDrivers] = useState<any[]>([]);
  const [viewingDriverHistory, setViewingDriverHistory] = useState<{ id: string, name: string } | null>(null);



  // Sync payment amount when paying invoices change
  useEffect(() => {
    if (payingInvoice) {
      setPaymentAmount(payingInvoice.total || 0);
      setDeductionReason("");
    } else if (payingInvoices.length > 0) {
      const total = payingInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      setPaymentAmount(total);
      setDeductionReason("");
    }
  }, [payingInvoice, payingInvoices]);

  const fetchProfile = useCallback(async () => {
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;


      let data, error;

      if (SERVICE_ROLE_KEY) {
        const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false }
        });
        const res = await adminClient
          .from('company_profiles')
          .select('payment_qr_code_url, bank_details, company_name, logo_url')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        data = res.data;
        error = res.error;
      } else {
        const res = await supabase
          .from('company_profiles')
          .select('payment_qr_code_url, bank_details, company_name, logo_url')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        data = res.data;
        error = res.error;
      }

      if (error) {
        console.error("Error fetching company profile:", error);
      }

      if (data) setProfile(data);
    } catch (e) {
      console.error("Exception fetching profile:", e);
    }
  }, []);

  // Auto-set payment amount when invoice is selected
  useEffect(() => {
    if (payingInvoices.length > 0) {
      const totalDue = payingInvoices.reduce((sum, i) => sum + (i.balance || 0), 0);
      setPaymentAmount(totalDue);
    } else if (payingInvoice) {
      setPaymentAmount(payingInvoice.balance || 0);
    } else {
      setPaymentAmount(0);
    }
    setDeductionReason("");
  }, [payingInvoice, payingInvoices]);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    let debug = `User ID: ${user.id} \nEmail: ${user.email || 'N/A'} \n`;

    try {
      // First, try to find customer by user_id
      const customerQuery = await supabase
        .from("customers")
        .select("id, name, email")
        .eq("user_id", user.id)
        .single();

      debug += `Customer Query - Found: ${!!customerQuery.data} \n`;

      let customerId = (customerQuery.data as any)?.id;

      // If no customer found by user_id, try by email
      if (!customerId && user.email) {
        const customerByEmailQuery = await supabase
          .from("customers")
          .select("id, name, email")
          .eq("email", user.email)
          .single();
        customerId = (customerByEmailQuery.data as any)?.id;
        debug += `Customer by Email - Found: ${!!customerByEmailQuery.data} \n`;
      }

      if (!customerId) {
        debug += "ERROR: No customer record found for this user\n";
        debug += "Solution: Link this user to a customer record in the customers table\n";
        setDebugInfo(debug);
        setLoading(false);
        return;
      }

      debug += `Customer ID: ${customerId} \n`;
      setCustomerId(customerId);

      // Fetch vehicles and invoices using admin client to bypass RLS
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

      let vehiclesRes: any = { data: [], error: null };
      let invoicesRes: any = { data: [], error: null };
      let employeesRes: any = { data: [], error: null }; // Add employees res
      let adminClient: any = null;

      if (SERVICE_ROLE_KEY) {
        adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false }
        });

        vehiclesRes = await adminClient
          .from("vehicles")
          .select("*")
          .eq("customer_id", customerId);

        invoicesRes = await supabase.from("invoices").select("*, payments(*)").eq("customer_id", customerId);

        // Fetch employees for name resolution
        employeesRes = await adminClient.from("employees").select("id, name, user_id");
      } else {
        // Fallback to regular client
        [vehiclesRes, invoicesRes, employeesRes] = await Promise.all([
          supabase.from("vehicles").select("*").eq("customer_id", customerId),
          supabase.from("invoices").select("*, payments(*)").eq("customer_id", customerId),
          supabase.from("employees").select("id, name, user_id"),
        ]);
      }

      // Fetch all payment links for these invoices to calculate balance
      const invoiceIds = (invoicesRes.data || []).map((inv: any) => inv.id);
      const { data: allLinks } = await (SERVICE_ROLE_KEY ? adminClient : supabase)
        .from('payment_links')
        .select('*, payment:payments(status)')
        .in('invoice_id', invoiceIds);

      const processedInvoices = (invoicesRes.data || []).map((inv: any) => {
        const links = (allLinks as any[])?.filter(l => l.invoice_id === inv.id) || [];
        const paidAmount = links
          .filter(l => l.payment?.status === 'approved')
          .reduce((sum, l) => sum + (l.amount_applied || 0), 0);

        // Direct payments (legacy/single invoice link)
        // But our new flow uses payment_links. For safety, we can check inv.payments too if they are approved.
        // Actually, the select("*, payments(status)") in invoicesRes already gives us some info.

        const balance = Math.max(0, (inv.total || 0) - paidAmount - (inv.total_deductions || 0));

        return {
          ...inv,
          paid_amount: paidAmount,
          balance
        };
      });

      // Set vehicles and invoices state
      setVehicles(vehiclesRes.data || []);

      debug += `Vehicles found: ${vehiclesRes.data?.length || 0} \n`;
      debug += `Invoices found: ${processedInvoices.length} \n`;
      setInvoices(processedInvoices);
      setEmployees(employeesRes.data || []); // Set employees

      // Get customer's vehicle IDs
      const customerVehicleIds = (vehiclesRes.data || []).map((v: any) => v.id);
      debug += `Customer Vehicle IDs: ${JSON.stringify(customerVehicleIds)} \n`;

      // Fetch work orders using admin client to bypass RLS
      debug += `\n-- - Fetching Appointments -- -\n`;
      const appointmentsQuery = await supabase
        .from("appointments")
        .select(`
          *,
          vehicle:vehicles(vehicle_number, model),
          history:appointment_history(
            *,
            actor:profiles!changed_by(full_name)
          )
        `)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (appointmentsQuery.error) {
        console.error("Error fetching appointments:", appointmentsQuery.error);
        debug += `Error fetching appointments: ${appointmentsQuery.error.message}\n`;
      } else {
        // Filter out history hidden from customer
        const processedAppointments = (appointmentsQuery.data || []).map(app => ({
          ...app,
          history: (app.history || []).filter((h: any) => h.hidden_from_customer !== true)
        }));
        setAppointments(processedAppointments);
        debug += `Appointments found: ${processedAppointments.length}\n`;
      }

      // Fetch company drivers
      const driversQuery = await supabase
        .from("drivers")
        .select("*")
        .eq("company_id", customerId)
        .eq("is_active", true);

      if (driversQuery.data) {
        setDrivers(driversQuery.data);
      }

      debug += `\n-- - Fetching Work Orders-- -\n`;

      let allWorkOrders: any[] = [];

      // Strategy 1: If customer has registered vehicles, query by those vehicle IDs
      if (customerVehicleIds.length > 0) {
        const workOrdersByVehicles = await supabase
          .from("work_orders")
          .select(`
  *,
  vehicle: vehicles(id, vehicle_number, model, customer_id),
  driver: drivers(name, contact_number)
          `)
          .in("vehicle_id", customerVehicleIds)
          .order("created_at", { ascending: false });

        debug += `Work orders by customer vehicles: ${workOrdersByVehicles.data?.length || 0} \n`;
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
  vehicle: vehicles(id, vehicle_number, model, customer_id),
  driver: drivers(name, contact_number)
          `)
          .order("created_at", { ascending: false });

        debug += `Total work orders in system(admin): ${allWorkOrdersQuery.data?.length || 0} \n`;

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

        debug += `Work orders after filtering: ${workOrdersFiltered.length} \n`;

        // Merge results, avoiding duplicates
        const workOrdersData = [...allWorkOrders];
        workOrdersFiltered.forEach((wo: any) => {
          if (!workOrdersData.find(w => w.id === wo.id)) {
            workOrdersData.push(wo);
          }
        });

        debug += `Total work orders after merge: ${workOrdersData.length} \n`;

        if (workOrdersData.length > 0) {
          // Fetch stages for each work order using admin client
          const workOrderIds = workOrdersData.map((wo: any) => wo.id);
          const stagesQuery = await adminClient
            .from("work_order_stages")
            .select("*")
            .in("work_order_id", workOrderIds)
            .order("created_at");

          debug += `Stages found: ${stagesQuery.data?.length || 0} \n`;

          // Fetch tasks for all work orders
          const tasksQuery = await adminClient
            .from("work_order_tasks")
            .select("*")
            .in("work_order_id", workOrderIds)
            .order("created_at");

          debug += `Tasks found: ${tasksQuery.data?.length || 0} \n`;

          // Fetch services for all work orders
          const servicesQuery = await adminClient
            .from("work_order_services")
            .select("*")
            .in("work_order_id", workOrderIds);

          debug += `Services found: ${servicesQuery.data?.length || 0} \n`;

          // Fetch Photos for all work orders
          const photosQuery = await adminClient
            .from("work_order_photos")
            .select("*")
            .in("work_order_id", workOrderIds);

          debug += `Photos found: ${photosQuery.data?.length || 0} \n`;

          // Fetch Belongings for all work orders
          const belongingsQuery = await adminClient
            .from("work_order_belongings")
            .select("*")
            .in("work_order_id", workOrderIds);

          debug += `Belonging records found: ${belongingsQuery.data?.length || 0} \n`;

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
              .filter((rt: any) => rt.work_order_id === wo.id && rt.task_type !== 'inspection')
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

            const woPhotos = (photosQuery.data || [])
              .filter((p: any) => p.work_order_id === wo.id);

            const woBelongings = (belongingsQuery.data || [])
              .filter((b: any) => b.work_order_id === wo.id);

            return {
              ...wo,
              stages: woStages,
              tasks: woRepairTasks,
              services: woServices,
              photos: woPhotos,
              belongings: woBelongings
            };
          });

          debug += `Processed work orders: ${processedWorkOrders.length} \n`;
          debug += `Active work orders: ${processedWorkOrders.filter(w => w.status !== "Completed" && w.status !== "Cancelled").length} \n`;

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
      debug += `ERROR: ${error.message} \n`;
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

  useEffect(() => {
    fetchData();
    fetchProfile();
  }, [fetchData, fetchProfile]);

  // Group work orders by ID AND by vehicle to consolidate duplicate entries
  // This handles cases where services are stored as separate work orders with the same vehicle
  const workOrdersById = workOrders.reduce((acc, wo) => {
    // Create a composite key: work_order_id OR vehicle_id + vehicle_number
    // This groups work orders with the same vehicle together
    const key = wo.id ||
      (wo.vehicle?.id ? `vehicle - ${wo.vehicle.id} ` : `unknown - ${Math.random()} `);

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
    const finalStatuses = ["delivered", "completed", "cancelled"];
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

  // Automatically switch tab based on active orders
  useEffect(() => {
    if (!loading && !hasSetInitialTab) {
      if (activeWorkOrders.length > 0) {
        setActiveTab("workorders");
      } else {
        setActiveTab("vehicles");
      }
      setHasSetInitialTab(true);
    }
  }, [loading, activeWorkOrders.length, hasSetInitialTab]);


  const getStageProgress = (stages: WorkOrderStage[]) => {
    // Determine the furthest stage reached
    // We can't rely just on stages array length because stages might be missing or out of order
    // Instead, we look at the 'current_stage' of the work order, but here we only have the stages array passed in.
    // Let's change the function signature to accept currentStage name, or assume the last stage in the list is current.

    // Better approach: The parent activeWorkOrders.map passes `order.stages`. 
    // But `order` object has `current_stage` property which is more reliable for "current status".
    // Let's use the order's current_stage if possible. 
    // However, this function currently only takes `stages`. 
    // Let's find where it's used: line 1152: const progress = getStageProgress(order.stages || []);

    // We should change the usage to pass the stage name.
    return 0; // Placeholder, will be replaced by the next chunk changing usage
  }

  const getProgressFromStageName = (stageName: string | null) => {
    if (!stageName) return 0;
    const index = STAGES.indexOf(stageName);
    if (index === -1) {
      if (stageName === 'Completed') return 100;
      return 0;
    }
    // 0 = Inspection (0%), 4 = Delivery (100%?) 
    // Actually, "Inspection" means we are AT inspection. 
    // Completion of Inspection means we move to Repair.
    // Let's stick to a simple mapping:
    // Inspection: 10%
    // Repair: 30%
    // Review: 70%
    // Quality Check: 90%
    // Delivery: 100%

    // Or just simple index based:
    return ((index + 1) / STAGES.length) * 100;
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

  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Fetch service history for all customer's vehicles
  const fetchServiceHistory = useCallback(async () => {
    if (!user?.id || vehicles.length === 0) return;

    setHistoryLoading(true);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

      if (!SERVICE_ROLE_KEY) {
        // If no service role key, try to use the service_history table with regular client
        // This might fail due to RLS, but we'll try
        const { data, error } = await supabase
          .from("service_history")
          .select("*")
          .order("service_date", { ascending: false });

        if (!error && data) {
          // Filter to only customer's vehicles client-side
          const customerVehicleIds = vehicles.map(v => v.id);
          const filteredHistory = data.filter((h: any) =>
            customerVehicleIds.includes(h.vehicle_id)
          );
          setServiceHistory(filteredHistory);
        }
        setHistoryLoading(false);
        return;
      }

      // Use admin client to fetch all service history
      const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      // Get customer ID first
      const customerQuery = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      let customerId = (customerQuery.data as any)?.id;

      // If no customer found by user_id, try by email
      if (!customerId && user.email) {
        const customerByEmailQuery = await supabase
          .from("customers")
          .select("id")
          .eq("email", user.email)
          .single();
        customerId = (customerByEmailQuery.data as any)?.id;
      }

      if (!customerId) {
        setHistoryLoading(false);
        return;
      }

      // Get customer's vehicle IDs
      const customerVehicleIds = vehicles.map(v => v.id);

      if (customerVehicleIds.length > 0) {
        const { data, error } = await adminClient
          .from("service_history")
          .select(`
  *,
  vehicle: vehicles(id, vehicle_number, model, customer_id)
          `)
          .in("vehicle_id", customerVehicleIds)
          .order("service_date", { ascending: false });

        if (error) {
          console.error("Error fetching service history:", error);
        } else {
          setServiceHistory(data || []);
        }
      }
    } catch (error: any) {
      console.error("Error fetching service history:", error);
    } finally {
      setHistoryLoading(false);
    }
  }, [user, vehicles]);

  const handleDeleteAppointment = async (id: string) => {
    try {
      const oldApp = appointments.find(a => a.id === id);
      const { error } = await (supabase
        .from('appointments') as any)
        .update({
          status: 'cancelled',
          deleted_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Record in history
      await (supabase.from('appointment_history') as any).insert({
        appointment_id: id,
        old_status: oldApp?.status,
        new_status: 'cancelled',
        changed_by: user?.id,
        action_type: 'soft_deleted',
        notes: 'Appointment cancelled by customer'
      });

      toast({ title: "Appointment Deleted", description: "Your appointment request has been removed." });
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete appointment" });
    }
  };

  const handleAcceptDate = async (appointmentId: string) => {
    try {
      const { error } = await (supabase as any).rpc('accept_appointment_date', {
        appointment_id: appointmentId
      });

      if (error) throw error;

      toast({
        title: "Date Accepted",
        description: "You've accepted the assigned appointment date."
      });
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to accept date"
      });
    }
  };

  const handleRequestReschedule = async (
    appointmentId: string,
    newDate: Date,
    reason: string
  ) => {
    try {
      const { error } = await (supabase as any).rpc('request_appointment_reschedule', {
        appointment_id: appointmentId,
        new_date: newDate.toISOString(),
        reason: reason
      });

      if (error) throw error;

      toast({
        title: "Reschedule Requested",
        description: "Your reschedule request has been sent to the admin."
      });
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to request reschedule"
      });
    }
  };

  const handleCancelWithReason = async (appointmentId: string, reason: string) => {
    try {
      const { error } = await (supabase as any).rpc('cancel_appointment_by_customer', {
        appointment_id: appointmentId,
        reason: reason
      });

      if (error) throw error;

      toast({
        title: "Appointment Cancelled",
        description: "Your appointment has been cancelled."
      });
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to cancel appointment"
      });
    }
  };

  // Fetch service history when vehicles are loaded
  useEffect(() => {
    if (vehicles.length > 0) {
      fetchServiceHistory();
    }
  }, [vehicles.length, fetchServiceHistory]);

  const unpaidInvoices = invoices.filter(inv => inv.status !== 'Paid' && inv.status !== 'Draft');

  // Notify about unpaid invoices
  useEffect(() => {
    if (unpaidInvoices.length > 0 && !loading) {
      toast({
        title: "Payment Reminder",
        description: `You have ${unpaidInvoices.length} unpaid invoice(s).Please review them.`,
        variant: "destructive",
      });
    }
  }, [unpaidInvoices.length, loading, toast]);

  const handleViewInvoice = async (invoice: any) => {
    setViewingInvoice(invoice);
    setInvoiceLoading(true);
    setViewingInvoiceItems([]);

    try {
      const { data: items, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id);

      if (error) throw error;

      if (items && items.length > 0) {
        setViewingInvoiceItems(items);
      } else {
        setViewingInvoiceItems([]);
      }

      // Fetch Payments via links
      const { data: links, error: linksError } = await supabase
        .from('payment_links')
        .select('*, payment:payments(*)')
        .eq('invoice_id', invoice.id);

      if (linksError) throw linksError;

      const linkedPayments = (links as any[])?.map(l => ({
        ...l.payment,
        amount_applied: l.amount_applied
      })) || [];

      // Fetch direct payments (legacy/direct)
      const { data: directPayments } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', (invoice as any).id);

      const allDetailedPayments = [...linkedPayments];
      (directPayments as any[])?.forEach(dp => {
        if (!allDetailedPayments.some(p => p.id === dp.id)) {
          allDetailedPayments.push({ ...dp, amount_applied: dp.amount });
        }
      });

      setViewingInvoicePayments(allDetailedPayments);
    } catch (err: any) {
      console.error("Error fetching invoice items:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load invoice details"
      });
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handlePaymentSubmit = async () => {
    const invoicesToLink = payingInvoices.length > 0 ? payingInvoices : (payingInvoice ? [payingInvoice] : []);

    if (!paymentProof || invoicesToLink.length === 0) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please upload a payment proof and select invoices." });
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const fileExt = paymentProof.name.split('.').pop();
      const fileName = `proof - ${invoicesToLink[0].id} -${Date.now()}.${fileExt} `;
      const filePath = `${fileName} `;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, paymentProof);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(filePath);

      const totalBalance = invoicesToLink.reduce((sum, inv) => sum + (inv.balance || 0), 0);
      const deductionAmount = Math.max(0, totalBalance - paymentAmount);

      // 1. Insert Payment
      const { data: paymentData, error: insertError } = await (supabase as any)
        .from('payments')
        .insert({
          invoice_id: invoicesToLink.length === 1 ? invoicesToLink[0].id : null, // Support legacy/simple view
          amount: paymentAmount,
          deduction_amount: deductionAmount,
          deduction_reason: deductionAmount > 0 ? deductionReason : null,
          payment_method: paymentMethod,
          proof_url: publicUrl,
          status: 'pending'
        })
        .select()
      if (insertError) throw insertError;

      // 2. Link Invoices
      if (paymentData) {
        const links = invoicesToLink.map(inv => ({
          payment_id: paymentData.id,
          invoice_id: inv.id,
          amount_applied: invoicesToLink.length === 1 ? paymentAmount : inv.balance
        }));

        const { error: linksError } = await (supabase as any)
          .from('payment_links')
          .insert(links);

        if (linksError) throw linksError;
      }

      toast({
        title: "Payment Submitted",
        description: "Your payment reference has been submitted for verification."
      });
      setPayingInvoice(null);
      setPayingInvoices([]);
      setSelectedInvoiceIds([]);
      setPaymentProof(null);
      setPaymentMethod("UPI");
      setPaymentAmount(0);
      setDeductionReason("");

      fetchData();

    } catch (error: any) {
      console.error("Payment submission failed:", error);
      toast({ variant: "destructive", title: "Submission Failed", description: error.message });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Sort vehicles: Active ones first
  const sortedVehicles = useMemo(() => {
    return [...vehicles].sort((a, b) => {
      const getActiveCount = (vId: string) => {
        const vehicleWorkOrders = Object.values(workOrdersById).filter(
          (wo: any) => wo.vehicle_id === vId
        );
        return vehicleWorkOrders.filter(
          (wo: any) => !["delivered", "completed", "cancelled"].includes(
            (wo.status || "").toLowerCase()
          )
        ).length;
      };
      return getActiveCount(b.id) - getActiveCount(a.id);
    });
  }, [vehicles, workOrdersById]);

  const getActiveCount = useCallback((vId: string) => {
    const vehicleWorkOrders = Object.values(workOrdersById).filter(
      (wo: any) => wo.vehicle_id === vId
    );
    return vehicleWorkOrders.filter(
      (wo: any) => !["delivered", "completed", "cancelled", "approved"].includes(
        (wo.status || "").toLowerCase()
      )
    ).length;
  }, [workOrdersById]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
        <div className="relative">
          <div className="h-24 w-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <img src={profile?.logo_url || logo} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-12 object-contain animate-pulse" alt="Logo" />
        </div>
        <h2 className="mt-8 text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          Accessing My Garage
        </h2>
        <p className="mt-2 text-muted-foreground text-sm uppercase tracking-wider">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary pb-10">
      {/* Tactical Background Overlay */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(var(--primary),0.05)_0%,transparent_50%)]" />
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_100%_100%,rgba(var(--primary),0.02)_0%,transparent_30%)]" />
      </div>

      <header className="border-b border-border bg-background/80 sticky top-0 z-50 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-20 grid grid-cols-3 items-center">
          {/* Column 1: Branding */}
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary),0.3)] overflow-hidden shrink-0">
              <img
                src={profile?.logo_url || logo}
                className="h-9 w-9 object-contain brightness-0 invert"
                alt="Logo"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = logo;
                }}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-primary uppercase tracking-tight leading-tight">
                {profile?.company_name || "Amma Auto Garage"}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Online
                </span>
              </div>
            </div>
          </div>

          {/* Column 2: Page Title (Centered) */}
          <div className="flex flex-col items-center justify-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase text-center">
              My Garage
            </h1>
            <div className="h-0.5 w-12 bg-primary mt-1 rounded-full opacity-50" />
          </div>

          {/* Column 3: User & Sign Out */}
          <div className="flex items-center justify-end gap-6">
            <Button
              onClick={() => setIsBookingOpen(true)}
              className="hidden md:flex bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(var(--primary),0.4)] animate-pulse hover:animate-none transition-all"
            >
              <Calendar className="mr-2 h-4 w-4" /> Book Appointment
            </Button>
            <div className="hidden xl:flex items-center gap-3 px-4 py-2 bg-background/50 rounded-2xl border border-border shadow-inner">
              <User className="h-4 w-4 text-primary" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">User</span>
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  {user?.email?.split('@')[0]}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="h-10 border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all group px-4 rounded-xl"
            >
              <LogOut className="h-4 w-4 mr-2 group-hover:translate-x-1 transition-transform text-primary" />
              <span className="font-bold uppercase text-[10px] tracking-wider">Log Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 relative z-10">
        {/* Quick Links / KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-background/40 border-border backdrop-blur-md hover:bg-background/60 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <img src={profile?.logo_url || logo} className="h-12 w-12 object-contain grayscale brightness-0 invert" alt="..." />
            </div>
            <CardContent className="p-6">
              <p className="text-muted-foreground font-bold uppercase tracking-wider mb-2 text-xs">Total Vehicles</p>
              <h3 className="text-4xl font-bold text-foreground tracking-tight leading-none">{vehicles.length}</h3>
              <p className="text-[11px] font-bold text-primary uppercase tracking-wider mt-3 italic">Vehicles</p>
            </CardContent>
          </Card>

          <Card className="bg-background/40 border-border backdrop-blur-md hover:bg-background/60 transition-all group relative overflow-hidden text-orange-400">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <img src={profile?.logo_url || logo} className="h-12 w-12 object-contain grayscale brightness-0 invert" alt="..." />
            </div>
            <CardContent className="p-6">
              <p className="text-muted-foreground font-bold uppercase tracking-wider mb-2 text-xs">Active Work</p>
              <h3 className="text-4xl font-bold text-foreground tracking-tight leading-none">{activeWorkOrders.length}</h3>
              <p className="text-[11px] font-bold text-orange-400 uppercase tracking-wider mt-3 italic">In Progress</p>
            </CardContent>
          </Card>

          <Card className="bg-background/40 border-border backdrop-blur-md hover:bg-background/60 transition-all group relative overflow-hidden text-green-400">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <img src={profile?.logo_url || logo} className="h-12 w-12 object-contain grayscale brightness-0 invert" alt="..." />
            </div>
            <CardContent className="p-6">
              <p className="text-muted-foreground font-bold uppercase tracking-wider mb-2 text-xs">History</p>
              <h3 className="text-4xl font-bold tracking-tight leading-none">{completedWorkOrders.length}</h3>
              <p className="text-[11px] font-bold text-green-400 uppercase tracking-wider mt-3 italic">Past Services</p>
            </CardContent>
          </Card>

          <Card className="bg-background/40 border-border backdrop-blur-md hover:bg-background/60 transition-all group relative overflow-hidden text-primary">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <img src={profile?.logo_url || logo} className="h-12 w-12 object-contain grayscale brightness-0 invert" alt="..." />
            </div>
            <CardContent className="p-6">
              <p className="text-muted-foreground font-bold uppercase tracking-wider mb-2 text-xs">Outstanding</p>
              <h3 className="text-4xl font-bold text-foreground tracking-tight leading-none">
                ₹{invoices.filter(i => i.status !== 'Paid' && i.type !== 'quotation').reduce((sum, i) => sum + (i.balance || 0), 0).toLocaleString()}
              </h3>
              <p className="text-[11px] font-bold text-primary uppercase tracking-wider mt-3 italic">Payment Due</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 md:space-y-8">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6 h-auto p-1.5 gap-2 rounded-2xl border-border bg-secondary/80 backdrop-blur-md shadow-2xl max-w-4xl mx-auto mb-12">
            <TabsTrigger value="vehicles" className="rounded-xl py-2 md:py-1.5 flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-foreground transition-all uppercase text-[10px] font-bold tracking-wider">
              <Car className="h-3.5 w-3.5" /> Vehicles
            </TabsTrigger>
            <TabsTrigger value="workorders" className="rounded-xl py-2 md:py-1.5 flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-foreground transition-all uppercase text-[10px] font-bold tracking-wider">
              <Activity className="h-3.5 w-3.5" /> Active
            </TabsTrigger>
            <TabsTrigger value="appointments" className="rounded-xl py-2 md:py-1.5 flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-foreground transition-all uppercase text-[10px] font-bold tracking-wider">
              <Calendar className="h-3.5 w-3.5" /> Requests
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-xl py-2 md:py-1.5 flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-foreground transition-all uppercase text-[10px] font-bold tracking-wider">
              <History className="h-3.5 w-3.5" /> History
            </TabsTrigger>
            <TabsTrigger value="invoices" className="rounded-xl py-2 md:py-1.5 flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-foreground transition-all uppercase text-[10px] font-bold tracking-wider">
              <FileText className="h-3.5 w-3.5" /> Invoices
            </TabsTrigger>
            <TabsTrigger value="quotations" className="rounded-xl py-2 md:py-1.5 flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-foreground transition-all uppercase text-[10px] font-bold tracking-wider col-span-2 md:col-span-1">
              <Zap className="h-3.5 w-3.5" /> Estimates
            </TabsTrigger>
            <TabsTrigger value="drivers" className="rounded-xl py-2 md:py-1.5 flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-foreground transition-all uppercase text-[10px] font-bold tracking-wider col-span-2 md:col-span-1">
              <User className="h-3.5 w-3.5" /> Drivers
            </TabsTrigger>

          </TabsList>

          <TabsContent value="vehicles" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedVehicles.length === 0 ? (
                <div className="col-span-full py-20 text-center bg-background/40 border border-border rounded-3xl backdrop-blur-md">
                  <div className="h-20 w-20 rounded-full bg-background border-border shadow-sm shadow-primary/20 flex items-center justify-center mx-auto mb-4 overflow-hidden p-2">
                    <img
                      src={profile?.logo_url || logo}
                      className="h-full w-full object-contain opacity-50 transition-opacity group-hover:opacity-100"
                      alt="Logo"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = logo;
                      }}
                    />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2 tracking-tight">No Vehicles Found</h3>
                  <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">Your garage is empty. Once a vehicle is registered under your profile, it will appear here.</p>
                </div>
              ) : (
                sortedVehicles.map((vehicle) => {
                  const vehicleWorkOrders = Object.values(workOrdersById).filter(wo => wo.vehicle_id === vehicle.id);
                  const activeCount = vehicleWorkOrders.filter(wo => !["delivered", "completed", "cancelled"].includes((wo.status || "").toLowerCase())).length;
                  const completedCount = vehicleWorkOrders.filter(wo => ["delivered", "completed", "approved"].includes((wo.status || "").toLowerCase())).length;

                  return (
                    <Card key={vehicle.id} className={cn(
                      "backdrop-blur-md transition-all group overflow-hidden rounded-3xl border",
                      activeCount > 0
                        ? "bg-primary/5 border-primary shadow-[0_0_20px_rgba(var(--primary),0.15)] hover:shadow-[0_0_30px_rgba(var(--primary),0.25)]"
                        : "bg-background/40 border-border hover:border-primary/30"
                    )}>
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold text-primary uppercase tracking-tight block">Vehicle Details</span>
                              {activeCount > 0 && (
                                <Badge className="bg-primary text-primary-foreground border-0 text-[9px] font-bold uppercase animate-pulse shadow-sm">
                                  In Service
                                </Badge>
                              )}
                            </div>
                            <h3 className="text-2xl font-bold text-foreground tracking-tight">{vehicle.vehicle_number}</h3>
                            <p className="text-sm text-muted-foreground font-medium">{vehicle.model}</p>
                          </div>
                          <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center p-2 transition-transform group-hover:scale-110",
                            activeCount > 0
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                              : "bg-background border border-border shadow-sm shadow-primary/20"
                          )}>
                            <img
                              src={profile?.logo_url || logo}
                              className={cn(
                                "h-full w-full object-contain transition-all duration-300",
                                activeCount > 0 ? "opacity-100" : "opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100"
                              )}
                              alt="Logo"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (target.src !== logo) {
                                  target.src = logo;
                                  target.classList.remove("grayscale", "opacity-60");
                                  target.classList.add("opacity-100");
                                }
                              }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                          <div className={cn(
                            "p-3 rounded-2xl border transition-colors",
                            activeCount > 0 ? "bg-primary/10 border-primary/20" : "bg-background/50 border-border"
                          )}>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Active Services</p>
                            <p className={cn("text-xl font-bold", activeCount > 0 ? "text-primary" : "text-foreground")}>{activeCount}</p>
                          </div>
                          <div className="bg-background/50 p-3 rounded-2xl border border-border">
                            <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">History</p>
                            <p className="text-xl font-bold text-foreground">{completedCount}</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className={cn(
                              "flex-1 border-border hover:bg-secondary text-foreground rounded-xl h-12 font-bold transition-all",
                              activeCount > 0 ? "bg-background/80 hover:bg-primary/10 hover:border-primary/30 hover:text-primary" : "bg-secondary/50"
                            )}
                            onClick={() => {
                              const vehicleHistory = serviceHistory.filter(h => h.vehicle_id === vehicle.id);
                              setViewingVehicleHistory({
                                vehicleId: vehicle.id,
                                vehicleNumber: vehicle.vehicle_number,
                                history: vehicleHistory
                              });
                            }}
                          >
                            <History className="h-4 w-4 mr-2" /> Service Logs
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>


          <TabsContent value="workorders" className="space-y-4">
            {activeWorkOrders.length === 0 ? (
              <div className="py-20 text-center bg-background/40 border border-border rounded-3xl backdrop-blur-md">
                <div className="h-20 w-20 rounded-full bg-background border-border shadow-sm shadow-primary/20 flex items-center justify-center mx-auto mb-4 overflow-hidden p-2">
                  <img
                    src={profile?.logo_url || logo}
                    className="h-full w-full object-contain opacity-50 transition-opacity group-hover:opacity-100"
                    alt="Logo"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = logo;
                    }}
                  />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2 tracking-tight">No Active Services</h3>
                <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">There are no vehicles currently being serviced. When a service starts, you'll see real-time progress here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {activeWorkOrders.map((order) => {
                  const progress = getProgressFromStageName(order.current_stage);
                  return (
                    <Card key={order.id} className="bg-background/40 border-border backdrop-blur-md hover:border-primary/30 transition-all overflow-hidden rounded-3xl border-l-4 border-l-primary">
                      <CardContent className="p-0">
                        <div className="p-5 md:p-8">
                          <div className="flex flex-col lg:flex-row justify-between gap-6 mb-8">
                            <div className="flex-1 w-full">
                              <div className="flex items-center gap-3 mb-4">
                                <Badge className="bg-primary/10 text-primary border-primary/20 uppercase text-[10px] font-bold tracking-wider px-3 py-1">
                                  {order.status.replace('_', ' ')}
                                </Badge>
                                <span className="text-xs text-muted-foreground">ID: {order.id.slice(0, 8).toUpperCase()}</span>
                              </div>
                              <h3 className="text-2xl font-bold text-foreground tracking-tight mb-2 uppercase">
                                {order.combined_service_types ? Array.from(order.combined_service_types).join(" + ") : order.service_type}
                              </h3>
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    <Car className="h-4 w-4 text-primary" />
                                    <span>{order.vehicle?.vehicle_number}</span>
                                  </div>
                                  <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-primary" />
                                    <span>Started {formatDateTime(order.created_at)}</span>
                                  </div>
                                </div>

                                {order.driver && (
                                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground bg-primary/5 px-2 py-1 rounded-md w-fit border border-primary/10">
                                    <User className="h-3.5 w-3.5 text-primary" />
                                    <span>{order.driver.name}</span>
                                    {order.driver.contact_number && (
                                      <>
                                        <div className="h-3 w-[1px] bg-primary/20 mx-1" />
                                        <span className="text-xs text-primary/80 font-mono">{order.driver.contact_number}</span>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>


                            <div className="flex flex-col items-center md:items-end justify-center min-w-[200px]">
                              {order.current_stage === 'Delivery' && order.customer_notified ? (
                                <div className="text-center group relative cursor-default">
                                  <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse" />
                                  <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 rounded-2xl shadow-[0_10px_30px_rgba(16,185,129,0.4)] border border-emerald-400/50 flex flex-col items-center gap-3 transform transition-all hover:scale-105">
                                    <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm shadow-inner">
                                      <CheckCircle2 className="h-7 w-7 text-white drop-shadow-md" />
                                    </div>
                                    <div className="space-y-0.5">
                                      <h4 className="text-lg font-black uppercase tracking-tight leading-none filter drop-shadow-sm">Vehicle Ready</h4>
                                      <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-100 opacity-90">For Delivery</p>
                                    </div>
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
                                    <div className="absolute bottom-0 left-0 w-16 h-16 bg-black/10 rounded-full blur-xl -ml-8 -mb-8" />
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="relative h-24 w-24 mb-2">
                                    <svg className="h-24 w-24 -rotate-90">
                                      <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-muted/20" />
                                      <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent"
                                        strokeDasharray={251.2}
                                        strokeDashoffset={251.2 - (251.2 * progress) / 100}
                                        className="text-primary transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                                      />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                      <span className="text-xl font-bold text-foreground leading-none">{Math.round(progress)}%</span>
                                      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Complete</span>
                                    </div>
                                  </div>
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{order.current_stage || "Initializing"}</p>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="bg-background/50 rounded-2xl border border-border p-6 backdrop-blur-sm">
                            {/* Current Activity Section */}
                            <div className="mb-8 p-4 bg-primary/5 rounded-xl border border-primary/10">
                              <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Activity className="h-3 w-3" /> Current Activity
                              </h4>
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-lg font-bold text-foreground">
                                    {order.current_stage || "Initializing"}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {order.updated_at ? `Updated ${formatDateTime(order.updated_at)}` : "Just now"}
                                  </p>
                                </div>
                                <Badge variant={order.status === 'in_progress' ? 'default' : 'secondary'} className="uppercase text-[10px]">
                                  {order.status.replace('_', ' ')}
                                </Badge>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 mb-6">
                              <Gauge className="h-4 w-4 text-primary" />
                              <span className="text-xs font-bold text-foreground uppercase tracking-wider">Progress Timeline</span>
                            </div>
                            <CompactProgressTracker
                              currentStage={order.current_stage || ""}
                              status={order.status}
                              className="mt-2"
                            />
                          </div>
                        </div>

                        <div className="bg-background/30 border-t border-border p-4 flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => toggleOrderExpanded(order.id)}
                            >
                              <Search className="h-4 w-4 mr-2" />
                              {expandedOrders.has(order.id) ? "Hide Details" : "View Details"}
                            </Button>
                          </div>
                          <Badge variant="outline" className="border-border text-muted-foreground text-[10px] font-bold">
                            LIVE UPDATE
                          </Badge>
                        </div>

                        {expandedOrders.has(order.id) && (
                          <div className="p-8 bg-background border-t border-border animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                              <div>
                                <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-4">Service Details</h4>
                                <div className="space-y-4 bg-secondary/50 p-6 rounded-2xl border border-border shadow-inner">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground font-medium uppercase text-[10px]">Primary Request</span>
                                    <span className="text-secondary-foreground font-bold">{order.service_type}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground font-medium uppercase text-[10px]">Reported Issues</span>
                                    <span className="text-foreground italic text-right max-w-[200px]">{order.description || "No description provided"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground font-medium uppercase text-[10px]">Current Status</span>
                                    <Badge variant="secondary" className="bg-secondary text-foreground border-border font-bold uppercase text-[9px]">{order.status.replace('_', ' ')}</Badge>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-4">Breakdown</h4>
                                <div className="space-y-2">
                                  {order.services && order.services.length > 0 ? (
                                    order.services.map((s: any, idx: number) => (
                                      <div key={idx} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl border border-border">
                                        <div className="h-2 w-2 rounded-full bg-primary/40 shadow-[0_0_8px_rgba(var(--primary),0.4)]" />
                                        <span className="text-foreground font-bold uppercase text-[11px] tracking-tight">{s.service_type}</span>
                                        <span className="ml-auto text-muted-foreground text-xs">CODE-{idx + 101}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-muted-foreground italic p-4 text-center bg-secondary/30 rounded-xl border border-border border-dashed">No itemized services listed</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* New: Vehicle Condition & Belongings */}
                            {(order.photos?.length > 0 || order.belongings?.length > 0) && (
                              <div className="mt-8 pt-8 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-8">
                                {order.photos?.length > 0 && (
                                  <div>
                                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                                      <Camera className="h-4 w-4" /> Vehicle Condition
                                    </h4>
                                    <div className="grid grid-cols-4 gap-2">
                                      {order.photos.map((photo: any) => (
                                        <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden border border-border group bg-secondary/20">
                                          <img
                                            src={photo.photo_url}
                                            className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform duration-500"
                                            alt={photo.photo_type}
                                            onClick={() => window.open(photo.photo_url, '_blank')}
                                          />
                                          <Badge className="absolute bottom-1 right-1 text-[7px] h-3 px-1 bg-black/60 text-white border-0 uppercase tracking-tighter">
                                            {photo.photo_type}
                                          </Badge>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {order.belongings?.length > 0 && (
                                  <div>
                                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                                      <Package className="h-4 w-4" /> Personal Belongings
                                    </h4>
                                    <div className="space-y-2">
                                      {order.belongings.map((item: any) => (
                                        <div key={item.id} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl border border-border">
                                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-border bg-background">
                                            <img src={item.photo_url} className="w-full h-full object-cover" alt={item.item_name} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-bold text-foreground truncate uppercase tracking-tight">{item.item_name}</p>
                                            <p className="text-[9px] text-muted-foreground truncate">{item.description}</p>
                                          </div>
                                          {item.confirmed_at ? (
                                            <Badge variant="outline" className="text-[8px] bg-green-500/10 text-green-500 border-green-500/20 py-0 h-4 uppercase font-bold">Returned</Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-[8px] bg-yellow-500/10 text-yellow-500 border-yellow-500/20 py-0 h-4 uppercase font-bold">Safe</Badge>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="appointments" className="space-y-4">
            <Card className="border-border bg-card/50 backdrop-blur-md">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>My Appointments</CardTitle>
                    <CardDescription>Status of your service requests</CardDescription>
                  </div>
                  <Button onClick={() => setIsBookingOpen(true)} size="sm" className="bg-primary/20 text-primary hover:bg-primary/30">
                    <Plus className="h-4 w-4 mr-1" /> New Request
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex justify-between items-center h-12 w-full px-6 border-b">
                  <div className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Active Appointment Requests
                  </div>
                </div>

                <div className="p-6">
                  {appointments.filter(app => !['cancelled', 'rejected', 'completed', 'converted'].includes(app.status)).length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground bg-background/30 rounded-xl border border-dashed">
                      <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p>No active requests found.</p>
                      <Button variant="link" onClick={() => setIsBookingOpen(true)}>Book one now</Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {appointments.filter(app => !['cancelled', 'rejected', 'completed', 'converted'].includes(app.status)).map(app => (
                        <div key={app.id} className="group flex flex-col md:flex-row gap-4 p-5 border rounded-2xl bg-background/40 hover:border-primary/30 transition-all">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className="bg-background/50 uppercase text-[10px] tracking-wider">
                                  {app.type === 'face_to_face' ? 'Visit' : 'Service'}
                                </Badge>
                                <span className="text-sm font-bold text-foreground">
                                  {format(new Date(app.scheduled_at), "PPP p")}
                                </span>
                              </div>
                              <Badge className={cn(
                                "uppercase text-[10px] font-bold tracking-wider",
                                app.status === 'confirmed' ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" :
                                  app.status === 'rejected' ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" :
                                    app.status === 'completed' ? "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20" :
                                      app.status === 'converted' ? "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20" :
                                        "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
                              )}>
                                {app.status}
                              </Badge>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground mb-3">
                                  {app.vehicle && (
                                    <div className="flex items-center gap-2 bg-secondary/30 p-2 rounded-lg">
                                      <Car className="h-4 w-4 text-primary" />
                                      <span className="font-medium text-foreground">{app.vehicle.vehicle_number}</span>
                                      <span className="text-xs">({app.vehicle.model})</span>
                                    </div>
                                  )}

                                  {/* Date Comparison Section */}
                                  <div className="flex flex-col gap-2">
                                    {/* Requested Date */}
                                    {app.requested_date && (
                                      <div className="flex items-center gap-2 bg-secondary/30 p-2 rounded-lg">
                                        <Clock className="h-4 w-4 text-blue-500" />
                                        <div className="flex flex-col">
                                          <span className="text-[9px] uppercase font-bold text-blue-500/70">Requested Date</span>
                                          <span className="text-sm">{format(new Date(app.requested_date), "PPP p")}</span>
                                        </div>
                                      </div>
                                    )}

                                    {/* Scheduled Date - highlight if different from requested */}
                                    {app.scheduled_at && (
                                      <div className={cn(
                                        "flex items-center gap-2 p-2 rounded-lg",
                                        app.requested_date && new Date(app.requested_date).getTime() !== new Date(app.scheduled_at).getTime()
                                          ? "bg-orange-50 border-2 border-orange-200"
                                          : "bg-secondary/30"
                                      )}>
                                        <Clock className={cn(
                                          "h-4 w-4",
                                          app.requested_date && new Date(app.requested_date).getTime() !== new Date(app.scheduled_at).getTime()
                                            ? "text-orange-600"
                                            : "text-primary"
                                        )} />
                                        <div className="flex flex-col">
                                          <span className={cn(
                                            "text-[9px] uppercase font-bold",
                                            app.requested_date && new Date(app.requested_date).getTime() !== new Date(app.scheduled_at).getTime()
                                              ? "text-orange-600"
                                              : "text-primary/70"
                                          )}>
                                            {app.requested_date && new Date(app.requested_date).getTime() !== new Date(app.scheduled_at).getTime()
                                              ? "Assigned Date (Changed by Admin)"
                                              : "Appointed Date"}
                                          </span>
                                          <span className="text-sm font-semibold">{format(new Date(app.scheduled_at), "PPP p")}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {app.notes && (
                                  <div className="text-xs text-muted-foreground bg-secondary/20 p-3 rounded-lg border border-border/50">
                                    <span className="font-bold text-primary/70 uppercase text-[9px] mr-2">Note:</span>
                                    {app.notes}
                                  </div>
                                )}

                                {/* Customer Response Status */}
                                {app.customer_response && (
                                  <div className="mt-2">
                                    {app.customer_response === 'accepted' && (
                                      <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                                        ✓ You accepted this date
                                      </Badge>
                                    )}
                                    {app.customer_response === 'reschedule_requested' && (
                                      <Badge className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20">
                                        ⏳ Reschedule requested - awaiting admin response
                                      </Badge>
                                    )}
                                  </div>
                                )}

                                {/* Customer Action Buttons - show when date changed and no response yet */}
                                {app.status === 'confirmed' &&
                                  !app.customer_response &&
                                  app.requested_date &&
                                  app.scheduled_at &&
                                  new Date(app.requested_date).getTime() !== new Date(app.scheduled_at).getTime() && (
                                    <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                      <p className="text-xs text-orange-800 mb-3 font-medium">
                                        The admin assigned a different date. Please choose an option:
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        <Button
                                          size="sm"
                                          className="bg-emerald-600 hover:bg-emerald-700"
                                          onClick={() => handleAcceptDate(app.id)}
                                        >
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          Accept Date
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="border-blue-200 text-blue-600 hover:bg-blue-50"
                                          onClick={() => {
                                            setRescheduleAppointment(app);
                                            setRescheduleDialogOpen(true);
                                          }}
                                        >
                                          <Calendar className="h-3 w-3 mr-1" />
                                          Request Reschedule
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="border-red-200 text-red-600 hover:bg-red-50"
                                          onClick={() => {
                                            const reason = prompt("Please provide a reason for cancellation:");
                                            if (reason) {
                                              handleCancelWithReason(app.id, reason);
                                            }
                                          }}
                                        >
                                          <X className="h-3 w-3 mr-1" />
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  )}

                                {app.status === 'converted' && (
                                  <div className="mt-3 flex items-center gap-2 text-xs text-purple-500 font-medium">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Converted to Work Order
                                  </div>
                                )}
                              </div>

                              <div className="ml-4">
                                {['pending', 'confirmed'].includes(app.status) && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Cancel Appointment?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete this appointment request? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Keep Appointment</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteAppointment(app.id)} className="bg-destructive hover:bg-destructive/90">
                                          Yes, Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drivers" className="space-y-4">
            <Card className="border-border bg-card/50 backdrop-blur-md">
              <CardHeader>
                <CardTitle>My Drivers</CardTitle>
                <CardDescription>Manage and view history of your company drivers</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {drivers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground bg-background/30 rounded-xl border border-dashed">
                    <User className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No drivers found for your company.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {drivers.map((driver) => (
                      <Card key={driver.id} className="bg-background/40 hover:bg-accent/10 transition-colors border-border">
                        <CardContent className="p-5">
                          <div className="flex justify-between items-start mb-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                              <User className="h-5 w-5" />
                            </div>
                            <Badge variant={driver.is_active ? "default" : "secondary"} className="uppercase text-[10px]">
                              {driver.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>

                          <h3 className="font-bold text-lg mb-1">{driver.name}</h3>
                          <div className="space-y-1 text-sm text-muted-foreground mb-4">
                            <p className="flex items-center gap-2">
                              <span className="opacity-70">Role:</span>
                              <span className="font-medium text-foreground">{driver.driver_position || "Driver"}</span>
                            </p>
                            {driver.contact_number && (
                              <p className="flex items-center gap-2">
                                <span className="opacity-70">Phone:</span>
                                <span className="font-medium text-foreground">{driver.contact_number}</span>
                              </p>
                            )}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => setViewingDriverHistory({ id: driver.id, name: driver.name })}
                          >
                            <History className="h-4 w-4 mr-2" />
                            View History
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <DriverHistoryDialog
              isOpen={!!viewingDriverHistory}
              onClose={() => setViewingDriverHistory(null)}
              driverId={viewingDriverHistory?.id || null}
              driverName={viewingDriverHistory?.name || null}
            />
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Tabs defaultValue="service_history" className="w-full">
              <div className="flex justify-center mb-6">
                <TabsList className="bg-secondary/50 p-1 rounded-xl border border-border/50">
                  <TabsTrigger value="service_history" className="rounded-lg px-6 py-2 text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-foreground">
                    Service History
                  </TabsTrigger>
                  <TabsTrigger value="appointment_log" className="rounded-lg px-6 py-2 text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-foreground">
                    Appointment Log
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="service_history" className="space-y-4">
                {completedWorkOrders.length === 0 ? (
                  <div className="py-20 text-center bg-background/40 border border-border rounded-3xl backdrop-blur-md">
                    <div className="h-20 w-20 rounded-full bg-background border-border shadow-sm shadow-primary/20 flex items-center justify-center mx-auto mb-4 overflow-hidden p-2">
                      <img
                        src={profile?.logo_url || logo}
                        className="h-full w-full object-contain opacity-50 transition-opacity group-hover:opacity-100"
                        alt="Logo"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = logo;
                        }}
                      />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2 tracking-tight">No Past Services</h3>
                    <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">Once your vehicle services are completed, they will appear here.</p>
                  </div>
                ) : (
                  <div className="relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-muted-foreground before:to-transparent">
                    {completedWorkOrders.map((order, idx) => (
                      <div key={order.id} className="relative flex flex-col md:flex-row items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-12">
                        {/* Icon Circle */}
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-background text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 z-10 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>

                        {/* Content Card */}
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-background/40 border border-border backdrop-blur-md p-6 rounded-3xl group-hover:border-primary/20 transition-all duration-500">
                          <div className="flex items-center justify-between mb-4">
                            <time className="text-[10px] font-bold text-primary uppercase tracking-wider">{formatDate(order.created_at)}</time>
                            <Badge variant="outline" className="border-border text-muted-foreground text-[9px] uppercase font-bold">Completed Service</Badge>
                          </div>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center border border-border">
                              <Car className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <h4 className="text-foreground font-bold uppercase tracking-tight">{order.vehicle?.vehicle_number}</h4>
                              <p className="text-xs text-muted-foreground font-medium">{order.vehicle?.model}</p>
                              {order.driver && (
                                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  <span className="font-medium">Driver:</span> {order.driver.name}
                                </p>
                              )}
                            </div>
                          </div>
                          <h3 className="text-foreground font-bold mb-4 flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-primary" />
                            {order.service_type}
                          </h3>

                          <div className="space-y-3 mb-6">
                            {order.services?.map((s: any, i: number) => {
                              const serviceTasks = order.tasks?.filter((t: any) => t.service_id === s.id) || [];
                              return (
                                <div key={i} className="bg-background/20 p-2.5 rounded-2xl border border-border/30">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                                      <Wrench className="h-3 w-3 text-primary" />
                                    </div>
                                    <span className="text-xs font-bold text-foreground/90">{s.service_type}</span>
                                  </div>
                                  {serviceTasks.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 ml-8">
                                      {serviceTasks.map((t: any, ti: number) => (
                                        <Badge key={ti} variant="secondary" className="text-[9px] bg-background/50 text-muted-foreground font-medium border-none px-2 py-0">
                                          {t.task_name}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Standalone Tasks */}
                            {order.tasks?.filter((t: any) => !t.service_id).length > 0 && (
                              <div className="mt-3 bg-secondary/10 p-2.5 rounded-2xl border border-dashed border-border/50">
                                <p className="text-[9px] text-muted-foreground uppercase font-bold mb-2 tracking-wider ml-1">General Tasks</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {order.tasks.filter((t: any) => !t.service_id).map((t: any, ti: number) => (
                                    <Badge key={ti} variant="outline" className="text-[9px] border-border/50 text-muted-foreground font-medium px-2 py-0">
                                      {t.task_name}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between border-t border-border pt-4">
                            <div className="flex -space-x-2">
                              <div className="h-6 w-6 rounded-full bg-background border-2 border-background flex items-center justify-center" title="Systems Check">
                                <Gauge className="h-3 w-3 text-muted-foreground" />
                              </div>
                              <div className="h-6 w-6 rounded-full bg-background border-2 border-background flex items-center justify-center" title="Verified">
                                <ShieldCheck className="h-3 w-3 text-muted-foreground" />
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs font-bold text-muted-foreground hover:text-primary-foreground"
                              onClick={() => setViewDetailOrder(order)}
                            >
                              View Details <ArrowRight className="h-3 w-3 ml-2" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="appointment_log" className="space-y-4">
                <Card className="border-border bg-card/50 backdrop-blur-md">
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <History className="h-5 w-5 text-primary" />
                          Appointment Log
                        </CardTitle>
                        <CardDescription>Log of all appointment-related actions</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedHistoryIds.length > 0 && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 font-bold text-[10px] uppercase tracking-wider shadow-lg shadow-red-500/20"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                Delete ({selectedHistoryIds.length})
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Selected Records?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Permanently delete {selectedHistoryIds.length} selected records? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={async () => {
                                    const { error } = await (supabase as any).from('appointment_history').update({ hidden_from_customer: true }).in('id', selectedHistoryIds);
                                    if (!error) {
                                      toast({ title: "Records deleted" });
                                      setSelectedHistoryIds([]);
                                      fetchData();
                                    }
                                  }}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Yes, Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[10px] h-8 font-bold text-destructive hover:text-destructive hover:bg-destructive/10 uppercase tracking-wider"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                              Clear All
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Clear Entire History?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Permanently clear your ENTIRE activity history log? This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={async () => {
                                  const allHistoryIds = appointments.flatMap(a => (a.history || []).map((h: any) => h.id));
                                  if (allHistoryIds.length === 0) return;
                                  const { error } = await (supabase as any).from('appointment_history').update({ hidden_from_customer: true }).in('id', allHistoryIds);
                                  if (!error) {
                                    toast({ title: "Audit log cleared" });
                                    setSelectedHistoryIds([]);
                                    fetchData();
                                  }
                                }}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Clear All
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-2">
                      {appointments.flatMap(a => (a.history || []).map((h: any) => ({ ...h, appointment: a })))
                        .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
                        .map((h: any) => (
                          <div
                            key={h.id}
                            className={cn(
                              "flex items-center justify-between p-3 border rounded-xl transition-all group cursor-pointer",
                              selectedHistoryIds.includes(h.id)
                                ? "bg-primary/10 border-primary ring-1 ring-primary/20"
                                : "border-border/50 bg-secondary/10 hover:bg-secondary/20 hover:border-border"
                            )}
                            onClick={() => {
                              setSelectedHistoryIds(prev =>
                                prev.includes(h.id) ? prev.filter(id => id !== h.id) : [...prev, h.id]
                              );
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "h-5 w-5 rounded border flex items-center justify-center transition-colors",
                                selectedHistoryIds.includes(h.id) ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30 bg-background"
                              )}>
                                {selectedHistoryIds.includes(h.id) && <CheckCircle2 className="h-3.5 w-3.5" />}
                              </div>
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center border shadow-sm ${h.action_type === 'created' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                                h.action_type === 'soft_deleted' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                                  'bg-blue-500/10 border-blue-500/20 text-blue-500'
                                }`}>
                                {h.action_type === 'created' ? <Plus className="h-3.5 w-3.5" /> :
                                  h.action_type === 'soft_deleted' ? <Trash2 className="h-3.5 w-3.5" /> :
                                    <Activity className="h-3.5 w-3.5" />}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-foreground capitalize flex items-center gap-1.5 flex-wrap">
                                  {h.action_type.replace('_', ' ')}
                                  {h.new_status && <Badge variant="outline" className="h-4 px-1 text-[9px] lowercase leading-none">{h.new_status}</Badge>}
                                  <span className="text-[9px] text-muted-foreground font-normal">
                                    • {h.appointment?.vehicle?.vehicle_number || "No Vehicle"}
                                  </span>
                                </div>
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                  {format(new Date(h.changed_at), "PPP p")}
                                </div>
                              </div>
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Log Entry?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this individual log record?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      (supabase as any).from('appointment_history').update({ hidden_from_customer: true }).eq('id', h.id).then(({ error }: any) => {
                                        if (!error) {
                                          toast({ title: "Record Hidden" });
                                          fetchData();
                                        }
                                      });
                                    }}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        ))}
                      {(appointments.length === 0 || appointments.every(a => !a.history || a.history.length === 0)) && (
                        <div className="py-12 text-center text-muted-foreground bg-secondary/5 rounded-2xl border border-dashed">
                          <Inbox className="h-10 w-10 mx-auto mb-3 opacity-20" />
                          <p className="font-medium">No activity history found.</p>
                          <p className="text-xs mt-1">Your interaction logs will appear here as you book appointments.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4">
            {invoices.filter(i => i.type !== 'quotation').length === 0 ? (
              <div className="py-20 text-center bg-background/40 border border-border rounded-3xl backdrop-blur-md">
                <div className="h-20 w-20 rounded-full bg-background border-border shadow-sm shadow-primary/20 flex items-center justify-center mx-auto mb-4 overflow-hidden p-2">
                  <img
                    src={profile?.logo_url || logo}
                    className="h-full w-full object-contain opacity-50 transition-opacity group-hover:opacity-100"
                    alt="Logo"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = logo;
                    }}
                  />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2 tracking-tight">All Paid</h3>
                <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">No outstanding invoices. You are all caught up!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Batch Payment HUD */}
                {invoices.filter(i => i.status !== 'Paid' && i.status !== 'Draft' && i.type !== 'quotation' && i.balance > 0).length > 1 && (
                  <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-primary/10 border border-primary/20 rounded-3xl backdrop-blur-md gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary),0.3)]">
                        <CreditCard className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <div>
                        <h4 className="text-foreground font-bold uppercase tracking-tight">Bill Payment</h4>
                        <p className="text-xs text-muted-foreground font-medium">{selectedInvoiceIds.length} Invoices selected for batch payment</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Selected Total</p>
                        <p className="text-2xl font-bold text-foreground leading-none">₹{invoices.filter(i => selectedInvoiceIds.includes(i.id)).reduce((sum, i) => sum + (i.balance || 0), 0).toLocaleString()}</p>
                      </div>
                      <Button
                        size="lg"
                        disabled={selectedInvoiceIds.length === 0}
                        onClick={() => {
                          const selected = invoices.filter(i => selectedInvoiceIds.includes(i.id));
                          setPayingInvoices(selected);
                        }}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl h-14 px-8 font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                      >
                        Pay Now
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  {invoices.filter(i => i.type !== 'quotation').map((invoice) => {
                    const isPayable = invoice.status !== 'Paid' && invoice.status !== 'Draft' && invoice.status !== 'Payment Verification Pending' && !invoice.payments?.some((p: any) => p.status === 'pending') && (invoice.balance || 0) > 0;
                    const isVerifying = invoice.status === 'Payment Verification Pending' || invoice.payments?.some((p: any) => p.status === 'pending');

                    return (
                      <Card key={invoice.id} className={cn(
                        "bg-background/40 border-border backdrop-blur-md hover:bg-background/60 transition-all group overflow-hidden rounded-3xl",
                        selectedInvoiceIds.includes(invoice.id) && "border-primary/40 bg-primary/5"
                      )}>
                        <CardContent className="p-0">
                          <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-6 w-full md:w-auto">
                              {isPayable && (
                                <div
                                  className={cn(
                                    "h-6 w-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all",
                                    selectedInvoiceIds.includes(invoice.id) ? "bg-primary border-primary" : "border-muted-foreground hover:border-primary"
                                  )}
                                  onClick={() => {
                                    if (selectedInvoiceIds.includes(invoice.id)) {
                                      setSelectedInvoiceIds(prev => prev.filter(id => id !== invoice.id));
                                    } else {
                                      setSelectedInvoiceIds(prev => [...prev, invoice.id]);
                                    }
                                  }}
                                >
                                  {selectedInvoiceIds.includes(invoice.id) && <CheckCircle2 className="h-4 w-4 text-primary-foreground" />}
                                </div>
                              )}
                              <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-2xl bg-background flex items-center justify-center border border-border">
                                  <FileText className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-foreground font-bold tracking-tight uppercase">{invoice.bill_number ? `Bill #${invoice.bill_number}` : invoice.invoice_number}</h3>
                                    {invoice.status === 'Paid' ? (
                                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-[9px] font-bold uppercase">Settled</Badge>
                                    ) : isVerifying ? (
                                      <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-[9px] font-bold uppercase animate-pulse">Verifying</Badge>
                                    ) : (
                                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-bold uppercase">Outstanding</Badge>
                                    )}
                                  </div>
                                  <p className="text-muted-foreground text-xs tracking-tight uppercase">{formatDate(invoice.created_at)}</p>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col md:flex-row items-center gap-8 w-full md:w-auto">
                              <div className="text-right hidden md:block">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Amount</p>
                                <p className="text-lg font-bold text-muted-foreground">₹{invoice.total.toLocaleString()}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Amount Due</p>
                                <p className="text-2xl font-bold text-foreground leading-none">₹{invoice.balance.toLocaleString()}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-10 w-10 p-0 rounded-xl bg-background border-border hover:bg-background/80"
                                  onClick={() => handleViewInvoice(invoice)}
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-10 w-10 p-0 rounded-xl bg-background border-border hover:bg-background/80"
                                  onClick={() => generateInvoicePDF(invoice.work_order_id)}
                                  title="Download PDF"
                                >
                                  <Download className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                {isPayable && (
                                  <Button
                                    size="sm"
                                    className="bg-primary hover:bg-primary/90 text-foreground rounded-xl h-10 px-4 font-bold uppercase tracking-wider text-[10px]"
                                    onClick={() => setPayingInvoice(invoice)}
                                  >
                                    Pay Now
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="quotations" className="space-y-4">
            {invoices.filter(i => i.type === 'quotation').length === 0 ? (
              <div className="py-20 text-center bg-background/40 border border-border rounded-3xl backdrop-blur-md">
                <div className="h-20 w-20 rounded-full bg-background border-border shadow-sm shadow-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">No Estimates</h3>
                <p className="text-muted-foreground max-w-md mx-auto">All project estimates and quotes will be listed here. You can review and approve them to start work.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {invoices.filter(i => i.type === 'quotation').map((invoice) => (
                  <Card key={invoice.id} className="bg-background/40 border-border backdrop-blur-md hover:bg-background/60 transition-all rounded-3xl overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                            <Zap className="h-6 w-6 text-orange-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-foreground font-bold tracking-tight uppercase">ESTIMATE #{invoice.invoice_number}</h3>
                              <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-[9px] font-bold uppercase">Pending Approval</Badge>
                            </div>
                            <p className="text-muted-foreground text-xs tracking-tight uppercase">{formatDate(invoice.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex flex-col md:flex-row items-center gap-8">
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Estimated Cost</p>
                            <p className="text-2xl font-bold text-foreground leading-none">₹{invoice.total.toLocaleString()}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-10 rounded-xl bg-background border border-border shadow-inner hover:bg-secondary text-muted-foreground font-bold px-4 transition-all"
                              onClick={() => handleViewInvoice(invoice)}
                            >
                              <Eye className="h-4 w-4 mr-2" /> Review
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-background border-border shadow-inner uppercase tracking-wider text-[10px] font-bold p-2 rounded-xl h-10 w-10 p-0 shadow-lg hover:bg-secondary transition-all"
                              onClick={() => generateInvoicePDF(invoice.work_order_id)}
                            >
                              <Download className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

        </Tabs>
      </main>

      {/* Payment Dialog */}
      <Dialog
        open={!!payingInvoice || payingInvoices.length > 0
        }
        onOpenChange={(open) => {
          if (!open) {
            setPayingInvoice(null);
            setPayingInvoices([]);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Make Payment</DialogTitle>
            <DialogDescription>
              {payingInvoices.length > 1
                ? `Paying for ${payingInvoices.length} Invoices`
                : `Submit payment details for ${payingInvoice?.type === 'quotation' ? 'Quotation' : 'Invoice'} #${payingInvoice?.type === 'quotation' ? payingInvoice?.invoice_number : (payingInvoice?.bill_number || payingInvoice?.invoice_number)} `
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Balance Due</span>
                <span className="text-lg font-bold text-primary">
                  ₹{(payingInvoices.length > 0
                    ? payingInvoices.reduce((sum, i) => sum + (i.balance || 0), 0)
                    : (payingInvoice?.balance || 0)
                  ).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase tracking-wider pt-1 border-t border-muted-foreground/10">
                <span>Total Bill Amount</span>
                <span>₹{(payingInvoices.length > 0
                  ? payingInvoices.reduce((sum, i) => sum + (i.total || 0), 0)
                  : (payingInvoice?.total || 0)
                ).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-muted-foreground/20">
                <span className="text-sm font-bold">Amount Paying</span>
                <div className="relative w-32">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold">₹</span>
                  <Input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="pl-7 font-bold text-right text-lg h-10 ring-2 ring-primary/20"
                  />
                </div>
              </div>
            </div>


            {paymentAmount < (payingInvoices.length > 0
              ? payingInvoices.reduce((sum, i) => sum + (i.balance || 0), 0)
              : (payingInvoice?.balance || 0)
            ) && (
                <div className="space-y-2 p-3 border border-orange-200 bg-orange-50 rounded-lg animate-in fade-in slide-in-from-top-2">
                  <Label className="text-orange-800 font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Reason for Deduction
                  </Label>
                  <Select value={deductionReason} onValueChange={setDeductionReason}>
                    <SelectTrigger className="bg-white border-orange-200">
                      <SelectValue placeholder="Select reason..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Round Off">Round Off</SelectItem>
                      <SelectItem value="Service Issue">Service Issue/Discount</SelectItem>
                      <SelectItem value="Part Issue">Part Issue</SelectItem>
                      <SelectItem value="TDS">TDS Deduction</SelectItem>
                      <SelectItem value="Retention">Retention Amount</SelectItem>
                      <SelectItem value="Other">Other (Specify in comments)</SelectItem>
                    </SelectContent>
                  </Select>
                  {deductionReason === "Other" && (
                    <Input
                      placeholder="Describe reason..."
                      className="mt-2 bg-white"
                      onChange={(e) => setDeductionReason(e.target.value)}
                    />
                  )}
                </div>
              )}

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <RadioGroup value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)} className="flex flex-col gap-2">
                <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="UPI" id="upi" />
                  <Label htmlFor="upi" className="flex items-center gap-2 cursor-pointer w-full">
                    <QrCode className="h-4 w-4" /> UPI (QR Code)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="Bank Transfer" id="bank" />
                  <Label htmlFor="bank" className="flex items-center gap-2 cursor-pointer w-full">
                    <div className="flex flex-col">
                      <span>Bank Transfer</span>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="Cash" id="cash" />
                  <Label htmlFor="cash" className="flex items-center gap-2 cursor-pointer w-full">
                    Cash (At Workshop)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {paymentMethod === "UPI" && (
              profile?.payment_qr_code_url ? (
                <div className="flex flex-col items-center p-4 border rounded-lg bg-white">
                  <img src={profile.payment_qr_code_url} alt="Payment QR Code" className="w-48 h-48 object-contain" />
                  <p className="text-xs text-muted-foreground mt-2">Scan with any UPI app</p>
                </div>
              ) : (
                <div className="p-4 border rounded-lg bg-yellow-50 text-yellow-800 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>UPI QR Code is not configured by the admin.</span>
                </div>
              )
            )}

            {paymentMethod === "Bank Transfer" && (
              profile?.bank_details ? (
                <div className="p-4 border rounded-lg bg-muted/50 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank Name:</span>
                    <span className="font-medium">{profile.bank_details.bankName || profile.bank_details.bank_name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account Name:</span>
                    <span className="font-medium">{profile.bank_details.accountName || profile.bank_details.account_name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account Number:</span>
                    <span className="font-mono">{profile.bank_details.accountNumber || profile.bank_details.account_number || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IFSC Code:</span>
                    <span className="font-mono">{profile.bank_details.ifscCode || profile.bank_details.ifsc_code || 'N/A'}</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 border rounded-lg bg-yellow-50 text-yellow-800 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Bank details are not configured by the admin.</span>
                </div>
              )
            )}

            <div className="space-y-2">
              <Label>Payment Proof (Screenshot/Receipt)</Label>
              <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer relative bg-muted/20">
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setPaymentProof(e.target.files[0]);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                {paymentProof ? (
                  <div className="flex flex-col items-center text-green-600">
                    <CheckCircle2 className="h-8 w-8 mb-2" />
                    <span className="text-sm font-medium truncate max-w-[200px]">{paymentProof.name}</span>
                    <span className="text-xs mt-1">Click to change</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-muted-foreground">
                    <Upload className="h-8 w-8 mb-2" />
                    <span className="text-sm font-medium">Click to upload proof</span>
                    <span className="text-xs mt-1">supports JPG, PNG, PDF</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayingInvoice(null)}>Cancel</Button>
            <Button onClick={handlePaymentSubmit} disabled={isSubmittingPayment || !paymentProof}>
              {isSubmittingPayment ? "Submitting..." : "Submit Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!viewingInvoice} onOpenChange={(open) => !open && setViewingInvoice(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>
              {viewingInvoice?.bill_number ? `Bill #${viewingInvoice.bill_number} ` : viewingInvoice?.invoice_number}
            </DialogDescription>
          </DialogHeader>

          {/* Simple Invoice Items View */}
          <div className="space-y-4">
            {/* Header Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Date:</span>
                <span className="ml-2 font-medium">{viewingInvoice?.created_at ? format(new Date(viewingInvoice.created_at), 'PPP') : 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <Badge className="ml-2">{viewingInvoice?.status}</Badge>
              </div>
            </div>

            {/* Items Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left">Description</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoiceLoading ? (
                    <tr><td colSpan={4} className="p-4 text-center">Loading items...</td></tr>
                  ) : viewingInvoiceItems.length === 0 ? (
                    <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No items found</td></tr>
                  ) : (
                    viewingInvoiceItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-3">{item.description}</td>
                        <td className="p-3 text-right">{item.quantity}</td>
                        <td className="p-3 text-right">₹{item.unit_price}</td>
                        <td className="p-3 text-right">₹{item.total}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary & Payments Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              {/* Payment Summary */}
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-dashed">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Invoice Total:</span>
                  <span className="font-bold">₹{viewingInvoice?.total?.toLocaleString()}</span>
                </div>
                {viewingInvoicePayments.length > 0 && (
                  <>
                    <div className="flex justify-between items-center text-sm text-green-600">
                      <span>Total Paid:</span>
                      <span className="font-bold">₹{viewingInvoicePayments.filter(p => p.status === 'approved').reduce((sum, p) => sum + (p.amount_applied || p.amount), 0).toLocaleString()}</span>
                    </div>
                    {viewingInvoice?.total_deductions > 0 && (
                      <div className="flex justify-between items-center text-sm text-orange-600">
                        <span>Deductions Applied:</span>
                        <span className="font-bold">₹{viewingInvoice?.total_deductions?.toLocaleString()}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between items-center text-base font-bold pt-1">
                      <span>Remaining Balance:</span>
                      <span className={Math.max(0, viewingInvoice?.total - viewingInvoicePayments.filter(p => p.status === 'approved').reduce((sum, p) => sum + (p.amount_applied || p.amount), 0) - (viewingInvoice?.total_deductions || 0)) <= 0 ? "text-green-600" : "text-destructive"}>
                        ₹{Math.max(0, viewingInvoice?.total - viewingInvoicePayments.filter(p => p.status === 'approved').reduce((sum, p) => sum + (p.amount_applied || p.amount), 0) - (viewingInvoice?.total_deductions || 0)).toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Payment Logs */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Payment Logs
                </h4>
                {viewingInvoicePayments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No payments recorded yet.</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                    {viewingInvoicePayments.map((p) => (
                      <div key={p.id} className="p-2 border rounded text-[11px] bg-background">
                        <div className="flex justify-between">
                          <span className="font-bold">₹{(p.amount_applied || p.amount).toLocaleString()}</span>
                          <Badge variant={p.status === 'approved' ? 'default' : 'outline'} className="h-4 text-[9px]">
                            {p.status}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-0.5">
                          {format(new Date(p.created_at), "MMM d")} via {p.payment_method}
                        </p>
                        {p.deduction_amount > 0 && (
                          <p className="text-orange-600 font-medium mt-1">
                            -{p.deduction_amount} ({p.deduction_reason})
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => generateInvoicePDF(viewingInvoice?.work_order_id)}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button variant="outline" onClick={() => setViewingInvoice(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



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
                    <span className="ml-2 font-bold">#{viewDetailOrder.id}</span>
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

                    // Enforce sequential status based on current_stage
                    // This fixes issues where DB might have inconsistent states (e.g. multiple in_progress)
                    let displayStatus = 'pending';
                    const currentStageIndex = STAGES.indexOf(viewDetailOrder.current_stage || 'Inspection');

                    if (index < currentStageIndex) {
                      displayStatus = 'completed';
                    } else if (index === currentStageIndex) {
                      displayStatus = 'in_progress';
                    } else {
                      displayStatus = 'pending';
                    }

                    // Override if DB explicitly says completed (for past stages)
                    if (stageData?.status === 'completed' && index <= currentStageIndex) {
                      displayStatus = 'completed';
                    }

                    const isCompleted = displayStatus === 'completed';
                    const isCurrent = displayStatus === 'in_progress';

                    return (
                      <div key={stage} className="relative pb-6 last:pb-0 pl-6">
                        <div className={cn(
                          "absolute -left-[21px] top-0 h-8 w-8 rounded-full border-4 border-background flex items-center justify-center shadow-sm z-10 transition-colors duration-300",
                          isCompleted ? "bg-green-500 text-white" :
                            isCurrent ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                              "bg-muted text-muted-foreground"
                        )}>
                          {isCompleted ? <CheckCircle2 className="h-4 w-4" /> :
                            isCurrent ? <Clock className="h-4 w-4 animate-pulse" /> :
                              <span className="text-xs font-bold">{index + 1}</span>}
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className={cn("font-medium", isCompleted ? "text-green-600" : isCurrent ? "text-primary font-bold" : "text-muted-foreground")}>
                              {stage}
                            </h5>
                            {/* Add descriptions if available from ProgressTracker.tsx patterns */}
                            {stage === 'Inspection' && <p className="text-[10px] text-muted-foreground hidden md:block">Initial vehicle inspection and diagnosis</p>}
                            {stage === 'Repair' && <p className="text-[10px] text-muted-foreground hidden md:block">Main repair and maintenance work</p>}
                            {stage === 'Review' && <p className="text-[10px] text-muted-foreground hidden md:block">Internal review of completed work</p>}
                            {stage === 'Quality Check' && <p className="text-[10px] text-muted-foreground hidden md:block">Quality assurance verification</p>}
                            {stage === 'Delivery' && <p className="text-[10px] text-muted-foreground hidden md:block">Final delivery preparation</p>}
                          </div>
                          <Badge variant={isCompleted ? "default" : isCurrent ? "secondary" : "outline"} className={cn(
                            "uppercase text-[10px]",
                            isCompleted ? "bg-green-600" : isCurrent ? "bg-primary/20 text-primary border-primary/20" : ""
                          )}>
                            {displayStatus.replace('_', ' ')}
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

      {/* Vehicle History Modal */}
      <Dialog
        open={!!viewingVehicleHistory}
        onOpenChange={() => setViewingVehicleHistory(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Service History - {viewingVehicleHistory?.vehicleNumber}
            </DialogTitle>
            <CardDescription>
              {(() => {
                // Pre-calculate unique checks
                const uniqueIds = new Set(viewingVehicleHistory?.history.map((h: any) => h.work_order_id));
                return uniqueIds.size || 0;
              })()} service record(s) found
            </CardDescription>
          </DialogHeader>

          {/* Vehicle Info */}
          {viewingVehicleHistory && (
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{viewingVehicleHistory.vehicleNumber}</h3>
                  <p className="text-sm text-muted-foreground">
                    Total Services: {new Set(viewingVehicleHistory.history.map((h: any) => h.work_order_id)).size}
                  </p>
                </div>
                {viewingVehicleHistory.history.length === 0 && (
                  <Badge variant="outline">No History</Badge>
                )}
              </div>
            </div>
          )}

          {/* History Table */}
          {viewingVehicleHistory && viewingVehicleHistory.history.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Work Summary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Completion Date</TableHead>
                    <TableHead>Bill Amount</TableHead>
                    <TableHead>Approved By</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    // Filter duplicates - keep the one with most info (e.g. approved_by populated)
                    const uniqueHistory = viewingVehicleHistory.history.reduce((acc: any[], current: any) => {
                      const existingIndex = acc.findIndex(item => item.work_order_id === current.work_order_id);
                      if (existingIndex === -1) {
                        acc.push(current);
                      } else {
                        // If current has approved_by and existing doesn't, replace it
                        if (current.approved_by && !acc[existingIndex].approved_by) {
                          acc[existingIndex] = current;
                        }
                        // Or if current has delivery_date and existing doesn't
                        else if (current.delivery_date && !acc[existingIndex].delivery_date) {
                          acc[existingIndex] = current;
                        }
                      }
                      return acc;
                    }, []);

                    return uniqueHistory.map((record: any) => {
                      // Find invoice for this work order
                      const recordInvoice = invoices.find(inv => inv.work_order_id === record.work_order_id);
                      // Find approver name
                      const approver = employees.find(e => e.id === record.approved_by || e.user_id === record.approved_by);

                      // Calculate paid/deducted
                      // Check for linked payments via payment_links first (fetched in `fetchData` but we only have invoices here)
                      // Ideally we'd have the fully processed invoice with paid_amount attached.
                      // Let's rely on the recordInvoice which we can enhance or use what we have.

                      // Actually, fetching logic for invoices was: 
                      // invoicesRes = await supabase.from("invoices").select("*, payments(status)").eq("customer_id", customerId);
                      // processedInvoices calculated `paid_amount` using `allLinks`
                      // So we should use `recordInvoice.paid_amount` if available, or fall back to payments array.

                      const paidAmount = (recordInvoice as any)?.paid_amount ||
                        recordInvoice?.payments?.filter((p: any) => p.status === 'approved').reduce((sum: number, p: any) => sum + (p.amount_applied || p.amount || 0), 0) || 0;

                      const deductionAmount = recordInvoice?.total_deductions || 0;

                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {record.service_type}
                            <div className="text-[10px] text-muted-foreground">{record.work_order_id ? record.work_order_id.slice(0, 8) : '-'}</div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {record.work_summary || record.service_description || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{record.status}</Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDateTime(record.service_date)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {record.delivery_date ? formatDateTime(record.delivery_date) :
                              (record.status === 'Completed' || record.status === 'Delivered') ? formatDateTime(record.created_at) : "-"}
                          </TableCell>
                          <TableCell>
                            {recordInvoice ? (
                              <div className="flex flex-col text-xs">
                                <span className="font-bold">₹{recordInvoice.total.toLocaleString()}</span>
                                <span className="text-green-600">Paid: ₹{paidAmount.toLocaleString()}</span>
                                {deductionAmount > 0 && <span className="text-orange-600">Ded: ₹{deductionAmount.toLocaleString()}</span>}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {approver ? approver.name : (record.approved_by ? "Admin" : "-")}
                          </TableCell>
                          <TableCell>
                            {recordInvoice && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleViewInvoice(recordInvoice)}
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>
          )}

          {viewingVehicleHistory && viewingVehicleHistory.history.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <h3 className="font-medium mb-2">No Service History</h3>
              <p className="text-sm">
                This vehicle doesn't have any completed service records yet.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingVehicleHistory(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Request Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Request Reschedule</DialogTitle>
            <DialogDescription>
              Select a new preferred date and provide a reason for the reschedule request.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {rescheduleAppointment && (
              <div className="text-sm text-muted-foreground bg-secondary/30 p-3 rounded-lg">
                <p><strong>Current Assigned Date:</strong> {format(new Date(rescheduleAppointment.scheduled_at), "PPP p")}</p>
                {rescheduleAppointment.requested_date && (
                  <p className="mt-1"><strong>Your Original Request:</strong> {format(new Date(rescheduleAppointment.requested_date), "PPP p")}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>New Preferred Date</Label>
              <CalendarUI
                mode="single"
                selected={rescheduleDate}
                onSelect={setRescheduleDate}
                className="rounded-md border mx-auto"
                disabled={(date) => date < new Date()}
              />
            </div>

            <div className="space-y-2">
              <Label>Reason for Reschedule</Label>
              <Textarea
                placeholder="Please explain why you need to reschedule..."
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRescheduleDialogOpen(false);
                setRescheduleDate(undefined);
                setRescheduleReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!rescheduleDate || !rescheduleReason.trim()) {
                  toast({
                    variant: "destructive",
                    title: "Missing Information",
                    description: "Please select a date and provide a reason."
                  });
                  return;
                }

                handleRequestReschedule(
                  rescheduleAppointment.id,
                  rescheduleDate,
                  rescheduleReason
                );

                setRescheduleDialogOpen(false);
                setRescheduleDate(undefined);
                setRescheduleReason("");
                setRescheduleAppointment(null);
              }}
              disabled={!rescheduleDate || !rescheduleReason.trim()}
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BookAppointmentDialog
        open={isBookingOpen}
        onOpenChange={setIsBookingOpen}
        customerId={customerId}
        onSuccess={() => {
          toast({ title: "Appointment Requested", description: "We will contact you shortly to confirm." });
          fetchData(); // Refresh to see if we want to show pending appointments somewhere? (Not implemented yet in activeWorkOrders, maybe in a new tab or just notification)
        }}
      />
    </div>
  );
}
