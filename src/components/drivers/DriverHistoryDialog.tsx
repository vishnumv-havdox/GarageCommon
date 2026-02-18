
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight, Calendar, Car, Clock, FileText, MapPin, Wrench } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface DriverHistoryDialogProps {
    driverId: string | null;
    driverName: string | null;
    isOpen: boolean;
    onClose: () => void;
}

interface DriverWorkOrder {
    id: string;
    created_at: string;
    service_type: string;
    status: string;

    vehicle: {
        vehicle_number: string;
        model: string;
    };
    services?: {
        service_type: string;
        tasks?: { task_name: string }[];
    }[];
    tasks?: { task_name: string }[]; // Keep for legacy check
    legacy_tasks?: { task_name: string }[];
}

export function DriverHistoryDialog({ driverId, driverName, isOpen, onClose }: DriverHistoryDialogProps) {
    const [history, setHistory] = useState<DriverWorkOrder[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && driverId) {
            fetchHistory();
        }
    }, [isOpen, driverId]);


    const fetchHistory = async () => {
        setLoading(true);
        try {
            // Fetch work orders
            const { data: woData, error: woError } = await supabase
                .from("work_orders")
                .select(`
                  id,
                  created_at,
                  service_type,
                  status,
                  vehicle:vehicles(vehicle_number, model)
                `)
                .eq("driver_id", driverId)
                .order("created_at", { ascending: false });

            if (woError) {
                console.error("Supabase error fetching woData:", woError);
                throw woError;
            }

            if (woData && woData.length > 0) {
                const woIds = (woData as any[]).map(wo => wo.id);

                // Fetch services separately
                const { data: servicesData, error: servicesError } = await supabase
                    .from("work_order_services")
                    .select("*")
                    .in("work_order_id", woIds);

                if (servicesError) {
                    console.error("Supabase error fetching servicesData:", servicesError);
                }

                // Fetch tasks separately
                const { data: tasksData, error: tasksError } = await supabase
                    .from("work_order_tasks")
                    .select("*")
                    .in("work_order_id", woIds);

                if (tasksError) {
                    console.error("Supabase error fetching tasksData:", tasksError);
                }

                // Fetch legacy tasks separately
                const { data: legacyData, error: legacyError } = await supabase
                    .from("repair_tasks")
                    .select("*")
                    .in("work_order_id", woIds);

                // Merge data
                const mergedHistory: DriverWorkOrder[] = woData.map((wo: any) => {
                    const woServices = (servicesData || [])
                        .filter((s: any) => s.work_order_id === wo.id)
                        .map((s: any) => ({
                            ...s,
                            tasks: (tasksData || [])
                                .filter((t: any) => t.service_id === s.id)
                        }));

                    const woStandaloneTasks = (tasksData || [])
                        .filter((t: any) => t.work_order_id === wo.id && !t.service_id);

                    const woLegacyTasks = (legacyData || [])
                        .filter((t: any) => t.work_order_id === wo.id);

                    return {
                        ...wo,
                        services: woServices,
                        tasks: woStandaloneTasks,
                        legacy_tasks: woLegacyTasks
                    };
                });

                console.log("Merged Driver History Data:", mergedHistory);
                setHistory(mergedHistory);
            } else {
                setHistory([]);
            }
        } catch (error) {
            console.error("Error fetching driver history:", error);
        } finally {
            setLoading(false);
        }
    };

    const navigate = useNavigate();
    const location = useLocation();

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case "completed": return "bg-green-100 text-green-700 border-green-200";
            case "in_progress": return "bg-blue-100 text-blue-700 border-blue-200";
            case "cancelled": return "bg-red-100 text-red-700 border-red-200";
            default: return "bg-gray-100 text-gray-700 border-gray-200";
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md md:max-w-lg rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span className="bg-primary/10 p-2 rounded-full">
                            <Car className="h-5 w-5 text-primary" />
                        </span>
                        <span>Driver History: {driverName}</span>
                    </DialogTitle>
                    <DialogDescription>
                        Work orders and services handled by this driver.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4">
                    {loading ? (
                        <div className="py-8 text-center text-muted-foreground animate-pulse">
                            Loading history...
                        </div>
                    ) : history.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground bg-muted/30 rounded-xl border border-dashed">
                            No history found for this driver.
                        </div>
                    ) : (
                        <ScrollArea className="h-[60vh] pr-4">
                            <div className="space-y-4">
                                {history.map((wo) => {
                                    // Flatten legacy tasks
                                    const legacyTasks = wo.legacy_tasks?.map((t: any) => t.task_name) || [];

                                    return (
                                        <div key={wo.id} className="p-3 bg-card border rounded-xl hover:bg-accent/50 transition-colors">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h4 className="font-bold text-base tracking-tight">
                                                        {wo.vehicle?.vehicle_number}
                                                        {wo.vehicle?.model && (
                                                            <span className="ml-2 text-muted-foreground font-medium text-sm">({wo.vehicle.model})</span>
                                                        )}
                                                    </h4>
                                                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1 font-medium bg-muted/50 w-fit px-2 py-0.5 rounded-full">
                                                        <div className="flex items-center gap-1">
                                                            <Calendar className="h-2.5 w-2.5" />
                                                            {format(new Date(wo.created_at), "MMM d, yyyy")}
                                                        </div>
                                                        <span className="w-1 h-1 bg-border rounded-full" />
                                                        <div className="flex items-center gap-1">
                                                            <Clock className="h-2.5 w-2.5" />
                                                            {format(new Date(wo.created_at), "h:mm a")}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className={`${getStatusColor(wo.status)} capitalize px-2 py-0 text-[10px] h-5 border-none shadow-sm`}>
                                                    {wo.status.replace("_", " ")}
                                                </Badge>
                                            </div>

                                            <div className="flex justify-end mb-3">
                                                <Button
                                                    variant="link"
                                                    size="sm"
                                                    className="h-6 text-[10px] p-0 text-primary font-bold flex items-center gap-1 hover:no-underline opacity-80 hover:opacity-100 transition-opacity"
                                                    onClick={() => {
                                                        if (location.pathname.startsWith('/admin')) {
                                                            navigate(`/admin/work-orders/${wo.id}`);
                                                            onClose();
                                                        } else {
                                                            // For customer portal, we might stay here or scroll
                                                            // For now, allow admin navigation since this is the primary request
                                                            console.log("Customer view - work order ID:", wo.id);
                                                        }
                                                    }}
                                                >
                                                    View Details <ArrowRight className="h-3 w-3" />
                                                </Button>
                                            </div>

                                            {/* Work Order Type & Nested Services */}
                                            <div className="space-y-3">
                                                {wo.service_type && (
                                                    <div className="flex items-center gap-2 mb-1 px-1">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                                                        <span className="text-xs font-bold uppercase tracking-wider text-foreground/70">{wo.service_type}</span>
                                                    </div>
                                                )}

                                                {wo.services && wo.services.length > 0 && (
                                                    <div className="space-y-2">
                                                        {wo.services.map((service: any, idx: number) => {
                                                            // Hide redundant service label if it matches main WO type and it's the only service
                                                            const isRedundant = wo.services?.length === 1 && service.service_type === wo.service_type;

                                                            return (
                                                                <div key={idx} className="bg-secondary/20 rounded-xl p-2.5 border border-border/50">
                                                                    {!isRedundant && (
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                            <Wrench className="h-3 w-3 text-primary/80" />
                                                                            <span className="text-xs font-bold text-foreground/80">{service.service_type}</span>
                                                                        </div>
                                                                    )}
                                                                    {service.tasks && service.tasks.length > 0 && (
                                                                        <div className={`flex flex-wrap gap-1.5 ${!isRedundant ? 'ml-5' : 'ml-0'}`}>
                                                                            {service.tasks.map((task: any, tIdx: number) => (
                                                                                <Badge key={tIdx} variant="secondary" className="text-[9px] bg-background/80 text-foreground/70 font-medium border border-border/10 px-2 py-0">
                                                                                    {task.task_name}
                                                                                </Badge>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Standalone Tasks */}
                                                {(wo.tasks?.length || 0) > 0 && (
                                                    <div className="mt-3 bg-secondary/10 p-2 rounded-xl border border-dashed border-border/50">
                                                        <div className="text-[9px] text-muted-foreground mb-2 uppercase tracking-tight font-bold ml-1 opacity-70">General Tasks</div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {wo.tasks.map((task: any, idx: number) => (
                                                                <Badge key={idx} variant="outline" className="text-[9px] bg-background/30 text-muted-foreground border-border/50 font-normal px-2 py-0">
                                                                    {task.task_name}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Legacy Tasks (Fallback) */}
                                                {legacyTasks.length > 0 && (
                                                    <div className="mt-4 pt-3 border-t border-border/30">
                                                        <div className="text-[9px] text-muted-foreground mb-2 uppercase tracking-tight font-bold opacity-60">Additional Data</div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {legacyTasks.map((task: string, idx: number) => (
                                                                <Badge key={idx} variant="secondary" className="text-[9px] bg-secondary/30 text-secondary-foreground/60 font-normal px-2 py-0">
                                                                    {task}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                <div className="flex justify-end">
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
