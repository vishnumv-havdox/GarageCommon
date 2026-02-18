import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfDay, endOfDay } from "date-fns";
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
    ListOrdered,
    Trash2
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
    const [timeRange, setTimeRange] = useState("month");
    const [efficiency, setEfficiency] = useState<any>(null);
    const [customDates, setCustomDates] = useState({
        start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
        end: format(new Date(), "yyyy-MM-dd")
    });
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
    }, [open, employee?.id, timeRange, customDates]);

    const fetchEmployeeData = async () => {
        setLoading(true);
        try {
            let startDate: Date;
            let endDate = new Date();

            switch (timeRange) {
                case "day":
                    startDate = startOfDay(new Date());
                    endDate = endOfDay(new Date());
                    break;
                case "week":
                    startDate = subDays(new Date(), 7);
                    break;
                case "month":
                    startDate = startOfMonth(new Date());
                    endDate = new Date(); // Cap at today for accurate "to date" calculation
                    break;
                case "year":
                    startDate = startOfYear(new Date());
                    endDate = new Date(); // Cap at today
                    break;
                case "custom":
                    startDate = new Date(customDates.start);
                    endDate = new Date(customDates.end);
                    break;
                default:
                    startDate = startOfMonth(new Date());
            }

            const formattedStart = format(startDate, "yyyy-MM-dd");
            const formattedEnd = format(endDate, "yyyy-MM-dd");

            // 1. Fetch Efficiency Data (Manual Calculation to handle Approved/Completed status correctly)
            // Fetch all approved/completed tasks for this employee within the date range
            const { data: approvedTasks, error: approvedError } = await supabase
                .from("work_order_service_employees")
                .select(`
                    id, 
                    status, 
                    created_at, 
                    updated_at, 
                    completed_at,
                    service:work_order_services!inner(
                        service_type, 
                        estimated_cost
                    )
                `)
                .eq("employee_id", employee.id)
                .in("status", ["Approved", "Completed", "Done"]); // Handle all potential completion statuses

            if (approvedError) {
                console.error("Error fetching approved tasks:", approvedError);
            }

            // Fetch attendance for efficiency calculation (Worked Hours)
            const { data: effAttendance } = await supabase
                .from("attendance")
                .select("total_hours, status")
                .eq("employee_id", employee.id)
                .gte("date", formattedStart)
                .lte("date", formattedEnd);

            // Calculate Metrics Locally
            const totalWorkedHours = (effAttendance || []).reduce((sum, att) => sum + (att.total_hours || 0), 0);

            // Filter tasks by date range using updated_at or completed_at
            const relevantTasks = (approvedTasks || []).filter((t: any) => {
                const completionDate = new Date(t.completed_at || t.updated_at);
                return completionDate >= startDate && completionDate <= endDate;
            });

            // Benchmark: Use 1 hour per task as default.
            const benchmarkPerTask = 1.0;
            const earnedHours = relevantTasks.length * benchmarkPerTask;

            const efficiencyScore = totalWorkedHours > 0 ? (earnedHours / totalWorkedHours) * 100 : 0;

            // Availability: Days present / Total days in period
            const daysPresent = (effAttendance || []).filter(a => ['present', 'overtime', 'half-day'].includes(a.status)).length;
            const totalDaysInPeriod = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            const availabilityScore = totalDaysInPeriod > 0 ? (daysPresent / totalDaysInPeriod) * 100 : 0;

            let explanation = "";
            if (totalWorkedHours === 0) {
                explanation = "No attendance hours recorded in this period.";
            } else if (relevantTasks.length === 0) {
                explanation = "No completed tasks found in this period.";
            } else {
                const diff = (earnedHours - totalWorkedHours).toFixed(1);
                const status = earnedHours >= totalWorkedHours ? "ahead of" : "behind";

                explanation = `Completed ${relevantTasks.length} tasks (standard: ${earnedHours.toFixed(1)} hrs) in ${totalWorkedHours.toFixed(1)} actual working hours.`;
            }

            const effData = {
                efficiency_score: efficiencyScore.toFixed(1),
                availability_score: availabilityScore.toFixed(1),
                total_hours_worked: totalWorkedHours.toFixed(1),
                earned_hours: earnedHours.toFixed(1),
                tasks_completed: relevantTasks.length,
                days_present: daysPresent,
                period_days: totalDaysInPeriod,
                explanation: explanation
            };

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
                .eq("employee_id", employee.id)
                .gte("work_order.created_at", formattedStart)
                .lte("work_order.created_at", formattedEnd);

            const sortedHistory = (historyData || []).sort((a: any, b: any) =>
                new Date(b.work_order?.created_at).getTime() - new Date(a.work_order?.created_at).getTime()
            );
            setHistory(sortedHistory);

            // 3. Fetch inventory usage (Both Requested and Performed)
            const { data: invData } = await (supabase as any)
                .from("inventory_lifecycle_history")
                .select("*")
                .or(`requested_by_name.eq."${employee.name}",performed_by_name.eq."${employee.name}"`)
                .gte("transaction_date", formattedStart)
                .lte("transaction_date", formattedEnd)
                .order("transaction_date", { ascending: false });
            setInventory(invData || []);

            // Aggregate metrics
            const partsUsed = (invData || []).filter((i: any) => i.transaction_type === 'issue').length;
            const partsReturned = (invData || []).filter((i: any) => i.transaction_type === 'return').length;

            if (effData) {
                setEfficiency(effData);

                // Calculate actual average completion time from history data
                const completedJobs = (historyData || []).filter((h: any) =>
                    h.work_order?.status === 'Completed' || h.work_order?.status === 'delivered'
                );
                const totalActualHours = completedJobs.reduce((sum: number, h: any) => {
                    const start = new Date(h.work_order.created_at).getTime();
                    const end = new Date(h.work_order.updated_at).getTime();
                    return sum + Math.max(0, (end - start) / (1000 * 60 * 60));
                }, 0);
                const actualAvg = completedJobs.length > 0 ? totalActualHours / completedJobs.length : 0;

                setMetrics({
                    total_jobs_completed: effData.tasks_completed,
                    avg_completion_hours: actualAvg > 0 ? actualAvg : (Number(effData.earned_hours) / (Number(effData.tasks_completed) || 1)),
                    total_parts_requested: partsUsed,
                    total_parts_returned: partsReturned,
                    days_present_30d: effData.days_present,
                    overtime_hours_30d: 0
                });
            } else {
                setMetrics({
                    total_jobs_completed: 0,
                    avg_completion_hours: 0,
                    total_parts_requested: partsUsed,
                    total_parts_returned: partsReturned,
                    days_present_30d: 0,
                    overtime_hours_30d: 0
                });
            }

            // 4. Fetch recent attendance
            const { data: attData } = await supabase
                .from("attendance")
                .select("*, auditor:profiles!attendance_marked_by_fkey(full_name)")
                .eq("employee_id", employee.id)
                .gte("date", formattedStart)
                .lte("date", formattedEnd)
                .order("date", { ascending: false });
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
                    estimated_delivery_date: (woData as any)?.estimated_delivery_date || null,
                    company_name: (woData as any)?.vehicles?.customers?.company_name || null
                };
            }));

            setActiveWorkload(enrichedWorkload || []);

            // 6. Fetch tasks for active work orders
            if (enrichedWorkload && enrichedWorkload.length > 0) {
                const workOrderIds = Array.from(new Set(enrichedWorkload.map((w: any) => w.work_order_id)));

                // Use work_order_tasks (singular, WO-level)
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

    const handleDeleteAttendance = async (id: string) => {
        if (!confirm("Are you sure you want to delete this attendance record?")) return;
        try {
            const { error } = await supabase
                .from("attendance")
                .delete()
                .eq("id", id);
            if (error) throw error;
            fetchEmployeeData();
        } catch (error: any) {
            console.error("Error deleting attendance:", error);
        }
    };

    const handleUpdatePosition = async (assignmentId: string, newPosition: number) => {
        try {
            const { error } = await (supabase as any)
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
            <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0 gap-0">
                {/* 1. Header Section */}
                <div className="p-6 border-b bg-muted/10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <DialogHeader className="p-0">
                            <DialogTitle className="flex items-center gap-3 text-xl">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <TrendingUp className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col">
                                    <span>{employee?.name}</span>
                                    <span className="text-xs font-normal text-muted-foreground uppercase tracking-wider">{employee?.role || 'Staff Member'}</span>
                                </div>
                            </DialogTitle>
                        </DialogHeader>

                        {/* Toolbar */}
                        <div className="flex items-center gap-2 bg-background p-1.5 rounded-lg border shadow-sm">
                            <Select value={timeRange} onValueChange={setTimeRange}>
                                <SelectTrigger className="h-8 w-[140px] text-xs border-0 bg-transparent focus:ring-0">
                                    <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                    <SelectValue placeholder="Time Range" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="day">Today</SelectItem>
                                    <SelectItem value="week">Past 7 Days</SelectItem>
                                    <SelectItem value="month">This Month</SelectItem>
                                    <SelectItem value="year">This Year</SelectItem>
                                    <SelectItem value="custom">Custom Range</SelectItem>
                                </SelectContent>
                            </Select>

                            {timeRange === 'custom' && (
                                <div className="flex items-center gap-1 border-l pl-2">
                                    <Input
                                        type="date"
                                        className="h-7 w-[110px] text-[10px] p-1 border-0 bg-muted/20"
                                        value={customDates.start}
                                        onChange={(e) => setCustomDates({ ...customDates, start: e.target.value })}
                                    />
                                    <span className="text-muted-foreground text-[10px]">-</span>
                                    <Input
                                        type="date"
                                        className="h-7 w-[110px] text-[10px] p-1 border-0 bg-muted/20"
                                        value={customDates.end}
                                        onChange={(e) => setCustomDates({ ...customDates, end: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 2. Key Metrics Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                        <div className="flex flex-col gap-1 p-3 bg-background rounded-lg border shadow-sm">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Jobs Completed</span>
                            <div className="flex items-end justify-between">
                                <span className="text-2xl font-bold">{metrics?.total_jobs_completed || 0}</span>
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 mb-1" />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 p-3 bg-background rounded-lg border shadow-sm">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Avg Time (Hrs)</span>
                            <div className="flex items-end justify-between">
                                <span className="text-2xl font-bold">{metrics?.avg_completion_hours?.toFixed(1) || 0}</span>
                                <Clock className="h-4 w-4 text-blue-500 mb-1" />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 p-3 bg-background rounded-lg border shadow-sm">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Parts Issued</span>
                            <div className="flex items-end justify-between">
                                <span className="text-2xl font-bold">{metrics?.total_parts_requested || 0}</span>
                                <Package className="h-4 w-4 text-orange-500 mb-1" />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 p-3 bg-background rounded-lg border shadow-sm">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Returns</span>
                            <div className="flex items-end justify-between">
                                <span className="text-2xl font-bold">{metrics?.total_parts_returned || 0}</span>
                                <ArrowLeftRight className="h-4 w-4 text-purple-500 mb-1" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="py-20 text-center text-muted-foreground">Loading activity data...</div>
                    ) : (
                        <Tabs defaultValue="overview" className="w-full space-y-6">
                            <TabsList className="grid w-full grid-cols-4 lg:w-[600px] h-9 p-1 bg-muted/20">
                                <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                                <TabsTrigger value="queue" className="text-xs">Active Queue</TabsTrigger>
                                <TabsTrigger value="history" className="text-xs">History & Logs</TabsTrigger>
                                <TabsTrigger value="inventory" className="text-xs">Inventory</TabsTrigger>
                            </TabsList>

                            {/* TAB: OVERVIEW */}
                            <TabsContent value="overview" className="space-y-6 focus-visible:ring-0">
                                {efficiency && (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        <Card className="col-span-1 border-indigo-100 bg-indigo-50/10 shadow-sm">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-medium text-indigo-900 flex items-center gap-2">
                                                    <TrendingUp className="h-4 w-4 text-indigo-500" />
                                                    Efficiency Score
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex flex-col items-center justify-center py-4">
                                                    <div className="relative flex items-center justify-center h-32 w-32 rounded-full border-8 border-indigo-100 mb-4">
                                                        <span className="text-3xl font-black text-indigo-700">{efficiency.efficiency_score}%</span>
                                                    </div>
                                                    <div className="w-full space-y-2">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground">Availability</span>
                                                            <span className="font-bold">{efficiency.availability_score}%</span>
                                                        </div>
                                                        <Progress value={efficiency.availability_score} className="h-1.5" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="col-span-1 lg:col-span-2 shadow-sm">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                                                    Performance Analysis
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <div className="p-4 bg-muted/20 rounded-lg text-sm leading-relaxed">
                                                    {efficiency.explanation}
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="p-3 border rounded bg-card">
                                                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Earned Hours</span>
                                                        <span className="text-xl font-bold">{efficiency.earned_hours}h</span>
                                                        <p className="text-[10px] text-muted-foreground mt-1">Based on benchmarks</p>
                                                    </div>
                                                    <div className="p-3 border rounded bg-card">
                                                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Actual Hours</span>
                                                        <span className="text-xl font-bold">{efficiency.total_hours_worked}h</span>
                                                        <p className="text-[10px] text-muted-foreground mt-1">Clocked time</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Card className="shadow-sm">
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium">Monthly Output Trends</CardTitle>
                                        </CardHeader>
                                        <CardContent className="h-[250px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={chartData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                                    <XAxis dataKey="name" fontSize={11} axisLine={false} tickLine={false} />
                                                    <YAxis fontSize={11} axisLine={false} tickLine={false} />
                                                    <Tooltip
                                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                        cursor={{ fill: 'transparent' }}
                                                    />
                                                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>
                                </div>
                            </TabsContent>

                            {/* TAB: QUEUE */}
                            <TabsContent value="queue" className="space-y-4 focus-visible:ring-0">
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
                                                                                {String(displayStatus)}
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
                                                                                            <span className="truncate max-w-[150px]">{String(task.task_name)}</span>
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
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
