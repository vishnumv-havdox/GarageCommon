import { useState, useEffect, useMemo } from "react";
import { format, subDays, startOfMonth, startOfWeek, isSameDay, isSameMonth, subMonths, isWithinInterval, parseISO, startOfYear } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { DateRange } from "react-day-picker";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import {
    IndianRupee, TrendingUp, TrendingDown, Calendar, Download,
    FileText, CreditCard, Users, AlertCircle, ArrowUpRight, ArrowDownRight, Search, Filter, BarChart3
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { CustomerAnalyticsModal } from "@/components/analytics/CustomerAnalyticsModal";

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function InvoiceAnalytics() {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // Data State
    const [invoices, setInvoices] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);

    // Customer Tab State
    const [customerSearch, setCustomerSearch] = useState("");
    const [customerFilter, setCustomerFilter] = useState("all");
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [selectedCustomerForAnalytics, setSelectedCustomerForAnalytics] = useState<any>(null);

    // Filter State
    const [documentTypeFilter, setDocumentTypeFilter] = useState("invoice"); // 'invoice' | 'quotation' | 'all'
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
                .select('*, customer:customers(id, name, email, phone, company_name, created_at), work_order:work_orders(service_type)');

            if (invoicesError) throw invoicesError;

            const { data: paymentsData, error: paymentsError } = await supabase
                .from('payments')
                .select('*');

            if (paymentsError) throw paymentsError;

            setInvoices(invoicesData || []);
            setPayments(paymentsData || []);
        } catch (error: any) {
            console.error('Error fetching analytics data:', error);
            toast({
                variant: "destructive",
                title: "Error fetching data",
                description: error.message
            });
        } finally {
            setLoading(false);
        }
    };

    // --- Filtering Logic ---
    const filteredData = useMemo(() => {
        if (!dateRange?.from) return { invoices: [], payments: [] };

        const from = dateRange.from;
        const to = dateRange.to || new Date();

        const filteredInvoices = invoices.filter(inv => {
            const date = new Date(inv.created_at);
            const typeMatch = documentTypeFilter === 'all' || inv.type === documentTypeFilter; // Strict check for quotation vs invoice
            // If type is missing in DB (legacy), treat as 'invoice'
            const effectiveType = inv.type || 'invoice';
            const strictTypeMatch = documentTypeFilter === 'all' || effectiveType === documentTypeFilter;

            return isWithinInterval(date, { start: from, end: to }) && strictTypeMatch;
        });

        const filteredPayments = payments.filter(pay => {
            const date = new Date(pay.created_at);
            if (!isWithinInterval(date, { start: from, end: to })) return false;

            // Check if payment belongs to an invoice of the selected type
            if (documentTypeFilter === 'all') return true;

            // Find the linked invoice
            const invoice = invoices.find(inv => inv.id === pay.invoice_id);
            if (!invoice) return false; // Orphan payment or data issue

            const effectiveType = invoice.type || 'invoice';
            return effectiveType === documentTypeFilter;
        });

        return { invoices: filteredInvoices, payments: filteredPayments };
    }, [invoices, payments, dateRange, documentTypeFilter]);

    // --- Metrics Calculation ---
    const metrics = useMemo(() => {
        const totalInvoiced = filteredData.invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
        const totalReceived = filteredData.payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + (p.amount || 0), 0);

        // Pending includes: 
        // 1. Invoices not fully paid (simple heuristic: Total Invoiced - Total Approved Payments linked to those invoices)
        // For simplicity in this view, we can use invoice status or calc manually. 
        // Let's use filtered invoices status for a quick check, but exact calculation is better.
        const pendingInvoices = filteredData.invoices.filter(inv => inv.status !== 'Paid' && inv.status !== 'Draft');
        const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0); // This is approximate (doesn't account for partial payments if any allowed)

        const overdueInvoices = filteredData.invoices.filter(inv => {
            // Assuming 'due_date' exists, mostly it's created_at + terms. Let's assume overdue if not paid > 30 days for now or use created_at if no due_date
            const created = new Date(inv.created_at);
            const isOverdue = (new Date().getTime() - created.getTime()) > (30 * 24 * 60 * 60 * 1000); // 30 days
            return inv.status !== 'Paid' && inv.status !== 'Draft' && isOverdue;
        });
        const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

        return {
            totalInvoiced,
            totalReceived,
            pendingAmount,
            overdueAmount,
            netRevenue: totalReceived // Net revenue is usually actual cash in hand
        };
    }, [filteredData]);

    // --- Customer Analytics ---
    const customerMetrics = useMemo(() => {
        const metricsMap = new Map<string, any>();

        // Process Invoices
        filteredData.invoices.forEach(inv => {
            const customerId = inv.customer_id;
            if (!customerId) return;

            if (!metricsMap.has(customerId)) {
                metricsMap.set(customerId, {
                    id: customerId,
                    name: inv.customer?.name || 'Unknown',
                    company: inv.customer?.company_name,
                    email: inv.customer?.email,
                    createdAt: inv.customer?.created_at,
                    totalInvoiced: 0,
                    totalReceived: 0,
                    pendingAmount: 0,
                    serviceCount: 0,
                    lastPaymentDate: null
                });
            }

            const customer = metricsMap.get(customerId);
            customer.totalInvoiced += (inv.total || 0);
            customer.serviceCount += 1;

            // Pending logic: (Total - Paid for this invoice). 
            // Better: Sum of unpaid invoices.
            if (inv.status !== 'Paid') {
                customer.pendingAmount += (inv.total || 0);
            }
        });

        // Process Payments (Link to customer via invoice if possible, or just aggregate if we had customer_id in payments)
        // Since we don't have customer_id in payments table directly (usually), we rely on invoice linkage.
        // But `payments` fetched here are raw. We need to match them to invoices.
        // Optimization: Create an invoiceId -> customerId map.
        const invoiceCustomerMap = new Map();
        invoices.forEach(inv => invoiceCustomerMap.set(inv.id, inv.customer_id));

        filteredData.payments.forEach(pay => {
            if (pay.status !== 'approved') return;

            // If payment has customer_id directly (ideal), use it. Else infer from invoice.
            // Assuming simplified schema where payments link to invoice.
            // If payment isn't linked to invoice (e.g. advance), this might be tricky. 
            // Let's assume most have invoice_id.
            let customerId = (pay as any).customer_id; // Check if exists

            if (!customerId && pay.invoice_id) {
                customerId = invoiceCustomerMap.get(pay.invoice_id);
            }

            if (customerId && metricsMap.has(customerId)) {
                const customer = metricsMap.get(customerId);
                customer.totalReceived += (pay.amount || 0);

                const payDate = new Date(pay.created_at);
                if (!customer.lastPaymentDate || payDate > customer.lastPaymentDate) {
                    customer.lastPaymentDate = payDate;
                }
            }
        });

        return Array.from(metricsMap.values());
    }, [filteredData, invoices]);

    const sortedCustomers = useMemo(() => {
        let data = [...customerMetrics];

        if (customerSearch) {
            const lower = customerSearch.toLowerCase();
            data = data.filter(c =>
                c.name.toLowerCase().includes(lower) ||
                c.email?.toLowerCase().includes(lower) ||
                c.company?.toLowerCase().includes(lower)
            );
        }

        if (customerFilter !== 'all') {
            const now = new Date();
            data = data.filter(c => {
                if (customerFilter === 'unpaid') return c.pendingAmount > 0;
                if (customerFilter === 'paid') return c.pendingAmount <= 0;
                if (customerFilter === 'new') {
                    return c.createdAt && (now.getTime() - new Date(c.createdAt).getTime()) < (30 * 24 * 60 * 60 * 1000);
                }
                if (customerFilter === 'old') {
                    return c.createdAt && (now.getTime() - new Date(c.createdAt).getTime()) >= (30 * 24 * 60 * 60 * 1000);
                }
                return true;
            });
        }

        if (sortConfig) {
            data.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            // Default sort: Pending Amount Desc (High risk first)
            data.sort((a, b) => b.pendingAmount - a.pendingAmount);
        }

        return data;
    }, [customerMetrics, customerSearch, sortConfig, customerFilter]);

    // --- Chart Data Preparation ---
    const chartData = useMemo(() => {
        // 1. Revenue Trends (Group by Date)
        const revenueByDate = new Map();
        filteredData.payments.filter(p => p.status === 'approved').forEach(p => {
            const dateStr = format(new Date(p.created_at), 'yyyy-MM-dd');
            revenueByDate.set(dateStr, (revenueByDate.get(dateStr) || 0) + p.amount);
        });

        const trendData = Array.from(revenueByDate.entries()).map(([date, amount]) => ({
            date,
            amount
        })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // 2. Payment Methods
        const methodCounts = filteredData.payments.reduce((acc: any, p) => {
            const method = p.payment_method || 'Unknown';
            acc[method] = (acc[method] || 0) + p.amount;
            return acc;
        }, {});
        const methodData = Object.keys(methodCounts).map(key => ({ name: key, value: methodCounts[key] }));

        // 3. Customer Revenue (Top 5)
        const customerRevenue = new Map();
        filteredData.invoices.forEach(inv => {
            const name = inv.customer?.name || 'Unknown';
            customerRevenue.set(name, (customerRevenue.get(name) || 0) + inv.total);
        });
        const customerData = Array.from(customerRevenue.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        return { trendData, methodData, customerData };
    }, [filteredData]);

    // --- Handlers ---
    const handleRangeChange = (value: string) => {
        setTimeRange(value);
        const now = new Date();
        switch (value) {
            case 'today':
                setDateRange({ from: now, to: now });
                break;
            case 'thisWeek':
                setDateRange({ from: startOfWeek(now), to: now });
                break;
            case 'thisMonth':
                setDateRange({ from: startOfMonth(now), to: now });
                break;
            case 'lastMonth':
                setDateRange({ from: startOfMonth(subMonths(now, 1)), to: new Date(now.getFullYear(), now.getMonth(), 0) });
                break;
            case 'thisYear':
                setDateRange({ from: startOfYear(now), to: now });
                break;
            case 'custom':
                // Keep current range or reset
                break;
        }
    };

    const handleCustomerSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const handleExport = (formatType: 'pdf' | 'csv', type: 'financial' | 'customer' = 'financial') => {
        if (type === 'financial') {
            if (formatType === 'pdf') {
                const doc = new jsPDF();
                doc.text("Financial Insight Report", 14, 20);
                doc.setFontSize(10);
                doc.text(`Period: ${dateRange?.from ? format(dateRange.from, 'PPP') : ''} - ${dateRange?.to ? format(dateRange.to, 'PPP') : ''}`, 14, 30);

                const tableData = filteredData.invoices.map(inv => [
                    inv.invoice_number,
                    format(new Date(inv.created_at), 'MMM d, yyyy'),
                    inv.customer?.name || 'Unknown',
                    inv.status,
                    `Rs. ${inv.total.toLocaleString()}`
                ]);

                autoTable(doc, {
                    startY: 40,
                    head: [['Invoice #', 'Date', 'Customer', 'Status', 'Total']],
                    body: tableData,
                });

                // Add Summary
                const finalY = (doc as any).lastAutoTable.finalY + 10;
                doc.text(`Total Invoiced: Rs. ${metrics.totalInvoiced.toLocaleString()}`, 14, finalY);
                doc.text(`Total Received: Rs. ${metrics.totalReceived.toLocaleString()}`, 14, finalY + 7);
                doc.text(`Pending: Rs. ${metrics.pendingAmount.toLocaleString()}`, 14, finalY + 14);

                doc.save("financial_report.pdf");
            } else {
                // CSV Export
                const headers = ['Invoice Number', 'Date', 'Customer', 'Status', 'Total'];
                const rows = filteredData.invoices.map(inv => [
                    inv.invoice_number,
                    format(new Date(inv.created_at), 'yyyy-MM-dd'),
                    inv.customer?.name || 'Unknown',
                    inv.status,
                    inv.total
                ]);

                const csvContent = [
                    headers.join(','),
                    ...rows.map(r => r.join(','))
                ].join('\n');

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.setAttribute('download', 'financial_report.csv');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } else {
            // Customer Export
            if (formatType === 'pdf') {
                const doc = new jsPDF();
                doc.text("Customer Financial Analysis", 14, 20);

                const tableData = sortedCustomers.map(c => [
                    c.name,
                    c.serviceCount,
                    `Rs. ${c.totalInvoiced.toLocaleString()}`,
                    `Rs. ${c.totalReceived.toLocaleString()}`,
                    `Rs. ${c.pendingAmount.toLocaleString()}`,
                ]);

                autoTable(doc, {
                    startY: 30,
                    head: [['Customer', 'Services', 'Total Billed', 'Paid', 'Pending']],
                    body: tableData,
                });

                doc.save("customer_analytics.pdf");
            } else {
                const headers = ['Customer', 'Services', 'Total Billed', 'Paid', 'Pending', 'Last Payment'];
                const rows = sortedCustomers.map(c => [
                    c.name,
                    c.serviceCount,
                    c.totalInvoiced,
                    c.totalReceived,
                    c.pendingAmount,
                    c.lastPaymentDate ? format(c.lastPaymentDate, 'yyyy-MM-dd') : '-'
                ]);

                const csvContent = [
                    headers.join(','),
                    ...rows.map(r => r.join(','))
                ].join('\n');

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.setAttribute('download', 'customer_analytics.csv');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }
        toast({ title: "Export Successful", description: `Report downloaded as ${formatType.toUpperCase()}` });
    };

    return (
        <div className="flex bg-background min-h-screen">
            <AdminSidebar />
            <div className="flex-1 p-8 space-y-6 overflow-y-auto h-screen">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Financial Insights</h1>
                        <p className="text-muted-foreground">Real-time analytics and financial reporting.</p>
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

                        <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Document Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="invoice">Tax Invoices</SelectItem>
                                <SelectItem value="quotation">Quotations</SelectItem>
                                <SelectItem value="all">All Documents</SelectItem>
                            </SelectContent>
                        </Select>

                        {timeRange === 'custom' && (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                                        <Calendar className="mr-2 h-4 w-4" />
                                        {dateRange?.from ? (
                                            dateRange.to ? (
                                                <>
                                                    {format(dateRange.from, "LLL dd, y")} -{" "}
                                                    {format(dateRange.to, "LLL dd, y")}
                                                </>
                                            ) : (
                                                format(dateRange.from, "LLL dd, y")
                                            )
                                        ) : (
                                            <span>Pick a date</span>
                                        )}
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

                        <Button variant="outline" onClick={() => handleExport('csv', 'financial')}>
                            <FileText className="mr-2 h-4 w-4" /> CSV
                        </Button>
                        <Button onClick={() => handleExport('pdf', 'financial')}>
                            <Download className="mr-2 h-4 w-4" /> PDF Report
                        </Button>
                    </div>
                </div>

                <Tabs defaultValue="overview" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="customers">Customer Insights</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">

                        {/* Metrics Cards */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">₹{metrics.totalReceived.toLocaleString()}</div>
                                    <p className="text-xs text-muted-foreground">
                                        Received payments in selected period
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Total Invoiced</CardTitle>
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">₹{metrics.totalInvoiced.toLocaleString()}</div>
                                    <p className="text-xs text-muted-foreground">
                                        Total value of invoices generated
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
                                    <AlertCircle className="h-4 w-4 text-orange-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-orange-600">₹{metrics.pendingAmount.toLocaleString()}</div>
                                    <p className="text-xs text-muted-foreground">
                                        Unpaid invoices
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-red-600">₹{metrics.overdueAmount.toLocaleString()}</div>
                                    <p className="text-xs text-muted-foreground">
                                        Invoices overdue by more than 30 days
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Charts Section 1 */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                            <Card className="col-span-4">
                                <CardHeader>
                                    <CardTitle>Revenue Trend</CardTitle>
                                    <CardDescription>Daily revenue from approved payments</CardDescription>
                                </CardHeader>
                                <CardContent className="pl-2">
                                    <ResponsiveContainer width="100%" height={350}>
                                        <AreaChart data={chartData.trendData}>
                                            <defs>
                                                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis
                                                dataKey="date"
                                                stroke="#888888"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(value) => format(parseISO(value), 'MMM d')}
                                            />
                                            <YAxis
                                                stroke="#888888"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(value) => `₹${value}`}
                                            />
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <Tooltip
                                                formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Revenue']}
                                                labelFormatter={(label) => format(parseISO(label as string), 'MMM d, yyyy')}
                                            />
                                            <Area type="monotone" dataKey="amount" stroke="#10b981" fillOpacity={1} fill="url(#colorAmount)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <Card className="col-span-3">
                                <CardHeader>
                                    <CardTitle>Payment Methods</CardTitle>
                                    <CardDescription>Distribution of received payments</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={350}>
                                        <PieChart>
                                            <Pie
                                                data={chartData.methodData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {chartData.methodData.map((entry: any, index: any) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Charts Section 2 */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Top Customers by Revenue</CardTitle>
                                    <CardDescription>Who contributes most to your earnings</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {chartData.customerData.map((item: any, index: number) => (
                                            <div key={index} className="flex items-center">
                                                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold mr-4">
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <p className="text-sm font-medium leading-none">{item.name}</p>
                                                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                                        <div
                                                            className="bg-primary h-full"
                                                            style={{ width: `${(item.value / (chartData.customerData[0]?.value || 1)) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="font-bold">
                                                    ₹{item.value.toLocaleString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                {/* Additional Analytics or Call to Action */}
                                <CardHeader>
                                    <CardTitle>Financial Health</CardTitle>
                                    <CardDescription>Key indicators</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50">
                                        <div className="flex items-center gap-3">
                                            <TrendingUp className="h-8 w-8 text-green-600" />
                                            <div>
                                                <p className="font-medium text-green-900">Revenue Collection</p>
                                                <p className="text-sm text-green-700">Healthy flow</p>
                                            </div>
                                        </div>
                                        <Badge className="bg-green-600 hover:bg-green-700">Good</Badge>
                                    </div>

                                    <div className="flex items-center justify-between p-4 border rounded-lg bg-orange-50">
                                        <div className="flex items-center gap-3">
                                            <AlertCircle className="h-8 w-8 text-orange-600" />
                                            <div>
                                                <p className="font-medium text-orange-900">Pending Actions</p>
                                                <p className="text-sm text-orange-700">{metrics.pendingAmount > 0 ? "Follow up required" : "All clear"}</p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="border-orange-200 text-orange-700">Action Needed</Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="customers" className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 w-full max-w-lg">
                                <Search className="h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search customers by name, company, or email..."
                                    value={customerSearch}
                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                    className="max-w-[300px]"
                                />
                                <Select value={customerFilter} onValueChange={setCustomerFilter}>
                                    <SelectTrigger className="w-[150px]">
                                        <SelectValue placeholder="Filter" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Customers</SelectItem>
                                        <SelectItem value="unpaid">Unpaid / Due</SelectItem>
                                        <SelectItem value="paid">Fully Paid</SelectItem>
                                        <SelectItem value="new">New (30 Days)</SelectItem>
                                        <SelectItem value="old">Existing / Old</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleExport('csv', 'customer')}>
                                    <FileText className="mr-2 h-4 w-4" /> Export CSV
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleExport('pdf', 'customer')}>
                                    <Download className="mr-2 h-4 w-4" /> Export PDF
                                </Button>
                            </div>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Customer Financials</CardTitle>
                                <CardDescription>Detailed breakdown of revenue and pending amounts per customer</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="cursor-pointer" onClick={() => handleCustomerSort('name')}>Customer</TableHead>
                                            <TableHead className="text-center cursor-pointer" onClick={() => handleCustomerSort('serviceCount')}>Services</TableHead>
                                            <TableHead className="text-right cursor-pointer" onClick={() => handleCustomerSort('totalInvoiced')}>Total Billed</TableHead>
                                            <TableHead className="text-right cursor-pointer" onClick={() => handleCustomerSort('totalReceived')}>Paid</TableHead>
                                            <TableHead className="text-right cursor-pointer" onClick={() => handleCustomerSort('pendingAmount')}>Pending</TableHead>
                                            <TableHead className="text-right">Last Payment</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedCustomers.map((customer) => (
                                            <TableRow key={customer.id}>
                                                <TableCell className="font-medium">
                                                    <div>{customer.name}</div>
                                                    {customer.company && <div className="text-xs font-semibold text-muted-foreground">{customer.company}</div>}
                                                    <div className="text-xs text-muted-foreground">{customer.email}</div>
                                                </TableCell>
                                                <TableCell className="text-center">{customer.serviceCount}</TableCell>
                                                <TableCell className="text-right">₹{customer.totalInvoiced.toLocaleString()}</TableCell>
                                                <TableCell className="text-right text-green-600">₹{customer.totalReceived.toLocaleString()}</TableCell>
                                                <TableCell className="text-right">
                                                    <span className={customer.pendingAmount > 0 ? "text-red-600 font-bold" : "text-muted-foreground"}>
                                                        ₹{customer.pendingAmount.toLocaleString()}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right text-xs">
                                                    {customer.lastPaymentDate ? format(customer.lastPaymentDate, 'MMM d, yyyy') : '-'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button size="sm" variant="outline" onClick={() => setSelectedCustomerForAnalytics(customer)}>
                                                            <BarChart3 className="h-4 w-4 mr-1" /> Analytics
                                                        </Button>
                                                        <Button size="sm" variant="ghost" onClick={() => navigate('/admin/customers')}>
                                                            Profile
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {sortedCustomers.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                    No customers found matching criteria
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
            {selectedCustomerForAnalytics && (
                <CustomerAnalyticsModal
                    open={!!selectedCustomerForAnalytics}
                    onOpenChange={(open) => !open && setSelectedCustomerForAnalytics(null)}
                    customer={selectedCustomerForAnalytics}
                    invoices={invoices.filter(i => i.customer_id === selectedCustomerForAnalytics.id)}
                    payments={payments.filter(p => {
                        const isDirect = (p as any).customer_id === selectedCustomerForAnalytics.id;
                        if (isDirect) return true;
                        // Check linked invoice
                        const invoice = invoices.find(inv => inv.id === p.invoice_id);
                        return invoice?.customer_id === selectedCustomerForAnalytics.id;
                    })}
                />
            )}
        </div>
    );
}
