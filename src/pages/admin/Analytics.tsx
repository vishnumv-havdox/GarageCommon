import { useState, useEffect } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import {
    BarChart3, TrendingUp, Users, Clock, AlertTriangle,
    IndianRupee, RefreshCw, Filter,
    ClipboardList, Activity, Truck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function AdminAnalytics() {
    const { user, signOut } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [opData, setOpData] = useState<any>(null);
    const [finData, setFinData] = useState<any>(null);
    const [empData, setEmpData] = useState<any[]>([]);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            // Fetch Operational Data
            const { data: opRes, error: opError } = await supabase.rpc('get_operational_analytics');
            if (opError) throw opError;
            setOpData(opRes);

            // Fetch Financial Data
            const { data: finRes, error: finError } = await supabase.rpc('get_financial_analytics_v2');
            if (finError) {
                console.error("Falling back to v1 analytics:", finError);
                const { data: v1Res, error: v1Error } = await supabase.rpc('get_financial_analytics');
                if (v1Error) throw v1Error;
                setFinData(v1Res);
            } else {
                setFinData(finRes);
            }

            // Fetch Employee Data
            const { data: empRes, error: empError } = await supabase.rpc('get_employee_analytics');
            if (empError) throw empError;
            setEmpData(empRes || []);

        } catch (error: any) {
            console.error("Analytics error:", error);
            toast({ variant: "destructive", title: "Analytics Error", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">Loading analytics dashboard...</div>;
    }

    // Process data for charts
    const statusChartData = opData?.status_counts ? Object.entries(opData.status_counts).map(([name, value]) => ({ name, value })) : [];
    const revenueServiceData = finData?.revenue_by_service ? Object.entries(finData.revenue_by_service).map(([name, value]) => ({ name, value })) : [];

    return (
        <div className="flex flex-col lg:flex-row min-h-screen w-full bg-muted/40">
            <AdminSidebar />
            <main className="flex-1 p-8 overflow-y-auto max-h-screen">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Company Performance</h1>
                        <p className="text-muted-foreground">Operational and financial analytics for the last 30 days</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={fetchAnalytics}>
                            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                        </Button>
                        <Button variant="outline">
                            <Filter className="h-4 w-4 mr-2" /> Filters
                        </Button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Collected Revenue</CardTitle>
                            <IndianRupee className="h-4 w-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">₹{finData?.collected_payments?.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Total Billed: ₹{finData?.total_revenue?.toLocaleString()}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Orders Completed</CardTitle>
                            <TrendingUp className="h-4 w-4 text-blue-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{opData?.total_serviced}</div>
                            <p className="text-xs text-muted-foreground">Avg. {Math.round(opData?.total_serviced / 30)} orders per day</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Avg. Turnaround</CardTitle>
                            <Clock className="h-4 w-4 text-orange-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{opData?.avg_turnaround_hours?.toFixed(1)}h</div>
                            <p className="text-xs text-muted-foreground">-2h from last week</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Realization Rate</CardTitle>
                            <TrendingUp className={`h-4 w-4 ${finData?.realization_rate > 95 ? 'text-green-600' : 'text-orange-600'}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{finData?.realization_rate?.toFixed(1) || '100'}%</div>
                            <p className="text-xs text-muted-foreground">₹{finData?.total_deductions?.toLocaleString()} total deductions</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Middle Row: Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <Card className="col-span-1">
                        <CardHeader>
                            <CardTitle>Revenue by Service</CardTitle>
                            <CardDescription>Distribution of income across service types</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={revenueServiceData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {revenueServiceData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card className="col-span-1">
                        <CardHeader>
                            <CardTitle>Order Pipeline</CardTitle>
                            <CardDescription>Work orders categorized by current status</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={statusChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                {/* Bottom Row: Employee Performance */}
                <Card>
                    <CardHeader>
                        <CardTitle>Staff Efficiency & Performance</CardTitle>
                        <CardDescription>Individual productivity and task completion metrics</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-muted-foreground">
                                        <th className="text-left py-3 font-medium">Employee</th>
                                        <th className="text-left py-3 font-medium">Department</th>
                                        <th className="text-center py-3 font-medium">Completed Tasks</th>
                                        <th className="text-center py-3 font-medium">Avg. Time/Task</th>
                                        <th className="text-center py-3 font-medium">Acceptance Rate</th>
                                        <th className="text-right py-3 font-medium">Efficiency</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {empData.map((emp, idx) => {
                                        const time = parseFloat(emp.avg_task_completion_minutes);
                                        const efficiency = time > 0.5 ? Math.min(200, (60 / time * 100)) : (time > 0 ? 100 : 0);

                                        return (
                                            <tr key={idx} className="hover:bg-muted/50 transition-colors">
                                                <td className="py-4 font-medium">{emp.employee_name}</td>
                                                <td className="py-4">{emp.department}</td>
                                                <td className="py-4 text-center">{emp.completed_tasks}</td>
                                                <td className="py-4 text-center">{time ? `${time.toFixed(1)}m` : '-'}</td>
                                                <td className="py-4 text-center">
                                                    <Badge variant={emp.acceptance_rate && parseFloat(emp.acceptance_rate) > 90 ? 'outline' : 'secondary'} className={emp.acceptance_rate && parseFloat(emp.acceptance_rate) > 90 ? 'text-green-600 bg-green-50' : ''}>
                                                        {emp.acceptance_rate ? `${parseFloat(emp.acceptance_rate).toFixed(0)}%` : '100%'}
                                                    </Badge>
                                                </td>
                                                <td className="py-4 text-right">
                                                    {time > 0 ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                                                                <div
                                                                    className={`h-full ${efficiency > 80 ? 'bg-green-500' : efficiency > 50 ? 'bg-blue-500' : 'bg-orange-500'}`}
                                                                    style={{ width: `${Math.min(efficiency, 100)}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-[10px] font-mono">{efficiency.toFixed(0)}%</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs italic">N/A</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
