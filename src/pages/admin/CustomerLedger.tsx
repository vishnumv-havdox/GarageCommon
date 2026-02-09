import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    ArrowLeft, Download, FileText, BarChart3, TrendingUp, AlertCircle,
    TrendingDown, Printer, Wrench, IndianRupee, ExternalLink
} from "lucide-react";
import { generateLedgerPDF } from "@/utils/pdfGenerator";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface LedgerItem {
    id: string;
    created_at: string;
    bill_number: number | null;
    status: string;
    total: number;
    total_deductions: number;
    paid_amount: number;
    balance: number;
    type?: string;
    work_order?: {
        id: string;
        service_type: string;
        vehicle?: {
            vehicle_number: string;
        }
    };
}

export default function CustomerLedger() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [exportOptions, setExportOptions] = useState({
        status: 'all', // all, paid, unpaid, finalized
        includeDeductions: true
    });
    const [customer, setCustomer] = useState<any>(null);
    const [ledgerData, setLedgerData] = useState<LedgerItem[]>([]);

    useEffect(() => {
        if (id) {
            fetchCustomerData();
        }
    }, [id]);

    const fetchCustomerData = async () => {
        setLoading(true);
        try {
            // Fetch Customer
            const { data: customerData, error: customerError } = await supabase
                .from('customers')
                .select('*')
                .eq('id', id)
                .single();

            if (customerError) throw customerError;
            setCustomer(customerData);

            // Fetch Invoices and linked Work Orders
            const { data: invoicesData, error: invoicesError } = await supabase
                .from('invoices')
                .select(`
                    *,
                    work_order:work_orders(id, service_type, vehicle:vehicles(vehicle_number))
                `)
                .eq('customer_id', id)
                .order('created_at', { ascending: false });

            if (invoicesError) throw invoicesError;

            // Fetch all payments for these invoices
            const invoiceIds = (invoicesData || []).map(inv => inv.id);
            const { data: paymentLinks, error: linksError } = await supabase
                .from('payment_links')
                .select('*, payment:payments(*)')
                .in('invoice_id', invoiceIds);

            if (linksError) throw linksError;

            // Fetch direct payments (legacy/single)
            const { data: directPayments, error: directError } = await supabase
                .from('payments')
                .select('*')
                .in('invoice_id', invoiceIds)
                .eq('status', 'approved');

            if (directError) throw directError;

            // Aggregate data for ledger
            const aggregated: LedgerItem[] = (invoicesData || []).map(inv => {
                const links = (paymentLinks as any[])?.filter(link => link.invoice_id === inv.id) || [];
                const linkedPayAmount = links
                    .filter(l => l.payment?.status?.toLowerCase() === 'approved')
                    .reduce((sum, l) => sum + (l.amount_applied || l.amount || 0), 0);

                const linkedPaymentIds = new Set(links.map(l => l.payment_id));

                const directPayAmount = (directPayments || [])
                    .filter(p => p.invoice_id === inv.id && !linkedPaymentIds.has(p.id) && p.status?.toLowerCase() === 'approved')
                    .reduce((sum, p) => sum + (p.amount || 0), 0);

                const approvedPayments = linkedPayAmount + directPayAmount;
                const balance = Math.max(0, (inv.total || 0) - approvedPayments - (inv.total_deductions || 0));

                return {
                    id: inv.id,
                    created_at: inv.created_at,
                    bill_number: inv.bill_number,
                    status: inv.status,
                    total: inv.total || 0,
                    total_deductions: inv.total_deductions || 0,
                    paid_amount: approvedPayments,
                    balance,
                    type: inv.type || 'invoice',
                    work_order: inv.work_order
                };
            });

            setLedgerData(aggregated);

        } catch (error: any) {
            console.error('Error fetching ledger:', error);
            toast({
                variant: "destructive",
                title: "Error fetching data",
                description: error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const metrics = useMemo(() => {
        const totalBilled = ledgerData.reduce((sum, item) => sum + (item.total || 0), 0);
        const totalPaid = ledgerData.reduce((sum, item) => sum + (item.paid_amount || 0), 0);
        const totalDeductions = ledgerData.reduce((sum, item) => sum + (item.total_deductions || 0), 0);
        const totalBalance = ledgerData.reduce((sum, item) => sum + item.balance, 0);

        return { totalBilled, totalPaid, totalDeductions, totalBalance };
    }, [ledgerData]);

    const handleExport = async (formatType: 'pdf' | 'csv') => {
        const { status } = exportOptions;
        let dataToExport = [...ledgerData];

        if (status !== 'all') {
            dataToExport = dataToExport.filter(item => {
                if (status === 'paid') return item.status === 'Paid';
                if (status === 'unpaid') return item.status !== 'Paid';
                if (status === 'finalized') return item.bill_number !== undefined;
                return true;
            });
        }

        if (formatType === 'pdf') {
            try {
                // Fetch Company Profile
                const { data: profileData, error: profileError } = await supabase
                    .from('company_profiles')
                    .select('*')
                    .single();

                if (profileError) throw profileError;

                await generateLedgerPDF(
                    customer,
                    dataToExport,
                    profileData as any,
                    {}
                );
            } catch (error: any) {
                console.error('PDF export failed:', error);
                toast({
                    variant: "destructive",
                    title: "Export Failed",
                    description: "Failed to generate professional PDF ledger."
                });
                return;
            }
        } else {
            const headers = ['Date', 'Bill #', 'Service', 'Total', 'Paid', 'Deductions', 'Balance', 'Status'];
            const rows = dataToExport.map(item => [
                format(new Date(item.created_at), 'yyyy-MM-dd'),
                item.bill_number || 'Draft',
                item.work_order?.service_type || 'N/A',
                item.total,
                item.paid_amount,
                item.total_deductions || 0,
                item.balance,
                item.status
            ]);

            const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', `${customer?.name || 'Customer'}_Ledger.csv`);
            link.click();
        }

        setExportDialogOpen(false);
        toast({ title: "Export Successful", description: `Ledger downloaded as ${formatType.toUpperCase()}` });
    };

    const AdvancedExportDialog = () => (
        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Download className="h-4 w-4" /> Export Ledger
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Export Options</DialogTitle>
                    <DialogDescription>
                        Filter {customer?.name}'s ledger for export.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="status" className="text-right text-xs">Filter By</Label>
                        <Select
                            value={exportOptions.status}
                            onValueChange={(v) => setExportOptions({ ...exportOptions, status: v })}
                        >
                            <SelectTrigger className="col-span-3 text-xs h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Entries</SelectItem>
                                <SelectItem value="paid">Fully Paid</SelectItem>
                                <SelectItem value="unpaid">Unpaid / Outstanding</SelectItem>
                                <SelectItem value="finalized">Finalized Bills Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>CSV</Button>
                    <Button size="sm" onClick={() => handleExport('pdf')}>PDF</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    if (loading) {
        return (
            <div className="flex bg-background min-h-screen">
                <AdminSidebar />
                <div className="flex-1 p-8 flex items-center justify-center">
                    <p className="text-muted-foreground animate-pulse">Loading Ledger...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex bg-background min-h-screen">
            <AdminSidebar />
            <main className="flex-1 p-8 space-y-6 overflow-y-auto h-screen">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Customer Ledger</h1>
                            <p className="text-muted-foreground">
                                {customer?.name} {customer?.company_name && `• ${customer.company_name}`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 no-print">
                        <Button variant="outline" onClick={() => window.print()}>
                            <Printer className="mr-2 h-4 w-4" /> Print
                        </Button>
                        <AdvancedExportDialog />
                    </div>
                </div>

                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        .no-print, 
                        aside, 
                        button,
                        .sidebar,
                        nav { 
                            display: none !important; 
                        }
                        main {
                            padding: 0 !important;
                            margin: 0 !important;
                            width: 100% !important;
                        }
                        .flex {
                            display: block !important;
                        }
                        .bg-background {
                            background-color: white !important;
                        }
                        .p-8 {
                            padding: 0 !important;
                        }
                        .space-y-6 > * + * {
                            margin-top: 1rem !important;
                        }
                        .grid {
                            display: grid !important;
                            grid-template-columns: repeat(4, 1fr) !important;
                            gap: 1rem !important;
                        }
                        .border {
                            border: 1px solid #e2e8f0 !important;
                        }
                        .rounded-lg {
                            border-radius: 0.5rem !important;
                        }
                    }
                `}} />

                {/* Summary Metrics */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card className="bg-primary/5 border-primary/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Billed</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">₹{metrics.totalBilled.toLocaleString()}</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-green-50 border-green-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-green-600">Total Paid</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-700">₹{metrics.totalPaid.toLocaleString()}</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-orange-50 border-orange-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-orange-600">Total Deductions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-700">₹{metrics.totalDeductions.toLocaleString()}</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-destructive/5 border-destructive/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-destructive">Outstanding Balance</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-destructive">₹{metrics.totalBalance.toLocaleString()}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Ledger Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Billing Detail</CardTitle>
                        <CardDescription>All work orders and invoices associated with this customer.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Bill #</TableHead>
                                    <TableHead>Work Order ID</TableHead>
                                    <TableHead>Service / Vehicle</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right text-green-600">Paid</TableHead>
                                    <TableHead className="text-right text-orange-600">Deducted</TableHead>
                                    <TableHead className="text-right font-bold">Balance</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {ledgerData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                                            No billing history found for this customer.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    ledgerData.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="text-xs truncate">
                                                {format(new Date(item.created_at), 'MMM d, yyyy')}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {item.bill_number ? `${item.type === 'quotation' ? 'QUO' : 'INV'}-${item.bill_number}` : (
                                                    <Badge variant="secondary" className="text-[10px]">Draft</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs font-mono text-muted-foreground">
                                                {item.work_order?.id?.slice(0, 8) || 'N/A'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm font-medium">{item.work_order?.service_type || 'General'}</div>
                                                <div className="text-[10px] text-muted-foreground uppercase">{item.work_order?.vehicle?.vehicle_number || 'N/A'}</div>
                                            </TableCell>
                                            <TableCell className="text-right">₹{item.total?.toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-green-600">₹{item.paid_amount?.toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-orange-600">₹{(item.total_deductions || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-bold">
                                                <span className={item.balance > 0 ? "text-destructive" : "text-muted-foreground"}>
                                                    ₹{item.balance.toLocaleString()}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={item.status === 'Paid' ? 'default' : item.status === 'Draft' ? 'outline' : 'destructive'} className="text-[10px]">
                                                    {item.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate(`/admin/invoices/${item.id}`)} title="View Invoice">
                                                        <FileText className="h-4 w-4" />
                                                    </Button>
                                                    {item.work_order?.id && (
                                                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate(`/admin/work-orders/${item.work_order.id}`)} title="View Work Order">
                                                            <Wrench className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
