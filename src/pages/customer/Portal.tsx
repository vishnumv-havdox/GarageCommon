import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from '@supabase/supabase-js';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  LogOut, Truck, FileText, Wrench, RefreshCw,
  CheckCircle2, Clock, MapPin, ChevronDown, ChevronUp,
  AlertCircle, ShieldCheck, Hourglass, Activity, Eye, Calendar, History, SortAsc, SortDesc, Search,
  QrCode, CreditCard, Upload, Download
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { generateInvoicePDF } from "@/utils/pdfGenerator";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// Import Table components
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

// Import ProgressTracker component
import { CompactProgressTracker } from "@/components/work-orders/ProgressTracker";

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
  const [viewVehicleHistory, setViewVehicleHistory] = useState<any | null>(null);
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [historySortBy, setHistorySortBy] = useState<"date" | "vehicle" | "status">("date");

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
  const [viewingInvoicePayments, setViewingInvoicePayments] = useState<any[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

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
          .select('payment_qr_code_url, bank_details, company_name')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        data = res.data;
        error = res.error;
      } else {
        const res = await supabase
          .from('company_profiles')
          .select('payment_qr_code_url, bank_details, company_name')
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
      let adminClient: any = null;

      if (SERVICE_ROLE_KEY) {
        adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false }
        });

        // Use admin client to fetch vehicles for this customer (bypasses RLS)
        vehiclesRes = await adminClient
          .from("vehicles")
          .select("*")
          .eq("customer_id", customerId);

        invoicesRes = await supabase.from("invoices").select("*, payments(status)").eq("customer_id", customerId);
      } else {
        // Fallback to regular client
        [vehiclesRes, invoicesRes] = await Promise.all([
          supabase.from("vehicles").select("*").eq("customer_id", customerId),
          supabase.from("invoices").select("*, payments(status)").eq("customer_id", customerId),
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
        // Some older payments might be linked directly via invoice_id on the payments table
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

      debug += `Vehicles found: ${vehiclesRes.data?.length || 0}\n`;
      debug += `Invoices found: ${processedInvoices.length}\n`;
      setInvoices(processedInvoices);

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
            vehicle:vehicles(id, vehicle_number, model, customer_id)
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
        description: `You have ${unpaidInvoices.length} unpaid invoice(s). Please review them.`,
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
      const fileName = `proof-${invoicesToLink[0].id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

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
          (wo: any) => !["delivered", "completed", "cancelled", "approved"].includes(
            (wo.status || "").toLowerCase()
          )
        ).length;
      };
      return getActiveCount(b.id) - getActiveCount(a.id);
    });
  }, [vehicles, workOrdersById]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {profile?.logo_url ? (
              <img src={profile.logo_url} alt="Logo" className="h-10 w-10 object-contain rounded" />
            ) : (
              <Truck className="h-8 w-8 text-primary" />
            )}
            <div>
              <h1 className="text-2xl font-bold uppercase">{profile?.company_name || 'Customer Portal'}</h1>
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
              <CardTitle className="text-sm font-medium">Unpaid Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{invoices.filter((inv) => inv.status !== 'Paid' && inv.status !== 'Draft').length}</div>
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
            <TabsTrigger value="quotations">Quotations</TabsTrigger>
          </TabsList>

          <TabsContent value="vehicles">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>My Vehicles</CardTitle>
                    <CardDescription>
                      Detailed information about your registered vehicles
                    </CardDescription>
                  </div>
                  {serviceHistory.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setViewingVehicleHistory({
                          vehicleId: 'all',
                          vehicleNumber: 'All Vehicles',
                          history: serviceHistory
                        });
                      }}
                      className="flex items-center gap-2"
                    >
                      <History className="h-4 w-4" />
                      Common Service History
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {vehicles.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No vehicles registered yet</p>
                ) : (
                  <div className="space-y-4">
                    {sortedVehicles.map((vehicle) => {
                      const vehicleWorkOrders = Object.values(workOrdersById).filter(
                        (wo: any) => wo.vehicle_id === vehicle.id
                      );
                      const activeCount = vehicleWorkOrders.filter(
                        (wo: any) => !["delivered", "completed", "cancelled", "approved"].includes(
                          (wo.status || "").toLowerCase()
                        )
                      ).length;
                      const completedCount = vehicleWorkOrders.length - activeCount;

                      return (
                        <div
                          key={vehicle.id}
                          className={`border p-4 rounded-lg relative transition-all ${activeCount > 0 ? 'border-primary border-2 bg-primary/5 shadow-md' : 'bg-card'}`}
                        >
                          {activeCount > 0 && (
                            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] px-3 py-1 rounded-bl-lg font-medium flex items-center gap-1 shadow-sm z-10">
                              <Wrench className="h-3 w-3 animate-pulse" />
                              Service In Progress
                            </div>
                          )}
                          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 pt-2">
                            {/* Vehicle Main Info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-3">
                                <Truck className={`h-5 w-5 ${activeCount > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
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

                                {/* Service Tracking - New Section */}
                                <div className="md:col-span-2 mt-2 pt-2 border-t grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="text-muted-foreground">Odometer:</span>
                                    <span className="font-medium">
                                      {vehicle.kilometers_driven ? `${vehicle.kilometers_driven.toLocaleString()} km` : "N/A"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="text-muted-foreground">Next Service @:</span>
                                    <span className="font-medium">
                                      {vehicle.next_service_km ? `${vehicle.next_service_km.toLocaleString()} km` : "N/A"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="text-muted-foreground">Next Service Date:</span>
                                    <span className="font-medium">
                                      {vehicle.next_service_date
                                        ? new Date(vehicle.next_service_date).toLocaleDateString("en-IN", {
                                          day: "2-digit",
                                          month: "short",
                                          year: "numeric"
                                        })
                                        : "N/A"
                                      }
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Vehicle Stats */}
                            <div className="flex flex-col gap-2 min-w-[150px]">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    completedCount > 0 && activeCount === 0 ? "default" :
                                      activeCount > 0 ? "secondary" : "outline"
                                  }
                                  className={activeCount > 0 ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
                                >
                                  {completedCount > 0 && activeCount === 0 ? "Completed" :
                                    activeCount > 0 ? "In Progress" : "Available"}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                <span className={`font-medium ${activeCount > 0 ? 'text-primary' : 'text-blue-600'}`}>{activeCount}</span> active repairs
                              </div>
                              <div className="text-xs text-muted-foreground">
                                <span className="font-medium text-green-600">{completedCount}</span> completed
                              </div>

                              {/* History Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const vehicleHistory = serviceHistory.filter(h => h.vehicle_id === vehicle.id);
                                  setViewingVehicleHistory({
                                    vehicleId: vehicle.id,
                                    vehicleNumber: vehicle.vehicle_number,
                                    history: vehicleHistory
                                  });
                                }}
                                className="flex items-center gap-2 mt-2"
                              >
                                <History className="h-4 w-4" />
                                History
                              </Button>
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
                {invoices.filter(i => i.type !== 'quotation').length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No invoices yet</p>
                ) : (
                  <div className="space-y-4">
                    {invoices.filter(i => i.type !== 'Paid' && i.status !== 'Draft' && i.type !== 'quotation').length > 0 && (
                      <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{selectedInvoiceIds.length} Selected</Badge>
                          <span className="text-sm font-medium">
                            Total Due: ₹{invoices.filter(i => selectedInvoiceIds.includes(i.id)).reduce((sum, i) => sum + (i.balance || 0), 0).toLocaleString()}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          disabled={selectedInvoiceIds.length === 0}
                          onClick={() => {
                            const selected = invoices.filter(i => selectedInvoiceIds.includes(i.id));
                            setPayingInvoices(selected);
                          }}
                          className="bg-green-600 hover:bg-green-700 h-8"
                        >
                          <CreditCard className="h-4 w-4 mr-2" /> Pay Selected
                        </Button>
                      </div>
                    )}
                    {invoices.filter(i => i.type !== 'quotation').map((invoice) => {
                      const isPayable = invoice.status !== 'Paid' && invoice.status !== 'Draft' && invoice.status !== 'Payment Verification Pending' && !invoice.payments?.some((p: any) => p.status === 'pending');
                      return (
                        <div key={invoice.id} className="border p-4 rounded-lg bg-card/50">
                          <div className="flex items-start gap-4">
                            {isPayable && (
                              <div className="pt-2">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-600"
                                  checked={selectedInvoiceIds.includes(invoice.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedInvoiceIds(prev => [...prev, invoice.id]);
                                    } else {
                                      setSelectedInvoiceIds(prev => prev.filter(id => id !== invoice.id));
                                    }
                                  }}
                                />
                              </div>
                            )}
                            <div className="flex-1 flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-lg">
                                    {invoice.bill_number ? `Bill #${invoice.bill_number}` : invoice.invoice_number}
                                  </h3>
                                  <Badge variant={
                                    invoice.status === 'Paid' ? 'default' :
                                      invoice.status === 'Draft' ? 'secondary' :
                                        'destructive'
                                  } className={invoice.status === 'Paid' ? 'bg-green-600' : ''}>
                                    {invoice.status}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(invoice.created_at), "MMM d, yyyy")}
                                </p>
                                <div className="space-y-1 mt-2">
                                  <div className="text-lg font-bold">₹{invoice.balance.toLocaleString()} Due</div>
                                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                    Total Bill: ₹{invoice.total.toLocaleString()}
                                    {invoice.paid_amount > 0 && ` • Paid: ₹${invoice.paid_amount.toLocaleString()}`}
                                    {invoice.total_deductions > 0 && ` • Deductions: ₹${invoice.total_deductions.toLocaleString()}`}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-2"
                                  onClick={() => generateInvoicePDF(invoice.work_order_id)}
                                >
                                  <Download className="h-4 w-4" />
                                  Download PDF
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-2"
                                  onClick={() => handleViewInvoice(invoice)}
                                >
                                  <Eye className="h-4 w-4" />
                                  View
                                </Button>
                                {isPayable && (
                                  <Button
                                    size="sm"
                                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                                    onClick={() => setPayingInvoice(invoice)}
                                  >
                                    <CreditCard className="h-4 w-4" />
                                    {invoice.type === 'quotation' ? 'Pay Advance' : 'Pay Now'}
                                  </Button>
                                )}
                                {(invoice.status !== 'Paid' && (invoice.status === 'Payment Verification Pending' || invoice.payments?.some((p: any) => p.status === 'pending'))) && (
                                  <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                                    <Hourglass className="h-3 w-3 mr-1" /> Verifying
                                  </Badge>
                                )}
                              </div>
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

          <TabsContent value="quotations">
            <Card>
              <CardHeader><CardTitle>My Quotations</CardTitle></CardHeader>
              <CardContent>
                {invoices.filter(i => i.type === 'quotation').length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No quotations yet</p>
                ) : (
                  <div className="space-y-4">
                    {invoices.filter(i => i.type === 'quotation').map((invoice) => (
                      <div key={invoice.id} className="border p-4 rounded-lg bg-card/50">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg">
                                Quotation #{invoice.invoice_number}
                              </h3>
                              <Badge variant="outline" className="border-orange-500 text-orange-600">
                                Estimate
                              </Badge>
                              <Badge variant={
                                invoice.status === 'Paid' ? 'default' :
                                  invoice.status === 'Draft' ? 'secondary' :
                                    'destructive' // Finalized/Unpaid
                              } className={invoice.status === 'Paid' ? 'bg-green-600' : ''}>
                                {invoice.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(invoice.created_at), "MMM d, yyyy")}
                            </p>
                            <p className="text-lg font-bold mt-2">₹{(invoice.total || 0).toLocaleString()}</p>
                          </div>
                          <div className="flex items-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2"
                              onClick={() => generateInvoicePDF(invoice.work_order_id)}
                            >
                              <Download className="h-4 w-4" />
                              Download PDF
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2 ml-2"
                              onClick={() => handleViewInvoice(invoice)}
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </Button>
                            {(invoice.status !== 'Paid' && invoice.status !== 'Draft' && invoice.status !== 'Payment Verification Pending' && !invoice.payments?.some((p: any) => p.status === 'pending')) && (
                              <Button
                                size="sm"
                                className="flex items-center gap-2 ml-2 bg-green-600 hover:bg-green-700"
                                onClick={() => setPayingInvoice(invoice)}
                              >
                                <CreditCard className="h-4 w-4" />
                                Pay Advance
                              </Button>
                            )}
                            {(invoice.status !== 'Paid' && (invoice.status === 'Payment Verification Pending' || invoice.payments?.some((p: any) => p.status === 'pending'))) && (
                              <Badge variant="outline" className="ml-2 border-yellow-500 text-yellow-600">
                                <Hourglass className="h-3 w-3 mr-1" /> Verifying
                              </Badge>
                            )}
                          </div>
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

      {/* Payment Dialog */}
      <Dialog
        open={!!payingInvoice || payingInvoices.length > 0}
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
                : `Submit payment details for ${payingInvoice?.type === 'quotation' ? 'Quotation' : 'Invoice'} #${payingInvoice?.type === 'quotation' ? payingInvoice?.invoice_number : (payingInvoice?.bill_number || payingInvoice?.invoice_number)}`
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
              <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase tracking-widest pt-1 border-t border-muted-foreground/10">
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
              {viewingInvoice?.bill_number ? `Bill #${viewingInvoice.bill_number}` : viewingInvoice?.invoice_number}
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
                    <div className="flex justify-between items-center text-base font-black pt-1">
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
                        <div className={`absolute -left-[21px] top-0 h-8 w-8 rounded-full border-4 border-background flex items-center justify-center ${isCompleted ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
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
              {viewingVehicleHistory?.history.length || 0} service record(s) found
            </CardDescription>
          </DialogHeader>

          {/* Vehicle Info */}
          {viewingVehicleHistory && (
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{viewingVehicleHistory.vehicleNumber}</h3>
                  <p className="text-sm text-muted-foreground">
                    Total Services: {viewingVehicleHistory.history.length}
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
                    <TableHead>Approved By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewingVehicleHistory.history.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.service_type}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {record.work_summary || record.service_description || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{record.status}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(record.service_date)}</TableCell>
                      <TableCell>
                        {record.delivery_date ? formatDate(record.delivery_date) : "-"}
                      </TableCell>
                      <TableCell>{record.approved_by || "-"}</TableCell>
                    </TableRow>
                  ))}
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
    </div>
  );
}
