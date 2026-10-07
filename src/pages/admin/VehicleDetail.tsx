import { useState, useEffect, useCallback } from "react";
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
    Clock, ExternalLink, Expand, Edit2, ImageIcon, Plus
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { generateVehicleHistoryPDF, parseNotes } from "@/utils/pdfGenerator";

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
    work_order_id: string;
    billed_amount?: number;
    paid_amount?: number;
    work_order?: {
        id: string;
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

export default function AdminVehicleDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [history, setHistory] = useState<ServiceHistoryRecord[]>([]);
    const [activePhotoIndex, setActivePhotoIndex] = useState(0);

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

            // Fetch Work Orders (History + Active)
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
                        total,
                        total_deductions,
                        payment_links(amount_applied, payment:payments(id, amount, status))
                    )
                `)
                .eq("vehicle_id", id)
                .order("created_at", { ascending: false });

            if (woError) throw woError;

            // Map work orders to ServiceHistoryRecord interface for compatibility
            const formattedHistory: ServiceHistoryRecord[] = (woData || []).map((wo: any) => {
                let billedTotal = 0;
                let paidTotal = 0;

                (wo.invoices || []).forEach((inv: any) => {
                    billedTotal += inv.total || 0;
                    inv.payment_links?.forEach((link: any) => {
                        if (link.payment?.status === 'approved') {
                            paidTotal += link.amount_applied || link.payment.amount;
                        }
                    });
                });

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
                    work_order_id: wo.id,
                    billed_amount: billedTotal,
                    paid_amount: paidTotal,
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

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
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
                            <Button onClick={() => id && generateVehicleHistoryPDF(id, 'preview')} variant="outline">
                                <FileText className="h-4 w-4 mr-2" />
                                Print History
                            </Button>
                            <Link to={`/admin/vehicles?edit=${vehicle.id}`}>
                                <Button variant="outline">Edit Vehicle</Button>
                            </Link>
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
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <ClipboardList className="h-6 w-6" />
                                Complete Vehicle Service History
                            </h2>
                            <Badge variant="outline" className="text-sm">{history.length} Records</Badge>
                        </div>

                        {history.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    No service records found for this vehicle.
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-8">
                                {history.map((record) => (
                                    <Card key={record.id} className="overflow-hidden border-l-4 border-l-primary">
                                        <div className="bg-muted/30 p-4 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge>{record.service_type}</Badge>
                                                    <span className="text-sm font-semibold text-muted-foreground">
                                                        {format(new Date(record.service_date), "PPP")}
                                                    </span>
                                                </div>
                                                <h3 className="font-bold text-lg">{record.service_description}</h3>
                                            </div>
                                            <div className="flex flex-col md:items-end gap-1">
                                                <div className="flex items-center gap-2 text-sm">
                                                    {record.status === 'Completed' || record.status === 'Delivered' ? (
                                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <Clock className="h-4 w-4 text-orange-500" />
                                                    )}
                                                    <span className="font-semibold">{record.status}</span>
                                                </div>
                                                {(record.billed_amount || 0) > 0 && (
                                                    <div className="flex gap-2 text-xs mt-1">
                                                        <span className="text-muted-foreground">Billed: <span className="text-foreground font-medium">₹{record.billed_amount}</span></span>
                                                        <span className="text-muted-foreground">Paid: <span className="text-green-600 font-medium">₹{record.paid_amount}</span></span>
                                                    </div>
                                                )}
                                                {record.delivery_date && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Delivered on {format(new Date(record.delivery_date), "PPp")}
                                                    </p>
                                                )}
                                                <Link to={`/admin/work-orders/${record.work_order_id}`} className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                                                    View Work Order <ExternalLink className="h-3 w-3" />
                                                </Link>
                                            </div>
                                        </div>
                                        <CardContent className="p-0">
                                            <div className="grid grid-cols-1 md:grid-cols-12">
                                                {/* Left: Personnel & Summary */}
                                                <div className="md:col-span-5 p-6 space-y-6 border-r">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1">
                                                            <p className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1">
                                                                <FileText className="h-3 w-3" /> Assigned By (Advisor)
                                                            </p>
                                                            <p className="font-bold">{record.work_order?.advisor?.name || 'N/A'}</p>
                                                            {record.work_order?.advisor?.phone && (
                                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                    <Phone className="h-3 w-3" /> {record.work_order.advisor.phone}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1">
                                                                <Truck className="h-3 w-3" /> Driver Info
                                                            </p>
                                                            <p className="font-bold">{record.work_order?.driver?.name || 'N/A'}</p>
                                                            {record.work_order?.driver?.contact_number && (
                                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                    <Phone className="h-3 w-3" /> {record.work_order.driver.contact_number}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <Separator />

                                                    <div className="space-y-2">
                                                        <p className="text-xs text-muted-foreground uppercase font-semibold">Workflow Summary</p>
                                                        <p className="text-sm leading-relaxed whitespace-pre-wrap italic">
                                                            "{parseNotes(record.work_summary) || 'No summary provided'}"
                                                        </p>
                                                    </div>

                                                    {record.notes && (
                                                        <div className="p-3 bg-muted rounded">
                                                            <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Historical Notes</p>
                                                            <p className="text-sm">{parseNotes(record.notes)}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Right: Detailed Service Tasks */}
                                                <div className="md:col-span-7 p-6 bg-muted/10">
                                                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-4 flex items-center gap-1">
                                                        <Wrench className="h-3 w-3" /> Performed Services & Tasks
                                                    </p>
                                                    <div className="space-y-6">
                                                        {record.work_order?.services && record.work_order.services.length > 0 ? (
                                                            record.work_order.services.map((service, idx) => (
                                                                <div key={service.id || idx} className="space-y-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                                                        <h4 className="font-bold text-sm uppercase">{service.service_type}</h4>
                                                                    </div>
                                                                    <div className="pl-4 grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-4">
                                                                        {service.tasks.map((task) => (
                                                                            <div key={task.id} className="flex items-center justify-between text-sm py-1 border-b border-muted last:border-0">
                                                                                <span className="text-muted-foreground">{task.task_name}</span>
                                                                                <div className="flex items-center gap-2">
                                                                                    {task.price > 0 && <span className="font-medium text-xs">₹{task.price}</span>}
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
                                                            <div className="text-sm text-muted-foreground italic bg-muted/50 p-4 rounded text-center">
                                                                Legacy record: Detailed task breakdown not available for this session.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
