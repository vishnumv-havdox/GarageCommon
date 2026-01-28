import { useState, useMemo } from "react";
import { format, subDays, startOfMonth, startOfWeek, isSameDay, isSameMonth, subMonths, isWithinInterval, parseISO, startOfYear, subYears } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { Download, FileText, TrendingUp, TrendingDown, IndianRupee, CreditCard, Wrench, Calendar } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ff7300', '#387908'];

interface CustomerAnalyticsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    customer: any;
    invoices: any[];
    payments: any[];
}

export function CustomerAnalyticsModal({ open, onOpenChange, customer, invoices, payments }: CustomerAnalyticsModalProps) {
    const { toast } = useToast();
    const [timeRange, setTimeRange] = useState("all");

    // --- Filter Data based on Time Range ---
    const filteredData = useMemo(() => {
        const now = new Date();
        let startDate: Date | null = null;

        if (timeRange === 'thisMonth') startDate = startOfMonth(now);
        else if (timeRange === 'lastMonth') startDate = startOfMonth(subMonths(now, 1));
        else if (timeRange === 'thisYear') startDate = startOfYear(now);
        else if (timeRange === 'lastYear') startDate = startOfYear(subYears(now, 1));
        else if (timeRange === 'last3Months') startDate = subMonths(now, 3);

        // Filter Invoices
        const filteredInvoices = invoices.filter(inv => {
            if (!startDate) return true;
            return new Date(inv.created_at) >= startDate;
        });

        // Filter Payments
        const filteredPayments = payments.filter(pay => {
            if (!startDate) return true;
            return new Date(pay.created_at) >= startDate;
        });

        return { invoices: filteredInvoices, payments: filteredPayments };
    }, [timeRange, invoices, payments]);

    // --- Metrics Calculation ---
    const metrics = useMemo(() => {
        const totalInvoiced = filteredData.invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
        const totalPaid = filteredData.payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + (p.amount || 0), 0);
        const pending = filteredData.invoices.filter(inv => inv.status !== 'Paid').reduce((sum, inv) => sum + (inv.total || 0), 0);
        // Note: Exact pending logic typically involves checking partial payments too, but existing logic is invoice-based.
        // We can trust the passed 'pendingAmount' from parent, but here we recalculate for the filtered range.
        // Actually, 'Pending' is a current state, usually not filtered by time range (an old invoice is still pending).
        // But for "Analytics over a period", we show activity. 
        // Let's calculate purely based on filtered invoices for "Billed in Period" and filtered payments for "Paid in Period".

        const serviceCount = filteredData.invoices.length;
        const avgInvoiceValue = serviceCount > 0 ? totalInvoiced / serviceCount : 0;

        return { totalInvoiced, totalPaid, pending, serviceCount, avgInvoiceValue };
    }, [filteredData]);

    // --- Chart Data ---
    const chartData = useMemo(() => {
        // 1. Spend Trend (Monthly)
        const trendMap = new Map();
        filteredData.invoices.forEach(inv => {
            const date = new Date(inv.created_at);
            const key = format(date, 'MMM yyyy');
            trendMap.set(key, (trendMap.get(key) || 0) + inv.total);
        });

        // Fill gaps if needed, or just sort
        const trend = Array.from(trendMap.entries()).map(([name, value]) => ({ name, value }));
        // Sort by date? Parsing 'MMM yyyy' is hard without original date.
        // Better: use yyyy-MM sortable key then format for display.
        const trendMapSortable = new Map();
        filteredData.invoices.forEach(inv => {
            const date = new Date(inv.created_at);
            const key = format(date, 'yyyy-MM');
            const display = format(date, 'MMM yy');
            if (!trendMapSortable.has(key)) trendMapSortable.set(key, { name: display, value: 0, sort: key });
            trendMapSortable.get(key).value += inv.total;
        });
        const spendTrend = Array.from(trendMapSortable.values()).sort((a, b) => a.sort.localeCompare(b.sort));

        // 2. Service Mix (by Service Type)
        // Access nested work_order.service_type if available
        const serviceMap = new Map();
        filteredData.invoices.forEach(inv => {
            // Assuming query: select('*, work_order:work_orders(service_type)')
            const type = inv.work_order?.service_type || 'General';
            serviceMap.set(type, (serviceMap.get(type) || 0) + 1);
        });
        const serviceMix = Array.from(serviceMap.entries()).map(([name, value]) => ({ name, value }));

        // 3. Payment Methods
        const methodMap = new Map();
        filteredData.payments.filter(p => p.status === 'approved').forEach(p => {
            const method = p.payment_method || 'Unknown';
            methodMap.set(method, (methodMap.get(method) || 0) + p.amount);
        });
        const paymentMethods = Array.from(methodMap.entries()).map(([name, value]) => ({ name, value }));

        return { spendTrend, serviceMix, paymentMethods };
    }, [filteredData]);

    const handleExport = () => {
        const doc = new jsPDF();
        doc.text(`Customer Analytics: ${customer?.name}`, 14, 20);
        doc.setFontSize(10);
        doc.text(`Range: ${timeRange}`, 14, 28);

        // Metrics
        autoTable(doc, {
            startY: 35,
            head: [['Total Billed', 'Total Paid', 'Services', 'Avg Value']],
            body: [[
                `Rs. ${metrics.totalInvoiced.toLocaleString()}`,
                `Rs. ${metrics.totalPaid.toLocaleString()}`,
                metrics.serviceCount,
                `Rs. ${metrics.avgInvoiceValue.toLocaleString()}`
            ]],
        });

        // Invoices Detail
        doc.text("Invoice History", 14, (doc as any).lastAutoTable.finalY + 10);

        const invoiceRows = filteredData.invoices.map(inv => [
            format(new Date(inv.created_at), 'yyyy-MM-dd'),
            inv.invoice_number,
            inv.work_order?.service_type || '-',
            inv.status,
            inv.total
        ]);

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 15,
            head: [['Date', 'Invoice #', 'Service', 'Status', 'Amount']],
            body: invoiceRows,
        });

        doc.save(`${customer?.name || 'customer'}_analytics.pdf`);
        toast({ title: "Exported", description: "Analytics report downloaded." });
    };

    if (!customer) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="mb-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-2xl">{customer.name}</DialogTitle>
                            <DialogDescription>
                                {customer.email} • {customer.phone}
                            </DialogDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Select value={timeRange} onValueChange={setTimeRange}>
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="Time Range" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Time</SelectItem>
                                    <SelectItem value="thisYear">This Year</SelectItem>
                                    <SelectItem value="lastYear">Last Year</SelectItem>
                                    <SelectItem value="last3Months">Last 3 Months</SelectItem>
                                    <SelectItem value="thisMonth">This Month</SelectItem>
                                    <SelectItem value="lastMonth">Last Month</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="icon" onClick={handleExport}>
                                <Download className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Card>
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spend</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl font-bold">₹{metrics.totalInvoiced.toLocaleString()}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl font-bold text-green-600">₹{metrics.totalPaid.toLocaleString()}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Services</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl font-bold">{metrics.serviceCount}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Value</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl font-bold">₹{Math.round(metrics.avgInvoiceValue).toLocaleString()}</div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Trend Chart */}
                    <Card className="col-span-2">
                        <CardHeader>
                            <CardTitle>Spending Trend</CardTitle>
                            <CardDescription>Monthly invoice totals over time</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            {chartData.spendTrend.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData.spendTrend}>
                                        <defs>
                                            <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} />
                                        <Area type="monotone" dataKey="value" stroke="#8884d8" fillOpacity={1} fill="url(#colorSpend)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">No data for this period</div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Service Mix */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Service Mix</CardTitle>
                            <CardDescription>Breakdown by service type</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            {chartData.serviceMix.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={chartData.serviceMix}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {chartData.serviceMix.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Payment Methods */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Payment Methods</CardTitle>
                            <CardDescription>How this customer pays</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            {chartData.paymentMethods.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={chartData.paymentMethods}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={80}
                                            dataKey="value"
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {chartData.paymentMethods.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>
                            )}
                        </CardContent>
                    </Card>
                </div>

            </DialogContent>
        </Dialog>
    );
}
