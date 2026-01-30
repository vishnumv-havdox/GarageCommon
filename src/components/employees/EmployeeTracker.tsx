import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    History,
    Package,
    TrendingUp,
    Clock,
    CheckCircle2,
    AlertCircle,
    Truck,
    ArrowLeftRight,
    Search,
    Filter,
    ExternalLink
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from "recharts";

interface EmployeeTrackerProps {
    employee: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EmployeeTracker({ employee, open, onOpenChange }: EmployeeTrackerProps) {
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);
    const [attendance, setAttendance] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const navigate = useNavigate();

    useEffect(() => {
        if (open && employee?.id) {
            fetchEmployeeData();
        }
    }, [open, employee?.id]);

    const fetchEmployeeData = async () => {
        setLoading(true);
        try {
            // 1. Fetch performance metrics
            const { data: metricData } = await supabase
                .from("employee_performance_metrics")
                .select("*")
                .eq("employee_id", employee.id)
                .maybeSingle();
            setMetrics(metricData);

            // 2. Fetch work history with company info
            const { data: historyData } = await supabase
                .from("work_order_assignments")
                .select(`
                    work_order:work_orders(
                        id,
                        status,
                        vehicle:vehicles(
                            vehicle_number,
                            customer:customers(company_name)
                        ),
                        created_at,
                        updated_at
                    )
                `)
                .eq("employee_id", employee.id);

            const sortedHistory = (historyData || []).sort((a: any, b: any) =>
                new Date(b.work_order?.created_at).getTime() - new Date(a.work_order?.created_at).getTime()
            );
            setHistory(sortedHistory);

            // 3. Fetch inventory usage
            const { data: invData } = await supabase
                .from("inventory_lifecycle_history")
                .select("*")
                .eq("performed_by_name", employee.name)
                .order("transaction_date", { ascending: false });
            setInventory(invData || []);

            // 4. Fetch recent attendance
            const { data: attData } = await supabase
                .from("attendance")
                .select("*")
                .eq("employee_id", employee.id)
                .order("date", { ascending: false })
                .limit(30);
            setAttendance(attData || []);

        } catch (error) {
            console.error("Error fetching employee tracker data:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredHistory = history.filter(h => {
        const wo = h.work_order;
        if (!wo) return false;

        const vehicleNum = wo.vehicle?.vehicle_number?.toLowerCase() || "";
        const companyName = wo.vehicle?.customer?.company_name?.toLowerCase() || "";
        const matchesSearch = vehicleNum.includes(searchTerm.toLowerCase()) ||
            companyName.includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === "all" || wo.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const chartData = [
        { name: 'Present', value: metrics?.days_present_30d || 0 },
        { name: 'OT Hours', value: metrics?.overtime_hours_30d || 0 },
        { name: 'Jobs Done', value: metrics?.total_jobs_completed || 0 }
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Employee Tracker: {employee?.name}
                    </DialogTitle>
                    <DialogDescription>
                        Performance KPIs, Work History, and Inventory Accountability
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="py-20 text-center text-muted-foreground">Loading activity data...</div>
                ) : (
                    <div className="space-y-6">
                        {/* Quick Metrics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Card className="bg-primary/5 border-primary/10">
                                <CardContent className="pt-4 p-4 text-center">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Jobs Completed</p>
                                    <h3 className="text-2xl font-bold">{metrics?.total_jobs_completed || 0}</h3>
                                </CardContent>
                            </Card>
                            <Card className="bg-primary/5 border-primary/10">
                                <CardContent className="pt-4 p-4 text-center">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Time (Hrs)</p>
                                    <h3 className="text-2xl font-bold">{metrics?.avg_completion_hours?.toFixed(1) || 0}</h3>
                                </CardContent>
                            </Card>
                            <Card className="bg-primary/5 border-primary/10">
                                <CardContent className="pt-4 p-4 text-center">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Parts Used</p>
                                    <h3 className="text-2xl font-bold">{metrics?.total_parts_requested || 0}</h3>
                                </CardContent>
                            </Card>
                            <Card className="bg-primary/5 border-primary/10">
                                <CardContent className="pt-4 p-4 text-center">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Returns</p>
                                    <h3 className="text-2xl font-bold">{metrics?.total_parts_returned || 0}</h3>
                                </CardContent>
                            </Card>
                        </div>

                        <Tabs defaultValue="activity" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="activity">Performance & Attendance</TabsTrigger>
                                <TabsTrigger value="inventory">Inventory Tracker</TabsTrigger>
                                <TabsTrigger value="history">Work History</TabsTrigger>
                            </TabsList>

                            <TabsContent value="activity" className="space-y-4 pt-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium">Monthly Output Trends</CardTitle>
                                        </CardHeader>
                                        <CardContent className="h-[200px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={chartData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                    <XAxis dataKey="name" fontSize={12} />
                                                    <YAxis fontSize={12} />
                                                    <Tooltip />
                                                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium">Recent Attendance</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                                {attendance.length === 0 ? (
                                                    <div className="text-sm text-center py-4 text-muted-foreground">No attendance records</div>
                                                ) : (
                                                    attendance.map((att) => (
                                                        <div key={att.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/50">
                                                            <span className="font-medium">{att.date}</span>
                                                            <Badge variant={att.status === 'present' ? 'default' : 'secondary'} className="text-[10px] h-4">
                                                                {att.status}
                                                            </Badge>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </TabsContent>

                            <TabsContent value="inventory" className="pt-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                                            <Package className="h-4 w-4" /> Part Consumption & Returns
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="rounded-md border overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/50">
                                                        <TableHead className="h-9">Part</TableHead>
                                                        <TableHead className="h-9">Action</TableHead>
                                                        <TableHead className="h-9">Qty</TableHead>
                                                        <TableHead className="h-9">Context</TableHead>
                                                        <TableHead className="h-9">Date</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {inventory.length === 0 ? (
                                                        <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No inventory activity found</TableCell></TableRow>
                                                    ) : (
                                                        inventory.map((row) => (
                                                            <TableRow key={row.transaction_id} className="text-xs">
                                                                <TableCell className="font-medium">{row.item_name}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline" className="flex w-fit items-center gap-1 text-[10px]">
                                                                        {row.transaction_type === 'issue' && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                                                                        {row.transaction_type === 'return' && <ArrowLeftRight className="h-3 w-3 text-blue-500" />}
                                                                        {row.transaction_type}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell>{row.quantity}</TableCell>
                                                                <TableCell>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold">{row.vehicle_number || "Internal"}</span>
                                                                        <span className="text-[10px] text-muted-foreground">{row.work_order_id ? `WO: ${row.work_order_id.substring(0, 8)}` : "Stock Adj"}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-muted-foreground">{new Date(row.transaction_date).toLocaleDateString()}</TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="history" className="pt-4">
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-wrap gap-2">
                                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                                            <Truck className="h-4 w-4" /> Vehicles & Work Orders
                                        </CardTitle>
                                        <div className="flex items-center gap-2">
                                            <div className="relative w-48">
                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Vehicle or Company..."
                                                    className="h-9 pl-8 text-xs"
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                />
                                            </div>
                                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                                <SelectTrigger className="h-9 w-32 text-xs">
                                                    <SelectValue placeholder="Status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Status</SelectItem>
                                                    <SelectItem value="Pending">Pending</SelectItem>
                                                    <SelectItem value="In Progress">In Progress</SelectItem>
                                                    <SelectItem value="Completed">Completed</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {filteredHistory.length === 0 ? (
                                                <div className="text-center py-10 text-muted-foreground border border-dashed rounded-lg">
                                                    {history.length === 0 ? "No work history found" : "No results matching filters"}
                                                </div>
                                            ) : (
                                                filteredHistory.map((h, i) => (
                                                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/20 transition-colors group">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-sm">{h.work_order?.vehicle?.vehicle_number}</span>
                                                                <Badge variant="secondary" className={`text-[10px] h-4 ${h.work_order?.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600' :
                                                                        h.work_order?.status === 'In Progress' ? 'bg-blue-500/10 text-blue-600' : ''
                                                                    }`}>{h.work_order?.status}</Badge>
                                                            </div>
                                                            <p className="text-[10px] font-medium text-primary uppercase">{h.work_order?.vehicle?.customer?.company_name || "Direct Customer"}</p>
                                                            <p className="text-[11px] text-muted-foreground">WO: {h.work_order?.id?.substring(0, 8)}</p>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="text-right">
                                                                <p className="text-xs font-medium">{new Date(h.work_order?.created_at).toLocaleDateString()}</p>
                                                                <p className="text-[10px] text-muted-foreground">Assigned</p>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={() => {
                                                                    onOpenChange(false);
                                                                    navigate(`/admin/work-orders/${h.work_order.id}`);
                                                                }}
                                                            >
                                                                <ExternalLink className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
