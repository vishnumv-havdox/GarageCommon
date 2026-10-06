import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Users,
  Truck,
  ClipboardList,
  Package,
  FileText,
  BarChart3,
  Shield,
  Plus,
  User,
  IndianRupee,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCircle2,
  LayoutDashboard,
  Wrench,
  Activity,
  History as HistoryIcon,
  AlertCircle,
  Receipt,
  Calendar,
  Sparkles
} from "lucide-react";
import { GarageClock } from "@/components/dashboard/GarageClock";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { format, subDays, startOfMonth, endOfMonth, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useRequests } from "@/contexts/RequestsContext";

export default function AdminDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { urgentAppointments } = useRequests();

  // State
  const [finData, setFinData] = useState<any>(null);
  const [opData, setOpData] = useState<any>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [recentWOs, setRecentWOs] = useState<any[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [pendingBillCount, setPendingBillCount] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const startDate = startOfMonth(new Date()).toISOString();
      const endDate = endOfMonth(new Date()).toISOString();

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const [finRes, opRes, inventoryRes, paymentsRes, woRes, billsRes, appointmentsRes]: any[] = await Promise.all([
        // 1. Financial Analytics
        (supabase.rpc as any)("get_financial_analytics_v2", {
          p_start_date: startDate,
          p_end_date: endDate,
        }),
        // 2. Operational Analytics
        (supabase.rpc as any)("get_operational_analytics", {
          p_start_date: subDays(new Date(), 30).toISOString(),
          p_end_date: new Date().toISOString(),
        }),
        // 3. Low Stock Items
        supabase
          .from("inventory")
          .select("id, item_name, available_qty, reorder_level, sku")
          .limit(100),
        // 4. Pending Payments
        supabase
          .from("payments")
          .select("*, invoices(customer:customers(name))")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(5),
        // 5. Active Work Orders
        supabase
          .from("work_orders")
          .select("*, vehicles(vehicle_number, model, customer:customers(name, company_name))")
          .not("status", "in", '("Completed","Delivered","Cancelled","Rejected")')
          .order("created_at", { ascending: false })
          .limit(7),
        // 6. Pending Bills (Drafts + Generated/Unpaid)
        supabase
          .from("invoices")
          .select("*", { count: "exact", head: true })
          .in("status", ["Draft", "Generated"]),
        // 7. Today's Appointments
        supabase
          .from("appointments")
          .select(`
            id,
            scheduled_at,
            status,
            type,
            notes,
            services:appointment_services(service_name),
            vehicle:vehicles(vehicle_number, model),
            customer:customers(name, phone)
          `)
          .gte("scheduled_at", todayStart.toISOString())
          .lte("scheduled_at", todayEnd.toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(6),
      ]);

      if (finRes.data) setFinData(finRes.data);
      if (opRes.data) setOpData(opRes.data);

      const lowStockItems = (inventoryRes.data || [])
        .filter((item: any) => item.available_qty <= item.reorder_level)
        .slice(0, 5);
      setLowStock(lowStockItems);

      setPendingPayments(
        (paymentsRes.data || []).map((p: any) => ({
          ...p,
          customers: p.invoices?.customer,
        }))
      );
      setRecentWOs(woRes.data || []);
      setPendingBillCount(billsRes.count || 0);
      setTodayAppointments(appointmentsRes.data || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const counts: Record<string, number> = {};
  if (opData?.status_counts) {
    Object.entries(opData.status_counts).forEach(([k, v]) => {
      counts[k.toLowerCase().trim()] = v as number;
    });
  }

  const getCount = (keys: string[]) =>
    keys.reduce((sum, key) => sum + (counts[key.toLowerCase()] || 0), 0);

  const pendingCount = getCount(["Pending", "New"]);
  const ongoingCount = getCount([
    "In Progress",
    "Accepted",
    "Under QC",
    "Inspection",
    "Repair",
    "Review",
    "Quality Check",
    "Pending Approval",
  ]);
  const readyCount = getCount(["Ready", "Ready for Delivery"]);
  const completedCount = getCount(["Completed", "Approved", "Delivered"]);

  const getStageBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
      case "new":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300";
      case "in progress":
      case "repair":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300";
      case "ready":
      case "ready for delivery":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300";
      case "under qc":
      case "quality check":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-background">
      <div className="flex flex-col lg:flex-row">
        <AdminSidebar />

        <main className="flex-1 p-4 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Header & Quick Action Hub */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 pb-2 border-b border-border/40">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                  <LayoutDashboard className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground">
                    Workshop Command Center
                  </h1>
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live Floor Status & Operational Telemetry
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions & Workshop Clock */}
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-between xl:justify-end">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full pb-1">
                <Button
                  onClick={() => navigate("/admin/work-orders?create=true")}
                  className="rounded-xl shadow-sm font-semibold h-10 px-4 text-xs gap-1.5 shrink-0 whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" /> New Job Card
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/admin/appointments")}
                  className="rounded-xl shadow-sm font-semibold h-10 px-4 text-xs gap-1.5 bg-card hover:bg-muted shrink-0 whitespace-nowrap"
                >
                  <Calendar className="h-4 w-4 text-blue-600" /> Book Appointment
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/admin/invoices")}
                  className="rounded-xl shadow-sm font-semibold h-10 px-4 text-xs gap-1.5 bg-card hover:bg-muted shrink-0 whitespace-nowrap"
                >
                  <Receipt className="h-4 w-4 text-emerald-600" /> Invoices
                </Button>
              </div>

              <div className="hidden sm:block">
                <GarageClock />
              </div>
            </div>
          </div>

          {/* Clean Modern KPI Summary Cards (Minimalist Workshop ERP Design) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card
              className="bg-card border-border/70 hover:border-emerald-500/50 shadow-sm transition-all hover:shadow-md cursor-pointer group"
              onClick={() => navigate("/admin/ledger")}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Collected Revenue
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                    <IndianRupee className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl lg:text-3xl font-extrabold text-foreground tracking-tight">
                  ₹{finData?.collected_payments?.toLocaleString() || "0"}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                  <span>Billed: ₹{finData?.total_revenue?.toLocaleString() || "0"}</span>
                  <span className="text-emerald-600 font-bold">
                    {finData?.realization_rate?.toFixed(0) || "0"}% rate
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card
              className="bg-card border-border/70 hover:border-blue-500/50 shadow-sm transition-all hover:shadow-md cursor-pointer group"
              onClick={() => navigate("/admin/work-orders?filter=ongoing")}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Vehicles In Floor
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                    <Wrench className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl lg:text-3xl font-extrabold text-foreground tracking-tight">
                  {ongoingCount}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                  <span>{pendingCount} awaiting triage</span>
                  <span className="text-blue-600 font-bold">{readyCount} ready</span>
                </div>
              </CardContent>
            </Card>

            <Card
              className="bg-card border-border/70 hover:border-amber-500/50 shadow-sm transition-all hover:shadow-md cursor-pointer group"
              onClick={() => navigate("/admin/invoices")}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Pending Invoices
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
                    <Receipt className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl lg:text-3xl font-extrabold text-foreground tracking-tight">
                  {pendingBillCount}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                  <span>Drafts & unbilled jobs</span>
                  <span className="text-amber-600 font-bold group-hover:underline">Review &rarr;</span>
                </div>
              </CardContent>
            </Card>

            <Card
              className="bg-card border-border/70 hover:border-purple-500/50 shadow-sm transition-all hover:shadow-md cursor-pointer group"
              onClick={() => navigate("/admin/work-orders?filter=completed")}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Completed (30d)
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl lg:text-3xl font-extrabold text-foreground tracking-tight">
                  {completedCount}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                  <span>Delivered to customers</span>
                  <span className="text-purple-600 font-bold">100% QC</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Urgent Alert Banner if appointments need Job Cards */}
          {urgentAppointments > 0 && (
            <div className="p-4 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 dark:bg-rose-900/50 text-rose-600 rounded-xl shrink-0">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                    {urgentAppointments} Confirmed Appointment(s) Awaiting Job Cards
                  </h3>
                  <p className="text-xs text-rose-700/80 dark:text-rose-300">
                    Vehicles are scheduled for today. Open job cards to start inspection and repairs.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="rounded-xl text-xs font-bold shrink-0"
                onClick={() => navigate("/admin/work-orders")}
              >
                Open Job Cards &rarr;
              </Button>
            </div>
          )}

          {/* Clear Operational Layout (Adaptive Mobile, Tablet & Desktop) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Column 1: Today's Schedule & Arrivals */}
            <Card className="bg-card border-border/70 shadow-sm rounded-2xl flex flex-col">
              <CardHeader className="pb-3 border-b border-border/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-sm font-bold">Today's Schedule & Arrivals</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary font-medium px-2"
                    onClick={() => navigate("/admin/appointments")}
                  >
                    View All
                  </Button>
                </div>
                <CardDescription className="text-[11px]">
                  Bookings and customer vehicle drop-offs for today
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  {todayAppointments.length === 0 ? (
                    <div className="py-10 text-center">
                      <Calendar className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-foreground">No bookings today</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Walk-in vehicles can be added via New Job Card.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 text-xs rounded-xl h-8"
                        onClick={() => navigate("/admin/appointments")}
                      >
                        Open Calendar
                      </Button>
                    </div>
                  ) : (
                    todayAppointments.map((app) => (
                      <div
                        key={app.id}
                        className="p-3 rounded-xl border border-border/60 hover:border-primary/40 bg-muted/20 hover:bg-muted/50 transition-all cursor-pointer flex items-center justify-between gap-3"
                        onClick={() => navigate("/admin/appointments")}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground truncate">
                              {app.vehicle?.vehicle_number || "Unregistered"}
                            </span>
                            <Badge variant="outline" className="text-[9px] uppercase font-mono px-1.5 py-0">
                              {format(new Date(app.scheduled_at), "h:mm a")}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {app.customer?.name || "Walk-in"} • {app.services?.[0]?.service_name || app.notes || (app.type === 'face_to_face' ? 'Consultation' : 'General Service')}
                          </p>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/work-orders?create=true&appointmentId=${app.id}`);
                          }}
                        >
                          Create WO
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-3 mt-3 border-t border-border/30">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs font-medium rounded-xl h-8"
                    onClick={() => navigate("/admin/appointments")}
                  >
                    + Book New Appointment
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Column 2: Active Floor Board */}
            <Card className="bg-card border-border/70 shadow-sm rounded-2xl flex flex-col">
              <CardHeader className="pb-3 border-b border-border/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-600" />
                    <CardTitle className="text-sm font-bold">Active Floor Board</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary font-medium px-2"
                    onClick={() => navigate("/admin/work-orders")}
                  >
                    All Job Cards
                  </Button>
                </div>
                <CardDescription className="text-[11px]">
                  Real-time status of vehicles under repair or inspection
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2.5">
                  {recentWOs.length === 0 ? (
                    <div className="py-10 text-center">
                      <Wrench className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-foreground">Floor is clear</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        No active work orders currently in progress.
                      </p>
                    </div>
                  ) : (
                    recentWOs.map((wo) => (
                      <div
                        key={wo.id}
                        className="p-3 rounded-xl border border-border/60 hover:border-primary/40 bg-muted/20 hover:bg-muted/50 transition-all cursor-pointer group"
                        onClick={() => navigate(`/admin/work-orders/${wo.id}`)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                            {wo.vehicles?.vehicle_number || "Vehicle"}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStageBadgeColor(
                              wo.status
                            )}`}
                          >
                            {wo.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                          <span className="truncate max-w-[170px]">
                            {wo.service_type || "Mechanical Service"}
                          </span>
                          <span className="font-mono text-[10px] shrink-0">
                            {formatDistanceToNow(new Date(wo.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-3 mt-3 border-t border-border/30">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs font-medium rounded-xl h-8"
                    onClick={() => navigate("/admin/work-orders")}
                  >
                    Manage Floor & Work Orders &rarr;
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Column 3: Pending Approvals & Spares Alerts */}
            <div className="space-y-6 md:col-span-2 lg:col-span-1 md:grid md:grid-cols-2 md:gap-6 md:space-y-0 lg:block lg:space-y-6">
              {/* Pending Approvals & Payments */}
              <Card className="bg-card border-border/70 shadow-sm rounded-2xl">
                <CardHeader className="pb-3 border-b border-border/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <CardTitle className="text-sm font-bold">Pending Approvals</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-primary font-medium px-2"
                      onClick={() => navigate("/admin/requests")}
                    >
                      Inbox
                    </Button>
                  </div>
                  <CardDescription className="text-[11px]">
                    Customer approvals and payment validations
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-2.5">
                  {pendingPayments.length === 0 ? (
                    <div className="py-4 text-center">
                      <p className="text-xs text-muted-foreground">All payments verified</p>
                    </div>
                  ) : (
                    pendingPayments.map((p) => (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-xl border border-border/50 bg-muted/20 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {p.customers?.name || "Customer"}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            ₹{p.amount?.toLocaleString()} • {p.payment_method || "Payment"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] font-semibold px-2 rounded-lg"
                          onClick={() => navigate("/admin/ledger")}
                        >
                          Verify
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Low Stock Spares Alerts */}
              <Card className="bg-card border-border/70 shadow-sm rounded-2xl">
                <CardHeader className="pb-3 border-b border-border/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-rose-600" />
                      <CardTitle className="text-sm font-bold">Low Stock Spares</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-primary font-medium px-2"
                      onClick={() => navigate("/admin/inventory")}
                    >
                      Stock
                    </Button>
                  </div>
                  <CardDescription className="text-[11px]">
                    Items falling below reorder threshold
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  {lowStock.length === 0 ? (
                    <div className="py-3 text-center text-xs text-muted-foreground">
                      All inventory levels healthy
                    </div>
                  ) : (
                    lowStock.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-muted/20 border border-border/40"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{item.item_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{item.sku}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 shrink-0">
                          {item.available_qty} left
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
