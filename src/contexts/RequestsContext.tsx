import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface RequestsContextType {
    pendingPartRequests: number;
    pendingWorkApprovals: number;
    pendingAppointments: number;
    urgentAppointments: number;
    activeWorkOrders: number;
    serviceDueReminders: number;
    totalPending: number;
    refreshCounts: () => Promise<void>;
}

const RequestsContext = createContext<RequestsContextType | undefined>(undefined);

export function RequestsProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [pendingPartRequests, setPendingPartRequests] = useState(0);
    const [pendingWorkApprovals, setPendingWorkApprovals] = useState(0);
    const [pendingAppointments, setPendingAppointments] = useState(0);
    const [urgentAppointments, setUrgentAppointments] = useState(0);
    const [activeWorkOrders, setActiveWorkOrders] = useState(0);
    const [serviceDueReminders, setServiceDueReminders] = useState(0);
    const { toast } = useToast();

    const fetchCounts = useCallback(async () => {
        if (!user || user.role !== "admin") return;

        try {
            // 1. Part Requests (pending)
            const { count: partsCount, error: partsError } = await supabase
                .from("part_requests")
                .select("*", { count: 'exact', head: true })
                .eq("status", "pending");

            if (partsError) console.error("Error fetching part requests count:", partsError);
            setPendingPartRequests(partsCount || 0);

            // 2. Work Approvals (Work Orders in 'Pending Approval' state)
            const { count: woCount, error: woError } = await supabase
                .from("work_orders")
                .select("*", { count: 'exact', head: true })
                .eq("status", "Pending Approval");

            if (woError) console.error("Error fetching work approvals count:", woError);
            setPendingWorkApprovals(woCount || 0);

            // 3. Appointments (pending)
            const { count: appCount, error: appError } = await supabase
                .from("appointments")
                .select("*", { count: 'exact', head: true })
                .eq("status", "pending");

            if (appError) console.error("Error fetching appointments count:", appError);
            setPendingAppointments(appCount || 0);

            // 4. Urgent Appointments (confirmed but no job card, scheduled <= today)
            const today = new Date();
            today.setHours(23, 59, 59, 999);

            const { count: urgentCount, error: urgentError } = await supabase
                .from("appointments")
                .select("*", { count: 'exact', head: true })
                .eq("status", "confirmed")
                .lte("scheduled_at", today.toISOString());

            if (urgentError) console.error("Error fetching urgent appointments count:", urgentError);
            setUrgentAppointments(urgentCount || 0);

            // 5. Active Work Orders (not completed, delivered, cancelled, rejected)
            const { count: activeCount, error: activeError } = await supabase
                .from("work_orders")
                .select("*", { count: 'exact', head: true })
                .not("status", "in", '("Completed","Delivered","Cancelled","Rejected")');

            if (activeError) console.error("Error fetching active work orders count:", activeError);
            setActiveWorkOrders(activeCount || 0);

            // 6. Service Due Reminders (due within 2 days or past date, or remaining km <= 500)
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + 2);
            const targetDateStr = targetDate.toISOString().split('T')[0];

            const { data: dueVehicles } = await supabase
                .from("vehicles")
                .select("id, kilometers_driven, next_service_km, next_service_date")
                .or(`next_service_date.lte.${targetDateStr},next_service_km.not.is.null`);

            // Fetch existing 'informed' reminders to exclude acknowledged ones
            const { data: informedReminders } = await supabase
                .from("service_reminders")
                .select("vehicle_id, due_date, due_km")
                .eq("status", "informed");

            const informedSet = new Set(
                (informedReminders || []).map(r => `${r.vehicle_id}_${r.due_date || ''}_${r.due_km || ''}`)
            );

            let activeDueCount = 0;
            (dueVehicles || []).forEach(v => {
                const isDateDue = v.next_service_date && v.next_service_date <= targetDateStr;
                const remainingKm = (v.next_service_km || 0) - (v.kilometers_driven || 0);
                const isKmDue = v.next_service_km && remainingKm <= 500;

                if (isDateDue || isKmDue) {
                    const key = `${v.id}_${v.next_service_date || ''}_${v.next_service_km || ''}`;
                    if (!informedSet.has(key)) {
                        activeDueCount++;
                    }
                }
            });

            setServiceDueReminders(activeDueCount);

        } catch (error) {
            console.error("Error fetching request counts:", error);
        }
    }, [user]);

    useEffect(() => {
        if (!user || user.role !== "admin") return;

        fetchCounts();

        // Subscribe to realtime changes
        const channel = supabase
            .channel("admin-notifications")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "part_requests",
                    filter: "status=eq.pending"
                },
                () => {
                    fetchCounts();
                    toast({
                        title: "New Part Request",
                        description: "A new part request has been submitted.",
                    });
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "work_orders"
                },
                (payload) => {
                    fetchCounts();
                    if ((payload.new as any)?.status === "Pending Approval") {
                        toast({
                            title: "Work Order Pending Approval",
                            description: "A work order needs your approval.",
                        });
                    }
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "appointments"
                },
                (payload) => {
                    fetchCounts();
                    if (payload.eventType === 'INSERT' && (payload.new as any).status === 'pending') {
                        toast({
                            title: "New Appointment Request",
                            description: "A new appointment has been requested.",
                        });
                    }
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "service_reminders"
                },
                () => {
                    fetchCounts();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, fetchCounts, toast]);

    const value = {
        pendingPartRequests,
        pendingWorkApprovals,
        pendingAppointments,
        urgentAppointments,
        activeWorkOrders,
        serviceDueReminders,
        totalPending: pendingPartRequests + pendingWorkApprovals + pendingAppointments + urgentAppointments + serviceDueReminders,
        refreshCounts: fetchCounts
    };

    return (
        <RequestsContext.Provider value={value}>
            {children}
        </RequestsContext.Provider>
    );
}

export function useRequests() {
    const context = useContext(RequestsContext);
    if (context === undefined) {
        throw new Error("useRequests must be used within a RequestsProvider");
    }
    return context;
}
