import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar, Wrench, AlertTriangle, Clock, CheckCircle2,
  Phone, Mail, MessageSquare, Car, Building2, User,
  Plus, Search, Filter, RefreshCw, ArrowUpRight, History,
  Check, ShieldAlert, Sparkles, AlertCircle, ChevronRight
} from "lucide-react";
import { format, differenceInDays, isPast, isToday, addDays, addMonths, addYears } from "date-fns";

export interface ServiceDueVehicle {
  id: string;
  vehicle_number: string;
  model: string | null;
  vehicle_type: string | null;
  year: number | null;
  kilometers_driven: number;
  next_service_km: number | null;
  next_service_date: string | null;
  status: string;
  customer_id: string;
  customer: {
    id: string;
    name: string;
    company_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  primary_contact_id: string | null;
  primary_contact: {
    id: string;
    name: string;
    designation: string | null;
    phone: string;
    alternate_phone: string | null;
    email: string | null;
    preferred_contact_method: string | null;
  } | null;
  last_service?: {
    id: string;
    service_type: string;
    service_description: string | null;
    service_date: string;
    odometer_reading: number | null;
    status: string;
  } | null;
  active_reminder?: {
    id: string;
    status: string;
    informed_at: string | null;
    notes: string | null;
  } | null;
}

export default function ServiceDue() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [vehicles, setVehicles] = useState<ServiceDueVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusTab, setStatusTab] = useState<"all" | "overdue" | "due_soon" | "upcoming" | "completed">("all");
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>("all");

  // Acknowledgment dialog state
  const [acknowledgingVehicle, setAcknowledgingVehicle] = useState<ServiceDueVehicle | null>(null);
  const [ackNotes, setAckNotes] = useState("");
  const [isSubmittingAck, setIsSubmittingAck] = useState(false);

  // History dialog state
  const [historyVehicle, setHistoryVehicle] = useState<ServiceDueVehicle | null>(null);
  const [vehicleHistoryList, setVehicleHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Add New Service dialog state
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  const [serviceVehicleId, setServiceVehicleId] = useState("");
  const [serviceOdometer, setServiceOdometer] = useState<number | "">("");
  const [serviceNextKm, setServiceNextKm] = useState<number | "">("");
  const [serviceNextDate, setServiceNextDate] = useState("");
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [serviceType, setServiceType] = useState("Periodic Maintenance");
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceContactId, setServiceContactId] = useState("");
  const [serviceNotes, setServiceNotes] = useState("");
  const [serviceCustomerContacts, setServiceCustomerContacts] = useState<any[]>([]);
  const [isSubmittingService, setIsSubmittingService] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch vehicles with customer, primary contact, and service tracking
      const { data: vData, error: vError } = await supabase
        .from("vehicles")
        .select(`
          id, vehicle_number, model, vehicle_type, year, kilometers_driven,
          next_service_km, next_service_date, status, customer_id, primary_contact_id,
          customer:customers(id, name, company_name, phone, email),
          primary_contact:customer_contacts(id, name, designation, phone, alternate_phone, email, preferred_contact_method)
        `)
        .order("vehicle_number", { ascending: true });

      if (vError) throw vError;

      const vehicleIds = (vData || []).map((v) => v.id);

      // 2. Fetch latest completed service for each vehicle
      let lastServicesMap: Record<string, any> = {};
      let remindersMap: Record<string, any> = {};

      if (vehicleIds.length > 0) {
        const { data: sData } = await supabase
          .from("service_history")
          .select("id, vehicle_id, service_type, service_description, service_date, odometer_reading, status")
          .in("vehicle_id", vehicleIds)
          .order("service_date", { ascending: false });

        (sData || []).forEach((s) => {
          if (!lastServicesMap[s.vehicle_id]) {
            lastServicesMap[s.vehicle_id] = s;
          }
        });

        // 3. Fetch active/pending reminders
        const { data: rData } = await supabase
          .from("service_reminders")
          .select("id, vehicle_id, status, informed_at, notes, due_date, due_km")
          .in("vehicle_id", vehicleIds)
          .order("created_at", { ascending: false });

        (rData || []).forEach((r) => {
          if (!remindersMap[r.vehicle_id]) {
            remindersMap[r.vehicle_id] = r;
          }
        });
      }

      const combined: ServiceDueVehicle[] = (vData || []).map((v: any) => ({
        ...v,
        kilometers_driven: v.kilometers_driven || 0,
        last_service: lastServicesMap[v.id] || null,
        active_reminder: remindersMap[v.id] || null,
      }));

      setVehicles(combined);
    } catch (error: any) {
      console.error("Error fetching service due data:", error);
      toast({
        title: "Failed to Load Services",
        description: error.message || "Could not retrieve vehicle service schedule",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute status for a vehicle
  const getVehicleServiceStatus = (v: ServiceDueVehicle) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const hasDueDate = !!v.next_service_date;
    const hasDueKm = typeof v.next_service_km === "number" && v.next_service_km > 0;

    let isDateOverdue = false;
    let isDateDueSoon = false;
    let isKmOverdue = false;
    let isKmDueSoon = false;

    let daysRemaining: number | null = null;
    let kmRemaining: number | null = null;

    if (hasDueDate) {
      const dueDate = new Date(v.next_service_date!);
      dueDate.setHours(0, 0, 0, 0);
      daysRemaining = differenceInDays(dueDate, today);

      if (daysRemaining < 0) isDateOverdue = true;
      else if (daysRemaining <= 7) isDateDueSoon = true;
    }

    if (hasDueKm) {
      kmRemaining = v.next_service_km! - (v.kilometers_driven || 0);
      if (kmRemaining < 0) isKmOverdue = true;
      else if (kmRemaining <= 500) isKmDueSoon = true;
    }

    // Determine category
    if (isDateOverdue || isKmOverdue) {
      return {
        category: "overdue" as const,
        label: "Overdue",
        color: "bg-rose-500/10 text-rose-600 border-rose-300 dark:border-rose-800",
        daysRemaining,
        kmRemaining,
      };
    }

    if (isDateDueSoon || isKmDueSoon) {
      return {
        category: "due_soon" as const,
        label: "Due Soon",
        color: "bg-amber-500/10 text-amber-600 border-amber-300 dark:border-amber-800",
        daysRemaining,
        kmRemaining,
      };
    }

    if (hasDueDate || hasDueKm) {
      return {
        category: "upcoming" as const,
        label: "Upcoming",
        color: "bg-blue-500/10 text-blue-600 border-blue-300 dark:border-blue-800",
        daysRemaining,
        kmRemaining,
      };
    }

    return {
      category: "completed" as const,
      label: "Serviced",
      color: "bg-emerald-500/10 text-emerald-600 border-emerald-300 dark:border-emerald-800",
      daysRemaining: null,
      kmRemaining: null,
    };
  };

  // Metrics count
  const metrics = useMemo(() => {
    let overdue = 0;
    let dueSoon = 0;
    let upcoming = 0;
    let completed = 0;

    vehicles.forEach((v) => {
      const s = getVehicleServiceStatus(v);
      if (s.category === "overdue") overdue++;
      else if (s.category === "due_soon") dueSoon++;
      else if (s.category === "upcoming") upcoming++;
      else completed++;
    });

    return { overdue, dueSoon, upcoming, completed, total: vehicles.length };
  }, [vehicles]);

  // Unique companies list for filtering
  const companyOptions = useMemo(() => {
    const map = new Map<string, string>();
    vehicles.forEach((v) => {
      if (v.customer) {
        const name = v.customer.company_name || v.customer.name;
        map.set(v.customer.id, name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [vehicles]);

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const serviceStatus = getVehicleServiceStatus(v);

      // Status tab filter
      if (statusTab !== "all" && serviceStatus.category !== statusTab) {
        return false;
      }

      // Company filter
      if (selectedCompanyFilter !== "all" && v.customer?.id !== selectedCompanyFilter) {
        return false;
      }

      // Search term filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const vNum = v.vehicle_number?.toLowerCase() || "";
        const model = v.model?.toLowerCase() || "";
        const company = (v.customer?.company_name || v.customer?.name || "").toLowerCase();
        const contact = (v.primary_contact?.name || v.customer?.name || "").toLowerCase();
        const phone = (v.primary_contact?.phone || v.customer?.phone || "").toLowerCase();

        return (
          vNum.includes(term) ||
          model.includes(term) ||
          company.includes(term) ||
          contact.includes(term) ||
          phone.includes(term)
        );
      }

      return true;
    });
  }, [vehicles, statusTab, selectedCompanyFilter, searchTerm]);

  // Handle "Informed / Okay" confirmation
  const handleAcknowledgeReminder = async () => {
    if (!acknowledgingVehicle) return;
    setIsSubmittingAck(true);

    try {
      const v = acknowledgingVehicle;
      const serviceStatus = getVehicleServiceStatus(v);

      if (v.active_reminder?.id) {
        // Update existing reminder
        const { error } = await supabase
          .from("service_reminders")
          .update({
            status: "informed",
            informed_at: new Date().toISOString(),
            informed_by: user?.id,
            notes: ackNotes.trim() || v.active_reminder.notes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", v.active_reminder.id);

        if (error) throw error;
      } else {
        // Create new acknowledged reminder record
        const { error } = await supabase
          .from("service_reminders")
          .insert({
            vehicle_id: v.id,
            due_date: v.next_service_date || null,
            due_km: v.next_service_km || null,
            service_type: v.last_service?.service_type || "Routine Service",
            service_description: `Acknowledged by ${user?.full_name || "Admin"}`,
            trigger_type: serviceStatus.kmRemaining !== null && serviceStatus.kmRemaining <= 500 ? "kilometer" : "date",
            status: "informed",
            informed_at: new Date().toISOString(),
            informed_by: user?.id,
            notes: ackNotes.trim() || "Customer / contact person confirmed informed",
          });

        if (error) throw error;
      }

      toast({
        title: "Reminder Acknowledged",
        description: `Service reminder for ${v.vehicle_number} marked as Informed / Okay`,
      });

      setAcknowledgingVehicle(null);
      setAckNotes("");
      fetchData();
    } catch (error: any) {
      console.error("Error acknowledging reminder:", error);
      toast({
        title: "Failed to Update",
        description: error.message || "Could not record acknowledgment",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingAck(false);
    }
  };

  // Fetch history for a vehicle
  const handleOpenHistory = async (v: ServiceDueVehicle) => {
    setHistoryVehicle(v);
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from("service_history")
        .select("*")
        .eq("vehicle_id", v.id)
        .order("service_date", { ascending: false });

      setVehicleHistoryList(data || []);
    } catch (err) {
      console.error("Error fetching vehicle history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Add New Service handlers
  const handleOpenAddServiceModal = async (v?: ServiceDueVehicle) => {
    const targetVehicle = v || (vehicles.length > 0 ? vehicles[0] : null);
    if (!targetVehicle) {
      toast({
        title: "No Vehicles Available",
        description: "Please add a vehicle first to record service.",
        variant: "destructive",
      });
      return;
    }

    setServiceVehicleId(targetVehicle.id);
    const currKm = targetVehicle.kilometers_driven || 0;
    setServiceOdometer(currKm);
    setServiceNextKm(targetVehicle.next_service_km || currKm + 10000);
    setServiceNextDate(targetVehicle.next_service_date || format(addMonths(new Date(), 6), "yyyy-MM-dd"));
    setServiceDate(new Date().toISOString().split("T")[0]);
    setServiceType("Periodic Maintenance");
    setServiceDescription("Routine vehicle service & inspection");
    setServiceContactId(targetVehicle.primary_contact_id || "");
    setServiceNotes("");

    if (targetVehicle.customer_id) {
      const { data: contacts } = await supabase
        .from("customer_contacts")
        .select("*")
        .eq("customer_id", targetVehicle.customer_id)
        .order("is_primary", { ascending: false });
      setServiceCustomerContacts(contacts || []);
    } else {
      setServiceCustomerContacts([]);
    }

    setIsAddServiceModalOpen(true);
  };

  const handleSelectServiceVehicle = async (vehId: string) => {
    setServiceVehicleId(vehId);
    const targetVehicle = vehicles.find((v) => v.id === vehId);
    if (targetVehicle) {
      const currKm = targetVehicle.kilometers_driven || 0;
      setServiceOdometer(currKm);
      setServiceNextKm(targetVehicle.next_service_km || currKm + 10000);
      setServiceNextDate(targetVehicle.next_service_date || format(addMonths(new Date(), 6), "yyyy-MM-dd"));
      setServiceContactId(targetVehicle.primary_contact_id || "");

      if (targetVehicle.customer_id) {
        const { data: contacts } = await supabase
          .from("customer_contacts")
          .select("*")
          .eq("customer_id", targetVehicle.customer_id)
          .order("is_primary", { ascending: false });
        setServiceCustomerContacts(contacts || []);
      } else {
        setServiceCustomerContacts([]);
      }
    }
  };

  const handleSaveNewService = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = vehicles.find((item) => item.id === serviceVehicleId);
    if (!v) {
      toast({
        title: "Please Select a Vehicle",
        description: "A vehicle must be selected to record service.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingService(true);
    try {
      const currentOdo = serviceOdometer !== "" ? Number(serviceOdometer) : v.kilometers_driven;
      const targetNextKm = serviceNextKm !== "" ? Number(serviceNextKm) : null;
      const targetNextDate = serviceNextDate || null;

      // 1. Update vehicle odometer & next service targets
      const { error: vError } = await supabase
        .from("vehicles")
        .update({
          kilometers_driven: currentOdo,
          next_service_km: targetNextKm,
          next_service_date: targetNextDate,
          primary_contact_id: serviceContactId || v.primary_contact_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", v.id);

      if (vError) throw vError;

      // 2. Insert into service_history
      const { error: hError } = await supabase
        .from("service_history")
        .insert({
          vehicle_id: v.id,
          service_type: serviceType.trim() || "Periodic Maintenance",
          service_description: serviceDescription.trim() || `${serviceType.trim()} completed`,
          service_date: serviceDate || new Date().toISOString().split("T")[0],
          odometer_reading: currentOdo,
          next_service_km: targetNextKm,
          next_service_date: targetNextDate,
          contact_id: serviceContactId || null,
          status: "Completed",
          approved_by: user?.id || null,
          work_summary: serviceNotes.trim() || `Service completed at ${currentOdo} km. Next due at ${targetNextKm ? `${targetNextKm} km` : "N/A"} / ${targetNextDate || "N/A"}.`,
        });

      if (hError) throw hError;

      // 3. Mark existing active reminder as completed
      if (v.active_reminder?.id) {
        await supabase
          .from("service_reminders")
          .update({
            status: "completed",
            updated_at: new Date().toISOString(),
            notes: `Vehicle serviced at ${currentOdo} KM on ${serviceDate}`,
          })
          .eq("id", v.active_reminder.id);
      }

      toast({
        title: "Service Recorded Successfully",
        description: `Next service target for ${v.vehicle_number} scheduled for ${targetNextKm ? `${targetNextKm.toLocaleString()} KM` : ""}${targetNextDate ? ` on ${targetNextDate}` : ""}`,
      });

      setIsAddServiceModalOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error saving service:", error);
      toast({
        title: "Failed to Save Service",
        description: error.message || "Could not record service details",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingService(false);
    }
  };

  const selectedServiceVehicle = useMemo(() => vehicles.find((v) => v.id === serviceVehicleId), [vehicles, serviceVehicleId]);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-muted/5">
      <AdminSidebar />

      <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full min-h-screen">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2 border-b border-border/40">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                <Wrench className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground">
                  Vehicle Service Due & Reminders
                </h1>
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Upcoming Mileage & Date-Based Maintenance Telemetry
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="rounded-xl h-9 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={() => handleOpenAddServiceModal()}
              className="rounded-xl h-9 text-xs shadow-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add New Service
            </Button>
          </div>
        </div>

        {/* 4 Metric Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card
            className={`border rounded-2xl shadow-xs transition-all cursor-pointer ${
              statusTab === "overdue" ? "ring-2 ring-rose-500 bg-rose-50/20" : "hover:border-rose-300"
            }`}
            onClick={() => setStatusTab("overdue")}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Overdue
                </span>
                <p className="text-2xl font-black text-rose-600 leading-none">{metrics.overdue}</p>
                <p className="text-[10px] text-muted-foreground">Passed date or limit</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card
            className={`border rounded-2xl shadow-xs transition-all cursor-pointer ${
              statusTab === "due_soon" ? "ring-2 ring-amber-500 bg-amber-50/20" : "hover:border-amber-300"
            }`}
            onClick={() => setStatusTab("due_soon")}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Due Soon
                </span>
                <p className="text-2xl font-black text-amber-600 leading-none">{metrics.dueSoon}</p>
                <p className="text-[10px] text-muted-foreground">Within 7d / 500 km</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                <Clock className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card
            className={`border rounded-2xl shadow-xs transition-all cursor-pointer ${
              statusTab === "upcoming" ? "ring-2 ring-blue-500 bg-blue-50/20" : "hover:border-blue-300"
            }`}
            onClick={() => setStatusTab("upcoming")}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Upcoming
                </span>
                <p className="text-2xl font-black text-blue-600 leading-none">{metrics.upcoming}</p>
                <p className="text-[10px] text-muted-foreground">On scheduled track</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                <Calendar className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card
            className={`border rounded-2xl shadow-xs transition-all cursor-pointer ${
              statusTab === "completed" ? "ring-2 ring-emerald-500 bg-emerald-50/20" : "hover:border-emerald-300"
            }`}
            onClick={() => setStatusTab("completed")}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Serviced
                </span>
                <p className="text-2xl font-black text-emerald-600 leading-none">{metrics.completed}</p>
                <p className="text-[10px] text-muted-foreground">Recently maintained</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter and Search Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-card p-3 rounded-2xl border shadow-xs">
          <div className="flex-1 relative min-w-[240px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search vehicle number, model, company, or contact..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 rounded-xl h-9 text-xs border-muted"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCompanyFilter}
              onChange={(e) => setSelectedCompanyFilter(e.target.value)}
              className="h-9 px-3 text-xs rounded-xl border border-input bg-background font-medium focus:outline-hidden"
            >
              <option value="all">All Companies</option>
              {companyOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusTab("all");
                setSelectedCompanyFilter("all");
                setSearchTerm("");
              }}
              className="h-9 text-xs rounded-xl"
            >
              Reset
            </Button>
          </div>
        </div>

        {/* Category Tabs */}
        <Tabs value={statusTab} onValueChange={(v: any) => setStatusTab(v)}>
          <TabsList className="grid grid-cols-5 w-full max-w-2xl bg-muted/70 p-1 rounded-xl">
            <TabsTrigger value="all" className="rounded-lg text-xs font-semibold">
              All ({metrics.total})
            </TabsTrigger>
            <TabsTrigger value="overdue" className="rounded-lg text-xs font-semibold text-rose-600">
              Overdue ({metrics.overdue})
            </TabsTrigger>
            <TabsTrigger value="due_soon" className="rounded-lg text-xs font-semibold text-amber-600">
              Due Soon ({metrics.dueSoon})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="rounded-lg text-xs font-semibold text-blue-600">
              Upcoming ({metrics.upcoming})
            </TabsTrigger>
            <TabsTrigger value="completed" className="rounded-lg text-xs font-semibold text-emerald-600">
              Serviced ({metrics.completed})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Main Vehicles Table / List */}
        <div className="space-y-3">
          {loading ? (
            <div className="p-12 text-center bg-card rounded-2xl border border-dashed text-muted-foreground space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
              <p className="text-sm font-medium">Scanning fleet schedules & kilometer records...</p>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="p-12 text-center bg-card rounded-2xl border border-dashed text-muted-foreground space-y-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Car className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-base text-foreground">No Vehicles in this Category</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No fleet vehicles match the selected filter criteria. Check back or clear filters.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusTab("all");
                  setSelectedCompanyFilter("all");
                  setSearchTerm("");
                }}
                className="rounded-xl text-xs"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            filteredVehicles.map((v) => {
              const status = getVehicleServiceStatus(v);
              const companyName = v.customer?.company_name || v.customer?.name || "Private Vehicle";
              const contactPerson = v.primary_contact || (v.customer ? {
                id: v.customer.id,
                name: v.customer.name,
                designation: "Owner / Primary",
                phone: v.customer.phone || "",
                alternate_phone: null,
                email: v.customer.email || null,
                preferred_contact_method: "phone",
              } : null);

              const isAcknowledged = v.active_reminder?.status === "informed";

              return (
                <div
                  key={v.id}
                  className="bg-card border rounded-2xl p-4 sm:p-5 shadow-xs hover:border-primary/40 transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                >
                  {/* Left: Vehicle Identity & Company */}
                  <div className="flex items-start gap-3.5 min-w-[260px]">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Car className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-base tracking-wide text-foreground uppercase">
                          {v.vehicle_number}
                        </span>
                        <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0.5 border ${status.color}`}>
                          {status.label}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground mt-0.5">
                        {v.model || "Vehicle"} {v.year ? `(${v.year})` : ""} • {v.vehicle_type || "Commercial"}
                      </p>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/90 font-medium mt-1">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        <span className="truncate max-w-[200px]">{companyName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Mileage & Timeline Telemetry */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto text-left py-2 lg:py-0 border-y lg:border-y-0 border-border/40">
                    {/* Mileage */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Current KM
                      </span>
                      <p className="text-sm font-bold text-foreground">
                        {v.kilometers_driven.toLocaleString()} KM
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Next: {v.next_service_km ? `${v.next_service_km.toLocaleString()} KM` : "Not Set"}
                      </p>
                    </div>

                    {/* Remaining KM */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        KM Remaining
                      </span>
                      {status.kmRemaining !== null ? (
                        <p
                          className={`text-sm font-black ${
                            status.kmRemaining < 0
                              ? "text-rose-600"
                              : status.kmRemaining <= 500
                              ? "text-amber-600"
                              : "text-blue-600"
                          }`}
                        >
                          {status.kmRemaining < 0
                            ? `Over by ${Math.abs(status.kmRemaining).toLocaleString()} KM`
                            : `${status.kmRemaining.toLocaleString()} KM`}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">—</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">Interval target</p>
                    </div>

                    {/* Due Date & Countdown */}
                    <div className="space-y-0.5 col-span-2 sm:col-span-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Due Date
                      </span>
                      <p className="text-sm font-bold text-foreground">
                        {v.next_service_date ? format(new Date(v.next_service_date), "dd MMM yyyy") : "Not Set"}
                      </p>
                      {status.daysRemaining !== null ? (
                        <p
                          className={`text-[11px] font-bold ${
                            status.daysRemaining < 0
                              ? "text-rose-600"
                              : status.daysRemaining <= 7
                              ? "text-amber-600"
                              : "text-blue-600"
                          }`}
                        >
                          {status.daysRemaining < 0
                            ? `Overdue by ${Math.abs(status.daysRemaining)} days`
                            : status.daysRemaining === 0
                            ? "Due Today"
                            : `${status.daysRemaining} days left`}
                        </p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>

                  {/* Contact Person Details */}
                  <div className="w-full lg:w-56 p-2.5 rounded-xl bg-muted/40 border text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground truncate max-w-[130px]">
                        {contactPerson?.name || "No Contact"}
                      </span>
                      {contactPerson?.designation && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 font-medium">
                          {contactPerson.designation}
                        </Badge>
                      )}
                    </div>

                    {contactPerson?.phone && (
                      <div className="flex items-center justify-between pt-1 text-[11px]">
                        <span className="text-muted-foreground">{contactPerson.phone}</span>
                        <div className="flex items-center gap-1">
                          <a
                            href={`tel:${contactPerson.phone}`}
                            className="p-1 hover:bg-muted rounded text-primary"
                            title="Call Contact"
                          >
                            <Phone className="h-3 w-3" />
                          </a>
                          <a
                            href={`https://wa.me/91${contactPerson.phone.replace(/\D/g, "").slice(-10)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:bg-muted rounded text-emerald-600"
                            title="WhatsApp Contact"
                          >
                            <MessageSquare className="h-3 w-3" />
                          </a>
                          {contactPerson?.email && (
                            <a
                              href={`mailto:${contactPerson.email}`}
                              className="p-1 hover:bg-muted rounded text-blue-600"
                              title="Email Contact"
                            >
                              <Mail className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
                    {/* Informed / Okay Button */}
                    {isAcknowledged ? (
                      <Badge variant="outline" className="h-9 px-3 text-emerald-600 bg-emerald-50/50 border-emerald-300 gap-1 text-xs">
                        <Check className="h-3.5 w-3.5" /> Informed
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAcknowledgingVehicle(v);
                          setAckNotes("");
                        }}
                        className="rounded-xl h-9 text-xs border-amber-300 hover:bg-amber-50 text-amber-700"
                        title="Confirm customer or fleet coordinator has been informed"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Informed / Okay
                      </Button>
                    )}

                    {/* Add Service Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenAddServiceModal(v)}
                      className="rounded-xl h-9 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10 gap-1"
                      title="Record service and schedule next due date/km"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Service
                    </Button>

                    {/* Create Work Order */}
                    <Button
                      size="sm"
                      onClick={() =>
                        navigate(
                          `/admin/work-orders?create=true&vehicleId=${v.id}&customerId=${v.customer?.id || ""}`
                        )
                      }
                      className="rounded-xl h-9 text-xs font-semibold shadow-xs"
                    >
                      <Wrench className="h-3.5 w-3.5 mr-1" />
                      Create Job Card
                    </Button>

                    {/* View History Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenHistory(v)}
                      className="rounded-xl h-9 w-9 text-muted-foreground hover:text-foreground"
                      title="View Service History"
                    >
                      <History className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Acknowledge Confirmation Dialog */}
      <Dialog
        open={!!acknowledgingVehicle}
        onOpenChange={(open) => !open && setAcknowledgingVehicle(null)}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Acknowledge Service Reminder
            </DialogTitle>
            <DialogDescription>
              Mark {acknowledgingVehicle?.vehicle_number} as <strong>Informed / Okay</strong>. This confirmation is logged in the audit record and silences future alerts for this maintenance cycle.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-3 bg-muted/50 rounded-xl text-xs space-y-1">
              <p>
                <strong>Vehicle:</strong> {acknowledgingVehicle?.vehicle_number} (
                {acknowledgingVehicle?.model || "Commercial"})
              </p>
              <p>
                <strong>Company:</strong>{" "}
                {acknowledgingVehicle?.customer?.company_name || acknowledgingVehicle?.customer?.name}
              </p>
              <p>
                <strong>Contact:</strong>{" "}
                {acknowledgingVehicle?.primary_contact?.name || acknowledgingVehicle?.customer?.name} (
                {acknowledgingVehicle?.primary_contact?.phone || acknowledgingVehicle?.customer?.phone || "No phone"})
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ackNotes" className="text-xs">
                Acknowledgment Note (Optional)
              </Label>
              <Textarea
                id="ackNotes"
                placeholder="e.g. Spoke with manager, vehicle scheduled to arrive next Tuesday..."
                value={ackNotes}
                onChange={(e) => setAckNotes(e.target.value)}
                rows={3}
                className="text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setAcknowledgingVehicle(null)}
              disabled={isSubmittingAck}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAcknowledgeReminder}
              disabled={isSubmittingAck}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {isSubmittingAck ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Check className="h-4 w-4 mr-1.5" />
              )}
              Confirm Informed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle Service History Dialog */}
      <Dialog
        open={!!historyVehicle}
        onOpenChange={(open) => !open && setHistoryVehicle(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-primary" />
              Service History: {historyVehicle?.vehicle_number}
            </DialogTitle>
            <DialogDescription>
              Past completed maintenance records and odometer logs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {loadingHistory ? (
              <div className="p-8 text-center text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto text-primary" />
              </div>
            ) : vehicleHistoryList.length === 0 ? (
              <div className="p-8 text-center bg-muted/30 rounded-xl text-xs text-muted-foreground">
                No past service history records recorded yet.
              </div>
            ) : (
              vehicleHistoryList.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3.5 border rounded-xl bg-card flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{rec.service_type}</span>
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600">
                        {rec.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">{rec.service_description || rec.work_summary}</p>
                    {rec.odometer_reading && (
                      <p className="text-[11px] text-muted-foreground font-medium">
                        Odometer: {rec.odometer_reading.toLocaleString()} KM
                      </p>
                    )}
                  </div>
                  <div className="text-right text-muted-foreground whitespace-nowrap shrink-0">
                    <p className="font-semibold text-foreground">
                      {format(new Date(rec.service_date), "dd MMM yyyy")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add New Service Dialog */}
      <Dialog
        open={isAddServiceModalOpen}
        onOpenChange={(open) => !open && setIsAddServiceModalOpen(false)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-0 gap-0">
          <DialogHeader className="p-5 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Add New Service</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Record vehicle service details, update current mileage, and schedule the next service milestone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveNewService} className="p-5 space-y-4">
            {/* 1. Vehicle Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Vehicle *</Label>
              <Select value={serviceVehicleId} onValueChange={handleSelectServiceVehicle}>
                <SelectTrigger className="h-10 text-xs bg-background">
                  <SelectValue placeholder="Choose a vehicle..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {vehicles.map((veh) => {
                    const custName = veh.customer?.company_name || veh.customer?.name || "Customer";
                    return (
                      <SelectItem key={veh.id} value={veh.id} className="text-xs">
                        <span className="font-bold">{veh.vehicle_number}</span> — {veh.model || "Vehicle"} ({custName})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Selected Vehicle & Customer Details Summary Card */}
            {selectedServiceVehicle && (
              <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-primary/10">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-primary" />
                    <span className="font-bold text-sm text-foreground">
                      {selectedServiceVehicle.vehicle_number}
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-background">
                      {selectedServiceVehicle.model || "Vehicle"} {selectedServiceVehicle.year ? `(${selectedServiceVehicle.year})` : ""}
                    </Badge>
                  </div>
                  <span className="text-[11px] font-mono font-medium text-muted-foreground">
                    Current Odo: {(selectedServiceVehicle.kilometers_driven || 0).toLocaleString()} KM
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">
                      <strong className="text-foreground">Company:</strong>{" "}
                      {selectedServiceVehicle.customer?.company_name || selectedServiceVehicle.customer?.name || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">
                      <strong className="text-foreground">Contact:</strong>{" "}
                      {selectedServiceVehicle.primary_contact?.name || selectedServiceVehicle.customer?.name || "—"}
                      {selectedServiceVehicle.primary_contact?.phone && ` (${selectedServiceVehicle.primary_contact.phone})`}
                    </span>
                  </div>
                </div>

                {selectedServiceVehicle.last_service && (
                  <div className="pt-2 border-t border-primary/10 text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>
                      <strong>Last Service:</strong> {selectedServiceVehicle.last_service.service_type} on{" "}
                      {format(new Date(selectedServiceVehicle.last_service.service_date), "dd MMM yyyy")}
                    </span>
                    {selectedServiceVehicle.last_service.odometer_reading && (
                      <span>{selectedServiceVehicle.last_service.odometer_reading.toLocaleString()} KM</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 3. Service Data Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Service Date */}
              <div className="space-y-1.5">
                <Label className="text-xs">Service Date *</Label>
                <Input
                  type="date"
                  className="h-9 text-xs bg-background"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  required
                />
              </div>

              {/* Current Odometer */}
              <div className="space-y-1.5">
                <Label className="text-xs">Current Odometer (KM) *</Label>
                <Input
                  type="number"
                  className="h-9 text-xs bg-background"
                  placeholder="e.g. 45000"
                  value={serviceOdometer}
                  onChange={(e) => setServiceOdometer(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                />
              </div>

              {/* Service Type */}
              <div className="space-y-1.5">
                <Label className="text-xs">Service Type *</Label>
                <Input
                  list="service-types-list"
                  className="h-9 text-xs bg-background"
                  placeholder="e.g. Periodic Maintenance"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  required
                />
                <datalist id="service-types-list">
                  <option value="Periodic Maintenance" />
                  <option value="Engine Oil & Filter Change" />
                  <option value="Brake Pad Replacement & Fluid" />
                  <option value="Tire Rotation & Wheel Alignment" />
                  <option value="AC Filter & Gas Top-up" />
                  <option value="Major Inspection (40k / 80k km)" />
                  <option value="Battery Check & Electricals" />
                  <option value="Suspension Overhaul" />
                </datalist>
              </div>

              {/* Assigned Contact Person */}
              <div className="space-y-1.5">
                <Label className="text-xs">Service Contact Person</Label>
                <Select value={serviceContactId} onValueChange={setServiceContactId}>
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Select contact..." />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceCustomerContacts.length > 0 ? (
                      serviceCustomerContacts.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.name} {c.designation ? `(${c.designation})` : ""} {c.phone ? `• ${c.phone}` : ""}
                        </SelectItem>
                      ))
                    ) : selectedServiceVehicle?.primary_contact ? (
                      <SelectItem value={selectedServiceVehicle.primary_contact.id} className="text-xs">
                        {selectedServiceVehicle.primary_contact.name} ({selectedServiceVehicle.primary_contact.designation || "Contact"})
                      </SelectItem>
                    ) : (
                      <SelectItem value="none" disabled className="text-xs">
                        No contacts recorded
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Service Description */}
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">Service Description</Label>
                <Input
                  className="h-9 text-xs bg-background"
                  placeholder="e.g. Full synthetic oil change, oil filter, air filter, and multi-point check"
                  value={serviceDescription}
                  onChange={(e) => setServiceDescription(e.target.value)}
                />
              </div>

              {/* NEXT SERVICE MILESTONES */}
              <div className="sm:col-span-2 p-3.5 rounded-xl border border-dashed bg-muted/30 space-y-3 mt-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                    Next Service Schedule Targets
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Next Service Kilometer */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Next Service Kilometer (KM)</Label>
                    <Input
                      type="number"
                      className="h-9 text-xs bg-background font-mono font-medium"
                      placeholder="e.g. 55000"
                      value={serviceNextKm}
                      onChange={(e) => setServiceNextKm(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-muted-foreground">Presets:</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-5 text-[10px] px-1.5 bg-muted hover:bg-muted/80 text-foreground"
                        onClick={() => setServiceNextKm(Number(serviceOdometer || 0) + 5000)}
                      >
                        +5k km
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-5 text-[10px] px-1.5 bg-muted hover:bg-muted/80 text-foreground"
                        onClick={() => setServiceNextKm(Number(serviceOdometer || 0) + 10000)}
                      >
                        +10k km
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-5 text-[10px] px-1.5 bg-muted hover:bg-muted/80 text-foreground"
                        onClick={() => setServiceNextKm(Number(serviceOdometer || 0) + 15000)}
                      >
                        +15k km
                      </Button>
                    </div>
                  </div>

                  {/* Next Service Due Date */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Next Service Due Date</Label>
                    <Input
                      type="date"
                      className="h-9 text-xs bg-background font-mono font-medium"
                      value={serviceNextDate}
                      onChange={(e) => setServiceNextDate(e.target.value)}
                    />
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-muted-foreground">Presets:</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-5 text-[10px] px-1.5 bg-muted hover:bg-muted/80 text-foreground"
                        onClick={() => setServiceNextDate(format(addMonths(new Date(), 3), "yyyy-MM-dd"))}
                      >
                        +3 Mo
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-5 text-[10px] px-1.5 bg-muted hover:bg-muted/80 text-foreground"
                        onClick={() => setServiceNextDate(format(addMonths(new Date(), 6), "yyyy-MM-dd"))}
                      >
                        +6 Mo
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-5 text-[10px] px-1.5 bg-muted hover:bg-muted/80 text-foreground"
                        onClick={() => setServiceNextDate(format(addYears(new Date(), 1), "yyyy-MM-dd"))}
                      >
                        +1 Yr
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Notes */}
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">Service & Workshop Notes (Optional)</Label>
                <Textarea
                  rows={2}
                  className="text-xs bg-background resize-none"
                  placeholder="Enter remarks, parts replaced, customer requests, or inspection findings..."
                  value={serviceNotes}
                  onChange={(e) => setServiceNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setIsAddServiceModalOpen(false)}
                disabled={isSubmittingService}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={isSubmittingService || !serviceVehicleId}
              >
                {isSubmittingService ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Save & Set Next Service
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
