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
import { Progress } from "@/components/ui/progress";
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
    ExternalLink,
    ListOrdered
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

// Delivery countdown utilities
const getDeliveryStatus = (deliveryDate: string | null, currentTime: number) => {
    if (!deliveryDate) return { formatted: 'No date', color: 'text-muted-foreground' };
    const deliveryTime = new Date(deliveryDate).getTime();
    const timeRemaining = deliveryTime - currentTime;
    const hoursRemaining = timeRemaining / (1000 * 60 * 60);

    const formatCountdown = (ms: number, isOverdue: boolean) => {
        const totalSeconds = Math.floor(Math.abs(ms) / 1000);
        const days = Math.floor(totalSeconds / (24 * 60 * 60));
        const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
        const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
        const prefix = isOverdue ? 'Overdue by ' : '';
        if (days > 0) return `${prefix}${days}d ${hours}h`;
        if (hours > 0) return `${prefix}${hours}h ${minutes}m`;
        return `${prefix}${minutes}m`;
    };

    if (timeRemaining < 0) {
        return { formatted: formatCountdown(timeRemaining, true), color: 'text-red-600' };
    } else if (hoursRemaining < 6) {
        return { formatted: formatCountdown(timeRemaining, false), color: 'text-red-600' };
    } else if (hoursRemaining < 24) {
        return { formatted: formatCountdown(timeRemaining, false), color: 'text-orange-600' };
    }
    return { formatted: formatCountdown(timeRemaining, false), color: 'text-green-600' };
};

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
    const [activeWorkload, setActiveWorkload] = useState<any[]>([]);
    const [serviceTasks, setServiceTasks] = useState<any>({});
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [currentTime, setCurrentTime] = useState(Date.now());
    const navigate = useNavigate();

    // Update current time every minute for live countdown
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
        return () => clearInterval(interval);
    }, []);

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

            // 5. Fetch active workload
            // @ts-ignore
            const { data: wlData } = await supabase.rpc('get_employee_active_workload', {
                p_employee_id: employee.id
            });

            // Enrichment Logic
            const enrichedWorkload = await Promise.all((wlData || []).map(async (wl: any) => {
                const { data: woData } = await supabase
                    .from('work_orders')
                    .select(`
                        estimated_delivery_date,
                        vehicles!inner(
                            customers(
                                company_name
                            )
                        )
                    `)
                    .eq('id', wl.work_order_id)
                    .maybeSingle();

                return {
                    ...wl,
                    estimated_delivery_date: woData?.estimated_delivery_date,
                    company_name: woData?.vehicles?.customers?.company_name
                };
            }));

            setActiveWorkload(enrichedWorkload || []);

            // 6. Fetch tasks for active work orders
            if (enrichedWorkload && enrichedWorkload.length > 0) {
                const workOrderIds = Array.from(new Set(enrichedWorkload.map((w: any) => w.work_order_id)));

                // Use work_order_tasks (singular, WO-level)
                // Note: 'work_order_tasks' is the table name found in migration
                const { data: tasksData } = await supabase
                    .from('work_order_tasks')
                    .select('*')
                    .in('work_order_id', workOrderIds);

                if (tasksData) {
                    const tasksByWO = tasksData.reduce((acc: any, task: any) => {
                        if (!acc[task.work_order_id]) acc[task.work_order_id] = [];
                        acc[task.work_order_id].push(task);
                        return acc;
                    }, {});
                    setServiceTasks(tasksByWO);
                }
            }

        } catch (error) {
            console.error("Error fetching employee tracker data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePosition = async (assignmentId: string, newPosition: number) => {
        try {
            const { error } = await supabase
                .from('work_order_service_employees')
                .update({ queue_position: newPosition } as any)
                .eq('id', assignmentId);

            if (error) throw error;
            fetchEmployeeData();
        } catch (error: any) {
            console.error("Error updating position:", error);
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
                                <TabsTrigger value="queue">Active Work Queue</TabsTrigger>
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

                            <TabsContent value="queue" className="pt-4 space-y-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                                            <ListOrdered className="h-4 w-4" /> Priority Work Queue
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {activeWorkload.length === 0 ? (
                                                <div className="text-center py-10 text-muted-foreground border border-dashed rounded-lg">
                                                    No active assignments in the queue.
                                                </div>
                                            ) : (
                                                Object.values(activeWorkload.reduce((groups: any, item: any) => {
                                                    const key = item.work_order_id;
                                                    if (!groups[key]) {
                                                        groups[key] = {
                                                            work_order_id: item.work_order_id,
                                                            vehicle_number: item.vehicle_number,
                                                            customer_name: item.customer_name,
                                                            company_name: item.company_name,
                                                            estimated_delivery_date: item.estimated_delivery_date,
                                                            queue_position: item.queue_position,
                                                            assignments: [],
                                                            total_progress: 0,
                                                            items_count: 0
                                                        };
                                                    }
                                                    groups[key].assignments.push(item);
                                                    groups[key].total_progress += item.progress_percentage;
                                                    groups[key].items_count += 1;
                                                    // Take the lowest queue position as the group's position
                                                    groups[key].queue_position = Math.min(groups[key].queue_position, item.queue_position);
                                                    return groups;
                                                }, {}))
                                                    .sort((a: any, b: any) => a.queue_position - b.queue_position)
                                                    .map((group: any) => {
                                                        const deliveryInfo = getDeliveryStatus(group.estimated_delivery_date, currentTime);
                                                        const avgProgress = Math.round(group.total_progress / group.items_count);

                                                        // Check if all statuses are valid/same
                                                        const uniqueStatuses = Array.from(new Set(group.assignments.map((a: any) => a.status)));
                                                        const displayStatus = uniqueStatuses.length === 1 ? uniqueStatuses[0] : 'Multiple';

                                                        const groupTasks = serviceTasks[group.work_order_id] || [];

                                                        return (
                                                            <div key={group.work_order_id} className="flex flex-col gap-3 p-4 rounded-lg border bg-card hover:bg-muted/10 transition-colors">
                                                                <div className="flex items-start justify-between">
                                                                    <div className="space-y-1 flex-1">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className="font-bold text-sm">{group.vehicle_number}</span>
                                                                            <Badge variant="outline" className="text-[10px] uppercase">Pos: {group.queue_position}</Badge>
                                                                            <Badge className={`text-[10px] border-blue-100 hover:bg-blue-50 ${displayStatus === 'Accepted' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700'
                                                                                }`}>
                                                                                {displayStatus}
                                                                            </Badge>
                                                                        </div>

                                                                        {/* Active Services List */}
                                                                        <div className="flex flex-col gap-1 mt-3">
                                                                            {group.assignments.map((asg: any) => (
                                                                                <div key={asg.assignment_id} className="flex justify-between items-center text-xs border-l-2 pl-2 border-primary/20">
                                                                                    <span className="font-semibold text-primary">{asg.service_type}</span>
                                                                                    <span className="text-[10px] text-muted-foreground">
                                                                                        {Math.round(asg.progress_percentage)}%
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                        </div>

                                                                        {/* Work Order Tasks (Shared) */}
                                                                        <div className="mt-3 pt-2 border-t border-dashed">
                                                                            <p className="text-[10px] items-center font-semibold text-muted-foreground mb-1.5 flex gap-1">
                                                                                <CheckCircle2 className="h-3 w-3" />
                                                                                Tasks
                                                                            </p>
                                                                            <div className="flex flex-wrap gap-1.5">
                                                                                {groupTasks.length > 0 ? (
                                                                                    groupTasks.map((task: any) => (
                                                                                        <div
                                                                                            key={task.id}
                                                                                            className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded border text-[10px]"
                                                                                            title={task.task_name}
                                                                                        >
                                                                                            <div className={`w-1.5 h-1.5 rounded-full ${task.completed ? 'bg-green-500' : 'bg-red-500'}`} />
                                                                                            <span className="truncate max-w-[150px]">{task.task_name}</span>
                                                                                        </div>
                                                                                    ))
                                                                                ) : (
                                                                                    <span className="text-[10px] text-muted-foreground italic">No tasks assigned</span>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        <p className="text-[10px] text-muted-foreground mt-2">
                                                                            {group.customer_name}
                                                                            {group.company_name && (
                                                                                <span className="ml-1">({group.company_name})</span>
                                                                            )}
                                                                        </p>
                                                                        {group.estimated_delivery_date && (
                                                                            <div className={`flex items-center gap-1 text-xs font-semibold ${deliveryInfo.color}`}>
                                                                                <Clock className="h-3 w-3" />
                                                                                <span>Delivery: {deliveryInfo.formatted}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="flex items-center border rounded-md overflow-hidden">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-7 w-7 rounded-none border-r"
                                                                                onClick={() => {
                                                                                    group.assignments.forEach((asg: any) => {
                                                                                        handleUpdatePosition(asg.assignment_id, Math.max(0, group.queue_position - 1));
                                                                                    });
                                                                                }}
                                                                            >
                                                                                <TrendingUp className="h-3 w-3 rotate-180" />
                                                                            </Button>
                                                                            <Input
                                                                                type="number"
                                                                                className="h-7 w-10 border-0 rounded-none text-center text-xs p-0 focus-visible:ring-0"
                                                                                value={group.queue_position}
                                                                                onChange={(e) => {
                                                                                    const newPos = parseInt(e.target.value) || 0;
                                                                                    group.assignments.forEach((asg: any) => {
                                                                                        handleUpdatePosition(asg.assignment_id, newPos);
                                                                                    });
                                                                                }}
                                                                            />
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-7 w-7 rounded-none border-l"
                                                                                onClick={() => {
                                                                                    group.assignments.forEach((asg: any) => {
                                                                                        handleUpdatePosition(asg.assignment_id, group.queue_position + 1);
                                                                                    });
                                                                                }}
                                                                            >
                                                                                <TrendingUp className="h-3 w-3" />
                                                                            </Button>
                                                                        </div>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8"
                                                                            onClick={() => {
                                                                                onOpenChange(false);
                                                                                navigate(`/admin/work-orders/${group.work_order_id}`);
                                                                            }}
                                                                        >
                                                                            <ExternalLink className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-bold">
                                                                        <span>Total Progress</span>
                                                                        <span>{avgProgress}%</span>
                                                                    </div>
                                                                    <Progress value={avgProgress} className="h-1.5" />
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="inventory" className="pt-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                                            <Package className="h-4 w-4" /> Part Consumption & Returns
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {inventory.length === 0 ? (
                                                <div className="text-center py-10 text-muted-foreground border border-dashed rounded-lg">
                                                    No inventory activity found
                                                </div>
                                            ) : (
                                                Object.values(inventory.reduce((groups: any, item: any) => {
                                                    const key = item.work_order_id || 'internal';
                                                    if (!groups[key]) {
                                                        groups[key] = {
                                                            work_order_id: item.work_order_id,
                                                            vehicle_number: item.vehicle_number || 'General Stock',
                                                            customer_name: item.customer_name || 'Internal',
                                                            company_name: item.company_name,
                                                            items: [],
                                                            total_qty: 0
                                                        };
                                                    }
                                                    groups[key].items.push(item);
                                                    groups[key].total_qty += item.quantity;
                                                    return groups;
                                                }, {}))
                                                    .sort((a: any, b: any) => new Date(b.items[0].transaction_date).getTime() - new Date(a.items[0].transaction_date).getTime())
                                                    .map((group: any) => (
                                                        <div key={group.work_order_id || 'internal'} className="flex flex-col rounded-lg border bg-card overflow-hidden">
                                                            <div className="flex items-center justify-between p-3 bg-muted/30 border-b">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold text-sm">{group.vehicle_number}</span>
                                                                        {group.company_name && (
                                                                            <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200 bg-blue-50">
                                                                                {group.company_name}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[10px] text-muted-foreground">
                                                                        {group.customer_name} • {group.items.length} Transactions
                                                                    </span>
                                                                </div>
                                                                {group.work_order_id && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 text-[10px]"
                                                                        onClick={() => {
                                                                            onOpenChange(false);
                                                                            navigate(`/admin/work-orders/${group.work_order_id}`);
                                                                        }}
                                                                    >
                                                                        View WO <ExternalLink className="ml-1 h-3 w-3" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                            <div className="p-0">
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow className="bg-muted/10 hover:bg-muted/10">
                                                                            <TableHead className="h-7 text-[10px]">Part</TableHead>
                                                                            <TableHead className="h-7 text-[10px]">Action</TableHead>
                                                                            <TableHead className="h-7 text-[10px]">Approved By</TableHead>
                                                                            <TableHead className="h-7 text-[10px]">Qty</TableHead>
                                                                            <TableHead className="h-7 text-[10px]">Date</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {group.items.map((row: any) => (
                                                                            <TableRow key={row.transaction_id} className="text-xs hover:bg-muted/5">
                                                                                <TableCell className="py-2 font-medium">{row.item_name}</TableCell>
                                                                                <TableCell className="py-2">
                                                                                    <Badge variant="outline" className={`flex w-fit items-center gap-1 text-[10px] h-5 ${row.transaction_type === 'issue' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
                                                                                            row.transaction_type === 'return' ? 'text-blue-600 bg-blue-50 border-blue-200' : ''
                                                                                        }`}>
                                                                                        {row.transaction_type === 'issue' && <CheckCircle2 className="h-2.5 w-2.5" />}
                                                                                        {row.transaction_type === 'return' && <ArrowLeftRight className="h-2.5 w-2.5" />}
                                                                                        {row.transaction_type}
                                                                                    </Badge>
                                                                                </TableCell>
                                                                                <TableCell className="py-2">
                                                                                    {row.approved_by_name ? (
                                                                                        <Badge variant="secondary" className="text-[10px] h-5 font-normal bg-green-50 text-green-700 hover:bg-green-100 border-green-200 border">
                                                                                            {row.approved_by_name}
                                                                                        </Badge>
                                                                                    ) : (
                                                                                        <span className="text-[10px] text-muted-foreground">-</span>
                                                                                    )}
                                                                                </TableCell>
                                                                                <TableCell className="py-2">{row.quantity}</TableCell>
                                                                                <TableCell className="py-2 text-[10px] text-muted-foreground">
                                                                                    {new Date(row.transaction_date).toLocaleDateString()}
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        </div>
                                                    ))
                                            )}
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
