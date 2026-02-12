import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, startOfDay, endOfDay, isSameDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { History, Calendar as CalendarIcon, List, Clock, Car, Phone, Mail, User, CheckCircle2, XCircle, MoreVertical, Plus, ArrowRight, RefreshCw, Trash2, Search, Filter, Users, AlertCircle, Building2, Pencil, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { WorkOrderForm } from "@/components/forms/WorkOrderForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { GarageMetricsDashboard } from "@/components/dashboard/GarageMetricsDashboard";

export default function Appointments() {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchAppointments();

        // Subscribe to realtime changes
        const channel = supabase
            .channel('admin-appointments')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
                fetchAppointments();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [date]); // Refetch when date changes

    const fetchAppointments = async () => {
        if (!date) return;
        setLoading(true);
        try {
            // Fetch appointments for the selected date OR all pending?
            // Let's fetch for selected date primarily, maybe show pending on a separate "Inbox" view?
            // Actually, admin usually wants to see "Today's Schedule" but also "Pending Requests" regardless of date.
            // Let's do:
            // 1. Fetch ALL 'pending' appointments (to not miss requests).
            // 2. Fetch ALL appointments for the selected date.

            const start = startOfDay(date).toISOString();
            const end = endOfDay(date).toISOString();

            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    *,
                    customer:customers(id, name, phone, company_name),
                    vehicle:vehicles(id, vehicle_number, model, vehicle_type),
                    services:appointment_services(service_name),
                    history:appointment_history(
                        *,
                        actor:profiles!changed_by(full_name)
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Filter out history hidden from admin
            const processed = (data || []).map(app => ({
                ...app,
                history: (app.history || []).filter((h: any) => h.hidden_from_admin !== true)
            }));

            const sorted = processed.sort((a, b) => {
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (a.status !== 'pending' && b.status === 'pending') return 1;
                return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
            });

            setAppointments(sorted);
        } catch (error: any) {
            console.error("Error fetching appointments:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load appointments" });
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id: string, status: 'pending' | 'confirmed' | 'rejected' | 'converted' | 'completed' | 'cancelled') => {
        try {
            const { error } = await (supabase
                .from('appointments') as any)
                .update({
                    status,
                    status_updated_by: user?.id
                })
                .eq('id', id);

            if (error) throw error;

            // Record in history
            const oldApp = appointments.find(a => a.id === id);
            await (supabase.from('appointment_history') as any).insert({
                appointment_id: id,
                old_status: oldApp?.status,
                new_status: status,
                changed_by: user?.id,
                action_type: 'status_changed',
                notes: `Status changed to ${status}`
            });

            toast({ title: "Status Updated", description: `Appointment marked as ${status}` });
            fetchAppointments();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    const handleDeleteAppointment = async (id: string) => {
        try {
            const oldApp = appointments.find(a => a.id === id);
            const { error } = await (supabase
                .from('appointments') as any)
                .update({
                    status: 'cancelled',
                    deleted_at: new Date().toISOString(),
                    status_updated_by: user?.id
                })
                .eq('id', id);

            if (error) throw error;

            // Record in history
            await (supabase.from('appointment_history') as any).insert({
                appointment_id: id,
                old_status: oldApp?.status,
                new_status: 'cancelled',
                changed_by: user?.id,
                action_type: 'soft_deleted',
                notes: 'Appointment soft-deleted by admin'
            });

            toast({ title: "Appointment Deleted", description: "The record has been permanently removed." });
            fetchAppointments();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: "Failed to delete appointment" });
        }
    };

    const filteredAppointments = appointments.filter(app => {
        if (filterStatus === 'all') return true;
        return app.status === filterStatus;
    }).filter(app => {
        // If date is selected, show:
        // 1. Any 'pending' appointment (so they don't get lost)
        // 2. Confirmed/Other appointments ONLY if they match the date.
        if (app.status === 'pending') return true;
        // If we are in history mode (status not in pending/confirmed), IGNORE the date filter
        if (!['pending', 'confirmed'].includes(app.status)) return true;
        return isSameDay(new Date(app.scheduled_at), date);
    });

    const pendingCount = appointments.filter(a => a.status === 'pending').length;

    // Get upcoming confirmed appointments (next 7 days, excluding selected date if it's today)
    const upcomingConfirmed = appointments.filter(app =>
        app.status === 'confirmed' &&
        new Date(app.scheduled_at) > (date ? endOfDay(date) : new Date())
    ).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

    const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
    const [isJobCardOpen, setIsJobCardOpen] = useState(false);

    // Time Edit State
    const [isTimeEditOpen, setIsTimeEditOpen] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState<any | null>(null);
    const [newTime, setNewTime] = useState("");

    const handleOpenTimeEdit = (app: any) => {
        setEditingAppointment(app);
        setNewTime(format(new Date(app.scheduled_at), "h:mm a"));
        setIsTimeEditOpen(true);
    };

    const handleSaveTime = async () => {
        if (!editingAppointment || !newTime) return;

        try {
            const [hours, minutes] = newTime.split(':').map(Number);
            const newDate = new Date(editingAppointment.scheduled_at);
            newDate.setHours(hours);
            newDate.setMinutes(minutes);

            const { error } = await (supabase
                .from('appointments') as any)
                .update({ scheduled_at: newDate.toISOString() })
                .eq('id', editingAppointment.id);

            if (error) throw error;

            toast({ title: "Time Updated", description: "Appointment rescheduled successfully." });
            fetchAppointments();
            setIsTimeEditOpen(false);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: "Failed to update time" });
        }
    };

    const handleOpenJobCard = (app: any) => {
        setSelectedAppointment(app);
        setIsJobCardOpen(true);
    };

    const handleJobCardSuccess = () => {
        setIsJobCardOpen(false);
        if (selectedAppointment) {
            // Optionally update status to 'converted' or 'completed'
            updateStatus(selectedAppointment.id, 'converted');
            toast({
                title: "Work Order Created",
                description: "The appointment has been successfully converted to a work order.",
                action: (
                    <Button variant="outline" size="sm" onClick={() => navigate('/admin/work-orders')}>
                        View Orders
                    </Button>
                ),
            });
        }
        setSelectedAppointment(null);
        fetchAppointments();
    };

    return (
        <>
            <div className="flex h-screen bg-background">
                <AdminSidebar />
                <main className="flex-1 overflow-y-auto bg-background/50">
                    <div className="flex flex-col gap-4 p-4 md:flex-row md:gap-8 lg:p-8 min-h-full">
                        {/* Sidebar / Calendar */}
                        <div className="flex w-full flex-col gap-4 md:w-80 lg:w-96 shrink-0">
                            <Card className="border-border shadow-sm">
                                <CardHeader>
                                    <CardTitle>Schedule</CardTitle>
                                    <CardDescription>Select a date to view appointments</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={setDate}
                                        className="rounded-md border border-border mx-auto"
                                        modifiers={{
                                            hasAppointment: (date) =>
                                                appointments.some(app =>
                                                    format(new Date(app.scheduled_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') &&
                                                    !['cancelled', 'rejected', 'completed'].includes(app.status)
                                                )
                                        }}
                                        modifiersStyles={{
                                            hasAppointment: {
                                                fontWeight: 'bold',
                                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                                color: '#3b82f6',
                                                border: '1px solid rgba(59, 130, 246, 0.2)'
                                            }
                                        }}
                                    />
                                </CardContent>
                            </Card>

                            <Card className="border-border shadow-sm bg-primary/5 border-primary/20">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5 text-primary" />
                                        Pending Requests
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-primary">{pendingCount}</div>
                                    <p className="text-xs text-muted-foreground">Requires attention</p>
                                </CardContent>
                            </Card>

                            {/* Upcoming Confirmed */}
                            {upcomingConfirmed.length > 0 && (
                                <Card className="border-border shadow-sm border-emerald-200 bg-emerald-50/10">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <CalendarDays className="h-5 w-5 text-emerald-600" />
                                            Upcoming
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {upcomingConfirmed.slice(0, 3).map(app => (
                                                <div key={app.id} className="text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-semibold">{format(new Date(app.scheduled_at), "MMM d")}</span>
                                                        <span className="text-xs text-muted-foreground">{format(new Date(app.scheduled_at), "h:mm a")}</span>
                                                    </div>
                                                    <div className="text-muted-foreground truncate">{app.customer?.name}</div>
                                                    <Button
                                                        variant="link"
                                                        className="h-auto p-0 text-xs text-emerald-600 mt-1"
                                                        onClick={() => setDate(new Date(app.scheduled_at))}
                                                    >
                                                        Go to date <ArrowRight className="h-3 w-3 ml-1" />
                                                    </Button>
                                                </div>
                                            ))}
                                            {upcomingConfirmed.length > 3 && (
                                                <p className="text-xs text-center text-muted-foreground pt-1">
                                                    + {upcomingConfirmed.length - 3} more
                                                </p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Main Content Area */}
                        <div className="flex-1 flex flex-col gap-6 min-w-0">
                            {/* Page Header */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
                                    <p className="text-muted-foreground text-sm">
                                        {date ? format(date, "EEEE, MMMM do, yyyy") : "All Appointments"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input
                                            placeholder="Search customer, vehicle..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="bg-background/50 border-border h-9 pl-9 w-64 text-sm"
                                        />
                                    </div>
                                    <Button onClick={fetchAppointments} variant="outline" size="icon" className="h-9 w-9 bg-background/50 border-border hover:bg-primary/10 transition-colors">
                                        <RefreshCw className={cn("h-4 w-4 text-primary", loading && "animate-spin")} />
                                    </Button>
                                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Filter Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Status</SelectItem>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="confirmed">Confirmed</SelectItem>
                                            <SelectItem value="converted">Converted</SelectItem>
                                            <SelectItem value="completed">Completed</SelectItem>
                                            <SelectItem value="cancelled">Cancelled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Garage Metrics Dashboard */}
                            <GarageMetricsDashboard showDetailed={true} selectedDate={date} />

                            <Tabs defaultValue="active" className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-4 p-1 bg-secondary/30 rounded-xl border border-border/50">
                                    <TabsTrigger value="active" className="font-bold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">Active Appointments</TabsTrigger>
                                    <TabsTrigger value="history" className="font-bold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all flex items-center gap-2">
                                        <History className="h-4 w-4" />
                                        Audit History
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="active">
                                    <ScrollArea className="h-[calc(100vh-320px)] -mr-4 pr-4">
                                        <div className="space-y-4 pb-10">
                                            {filteredAppointments.filter(a => ['pending', 'confirmed'].includes(a.status)).length === 0 ? (
                                                <div className="text-center py-20 bg-background/50 rounded-xl border border-dashed">
                                                    <CalendarIcon className="h-10 w-10 mx-auto text-muted-foreground mb-4 opacity-20" />
                                                    <h3 className="text-lg font-medium">No active appointments</h3>
                                                    <p className="text-muted-foreground text-sm">Either no slots booked for this day or filters are too strict.</p>
                                                </div>
                                            ) : (
                                                filteredAppointments.filter(a => ['pending', 'confirmed'].includes(a.status)).map(app => (
                                                    <AppointmentCard key={app.id} app={app} onUpdateStatus={updateStatus} onDelete={handleDeleteAppointment} onEditTime={handleOpenTimeEdit} onCreateJobCard={handleOpenJobCard} />
                                                ))
                                            )}
                                        </div>
                                    </ScrollArea>
                                </TabsContent>

                                <TabsContent value="history">
                                    <ScrollArea className="h-[calc(100vh-320px)] -mr-4 pr-4">
                                        <div className="space-y-4 pb-10">
                                            <div className="flex items-center justify-between px-2">
                                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                                    <History className="h-3 w-3" /> Comprehensive Audit Log
                                                </h3>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-[10px] h-7 font-bold text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        >
                                                            <Trash2 className="h-3 w-3 mr-1" /> Clear Logs
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Clear All Activity Logs?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Permanently clear ALL appointment history from the database? This cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={async () => {
                                                                    const { error } = await (supabase as any).from('appointment_history').update({ hidden_from_admin: true }).neq('id', '00000000-0000-0000-0000-000000000000');
                                                                    if (!error) {
                                                                        toast({ title: "Audit Log Cleared", description: "All appointment history has been deleted." });
                                                                        fetchAppointments();
                                                                    }
                                                                }}
                                                                className="bg-destructive hover:bg-destructive/90"
                                                            >
                                                                Clear All
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>

                                            <div className="space-y-6">
                                                {(() => {
                                                    const allLogs = appointments
                                                        .flatMap(app => (app.history || []).map((h: any) => ({ ...h, appointment: app })))
                                                        .filter(log => {
                                                            const searchStr = `${log.appointment.customer?.name} ${log.appointment.customer?.company_name || ""} ${log.appointment.vehicle?.vehicle_number} ${log.action_type} ${log.new_status}`.toLowerCase();
                                                            return searchStr.includes(searchTerm.toLowerCase());
                                                        })
                                                        .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

                                                    const grouped: Record<string, any[]> = allLogs.reduce((acc: any, log: any) => {
                                                        const customerName = log.appointment.customer?.name || 'Unknown';
                                                        const companyName = log.appointment.customer?.company_name;
                                                        const key = companyName ? `${customerName} (${companyName})` : customerName;
                                                        if (!acc[key]) acc[key] = [];
                                                        acc[key].push(log);
                                                        return acc;
                                                    }, {});

                                                    if (allLogs.length === 0) {
                                                        return (
                                                            <div className="text-center py-20 bg-background/50 rounded-xl border border-dashed">
                                                                <Search className="h-10 w-10 mx-auto text-muted-foreground mb-4 opacity-20" />
                                                                <h3 className="text-lg font-medium">No results found</h3>
                                                                <p className="text-muted-foreground text-sm">Try adjusting your search terms.</p>
                                                            </div>
                                                        );
                                                    }

                                                    return Object.entries(grouped).map(([customer, logs]: [string, any[]]) => (
                                                        <Card key={customer} className="border-border bg-background/40 backdrop-blur-md overflow-hidden rounded-2xl">
                                                            <CardHeader className="bg-secondary/20 py-3 px-4 flex flex-row items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                                                                        <User className="h-4 w-4 text-primary" />
                                                                    </div>
                                                                    <CardTitle className="text-sm font-bold uppercase tracking-tight">{customer}</CardTitle>
                                                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-background/50">
                                                                        {logs.length} Records
                                                                    </Badge>
                                                                </div>
                                                            </CardHeader>
                                                            <CardContent className="p-0">
                                                                <Table>
                                                                    <TableHeader className="bg-secondary/10">
                                                                        <TableRow className="hover:bg-transparent border-0">
                                                                            <TableHead className="text-[9px] font-bold uppercase py-2 h-8">Time</TableHead>
                                                                            <TableHead className="text-[9px] font-bold uppercase h-8">Vehicle</TableHead>
                                                                            <TableHead className="text-[9px] font-bold uppercase h-8">Action</TableHead>
                                                                            <TableHead className="text-[9px] font-bold uppercase h-8">Changes</TableHead>
                                                                            <TableHead className="text-[9px] font-bold uppercase h-8">By</TableHead>
                                                                            <TableHead className="text-[9px] font-bold uppercase h-8">Who Approved</TableHead>
                                                                            <TableHead className="text-[9px] font-bold uppercase h-8 text-right"></TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {logs.map((log) => (
                                                                            <TableRow key={log.id} className="hover:bg-secondary/5 group border-b border-border/30 last:border-0">
                                                                                <TableCell className="text-[10px] font-medium py-3">
                                                                                    {format(new Date(log.changed_at), "MMM d, h:mm a")}
                                                                                </TableCell>
                                                                                <TableCell className="text-[10px]">
                                                                                    {log.appointment.vehicle?.vehicle_number}
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <Badge variant="outline" className={cn(
                                                                                        "capitalize text-[9px] h-4 px-1 leading-none font-bold",
                                                                                        log.action_type === 'created' ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5" :
                                                                                            log.action_type === 'soft_deleted' ? "border-red-500/30 text-red-500 bg-red-500/5" :
                                                                                                "border-primary/30 text-primary bg-primary/5"
                                                                                    )}>
                                                                                        {log.action_type.replace('_', ' ')}
                                                                                    </Badge>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <div className="text-[10px] flex items-center gap-1 flex-wrap">
                                                                                        {log.old_status && (
                                                                                            <>
                                                                                                <span className="text-muted-foreground line-through opacity-50">{log.old_status}</span>
                                                                                                <ArrowRight className="h-2 w-2 text-muted-foreground" />
                                                                                            </>
                                                                                        )}
                                                                                        <span className="font-bold text-foreground capitalize">{log.new_status || log.notes || '-'}</span>
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell className="text-[9px] text-muted-foreground">
                                                                                    <span className="opacity-70 mr-1">
                                                                                        {log.action_type === 'created' ? 'Scheduled by ' :
                                                                                            log.action_type === 'status_changed' && log.new_status === 'confirmed' ? 'Approved by ' :
                                                                                                log.action_type === 'status_changed' && log.new_status === 'converted' ? 'Allocated by ' :
                                                                                                    log.action_type === 'soft_deleted' ? 'Cancelled by ' :
                                                                                                        'Action by '}
                                                                                    </span>
                                                                                    {log.actor?.full_name || 'System'}
                                                                                </TableCell>
                                                                                <TableCell className="text-[10px]">
                                                                                    {log.action_type === 'status_changed' && log.new_status === 'confirmed' ? (log.actor?.full_name || 'System') : '-'}
                                                                                </TableCell>
                                                                                <TableCell className="text-right">
                                                                                    <AlertDialog>
                                                                                        <AlertDialogTrigger asChild>
                                                                                            <Button
                                                                                                variant="ghost"
                                                                                                size="icon"
                                                                                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                                                                            >
                                                                                                <XCircle className="h-3 w-3" />
                                                                                            </Button>
                                                                                        </AlertDialogTrigger>
                                                                                        <AlertDialogContent>
                                                                                            <AlertDialogHeader>
                                                                                                <AlertDialogTitle>Delete Log Entry?</AlertDialogTitle>
                                                                                                <AlertDialogDescription>
                                                                                                    Are you sure you want to remove this log entry from the admin view?
                                                                                                </AlertDialogDescription>
                                                                                            </AlertDialogHeader>
                                                                                            <AlertDialogFooter>
                                                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                                                <AlertDialogAction
                                                                                                    onClick={async () => {
                                                                                                        const { error } = await (supabase as any).from('appointment_history').update({ hidden_from_admin: true }).eq('id', log.id);
                                                                                                        if (!error) {
                                                                                                            toast({ title: "Removed" });
                                                                                                            fetchAppointments();
                                                                                                        }
                                                                                                    }}
                                                                                                    className="bg-destructive hover:bg-destructive/90"
                                                                                                >
                                                                                                    Delete
                                                                                                </AlertDialogAction>
                                                                                            </AlertDialogFooter>
                                                                                        </AlertDialogContent>
                                                                                    </AlertDialog>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </CardContent>
                                                        </Card>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    </ScrollArea>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                </main>
            </div>

            {/* Create Job Card Dialog */}
            <Dialog open={isJobCardOpen} onOpenChange={setIsJobCardOpen}>
                <DialogContent className="max-w-5xl h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-md">
                    <DialogHeader>
                        <DialogTitle>Create Job Card</DialogTitle>
                        <DialogDescription>
                            Convert this appointment into a functional work order.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedAppointment && (
                        <WorkOrderForm
                            onSuccess={handleJobCardSuccess}
                            onCancel={() => setIsJobCardOpen(false)}
                            initialData={{
                                customerId: selectedAppointment.customer?.id,
                                vehicleId: selectedAppointment.vehicle?.id,
                                description: selectedAppointment.notes,
                                serviceTypeNames: selectedAppointment.services?.map((s: any) => s.service_name) || [],
                                requestedServices: selectedAppointment.services?.map((s: any) => s.service_name) || []
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Time Edit Dialog */}
            <Dialog open={isTimeEditOpen} onOpenChange={setIsTimeEditOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Appointment Date & Time</DialogTitle>
                        <DialogDescription>
                            Adjust the scheduled appointment date and arrival time.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="date" className="text-right">
                                Date
                            </Label>
                            <Input
                                id="date"
                                type="date"
                                value={editingAppointment ? format(new Date(editingAppointment.scheduled_at), "yyyy-MM-dd") : ""}
                                onChange={(e) => {
                                    if (editingAppointment) {
                                        const newDate = new Date(editingAppointment.scheduled_at);
                                        const selectedDate = new Date(e.target.value);
                                        newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                                        setEditingAppointment({ ...editingAppointment, scheduled_at: newDate.toISOString() });
                                    }
                                }}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="time" className="text-right">
                                Time
                            </Label>
                            <Input
                                id="time"
                                type="time"
                                value={newTime}
                                onChange={(e) => setNewTime(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setIsTimeEditOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveTime}>Update Schedule</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

function AppointmentCard({ app, onUpdateStatus, onDelete, onEditTime, onCreateJobCard }: any) {
    const navigate = useNavigate();
    return (
        <Card className={cn(
            "transition-all hover:shadow-md border-l-4",
            app.status === 'pending' ? "border-l-yellow-500 bg-yellow-50/10" :
                app.status === 'confirmed' ? "border-l-emerald-500 bg-emerald-50/10" :
                    app.status === 'converted' ? "border-l-blue-500 bg-blue-50/10" :
                        app.status === 'cancelled' ? "border-l-red-500 opacity-75" :
                            "border-l-primary"
        )}>
            <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6 justify-between">
                    {/* Left: Date, Time & Customer */}
                    <div className="flex gap-4">
                        <div
                            className="group flex flex-col items-center justify-center min-w-[80px] h-20 rounded-xl bg-secondary text-secondary-foreground border border-border cursor-pointer hover:bg-primary/10 transition-colors relative"
                            onClick={() => onEditTime(app)}
                        >
                            <CalendarDays className="h-5 w-5 mb-1 opacity-75" />
                            <span className="font-bold text-lg">{format(new Date(app.scheduled_at), "MMM d")}</span>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 rounded-xl transition-opacity">
                                <Pencil className="h-4 w-4" />
                            </div>
                        </div>
                        <div
                            className="group flex flex-col items-center justify-center min-w-[80px] h-20 rounded-xl bg-secondary text-secondary-foreground border border-border cursor-pointer hover:bg-primary/10 transition-colors relative"
                            onClick={() => onEditTime(app)}
                        >
                            <Clock className="h-5 w-5 mb-1 opacity-75" />
                            <span className="font-bold text-lg">{format(new Date(app.scheduled_at), "h:mm a")}</span>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 rounded-xl transition-opacity">
                                <Pencil className="h-4 w-4" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className={cn("uppercase text-[10px] font-bold tracking-wider",
                                    app.type === 'service' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200"
                                )}>
                                    {app.type.replace('_', ' ')}
                                </Badge>
                                {app.status === 'pending' && <Badge className="bg-yellow-500 text-white hover:bg-yellow-600 animate-pulse">New Request</Badge>}
                                {app.status === 'confirmed' && <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">Confirmed</Badge>}
                                {app.status === 'converted' && <Badge className="bg-blue-500 text-white">Job Card Opened</Badge>}
                                {app.status === 'cancelled' && <Badge variant="destructive">Cancelled</Badge>}
                                {app.status === 'completed' && <Badge className="bg-green-600 text-white">Completed</Badge>}
                            </div>
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                {app.customer?.name || "Unknown Customer"}
                                <span className="text-xs font-normal text-muted-foreground px-2 py-0.5 rounded-full bg-secondary">{app.customer?.phone}</span>
                            </h3>
                            {app.customer?.company_name && (
                                <div className="flex items-center gap-2 text-sm text-primary/80 font-medium mt-1">
                                    <Building2 className="h-3 w-3" />
                                    {app.customer.company_name}
                                </div>
                            )}
                            {app.vehicle && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                    <Car className="h-4 w-4" />
                                    <span className="font-medium text-foreground">{app.vehicle.vehicle_number}</span>
                                    <span>•</span>
                                    <span>{app.vehicle.model}</span>
                                </div>
                            )}
                            {app.notes && (
                                <p className="text-sm mt-3 bg-secondary/50 p-3 rounded-lg text-muted-foreground italic border border-border/50">
                                    "{app.notes}"
                                </p>
                            )}

                            {/* Audit History Display */}
                            {app.history && app.history.length > 0 && (
                                <div className="mt-4 space-y-2 border-t pt-3 border-dashed border-border/50">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                        <History className="h-3 w-3" /> Recent Activity
                                    </h4>
                                    <div className="space-y-1.5">
                                        {app.history.slice(0, 3).map((h: any) => (
                                            <div key={h.id} className="text-xs flex items-center justify-between text-muted-foreground bg-secondary/20 py-1 px-2 rounded">
                                                <span>
                                                    <span className="font-bold text-primary capitalize">{h.action_type.replace('_', ' ')}</span>
                                                    {h.new_status && <span> to <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase leading-none">{h.new_status}</Badge></span>}
                                                </span>
                                                <span className="text-[10px] italic">
                                                    by {h.actor?.full_name || 'System'} • {format(new Date(h.changed_at), "MMM d, h:mm a")}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Services & Actions */}
                    <div className="flex flex-col items-end gap-4 min-w-[200px]">
                        {app.services && app.services.length > 0 && (
                            <div className="flex flex-wrap justify-end gap-2 max-w-[300px]">
                                {app.services.map((s: any, i: number) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                        {s.service_name}
                                    </Badge>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center gap-2 mt-auto">
                            {app.status === 'pending' && (
                                <>
                                    <Button size="sm" variant="destructive" onClick={() => onUpdateStatus(app.id, 'rejected')}>
                                        Reject
                                    </Button>
                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onUpdateStatus(app.id, 'confirmed')}>
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Approve
                                    </Button>
                                </>
                            )}
                            {app.status === 'confirmed' && (
                                <>
                                    <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600 border-red-200" onClick={() => onUpdateStatus(app.id, 'cancelled')}>
                                        Cancel
                                    </Button>
                                    <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => onCreateJobCard(app)}>
                                        Open Job Card
                                    </Button>
                                </>
                            )}
                            {app.status === 'converted' && (
                                <Button size="sm" variant="outline" disabled>
                                    Converted to Job Card
                                </Button>
                            )}

                            {(app.status === 'cancelled' || app.status === 'rejected') && (
                                <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => onUpdateStatus(app.id, 'confirmed')}>
                                    <History className="h-4 w-4 mr-2" /> Restore
                                </Button>
                            )}

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Appointment?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete the appointment record for {app.customer?.name}. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(app.id)} className="bg-destructive hover:bg-destructive/90">
                                            Delete Permanently
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
