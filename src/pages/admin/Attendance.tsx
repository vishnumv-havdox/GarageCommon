import { useState, useEffect } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { AttendanceTabsNav } from "@/components/layout/AttendanceTabsNav";
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
    Zap,
    Edit
} from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

    // Drawer edit state
    const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState<any | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Drawer form state
    const [editStatus, setEditStatus] = useState<string>("");
    const [editSession1, setEditSession1] = useState<boolean>(false);
    const [editSession2, setEditSession2] = useState<boolean>(false);
    const [editSelfService, setEditSelfService] = useState<boolean>(false);
    const [editCheckIn, setEditCheckIn] = useState<string>("");
    const [editCheckOut, setEditCheckOut] = useState<string>("");
    const [editOvertimeHours, setEditOvertimeHours] = useState<number>(0);
    const [editRemarks, setEditRemarks] = useState<string>("");
    const [isSavingDrawer, setIsSavingDrawer] = useState<boolean>(false);

    useEffect(() => {
        if (selectedEmployeeForEdit) {
            const { emp, att } = selectedEmployeeForEdit;
            setEditStatus(att?.status || "present");
            setEditSession1(att?.session_1 || false);
            setEditSession2(att?.session_2 || false);
            setEditSelfService(emp.attendance_self_service || false);
            
            const getFormattedTime = (timeStr: string | null) => {
                if (!timeStr) return "";
                if (timeStr.includes('T')) {
                    return format(new Date(timeStr), 'HH:mm');
                }
                return timeStr;
            };
            setEditCheckIn(getFormattedTime(att?.check_in));
            setEditCheckOut(getFormattedTime(att?.check_out));
            setEditOvertimeHours(att?.overtime_hours || 0);
            setEditRemarks(att?.remarks || "");
        }
    }, [selectedEmployeeForEdit]);

    const handleSaveDrawer = async () => {
        if (!selectedEmployeeForEdit) return;
        setIsSavingDrawer(true);
        try {
            const { emp, att } = selectedEmployeeForEdit;
            const todayStr = format(date, 'yyyy-MM-dd');
            const userId = (await supabase.auth.getUser()).data.user?.id;

            if (emp.attendance_self_service !== editSelfService) {
                const { error: empError } = await (supabase as any)
                    .from("employees")
                    .update({ attendance_self_service: editSelfService } as any)
                    .eq("id", emp.id);
                if (empError) throw empError;
                setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, attendance_self_service: editSelfService } : e));
            }

            let checkInISO = null;
            let checkOutISO = null;
            
            const mergeDateWithTime = (timeStr: string) => {
                if (!timeStr) return null;
                const [hours, minutes] = timeStr.split(':');
                const newDateObj = new Date(date);
                newDateObj.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
                return newDateObj.toISOString();
            };

            if (editCheckIn) checkInISO = mergeDateWithTime(editCheckIn);
            if (editCheckOut) checkOutISO = mergeDateWithTime(editCheckOut);

            let calculatedTotalHours = 0;
            if (checkInISO && checkOutISO) {
                const start = new Date(checkInISO);
                const end = new Date(checkOutISO);
                let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                if (diff < 0) diff += 24;
                calculatedTotalHours = parseFloat(diff.toFixed(2));
            }

            const payload: any = {
                employee_id: emp.id,
                date: todayStr,
                status: editStatus,
                session_1: editSession1,
                session_2: editSession2,
                check_in: checkInISO,
                check_out: checkOutISO,
                total_hours: calculatedTotalHours,
                overtime_hours: editOvertimeHours,
                remarks: editRemarks,
                marked_by: userId
            };

            if (att?.id) {
                payload.id = att.id;
            }

            const { data, error } = await supabase
                .from("attendance")
                .upsert(payload, { onConflict: 'employee_id,date' })
                .select()
                .single();

            if (error) throw error;

            setAttendance(prev => ({
                ...prev,
                [emp.id]: data
            }));

            toast({ title: "Changes Saved", description: `Successfully updated attendance details for ${emp.name}.` });
            setIsDrawerOpen(false);
            setSelectedEmployeeForEdit(null);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Save Failed", description: error.message });
        } finally {
            setIsSavingDrawer(false);
        }
    };

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
            <main className="flex-1 p-4 md:p-8">
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

                    <AttendanceTabsNav />

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
                                    <div className="flex flex-wrap gap-2">
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
                                                    <TableHead className="font-bold text-slate-900 py-4 px-6">Employee</TableHead>
                                                    <TableHead className="font-bold text-slate-900 py-4 px-6">Portal Access</TableHead>
                                                    <TableHead className="font-bold text-slate-900 py-4 px-6 text-center">Status</TableHead>
                                                    <TableHead className="font-bold text-slate-900 py-4 px-6 text-center">Shift & Duration</TableHead>
                                                    <TableHead className="font-bold text-slate-900 py-4 px-6 text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {loading ? (
                                                    <TableRow><TableCell colSpan={5} className="text-center py-20"><Clock className="h-8 w-8 animate-spin mx-auto mb-2 text-primary/40" />Indexing workforce data...</TableCell></TableRow>
                                                ) : employees.length === 0 ? (
                                                    <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground">No active employees found.</TableCell></TableRow>
                                                ) : (
                                                    employees.map((emp) => {
                                                        const att = attendance[emp.id];
                                                        return (
                                                            <TableRow key={emp.id} className="hover:bg-muted/20 transition-colors">
                                                                <TableCell className="px-6 py-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                                                            <AvatarFallback className="text-sm font-bold bg-primary text-primary-foreground">
                                                                                {emp.name.substring(0, 2).toUpperCase()}
                                                                            </AvatarFallback>
                                                                        </Avatar>
                                                                        <div className="flex flex-col">
                                                                            <span className="font-bold text-slate-900 text-sm tracking-tight">{emp.name}</span>
                                                                            <span className="text-[10px] uppercase font-bold text-primary/75 w-fit rounded mt-0.5">{emp.position?.name}</span>
                                                                        </div>
                                                                    </div>
                                                                </TableCell>

                                                                <TableCell className="px-6 py-4">
                                                                    <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5", emp.attendance_self_service ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200")}>
                                                                        {emp.attendance_self_service ? "Enabled" : "Disabled"}
                                                                    </Badge>
                                                                </TableCell>

                                                                <TableCell className="px-6 py-4 text-center">
                                                                    {att?.status ? (
                                                                        <Badge variant="outline" className={cn(
                                                                            "text-[10px] uppercase font-bold px-2.5 py-1 border-none",
                                                                            att.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                                                                            att.status === 'absent' ? 'bg-rose-100 text-rose-700' :
                                                                            att.status === 'half-day' ? 'bg-amber-100 text-amber-700' :
                                                                            att.status === 'leave' ? 'bg-blue-100 text-blue-700' :
                                                                            att.status === 'holiday' ? 'bg-slate-100 text-slate-700' :
                                                                            att.status === 'paid-holiday' ? 'bg-indigo-100 text-indigo-700' :
                                                                            'bg-purple-100 text-purple-700'
                                                                        )}>
                                                                            {att.status}
                                                                        </Badge>
                                                                    ) : (
                                                                        <span className="text-xs text-muted-foreground italic">Not Marked</span>
                                                                    )}
                                                                </TableCell>

                                                                <TableCell className="px-6 py-4 text-center">
                                                                    <div className="flex flex-col items-center justify-center gap-1">
                                                                        {att?.check_in ? (
                                                                            <>
                                                                                <span className="text-xs font-semibold text-slate-700">
                                                                                    {format(new Date(att.check_in), 'hh:mm a')}
                                                                                    {att?.check_out ? ` - ${format(new Date(att.check_out), 'hh:mm a')}` : ' - Active'}
                                                                                </span>
                                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                                                        {att.total_hours || 0} hrs
                                                                                    </span>
                                                                                    {att.overtime_hours > 0 && (
                                                                                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                                                                            +{att.overtime_hours} OT
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </>
                                                                        ) : (
                                                                            <span className="text-xs text-slate-400">--</span>
                                                                        )}
                                                                    </div>
                                                                </TableCell>

                                                                <TableCell className="px-6 py-4 text-right">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <div className="flex items-center gap-1">
                                                                            {!att?.check_in && att?.status !== 'leave' && att?.status !== 'paid-holiday' ? (
                                                                                <>
                                                                                    <TooltipProvider>
                                                                                        <Tooltip>
                                                                                            <TooltipTrigger asChild>
                                                                                                <Button
                                                                                                    size="sm"
                                                                                                    variant="outline"
                                                                                                    className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-100"
                                                                                                    onClick={() => handleManualAction(emp.id, 'clock_in')}
                                                                                                    disabled={actionLoading === `${emp.id}_clock_in`}
                                                                                                >
                                                                                                    {actionLoading === `${emp.id}_clock_in` ? (
                                                                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                                                    ) : (
                                                                                                        <LogIn className="h-4 w-4" />
                                                                                                    )}
                                                                                                </Button>
                                                                                            </TooltipTrigger>
                                                                                            <TooltipContent>Clock In</TooltipContent>
                                                                                        </Tooltip>
                                                                                    </TooltipProvider>

                                                                                    <TooltipProvider>
                                                                                        <Tooltip>
                                                                                            <TooltipTrigger asChild>
                                                                                                <Button
                                                                                                    size="sm"
                                                                                                    variant="outline"
                                                                                                    className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-100"
                                                                                                    onClick={() => handleManualAction(emp.id, 'leave')}
                                                                                                    disabled={actionLoading === `${emp.id}_leave`}
                                                                                                >
                                                                                                    <Palmtree className="h-4 w-4" />
                                                                                                </Button>
                                                                                            </TooltipTrigger>
                                                                                            <TooltipContent>Mark Leave</TooltipContent>
                                                                                        </Tooltip>
                                                                                    </TooltipProvider>
                                                                                </>
                                                                            ) : att?.check_in && !att?.check_out ? (
                                                                                <TooltipProvider>
                                                                                    <Tooltip>
                                                                                        <TooltipTrigger asChild>
                                                                                            <Button
                                                                                                size="sm"
                                                                                                variant="outline"
                                                                                                className="h-8 px-2.5 gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-100 text-xs font-semibold"
                                                                                                onClick={() => handleManualAction(emp.id, 'clock_out')}
                                                                                                disabled={actionLoading === `${emp.id}_clock_out`}
                                                                                            >
                                                                                                {actionLoading === `${emp.id}_clock_out` ? (
                                                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                                                ) : (
                                                                                                    <LogOut className="h-3.5 w-3.5" />
                                                                                                )}
                                                                                                <span>Clock Out</span>
                                                                                            </Button>
                                                                                        </TooltipTrigger>
                                                                                        <TooltipContent>Clock Out</TooltipContent>
                                                                                    </Tooltip>
                                                                                </TooltipProvider>
                                                                            ) : (
                                                                                att?.id && (
                                                                                    <TooltipProvider>
                                                                                        <Tooltip>
                                                                                            <TooltipTrigger asChild>
                                                                                                <Button
                                                                                                    size="sm"
                                                                                                    variant="outline"
                                                                                                    className="h-8 w-8 p-0 hover:bg-slate-100 border-dashed"
                                                                                                    onClick={() => handleManualAction(emp.id, 'undo')}
                                                                                                    disabled={actionLoading === `${emp.id}_undo`}
                                                                                                >
                                                                                                    {actionLoading === `${emp.id}_undo` ? (
                                                                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                                                    ) : (
                                                                                                        <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                                                                                                    )}
                                                                                                </Button>
                                                                                            </TooltipTrigger>
                                                                                            <TooltipContent>Reset Record</TooltipContent>
                                                                                        </Tooltip>
                                                                                    </TooltipProvider>
                                                                                )
                                                                            )}
                                                                        </div>

                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            className="h-8 w-8 p-0 hover:bg-muted text-slate-600"
                                                                            onClick={() => {
                                                                                setSelectedEmployeeForEdit({ emp, att });
                                                                                setIsDrawerOpen(true);
                                                                            }}
                                                                        >
                                                                            <Edit className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })
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

            <Sheet open={isDrawerOpen} onOpenChange={(open) => {
                setIsDrawerOpen(open);
                if (!open) setSelectedEmployeeForEdit(null);
            }}>
                <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-white p-6">
                    <SheetHeader className="pb-4 border-b">
                        <SheetTitle className="text-lg font-bold text-slate-900">Edit Attendance</SheetTitle>
                        <SheetDescription className="text-sm text-slate-500">
                            Modify daily record and portal configurations.
                        </SheetDescription>
                    </SheetHeader>

                    {selectedEmployeeForEdit && (
                        <div className="py-6 space-y-6">
                            {/* Employee profile header */}
                            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                    <AvatarFallback className="text-base font-bold bg-primary text-primary-foreground">
                                        {selectedEmployeeForEdit.emp.name.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-900">{selectedEmployeeForEdit.emp.name}</span>
                                    <span className="text-xs font-medium text-slate-500">{selectedEmployeeForEdit.emp.position?.name || "Staff Member"}</span>
                                </div>
                                <div className="ml-auto text-right">
                                    <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                        {format(date, 'MMM dd, yyyy')}
                                    </span>
                                </div>
                            </div>

                            {/* Self service toggle */}
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Portal Control</Label>
                                <div className="flex items-center justify-between bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-sm font-semibold text-slate-900">Staff Portal Access</span>
                                        <span className="text-[10px] text-slate-500">Allow staff to request changes via their portal</span>
                                    </div>
                                    <Switch
                                        checked={editSelfService}
                                        onCheckedChange={setEditSelfService}
                                    />
                                </div>
                            </div>

                            {/* Attendance Status */}
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Daily Status</Label>
                                <Select value={editStatus} onValueChange={setEditStatus}>
                                    <SelectTrigger className="w-full font-semibold">
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="present" className="font-semibold">Present (Full Day)</SelectItem>
                                        <SelectItem value="absent" className="font-semibold">Absent</SelectItem>
                                        <SelectItem value="half-day" className="font-semibold">Half Day</SelectItem>
                                        <SelectItem value="leave" className="font-semibold">On Leave</SelectItem>
                                        <SelectItem value="overtime" className="font-semibold">Overtime Only</SelectItem>
                                        <SelectItem value="holiday" className="font-semibold">Company Holiday (Unpaid)</SelectItem>
                                        <SelectItem value="paid-holiday" className="font-semibold">Company Holiday (Paid)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Session control */}
                            {(editStatus === 'present' || editStatus === 'half-day') && (
                                <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Work Sessions</Label>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs font-bold text-slate-700">Session 1 (Morning)</span>
                                                <span className="text-[10px] text-slate-400">{workforceSettings?.session_1_start_time?.slice(0, 5)} - {workforceSettings?.session_1_end_time?.slice(0, 5)}</span>
                                            </div>
                                            <Switch
                                                checked={editSession1}
                                                onCheckedChange={(checked) => {
                                                    setEditSession1(checked);
                                                    if (checked && editSession2) setEditStatus('present');
                                                    else if (checked || editSession2) setEditStatus('half-day');
                                                    else setEditStatus('absent');
                                                }}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs font-bold text-slate-700">Session 2 (Afternoon)</span>
                                                <span className="text-[10px] text-slate-400">{workforceSettings?.session_2_start_time?.slice(0, 5)} - {workforceSettings?.session_2_end_time?.slice(0, 5)}</span>
                                            </div>
                                            <Switch
                                                checked={editSession2}
                                                onCheckedChange={(checked) => {
                                                    setEditSession2(checked);
                                                    if (editSession1 && checked) setEditStatus('present');
                                                    else if (editSession1 || checked) setEditStatus('half-day');
                                                    else setEditStatus('absent');
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Time Correction */}
                            {(editStatus === 'present' || editStatus === 'half-day' || editStatus === 'overtime') && (
                                <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Shift Timing Corrections</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Clock In</span>
                                            <Input
                                                type="time"
                                                value={editCheckIn}
                                                onChange={(e) => setEditCheckIn(e.target.value)}
                                                className="bg-white border-slate-200"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Clock Out</span>
                                            <Input
                                                type="time"
                                                value={editCheckOut}
                                                onChange={(e) => setEditCheckOut(e.target.value)}
                                                className="bg-white border-slate-200"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Hours and Overtime override */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">OT Overwrite (hrs)</Label>
                                    <Input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        value={editOvertimeHours}
                                        onChange={(e) => setEditOvertimeHours(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Shift (hrs)</Label>
                                    <div className="h-10 flex items-center justify-center bg-slate-900 text-white rounded-lg text-sm font-bold">
                                        {(() => {
                                            if (!editCheckIn || !editCheckOut) return "0.00";
                                            const [h1, m1] = editCheckIn.split(':');
                                            const [h2, m2] = editCheckOut.split(':');
                                            const start = new Date(date);
                                            start.setHours(parseInt(h1, 10), parseInt(m1, 10), 0, 0);
                                            const end = new Date(date);
                                            end.setHours(parseInt(h2, 10), parseInt(m2, 10), 0, 0);
                                            let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                                            if (diff < 0) diff += 24;
                                            return diff.toFixed(2);
                                        })()} hrs
                                    </div>
                                </div>
                            </div>

                            {/* Remarks */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Remarks / Auditor Note</Label>
                                <Input
                                    placeholder="Reason for correction or adjustment note..."
                                    value={editRemarks}
                                    onChange={(e) => setEditRemarks(e.target.value)}
                                    className="text-xs italic"
                                />
                            </div>
                        </div>
                    )}

                    <SheetFooter className="pt-4 border-t gap-2 sm:gap-0 mt-auto">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsDrawerOpen(false);
                                setSelectedEmployeeForEdit(null);
                            }}
                            disabled={isSavingDrawer}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveDrawer}
                            disabled={isSavingDrawer}
                            className="bg-primary text-white font-bold"
                        >
                            {isSavingDrawer ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save Changes"
                            )}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    );
}
