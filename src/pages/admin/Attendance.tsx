import { useState, useEffect } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
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
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    UserX,
    Users,
    Search,
    Download
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AttendancePage() {
    const { toast } = useToast();
    const [viewMode, setViewMode] = useState<string>("daily");
    const [date, setDate] = useState<Date>(new Date());
    const [employees, setEmployees] = useState<any[]>([]);
    const [attendance, setAttendance] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

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
                .select("id, name, position:positions(name)")
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
            empData?.forEach(emp => {
                const existing = attData?.find(a => a.employee_id === emp.id);
                attMap[emp.id] = existing || { employee_id: emp.id, status: "" };
            });
            setAttendance(attMap);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAllPresent = () => {
        const newAttendance = { ...attendance };
        employees.forEach(emp => {
            if (!attendance[emp.id]?.status || attendance[emp.id]?.status === "") {
                newAttendance[emp.id] = { ...attendance[emp.id], status: "present" };
            }
        });
        setAttendance(newAttendance);
        toast({ title: "Updated", description: "All unmarked employees set to Present" });
    };

    const fetchEmployeeHistory = async () => {
        if (!selectedEmployeeId) return;

        const start = startOfMonth(date);
        const end = endOfMonth(date);

        try {
            const { data, error } = await supabase
                .from("attendance")
                .select("*")
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
                totalHours: (data as any[]).reduce((acc, a) => acc + (parseFloat(a.overtime_hours) || 0) + (a.status === 'present' ? 8 : a.status === 'half-day' ? 4 : 0), 0),
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

    const handleFieldChange = (employeeId: string, field: string, value: any) => {
        setAttendance(prev => ({
            ...prev,
            [employeeId]: { ...prev[employeeId], [field]: value, employee_id: employeeId }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const formattedDate = format(date, 'yyyy-MM-dd');
            const { data: { user: currentUser } } = await supabase.auth.getUser();

            const toUpsert = Object.values(attendance)
                .filter((a: any) => a.status && a.status !== "")
                .map((a: any) => {
                    const record: any = {
                        employee_id: a.employee_id,
                        date: formattedDate,
                        status: a.status,
                        overtime_hours: a.overtime_hours || 0,
                        remarks: a.remarks || "",
                        marked_by: a.marked_by || currentUser?.id,
                        updated_by: currentUser?.id
                    };

                    // Only include id if it's an existing record
                    if (a.id) {
                        record.id = a.id;
                    }

                    return record;
                });

            if (toUpsert.length === 0) {
                toast({ variant: "destructive", title: "Wait", description: "Please mark status for at least one employee before publishing." });
                setSaving(false);
                return;
            }

            const { error, data: savedData } = await supabase
                .from("attendance")
                .upsert(toUpsert, { onConflict: 'employee_id,date' })
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
        present: Object.values(attendance).filter(a => a.status === 'present' || a.status === 'overtime').length,
        absent: Object.values(attendance).filter(a => a.status === 'absent').length,
        leave: Object.values(attendance).filter(a => a.status === 'leave').length,
    };

    const modifiers = {
        present: (d: Date) => employeeAttendance.some(a => isSameDay(new Date(a.date), d) && a.status === 'present'),
        absent: (d: Date) => employeeAttendance.some(a => isSameDay(new Date(a.date), d) && a.status === 'absent'),
        halfDay: (d: Date) => employeeAttendance.some(a => isSameDay(new Date(a.date), d) && a.status === 'half-day'),
        leave: (d: Date) => employeeAttendance.some(a => isSameDay(new Date(a.date), d) && a.status === 'leave'),
        overtime: (d: Date) => employeeAttendance.some(a => isSameDay(new Date(a.date), d) && a.status === 'overtime'),
    };

    const modifierStyles = {
        present: { color: 'white', backgroundColor: '#10b981' },
        absent: { color: 'white', backgroundColor: '#f43f5e' },
        halfDay: { color: 'white', backgroundColor: '#f59e0b' },
        leave: { color: 'white', backgroundColor: '#3b82f6' },
        overtime: { color: 'white', backgroundColor: '#8b5cf6' },
    };

    return (
        <div className="flex min-h-screen w-full bg-muted/40 font-inter">
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
                                <CardHeader className="flex flex-row items-center justify-between bg-card pb-6 border-b">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background" onClick={() => {
                                                const newDate = new Date(date);
                                                newDate.setDate(newDate.getDate() - 1);
                                                setDate(newDate);
                                            }}><ChevronLeft className="h-4 w-4" /></Button>
                                            <Badge variant="outline" className="px-3 py-1 font-semibold text-sm bg-background border-none shadow-sm">{format(date, 'MMMM do, yyyy')}</Badge>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background" onClick={() => {
                                                const newDate = new Date(date);
                                                newDate.setDate(newDate.getDate() + 1);
                                                setDate(newDate);
                                            }}><ChevronRight className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={handleMarkAllPresent}>Mark All Present</Button>
                                        <Button onClick={handleSave} disabled={saving} className="shadow-md hover:shadow-lg transition-all">
                                            {saving ? "Syncing..." : "Publish Roster"}
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader className="bg-muted/30">
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="w-[200px] font-bold py-4">Employee</TableHead>
                                                    <TableHead className="font-bold">Status</TableHead>
                                                    <TableHead className="font-bold">Overtime</TableHead>
                                                    <TableHead className="font-bold">Remarks / Audit Note</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {loading ? (
                                                    <TableRow><TableCell colSpan={4} className="text-center py-20"><Clock className="h-8 w-8 animate-spin mx-auto mb-2 text-primary/40" />Indexing workforce data...</TableCell></TableRow>
                                                ) : employees.length === 0 ? (
                                                    <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground">No active employees found.</TableCell></TableRow>
                                                ) : (
                                                    employees.map((emp) => (
                                                        <TableRow key={emp.id} className="hover:bg-muted/20 transition-colors">
                                                            <TableCell>
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-sm">{emp.name}</span>
                                                                    <span className="text-[10px] uppercase font-bold text-muted-foreground">{emp.position?.name}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Select
                                                                    value={attendance[emp.id]?.status || ""}
                                                                    onValueChange={(val) => handleStatusChange(emp.id, val)}
                                                                >
                                                                    <SelectTrigger className="w-[130px] h-8 text-xs font-semibold">
                                                                        <SelectValue placeholder="Mark status" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="present">Present</SelectItem>
                                                                        <SelectItem value="absent">Absent</SelectItem>
                                                                        <SelectItem value="half-day">Half Day</SelectItem>
                                                                        <SelectItem value="leave">On Leave</SelectItem>
                                                                        <SelectItem value="overtime">Overtime</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <Input
                                                                        type="number"
                                                                        step="0.5"
                                                                        min="0"
                                                                        placeholder="Hrs"
                                                                        className="w-20 h-8 text-xs font-bold bg-muted/30 border-none"
                                                                        value={attendance[emp.id]?.overtime_hours || 0}
                                                                        onChange={(e) => handleFieldChange(emp.id, "overtime_hours", parseFloat(e.target.value))}
                                                                        disabled={attendance[emp.id]?.status !== 'overtime'}
                                                                    />
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Input
                                                                    placeholder="Add note for audit log..."
                                                                    className="h-8 text-[11px] bg-muted/10 italic border-muted"
                                                                    value={attendance[emp.id]?.remarks || ""}
                                                                    onChange={(e) => handleFieldChange(emp.id, "remarks", e.target.value)}
                                                                />
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
                                                    {['present', 'absent', 'halfDay', 'leave', 'overtime'].map(m => (
                                                        <div key={m} className="flex items-center gap-1">
                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: (modifierStyles as any)[m].backgroundColor }} />
                                                            <span className="text-[9px] uppercase font-medium text-muted-foreground mr-1">{m}</span>
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
                                                className="rounded-xl border shadow-sm p-4 w-full max-w-md pointer-events-none"
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
                                                            <TableHead className="text-[10px] font-bold">DATE</TableHead>
                                                            <TableHead className="text-[10px] font-bold">STATUS</TableHead>
                                                            <TableHead className="text-[10px] font-bold">EST. HRS</TableHead>
                                                            <TableHead className="text-[10px] font-bold">NOTES</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {employeeAttendance.length === 0 ? (
                                                            <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No records for this month</TableCell></TableRow>
                                                        ) : (
                                                            employeeAttendance.map((row) => (
                                                                <TableRow key={row.id} className="text-xs">
                                                                    <TableCell className="font-bold">{format(new Date(row.date), 'MMM dd')}</TableCell>
                                                                    <TableCell>
                                                                        <Badge className={`text-[9px] uppercase font-bold border-none ${row.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                                                                            row.status === 'absent' ? 'bg-rose-100 text-rose-700' :
                                                                                row.status === 'half-day' ? 'bg-amber-100 text-amber-700' :
                                                                                    row.status === 'leave' ? 'bg-blue-100 text-blue-700' :
                                                                                        'bg-purple-100 text-purple-700'
                                                                            }`}>
                                                                            {row.status}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell className="font-medium">{row.status === 'overtime' ? (parseFloat(row.overtime_hours) + 8) : (row.status === 'present' ? 8 : (row.status === 'half-day' ? 4 : 0))}</TableCell>
                                                                    <TableCell className="text-muted-foreground italic">{row.remarks || '-'}</TableCell>
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
