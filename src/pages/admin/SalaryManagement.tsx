import { useState, useEffect } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
    Banknote,
    Settings2,
    History,
    Wallet,
    Plus,
    ArrowUpRight,
    Filter,
    Download,
    CheckCircle2,
    Clock,
    User as UserIcon,
    Search,
    ChevronRight,
    Printer,
    Coins,
    Trash2,
    RefreshCw,
    RotateCcw
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { SalaryConfigForm } from "@/components/employees/SalaryConfigForm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SalaryManagementPage() {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("payouts");
    const [employees, setEmployees] = useState<any[]>([]);
    const [configs, setConfigs] = useState<Record<string, any>>({});
    const [payouts, setPayouts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
    const [selectedEmp, setSelectedEmp] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [isPayoutDialogOpen, setIsPayoutDialogOpen] = useState(false);
    const [payoutPeriod, setPayoutPeriod] = useState({
        start: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [selectedPayout, setSelectedPayout] = useState<any>(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [isEditingPayout, setIsEditingPayout] = useState(false);
    const [editPayoutData, setEditPayoutData] = useState<any>(null);
    const [adjustments, setAdjustments] = useState<any[]>([]);

    // Confirmation states
    const [confirmAction, setConfirmAction] = useState<{
        type: 'delete_payout' | 'delete_adjustment' | 'mark_paid' | 'generate_payouts' | null;
        id?: string;
        data?: any;
    }>({ type: null });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch employees
            const { data: empData } = await supabase
                .from("employees")
                .select("id, name, position:positions(name)")
                .eq("status", "active")
                .order("name");
            setEmployees(empData || []);

            // 2. Fetch salary configs
            const { data: configData } = await (supabase
                .from("employee_salary_configs")
                .select("*") as any);

            const configMap: Record<string, any> = {};
            (configData as any[])?.forEach(c => {
                configMap[c.employee_id] = c;
            });
            setConfigs(configMap);

            // 3. Fetch recent payouts
            const { data: payoutData } = await (supabase
                .from("employee_payouts")
                .select("*, employees(name)")
                .order("period_end", { ascending: false }) as any);
            setPayouts(payoutData || []);

            // 4. Fetch recent adjustments
            const { data: adjData } = await supabase
                .from("payout_adjustments")
                .select("*, employees(name)")
                .order("created_at", { ascending: false })
                .limit(50);
            setAdjustments(adjData || []);

        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handlePayoutGeneration = async () => {
        setIsGenerating(true);
        try {
            const { data: count, error } = await (supabase as any).rpc('calculate_employee_payouts', {
                _period_start: payoutPeriod.start,
                _period_end: payoutPeriod.end,
                _admin_id: (await supabase.auth.getUser()).data.user?.id
            });

            if (error) throw error;

            if (count === 0) {
                toast({
                    variant: "destructive",
                    title: "No Payouts Generated",
                    description: "No active salary configurations found."
                });
            } else {
                toast({ title: "Success", description: `${count} payouts generated/updated.` });
                setIsPayoutDialogOpen(false);
                fetchData();
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSyncDrafts = async () => {
        // Automatically sync for current month
        const start = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
        const end = format(new Date(), 'yyyy-MM-dd');

        setIsGenerating(true);
        try {
            const { data: count, error } = await (supabase as any).rpc('calculate_employee_payouts', {
                _period_start: start,
                _period_end: end,
                _admin_id: (await supabase.auth.getUser()).data.user?.id
            });
            if (error) throw error;
            toast({ title: "Sync Complete", description: `Updated ${count} draft payouts with latest salary settings.` });
            fetchData();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Sync Error", description: error.message });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        setIsUpdatingStatus(true);
        try {
            const { error } = await supabase
                .from("employee_payouts")
                .update({
                    status: newStatus,
                    payment_date: newStatus === 'paid' ? new Date().toISOString() : null
                })
                .eq("id", id);

            if (error) throw error;
            toast({ title: "Success", description: `Payout marked as ${newStatus}` });
            setIsDetailDialogOpen(false);
            fetchData();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleSavePayoutEdit = async () => {
        if (!selectedPayout) return;
        setIsUpdatingStatus(true);
        try {
            const total = (parseFloat(editPayoutData.base_calc) || 0) +
                (parseFloat(editPayoutData.attendance_adj) || 0) +
                (parseFloat(editPayoutData.job_incentives) || 0) +
                (parseFloat(editPayoutData.overtime_pay) || 0) +
                (parseFloat(editPayoutData.arrears_adj) || 0);

            const { error } = await supabase
                .from("employee_payouts")
                .update({
                    base_calc: parseFloat(editPayoutData.base_calc) || 0,
                    attendance_adj: parseFloat(editPayoutData.attendance_adj) || 0,
                    job_incentives: parseFloat(editPayoutData.job_incentives) || 0,
                    overtime_pay: parseFloat(editPayoutData.overtime_pay) || 0,
                    arrears_adj: parseFloat(editPayoutData.arrears_adj) || 0,
                    total_amount: total,
                    notes: editPayoutData.notes
                })
                .eq("id", selectedPayout.id);

            if (error) throw error;
            toast({ title: "Success", description: "Payout updated manually" });
            setIsEditingPayout(false);
            fetchData();
            // Update selected payout to reflect changes in UI
            setSelectedPayout({ ...selectedPayout, ...editPayoutData, total_amount: total });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleDeletePayout = async (id: string) => {
        try {
            const { error } = await supabase
                .from("employee_payouts")
                .delete()
                .eq("id", id);

            if (error) throw error;
            toast({ title: "Success", description: "Payout record deleted" });
            fetchData();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    const handleDeleteAdjustment = async (id: string) => {
        try {
            const { error } = await supabase
                .from("payout_adjustments")
                .delete()
                .eq("id", id);

            if (error) throw error;
            toast({ title: "Success", description: "Adjustment record deleted" });
            fetchData();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    const stats = {
        pending: payouts.filter(p => p.status === 'draft').reduce((acc, p) => acc + p.total_amount, 0),
        paid: payouts.filter(p => p.status === 'paid').reduce((acc, p) => acc + p.total_amount, 0),
        configCount: Object.keys(configs).length,
    };

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex min-h-screen w-full bg-muted/40">
            <AdminSidebar />
            <main className="flex-1 p-4 md:p-8 pt-6">
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Salary & Payout Management</h1>
                            <p className="text-muted-foreground">Configure salary structures and manage employee payouts.</p>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={fetchData} title="Refresh Data">
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                            <Button variant="outline" onClick={handleSyncDrafts} disabled={isGenerating}>
                                <RotateCcw className={`mr-2 h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} /> Sync All Drafts
                            </Button>
                            <Button onClick={() => setIsPayoutDialogOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" /> New Payout Period
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Pending Payouts</p>
                                        <h2 className="text-2xl font-bold text-amber-600">₹{stats.pending.toLocaleString()}</h2>
                                    </div>
                                    <Clock className="h-8 w-8 text-amber-500 opacity-50" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Total Paid</p>
                                        <h2 className="text-2xl font-bold text-emerald-600">₹{stats.paid.toLocaleString()}</h2>
                                    </div>
                                    <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-50" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Active Salary Configs</p>
                                        <h2 className="text-2xl font-bold text-blue-600">{stats.configCount}</h2>
                                    </div>
                                    <Settings2 className="h-8 w-8 text-blue-500 opacity-50" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="payouts">Payout History</TabsTrigger>
                            <TabsTrigger value="adjustments">Adjustment Log</TabsTrigger>
                            <TabsTrigger value="configs">Salary structures</TabsTrigger>
                        </TabsList>

                        <TabsContent value="payouts" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Recent Payouts</CardTitle>
                                    <CardDescription>History of all processed and draft payouts.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {payouts.length === 0 ? (
                                        <div className="text-center py-20 text-muted-foreground border rounded-lg border-dashed">
                                            <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                            <p>No payout history found. Start by generating a new payout period.</p>
                                        </div>
                                    ) : (
                                        <div className="rounded-md border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Employee</TableHead>
                                                        <TableHead>Period</TableHead>
                                                        <TableHead>Total Amount</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {payouts.map((p) => (
                                                        <TableRow key={p.id}>
                                                            <TableCell className="font-medium">{p.employees?.name}</TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">
                                                                {p.period_start} to {p.period_end}
                                                            </TableCell>
                                                            <TableCell className="font-bold">₹{p.total_amount.toLocaleString()}</TableCell>
                                                            <TableCell>
                                                                <Badge variant={p.status === 'paid' ? 'default' : 'secondary'}>
                                                                    {p.status}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex justify-end gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            setSelectedPayout(p);
                                                                            setIsDetailDialogOpen(true);
                                                                            setIsEditingPayout(false);
                                                                        }}
                                                                    >
                                                                        Details
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                        onClick={() => setConfirmAction({ type: 'delete_payout', id: p.id })}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="adjustments" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Attendance Adjustment History</CardTitle>
                                    <CardDescription>History of all arrears and corrections captured from paid periods.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {adjustments.length === 0 ? (
                                        <div className="text-center py-20 text-muted-foreground border rounded-lg border-dashed">
                                            <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                            <p>No adjustment history found.</p>
                                        </div>
                                    ) : (
                                        <div className="rounded-md border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Employee</TableHead>
                                                        <TableHead>Description</TableHead>
                                                        <TableHead>Amount</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead>Date</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {adjustments.map((a) => (
                                                        <TableRow key={a.id}>
                                                            <TableCell className="font-medium">{a.employees?.name}</TableCell>
                                                            <TableCell className="text-xs">{a.description}</TableCell>
                                                            <TableCell className={`font-bold ${a.amount < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                                                                {a.amount > 0 ? '+' : ''}₹{a.amount.toLocaleString()}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant={a.is_processed ? 'default' : 'outline'}>
                                                                    {a.is_processed ? 'Processed' : 'Pending'}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                                {format(new Date(a.created_at), 'dd MMM yyyy HH:mm')}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                    onClick={() => setConfirmAction({ type: 'delete_adjustment', id: a.id })}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="configs" className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search employees for configuration..."
                                        className="pl-9"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Employee Pay Structures</CardTitle>
                                    <CardDescription>Configure how each employee is compensated.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {filteredEmployees.map((emp) => {
                                            const config = configs[emp.id];
                                            return (
                                                <Card key={emp.id} className="bg-card shadow-sm hover:border-primary/50 transition-colors group">
                                                    <CardContent className="p-4 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-muted rounded-full">
                                                                <UserIcon className="h-5 w-5 text-muted-foreground" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-sm leading-tight">{emp.name}</h4>
                                                                <p className="text-xs text-muted-foreground">{emp.position?.name || "No position"}</p>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => {
                                                                setSelectedEmp(emp);
                                                                setIsConfigDialogOpen(true);
                                                            }}
                                                        >
                                                            <Settings2 className="h-4 w-4" />
                                                        </Button>
                                                    </CardContent>
                                                    {config ? (
                                                        <div className="px-4 pb-4 border-t pt-3 grid grid-cols-2 gap-y-2">
                                                            <div className="text-[10px] uppercase font-medium text-muted-foreground">Type</div>
                                                            <div className="text-[10px] font-bold text-right uppercase text-primary">{config.pay_type}</div>
                                                            <div className="text-[10px] uppercase font-medium text-muted-foreground">Base</div>
                                                            <div className="text-[10px] font-bold text-right">₹{config.base_amount.toLocaleString()}</div>
                                                            <div className="text-[10px] uppercase font-medium text-muted-foreground">OT Rate</div>
                                                            <div className="text-[10px] font-bold text-right">₹{config.overtime_rate}/hr</div>
                                                        </div>
                                                    ) : (
                                                        <div className="px-4 pb-4 border-t pt-3 flex items-center justify-center">
                                                            <Button
                                                                variant="link"
                                                                className="text-[10px] h-auto p-0"
                                                                onClick={() => {
                                                                    setSelectedEmp(emp);
                                                                    setIsConfigDialogOpen(true);
                                                                }}
                                                            >
                                                                Set Pay Structure
                                                            </Button>
                                                        </div>
                                                    )}
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div >
            </main >

            <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Salary Configuration</DialogTitle>
                    </DialogHeader>
                    <SalaryConfigForm
                        employeeId={selectedEmp?.id}
                        employeeName={selectedEmp?.name}
                        initialData={configs[selectedEmp?.id]}
                        onSuccess={() => {
                            setIsConfigDialogOpen(false);
                            fetchData();
                            // Automatically sync drafts to reflect new salary structure
                            handleSyncDrafts();
                        }}
                    />
                </DialogContent>
            </Dialog>
            <Dialog open={isPayoutDialogOpen} onOpenChange={setIsPayoutDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Generate Payout Period</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <Input
                                    type="date"
                                    value={payoutPeriod.start}
                                    onChange={(e) => setPayoutPeriod(prev => ({ ...prev, start: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <Input
                                    type="date"
                                    value={payoutPeriod.end}
                                    onChange={(e) => setPayoutPeriod(prev => ({ ...prev, end: e.target.value }))}
                                />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            This will automatically calculate base pay, attendance adjustments, overtime, and performance incentives for all active employees for the selected period.
                        </p>
                        <Button className="w-full" onClick={() => {
                            setIsPayoutDialogOpen(false);
                            setConfirmAction({ type: 'generate_payouts' });
                        }} disabled={isGenerating}>
                            {isGenerating ? "Processing..." : "Generate Draft Payouts"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <DialogTitle>Payout Breakdown</DialogTitle>
                                <DialogDescription>
                                    Detailed calculation for {selectedPayout?.employees?.name}
                                </DialogDescription>
                            </div>
                            {selectedPayout?.status === 'draft' && !isEditingPayout && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedPayout(p);
                                        setIsEditingPayout(true);
                                        setEditPayoutData({ ...selectedPayout });
                                    }}
                                >
                                    Edit Fields
                                </Button>
                            )}
                        </div>
                    </DialogHeader>
                    {selectedPayout && (
                        <div className="space-y-6 py-4">
                            <div className="grid grid-cols-3 gap-2">
                                <Card className="bg-muted/50 border-none">
                                    <div className="p-2">
                                        <p className="text-[9px] uppercase font-bold text-muted-foreground mb-1">Period Start</p>
                                        <p className="text-xs font-medium">{selectedPayout.period_start}</p>
                                    </div>
                                </Card>
                                <Card className="bg-muted/50 border-none">
                                    <div className="p-2">
                                        <p className="text-[9px] uppercase font-bold text-muted-foreground mb-1">Period End</p>
                                        <p className="text-xs font-medium">{selectedPayout.period_end}</p>
                                    </div>
                                </Card>
                                <Card className="bg-primary/10 border-none">
                                    <div className="p-2">
                                        <p className="text-[9px] uppercase font-bold text-primary mb-1">Days Present</p>
                                        <p className="text-xs font-bold text-primary">{selectedPayout.days_present || 0} Days</p>
                                    </div>
                                </Card>
                            </div>

                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Base Earnings</span>
                                        {isEditingPayout ? (
                                            <Input
                                                type="number"
                                                className="h-8 w-24 text-right"
                                                value={editPayoutData.base_calc}
                                                onChange={(e) => setEditPayoutData({ ...editPayoutData, base_calc: e.target.value })}
                                            />
                                        ) : (
                                            <span className="font-medium">₹{selectedPayout.base_calc?.toLocaleString()}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Attendance Adjustment</span>
                                        {isEditingPayout ? (
                                            <Input
                                                type="number"
                                                className="h-8 w-24 text-right text-destructive"
                                                value={editPayoutData.attendance_adj}
                                                onChange={(e) => setEditPayoutData({ ...editPayoutData, attendance_adj: e.target.value })}
                                            />
                                        ) : (
                                            <span className={`font-medium ${selectedPayout.attendance_adj < 0 ? 'text-destructive' : ''}`}>
                                                {selectedPayout.attendance_adj < 0 ? '-' : ''}₹{Math.abs(selectedPayout.attendance_adj)?.toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Job Incentives</span>
                                        {isEditingPayout ? (
                                            <Input
                                                type="number"
                                                className="h-8 w-24 text-right"
                                                value={editPayoutData.job_incentives}
                                                onChange={(e) => setEditPayoutData({ ...editPayoutData, job_incentives: e.target.value })}
                                            />
                                        ) : (
                                            <span className="font-medium">₹{selectedPayout.job_incentives?.toLocaleString()}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Overtime Pay</span>
                                        {isEditingPayout ? (
                                            <Input
                                                type="number"
                                                className="h-8 w-24 text-right"
                                                value={editPayoutData.overtime_pay}
                                                onChange={(e) => setEditPayoutData({ ...editPayoutData, overtime_pay: e.target.value })}
                                            />
                                        ) : (
                                            <span className="font-medium">₹{selectedPayout.overtime_pay?.toLocaleString()}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Arrears / Adjustments</span>
                                        {isEditingPayout ? (
                                            <Input
                                                type="number"
                                                className="h-8 w-24 text-right"
                                                value={editPayoutData.arrears_adj}
                                                onChange={(e) => setEditPayoutData({ ...editPayoutData, arrears_adj: e.target.value })}
                                            />
                                        ) : (
                                            <span className={`font-medium ${selectedPayout.arrears_adj < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                                                {selectedPayout.arrears_adj > 0 ? '+' : ''}₹{selectedPayout.arrears_adj?.toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-between text-sm py-4 border-t-2">
                                    <span className="font-bold">Total Payout</span>
                                    <span className="font-bold text-primary text-lg">₹{selectedPayout.total_amount?.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Notes</p>
                                {isEditingPayout ? (
                                    <Input
                                        className="text-xs"
                                        value={editPayoutData.notes}
                                        onChange={(e) => setEditPayoutData({ ...editPayoutData, notes: e.target.value })}
                                    />
                                ) : selectedPayout.notes && (
                                    <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100/50">
                                        <p className="text-xs text-blue-700">{selectedPayout.notes}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2">
                        {isEditingPayout ? (
                            <>
                                <Button variant="outline" className="flex-1" onClick={() => setIsEditingPayout(false)}>Cancel</Button>
                                <Button className="flex-1" onClick={handleSavePayoutEdit} disabled={isUpdatingStatus}>Save Changes</Button>
                            </>
                        ) : (
                            <>
                                {selectedPayout?.status === 'draft' && (
                                    <Button
                                        className="w-full flex-1"
                                        onClick={() => setConfirmAction({ type: 'mark_paid', id: selectedPayout.id })}
                                        disabled={isUpdatingStatus}
                                    >
                                        <Coins className="mr-2 h-4 w-4" />
                                        {isUpdatingStatus ? "Processing..." : "Mark as Paid"}
                                    </Button>
                                )}
                                <Button variant="outline" className="w-full flex-1" onClick={() => window.print()}>
                                    <Printer className="mr-2 h-4 w-4" /> Print
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!confirmAction.type} onOpenChange={(open) => !open && setConfirmAction({ type: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirmAction.type === 'delete_payout' && "Delete Payout Record?"}
                            {confirmAction.type === 'delete_adjustment' && "Delete Adjustment Record?"}
                            {confirmAction.type === 'mark_paid' && "Mark as Paid?"}
                            {confirmAction.type === 'generate_payouts' && "Generate Draft Payouts?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmAction.type === 'delete_payout' && "This action cannot be undone. This will permanently delete the payout record from the database."}
                            {confirmAction.type === 'delete_adjustment' && "This action cannot be undone. This will permanently delete this attendance adjustment."}
                            {confirmAction.type === 'mark_paid' && "Are you sure you want to mark this payout as paid? This will record the payment date as today."}
                            {confirmAction.type === 'generate_payouts' && `This will generate draft payouts for the period ${payoutPeriod.start} to ${payoutPeriod.end}. Existing drafts for this period will be updated.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className={confirmAction.type?.startsWith('delete') ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
                            onClick={() => {
                                if (confirmAction.type === 'delete_payout' && confirmAction.id) {
                                    handleDeletePayout(confirmAction.id);
                                } else if (confirmAction.type === 'delete_adjustment' && confirmAction.id) {
                                    handleDeleteAdjustment(confirmAction.id);
                                } else if (confirmAction.type === 'mark_paid' && confirmAction.id) {
                                    handleStatusUpdate(confirmAction.id, 'paid');
                                } else if (confirmAction.type === 'generate_payouts') {
                                    handlePayoutGeneration();
                                }
                                setConfirmAction({ type: null });
                            }}
                        >
                            {confirmAction.type?.startsWith('delete') ? "Delete" : "Confirm"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
