import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import {
    Clock,
    Calendar,
    CheckCircle2,
    XCircle,
    AlertCircle,
    History,
    FileText,
    LogOut,
    LogIn,
    Loader2,
    Archive,
    Briefcase,
    User,
    ChevronLeft
} from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

export default function StaffAttendance() {
    const { user, signOut } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [employee, setEmployee] = useState<any>(null);
    const [settings, setSettings] = useState<any>(null);
    const [todayAttendance, setTodayAttendance] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
    const [leaveData, setLeaveData] = useState({
        type: "sick",
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        reason: ""
    });

    useEffect(() => {
        if (user) {
            fetchEmployeeData();
        }
    }, [user]);

    const fetchEmployeeData = async () => {
        setLoading(true);
        try {
            // Fetch employee
            const { data: empData, error: empError } = await (supabase as any)
                .from("employees")
                .select("*")
                .eq("user_id", user?.id)
                .single();

            if (empError) throw empError;
            setEmployee(empData);

            // Fetch workforce settings
            const { data: settsData } = await (supabase as any)
                .from("workforce_settings")
                .select("*")
                .eq("is_active", true)
                .maybeSingle();
            setSettings(settsData);

            if (empData) {
                // Fetch today's attendance
                const today = format(new Date(), 'yyyy-MM-dd');
                const { data: attData, error: attError } = await (supabase as any)
                    .from("attendance")
                    .select("*")
                    .eq("employee_id", (empData as any).id)
                    .eq("date", today)
                    .maybeSingle();

                if (attError) throw attError;
                setTodayAttendance(attData);

                // Fetch history
                const start = startOfMonth(new Date());
                const end = endOfMonth(new Date());
                const { data: histData, error: histError } = await (supabase as any)
                    .from("attendance")
                    .select("*")
                    .eq("employee_id", (empData as any).id)
                    .gte("date", format(start, 'yyyy-MM-dd'))
                    .lte("date", format(end, 'yyyy-MM-dd'))
                    .order("date", { ascending: false });

                if (histError) throw histError;
                setHistory(histData || []);
            }
        } catch (error: any) {
            console.error("Error fetching staff attendance data:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load attendance data." });
        } finally {
            setLoading(false);
        }
    };

    const handleClockIn = async () => {
        if (!employee) return;
        setActionLoading(true);
        try {
            const now = new Date();
            const today = format(now, 'yyyy-MM-dd');

            const { error } = await (supabase as any)
                .from("attendance")
                .upsert({
                    employee_id: (employee as any).id,
                    date: today,
                    status: 'present',
                    check_in: now.toISOString(),
                } as any, { onConflict: 'employee_id,date' });

            if (error) throw error;

            toast({ title: "Clocked In", description: `Clocked in at ${format(now, 'hh:mm a')}` });
            fetchEmployeeData();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Clock-in Failed", description: error.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handleClockOut = async () => {
        if (!employee || !todayAttendance) return;
        setActionLoading(true);
        try {
            const now = new Date();
            const checkIn = new Date(todayAttendance.check_in);
            const diff = (now.getTime() - checkIn.getTime()) / (1000 * 60 * 60);

            let overtime = 0;
            const standardHours = settings?.working_hours_per_day || 8;
            const otThreshold = settings?.overtime_threshold_daily || 0;

            if (diff > standardHours) {
                const excess = diff - standardHours;
                if (excess >= otThreshold) {
                    overtime = parseFloat(excess.toFixed(2));
                }
            }

            const { error } = await (supabase as any)
                .from("attendance")
                .update({
                    check_out: now.toISOString(),
                    total_hours: parseFloat(diff.toFixed(2)),
                    overtime_hours: overtime,
                    status: overtime > 0 ? 'overtime' : 'present'
                } as any)
                .eq("id", (todayAttendance as any).id);

            if (error) throw error;

            toast({ title: "Clocked Out", description: `Clocked out at ${format(now, 'hh:mm a')}. Total hours: ${diff.toFixed(2)}` });
            fetchEmployeeData();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Clock-out Failed", description: error.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handleLeaveSubmit = async () => {
        if (!employee) return;
        setActionLoading(true);
        try {
            const { error } = await (supabase as any)
                .from("leave_requests")
                .insert({
                    employee_id: (employee as any).id,
                    leave_type: leaveData.type,
                    start_date: leaveData.startDate,
                    end_date: leaveData.endDate,
                    reason: leaveData.reason,
                    status: 'pending'
                } as any);

            if (error) throw error;

            toast({ title: "Leave Requested", description: "Your leave request has been submitted for approval." });
            setIsLeaveDialogOpen(false);
            setLeaveData({
                type: "sick",
                startDate: format(new Date(), 'yyyy-MM-dd'),
                endDate: format(new Date(), 'yyyy-MM-dd'),
                reason: ""
            });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Request Failed", description: error.message });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

    if (!employee || !employee.attendance_self_service) {
        return (
            <div className="flex min-h-screen bg-muted/40 font-inter">
                <main className="flex-1 p-8 flex items-center justify-center">
                    <Card className="max-w-md w-full text-center">
                        <CardHeader>
                            <div className="mx-auto bg-amber-50 p-3 rounded-full w-fit mb-4">
                                <AlertCircle className="h-10 w-10 text-amber-500" />
                            </div>
                            <CardTitle>Attendance Restricted</CardTitle>
                            <CardDescription>
                                Attendance self-service is not enabled for your account. Please contact your manager to mark your attendance.
                            </CardDescription>
                        </CardHeader>
                        <CardFooter className="flex justify-center">
                            <Button onClick={() => navigate("/staff")}>Back to Dashboard</Button>
                        </CardFooter>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground font-inter">
            {/* Header - Matching Staff Dashboard */}
            <header className="border-b border-border bg-background/80 sticky top-0 z-50 backdrop-blur-xl">
                <div className="container mx-auto px-4 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/staff")} className="h-10 w-10">
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex flex-col">
                            <span className="text-lg font-bold text-primary uppercase tracking-tight">
                                My Attendance
                            </span>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                Self-Service Portal
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-secondary/50 rounded-2xl border border-border shadow-inner">
                            <User className="h-4 w-4 text-primary" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">Employee</span>
                                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                                    {employee.name}
                                </span>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-xl border-border bg-secondary shadow-inner text-muted-foreground hover:text-destructive transition-colors"
                            onClick={signOut}
                        >
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                <div className="max-w-5xl mx-auto space-y-8">
                    {/* Header Summary */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-black uppercase tracking-tight">Status Overview</h2>
                            <p className="text-muted-foreground text-sm font-bold uppercase tracking-wider">{format(new Date(), 'EEEE, MMMM do, yyyy')}</p>
                        </div>
                        <Badge variant={todayAttendance?.check_in && !todayAttendance?.check_out ? "outline" : "secondary"} className={cn(
                            "px-4 py-1.5 font-bold uppercase tracking-widest text-[10px]",
                            todayAttendance?.check_in && !todayAttendance?.check_out && "bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse"
                        )}>
                            {todayAttendance?.check_in && !todayAttendance?.check_out ? "Currently Clocked In" : "Currently Off Clock"}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Clock In/Out Card */}
                        <Card className="md:col-span-2 border-none shadow-lg">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-primary" /> Daily Attendance
                                </CardTitle>
                                <CardDescription>Record your working hours for today.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-2 gap-8 py-4">
                                    <div className="space-y-2 text-center border-r">
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Clock In</p>
                                        <div className="text-3xl font-black">{todayAttendance?.check_in ? format(new Date(todayAttendance.check_in), 'hh:mm a') : "--:--"}</div>
                                    </div>
                                    <div className="space-y-2 text-center">
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Clock Out</p>
                                        <div className="text-3xl font-black">{todayAttendance?.check_out ? format(new Date(todayAttendance.check_out), 'hh:mm a') : "--:--"}</div>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <Button
                                        className="flex-1 h-14 text-lg font-bold shadow-lg shadow-primary/20"
                                        onClick={handleClockIn}
                                        disabled={actionLoading || !!todayAttendance?.check_in}
                                    >
                                        {actionLoading ? <Loader2 className="animate-spin mr-2" /> : <LogIn className="mr-2" />}
                                        Clock In
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        className="flex-1 h-14 text-lg font-bold shadow-lg shadow-destructive/20"
                                        onClick={handleClockOut}
                                        disabled={actionLoading || !todayAttendance?.check_in || !!todayAttendance?.check_out}
                                    >
                                        {actionLoading ? <Loader2 className="animate-spin mr-2" /> : <LogOut className="mr-2" />}
                                        Clock Out
                                    </Button>
                                </div>
                                {todayAttendance?.total_hours && (
                                    <p className="text-center text-sm font-medium text-green-600 mt-2">
                                        You've worked {todayAttendance.total_hours} hours today.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Quick Actions / Stats */}
                        <div className="space-y-6">
                            <Card className="border-none shadow-md">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">This Month</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm">Present Days</span>
                                        <Badge variant="outline" className="font-bold">{history.filter(h => h.status === 'present' || h.status === 'overtime').length}</Badge>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm">Total Hours</span>
                                        <Badge variant="outline" className="font-bold">{history.reduce((acc, h) => acc + (parseFloat(h.total_hours) || 0), 0).toFixed(1)} h</Badge>
                                    </div>
                                </CardContent>
                            </Card>

                            <Dialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="w-full h-12 border-primary/20 hover:bg-primary/5 text-primary gap-2">
                                        <FileText className="h-4 w-4" /> Request Leave
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Request Leave</DialogTitle>
                                        <DialogDescription>Submit a formal leave request for approval.</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Leave Type</Label>
                                            <Select value={leaveData.type} onValueChange={(v) => setLeaveData({ ...leaveData, type: v })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="sick">Sick Leave</SelectItem>
                                                    <SelectItem value="casual">Casual Leave</SelectItem>
                                                    <SelectItem value="vacation">Vacation</SelectItem>
                                                    <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Start Date</Label>
                                                <Input type="date" value={leaveData.startDate} onChange={(e) => setLeaveData({ ...leaveData, startDate: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>End Date</Label>
                                                <Input type="date" value={leaveData.endDate} onChange={(e) => setLeaveData({ ...leaveData, endDate: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Reason</Label>
                                            <Textarea placeholder="Explain the reason for leave..." value={leaveData.reason} onChange={(e) => setLeaveData({ ...leaveData, reason: e.target.value })} />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsLeaveDialogOpen(false)}>Cancel</Button>
                                        <Button onClick={handleLeaveSubmit} disabled={actionLoading}>
                                            {actionLoading ? <Loader2 className="animate-spin mr-2" /> : "Submit Request"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>

                    {/* Attendance History */}
                    <Card className="border-none shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History className="h-5 w-5 text-primary" /> Attendance History
                            </CardTitle>
                            <CardDescription>Your records for the current month.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[150px]">Date</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Check In</TableHead>
                                        <TableHead>Check Out</TableHead>
                                        <TableHead>Hours</TableHead>
                                        <TableHead>Notes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No records found for this month.</TableCell>
                                        </TableRow>
                                    ) : (
                                        history.map((row) => (
                                            <TableRow key={row.id}>
                                                <TableCell className="font-bold">{format(new Date(row.date), 'MMM dd, EEE')}</TableCell>
                                                <TableCell>
                                                    <Badge className={`text-[10px] uppercase font-bold border-none ${row.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                                                        row.status === 'absent' ? 'bg-rose-100 text-rose-700' :
                                                            row.status === 'half-day' ? 'bg-amber-100 text-amber-700' :
                                                                row.status === 'leave' ? 'bg-blue-100 text-blue-700' :
                                                                    row.status === 'holiday' ? 'bg-slate-100 text-slate-700' :
                                                                        row.status === 'paid-holiday' ? 'bg-indigo-100 text-indigo-700' :
                                                                            'bg-purple-100 text-purple-700'
                                                        }`}>
                                                        {row.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {row.check_in ? format(new Date(row.check_in), 'hh:mm a') : "-"}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {row.check_out ? format(new Date(row.check_out), 'hh:mm a') : "-"}
                                                </TableCell>
                                                <TableCell className="font-medium text-xs">
                                                    {row.total_hours || 0} h
                                                    {row.overtime_hours > 0 && <span className="text-purple-600 ml-1">(+{row.overtime_hours} OT)</span>}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground italic truncate max-w-[150px]">
                                                    {row.remarks || "-"}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
