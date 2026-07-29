import { useState, useEffect } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import {
    Calendar as CalendarIcon,
    CheckCircle2,
    XCircle,
    Clock,
    UserCheck,
    TrendingUp,
    UserX,
    Users,
    Search,
    Download,
    LogIn,
    LogOut,
    Palmtree,
    CalendarCheck,
    Loader2,
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    Trash2,
    Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function AttendancePage() {
    const { toast } = useToast();
    const [viewMode, setViewMode] = useState<string>("daily");
    const [date, setDate] = useState<Date>(new Date());
    const [employees, setEmployees] = useState<any[]>([]);
    const [attendance, setAttendance] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [workforceSettings, setWorkforceSettings] = useState<any>(null);

    // Per-employee view states
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
    const [employeeAttendance, setEmployeeAttendance] = useState<any[]>([]);
    const [monthlyStats, setMonthlyStats] = useState({
        present: 0,
        absent: 0,
        leave: 0,
        halfDay: 0,
        overtime: 0,
        totalHours: 0,
        avgHours: 0
    });

    const isToday = isSameDay(date, new Date());

    useEffect(() => {
        fetchData();
    }, [date]);

    useEffect(() => {
        if (viewMode === "history" && selectedEmployeeId) {
            fetchEmployeeHistory();
        }
    }, [viewMode, selectedEmployeeId, date]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: empData, error: empError } = await supabase
                .from("employees")
                .select("id, name, attendance_self_service, position:positions(name)")
                .eq("status", "active")
                .order("name");

            if (empError) throw empError;
            setEmployees(empData || []);

            const formattedDate = format(date, 'yyyy-MM-dd');
            const { data: attData, error: attError } = await supabase
                .from("attendance")
                .select("*")
                .eq("date", formattedDate);

            if (attError) throw attError;

            const attMap: Record<string, any> = {};
            (empData as any[])?.forEach(emp => {
                const existing = (attData as any[])?.find(a => a.employee_id === emp.id);
                attMap[emp.id] = existing || { employee_id: emp.id, status: "" };
            });
            setAttendance(attMap);

            // Fetch workforce settings
            const { data: wfSettings } = await supabase
                .from("workforce_settings")
                .select("*")
                .eq("is_active", true)
                .maybeSingle();
            setWorkforceSettings(wfSettings);

        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAllPresent = async () => {
        setSaving(true);
        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            const formattedDate = format(date, 'yyyy-MM-dd');
            const toUpsert = employees.map(emp => {
                const existing = attendance[emp.id];
                const needsUpdate = !existing?.status || existing?.status === "" || (existing?.status === "present" && (!existing.session_1 || !existing.session_2));
                
                if (needsUpdate) {
                    return {
                        employee_id: emp.id,
                        date: formattedDate,
                        status: "present",
                        session_1: true,
                        session_2: true,
                        marked_by: currentUser?.id,
                        updated_by: currentUser?.id
                    };
                }
                return null;
            }).filter(Boolean);

            if (toUpsert.length === 0) {
                toast({ title: "Nothing to update", description: "All employees already have a status." });
                setSaving(false);
                return;
            }

            // Update local state instantly for UI feedback
            setAttendance(prev => {
                const updated = { ...prev };
                toUpsert.forEach((record: any) => {
                    updated[record.employee_id] = { ...updated[record.employee_id], ...record };
                });
                return updated;
            });

            const { error } = await supabase
                .from("attendance")
                .upsert(toUpsert as any, { onConflict: 'employee_id,date' });

            if (error) throw error;
            toast({ title: "Updated", description: `${toUpsert.length} employees marked as Present` });
            fetchData();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Action Failed", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleClearRoster = async () => {
        if (!confirm("Are you sure you want to clear the entire roster for today? This will delete all clock records.")) return;
        setSaving(true);
        try {
            const formattedDate = format(date, 'yyyy-MM-dd');
            const { error } = await supabase
                .from("attendance")
                .delete()
                .eq("date", formattedDate);

            if (error) throw error;
            toast({ title: "Roster Cleared", description: "All attendance records for this date have been deleted." });
            fetchData();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const fetchEmployeeHistory = async () => {
        if (!selectedEmployeeId) return;

        const start = startOfMonth(date);
        const end = endOfMonth(date);

        try {
            const { data, error } = await supabase
                .from("attendance")
                .select("*, auditor:profiles!attendance_marked_by_fkey(full_name)")
                .eq("employee_id", selectedEmployeeId)
                .gte("date", format(start, 'yyyy-MM-dd'))
                .lte("date", format(end, 'yyyy-MM-dd'))
                .order("date", { ascending: false });

            if (error) throw error;
            setEmployeeAttendance(data || []);

            const stats = {
                present: (data as any[]).filter(a => a.status === 'present').length,
                absent: (data as any[]).filter(a => a.status === 'absent').length,
                leave: (data as any[]).filter(a => a.status === 'leave').length,
                halfDay: (data as any[]).filter(a => a.status === 'half-day').length,
                overtime: (data as any[]).filter(a => a.status === 'overtime').length,
                totalHours: (data as any[]).reduce((acc, a) => acc + (parseFloat(a.total_hours) || 0), 0),
                avgHours: 0
            };
            stats.avgHours = data.length > 0 ? stats.totalHours / data.length : 0;
            setMonthlyStats(stats);

        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    const handleStatusChange = (employeeId: string, status: string) => {
        setAttendance(prev => ({
            ...prev,
            [employeeId]: { ...prev[employeeId], status, employee_id: employeeId }
        }));
    };

    const handleToggleSelfService = async (employeeId: string, currentState: boolean) => {
        try {
            const { error } = await (supabase as any)
                .from("employees")
                .update({ attendance_self_service: !currentState } as any)
                .eq("id", employeeId);

            if (error) throw error;
            setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, attendance_self_service: !currentState } : e));
            toast({ title: "Updated", description: `Self-service attendance ${!currentState ? "enabled" : "disabled"}` });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Update Failed", description: error.message });
        }
    };

    const handleFieldChange = (employeeId: string, field: string, value: any) => {
        setAttendance(prev => {
            const updated = { ...prev[employeeId], [field]: value, employee_id: employeeId };

            // Handle manual check_in/check_out time overrides
            if (field === 'check_in' || field === 'check_out') {
                if (value && value.includes(':') && !value.includes('T')) {
                    // Combine the roster date with the manual time locally
                    const [hours, minutes] = value.split(':');
                    const newDateObj = new Date(date);
                    newDateObj.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
                    updated[field] = newDateObj.toISOString();
                }
            }

            // Auto-calculate total hours if check_in or check_out changes
            if (updated.check_in && updated.check_out) {
                const start = new Date(updated.check_in);
                const end = new Date(updated.check_out);
                let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                if (diff < 0) diff += 24; // Handle overnight shifts
                updated.total_hours = parseFloat(diff.toFixed(2));
            }

            return { ...prev, [employeeId]: updated };
        });
    };

    const handleManualAction = async (employeeId: string, action: 'clock_in' | 'clock_out' | 'leave' | 'holiday' | 'undo' | 'session_1' | 'session_2', value?: boolean) => {
        setActionLoading(`${employeeId}_${action}`);
        try {
            const now = new Date();
            const todayStr = format(date, 'yyyy-MM-dd');
            const existing = attendance[employeeId];

            if (action === 'undo') {
                if (existing?.id) {
                    const { error } = await supabase
                        .from("attendance")
                        .delete()
                        .eq("id", existing.id);
                    if (error) throw error;
                    setAttendance(prev => {
                        const updated = { ...prev };
                        updated[employeeId] = { employee_id: employeeId, status: "" };
                        return updated;
                    });
                    toast({ title: "Action Undone", description: "Attendance record has been reset." });
                }
            } else if (action === 'session_1' || action === 'session_2') {
                // Handle Session Toggles
                const currentSession1 = action === 'session_1' ? value : existing?.session_1;
                const currentSession2 = action === 'session_2' ? value : existing?.session_2;

                let newStatus = 'absent';
                if (currentSession1 && currentSession2) newStatus = 'present';
                else if (currentSession1 || currentSession2) newStatus = 'half-day';

                // If unchecking both, effectively absent/undo, but let's keep the record as absent for explicit tracking?
                // Or if it was present and now just one session, it becomes half-day.

                const payload: any = {
                    employee_id: employeeId,
                    date: todayStr,
                    [action]: value, // Update specific session
                    status: newStatus,
                    remarks: `Sessions: S1=${currentSession1 ? 'Y' : 'N'}, S2=${currentSession2 ? 'Y' : 'N'}`,
                    marked_by: (await supabase.auth.getUser()).data.user?.id
                };

                // Preserve other session if not changing it
                if (action === 'session_1' && existing?.session_2 !== undefined) payload.session_2 = existing.session_2;
                if (action === 'session_2' && existing?.session_1 !== undefined) payload.session_1 = existing.session_1;

                const { data, error } = await supabase
                    .from("attendance")
                    .upsert(payload, { onConflict: 'employee_id,date' })
                    .select()
                    .single();

                if (error) throw error;
                setAttendance(prev => ({ ...prev, [employeeId]: data }));
                // toast({ title: "Updated", description: `Session ${action === 'session_1' ? '1' : '2'} updated.` });

            } else if (action === 'clock_in') {
                const { data, error } = await supabase
                    .from("attendance")
                    .upsert({
                        employee_id: employeeId,
                        date: todayStr,
                        status: 'present',
                        session_1: true, // Auto-mark sessions for clock-in? Maybe.
                        session_2: true,
                        check_in: now.toISOString(),
                        marked_by: (await supabase.auth.getUser()).data.user?.id
                    } as any, { onConflict: 'employee_id,date' })
                    .select()
                    .single();
                if (error) throw error;
                setAttendance(prev => ({ ...prev, [employeeId]: data }));
                toast({ title: "Clocked In", description: `Manually clocked in at ${format(now, 'hh:mm a')}` });
            } else if (action === 'clock_out') {
                if (!existing?.check_in) throw new Error("Employee must be clocked in first.");
                const checkInTime = new Date(existing.check_in);
                const diff = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

                let overtime = 0;
                const standardHours = workforceSettings?.working_hours_per_day || 8;
                const otThreshold = workforceSettings?.overtime_threshold_daily || 0;

                if (diff > standardHours) {
                    const excess = diff - standardHours;
                    if (excess >= otThreshold) {
                        overtime = parseFloat(excess.toFixed(2));
                    }
                }

                const { data, error } = await (supabase as any)
                    .from("attendance")
                    .update({
                        check_out: now.toISOString(),
                        total_hours: parseFloat(diff.toFixed(2)),
                        overtime_hours: overtime,
                        status: overtime > 0 ? 'overtime' : 'present'
                    } as any)
                    .eq("id", existing.id)
                    .select()
                    .single();
                if (error) throw error;
                setAttendance(prev => ({ ...prev, [employeeId]: data }));
                toast({ title: "Clocked Out", description: `Manually clocked out. Total hours: ${diff.toFixed(2)}` });
            } else {
                const status = action === 'leave' ? 'leave' : 'paid-holiday';
                // For leave/holiday, likely clear sessions?
                const { data, error } = await supabase
                    .from("attendance")
                    .upsert({
                        employee_id: employeeId,
                        date: todayStr,
                        status: status,
                        session_1: status === 'paid-holiday', // Paid holiday counts as sessions? Logic says yes for pay, but strictly they are absent from work.
                        session_2: status === 'paid-holiday', // Let's keep them true if Paid Holiday checks for sessions.
                        // Actually RPC handles 'paid-holiday' status explicitly, so sessions don't strictly matter there, 
                        // but for consistency let's set them if we want visually "Full Day". 
                        // However, untoggling them in UI would remove "Present" status?
                        // Let's leave them FALSE so they don't show as "Present" in stats, but status is 'paid-holiday'.
                        remarks: `Marked as ${status} by Admin`,
                        marked_by: (await supabase.auth.getUser()).data.user?.id
                    } as any, { onConflict: 'employee_id,date' })
                    .select()
                    .single();
                if (error) throw error;
                setAttendance(prev => ({ ...prev, [employeeId]: data }));
                toast({ title: "Success", description: `Employee marked as ${status} for today.` });
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Action Failed", description: error.message });
        } finally {
            setActionLoading(null);
        }
    };




    const handleSave = async () => {
        setSaving(true);
        try {
            const formattedDate = format(date, 'yyyy-MM-dd');
            const { data: { user: currentUser } } = await supabase.auth.getUser();

            const toUpsert = Object.values(attendance)
                .filter((a: any) => a.status && a.status !== "")
                .map((a: any) => {
                    // Parse fallback times if they somehow missed handleFieldChange
                    const parseTime = (timeStr: string | null) => {
                        if (!timeStr) return null;
                        if (timeStr.includes('T')) return timeStr;
                        const [hours, minutes] = timeStr.split(':');
                        const newDateObj = new Date(date);
                        newDateObj.setHours(parseInt(hours, 10) || 0, parseInt(minutes, 10) || 0, 0, 0);
                        return newDateObj.toISOString();
                    };

                    const record: any = {
                        employee_id: a.employee_id,
                        date: formattedDate,
                        status: a.status,
                        session_1: a.session_1 ?? false,
                        session_2: a.session_2 ?? false,
                        overtime_hours: a.overtime_hours || 0,
                        check_in: parseTime(a.check_in),
                        check_out: parseTime(a.check_out),
                        total_hours: a.total_hours || 0,
                        remarks: a.remarks || "",
                        marked_by: a.marked_by || currentUser?.id,
                        updated_by: currentUser?.id
                    };

                    return record;
                });

            if (toUpsert.length === 0) {
                toast({ variant: "destructive", title: "Wait", description: "Please mark status for at least one employee before publishing." });
                setSaving(false);
                return;
            }

            const { error, data: savedData } = await supabase
                .from("attendance")
                .upsert(toUpsert as any, { onConflict: 'employee_id,date' })
                .select();

            if (error) throw error;

            toast({
                title: "Roster Published",
                description: `Successfully saved attendance for ${savedData?.length || 0} staff members.`
            });
            fetchData();
        } catch (error: any) {
            console.error("Save error:", error);
            toast({ variant: "destructive", title: "Sync Failed", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const globalStats = {
        present: Object.values(attendance).filter(a => (a as any).status === 'present' || (a as any).status === 'overtime' || (a as any).status === 'paid-holiday').length,
        absent: Object.values(attendance).filter(a => (a as any).status === 'absent').length,
        leave: Object.values(attendance).filter(a => (a as any).status === 'leave').length,
    };

    const modifiers = {
        present: (d: Date) => employeeAttendance.some(a => isSameDay(new Date(a.date), d) && a.status === 'present'),
        absent: (d: Date) => employeeAttendance.some(a => isSameDay(new Date(a.date), d) && a.status === 'absent'),
        halfDay: (d: Date) => employeeAttendance.some(a => isSameDay(new Date(a.date), d) && a.status === 'half-day'),
        leave: (d: Date) => employeeAttendance.some(a => isSameDay(new Date(a.date), d) && a.status === 'leave'),
        overtime: (d: Date) => employeeAttendance.some(a => isSameDay(new Date(a.date), d) && a.status === 'overtime'),
        holiday: (d: Date) => employeeAttendance.some(a => isSameDay(new Date(a.date), d) && a.status === 'holiday'),
        paidHoliday: (d: Date) => employeeAttendance.some(a => isSameDay(new Date(a.date), d) && a.status === 'paid-holiday'),
    };

    const modifierStyles = {
        present: { color: 'white', backgroundColor: '#10b981' },
        absent: { color: 'white', backgroundColor: '#f43f5e' },
        halfDay: { color: 'white', backgroundColor: '#f59e0b' },
        leave: { color: 'white', backgroundColor: '#3b82f6' },
        overtime: { color: 'white', backgroundColor: '#8b5cf6' },
        holiday: { color: 'white', backgroundColor: '#64748b' }, // Slate for Unpaid
        paidHoliday: { color: 'white', backgroundColor: '#6366f1' }, // Indigo for Paid
    };

    const handleDeleteLog = async (id: string) => {
        if (!confirm("Are you sure you want to delete this record?")) return;
        try {
            const { error } = await supabase
                .from("attendance")
                .delete()
                .eq("id", id);

            if (error) throw error;
            toast({ title: "Deleted", description: "Attendance record removed." });

            // Refresh data
            if (viewMode === 'history') {
                fetchEmployeeHistory();
            } else {
                fetchData();
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    return (
        <div className="flex flex-col lg:flex-row min-h-screen w-full bg-muted/40 font-inter">
            <AdminSidebar />
            <main className="flex-1 p-4 md:p-8 pt-6 overflow-y-auto">
                <div className="flex flex-col gap-6 max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Workforce Attendance</h1>
                            <p className="text-muted-foreground">Comprehensive tracking with automated audits and detailed history.</p>
                        </div>

                        <div className="flex items-center gap-2 bg-background p-1 rounded-xl border shadow-sm">
                            <Tabs value={viewMode} onValueChange={setViewMode} className="w-auto">
                                <TabsList className="bg-transparent h-9 p-0">
                                    <TabsTrigger value="daily" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground h-8 px-4 rounded-lg">Daily Roster</TabsTrigger>
                                    <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground h-8 px-4 rounded-lg">Detailed History</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </div>

                    <Tabs value={viewMode} className="w-full space-y-6">
                        <TabsContent value="daily" className="space-y-6 m-0 focus-visible:ring-0">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                    { label: "Present Today", value: globalStats.present, icon: UserCheck, color: "emerald" },
                                    { label: "Absent today", value: globalStats.absent, icon: UserX, color: "rose" },
                                    { label: "On Leave", value: globalStats.leave, icon: Clock, color: "amber" },
                                    { label: "Total Workforce", value: employees.length, icon: Users, color: "blue" }
                                ].map((stat, i) => (
                                    <Card key={i} className={`border-none shadow-sm bg-white hover:shadow-md transition-shadow duration-200`}>
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className={`text-[10px] font-bold uppercase tracking-wider text-muted-foreground`}>{stat.label}</p>
                                                    <h2 className={`text-2xl font-black text-${stat.color}-600`}>{stat.value}</h2>
                                                </div>
                                                <div className={`p-2 bg-${stat.color}-50 rounded-lg`}>
                                                    <stat.icon className={`h-5 w-5 text-${stat.color}-500`} />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            <Card className="border-none shadow-lg overflow-hidden">
                                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between bg-card pb-6 border-b gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background" onClick={() => {
                                                const newDate = new Date(date);
                                                newDate.setDate(newDate.getDate() - 1);
                                                setDate(newDate);
                                            }}><ChevronLeft className="h-4 w-4" /></Button>
                                            <Badge variant="outline" className="px-3 py-1 font-semibold text-sm bg-background border-none shadow-sm">{format(date, 'EEEE, MMMM do, yyyy')}</Badge>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background" onClick={() => {
                                                const newDate = new Date(date);
                                                newDate.setDate(newDate.getDate() + 1);
                                                setDate(newDate);
                                            }}><ChevronRight className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="outline" size="sm" className="h-9 px-4 font-black transition-all hover:bg-slate-900 hover:text-white">
                                                    <Zap className="mr-2 h-4 w-4 text-amber-500" />
                                                    Mark All Present
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Mark all as present?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will set the status of all employees who don't have a status yet to "Present" for {format(date, 'MMMM do')}.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleMarkAllPresent}>Continue</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="outline" size="sm" className="h-9 px-4 font-black transition-all hover:bg-rose-50 hover:text-rose-600 border-rose-100 hover:border-rose-200">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Clear Roster
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Clear the entire roster?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will delete all attendance records for {format(date, 'MMMM do')}. This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleClearRoster} className="bg-rose-600 hover:bg-rose-700">Delete All</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button disabled={saving} className="h-9 px-8 bg-indigo-600 hover:bg-indigo-700 font-black shadow-lg shadow-indigo-200">
                                                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarCheck className="mr-2 h-4 w-4" />}
                                                    Publish Roster
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Publish this attendance roster?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will save the current attendance records to the database and trigger any associated payroll processes.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Review</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleSave}>Confirm & Publish</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader className="bg-muted/30">
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="min-w-[200px] font-black text-slate-900 border-r py-4 px-6 bg-slate-50/50 whitespace-nowrap">1. EMPLOYEE INFO</TableHead>
                                                    <TableHead className="min-w-[120px] font-black text-slate-900 border-r py-4 px-6 bg-slate-50/50 whitespace-nowrap">2. PORTAL</TableHead>
                                                    <TableHead className="min-w-[280px] font-black text-slate-900 border-r py-4 px-6 bg-indigo-50/30 text-indigo-900 whitespace-nowrap">3. QUICK ACTIONS</TableHead>
                                                    <TableHead className="min-w-[240px] font-black text-slate-900 border-r py-4 px-6 bg-amber-50/30 text-amber-900 text-center whitespace-nowrap">4. MANUAL LOGS</TableHead>
                                                    <TableHead className="min-w-[220px] font-black text-slate-900 py-4 px-6 bg-slate-50/50 whitespace-nowrap">5. HOURS & REMARKS</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {loading ? (
                                                    <TableRow><TableCell colSpan={5} className="text-center py-20"><Clock className="h-8 w-8 animate-spin mx-auto mb-2 text-primary/40" />Indexing workforce data...</TableCell></TableRow>
                                                ) : employees.length === 0 ? (
                                                    <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground">No active employees found.</TableCell></TableRow>
                                                ) : (
                                                    employees.map((emp) => (
                                                        <TableRow key={emp.id} className="hover:bg-muted/20 transition-colors">
                                                            {/* 1. EMPLOYEE INFO */}
                                                            <TableCell className="border-r px-6 py-4 bg-slate-50/50">
                                                                <div className="flex flex-col">
                                                                    <span className="font-black text-slate-900 text-sm tracking-tight">{emp.name}</span>
                                                                    <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 w-fit px-1.5 rounded mt-0.5">{emp.position?.name}</span>
                                                                </div>
                                                            </TableCell>

                                                            {/* 2. PORTAL ACCESS */}
                                                            <TableCell className="border-r px-6 py-4">
                                                                <div className="flex flex-col gap-1.5">
                                                                    <div className="flex items-center gap-2">
                                                                        <Switch
                                                                            checked={emp.attendance_self_service}
                                                                            onCheckedChange={() => handleToggleSelfService(emp.id, emp.attendance_self_service)}
                                                                            className="scale-75 origin-left"
                                                                        />
                                                                        <span className={cn(
                                                                            "text-[9px] font-black uppercase tracking-widest",
                                                                            emp.attendance_self_service ? "text-emerald-600" : "text-slate-400"
                                                                        )}>
                                                                            {emp.attendance_self_service ? "Activated" : "Deactivated"}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Staff Portal Access</span>
                                                                </div>
                                                            </TableCell>

                                                            {/* 3. STATUS & QUICK ACTIONS */}
                                                            <TableCell className="border-r px-6 py-4 bg-indigo-50/5">
                                                                <div className="flex flex-col gap-3">
                                                                    <div className="flex flex-col gap-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-12">Session 1</Label>
                                                                            <Switch
                                                                                checked={attendance[emp.id]?.session_1}
                                                                                onCheckedChange={(c) => handleManualAction(emp.id, 'session_1', c)}
                                                                                className="scale-75 origin-left"
                                                                            />
                                                                            <span className="text-[9px] text-muted-foreground">
                                                                                {workforceSettings?.session_1_start_time?.slice(0, 5)} - {workforceSettings?.session_1_end_time?.slice(0, 5)}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-12">Session 2</Label>
                                                                            <Switch
                                                                                checked={attendance[emp.id]?.session_2}
                                                                                onCheckedChange={(c) => handleManualAction(emp.id, 'session_2', c)}
                                                                                className="scale-75 origin-left"
                                                                            />
                                                                            <span className="text-[9px] text-muted-foreground">
                                                                                {workforceSettings?.session_2_start_time?.slice(0, 5)} - {workforceSettings?.session_2_end_time?.slice(0, 5)}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Legacy Status Override (Hidden or Small) */}
                                                                    <Select
                                                                        value={attendance[emp.id]?.status || ""}
                                                                        onValueChange={(val) => handleStatusChange(emp.id, val)}
                                                                    >
                                                                        <SelectTrigger className="w-full h-6 text-[10px] font-bold bg-white border-slate-200 shadow-sm opacity-50 hover:opacity-100">
                                                                            <SelectValue placeholder="Override Status" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="present">Mark Present (Full)</SelectItem>
                                                                            <SelectItem value="absent">Mark Absent</SelectItem>
                                                                            <SelectItem value="half-day">Mark Half Day</SelectItem>
                                                                            <SelectItem value="leave">On Leave</SelectItem>
                                                                            <SelectItem value="overtime">Overtime Only</SelectItem>
                                                                            <SelectItem value="holiday">Company Holiday (Unpaid)</SelectItem>
                                                                            <SelectItem value="paid-holiday">Company Holiday (Paid)</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>

                                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                                        <TooltipProvider>
                                                                            {isToday && (
                                                                                <>
                                                                                    <Tooltip>
                                                                                        <TooltipTrigger asChild>
                                                                                            <Button
                                                                                                size="sm"
                                                                                                variant={attendance[emp.id]?.check_in && !attendance[emp.id]?.check_out ? "secondary" : "outline"}
                                                                                                className={cn(
                                                                                                    "h-8 px-2.5 gap-2 rounded-lg transition-all text-[10px] font-black uppercase tracking-tighter shadow-sm",
                                                                                                    attendance[emp.id]?.check_in && !attendance[emp.id]?.check_out && "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 hover:text-white"
                                                                                                )}
                                                                                                disabled={!!attendance[emp.id]?.check_in || actionLoading === `${emp.id}_clock_in`}
                                                                                                onClick={() => handleManualAction(emp.id, 'clock_in')}
                                                                                            >
                                                                                                {actionLoading === `${emp.id}_clock_in` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                                                                                                <span>In</span>
                                                                                            </Button>
                                                                                        </TooltipTrigger>
                                                                                        <TooltipContent>Record manual check-in</TooltipContent>
                                                                                    </Tooltip>

                                                                                    <Tooltip>
                                                                                        <TooltipTrigger asChild>
                                                                                            <Button
                                                                                                size="sm"
                                                                                                variant="outline"
                                                                                                className="h-8 px-2.5 gap-2 rounded-lg transition-all text-[10px] font-black uppercase tracking-tighter hover:bg-rose-600 hover:text-white hover:border-rose-700 shadow-sm"
                                                                                                disabled={!attendance[emp.id]?.check_in || !!attendance[emp.id]?.check_out || actionLoading === `${emp.id}_clock_out`}
                                                                                                onClick={() => handleManualAction(emp.id, 'clock_out')}
                                                                                            >
                                                                                                {actionLoading === `${emp.id}_clock_out` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                                                                                                <span>Out</span>
                                                                                            </Button>
                                                                                        </TooltipTrigger>
                                                                                        <TooltipContent>Record manual check-out</TooltipContent>
                                                                                    </Tooltip>
                                                                                </>
                                                                            )}

                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="outline"
                                                                                        className={cn(
                                                                                            "h-8 px-2.5 rounded-lg transition-all shadow-sm",
                                                                                            attendance[emp.id]?.status === 'leave' && "bg-blue-600 text-white border-blue-700 hover:bg-blue-700"
                                                                                        )}
                                                                                        disabled={!!attendance[emp.id]?.id && attendance[emp.id]?.status !== 'absent'}
                                                                                        onClick={() => handleManualAction(emp.id, 'leave')}
                                                                                    >
                                                                                        <CalendarCheck className="w-3.5 h-3.5" />
                                                                                    </Button>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>Quick Mark Leave</TooltipContent>
                                                                            </Tooltip>

                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="outline"
                                                                                        className={cn(
                                                                                            "h-8 px-2.5 rounded-lg transition-all shadow-sm",
                                                                                            attendance[emp.id]?.status === 'holiday' && "bg-amber-600 text-white border-amber-700 hover:bg-amber-700"
                                                                                        )}
                                                                                        disabled={!!attendance[emp.id]?.id && attendance[emp.id]?.status !== 'absent'}
                                                                                        onClick={() => handleManualAction(emp.id, 'holiday')}
                                                                                    >
                                                                                        <Palmtree className="w-3.5 h-3.5" />
                                                                                    </Button>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>Quick Mark Holiday</TooltipContent>
                                                                            </Tooltip>

                                                                            {attendance[emp.id]?.id && (
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <Button
                                                                                            size="sm"
                                                                                            variant="outline"
                                                                                            className="h-8 px-2.5 rounded-lg transition-all hover:bg-slate-900 hover:text-white shadow-sm border-dashed"
                                                                                            disabled={actionLoading === `${emp.id}_undo`}
                                                                                            onClick={() => handleManualAction(emp.id, 'undo')}
                                                                                        >
                                                                                            {actionLoading === `${emp.id}_undo` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                                                                        </Button>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent>Reset/Undo Record</TooltipContent>
                                                                                </Tooltip>
                                                                            )}
                                                                        </TooltipProvider>
                                                                    </div>
                                                                </div>
                                                            </TableCell>

                                                            {/* 4. MANUAL LOGS (CORRECTIONS) */}
                                                            <TableCell className="border-r px-6 py-4 bg-amber-50/5">
                                                                <div className="flex flex-wrap justify-center items-center gap-3 md:gap-6">
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><LogIn className="h-3 w-3" /> Correction In</span>
                                                                        <Input
                                                                            type="time"
                                                                            className="h-9 w-28 text-xs font-black text-center bg-white border-slate-200 shadow-inner rounded-xl focus:ring-amber-500"
                                                                            value={attendance[emp.id]?.check_in ? (attendance[emp.id].check_in.includes('T') ? format(new Date(attendance[emp.id].check_in), 'HH:mm') : attendance[emp.id].check_in) : ""}
                                                                            onChange={(e) => handleFieldChange(emp.id, 'check_in', e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><LogOut className="h-3 w-3" /> Correction Out</span>
                                                                        <Input
                                                                            type="time"
                                                                            className="h-9 w-28 text-xs font-black text-center bg-white border-slate-200 shadow-inner rounded-xl focus:ring-amber-500"
                                                                            value={attendance[emp.id]?.check_out ? (attendance[emp.id].check_out.includes('T') ? format(new Date(attendance[emp.id].check_out), 'HH:mm') : attendance[emp.id].check_out) : ""}
                                                                            onChange={(e) => handleFieldChange(emp.id, 'check_out', e.target.value)}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </TableCell>

                                                            {/* 5. HOURS & REMARKS */}
                                                            <TableCell className="px-6 py-4 bg-slate-50/50 align-top">
                                                                <div className="flex flex-col gap-3">
                                                                    <div className="flex flex-wrap items-center gap-4">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Hours</span>
                                                                            <div className="relative">
                                                                                <Input
                                                                                    type="number"
                                                                                    className="w-20 h-8 text-[11px] font-black text-center bg-slate-900 text-white border-slate-700 rounded-lg shadow-lg"
                                                                                    value={attendance[emp.id]?.total_hours || 0}
                                                                                    readOnly
                                                                                />
                                                                                <span className="absolute -top-1.5 -right-1 text-[7px] font-black bg-indigo-600 text-white px-1 rounded uppercase tracking-tighter">Calc</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">OT Overwrite</span>
                                                                            <Input
                                                                                type="number"
                                                                                step="0.5"
                                                                                className="w-16 h-8 text-[11px] font-black text-center bg-amber-50 border-amber-200 text-amber-900 rounded-lg"
                                                                                value={attendance[emp.id]?.overtime_hours || 0}
                                                                                onChange={(e) => handleFieldChange(emp.id, "overtime_hours", parseFloat(e.target.value))}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div className="relative">
                                                                        <Input
                                                                            placeholder="Add audit/manual adjustment note..."
                                                                            className="h-7 text-[10px] italic bg-transparent border-dashed border-slate-200 focus:bg-white transition-all w-full"
                                                                            value={attendance[emp.id]?.remarks || ""}
                                                                            onChange={(e) => handleFieldChange(emp.id, "remarks", e.target.value)}
                                                                        />
                                                                        {attendance[emp.id]?.marked_by && (
                                                                            <div className="absolute right-2 top-1.5 text-[7px] font-black text-slate-300 uppercase tracking-widest pointer-events-none">
                                                                                By Admin Ref: {attendance[emp.id].marked_by.substring(0, 6)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="history" className="space-y-6 m-0 focus-visible:ring-0">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="space-y-6">
                                    <Card className="border-none shadow-md">
                                        <CardHeader>
                                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                <Search className="w-4 h-4 text-primary" /> Select Employee
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                                                <SelectTrigger className="w-full font-bold">
                                                    <SelectValue placeholder="Search employee..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {employees.map(e => (
                                                        <SelectItem key={e.id} value={e.id} className="font-medium">{e.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </CardContent>
                                    </Card>

                                    {selectedEmployeeId && (
                                        <Card className="border-none shadow-md bg-primary text-primary-foreground">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm uppercase tracking-widest opacity-80">{format(date, 'MMMM yyyy')} Stats</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-[10px] font-bold opacity-70">PRESENT DAYS</p>
                                                        <p className="text-2xl font-black">{monthlyStats.present}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold opacity-70">ABSENT DAYS</p>
                                                        <p className="text-2xl font-black">{monthlyStats.absent}</p>
                                                    </div>
                                                </div>
                                                <div className="pt-4 border-t border-white/20">
                                                    <div className="flex justify-between items-end">
                                                        <div>
                                                            <p className="text-[10px] font-bold opacity-70 uppercase">Total Monthly Hours</p>
                                                            <p className="text-2xl font-black">{monthlyStats.totalHours.toFixed(1)} <span className="text-xs font-bold">Hrs</span></p>
                                                        </div>
                                                        <Badge className="bg-white/20 text-white border-none font-bold">
                                                            {((monthlyStats.present / 26) * 100).toFixed(0)}%
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>

                                <div className="lg:col-span-2 space-y-6">
                                    <Card className="border-none shadow-md">
                                        <CardHeader className="flex flex-row items-center justify-between">
                                            <div>
                                                <CardTitle>Calendar View</CardTitle>
                                                <CardDescription>Color-coded status tracking</CardDescription>
                                            </div>
                                            {selectedEmployeeId && (
                                                <div className="flex gap-1 flex-wrap justify-end">
                                                    {['present', 'absent', 'halfDay', 'leave', 'overtime', 'holiday', 'paidHoliday'].map(m => (
                                                        <div key={m} className="flex items-center gap-1">
                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: (modifierStyles as any)[m]?.backgroundColor || '#6366f1' }} />
                                                            <span className="text-[9px] uppercase font-medium text-muted-foreground mr-1">
                                                                {m === 'holiday' ? 'unpaid holiday' : m === 'paidHoliday' ? 'paid holiday' : m}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </CardHeader>
                                        <CardContent className="flex justify-center py-4">
                                            <Calendar
                                                mode="single"
                                                month={date}
                                                onMonthChange={setDate}
                                                selected={date}
                                                onSelect={(d) => d && setDate(d)}
                                                modifiers={modifiers}
                                                modifiersStyles={modifierStyles}
                                                className="rounded-xl border shadow-sm p-4 w-full max-w-md"
                                            />
                                        </CardContent>
                                    </Card>

                                    {selectedEmployeeId && (
                                        <Card className="border-none shadow-md">
                                            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                                                <CardTitle className="text-sm font-bold">Activity Log</CardTitle>
                                                <Button variant="outline" size="sm" className="h-8 text-xs"><Download className="w-3 h-3 mr-2" /> Export</Button>
                                            </CardHeader>
                                            <div className="overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Date</TableHead>
                                                            <TableHead>Status</TableHead>
                                                            <TableHead>In</TableHead>
                                                            <TableHead>Out</TableHead>
                                                            <TableHead>Total</TableHead>
                                                            <TableHead>Remarks & Auditor</TableHead>
                                                            <TableHead className="w-[50px]"></TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {employeeAttendance.length === 0 ? (
                                                            <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No records for this month</TableCell></TableRow>
                                                        ) : (
                                                            employeeAttendance.map((row) => (
                                                                <TableRow key={row.id} className="text-xs">
                                                                    <TableCell className="font-bold">{format(new Date(row.date), 'MMM dd, EEE')}</TableCell>
                                                                    <TableCell>
                                                                        <Badge className={cn(
                                                                            "text-[9px] uppercase font-bold border-none",
                                                                            row.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                                                                                row.status === 'absent' ? 'bg-rose-100 text-rose-700' :
                                                                                    row.status === 'half-day' ? 'bg-amber-100 text-amber-700' :
                                                                                        row.status === 'leave' ? 'bg-blue-100 text-blue-700' :
                                                                                            row.status === 'holiday' ? 'bg-slate-100 text-slate-700' :
                                                                                                row.status === 'paid-holiday' ? 'bg-indigo-100 text-indigo-700' :
                                                                                                    'bg-purple-100 text-purple-700'
                                                                        )}>
                                                                            {row.status}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell className="font-mono text-muted-foreground/70">
                                                                        {row.check_in ? format(new Date(row.check_in), 'hh:mm a') : "--:--"}
                                                                    </TableCell>
                                                                    <TableCell className="font-mono text-muted-foreground/70">
                                                                        {row.check_out ? format(new Date(row.check_out), 'hh:mm a') : "--:--"}
                                                                    </TableCell>
                                                                    <TableCell className="font-medium whitespace-nowrap">
                                                                        {row.total_hours || 0} h
                                                                        {row.overtime_hours > 0 && <span className="text-purple-600 ml-1">(+{row.overtime_hours})</span>}
                                                                    </TableCell>
                                                                    <TableCell className="text-muted-foreground italic">
                                                                        <div className="flex flex-col gap-1">
                                                                            <span>{row.remarks || '-'}</span>
                                                                            {row.auditor?.full_name && (
                                                                                <div className="flex items-center gap-1.5 mt-1">
                                                                                    <Badge variant="secondary" className="text-[8px] uppercase font-black bg-indigo-50 text-indigo-600 border-indigo-100 px-1.5 h-4">
                                                                                        Marked By: {row.auditor.full_name}
                                                                                    </Badge>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-7 w-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
                                                                            onClick={() => handleDeleteLog(row.id)}
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </Card>
                                    )}
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </main>
        </div>
    );
}
