import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
    ClipboardList,
    Wrench,
    CheckCircle2,
    Truck,
    Building2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GarageMetrics {
    work_orders_placed: number;
    working_vehicles: number;
    completed_not_delivered: number;
    todays_deliveries: number;
    total_vehicles_in_garage: number;
}

interface GarageMetricsDashboardProps {
    refreshInterval?: number; // in milliseconds, default 30000 (30 seconds)
    showDetailed?: boolean;
    className?: string;
    selectedDate?: Date | null; // Add date filter
}

export function GarageMetricsDashboard({
    refreshInterval = 30000,
    showDetailed = false,
    className,
    selectedDate
}: GarageMetricsDashboardProps) {
    const [metrics, setMetrics] = useState<GarageMetrics>({
        work_orders_placed: 0,
        working_vehicles: 0,
        completed_not_delivered: 0,
        todays_deliveries: 0,
        total_vehicles_in_garage: 0
    });
    const [dateMetrics, setDateMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchMetrics = async () => {
        try {
            // Fetch overall garage metrics
            const { data, error } = await (supabase as any).rpc('get_garage_metrics', {
                target_date: new Date().toISOString().split('T')[0]
            });

            if (error) throw error;
            if (data) {
                setMetrics(data);
            }

            // If a date is selected, fetch date-specific metrics
            if (selectedDate) {
                const dateStr = selectedDate.toISOString().split('T')[0];
                const { data: slotData, error: slotError } = await (supabase as any).rpc('get_time_slot_availability', {
                    target_date: dateStr
                });

                if (slotError) throw slotError;
                if (slotData) {
                    setDateMetrics(slotData);
                }
            } else {
                setDateMetrics(null);
            }
        } catch (error) {
            console.error('Error fetching garage metrics:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();

        // Set up auto-refresh
        const interval = setInterval(fetchMetrics, refreshInterval);

        return () => clearInterval(interval);
    }, [refreshInterval, selectedDate]);

    const metricCards = [
        {
            icon: ClipboardList,
            label: "Work Orders Placed",
            value: metrics.work_orders_placed,
            description: "Active work orders",
            color: "text-blue-600",
            bgColor: "bg-blue-50",
            borderColor: "border-blue-200"
        },
        {
            icon: Wrench,
            label: "Working Vehicles",
            value: metrics.working_vehicles,
            description: "Currently in progress",
            color: "text-orange-600",
            bgColor: "bg-orange-50",
            borderColor: "border-orange-200"
        },
        {
            icon: CheckCircle2,
            label: "Completed",
            value: metrics.completed_not_delivered,
            description: "Ready for delivery",
            color: "text-emerald-600",
            bgColor: "bg-emerald-50",
            borderColor: "border-emerald-200"
        },
        {
            icon: Truck,
            label: "Today's Deliveries",
            value: metrics.todays_deliveries,
            description: "Delivered today",
            color: "text-purple-600",
            bgColor: "bg-purple-50",
            borderColor: "border-purple-200"
        },
        {
            icon: Building2,
            label: "Total in Garage",
            value: metrics.total_vehicles_in_garage,
            description: "All vehicles present",
            color: "text-slate-600",
            bgColor: "bg-slate-50",
            borderColor: "border-slate-200"
        }
    ];

    // Date-specific metrics when a date is selected
    const dateSpecificCards = dateMetrics ? [
        {
            icon: ClipboardList,
            label: "Appointments Scheduled",
            value: dateMetrics.appointments_scheduled || 0,
            description: selectedDate ? `On ${selectedDate.toLocaleDateString()}` : "For selected date",
            color: "text-blue-600",
            bgColor: "bg-blue-50",
            borderColor: "border-blue-200"
        },
        {
            icon: Wrench,
            label: "Work Orders Active",
            value: dateMetrics.work_orders_active || 0,
            description: "In progress on this date",
            color: "text-orange-600",
            bgColor: "bg-orange-50",
            borderColor: "border-orange-200"
        },
        {
            icon: Building2,
            label: "Total Load",
            value: dateMetrics.total_load || 0,
            description: "Combined appointments + work",
            color: "text-purple-600",
            bgColor: "bg-purple-50",
            borderColor: "border-purple-200"
        },
        {
            icon: CheckCircle2,
            label: "Available Slots",
            value: dateMetrics.available_slots || 0,
            description: `Out of ${dateMetrics.total_capacity || 20} capacity`,
            color: dateMetrics.available_slots > 10 ? "text-emerald-600" : dateMetrics.available_slots > 5 ? "text-yellow-600" : "text-red-600",
            bgColor: dateMetrics.available_slots > 10 ? "bg-emerald-50" : dateMetrics.available_slots > 5 ? "bg-yellow-50" : "bg-red-50",
            borderColor: dateMetrics.available_slots > 10 ? "border-emerald-200" : dateMetrics.available_slots > 5 ? "border-yellow-200" : "border-red-200"
        }
    ] : null;

    if (loading) {
        return (
            <div className={cn("grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4", className)}>
                {[...Array(4)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                        <CardContent className="p-6">
                            <div className="h-20 bg-secondary rounded"></div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (showDetailed) {
        const cardsToDisplay = dateSpecificCards || metricCards;
        const titleText = dateMetrics && selectedDate
            ? `Metrics for ${selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
            : "Overall Garage Metrics";

        return (
            <div className={className}>
                {dateMetrics && selectedDate && (
                    <div className="mb-3">
                        <h3 className="text-sm font-semibold text-foreground">{titleText}</h3>
                        <p className="text-xs text-muted-foreground">
                            {dateMetrics.is_available
                                ? `✓ ${dateMetrics.available_slots} slots available`
                                : "⚠ Fully booked"}
                        </p>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {cardsToDisplay.map((metric, index) => {
                        const Icon = metric.icon;
                        return (
                            <Card
                                key={index}
                                className={cn(
                                    "border-l-4 transition-all hover:shadow-md cursor-pointer",
                                    metric.borderColor
                                )}
                            >
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className={cn("p-2 rounded-lg", metric.bgColor)}>
                                            <Icon className={cn("h-5 w-5", metric.color)} />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-2xl font-bold text-foreground">
                                            {metric.value}
                                        </p>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            {metric.label}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {metric.description}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        );
    }

    // Compact view
    return (
        <Card className={cn("border-border", className)}>
            <CardContent className="p-6">
                <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wide">
                    Garage Overview
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {metricCards.map((metric, index) => {
                        const Icon = metric.icon;
                        return (
                            <div key={index} className="flex flex-col items-center text-center">
                                <div className={cn("p-2 rounded-lg mb-2", metric.bgColor)}>
                                    <Icon className={cn("h-5 w-5", metric.color)} />
                                </div>
                                <p className="text-2xl font-bold text-foreground">
                                    {metric.value}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {metric.label}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
