
import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, startOfWeek, subMonths, isWithinInterval, parseISO, startOfYear } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { DateRange } from "react-day-picker";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    IndianRupee, TrendingUp, TrendingDown, Calendar, Download,
    FileText, Search, Filter, BarChart3
} from "lucide-react";
import { generateLedgerSummaryPDF } from "@/utils/pdfGenerator";
import type { CompanyProfile } from "@/utils/pdfGenerator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export default function AdminLedger() {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // Data State
    const [invoices, setInvoices] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);

    // Export State
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [exportOptions, setExportOptions] = useState({
        status: 'all',
        company: 'all',
        includePending: true,
        includeDeductions: true,
        type: 'customer' as 'financial' | 'customer'
    });

    // Customer Filter State
    const [customerSearch, setCustomerSearch] = useState("");
    const [customerFilter, setCustomerFilter] = useState("all");
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    // Date Range
    const [timeRange, setTimeRange] = useState("thisMonth");
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: new Date(),
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: invoicesData, error: invoicesError } = await supabase
                .from('invoices')
                .select(`
                    *,
                    customer:customers(id, name, email, phone, company_name, created_at),
                    work_order:work_orders(
                        id,
                        service_type,
                        vehicle:vehicles(vehicle_number)
                    )
                `)
                .neq('status', 'cancelled');

            if (invoicesError) throw invoicesError;

            const { data: paymentsData, error: paymentsError } = await supabase
                .from('payments')
                .select('*, payment_links(*)');

            if (paymentsError) throw paymentsError;

            setInvoices(invoicesData || []);
            setPayments(paymentsData || []);
        } catch (error: any) {
            console.error('Error fetching data:', error);
            toast({
                variant: "destructive",
                title: "Error fetching data",
                description: error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const handleRangeChange = (value: string) => {
        setTimeRange(value);
        const today = new Date();
        switch (value) {
            case 'today': setDateRange({ from: today, to: today }); break;
            case 'thisWeek': setDateRange({ from: startOfWeek(today), to: today }); break;
            case 'thisMonth': setDateRange({ from: startOfMonth(today), to: today }); break;
            case 'lastMonth': setDateRange({ from: startOfMonth(subMonths(today, 1)), to: subMonths(today, 0) }); break;
            case 'thisYear': setDateRange({ from: startOfYear(today), to: today }); break;
            default: break;
        }
    };

    const filteredData = useMemo(() => {
        if (!dateRange?.from || !dateRange?.to) return { invoices: [], payments: [] };

        const filteredInvoices = invoices.filter(inv => {
            const date = new Date(inv.created_at);
            return isWithinInterval(date, { start: dateRange.from!, end: dateRange.to! });
        });

        const filteredPayments = payments.filter(p => {
            const date = new Date(p.payment_date);
            return isWithinInterval(date, { start: dateRange.from!, end: dateRange.to! });
        });

        return { invoices: filteredInvoices, payments: filteredPayments };
    }, [invoices, payments, dateRange]);

    // Process Customer Data
    const customerData = useMemo(() => {
        const customers: Record<string, any> = {};

        // Process invoices
        filteredData.invoices.forEach((inv: any) => {
            if (!inv.customer) return;
            const custId = inv.customer.id;

            if (!customers[custId]) {
                customers[custId] = {
                    id: custId,
                    name: inv.customer.name,
                    company: inv.customer.company_name || 'Individual',
                    email: inv.customer.email,
                    phone: inv.customer.phone,
                    created_at: inv.customer.created_at,
                    serviceCount: 0,
                    totalInvoiced: 0,
                    totalReceived: 0,
                    totalDeductions: 0,
                    pendingAmount: 0,
                    lastPaymentDate: null,
                    vehicles: new Set(),
                    workOrders: []
                };
            }

            customers[custId].serviceCount += 1;
            customers[custId].totalInvoiced += (inv.total || 0);
            customers[custId].totalDeductions += (inv.total_deductions || 0);

            // Calculate payments for this invoice
            const invPayments = payments.filter((p: any) => {
                // Direct link
                if (p.invoice_id === inv.id) return true;
                // Array link
                if (p.payment_links && Array.isArray(p.payment_links)) {
                    return p.payment_links.some((link: any) => link.invoice_id === inv.id);
                }
                return false;
            });

            // Calculate exact paid amount for this invoice from link data if available
            let paidForInvoice = 0;
            invPayments.forEach((p: any) => {
                if (p.payment_links && Array.isArray(p.payment_links)) {
                    const link = p.payment_links.find((l: any) => l.invoice_id === inv.id);
                    if (link) paidForInvoice += (link.amount_applied || link.amount || 0);
                } else {
                    paidForInvoice += (p.amount || 0); // Legacy direct link fallback
                }
            });

            // If no specific payment link data, use invoice paid_amount if reliable, otherwise fallback
            // Better to trust calculated payments from the ledger logic we fixed earlier?
            // Actually, let's stick to the aggregated logic:
            // Total Invoiced - (Total Paid + Total Deductions) = Pending.
            // We accumulate total received for customer.

            // FIX: We shouldn't double count payments if we iterate by invoices.
            // But we are iterating invoices.
            // Payments might cover multiple invoices.
        });

        // Re-calculate totals based on Customer scope to avoid double counting payments
        // We need to iterate all payments in range and attribute to customers
        // And iterate all invoices in range and attribute to customers

        // Reset totals first
        Object.values(customers).forEach((c: any) => {
            c.totalInvoiced = 0;
            c.totalReceived = 0;
            c.totalDeductions = 0;
        });

        filteredData.invoices.forEach((inv: any) => {
            if (!customers[inv.customer?.id]) return;
            customers[inv.customer.id].totalInvoiced += (inv.total || 0);
            customers[inv.customer.id].totalDeductions += (inv.total_deductions || 0);
            if (inv.work_order?.vehicle?.vehicle_number) {
                customers[inv.customer.id].vehicles.add(inv.work_order.vehicle.vehicle_number);
            }
            customers[inv.customer.id].workOrders.push(inv);
        });

        filteredData.payments.forEach((p: any) => {
            // We need to find the customer. Payments usually have customer_id or access via invoice
            // Let's rely on payment's customer linkage if possible, or invoice.
            // The raw payment row might not have customer_id joined.
            // We fetched payments as select * which usually doesn't include joined customer.
            // But invoices have customer.

            // Let's try to find linked invoice's customer.
            let custId = null;
            if (p.invoice_id) {
                const inv = invoices.find(i => i.id === p.invoice_id);
                if (inv) custId = inv.customer_id;
            }
            if (!custId && p.payment_links && p.payment_links.length > 0) {
                // Check first link
                const invId = p.payment_links[0].invoice_id;
                const inv = invoices.find(i => i.id === invId);
                if (inv) custId = inv.customer_id;
            }

            if (custId && customers[custId]) {
                // Only count approved payments (case-insensitive)
                if (p.status?.toLowerCase() === 'approved') {
                    // Check if it's a multi-bill payment with links
                    if (p.payment_links && p.payment_links.length > 0) {
                        // Sum the applied amounts for this customer
                        // Actually, payments are customer-specific mostly, but let's be safe.
                        const customerApplied = p.payment_links.reduce((sum: number, link: any) => sum + (link.amount_applied || link.amount || 0), 0);
                        customers[custId].totalReceived += customerApplied;
                    } else {
                        // Legacy/direct payment
                        customers[custId].totalReceived += (p.amount || 0);
                    }
                }

                const pDate = new Date(p.payment_date);
                if (!customers[custId].lastPaymentDate || pDate > customers[custId].lastPaymentDate) {
                    customers[custId].lastPaymentDate = pDate;
                }
            }
        });

        // Calculate pending
        Object.values(customers).forEach((c: any) => {
            c.pendingAmount = Math.max(0, c.totalInvoiced - c.totalReceived - c.totalDeductions);
        });

        return Object.values(customers);
    }, [filteredData, invoices, payments]);

    const sortedCustomers = useMemo(() => {
        let data = [...customerData];

        // Search
        if (customerSearch) {
            const lower = customerSearch.toLowerCase();
            data = data.filter(c =>
                c.name.toLowerCase().includes(lower) ||
                c.company.toLowerCase().includes(lower) ||
                c.email?.toLowerCase().includes(lower)
            );
        }

        // Filter
        if (customerFilter !== 'all') {
            const thirtyDaysAgo = subDays(new Date(), 30);
            if (customerFilter === 'unpaid') data = data.filter(c => c.pendingAmount > 0);
            else if (customerFilter === 'paid') data = data.filter(c => c.pendingAmount <= 0);
            else if (customerFilter === 'new') data = data.filter(c => new Date(c.created_at) > thirtyDaysAgo);
            else if (customerFilter === 'old') data = data.filter(c => new Date(c.created_at) <= thirtyDaysAgo);
        }

        // Sort
        if (sortConfig) {
            data.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
                if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            // Default sort by pending amount desc
            data.sort((a, b) => b.pendingAmount - a.pendingAmount);
        }

        return data;
    }, [customerData, customerSearch, customerFilter, sortConfig]);


    const uniqueCompanies = useMemo(() => {
        const companies = new Set(invoices.map(i => i.customer?.company_name).filter(Boolean));
        return Array.from(companies).sort();
    }, [invoices]);

    // Transactions Data State
    const transactions = useMemo(() => {
        const all: any[] = [];

        invoices.forEach(inv => {
            // Find all payments linked to this invoice
            const invPayments = (payments || []).filter(p => {
                // Direct link
                if (p.invoice_id === inv.id) return true;
                // Payment link check
                if (p.payment_links && Array.isArray(p.payment_links)) {
                    return p.payment_links.some((l: any) => l.invoice_id === inv.id);
                }
                return false;
            });

            const paidAmount = invPayments.reduce((sum, p) => {
                if (p.status?.toLowerCase() !== 'approved') return sum;

                // If linked via payment_links, use amount_applied
                if (p.payment_links && Array.isArray(p.payment_links)) {
                    const link = p.payment_links.find((l: any) => l.invoice_id === inv.id);
                    if (link) return sum + (link.amount_applied || link.amount || 0); // fallback to amount if applied is missing (legacy)
                }

                // Direct link fallback
                return sum + (p.amount || 0);
            }, 0);

            // Determine Payment Mode(s)
            const methods = new Set(invPayments.map(p => p.payment_method).filter(Boolean));
            const paymentMode = methods.size > 0 ? Array.from(methods).join(', ') : '-';

            // Determine Approval Status
            const hasPendingPayment = invPayments.some(p => p.status?.toLowerCase() === 'pending');
            const approvalStatus = hasPendingPayment ? 'Pending Approval' : (inv.status === 'Paid' ? 'Approved' : inv.status);

            all.push({
                id: inv.id,
                date: inv.created_at,
                type: 'Invoice',
                ref: `${inv.type === 'quotation' ? 'QUO' : 'INV'}-${inv.bill_number}`,
                customer: inv.customer?.name || 'Unknown',
                customerId: inv.customer?.id,
                company: inv.customer?.company_name,
                vehicle: inv.work_order?.vehicle?.vehicle_number || '-',
                service: inv.work_order?.service_type,
                amount: inv.total || 0,
                paid: paidAmount,
                deductions: inv.total_deductions || 0,
                balance: (inv.total || 0) - paidAmount - (inv.total_deductions || 0),
                status: approvalStatus,
                originalStatus: inv.status,
                paymentMode: paymentMode
            });
        });

        // Standalone payments loop removed

        return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [invoices, payments]);

    const handleExport = async (formatType: 'pdf' | 'csv') => {
        const { status, company } = exportOptions;

        let dataToExport = sortedCustomers;

        // Apply filters
        if (status !== 'all') {
            dataToExport = dataToExport.filter((item: any) => {
                if (status === 'paid') return item.pendingAmount === 0;
                if (status === 'unpaid') return item.pendingAmount > 0;
                return true;
            });
        }

        if (company !== 'all') {
            dataToExport = dataToExport.filter((item: any) => item.company === company);
        }

        if (formatType === 'pdf') {
            try {
                // Fetch Company Profile
                const { data: profileData, error: profileError } = await supabase
                    .from('company_profiles')
                    .select('*')
                    .maybeSingle();

                if (profileError) throw profileError;

                let transactionsToExport = transactions;
                if (status !== 'all') {
                    transactionsToExport = transactionsToExport.filter(t => {
                        const s = t.status?.toLowerCase();
                        if (status === 'paid') return s === 'paid' || s === 'approved';
                        if (status === 'unpaid') return s !== 'paid' && s !== 'approved';
                        return true;
                    });
                }
                if (company !== 'all') {
                    transactionsToExport = transactionsToExport.filter(t => t.company === company);
                }

                await generateLedgerSummaryPDF(
                    dataToExport,
                    profileData as CompanyProfile,
                    {
                        dateRange,
                        status,
                        companyType: company
                    },
                    transactionsToExport
                );
            } catch (error: any) {
                console.error('PDF export failed:', error);
                toast({
                    variant: "destructive",
                    title: "Export Failed",
                    description: "Failed to generate professional ledger report."
                });
            }
        } else {
            const headers = ['Customer', 'Company', 'Services', 'Total', 'Paid', 'Deductions', 'Pending'];
            const rows = dataToExport.map((item: any) => [
                item.name, item.company, item.serviceCount, item.totalInvoiced, item.totalReceived, item.totalDeductions, item.pendingAmount
            ]);

            const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', `ledger_export.csv`);
            link.click();
        }

        setExportDialogOpen(false);
        toast({ title: "Export Successful", description: `Report downloaded as ${formatType.toUpperCase()}` });
    };

    // Import subDays helpers for filters
    function subDays(date: Date, amount: number) {
        const d = new Date(date);
        d.setDate(d.getDate() - amount);
        return d;
    }

    return (
        <div className="flex bg-background min-h-screen">
            <AdminSidebar />
            <div className="flex-1 p-8 space-y-6 overflow-y-auto h-screen">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Customer Ledger</h1>
                        <p className="text-muted-foreground">Monitor and manage customer account balances.</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Select value={timeRange} onValueChange={handleRangeChange}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select Range" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="today">Today</SelectItem>
                                <SelectItem value="thisWeek">This Week</SelectItem>
                                <SelectItem value="thisMonth">This Month</SelectItem>
                                <SelectItem value="lastMonth">Last Month</SelectItem>
                                <SelectItem value="thisYear">This Year</SelectItem>
                                <SelectItem value="custom">Custom Range</SelectItem>
                            </SelectContent>
                        </Select>

                        {timeRange === 'custom' && (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                                        <Calendar className="mr-2 h-4 w-4" />
                                        {dateRange?.from ? (
                                            dateRange.to ? (
                                                <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>
                                            ) : format(dateRange.from, "LLL dd, y")
                                        ) : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                    <CalendarComponent
                                        initialFocus
                                        mode="range"
                                        defaultMonth={dateRange?.from}
                                        selected={dateRange}
                                        onSelect={setDateRange}
                                        numberOfMonths={2}
                                    />
                                </PopoverContent>
                            </Popover>
                        )}

                        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <Download className="h-4 w-4" /> Export Report
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Export Options</DialogTitle>
                                    <DialogDescription>
                                        Select the criteria for your generated report.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="status" className="text-right text-xs">Status</Label>
                                        <Select
                                            value={exportOptions.status}
                                            onValueChange={(v) => setExportOptions({ ...exportOptions, status: v })}
                                        >
                                            <SelectTrigger className="col-span-3 text-xs h-8">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All</SelectItem>
                                                <SelectItem value="paid">Paid / Settled</SelectItem>
                                                <SelectItem value="unpaid">Unpaid / Pending</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="company" className="text-right text-xs">Company</Label>
                                        <Select
                                            value={exportOptions.company}
                                            onValueChange={(v) => setExportOptions({ ...exportOptions, company: v })}
                                        >
                                            <SelectTrigger className="col-span-3 text-xs h-8">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Companies</SelectItem>
                                                {uniqueCompanies.map(c => (
                                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                                ))}
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
                    </div>
                </div>

                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Transaction History</CardTitle>
                            <CardDescription>Master list of all invoices with payment status</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Vehicle</TableHead>
                                        <TableHead>Ref #</TableHead>
                                        <TableHead className="text-right">Billed</TableHead>
                                        <TableHead className="text-right text-green-600">Paid</TableHead>
                                        <TableHead className="text-right text-orange-600">Deductions</TableHead>
                                        <TableHead className="text-right font-bold">Balance</TableHead>
                                        <TableHead>Mode</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.map((item) => (
                                        <TableRow
                                            key={`${item.id}`}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => item.customerId && navigate(`/admin/customers/${item.customerId}/ledger`)}
                                        >
                                            <TableCell className="text-xs">
                                                {item.date ? format(new Date(item.date), 'MMM d, yyyy') : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm">{item.customer}</span>
                                                    <span className="text-[10px] text-muted-foreground">{item.company}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px] font-mono">
                                                    {item.vehicle}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{item.ref}</TableCell>
                                            <TableCell className="text-right text-xs">
                                                {item.amount > 0 ? `₹${item.amount.toLocaleString()}` : '-'}
                                            </TableCell>
                                            <TableCell className="text-right text-xs text-green-600">
                                                {item.paid > 0 ? `₹${item.paid.toLocaleString()}` : '-'}
                                            </TableCell>
                                            <TableCell className="text-right text-xs text-orange-600">
                                                {item.deductions > 0 ? `₹${item.deductions.toLocaleString()}` : '-'}
                                            </TableCell>
                                            <TableCell className="text-right text-xs font-bold">
                                                {item.balance > 0 ? `₹${item.balance.toLocaleString()}` : '₹0'}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {item.paymentMode !== '-' && (
                                                    <Badge variant="secondary" className="text-[9px]">
                                                        {item.paymentMode}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline" className={cn(
                                                    "text-[10px]",
                                                    item.status === 'Paid' && "border-green-500 text-green-600",
                                                    item.status === 'Approved' && "border-green-500 text-green-600",
                                                    item.status === 'Pending Approval' && "border-red-500 text-red-600",
                                                    item.status === 'pending' && "border-orange-500 text-orange-600"
                                                )}>
                                                    {item.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {transactions.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                                No transactions found
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
