import { useState, useEffect, useMemo } from "react";
import { format, subDays, startOfMonth, startOfWeek, isSameDay, isSameMonth, subMonths, isWithinInterval, parseISO, startOfYear } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs";
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
    FileText, CreditCard, Users, AlertCircle, ArrowUpRight, ArrowDownRight, Search, Filter, BarChart3,
    ChevronUp, ChevronDown, Plus, Wallet, Sparkles
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CustomerAnalyticsModal } from "@/components/analytics/CustomerAnalyticsModal";
import { FinanceTabsNav } from "@/components/layout/FinanceTabsNav";
import { useExpenses } from "@/hooks/useExpenses";
import { RecordExpenseModal } from "@/components/expenses/RecordExpenseModal";
import { ExpensesRegisterView } from "@/components/expenses/ExpensesRegisterView";
import { EXPENSE_CATEGORIES } from "@/types/expenses";

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function InvoiceAnalytics() {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);

    // Get active tab from URL or default to overview
    const activeTab = searchParams.get('tab') || 'overview';

    // Page Title based on tab
    const pageTitle = activeTab === 'customers'
        ? 'Customer Insights'
        : activeTab === 'expenses'
        ? 'Garage Expenditures & Outflows'
        : 'Financial & Profit Insights';
    const pageDesc = activeTab === 'customers'
        ? 'Deep dive into customer spending and payment patterns.'
        : activeTab === 'expenses'
        ? 'Track workshop operating costs, petty cash, and vendor parts outflows.'
        : 'Real-time Net Profit, revenue inflows, and garage cash flow intelligence.';

    const handleTabChange = (value: string) => {
        setSearchParams({ tab: value });
    };

    const [expenseModalOpen, setExpenseModalOpen] = useState(false);
    const { expenses, addExpense, deleteExpense, toggleReimbursement } = useExpenses();

    // Data State
    const [invoices, setInvoices] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [paymentLinks, setPaymentLinks] = useState<any[]>([]);

    // Export State
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [exportOptions, setExportOptions] = useState({
        status: 'all', // all, paid, unpaid, partial
        company: 'all',
        includePending: true,
        includeDeductions: true,
        type: 'financial' as 'financial' | 'customer'
    });

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
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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
                `);

            if (invoicesError) throw invoicesError;

            const { data: paymentsData, error: paymentsError } = await supabase
                .from('payments')
                .select('*');

            if (paymentsError) throw paymentsError;

            const { data: linksData, error: linksError } = await supabase
                .from('payment_links')
                .select('*, payment:payments(*), invoice:invoices(customer_id)');

            if (linksError) throw linksError;

            setInvoices(invoicesData || []);
            setPayments(paymentsData || []);
            setPaymentLinks(linksData || []);
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

    // --- Expenses Filtered by Selected Period ---
    const filteredExpenses = useMemo(() => {
        return expenses.filter(exp => {
            if (!dateRange?.from && !dateRange?.to) return true;
            const expDate = new Date(exp.expense_date);
            if (dateRange?.from && expDate < dateRange.from) return false;
            if (dateRange?.to) {
                const endOfDay = new Date(dateRange.to);
                endOfDay.setHours(23, 59, 59, 999);
                if (expDate > endOfDay) return false;
            }
            return true;
        });
    }, [expenses, dateRange]);

    const totalExpenses = useMemo(() => {
        return filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    }, [filteredExpenses]);

    // --- Metrics Calculation ---
    const metrics = useMemo(() => {
        const totalInvoiced = filteredData.invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
        const totalDeductions = filteredData.invoices.reduce((sum, inv) => sum + (inv.total_deductions || 0), 0);
        const totalReceived = filteredData.payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + (p.amount || 0), 0);

        const realizationRate = totalInvoiced > 0 ? (totalReceived / totalInvoiced) * 100 : 0;

        const pendingInvoices = filteredData.invoices.filter(inv => inv.status !== 'Paid' && inv.status !== 'Draft');
        const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

        const overdueInvoices = filteredData.invoices.filter(inv => {
            const created = new Date(inv.created_at);
            const isOverdue = (new Date().getTime() - created.getTime()) > (30 * 24 * 60 * 60 * 1000); // 30 days
            return inv.status !== 'Paid' && inv.status !== 'Draft' && isOverdue;
        });
        const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

        const netProfit = totalReceived - totalExpenses;
        const netMargin = totalReceived > 0 ? (netProfit / totalReceived) * 100 : 0;

        return {
            totalInvoiced,
            totalReceived,
            totalDeductions,
            realizationRate,
            pendingAmount,
            overdueAmount,
            netRevenue: totalReceived,
            totalExpenses,
            netProfit,
            netMargin
        };
    }, [filteredData, totalExpenses]);

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
                    lastPaymentDate: null,
                    vehicles: new Set<string>(),
                    workOrders: []
                });
            }

            const customer = metricsMap.get(customerId);
            customer.totalInvoiced += (inv.total || 0);
            customer.totalDeductions = (customer.totalDeductions || 0) + (inv.total_deductions || 0);
            customer.serviceCount += 1;

            if (inv.work_order) {
                if (inv.work_order.vehicle?.vehicle_number) {
                    customer.vehicles.add(inv.work_order.vehicle.vehicle_number);
                }
                customer.workOrders.push({
                    id: inv.work_order.id,
                    service: inv.work_order.service_type,
                    bill_number: inv.bill_number,
                    type: inv.type || 'invoice'
                });
            }

            if (inv.status !== 'Paid' && inv.status !== 'Draft') {
                customer.pendingAmount += (inv.total || 0);
            }
        });

        // Create an invoiceId -> customerId map.
        const invoiceCustomerMap = new Map();
        invoices.forEach(inv => invoiceCustomerMap.set(inv.id, inv.customer_id));

        // Process Payments (Link to customer via invoice)

        // Better Approach:
        // Iterate filtered payments.
        filteredData.payments.forEach(pay => {
            if (pay.status !== 'approved') return;

            // Calculate Cash Ratio (to exclude deductions from revenue)
            const totalValue = (pay.amount || 0) + (pay.deduction_amount || 0);
            const cashRatio = totalValue > 0 ? (pay.amount || 0) / totalValue : 0;

            // Check if this payment has links in the global `paymentLinks` state
            const links = paymentLinks.filter((l: any) => l.payment_id === pay.id);

            if (links.length > 0) {
                // Distributed Payment
                links.forEach((link: any) => {
                    // Find customer for this link's invoice
                    const customerId = link.invoice?.customer_id || invoiceCustomerMap.get(link.invoice_id);
                    if (customerId && metricsMap.has(customerId)) {
                        const customer = metricsMap.get(customerId);
                        // Derived Cash Amount = Amount Applied * (Cash / Total Value)
                        const cashAmount = (link.amount_applied || 0) * cashRatio;
                        customer.totalReceived += cashAmount;

                        // Update last payment date
                        const payDate = new Date(pay.created_at);
                        if (!customer.lastPaymentDate || payDate > customer.lastPaymentDate) {
                            customer.lastPaymentDate = payDate;
                        }
                    }
                });
            } else if (pay.invoice_id) {
                // Direct Payment (Legacy or Single)
                const customerId = invoiceCustomerMap.get(pay.invoice_id);
                if (customerId && metricsMap.has(customerId)) {
                    const customer = metricsMap.get(customerId);
                    // For direct payments, pay.amount is already the Cash Received.
                    customer.totalReceived += (pay.amount || 0);

                    const payDate = new Date(pay.created_at);
                    if (!customer.lastPaymentDate || payDate > customer.lastPaymentDate) {
                        customer.lastPaymentDate = payDate;
                    }
                }
            }
        });

        return Array.from(metricsMap.values());
    }, [filteredData, invoices, paymentLinks]);

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
                const aValue = (a as any)[sortConfig.key];
                const bValue = (b as any)[sortConfig.key];

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

    const groupedCustomers = useMemo(() => {
        const groups = new Map<string, any>();

        sortedCustomers.forEach(c => {
            const groupKey = c.company || `individual-${c.id}`;
            if (!groups.has(groupKey)) {
                groups.set(groupKey, {
                    id: groupKey,
                    isGroup: !!c.company,
                    company: c.company,
                    name: c.company ? c.company : c.name,
                    customers: [],
                    totalInvoiced: 0,
                    totalReceived: 0,
                    totalDeductions: 0,
                    pendingAmount: 0,
                    serviceCount: 0,
                    lastPaymentDate: null,
                    vehicles: new Set<string>()
                });
            }

            const group = groups.get(groupKey);
            group.customers.push(c);
            group.totalInvoiced += c.totalInvoiced;
            group.totalReceived += c.totalReceived;
            group.totalDeductions += (c.totalDeductions || 0);
            group.pendingAmount += c.pendingAmount;
            group.serviceCount += c.serviceCount;

            if (c.vehicles) {
                c.vehicles.forEach((v: string) => group.vehicles.add(v));
            }

            if (c.lastPaymentDate && (!group.lastPaymentDate || c.lastPaymentDate > group.lastPaymentDate)) {
                group.lastPaymentDate = c.lastPaymentDate;
            }
        });

        return Array.from(groups.values());
    }, [sortedCustomers]);

    const uniqueCompanies = useMemo(() => {
        const companies = new Set<string>();
        invoices.forEach(inv => {
            if (inv.customer?.company_name) {
                companies.add(inv.customer.company_name);
            }
        });
        return Array.from(companies).sort();
    }, [invoices]);

    const toggleGroup = (company: string) => {
        const newSet = new Set(expandedGroups);
        if (newSet.has(company)) newSet.delete(company);
        else newSet.add(company);
        setExpandedGroups(newSet);
    };

    // --- Chart Data Preparation ---
    const chartData = useMemo(() => {
        // 1. Revenue Trends (Group by Date)
        const revenueByDate = new Map<string, number>();
        filteredData.payments.filter(p => p.status === 'approved').forEach(p => {
            const dateStr = format(new Date(p.created_at), 'yyyy-MM-dd');
            revenueByDate.set(dateStr, (revenueByDate.get(dateStr) || 0) + p.amount);
        });

        // 2. Expense Trends (Group by Date)
        const expenseByDate = new Map<string, number>();
        filteredExpenses.forEach(e => {
            expenseByDate.set(e.expense_date, (expenseByDate.get(e.expense_date) || 0) + e.amount);
        });

        const allDates = new Set<string>();
        revenueByDate.forEach((_, d) => allDates.add(d));
        expenseByDate.forEach((_, d) => allDates.add(d));

        const trendData = Array.from(allDates).map(date => {
            const rev = revenueByDate.get(date) || 0;
            const exp = expenseByDate.get(date) || 0;
            return {
                date,
                revenue: rev,
                expense: exp,
                profit: rev - exp
            };
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // 3. Payment Methods
        const methodCounts = filteredData.payments.reduce((acc: any, p) => {
            const method = p.payment_method || 'Unknown';
            acc[method] = (acc[method] || 0) + p.amount;
            return acc;
        }, {});
        const methodData = Object.keys(methodCounts).map(key => ({ name: key, value: methodCounts[key] }));

        // 4. Expense Category Breakdown (for Donut Chart)
        const categoryCounts: Record<string, number> = {};
        filteredExpenses.forEach(e => {
            categoryCounts[e.category] = (categoryCounts[e.category] || 0) + e.amount;
        });
        const expenseCategoryData = Object.entries(categoryCounts).map(([catKey, value]) => {
            const meta = EXPENSE_CATEGORIES.find(c => c.key === catKey);
            return {
                name: meta?.label || catKey,
                value,
                color: meta?.color || '#6b7280'
            };
        });

        // 5. Customer Revenue (Top 5)
        const customerData = customerMetrics
            .map(c => ({ name: c.name, value: c.totalReceived }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        return { trendData, methodData, customerData, expenseCategoryData };
    }, [filteredData, filteredExpenses, customerMetrics]);

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

    const handleExport = (formatType: 'pdf' | 'csv') => {
        const { type, status, company } = exportOptions;

        let dataToExport = type === 'customer' ? sortedCustomers : filteredData.invoices;

        // Apply filters
        if (status !== 'all') {
            dataToExport = dataToExport.filter((item: any) => {
                if (type === 'customer') {
                    if (status === 'paid') return item.pendingAmount === 0;
                    if (status === 'unpaid') return item.pendingAmount > 0;
                    return true;
                } else {
                    return item.status.toLowerCase() === status.toLowerCase();
                }
            });
        }

        if (company !== 'all') {
            dataToExport = dataToExport.filter((item: any) => {
                const compName = type === 'customer' ? item.company : (item.customer?.company_name);
                return compName === company;
            });
        }

        if (formatType === 'pdf') {
            const doc = new jsPDF();
            const title = type === 'customer' ? "Customer Financial Analysis" : "Financial Insight Report";
            doc.text(title, 14, 20);
            doc.setFontSize(10);
            const period = `Period: ${dateRange?.from ? format(dateRange.from, 'PPP') : ''} - ${dateRange?.to ? format(dateRange.to, 'PPP') : ''}`;
            const filterInfo = `Filters: Status=${status}, Company=${company}`;
            doc.text(`${period} | ${filterInfo}`, 14, 30);

            let headers, body;
            if (type === 'customer') {
                headers = [['Customer', 'Services', 'Total Billed', 'Paid', 'Deductions', 'Pending']];
                body = dataToExport.map((c: any) => [
                    c.name,
                    c.serviceCount,
                    `Rs. ${c.totalInvoiced.toLocaleString()}`,
                    `Rs. ${c.totalReceived.toLocaleString()}`,
                    `Rs. ${(c.totalDeductions || 0).toLocaleString()}`,
                    `Rs. ${c.pendingAmount.toLocaleString()}`,
                ]);
            } else {
                headers = [['Invoice #', 'Date', 'Customer', 'Status', 'Total']];
                body = dataToExport.map((inv: any) => [
                    `${inv.type === 'quotation' ? 'QUO' : 'INV'}-${inv.bill_number || 'Draft'}`,
                    format(new Date(inv.created_at), 'MMM d, yyyy'),
                    inv.customer?.name || 'Unknown',
                    inv.status,
                    `Rs. ${(inv.total || 0).toLocaleString()}`
                ]);
            }

            autoTable(doc, {
                startY: 40,
                head: headers,
                body: body,
            });

            if (type === 'financial') {
                const finalY = (doc as any).lastAutoTable.finalY + 10;
                const totalInvoiced = dataToExport.reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
                const totalDeductions = dataToExport.reduce((sum: number, inv: any) => sum + (inv.total_deductions || 0), 0);
                doc.text(`Exported Total: Rs. ${totalInvoiced.toLocaleString()}`, 14, finalY);
                doc.text(`Exported Deductions: Rs. ${totalDeductions.toLocaleString()}`, 14, finalY + 7);
            }

            doc.save(`${type}_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        } else {
            // CSV Logic (simplified for brevity)
            const headers = type === 'customer' ? ['Customer', 'Services', 'Total', 'Paid', 'Deductions', 'Pending'] : ['Number', 'Date', 'Customer', 'Status', 'Total'];
            const rows = dataToExport.map((item: any) => {
                if (type === 'customer') return [item.name, item.serviceCount, item.totalInvoiced, item.totalReceived, item.totalDeductions, item.pendingAmount];
                return [item.bill_number, item.created_at, item.customer?.name, item.status, item.total];
            });

            const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', `${type}_export.csv`);
            link.click();
        }

        setExportDialogOpen(false);
        toast({ title: "Export Successful", description: `Report downloaded as ${formatType.toUpperCase()}` });
    };

    const AdvancedExportDialog = () => (
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
                        <Label htmlFor="type" className="text-right text-xs">Report Type</Label>
                        <Select
                            value={exportOptions.type}
                            onValueChange={(v: any) => setExportOptions({ ...exportOptions, type: v })}
                        >
                            <SelectTrigger className="col-span-3 text-xs h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="financial">Financial (Invoices)</SelectItem>
                                <SelectItem value="customer">Customer Financials</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
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
                                <SelectItem value="partial">Partial Payments</SelectItem>
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
    );

    return (
        <div className="flex flex-col lg:flex-row bg-background min-h-screen">
            <AdminSidebar />
            <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 min-h-screen">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>
                        <p className="text-muted-foreground">{pageDesc}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
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

                        <Button
                            size="sm"
                            onClick={() => setExpenseModalOpen(true)}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs gap-1.5 shadow-sm"
                        >
                            <Plus className="h-4 w-4" /> Record Expense
                        </Button>

                        <AdvancedExportDialog />
                    </div>
                </div>

                <FinanceTabsNav />

                <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="overview">Overview & P&L</TabsTrigger>
                        <TabsTrigger value="expenses">
                            Expenditures & Outflows ({filteredExpenses.length})
                        </TabsTrigger>
                        <TabsTrigger value="customers">Customer Insights</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">

                        {/* Executive P&L Scorecard KPI Cards */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                            {/* 1. Collected Revenue */}
                            <Card className="border-border/70 shadow-sm">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Collected Revenue</CardTitle>
                                    <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                                        <IndianRupee className="h-4 w-4" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-black text-foreground">₹{metrics.totalReceived.toLocaleString()}</div>
                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                                        <span>Billed: ₹{metrics.totalInvoiced.toLocaleString()}</span>
                                        <span className="text-emerald-600 font-bold">{metrics.realizationRate.toFixed(0)}% rate</span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* 2. Total Expenditures */}
                            <Card className="border-border/70 shadow-sm cursor-pointer hover:border-rose-500/50 transition-all" onClick={() => handleTabChange('expenses')}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Outflows</CardTitle>
                                    <div className="h-8 w-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
                                        <TrendingDown className="h-4 w-4" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-black text-rose-600">₹{metrics.totalExpenses.toLocaleString()}</div>
                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                                        <span>{filteredExpenses.length} shop expenses</span>
                                        <span className="text-rose-600 font-semibold hover:underline">View register &rarr;</span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* 3. Net Profit / Loss */}
                            <Card className={`border shadow-sm ${metrics.netProfit >= 0 ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-rose-500/5 border-rose-500/30'}`}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Net Profit / Loss</CardTitle>
                                    <Badge variant="outline" className={`text-[10px] font-black uppercase tracking-wider ${metrics.netProfit >= 0 ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300'}`}>
                                        {metrics.netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS'}
                                    </Badge>
                                </CardHeader>
                                <CardContent>
                                    <div className={`text-2xl font-black tracking-tight ${metrics.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {metrics.netProfit >= 0 ? '+' : '-'}₹{Math.abs(metrics.netProfit).toLocaleString()}
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1 font-medium">
                                        <span>Margin</span>
                                        <span className={`font-bold ${metrics.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {metrics.netMargin.toFixed(1)}%
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* 4. Total Deductions */}
                            <Card className="border-border/70 shadow-sm">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lost Deductions</CardTitle>
                                    <div className="h-8 w-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 flex items-center justify-center">
                                        <AlertCircle className="h-4 w-4" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-black text-orange-600">₹{metrics.totalDeductions.toLocaleString()}</div>
                                    <p className="text-[11px] text-muted-foreground mt-1">Discounts & agreed write-offs</p>
                                </CardContent>
                            </Card>

                            {/* 5. Pending Amount */}
                            <Card className="border-border/70 shadow-sm">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pending Due</CardTitle>
                                    <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
                                        <Calendar className="h-4 w-4" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-black text-amber-600">₹{metrics.pendingAmount.toLocaleString()}</div>
                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                                        <span>Overdue: ₹{metrics.overdueAmount.toLocaleString()}</span>
                                        <span className="text-red-500 font-semibold">{metrics.overdueAmount > 0 ? '30d+ risk' : 'Healthy'}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Charts Section 1: Cash Flow & Outflows */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                            <Card className="col-span-4 border-border/70 shadow-sm">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>Cash Flow & Margin Trend</CardTitle>
                                            <CardDescription>Daily comparison of Inflows (Green) vs Outflows (Red)</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pl-2">
                                    <ResponsiveContainer width="100%" height={340}>
                                        <AreaChart data={chartData.trendData}>
                                            <defs>
                                                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.7} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.7} />
                                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis
                                                dataKey="date"
                                                stroke="#888888"
                                                fontSize={11}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(value) => {
                                                    try {
                                                        return format(parseISO(value), 'MMM d');
                                                    } catch {
                                                        return value;
                                                    }
                                                }}
                                            />
                                            <YAxis
                                                stroke="#888888"
                                                fontSize={11}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(value) => `₹${value}`}
                                            />
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <Tooltip
                                                formatter={(value: number, name: string) => [
                                                    `₹${value.toLocaleString()}`,
                                                    name === 'revenue' ? 'Revenue (Inflow)' : name === 'expense' ? 'Expenses (Outflow)' : 'Net Profit'
                                                ]}
                                                labelFormatter={(label) => {
                                                    try {
                                                        return format(parseISO(label as string), 'MMM d, yyyy');
                                                    } catch {
                                                        return label;
                                                    }
                                                }}
                                            />
                                            <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                                            <Area type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <Card className="col-span-3 border-border/70 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Expenditure Breakdown</CardTitle>
                                    <CardDescription>Where garage money is going</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {chartData.expenseCategoryData.length === 0 ? (
                                        <div className="h-[340px] flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
                                            <Wallet className="h-8 w-8 opacity-40" />
                                            <span>No expenditures recorded in this period</span>
                                            <Button size="sm" variant="outline" onClick={() => setExpenseModalOpen(true)} className="text-xs mt-1">
                                                + Log Expense
                                            </Button>
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={340}>
                                            <PieChart>
                                                <Pie
                                                    data={chartData.expenseCategoryData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={95}
                                                    paddingAngle={4}
                                                    dataKey="value"
                                                >
                                                    {chartData.expenseCategoryData.map((entry: any, index: any) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Spent']} />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Charts Section 2: Customers & Payment Methods */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                            <Card className="border-border/70 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Top Customers by Revenue</CardTitle>
                                    <CardDescription>Highest revenue contributors in period</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {chartData.customerData.map((item: any, index: number) => (
                                            <div key={index} className="flex items-center">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold mr-3 shrink-0">
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1 space-y-1 min-w-0">
                                                    <p className="text-xs font-bold truncate leading-none">{item.name}</p>
                                                    <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                                                        <div
                                                            className="bg-primary h-full"
                                                            style={{ width: `${(item.value / (chartData.customerData[0]?.value || 1)) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="font-extrabold text-xs ml-3 whitespace-nowrap">
                                                    ₹{item.value.toLocaleString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-border/70 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Payment Methods</CardTitle>
                                    <CardDescription>Cash vs Digital customer receipts</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={240}>
                                        <PieChart>
                                            <Pie
                                                data={chartData.methodData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={50}
                                                outerRadius={80}
                                                paddingAngle={4}
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
                    </TabsContent>

                    {/* Expenditures Tab */}
                    <TabsContent value="expenses" className="space-y-4">
                        <ExpensesRegisterView
                            expenses={filteredExpenses}
                            onAddExpense={addExpense}
                            onDeleteExpense={deleteExpense}
                            onToggleReimbursement={toggleReimbursement}
                            dateFilterRange={dateRange}
                        />
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
                            <div className="flex gap-2 text-xs text-muted-foreground italic">
                                Use the export button in the header for advanced options
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
                                            <TableHead>Vehicles & History</TableHead>
                                            <TableHead className="text-center cursor-pointer" onClick={() => handleCustomerSort('serviceCount')}>Services</TableHead>
                                            <TableHead className="text-right cursor-pointer" onClick={() => handleCustomerSort('totalInvoiced')}>Total Billed</TableHead>
                                            <TableHead className="text-right cursor-pointer" onClick={() => handleCustomerSort('totalReceived')}>Paid</TableHead>
                                            <TableHead className="text-right text-orange-600">Deductions</TableHead>
                                            <TableHead className="text-right cursor-pointer" onClick={() => handleCustomerSort('pendingAmount')}>Pending</TableHead>
                                            <TableHead className="text-right">Last Payment</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {groupedCustomers.map((group) => (
                                            <>
                                                <TableRow
                                                    key={group.id}
                                                    className={cn(
                                                        group.isGroup && "bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors uppercase",
                                                        !group.isGroup && "hover:bg-muted/20"
                                                    )}
                                                    onClick={() => group.isGroup && toggleGroup(group.company)}
                                                >
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            {group.isGroup && (
                                                                expandedGroups.has(group.company) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                                                            )}
                                                            <div className="flex-1">
                                                                <div className="flex items-center justify-between">
                                                                    <div className={cn(group.isGroup ? "text-base font-bold" : "font-medium")}>
                                                                        {group.name}
                                                                    </div>
                                                                    {!group.isGroup && (
                                                                        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            navigate(`/admin/customers/${group.customers[0].id}/ledger`);
                                                                        }}>
                                                                            <BarChart3 className="h-3.5 w-3.5 mr-1" /> Ledger
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                                {group.isGroup && (
                                                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                                                                        {group.customers.length} Individual{group.customers.length > 1 ? 's' : ''}
                                                                    </div>
                                                                )}
                                                                {!group.isGroup && <div className="text-[10px] lowercase text-muted-foreground">{group.customers[0]?.email}</div>}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex flex-wrap gap-1">
                                                                {Array.from(group.vehicles as Set<string>).map(v => (
                                                                    <Badge key={v} variant="secondary" className="text-[9px] py-0 font-mono">{v}</Badge>
                                                                ))}
                                                            </div>
                                                            {group.isGroup && (
                                                                <div className="text-[10px] text-muted-foreground italic">Company wide vehicles</div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-bold">{group.serviceCount}</TableCell>
                                                    <TableCell className="text-right">₹{group.totalInvoiced.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right text-green-600">₹{group.totalReceived.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right text-orange-600">₹{(group.totalDeductions || 0).toLocaleString()}</TableCell>
                                                    <TableCell className="text-right">
                                                        <span className={group.pendingAmount > 0 ? "text-red-600 font-bold" : "text-muted-foreground"}>
                                                            ₹{group.pendingAmount.toLocaleString()}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs">
                                                        {group.lastPaymentDate ? format(group.lastPaymentDate, 'MMM d, yyyy') : '-'}
                                                    </TableCell>
                                                </TableRow>

                                                {group.isGroup && expandedGroups.has(group.company) && group.customers.map((customer) => (
                                                    <TableRow key={customer.id} className="bg-muted/5">
                                                        <TableCell className="pl-10 font-medium border-l-2 border-primary/20">
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <div className="text-sm">{customer.name}</div>
                                                                    <div className="text-[10px] text-muted-foreground lowercase">{customer.email}</div>
                                                                </div>
                                                                <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => navigate(`/admin/customers/${customer.id}/ledger`)}>
                                                                    <BarChart3 className="h-3.5 w-3.5 mr-1" /> Ledger
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {Array.from(customer.vehicles as Set<string>).map(v => (
                                                                        <Badge key={v} variant="outline" className="text-[8px] py-0 font-mono bg-background">{v}</Badge>
                                                                    ))}
                                                                </div>
                                                                <div className="text-[9px] text-muted-foreground truncate max-w-[150px] font-mono">
                                                                    {customer.workOrders.slice(0, 3).map((wo: any) =>
                                                                        `${wo.type === 'quotation' ? 'QUO' : 'INV'}-${wo.bill_number || 'Draft'}`
                                                                    ).join(', ')}{customer.workOrders.length > 3 ? '...' : ''}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center">{customer.serviceCount}</TableCell>
                                                        <TableCell className="text-right">₹{customer.totalInvoiced.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right text-green-600">₹{customer.totalReceived.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right text-orange-600">₹{(customer.totalDeductions || 0).toLocaleString()}</TableCell>
                                                        <TableCell className="text-right">
                                                            <span className={customer.pendingAmount > 0 ? "text-red-600 font-bold" : "text-muted-foreground"}>
                                                                ₹{customer.pendingAmount.toLocaleString()}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs">
                                                            {customer.lastPaymentDate ? format(customer.lastPaymentDate, 'MMM d, yyyy') : '-'}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </>
                                        ))}
                                        {groupedCustomers.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                                    No results found matching criteria
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
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

            <RecordExpenseModal
                open={expenseModalOpen}
                onOpenChange={setExpenseModalOpen}
                onSubmit={addExpense}
            />
        </div>
    );
}
