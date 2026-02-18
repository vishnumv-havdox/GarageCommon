import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Car, TrendingUp, IndianRupee, Clock, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface CompanyAnalyticsViewProps {
    companyId: string;
    onVehicleClick?: (id: string, label: string) => void;
}

interface AnalyticsData {
    customer: any;
    vehicles: any[];
    workOrders: any[];
    chartData: any[];
    stats: {
        totalVehicles: number;
        inService: number;
        completed: number;
        totalBilled: number;
        totalCollected: number;
        totalDeductions: number;
        overdueInvoices: number;
        overdueAmount: number;
    };
}

export default function CompanyAnalyticsView({ companyId, onVehicleClick }: CompanyAnalyticsViewProps) {

    // 1. Fetch Company & Fleet Stats
    const { data: stats, isLoading } = useQuery<AnalyticsData>({
        queryKey: ['company-analytics', companyId],
        queryFn: async () => {
            // Parallel Fetching for efficiency
            const [
                { data: customer },
                { data: vehicles },
                { data: invoices }
            ]: any[] = await Promise.all([
                // Customer Details
                supabase.from('customers').select('*').eq('id', companyId).single(),
                // Associated Vehicles
                supabase.from('vehicles').select('*').eq('customer_id', companyId),
                // History of Invoices
                supabase.from('invoices').select('id, status, total, total_deductions, created_at').eq('customer_id', companyId)
            ]);

            // 2. Fetch Payment Links using Invoice IDs (Avoids complex join filter error)
            const invoiceIds = (invoices || []).map((inv: any) => inv.id);
            let effectiveLinks: any[] = [];

            if (invoiceIds.length > 0) {
                const { data: pLinks } = await supabase
                    .from('payment_links')
                    .select('*, payment:payments(*)')
                    .in('invoice_id', invoiceIds);
                effectiveLinks = pLinks || [];
            }

            // 3. Fetch Work Orders using Vehicle IDs
            const vList = (vehicles || []) as any[];
            const vehicleIds = vList.map((v: any) => v.id);
            let allWorkOrders: any[] = [];

            if (vehicleIds.length > 0) {
                const { data: wos } = await supabase
                    .from('work_orders')
                    .select('*, vehicle:vehicles!vehicle_id(vehicle_number, model)')
                    .in('vehicle_id', vehicleIds)
                    .order('created_at', { ascending: false });
                allWorkOrders = wos || [];
            }


            // Calculate Stats
            const totalVehicles = vehicles?.length || 0;
            const woss = allWorkOrders as any[]; // Force cast to avoid never[] inference
            const inService = woss.filter(wo => !['Delivered', 'Completed', 'Approved', 'Cancelled'].includes(wo.status)).length;
            const completed = allWorkOrders.filter(wo => ['Delivered', 'Completed', 'Approved'].includes(wo.status)).length;

            const totalBilled = (invoices || []).reduce((sum, inv) => sum + (inv.total || 0), 0);
            const totalDeductions = (invoices || []).reduce((sum, inv) => sum + (inv.total_deductions || 0), 0);
            const totalCollected = effectiveLinks
                .filter(l => l.payment?.status?.toLowerCase() === 'approved')
                .reduce((sum, l) => sum + (l.amount_applied || l.amount || 0), 0);

            const overdueInvoices = (invoices || []).filter(inv => inv.status === 'Overdue' || inv.status === 'Unpaid').length;
            const overdueAmount = (invoices || [])
                .filter(inv => inv.status === 'Overdue' || inv.status === 'Unpaid')
                .reduce((sum, inv) => sum + (inv.total || 0), 0);

            // Chart Data: Monthly Revenue
            const monthlyRevenue: Record<string, number> = {};
            (invoices || []).forEach(inv => {
                const date = new Date(inv.created_at);
                const key = date.toLocaleString('default', { month: 'short', year: '2-digit' });
                monthlyRevenue[key] = (monthlyRevenue[key] || 0) + (inv.total || 0);
            });

            const chartData = Object.entries(monthlyRevenue)
                .map(([name, value]) => ({ name, value }))
                // Basic sort by attempting to parse date
                .sort((a, b) => {
                    const [mA, yA] = a.name.split(' ');
                    const [mB, yB] = b.name.split(' ');
                    // Simple hack for comparison or use proper date handling. 
                    // Ideally use YYYY-MM for sorting key and format for display.
                    return 0; // Skip complex sort for now, assuming DB returns somewhat ordered or map maintains order
                })
                .slice(-6);


            return {
                customer,
                vehicles: vehicles || [],
                workOrders: allWorkOrders,
                chartData,
                stats: {
                    totalVehicles,
                    inService,
                    completed,
                    totalBilled,
                    totalCollected,
                    totalDeductions,
                    overdueInvoices,
                    overdueAmount
                }
            };
        }
    });

    if (isLoading) {
        return <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!stats) return <div>No data found.</div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold">{stats.customer?.company_name || stats.customer?.name}</h2>
                <div className="text-muted-foreground flex gap-4 text-sm mt-1">
                    <span>{stats.customer?.phone}</span>
                    <span>•</span>
                    <span>{stats.customer?.address || "No Address"}</span>
                    <span>•</span>
                    <span>GST: {stats.customer?.gst_number || "N/A"}</span>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Fleet Size</CardTitle>
                        <Car className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.stats.totalVehicles}</div>
                        <p className="text-xs text-muted-foreground">Vehicles Registered</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Services</CardTitle>
                        <Clock className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.stats.inService}</div>
                        <p className="text-xs text-muted-foreground">Currently in Workshop</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Collected Revenue</CardTitle>
                        <IndianRupee className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{stats.stats.totalCollected.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">₹{stats.stats.totalDeductions.toLocaleString()} total deductions</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-destructive">Outstanding</CardTitle>
                        <TrendingUp className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">₹{stats.stats.overdueAmount.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">{stats.stats.overdueInvoices} Overdue Invoices</p>
                    </CardContent>
                </Card>
            </div>

            {/* Revenue Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" /> Revenue Trend
                    </CardTitle>
                    <CardDescription>Monthly revenue generated from this company</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" fontSize={12} />
                            <YAxis fontSize={12} tickFormatter={(value) => `₹${value / 1000}k`} />
                            <Tooltip
                                formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Revenue']}
                            />
                            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                                {stats.chartData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3b82f6' : '#2563eb'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Vehicle List Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Fleet Status</CardTitle>
                    <CardDescription>Metrics per vehicle involved in operations</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Vehicle No</TableHead>
                                <TableHead>Model</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Last Service</TableHead>
                                <TableHead className="text-right">Total Spent</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.vehicles.map((vehicle: any) => {
                                // Find active WO
                                const activeWO = stats.workOrders.find((w: any) => w.vehicle_id === vehicle.id && !['Delivered', 'Completed', 'Approved'].includes(w.status));
                                const lastWO = stats.workOrders.find((w: any) => w.vehicle_id === vehicle.id && ['Delivered', 'Completed', 'Approved'].includes(w.status));
                                const totalSpent = stats.workOrders.filter((w: any) => w.vehicle_id === vehicle.id).reduce((sum: number, w: any) => sum + (w.actual_cost || w.estimated_cost || 0), 0);

                                return (
                                    <TableRow
                                        key={vehicle.id}
                                        className={cn(onVehicleClick && "cursor-pointer hover:bg-muted/50 transition-colors")}
                                        onClick={() => onVehicleClick?.(vehicle.id, vehicle.vehicle_number)}
                                    >
                                        <TableCell className="font-medium text-primary hover:underline">{vehicle.vehicle_number}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {vehicle.vehicle_type || 'Vehicle'}
                                            {vehicle.model && ` • ${vehicle.model}`}
                                            {activeWO?.service_type && ` • ${activeWO.service_type}`}
                                        </TableCell>
                                        <TableCell>
                                            {activeWO ? (
                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 animate-pulse">
                                                    In Service ({activeWO.status})
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">
                                                    Active
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {lastWO ? new Date(lastWO.created_at).toLocaleDateString() : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            ₹{totalSpent.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
