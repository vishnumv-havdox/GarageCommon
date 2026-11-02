import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
    Truck, User, Calendar, Shield, Phone,
    FileText, ArrowLeft, Loader2, Info,
    Wrench, CheckCircle2, MapPin, ClipboardList,
    Clock, ExternalLink, Expand, Edit2, ImageIcon, Plus, Trash2,
    Receipt, Download, Printer, Filter, ShieldAlert, History,
    IndianRupee, Package, Search, Eye, AlertTriangle, Check, ArrowRight, X
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { generateVehicleHistoryPDF, generateInvoicePDF, parseNotes } from "@/utils/pdfGenerator";
import { HavDoxLoader } from "@/components/brand/HavDoxLoader";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Vehicle {
    id: string;
    vehicle_number: string;
    year?: number;
    color?: string;
    vin?: string;
    engine_number?: string;
    status: string;
    kilometers_driven?: number;
    next_service_km?: number;
    next_service_date?: string;
    fc_number?: string;
    fc_expiry_date?: string;
    customer_id: string;
    customer?: {
        name: string;
        phone?: string;
        email?: string;
        company_name?: string;
        address?: string;
    };
    vehicle_models?: {
        name: string;
        vehicle_manufacturers: { name: string };
        vehicle_types: {
            name: string;
            vehicle_categories: { name: string };
        };
    };
    photo_url?: string;
}

interface ServiceHistoryRecord {
    id: string;
    service_type: string;
    service_description: string;
    work_summary: string;
    status: string;
    service_date: string;
    delivery_date: string;
    approved_by: string;
    notes?: string;
    odometer_reading?: number;
    work_order_id: string;
    billed_amount?: number;
    paid_amount?: number;
    invoices?: Array<{
        id: string;
        invoice_number?: string;
        bill_number?: string;
        subtotal?: number;
        tax?: number;
        total?: number;
        total_deductions?: number;
        status?: string;
        created_at?: string;
        paid_at?: string;
        payment_links?: Array<{
            amount_applied: number;
            payment?: {
                id: string;
                amount: number;
                status: string;
                payment_method?: string;
                created_at?: string;
            };
        }>;
    }>;
    parts?: Array<{
        id: string;
        part_name: string;
        part_number: string;
        quantity: number;
        unit_price: number;
        total_price: number;
        status: string;
        date: string;
    }>;
    work_order?: {
        id: string;
        odometer_reading?: number;
        created_at?: string;
        advisor?: { name: string; phone?: string };
        driver?: { name: string; contact_number?: string };
        services: Array<{
            id: string;
            service_type: string;
            tasks: Array<{
                id: string;
                task_name: string;
                price: number;
                completed: boolean;
            }>;
        }>;
    };
}

interface FCRecord {
    id: string;
    fc_number: string;
    issue_date: string;
    expiry_date: string;
    notes?: string;
    created_at: string;
}

