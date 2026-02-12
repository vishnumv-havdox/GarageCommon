import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface RequestsContextType {
    pendingPartRequests: number;
    pendingWorkApprovals: number;
    pendingAppointments: number;
    totalPending: number;
    refreshCounts: () => Promise<void>;
}

const RequestsContext = createContext<RequestsContextType | undefined>(undefined);

export function RequestsProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [pendingPartRequests, setPendingPartRequests] = useState(0);
    const [pendingWorkApprovals, setPendingWorkApprovals] = useState(0);
    const [pendingAppointments, setPendingAppointments] = useState(0);
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
            // We can also check work_order_service_employees in 'pending_approval' if we want granular notifications,
            // but typically the Work Order status is the master 'gate' for Admins.
            // Let's count Pending Approval Work Orders.
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
                    table: "work_orders",
                    filter: "status=eq.Pending Approval"
                },
                () => {
                    toast({
                        title: "Work Order Pending Approval",
                        description: "A work order needs your approval.",
                    });
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "appointments",
                    filter: "status=eq.pending"
                },
                () => {
                    fetchCounts();
                    toast({
                        title: "New Appointment Request",
                        description: "A new appointment has been requested.",
                    });
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
        totalPending: pendingPartRequests + pendingWorkApprovals + pendingAppointments,
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
