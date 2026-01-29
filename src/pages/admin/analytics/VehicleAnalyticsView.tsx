import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, FileText, Wrench, IndianRupee, History, AlertCircle, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface VehicleAnalyticsViewProps {
    vehicleId: string;
}

interface VehicleAnalyticsData {
    vehicle: any; // Ideally more specific, but any is better than never
    workOrders: any[];
    chartData: any[];
    stats: {
        totalServices: number;
        totalSpent: number;
        lastService: string | null;
        nextServiceKm: number | null;
    };
}

export default function VehicleAnalyticsView({ vehicleId }: VehicleAnalyticsViewProps) {
    const navigate = useNavigate();

    // 1. Fetch Vehicle & History
    const { data: stats, isLoading } = useQuery<VehicleAnalyticsData>({
        queryKey: ['vehicle-analytics', vehicleId],
        queryFn: async () => {
            const [
                { data: vehicle },
                { data: workOrders }
            ]: any[] = await Promise.all([
                supabase.from('vehicles').select('*, customers(*)').eq('id', vehicleId).single(),
                supabase.from('work_orders')
                    .select('*, work_order_services(*)') // Fetch services for drill down info
                    .eq('vehicle_id', vehicleId)
                    .order('created_at', { ascending: true }) // Ascending for chart
            ]);

            // Calculate Stats
            const totalServices = workOrders?.length || 0;
            const totalSpent = (workOrders || []).reduce((sum, wo) => sum + (wo.actual_cost || wo.estimated_cost || 0), 0);
            const lastService = workOrders && workOrders.length > 0 ? workOrders[workOrders.length - 1].created_at : null; // Last item since ascending

            // Next Service estimation (simple logic based on last service or manual field)
            const nextServiceKm = vehicle?.next_service_km || (vehicle?.kilometers_driven ? vehicle.kilometers_driven + 5000 : null);

            // Chart Data
            const chartData = (workOrders || []).map(wo => ({
                name: format(new Date(wo.created_at), 'MMM dd, yy'),
                value: wo.actual_cost || wo.estimated_cost || 0,
                fullDate: format(new Date(wo.created_at), 'MMMM d, yyyy')
            }));

            return {
                vehicle,
                workOrders: (workOrders || []).reverse(), // Reverse back for timeline list (Newest first)
                chartData,
                stats: {
                    totalServices,
                    totalSpent,
                    lastService,
                    nextServiceKm
                }
            };
        }
    });

    if (isLoading) {
        return <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!stats?.vehicle) return <div>Vehicle not found.</div>;

    const { vehicle, workOrders } = stats;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Card */}
            <Card className="bg-gradient-to-r from-blue-50 to-white dark:from-blue-950 dark:to-background border-blue-200 dark:border-blue-900">
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-3xl font-bold text-primary">{vehicle.vehicle_number}</h2>
                                <Badge variant="outline" className="text-base">{vehicle.model}</Badge>
                            </div>
                            <p className="text-muted-foreground mt-2 flex items-center gap-2">
                                <span className="font-medium">{vehicle.customers?.name}</span>
                                <span className="text-xs px-2 py-0.5 bg-muted rounded-full">Owner</span>
                            </p>
                            <div className="flex gap-4 mt-4 text-sm">
                                <div className="flex items-center gap-1.5">
                                    <Wrench className="h-4 w-4 text-orange-500" />
                                    <span>{vehicle.kilometers_driven?.toLocaleString() || '0'} km</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="h-4 w-4 text-blue-500" />
                                    <span>FC: {vehicle.fc_expiry_date ? format(new Date(vehicle.fc_expiry_date), 'MMM d, yyyy') : 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right space-y-2">
                            <div className="text-sm text-muted-foreground">Lifetime Service Value</div>
                            <div className="text-3xl font-bold">₹{stats.stats.totalSpent.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">{stats.stats.totalServices} Visits</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Timeline */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History className="h-5 w-5" /> Service History
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="relative border-l border-muted ml-3 space-y-8 py-2">
                                {workOrders.map((wo: any) => (
                                    <div key={wo.id} className="relative pl-6">
                                        {/* Timeline Dot */}
                                        <div className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-background ${wo.status === 'Delivered' ? 'bg-green-500' : 'bg-blue-500'}`} />

                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-1">
                                            <div>
                                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                                    {format(new Date(wo.created_at), "MMMM d, yyyy")}
                                                    <Badge variant={wo.status === 'Delivered' ? 'secondary' : 'default'} className="text-[10px] h-5">
                                                        {wo.status}
                                                    </Badge>
                                                </h4>
                                                <p className="text-xs text-muted-foreground mt-0.5">WO #{wo.id.slice(0, 6).toUpperCase()}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-bold text-sm">₹{(wo.actual_cost || wo.estimated_cost || 0).toLocaleString()}</span>
                                            </div>
                                        </div>

                                        {/* Services List Preview */}
                                        <div className="mt-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                                            <ul className="list-disc list-inside space-y-1">
                                                {wo.work_order_services && wo.work_order_services.length > 0 ? (
                                                    <>
                                                        {wo.work_order_services.slice(0, 3).map((s: any, idx: number) => (
                                                            <li key={idx} className="truncate">{s.service_type}</li>
                                                        ))}
                                                        {wo.work_order_services.length > 3 && (
                                                            <li className="list-none text-xs italic pl-4">+{wo.work_order_services.length - 3} more services...</li>
                                                        )}
                                                    </>
                                                ) : (
                                                    <li className="truncate">{wo.service_type}</li>
                                                )}
                                                {(!wo.work_order_services || wo.work_order_services.length === 0) && !wo.service_type && (
                                                    <li className="list-none italic">No services listed</li>
                                                )}
                                            </ul>
                                            <div className="mt-3 pt-2 border-t border-muted/20">
                                                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => navigate(`/admin/work-orders/${wo.id}`)}>
                                                    View Details <FileText className="h-3 w-3 ml-1" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {workOrders.length === 0 && (
                                    <div className="pl-6 text-muted-foreground italic">No service history found.</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Alerts & Next Service */}
                <div className="space-y-6">
                    <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/10">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base text-orange-700 dark:text-orange-400 flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" /> Next Service Due
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.stats.nextServiceKm ? `${stats.stats.nextServiceKm.toLocaleString()} km` : 'N/A'}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Based on last service interval (+5000km)
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button className="w-full justify-start" variant="outline" onClick={() => navigate(`/admin/work-orders?vehicle=${vehicle.vehicle_number}`)}>
                                <History className="h-4 w-4 mr-2" /> View Full History
                            </Button>
                            <Button className="w-full justify-start" onClick={() => navigate('/admin/work-orders')}>
                                <Wrench className="h-4 w-4 mr-2" /> Create Work Order
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