export default function AdminVehicleDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [history, setHistory] = useState<ServiceHistoryRecord[]>([]);
    const [fcHistory, setFcHistory] = useState<FCRecord[]>([]);
    const [companyProfile, setCompanyProfile] = useState<any>(null);
    const [activePhotoIndex, setActivePhotoIndex] = useState(0);
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Filter & Search states
    const [activeHistoryTab, setActiveHistoryTab] = useState<'all' | 'services' | 'bills' | 'parts' | 'fc'>('all');
    const [historySearch, setHistorySearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in_progress'>('all');
    const [dateFilter, setDateFilter] = useState<'all' | '30d' | '90d' | '1yr'>('all');

    // Bill format preview modal state
    const [viewingBillModal, setViewingBillModal] = useState<{ workOrder: any; invoice: any } | null>(null);

    const handleDeleteVehicle = async () => {
        if (!id) return;
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('vehicles').delete().eq('id', id);
            if (error) throw error;
            toast({ title: "Vehicle Deleted", description: "The vehicle was permanently removed from your garage registry." });
            navigate("/admin/vehicles");
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Cannot Delete Vehicle",
                description: err.message || "This vehicle cannot be deleted because it is linked to work orders or financial records."
            });
        } finally {
            setIsDeleting(false);
            setShowDeleteAlert(false);
        }
    };

    const fetchVehicleData = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("vehicles")
                .select(`
                    *,
                    customer:customers(*),
                    vehicle_models (
                        id,
                        name,
                        vehicle_manufacturers (name),
                        vehicle_types (
                            name,
                            vehicle_categories (name)
                        )
                    )
                `)
                .eq("id", id)
                .single();

            if (error) throw error;
            setVehicle(data as any);

            // Fetch Work Orders (History + Active) with full invoices and parts
            const { data: woData, error: woError } = await supabase
                .from("work_orders")
                .select(`
                    *,
                    advisor:employees!assigned_to(name, phone),
                    driver:drivers(name, contact_number),
                    services:work_order_services(
                        id,
                        service_type,
                        tasks:work_order_tasks(id, task_name, price, completed)
                    ),
                    invoices(
                        id,
                        invoice_number,
                        bill_number,
                        subtotal,
                        tax,
                        total,
                        total_deductions,
                        status,
                        created_at,
                        paid_at,
                        payment_links(amount_applied, payment:payments(id, amount, status, payment_method, created_at))
                    ),
                    part_requests(
                        id,
                        requested_qty,
                        issued_qty,
                        approved_qty,
                        status,
                        created_at,
                        inventory:inventory(item_name, brand_name, sku, unit_price, oem_part_number)
                    )
                `)
                .eq("vehicle_id", id)
                .order("created_at", { ascending: false });

            if (woError) throw woError;

            // Map work orders to ServiceHistoryRecord interface
            const formattedHistory: ServiceHistoryRecord[] = (woData || []).map((wo: any) => {
                let billedTotal = 0;
                let paidTotal = 0;

                (wo.invoices || []).forEach((inv: any) => {
                    const invTotal = inv.total || 0;
                    billedTotal += invTotal;
                    let invPaid = 0;
                    inv.payment_links?.forEach((link: any) => {
                        if (link.payment?.status === 'approved') {
                            invPaid += link.amount_applied || link.payment.amount || 0;
                        }
                    });
                    if (inv.status?.toLowerCase() === 'paid' && invPaid === 0) {
                        invPaid = invTotal;
                    }
                    paidTotal += Math.min(invTotal, invPaid);
                });

                const mappedParts = (wo.part_requests || []).map((pr: any) => ({
                    id: pr.id,
                    part_name: pr.inventory?.item_name || 'Replacement Part',
                    part_number: pr.inventory?.oem_part_number || pr.inventory?.sku || 'N/A',
                    quantity: pr.issued_qty || pr.approved_qty || pr.requested_qty || 1,
                    unit_price: pr.inventory?.unit_price || 0,
                    total_price: ((pr.issued_qty || pr.approved_qty || pr.requested_qty || 1) * (pr.inventory?.unit_price || 0)),
                    status: pr.status || 'used',
                    date: pr.created_at || wo.created_at
                }));

                return {
                    id: wo.id,
                    service_type: wo.service_type || 'General Service',
                    service_description: wo.description,
                    work_summary: wo.description,
                    status: wo.status,
                    service_date: wo.created_at,
                    delivery_date: wo.completed_at,
                    approved_by: wo.approved_by,
                    notes: wo.notes,
                    odometer_reading: wo.odometer_reading,
                    work_order_id: wo.id,
                    billed_amount: billedTotal,
                    paid_amount: paidTotal,
                    invoices: wo.invoices || [],
                    parts: mappedParts,
                    work_order: {
                        ...wo,
                        services: (wo.services || []).map((s: any) => ({
                            ...s,
                            tasks: (s.tasks || []).filter((t: any) => t.id)
                        }))
                    }
                };
            });

            setHistory(formattedHistory);

            // Fetch FC History records safely
            try {
                const { data: fcData } = await supabase
                    .from("vehicle_fc_history" as any)
                    .select("*")
                    .eq("vehicle_id", id)
                    .order("created_at", { ascending: false });

                if (fcData) setFcHistory(fcData as any);
            } catch (fcErr) {
                console.warn("Could not fetch vehicle_fc_history", fcErr);
            }

            // Fetch Company Profile for bill preview safely
            try {
                const { data: compProfile } = await supabase
                    .from("company_profiles" as any)
                    .select("*")
                    .order("updated_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (compProfile) setCompanyProfile(compProfile);
            } catch (cpErr) {
                console.warn("Could not fetch company profile", cpErr);
            }

        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
            navigate("/admin/vehicles");
        } finally {
            setLoading(false);
        }
    }, [id, navigate, toast]);

    useEffect(() => {
        fetchVehicleData();
    }, [fetchVehicleData]);

    // Flattened Invoices across all work orders
    const allInvoices = useMemo(() => {
        const list: any[] = [];
        history.forEach(record => {
            (record.invoices || []).forEach(inv => {
                let paidAmount = 0;
                inv.payment_links?.forEach((link: any) => {
                    if (link.payment?.status === 'approved') {
                        paidAmount += link.amount_applied || link.payment.amount || 0;
                    }
                });
                const billedTotal = inv.total || 0;
                if (inv.status?.toLowerCase() === 'paid' && paidAmount === 0) {
                    paidAmount = billedTotal;
                }
                const effectivePaid = Math.min(billedTotal, paidAmount);
                const balance = Math.max(0, billedTotal - effectivePaid);
                list.push({
                    ...inv,
                    work_order_id: record.work_order_id,
                    service_type: record.service_type,
                    service_description: record.service_description,
                    service_date: inv.created_at || record.service_date,
                    paid_amount: effectivePaid,
                    balance_amount: balance,
                    work_order: record.work_order
                });
            });
        });
        return list;
    }, [history]);

    // Flattened Parts across all work orders
    const allParts = useMemo(() => {
        const list: any[] = [];
        history.forEach(record => {
            (record.parts || []).forEach(part => {
                list.push({
                    ...part,
                    work_order_id: record.work_order_id,
                    service_type: record.service_type,
                    service_date: record.service_date
                });
            });
        });
        return list;
    }, [history]);

    // Summary Metrics
    const totalServices = history.length;
    const totalBilled = allInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const totalPaid = allInvoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
    const totalBalance = Math.max(0, totalBilled - totalPaid);
    const totalPartsCount = allParts.length;

    // Currency formatter helper with proper decimal handling (e.g. ₹133.20 instead of ₹133.2)
    const formatCurrency = (val: number | string | undefined | null) => {
        const num = Number(val) || 0;
        return num.toLocaleString('en-IN', {
            minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
            maximumFractionDigits: 2
        });
    };

    // Date filter helper
    const isWithinDateFilter = (dateStr: string) => {
        if (!dateStr || dateFilter === 'all') return true;
        const d = new Date(dateStr).getTime();
        const now = Date.now();
        if (dateFilter === '30d') return now - d <= 30 * 24 * 60 * 60 * 1000;
        if (dateFilter === '90d') return now - d <= 90 * 24 * 60 * 60 * 1000;
        if (dateFilter === '1yr') return now - d <= 365 * 24 * 60 * 60 * 1000;
        return true;
    };

    // Filtered Services / History records
    const filteredHistory = useMemo(() => {
        return history.filter(record => {
            if (!isWithinDateFilter(record.service_date)) return false;
            if (statusFilter === 'completed' && !['Completed', 'Delivered', 'Finalized'].includes(record.status)) return false;
            if (statusFilter === 'in_progress' && ['Completed', 'Delivered', 'Finalized'].includes(record.status)) return false;

            if (historySearch.trim()) {
                const q = historySearch.toLowerCase();
                const matchType = (record.service_type || '').toLowerCase().includes(q);
                const matchDesc = (record.service_description || '').toLowerCase().includes(q);
                const matchSummary = (record.work_summary || '').toLowerCase().includes(q);
                const matchAdvisor = (record.work_order?.advisor?.name || '').toLowerCase().includes(q);
                const matchDriver = (record.work_order?.driver?.name || '').toLowerCase().includes(q);
                const matchTasks = (record.work_order?.services || []).some(s =>
                    (s.tasks || []).some(t => t.task_name.toLowerCase().includes(q))
                );
                const matchInvoices = (record.invoices || []).some(inv =>
                    (inv.invoice_number || '').toLowerCase().includes(q) ||
                    (inv.bill_number || '').toLowerCase().includes(q)
                );
                const matchParts = (record.parts || []).some(p =>
                    p.part_name.toLowerCase().includes(q) || p.part_number.toLowerCase().includes(q)
                );
                if (!matchType && !matchDesc && !matchSummary && !matchAdvisor && !matchDriver && !matchTasks && !matchInvoices && !matchParts) {
                    return false;
                }
            }
            return true;
        });
    }, [history, dateFilter, statusFilter, historySearch]);

    // Filtered Invoices
    const filteredInvoices = useMemo(() => {
        return allInvoices.filter(inv => {
            if (!isWithinDateFilter(inv.service_date)) return false;
            if (statusFilter === 'completed' && inv.balance_amount > 0) return false;
            if (statusFilter === 'in_progress' && inv.balance_amount === 0) return false;
            if (historySearch.trim()) {
                const q = historySearch.toLowerCase();
                const matchNum = (inv.invoice_number || '').toLowerCase().includes(q) ||
                    (inv.bill_number || '').toLowerCase().includes(q);
                const matchType = (inv.service_type || '').toLowerCase().includes(q);
                const matchDesc = (inv.service_description || '').toLowerCase().includes(q);
                if (!matchNum && !matchType && !matchDesc) return false;
            }
            return true;
        });
    }, [allInvoices, dateFilter, statusFilter, historySearch]);

    // Filtered Parts
    const filteredParts = useMemo(() => {
        return allParts.filter(part => {
            if (!isWithinDateFilter(part.service_date)) return false;
            if (historySearch.trim()) {
                const q = historySearch.toLowerCase();
                const matchName = part.part_name.toLowerCase().includes(q);
                const matchNum = part.part_number.toLowerCase().includes(q);
                const matchType = (part.service_type || '').toLowerCase().includes(q);
                if (!matchName && !matchNum && !matchType) return false;
            }
            return true;
        });
    }, [allParts, dateFilter, historySearch]);

    // Filtered FC Records
    const filteredFcHistory = useMemo(() => {
        return fcHistory.filter(fc => {
            if (!isWithinDateFilter(fc.issue_date || fc.created_at)) return false;
            if (historySearch.trim()) {
                const q = historySearch.toLowerCase();
                const matchNum = (fc.fc_number || '').toLowerCase().includes(q);
                const matchNotes = (fc.notes || '').toLowerCase().includes(q);
                if (!matchNum && !matchNotes) return false;
            }
            return true;
        });
    }, [fcHistory, dateFilter, historySearch]);

    if (loading) {
        return (
            <HavDoxLoader
                variant="fullscreen"
                message="Loading vehicle records..."
            />
        );
    }

    if (!vehicle) return null;

    return (
        <div className="min-h-screen bg-background">
            <div className="flex flex-col lg:flex-row">
                <AdminSidebar />
                <main className="flex-1 p-4 lg:p-8">
                    {/* Back Button & Header */}
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
                        <div>
                            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/vehicles")} className="mb-2">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Vehicles
                            </Button>
                            <div className="flex items-center gap-4">
                                <div>
                                    <h1 className="text-3xl font-bold">{vehicle.vehicle_number}</h1>
                                    <p className="text-muted-foreground">
                                        {vehicle.vehicle_models?.vehicle_manufacturers?.name} {vehicle.vehicle_models?.name} ({vehicle.year || 'N/A'})
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button 
                                onClick={() => navigate(`/admin/work-orders?create=true&vehicleId=${vehicle.id}&customerId=${vehicle.customer_id || vehicle.customer?.id || ''}`)}
                                className="gap-1.5 font-semibold bg-primary hover:bg-primary/90"
                            >
                                <Plus className="h-4 w-4" />
                                Create Job Card
                            </Button>
                            <Button 
                                onClick={() => id && generateVehicleHistoryPDF(id, 'save')} 
                                variant="outline"
                                className="gap-1.5"
                            >
                                <Download className="h-4 w-4" />
                                Download PDF
                            </Button>
                            <Button 
                                onClick={() => id && generateVehicleHistoryPDF(id, 'preview')} 
                                variant="outline"
                                className="gap-1.5"
                            >
                                <Printer className="h-4 w-4" />
                                Print History
                            </Button>
                            <Link to={`/admin/vehicles?edit=${vehicle.id}`}>
                                <Button variant="outline">Edit Vehicle</Button>
                            </Link>
                            <Button 
                                variant="outline" 
                                onClick={() => setShowDeleteAlert(true)}
                                className="text-destructive hover:bg-destructive/10 border-destructive/20 gap-1.5"
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete Vehicle
                            </Button>
                        </div>
                    </div>

                    {/* Image Gallery Section */}
                    {((vehicle.photos && vehicle.photos.length > 0) || vehicle.photo_url) && (
                        <Card className="mb-8 overflow-hidden">
                            <div className="flex flex-col md:flex-row">
                                {/* Main Image */}
                                <div className="relative md:w-2/3 h-[400px] bg-muted/30 group">
                                    <img 
                                        src={vehicle.photos?.[activePhotoIndex] || vehicle.photo_url} 
                                        alt="Vehicle Primary" 
                                        className="w-full h-full object-contain bg-black/5"
                                    />
                                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="secondary" size="icon" className="shadow-md" onClick={() => window.open(vehicle.photos?.[activePhotoIndex] || vehicle.photo_url, '_blank')}>
                                            <Expand className="h-4 w-4" />
                                        </Button>
                                        <Link to={`/admin/vehicles?edit=${vehicle.id}`}>
                                            <Button variant="secondary" size="icon" className="shadow-md">
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                    </div>
                                    <div className="absolute bottom-4 left-4">
                                        <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-xs font-bold shadow-sm">
                                            <ImageIcon className="h-3 w-3 mr-1" />
                                            Photo {activePhotoIndex + 1} of {(vehicle.photos?.length || 1)}
                                        </Badge>
                                    </div>
                                </div>
                                
                                {/* Thumbnails */}
                                {vehicle.photos && vehicle.photos.length > 1 && (
                                    <div className="md:w-1/3 p-4 bg-muted/10 border-t md:border-t-0 md:border-l overflow-y-auto max-h-[400px]">
                                        <h3 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wider">All Photos</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
                                            {vehicle.photos.map((photo, i) => (
                                                <div 
                                                    key={i} 
                                                    onClick={() => setActivePhotoIndex(i)}
                                                    className={`cursor-pointer aspect-[4/3] rounded overflow-hidden border-2 transition-all ${activePhotoIndex === i ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                                >
                                                    <img src={photo} alt={`Gallery ${i+1}`} className="h-full w-full object-cover" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                        {/* Vehicle Info Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Info className="h-4 w-4" />
                                    Vehicle Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase font-semibold">Type</p>
                                        <p className="text-sm font-medium">{vehicle.vehicle_models?.vehicle_types?.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase font-semibold">Category</p>
                                        <p className="text-sm font-medium">{vehicle.vehicle_models?.vehicle_types?.vehicle_categories?.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase font-semibold">Color</p>
                                        <p className="text-sm font-medium">{vehicle.color || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase font-semibold">Status</p>
                                        <Badge variant={vehicle.status === 'Active' ? 'default' : 'secondary'}>{vehicle.status}</Badge>
                                    </div>
                                </div>
                                <Separator />
                                <div className="space-y-2">
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase font-semibold">VIN / Frame No</p>
                                        <p className="text-sm font-mono">{vehicle.vin || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase font-semibold">Engine Number</p>
                                        <p className="text-sm font-mono">{vehicle.engine_number || 'N/A'}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Owner Info Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Owner Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <h3 className="font-bold text-lg">{vehicle.customer?.name}</h3>
                                    {vehicle.customer?.company_name && (
                                        <p className="text-sm text-primary font-medium">{vehicle.customer.company_name}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        <span>{vehicle.customer?.phone || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <span>{vehicle.customer?.email || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-sm">
                                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                                        <span className="leading-tight">{vehicle.customer?.address || 'N/A'}</span>
                                    </div>
                                </div>
                                <Separator />
                                <Link to={`/admin/customers/${vehicle.customer_id}/ledger`}>
                                    <Button variant="outline" size="sm" className="w-full">View Customer Ledger</Button>
                                </Link>
                            </CardContent>
                        </Card>

                        {/* Odometer & FC Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Shield className="h-4 w-4" />
                                    Odometer & FC Status
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-3 bg-muted/50 rounded-lg">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm font-medium">Current Odometer</span>
                                        <span className="text-lg font-bold">{vehicle.kilometers_driven?.toLocaleString() || '0'} KM</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-muted-foreground">Next Service @</span>
                                        <span className="font-semibold">{vehicle.next_service_km ? `${vehicle.next_service_km.toLocaleString()} KM` : 'N/A'}</span>
                                    </div>
                                </div>

                                <Separator />

                                <div className="space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase font-semibold">FC Number</p>
                                            <p className="text-sm font-medium">{vehicle.fc_number || 'N/A'}</p>
                                        </div>
                                        {vehicle.fc_expiry_date && (
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground uppercase font-semibold">FC Expiry</p>
                                                <p className={`text-sm font-bold ${new Date(vehicle.fc_expiry_date) < new Date() ? 'text-destructive' : 'text-foreground'}`}>
                                                    {format(new Date(vehicle.fc_expiry_date), "PP")}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    {vehicle.fc_expiry_date && new Date(vehicle.fc_expiry_date) < new Date() && (
                                        <Badge variant="destructive" className="w-full justify-center">FC EXPIRED</Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Service History Section */}
                    <div id="service-history" className="space-y-6">
                        {/* Section Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <ClipboardList className="h-6 w-6 text-primary" />
                                    Complete Vehicle History & Service Dossier
                                </h2>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    Comprehensive record of job cards, service dates, bills, spare parts, and FC renewals for {vehicle.vehicle_number}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs px-2.5 py-1 bg-muted/50">
                                    {history.length} Total Services
                                </Badge>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => id && generateVehicleHistoryPDF(id, 'save')}
                                    className="gap-1.5 text-xs font-semibold text-primary border-primary/20 hover:bg-primary/5"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    Download History PDF
                                </Button>
                            </div>
                        </div>

                        {/* KPI Metrics Summary Strip */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            <Card className="bg-card/50 border shadow-sm">
                                <CardContent className="p-4 flex flex-col justify-between h-full">
                                    <div className="flex items-center justify-between text-muted-foreground mb-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider">Services Done</span>
                                        <Wrench className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{totalServices}</p>
                                        <p className="text-[11px] text-muted-foreground">Work orders</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-card/50 border shadow-sm">
                                <CardContent className="p-4 flex flex-col justify-between h-full">
                                    <div className="flex items-center justify-between text-muted-foreground mb-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider">Total Billed</span>
                                        <Receipt className="h-4 w-4 text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-foreground">₹{formatCurrency(totalBilled)}</p>
                                        <p className="text-[11px] text-muted-foreground">{allInvoices.length} invoices generated</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-card/50 border shadow-sm">
                                <CardContent className="p-4 flex flex-col justify-between h-full">
                                    <div className="flex items-center justify-between text-muted-foreground mb-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider">Total Paid</span>
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-emerald-600">₹{formatCurrency(totalPaid)}</p>
                                        <p className="text-[11px] text-muted-foreground">Settled collections</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className={`border shadow-sm ${totalBalance > 0 ? 'bg-amber-500/5 border-amber-500/30' : 'bg-card/50'}`}>
                                <CardContent className="p-4 flex flex-col justify-between h-full">
                                    <div className="flex items-center justify-between text-muted-foreground mb-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider">Balance Due</span>
                                        <IndianRupee className={`h-4 w-4 ${totalBalance > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
                                    </div>
                                    <div>
                                        <p className={`text-2xl font-bold ${totalBalance > 0 ? 'text-amber-600' : 'text-foreground'}`}>
                                            ₹{formatCurrency(totalBalance)}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">
                                            {totalBalance > 0 ? 'Outstanding balance' : 'Zero balance'}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-card/50 border shadow-sm">
                                <CardContent className="p-4 flex flex-col justify-between h-full">
                                    <div className="flex items-center justify-between text-muted-foreground mb-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider">Parts Fitted</span>
                                        <Package className="h-4 w-4 text-purple-500" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{totalPartsCount}</p>
                                        <p className="text-[11px] text-muted-foreground">Items replaced</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-card/50 border shadow-sm">
                                <CardContent className="p-4 flex flex-col justify-between h-full">
                                    <div className="flex items-center justify-between text-muted-foreground mb-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider">FC Validity</span>
                                        <ShieldAlert className={`h-4 w-4 ${vehicle.fc_expiry_date && new Date(vehicle.fc_expiry_date) < new Date() ? 'text-destructive' : 'text-teal-500'}`} />
                                    </div>
                                    <div>
                                        {vehicle.fc_expiry_date ? (
                                            <>
                                                <p className={`text-base font-bold ${new Date(vehicle.fc_expiry_date) < new Date() ? 'text-destructive' : 'text-teal-600'}`}>
                                                    {format(new Date(vehicle.fc_expiry_date), "dd MMM yyyy")}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {new Date(vehicle.fc_expiry_date) < new Date() ? 'Expired' : 'Active Certificate'}
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-base font-semibold text-muted-foreground">Not Recorded</p>
                                                <p className="text-[11px] text-muted-foreground">No FC on file</p>
                                            </>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Filter Toolbar & Tab Navigation */}
                        <div className="bg-card border rounded-xl p-4 shadow-sm space-y-4">
                            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                                {/* Real-time Search */}
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by invoice #, bill #, tasks, parts, FC numbers, notes, advisor..."
                                        value={historySearch}
                                        onChange={(e) => setHistorySearch(e.target.value)}
                                        className="pl-9 h-10 bg-background"
                                    />
                                    {historySearch && (
                                        <button
                                            onClick={() => setHistorySearch("")}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            title="Clear search"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Date Filter & Status Filter Controls */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                        <Filter className="h-4 w-4 text-muted-foreground hidden sm:inline" />
                                        <Select value={dateFilter} onValueChange={(val: any) => setDateFilter(val)}>
                                            <SelectTrigger className="w-[130px] h-10 text-xs">
                                                <SelectValue placeholder="Date Range" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Time</SelectItem>
                                                <SelectItem value="30d">Last 30 Days</SelectItem>
                                                <SelectItem value="90d">Last 90 Days</SelectItem>
                                                <SelectItem value="1yr">Past 1 Year</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                                        <SelectTrigger className="w-[150px] h-10 text-xs">
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Statuses</SelectItem>
                                            <SelectItem value="completed">Completed / Settled</SelectItem>
                                            <SelectItem value="in_progress">In Progress / Pending</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {(historySearch || dateFilter !== 'all' || statusFilter !== 'all') && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setHistorySearch("");
                                                setDateFilter("all");
                                                setStatusFilter("all");
                                            }}
                                            className="h-10 text-xs text-muted-foreground hover:text-foreground"
                                        >
                                            Reset Filters
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Navigation Tabs */}
                            <Tabs value={activeHistoryTab} onValueChange={(val: any) => setActiveHistoryTab(val)} className="w-full">
                                <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full h-auto p-1 bg-muted/60">
                                    <TabsTrigger value="all" className="py-2 text-xs font-medium gap-1.5">
                                        <ClipboardList className="h-3.5 w-3.5" />
                                        <span>All History</span>
                                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{filteredHistory.length}</Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="services" className="py-2 text-xs font-medium gap-1.5">
                                        <Wrench className="h-3.5 w-3.5" />
                                        <span>Services & Jobs</span>
                                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{filteredHistory.length}</Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="bills" className="py-2 text-xs font-medium gap-1.5">
                                        <Receipt className="h-3.5 w-3.5" />
                                        <span>Bills & Invoices</span>
                                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{filteredInvoices.length}</Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="parts" className="py-2 text-xs font-medium gap-1.5">
                                        <Package className="h-3.5 w-3.5" />
                                        <span>Parts Replaced</span>
                                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{filteredParts.length}</Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="fc" className="py-2 text-xs font-medium gap-1.5">
                                        <Shield className="h-3.5 w-3.5" />
                                        <span>FC Renewals</span>
                                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{filteredFcHistory.length}</Badge>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        {/* Tab 1: All History */}
                        {activeHistoryTab === 'all' && (
                            <div className="space-y-6">
                                {filteredHistory.length === 0 ? (
                                    <Card>
                                        <CardContent className="py-12 text-center text-muted-foreground space-y-2">
                                            <p className="text-base font-medium">No service records match the selected filters.</p>
                                            <p className="text-xs">Try clearing search terms or changing date filters.</p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    filteredHistory.map((record) => {
                                        const mainInvoice = record.invoices?.[0];
                                        const recordBalance = Math.max(0, (record.billed_amount || 0) - (record.paid_amount || 0));

                                        return (
                                            <Card key={record.id} className="overflow-hidden border-l-4 border-l-primary shadow-sm hover:shadow transition-shadow">
                                                <div className="bg-muted/30 p-4 border-b flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                            <Badge variant="default" className="font-semibold">{record.service_type}</Badge>
                                                            <span className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                                                                <Calendar className="h-3.5 w-3.5" />
                                                                {format(new Date(record.service_date), "PPP")}
                                                            </span>
                                                            {record.odometer_reading ? (
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {record.odometer_reading.toLocaleString('en-IN')} km
                                                                </Badge>
                                                            ) : null}
                                                        </div>
                                                        <h3 className="font-bold text-lg text-foreground">{record.service_description || 'General Service'}</h3>
                                                    </div>

                                                    <div className="flex flex-col lg:items-end gap-2 w-full lg:w-auto">
                                                        <div className="flex items-center gap-2">
                                                            {['Completed', 'Delivered', 'Finalized'].includes(record.status) ? (
                                                                <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 gap-1">
                                                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                                                    {record.status}
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-orange-600 border-orange-500/30 bg-orange-500/10 gap-1">
                                                                    <Clock className="h-3.5 w-3.5 text-orange-600" />
                                                                    {record.status}
                                                                </Badge>
                                                            )}
                                                            {record.delivery_date && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    Delivered: {format(new Date(record.delivery_date), "PP")}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Bill & PDF Action Pill */}
                                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                                            {(record.billed_amount || 0) > 0 && (
                                                                <div className="text-xs flex items-center gap-2 px-2.5 py-1 bg-background border rounded-md">
                                                                    <span className="text-muted-foreground">Billed: <strong className="text-foreground">₹{formatCurrency(record.billed_amount)}</strong></span>
                                                                    <span className="text-muted-foreground">Paid: <strong className="text-emerald-600">₹{formatCurrency(record.paid_amount)}</strong></span>
                                                                    {recordBalance > 0 && (
                                                                        <span className="text-amber-600 font-medium">Bal: ₹{formatCurrency(recordBalance)}</span>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {mainInvoice && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="secondary"
                                                                    onClick={() => setViewingBillModal({ workOrder: record.work_order, invoice: mainInvoice })}
                                                                    className="h-7 text-xs gap-1 font-semibold"
                                                                >
                                                                    <Eye className="h-3 w-3" />
                                                                    View Bill
                                                                </Button>
                                                            )}

                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => generateInvoicePDF(record.work_order_id, 'save')}
                                                                className="h-7 text-xs gap-1"
                                                                title="Download Invoice PDF"
                                                            >
                                                                <Download className="h-3 w-3" />
                                                                Bill PDF
                                                            </Button>

                                                            <Link
                                                                to={`/admin/work-orders/${record.work_order_id}`}
                                                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium ml-1"
                                                            >
                                                                Job Card <ExternalLink className="h-3 w-3" />
                                                            </Link>
                                                        </div>
                                                    </div>
                                                </div>

                                                <CardContent className="p-0">
                                                    <div className="grid grid-cols-1 md:grid-cols-12">
                                                        {/* Left: Personnel & Summary */}
                                                        <div className="md:col-span-5 p-6 space-y-5 border-r">
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-1">
                                                                    <p className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1">
                                                                        <FileText className="h-3 w-3" /> Advisor
                                                                    </p>
                                                                    <p className="font-bold text-sm">{record.work_order?.advisor?.name || 'Unassigned'}</p>
                                                                    {record.work_order?.advisor?.phone && (
                                                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                            <Phone className="h-3 w-3" /> {record.work_order.advisor.phone}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <p className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1">
                                                                        <Truck className="h-3 w-3" /> Driver / Contact
                                                                    </p>
                                                                    <p className="font-bold text-sm">{record.work_order?.driver?.name || 'N/A'}</p>
                                                                    {record.work_order?.driver?.contact_number && (
                                                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                            <Phone className="h-3 w-3" /> {record.work_order.driver.contact_number}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <Separator />

                                                            <div className="space-y-1">
                                                                <p className="text-xs text-muted-foreground uppercase font-semibold">Workflow Summary</p>
                                                                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 italic">
                                                                    "{parseNotes(record.work_summary) || 'No summary notes entered for this job.'}"
                                                                </p>
                                                            </div>

                                                            {record.notes && (
                                                                <div className="p-3 bg-muted/60 rounded-md">
                                                                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Technician / Workshop Notes</p>
                                                                    <p className="text-xs leading-relaxed">{parseNotes(record.notes)}</p>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Right: Detailed Service Tasks & Parts */}
                                                        <div className="md:col-span-7 p-6 bg-muted/10 space-y-6">
                                                            {/* Performed Tasks */}
                                                            <div>
                                                                <p className="text-xs text-muted-foreground uppercase font-semibold mb-3 flex items-center gap-1">
                                                                    <Wrench className="h-3 w-3 text-primary" /> Performed Services & Tasks
                                                                </p>
                                                                <div className="space-y-4">
                                                                    {record.work_order?.services && record.work_order.services.length > 0 ? (
                                                                        record.work_order.services.map((service, idx) => (
                                                                            <div key={service.id || idx} className="space-y-2">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                                                                    <h4 className="font-bold text-xs uppercase tracking-wider">{service.service_type}</h4>
                                                                                </div>
                                                                                <div className="pl-4 grid grid-cols-1 md:grid-cols-2 gap-y-1.5 gap-x-4">
                                                                                    {service.tasks.map((task) => (
                                                                                        <div key={task.id} className="flex items-center justify-between text-xs py-1 border-b border-muted last:border-0">
                                                                                            <span className="text-muted-foreground">{task.task_name}</span>
                                                                                            <div className="flex items-center gap-2">
                                                                                                {task.price > 0 && <span className="font-semibold text-xs">₹{task.price}</span>}
                                                                                                {task.completed ? (
                                                                                                    <Badge variant="outline" className="h-4 px-1 text-[10px] bg-green-500/10 text-green-600 border-green-500/20">Done</Badge>
                                                                                                ) : (
                                                                                                    <Badge variant="outline" className="h-4 px-1 text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/20">Pending</Badge>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <div className="text-xs text-muted-foreground italic bg-muted/30 p-3 rounded text-center">
                                                                            No itemized tasks recorded for this session.
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Replacement Parts Used */}
                                                            {record.parts && record.parts.length > 0 && (
                                                                <div className="pt-2 border-t border-muted/80">
                                                                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-2 flex items-center gap-1">
                                                                        <Package className="h-3 w-3 text-purple-500" /> Replacement Parts Issued ({record.parts.length})
                                                                    </p>
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                        {record.parts.map((part) => (
                                                                            <div key={part.id} className="p-2.5 bg-background border rounded-md text-xs flex justify-between items-center">
                                                                                <div>
                                                                                    <p className="font-medium text-foreground">{part.part_name}</p>
                                                                                    <p className="text-[10px] text-muted-foreground">OEM: {part.part_number} • Qty: {part.quantity}</p>
                                                                                </div>
                                                                                <span className="font-bold text-foreground">₹{part.total_price.toLocaleString('en-IN')}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* Tab 2: Services & Jobs */}
                        {activeHistoryTab === 'services' && (
                            <div className="space-y-4">
                                {filteredHistory.length === 0 ? (
                                    <Card>
                                        <CardContent className="py-12 text-center text-muted-foreground">
                                            No services found for the selected filters.
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {filteredHistory.map((record) => (
                                            <Card key={record.id} className="border hover:shadow-md transition-shadow">
                                                <CardHeader className="pb-3">
                                                    <div className="flex items-center justify-between">
                                                        <Badge>{record.service_type}</Badge>
                                                        <Badge variant="outline">{record.status}</Badge>
                                                    </div>
                                                    <CardTitle className="text-base mt-2">{record.service_description || 'General Service'}</CardTitle>
                                                    <CardDescription className="text-xs flex items-center gap-2">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        {format(new Date(record.service_date), "PPP")}
                                                        {record.odometer_reading ? ` • ${record.odometer_reading.toLocaleString()} km` : ''}
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent className="space-y-3 pt-0">
                                                    <div className="text-xs space-y-1.5 bg-muted/30 p-2.5 rounded-md">
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Advisor:</span>
                                                            <span className="font-medium">{record.work_order?.advisor?.name || 'Unassigned'}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Driver:</span>
                                                            <span className="font-medium">{record.work_order?.driver?.name || 'N/A'}</span>
                                                        </div>
                                                        {record.delivery_date && (
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Delivered:</span>
                                                                <span className="font-medium">{format(new Date(record.delivery_date), "PP")}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Tasks List */}
                                                    <div className="space-y-1">
                                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase">Service Tasks ({record.work_order?.services?.reduce((acc, s) => acc + (s.tasks?.length || 0), 0) || 0})</p>
                                                        <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                                                            {record.work_order?.services?.flatMap((s) => s.tasks || []).map((task) => (
                                                                <div key={task.id} className="flex justify-between text-xs py-1 border-b border-muted last:border-0">
                                                                    <span className="text-muted-foreground truncate max-w-[200px]">{task.task_name}</span>
                                                                    <div className="flex items-center gap-1.5">
                                                                        {task.price > 0 && <span className="font-medium">₹{task.price}</span>}
                                                                        {task.completed ? (
                                                                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                                                        ) : (
                                                                            <Clock className="h-3.5 w-3.5 text-orange-500" />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between pt-2 border-t">
                                                        <span className="text-xs font-semibold">
                                                            Total: ₹{(record.billed_amount || 0).toLocaleString('en-IN')}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => generateInvoicePDF(record.work_order_id, 'save')}
                                                                className="h-7 text-xs gap-1"
                                                            >
                                                                <Download className="h-3 w-3" />
                                                                PDF
                                                            </Button>
                                                            <Link to={`/admin/work-orders/${record.work_order_id}`}>
                                                                <Button size="sm" variant="default" className="h-7 text-xs gap-1">
                                                                    Open Job Card <ExternalLink className="h-3 w-3" />
                                                                </Button>
                                                            </Link>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab 3: Bills & Invoices */}
                        {activeHistoryTab === 'bills' && (
                            <div className="space-y-4">
                                {filteredInvoices.length === 0 ? (
                                    <Card>
                                        <CardContent className="py-12 text-center text-muted-foreground space-y-1">
                                            <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                                            <p className="text-base font-semibold">No invoices found for this vehicle.</p>
                                            <p className="text-xs">Invoices generated for completed or in-progress work orders will appear here.</p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <Card className="overflow-hidden border shadow-sm">
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader className="bg-muted/50">
                                                    <TableRow>
                                                        <TableHead className="font-bold">Bill / Invoice #</TableHead>
                                                        <TableHead className="font-bold">Date</TableHead>
                                                        <TableHead className="font-bold">Service Session</TableHead>
                                                        <TableHead className="font-bold text-right">Subtotal</TableHead>
                                                        <TableHead className="font-bold text-right">Tax</TableHead>
                                                        <TableHead className="font-bold text-right">Net Total</TableHead>
                                                        <TableHead className="font-bold text-right">Paid</TableHead>
                                                        <TableHead className="font-bold text-right">Balance</TableHead>
                                                        <TableHead className="font-bold text-center">Payment Status</TableHead>
                                                        <TableHead className="font-bold text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredInvoices.map((inv) => (
                                                        <TableRow key={inv.id} className="hover:bg-muted/20">
                                                            <TableCell className="font-mono font-bold text-primary">
                                                                {inv.bill_number || inv.invoice_number || `INV-${inv.id.slice(0, 6).toUpperCase()}`}
                                                            </TableCell>
                                                            <TableCell className="text-xs whitespace-nowrap">
                                                                {format(new Date(inv.service_date), "dd MMM yyyy")}
                                                            </TableCell>
                                                            <TableCell className="text-xs">
                                                                <span className="font-medium text-foreground">{inv.service_type}</span>
                                                                <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{inv.service_description}</p>
                                                            </TableCell>
                                                            <TableCell className="text-xs text-right">₹{formatCurrency(inv.subtotal)}</TableCell>
                                                            <TableCell className="text-xs text-right">₹{formatCurrency(inv.tax)}</TableCell>
                                                            <TableCell className="text-xs font-bold text-right text-foreground">₹{formatCurrency(inv.total)}</TableCell>
                                                            <TableCell className="text-xs font-semibold text-right text-emerald-600">₹{formatCurrency(inv.paid_amount)}</TableCell>
                                                            <TableCell className="text-xs font-bold text-right">
                                                                {inv.balance_amount > 0 ? (
                                                                    <span className="text-amber-600">₹{formatCurrency(inv.balance_amount)}</span>
                                                                ) : (
                                                                    <span className="text-muted-foreground">₹0</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                {inv.balance_amount === 0 ? (
                                                                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">PAID</Badge>
                                                                ) : inv.paid_amount > 0 ? (
                                                                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">PARTIAL</Badge>
                                                                ) : (
                                                                    <Badge variant="destructive" className="text-[10px]">UNPAID</Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="secondary"
                                                                        onClick={() => setViewingBillModal({ workOrder: inv.work_order, invoice: inv })}
                                                                        className="h-8 text-xs gap-1 font-semibold"
                                                                        title="View Bill Format"
                                                                    >
                                                                        <Eye className="h-3.5 w-3.5" />
                                                                        View Bill
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => generateInvoicePDF(inv.work_order_id, 'save')}
                                                                        className="h-8 text-xs gap-1"
                                                                        title="Download Bill PDF"
                                                                    >
                                                                        <Download className="h-3.5 w-3.5" />
                                                                        PDF
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => generateInvoicePDF(inv.work_order_id, 'preview')}
                                                                        className="h-8 w-8 p-0"
                                                                        title="Print Bill"
                                                                    >
                                                                        <Printer className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </Card>
                                )}
                            </div>
                        )}

                        {/* Tab 4: Parts Replaced */}
                        {activeHistoryTab === 'parts' && (
                            <div className="space-y-4">
                                {filteredParts.length === 0 ? (
                                    <Card>
                                        <CardContent className="py-12 text-center text-muted-foreground space-y-1">
                                            <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                                            <p className="text-base font-semibold">No replacement parts recorded.</p>
                                            <p className="text-xs">Spare parts issued from inventory for this vehicle will be listed here.</p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <Card className="overflow-hidden border shadow-sm">
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader className="bg-muted/50">
                                                    <TableRow>
                                                        <TableHead className="font-bold">Part Name</TableHead>
                                                        <TableHead className="font-bold">OEM / SKU</TableHead>
                                                        <TableHead className="font-bold">Service Date</TableHead>
                                                        <TableHead className="font-bold">Service Type</TableHead>
                                                        <TableHead className="font-bold text-right">Quantity</TableHead>
                                                        <TableHead className="font-bold text-right">Unit Rate</TableHead>
                                                        <TableHead className="font-bold text-right">Total Price</TableHead>
                                                        <TableHead className="font-bold text-right">Work Order</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredParts.map((part) => (
                                                        <TableRow key={part.id} className="hover:bg-muted/20">
                                                            <TableCell className="font-semibold text-foreground text-xs">
                                                                {part.part_name}
                                                            </TableCell>
                                                            <TableCell className="font-mono text-xs text-muted-foreground">
                                                                {part.part_number}
                                                            </TableCell>
                                                            <TableCell className="text-xs whitespace-nowrap">
                                                                {format(new Date(part.service_date), "dd MMM yyyy")}
                                                            </TableCell>
                                                            <TableCell className="text-xs">
                                                                <Badge variant="outline">{part.service_type}</Badge>
                                                            </TableCell>
                                                            <TableCell className="text-xs text-right font-medium">{part.quantity}</TableCell>
                                                            <TableCell className="text-xs text-right">₹{part.unit_price.toLocaleString('en-IN')}</TableCell>
                                                            <TableCell className="text-xs font-bold text-right text-foreground">
                                                                ₹{part.total_price.toLocaleString('en-IN')}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Link to={`/admin/work-orders/${part.work_order_id}`}>
                                                                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary">
                                                                        View <ExternalLink className="h-3 w-3" />
                                                                    </Button>
                                                                </Link>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </Card>
                                )}
                            </div>
                        )}

                        {/* Tab 5: FC Renewals */}
                        {activeHistoryTab === 'fc' && (
                            <div className="space-y-4">
                                {filteredFcHistory.length === 0 ? (
                                    <Card>
                                        <CardContent className="py-12 text-center text-muted-foreground space-y-1">
                                            <Shield className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                                            <p className="text-base font-semibold">No FC renewal logs found.</p>
                                            <p className="text-xs">Historical fitness certificate inspections and renewals will be tracked here.</p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <Card className="overflow-hidden border shadow-sm">
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader className="bg-muted/50">
                                                    <TableRow>
                                                        <TableHead className="font-bold">FC Certificate #</TableHead>
                                                        <TableHead className="font-bold">Issue Date</TableHead>
                                                        <TableHead className="font-bold">Expiry Date</TableHead>
                                                        <TableHead className="font-bold">Validity Status</TableHead>
                                                        <TableHead className="font-bold">Notes & Inspection Details</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredFcHistory.map((fc) => {
                                                        const isExpired = new Date(fc.expiry_date) < new Date();
                                                        return (
                                                            <TableRow key={fc.id} className="hover:bg-muted/20">
                                                                <TableCell className="font-mono font-bold text-primary text-xs">
                                                                    {fc.fc_number}
                                                                </TableCell>
                                                                <TableCell className="text-xs">
                                                                    {fc.issue_date ? format(new Date(fc.issue_date), "dd MMM yyyy") : 'N/A'}
                                                                </TableCell>
                                                                <TableCell className={`text-xs font-bold ${isExpired ? 'text-destructive' : 'text-teal-600'}`}>
                                                                    {format(new Date(fc.expiry_date), "dd MMM yyyy")}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {isExpired ? (
                                                                        <Badge variant="destructive" className="text-[10px]">EXPIRED</Badge>
                                                                    ) : (
                                                                        <Badge className="bg-teal-500/10 text-teal-700 border-teal-500/20 text-[10px]">ACTIVE / VALID</Badge>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-muted-foreground">
                                                                    {fc.notes || 'Routine FC certificate renewal'}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </Card>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Authentic Bill Format Preview Modal */}
                    <Dialog open={!!viewingBillModal} onOpenChange={(open) => !open && setViewingBillModal(null)}>
                        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-6 space-y-6">
                            {viewingBillModal && (() => {
                                const inv = viewingBillModal.invoice;
                                const wo = viewingBillModal.workOrder;
                                const tasks = (wo?.services || []).flatMap((s: any) =>
                                    (s.tasks || []).map((t: any) => ({ ...t, service_type: s.service_type }))
                                );
                                const parts = (history.find(h => h.work_order_id === (wo?.id || inv?.work_order_id))?.parts) || [];
                                const billedTotal = inv?.total || 0;
                                let rawPaid = inv?.paid_amount;
                                if (rawPaid === undefined) {
                                    rawPaid = (inv?.payment_links || []).reduce((acc: number, l: any) =>
                                        l.payment?.status === 'approved' ? acc + (l.amount_applied || l.payment?.amount || 0) : acc, 0);
                                }
                                if (inv?.status?.toLowerCase() === 'paid' && rawPaid === 0) {
                                    rawPaid = billedTotal;
                                }
                                const paidAmount = Math.min(billedTotal, Math.max(0, rawPaid || 0));
                                const balanceAmount = Math.max(0, billedTotal - paidAmount);

                                return (
                                    <>
                                        <DialogHeader className="border-b pb-4">
                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                                                <div>
                                                    <h3 className="text-xl font-bold tracking-tight text-foreground uppercase">
                                                        {companyProfile?.company_name || 'Amma Auto Garage'}
                                                    </h3>
                                                    <p className="text-xs text-muted-foreground">
                                                        {companyProfile?.address || 'Service Station & Fleet Care'}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Phone: {companyProfile?.phone || 'N/A'} • GSTIN: <strong className="text-foreground">{companyProfile?.gst_number || companyProfile?.gstin || 'GST NOT REGISTERED'}</strong>
                                                    </p>
                                                </div>
                                                <div className="md:text-right">
                                                    <Badge variant="outline" className="text-xs font-mono font-bold bg-primary/5 text-primary border-primary/20">
                                                        TAX INVOICE / BILL
                                                    </Badge>
                                                    <p className="text-sm font-bold font-mono mt-1 text-foreground">
                                                        {inv?.bill_number || inv?.invoice_number || `INV-${wo?.id?.slice(0, 6).toUpperCase()}`}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Date: {format(new Date(inv?.created_at || wo?.created_at || Date.now()), "dd MMMM yyyy")}
                                                    </p>
                                                </div>
                                            </div>
                                        </DialogHeader>

                                        {/* Customer & Vehicle Details */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg text-xs border">
                                            <div className="space-y-1">
                                                <p className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Billed To (Customer)</p>
                                                <p className="text-sm font-bold text-foreground">{vehicle.customer?.name || 'Walk-in Customer'}</p>
                                                <p className="text-muted-foreground">Phone: {vehicle.customer?.phone || 'N/A'}</p>
                                                {vehicle.customer?.address && <p className="text-muted-foreground">Address: {vehicle.customer.address}</p>}
                                                {vehicle.customer?.gstin && <p className="text-muted-foreground">GSTIN: {vehicle.customer.gstin}</p>}
                                            </div>
                                            <div className="space-y-1 md:text-right">
                                                <p className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Vehicle Particulars</p>
                                                <p className="text-base font-extrabold font-mono text-primary">{vehicle.vehicle_number}</p>
                                                <p className="text-muted-foreground">
                                                    {vehicle.vehicle_models?.vehicle_manufacturers?.name} {vehicle.vehicle_models?.name} ({vehicle.year || 'N/A'})
                                                </p>
                                                <p className="text-muted-foreground">
                                                    Odometer: <strong>{wo?.odometer_reading || vehicle.kilometers_driven || 'N/A'} km</strong>
                                                </p>
                                                <p className="text-muted-foreground">
                                                    Advisor: {wo?.advisor?.name || 'Workshop Service Desk'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Services & Labour Table */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                    <Wrench className="h-3.5 w-3.5 text-primary" /> Labour & Service Operations
                                                </h4>
                                                <span className="text-xs text-muted-foreground">{tasks.length} items</span>
                                            </div>
                                            <div className="border rounded-md overflow-hidden">
                                                <Table>
                                                    <TableHeader className="bg-muted/40">
                                                        <TableRow className="h-8">
                                                            <TableHead className="text-xs font-semibold py-1">Description</TableHead>
                                                            <TableHead className="text-xs font-semibold py-1">Type</TableHead>
                                                            <TableHead className="text-xs font-semibold text-right py-1">Status</TableHead>
                                                            <TableHead className="text-xs font-semibold text-right py-1">Amount (₹)</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {tasks.length > 0 ? (
                                                            tasks.map((task: any, idx: number) => (
                                                                <TableRow key={task.id || idx} className="h-8">
                                                                    <TableCell className="text-xs py-1.5 font-medium">{task.task_name}</TableCell>
                                                                    <TableCell className="text-xs py-1.5 text-muted-foreground">{task.service_type}</TableCell>
                                                                    <TableCell className="text-xs py-1.5 text-right">
                                                                        {task.completed ? (
                                                                            <span className="text-green-600 font-medium">Completed</span>
                                                                        ) : (
                                                                            <span className="text-orange-500 font-medium">Pending</span>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs py-1.5 text-right font-medium">
                                                                        ₹{formatCurrency(task.price)}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))
                                                        ) : (
                                                            <TableRow>
                                                                <TableCell colSpan={4} className="text-xs text-center py-3 text-muted-foreground italic">
                                                                    General workshop inspection / service package
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>

                                        {/* Spare Parts Table */}
                                        {parts.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                        <Package className="h-3.5 w-3.5 text-purple-500" /> Spare Parts & Consumables
                                                    </h4>
                                                    <span className="text-xs text-muted-foreground">{parts.length} parts</span>
                                                </div>
                                                <div className="border rounded-md overflow-hidden">
                                                    <Table>
                                                        <TableHeader className="bg-muted/40">
                                                            <TableRow className="h-8">
                                                                <TableHead className="text-xs font-semibold py-1">Part Description</TableHead>
                                                                <TableHead className="text-xs font-semibold py-1">OEM / SKU</TableHead>
                                                                <TableHead className="text-xs font-semibold text-right py-1">Qty</TableHead>
                                                                <TableHead className="text-xs font-semibold text-right py-1">Rate (₹)</TableHead>
                                                                <TableHead className="text-xs font-semibold text-right py-1">Total (₹)</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {parts.map((p: any) => (
                                                                <TableRow key={p.id} className="h-8">
                                                                    <TableCell className="text-xs py-1.5 font-medium">{p.part_name}</TableCell>
                                                                    <TableCell className="text-xs py-1.5 font-mono text-muted-foreground">{p.part_number}</TableCell>
                                                                    <TableCell className="text-xs py-1.5 text-right font-medium">{p.quantity}</TableCell>
                                                                    <TableCell className="text-xs py-1.5 text-right">₹{formatCurrency(p.unit_price)}</TableCell>
                                                                    <TableCell className="text-xs py-1.5 text-right font-bold text-foreground">
                                                                        ₹{formatCurrency(p.total_price)}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        )}

                                        {/* Bill Financial Summary Box */}
                                        <div className="border-t pt-4">
                                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                                <div className="text-xs text-muted-foreground space-y-1">
                                                    <p className="font-semibold text-foreground">Bank & Payment Details:</p>
                                                    {companyProfile?.bank_name && <p>Bank: {companyProfile.bank_name}</p>}
                                                    {companyProfile?.acc_number && <p>A/C: {companyProfile.acc_number} ({companyProfile.ifsc || ''})</p>}
                                                    {companyProfile?.upi_id && <p>UPI: {companyProfile.upi_id}</p>}
                                                </div>

                                                <div className="w-full sm:w-64 space-y-1.5 text-xs bg-muted/20 p-3 rounded-lg border">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Subtotal:</span>
                                                        <span className="font-medium">₹{formatCurrency(inv?.subtotal || billedTotal)}</span>
                                                    </div>
                                                    {(inv?.total_deductions || 0) > 0 && (
                                                        <div className="flex justify-between text-emerald-600">
                                                            <span>Discounts / Deductions:</span>
                                                            <span>- ₹{formatCurrency(inv.total_deductions)}</span>
                                                        </div>
                                                    )}
                                                    {(inv?.tax || 0) > 0 && (
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">GST Taxes:</span>
                                                            <span>₹{formatCurrency(inv.tax)}</span>
                                                        </div>
                                                    )}
                                                    <Separator />
                                                    <div className="flex justify-between text-sm font-bold">
                                                        <span>Grand Total:</span>
                                                        <span className="text-primary font-mono">₹{formatCurrency(billedTotal)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                                                        <span>Amount Paid:</span>
                                                        <span>₹{formatCurrency(paidAmount)}</span>
                                                    </div>
                                                    <div className={`flex justify-between text-xs font-bold pt-1 border-t ${balanceAmount > 0 ? 'text-amber-600' : 'text-foreground'}`}>
                                                        <span>Balance Due:</span>
                                                        <span>₹{formatCurrency(balanceAmount)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setViewingBillModal(null)}
                                            >
                                                Close
                                            </Button>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => generateInvoicePDF(wo?.id || inv?.work_order_id, 'preview')}
                                                    className="gap-1.5 text-xs"
                                                >
                                                    <Printer className="h-3.5 w-3.5" />
                                                    Print Bill
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => generateInvoicePDF(wo?.id || inv?.work_order_id, 'save')}
                                                    className="gap-1.5 text-xs bg-primary hover:bg-primary/90 font-semibold"
                                                >
                                                    <Download className="h-3.5 w-3.5" />
                                                    Download Bill PDF
                                                </Button>
                                            </div>
                                        </DialogFooter>
                                    </>
                                );
                            })()}
                        </DialogContent>
                    </Dialog>
                </main>
            </div>

            {/* Confirm Vehicle Deletion Dialog */}
            <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Vehicle {vehicle.vehicle_number}?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            <p>
                                Are you sure you want to permanently delete this vehicle from your garage fleet?
                                This action cannot be undone.
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Make & Model: <b>{vehicle.vehicle_models?.vehicle_manufacturers?.name} {vehicle.vehicle_models?.name}</b>
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteVehicle}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" /> Deleting...
                                </>
                            ) : (
                                "Delete Vehicle"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
