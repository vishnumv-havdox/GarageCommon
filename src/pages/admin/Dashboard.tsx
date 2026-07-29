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
  Receipt
} from "lucide-react";
import { GarageClock } from "@/components/dashboard/GarageClock";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useRequests } from "@/contexts/RequestsContext";

export default function AdminDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { urgentAppointments } = useRequests();

  // Analytics State
  const [finData, setFinData] = useState<any>(null);
  const [opData, setOpData] = useState<any>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [recentWOs, setRecentWOs] = useState<any[]>([]);
  const [pendingBillCount, setPendingBillCount] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const startDate = startOfMonth(new Date()).toISOString();
      const endDate = endOfMonth(new Date()).toISOString();

      const [finRes, opRes, inventoryRes, paymentsRes, woRes, billsRes]: any[] = await Promise.all([
        // 1. Financial Analytics
        (supabase.rpc as any)('get_financial_analytics_v2', {
          p_start_date: startDate,
          p_end_date: endDate
        }),
        // 2. Operational Analytics
        (supabase.rpc as any)('get_operational_analytics', {
          p_start_date: subDays(new Date(), 30).toISOString(),
          p_end_date: new Date().toISOString()
        }),
        // 3. Low Stock Items (Fetch all and filter in JS for column comparison)
        supabase.from('inventory')
          .select('id, item_name, available_qty, reorder_level, sku')
          .limit(100),
        // 4. Pending Payments
        supabase.from('payments')
          .select('*, invoices(customer:customers(name))')
          .eq('status', 'pending')
          .limit(5),
        // 5. Active Work Orders
        supabase.from('work_orders')
          .select('*, vehicles(vehicle_number, customer:customers(name, company_name))')
          .not('status', 'in', '("Completed","Delivered","Cancelled","Rejected")')
          .order('created_at', { ascending: false })
          .limit(5),
        // 6. Pending Bills (Drafts + Generated/Unpaid)
        supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .in('status', ['Draft', 'Generated'])
      ]);

      if (finRes.data) setFinData(finRes.data);
      if (opRes.data) setOpData(opRes.data);

      // Filter low stock in JS
      const lowStockItems = (inventoryRes.data || [])
        .filter((item: any) => item.available_qty <= item.reorder_level)
        .slice(0, 5);
      setLowStock(lowStockItems);

      setPendingPayments((paymentsRes.data || []).map((p: any) => ({
        ...p,
        customers: p.invoices?.customer
      })));
      setRecentWOs(woRes.data || []);
      setPendingBillCount(billsRes.count || 0);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const statusColors: any = {
    'Pending': '#f59e0b',
    'In Progress': '#3b82f6',
    'Under QC': '#8b5cf6',
    'Ready': '#10b981',
    'Delivered': '#059669',
    'Cancelled': '#ef4444'
  };

  const counts: any = {};
  if (opData?.status_counts) {
    Object.entries(opData.status_counts).forEach(([k, v]) => {
      counts[k.toLowerCase().trim()] = v;
    });
  }

  // Robust mapping using lowercase keys
  const getCount = (keys: string[]) => keys.reduce((sum, key) => sum + (counts[key.toLowerCase()] || 0), 0);

  const pendingCount = getCount(['Pending', 'New']);
  const ongoingCount = getCount(['In Progress', 'Accepted', 'Under QC', 'Inspection', 'Repair', 'Review', 'Quality Check', 'Pending Approval']);
  const readyCount = getCount(['Ready', 'Ready for Delivery']);
  const completedCount = getCount(['Completed', 'Approved', 'Delivered']);

  const navigateToFiltered = (status: string) => {
    navigate(`/admin/work-orders?filter=${status}`);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-background">
      <div className="flex flex-col lg:flex-row">
        <AdminSidebar />

        <main className="flex-1 p-4 lg:p-8 space-y-8 max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <LayoutDashboard className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                  Command <span className="text-primary">Center</span>
                </h1>
              </div>
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 pl-12">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Real-time Workshop Management Terminal
              </p>
            </div>

            <div className="flex flex-col md:flex-row items-end md:items-center gap-4 w-full lg:w-auto">
              <GarageClock />
            </div>
          </div>

          {/* Financial KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Collected Revenue</CardTitle>
                <IndianRupee className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-emerald-600">
                  ₹{finData?.collected_payments?.toLocaleString() || '0'}
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 font-bold">
                  Billed: ₹{finData?.total_revenue?.toLocaleString() || '0'}
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Realization Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-blue-600">
                  {finData?.realization_rate?.toFixed(1) || '0'}%
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1 mt-2">
                  <div
                    className="bg-blue-500 h-1 rounded-full transition-all duration-1000"
                    style={{ width: `${finData?.realization_rate || 0}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Deductions</CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-orange-600">
                  ₹{finData?.total_deductions?.toLocaleString() || '0'}
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 font-bold">
                  Service Adjustments
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-destructive">Pending Payment</CardTitle>
                <Clock className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {pendingPayments.length} Requests
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 font-bold">
                  Awaiting Approval
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Live Operations Stats */}
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card
                  className="relative overflow-hidden group border-none shadow-lg cursor-pointer transform hover:scale-[1.02] transition-all"
                  onClick={() => navigateToFiltered('new')}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-600 opacity-90 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="relative p-6 text-white">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-orange-100 text-xs font-bold uppercase tracking-widest mb-1">New Orders</p>
                        <h3 className="text-4xl font-black">{pendingCount}</h3>
                      </div>
                      <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                        <Plus className="h-6 w-6" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-orange-100 font-medium">
                      <Clock className="h-3 w-3" /> Awaiting technician assignment
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="relative overflow-hidden group border-none shadow-lg cursor-pointer transform hover:scale-[1.02] transition-all"
                  onClick={() => navigateToFiltered('ongoing')}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 opacity-90 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="relative p-6 text-white">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-1">Ongoing Work</p>
                        <h3 className="text-4xl font-black">{ongoingCount}</h3>
                      </div>
                      <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                        <Wrench className="h-6 w-6" />
                      </div>
                    </div>
                    <div className="mt-4 flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-xs text-blue-100 font-medium">
                        <Activity className="h-3 w-3" /> Vehicles currently on the floor
                      </div>
                      {urgentAppointments > 0 && (
                        <div className="flex items-center gap-2 text-xs text-red-200 font-black animate-pulse bg-red-950/20 p-1.5 rounded-md border border-red-500/30">
                          <AlertTriangle className="h-4 w-4 text-red-400" />
                          {urgentAppointments} APPOINTMENTS NEED JOB CARDS
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="relative overflow-hidden group border-none shadow-lg cursor-pointer transform hover:scale-[1.02] transition-all"
                  onClick={() => navigateToFiltered('ready')}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 opacity-90 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="relative p-6 text-white">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mb-1">Ready for Delivery</p>
                        <h3 className="text-4xl font-black">{readyCount}</h3>
                      </div>
                      <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-emerald-100 font-medium">
                      <Truck className="h-3 w-3" /> Service complete, awaiting pickup
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="relative overflow-hidden group border-none shadow-lg cursor-pointer transform hover:scale-[1.02] transition-all"
                  onClick={() => navigateToFiltered('completed')}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-600 to-slate-800 opacity-90 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="relative p-6 text-white">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-slate-300 text-xs font-bold uppercase tracking-widest mb-1">Completed (Monthly)</p>
                        <h3 className="text-4xl font-black">{completedCount}</h3>
                      </div>
                      <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                        <HistoryIcon className="h-6 w-6" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-300 font-medium">
                      <Activity className="h-3 w-3" /> Total delivered this month
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Pending Billing Card - Replaces Detailed Status Breakdown */}
              <Card
                className="relative overflow-hidden group border-none shadow-lg cursor-pointer transform hover:scale-[1.01] transition-all"
                onClick={() => navigate('/admin/invoices')}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600 opacity-90 group-hover:opacity-100 transition-opacity" />

                <CardContent className="relative p-6 text-white flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-violet-100 text-xs font-bold uppercase tracking-widest">Pending Bill</p>
                    <h3 className="text-5xl font-black tracking-tighter">{pendingBillCount}</h3>
                    <p className="text-xs text-violet-100 font-medium flex items-center gap-2 opacity-80 mt-1">
                      <FileText className="h-3.5 w-3.5" />
                      Includes has to bill, drafts, etc.
                    </p>
                  </div>
                  <div className="h-20 w-20 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10 shadow-inner">
                    <Receipt className="h-10 w-10 text-white" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Inventory Alerts & Quick Actions */}
            <div className="space-y-6">
              {/* Inventory Alerts */}
              <Card className="border-orange-200 bg-orange-50/30 dark:bg-orange-950/10 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-400">
                    <AlertTriangle className="h-4 w-4" /> Inventory Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {lowStock.length > 0 ? (
                    lowStock.map((item) => (
                      <div key={item.id} className="flex items-center justify-between bg-white dark:bg-background/50 p-2 rounded-lg border border-orange-100 dark:border-orange-900/50 shadow-sm">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold">{item.item_name}</span>
                          <span className="text-[10px] text-muted-foreground">{item.sku}</span>
                        </div>
                        <Badge variant="destructive" className="h-5 text-[10px]">
                          {item.available_qty} left
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm italic">
                      All units in stock
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                    <NavLink to="/admin/inventory">Go to Inventory <ArrowRight className="h-3 w-3 ml-1" /></NavLink>
                  </Button>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <HistoryIcon className="h-4 w-4 text-primary" /> Active Work Orders
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentWOs.map((wo) => (
                    <div
                      key={wo.id}
                      className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors p-2 rounded-lg border border-transparent hover:border-slate-100"
                      onClick={() => navigate(`/admin/work-orders/${wo.id}`)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold block">{wo.vehicles?.vehicle_number}</span>
                          {wo.vehicles?.customer?.company_name && (
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mt-0.5">
                              {wo.vehicles.customer.company_name}
                            </span>
                          )}
                        </div>
                        <Badge variant="outline" className="h-4 text-[9px] uppercase tracking-tighter" style={{ borderColor: statusColors[wo.status], color: statusColors[wo.status] }}>
                          {wo.status}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 truncate">{wo.service_type}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Pending Approvals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-3 border-red-100 dark:border-red-900/30">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertCircle className="h-4 w-4" /> Pending Approvals
                  </CardTitle>
                  <CardDescription className="text-[10px]">Payments waiting for review</CardDescription>
                </div>
                <Button size="sm" variant="ghost" className="text-xs text-red-600 hover:text-red-700" onClick={() => navigate("/admin/ledger")}>
                  Manage All <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {pendingPayments.map((p) => (
                    <div key={p.id} className="border rounded-xl p-3 bg-white dark:bg-card hover:border-red-200 transition-all shadow-sm">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{format(new Date(p.created_at), "MMM d")}</p>
                      <h4 className="font-bold text-sm truncate mt-1">{p.customers?.name}</h4>
                      <p className="text-lg font-black text-primary mt-1">₹{p.amount.toLocaleString()}</p>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          className="flex-1 h-7 text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          variant="outline"
                          onClick={() => navigate("/admin/ledger")}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> View
                        </Button>
                      </div>
                    </div>
                  ))}
                  {pendingPayments.length === 0 && (
                    <div className="col-span-full py-8 text-center text-muted-foreground italic text-sm border-2 border-dashed rounded-xl">
                      No payments pending approval
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Shortcuts */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: 'Inventory', icon: Package, path: '/admin/inventory', color: 'blue' },
              { label: 'Work Orders', icon: ClipboardList, path: '/admin/work-orders', color: 'purple' },
              { label: 'Invoices', icon: FileText, path: '/admin/invoices', color: 'emerald' },
              { label: 'Customers', icon: Users, path: '/admin/customers', color: 'orange' },
              { label: 'Performance', icon: BarChart3, path: '/admin/analytics', color: 'pink' },
              { label: 'Attendance', icon: User, path: '/admin/attendance', color: 'slate' },
            ].map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className="flex flex-col items-center justify-center p-4 bg-white dark:bg-card rounded-xl border border-slate-100 dark:border-slate-800 hover:border-primary/30 hover:shadow-md transition-all group"
              >
                <div className={`p-3 rounded-full mb-2 bg-slate-50 group-hover:bg-primary/5 transition-colors`}>
                  <link.icon className="h-5 w-5 text-slate-600 group-hover:text-primary transition-colors" />
                </div>
                <span className="text-xs font-semibold group-hover:text-primary transition-colors">{link.label}</span>
              </NavLink>
            ))}
          </div>

        </main>
      </div>
    </div>
  );
}

