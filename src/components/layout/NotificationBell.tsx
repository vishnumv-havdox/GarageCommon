import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Calendar, AlertCircle, Package, FileText, ArrowRight, CheckCheck, X, Wrench, Phone, Check } from "lucide-react";
import { useRequests } from "@/contexts/RequestsContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

interface NotificationItem {
  id: string;
  type: "appointment" | "urgent" | "part" | "approval" | "service_due";
  title: string;
  description: string;
  time: string;
  link: string;
  vehicleId?: string;
  vehicleNumber?: string;
  dueDate?: string | null;
  dueKm?: number | null;
  contactName?: string | null;
  contactPhone?: string | null;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    totalPending,
    urgentAppointments,
    pendingAppointments,
    pendingPartRequests,
    pendingWorkApprovals,
    serviceDueReminders,
    refreshCounts,
  } = useRequests();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [ackingIds, setAckingIds] = useState<string[]>([]);

  const fetchNotificationDetails = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const items: NotificationItem[] = [];

      // 1. Pending Appointments
      if (pendingAppointments > 0) {
        const { data } = await supabase
          .from("appointments")
          .select("id, created_at, customer:customers(name)")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(4);

        (data as any[])?.forEach((app) => {
          items.push({
            id: `app-${app.id}`,
            type: "appointment",
            title: "New Booking Request",
            description: `From ${app.customer?.name || "Customer"}`,
            time: app.created_at,
            link: "/admin/requests?tab=appointments",
          });
        });
      }

      // 2. Urgent Today's Appointments
      if (urgentAppointments > 0) {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const { data } = await supabase
          .from("appointments")
          .select("id, scheduled_at, vehicle:vehicles(vehicle_number)")
          .eq("status", "confirmed")
          .lte("scheduled_at", today.toISOString())
          .limit(3);

        (data as any[])?.forEach((app) => {
          items.push({
            id: `urg-${app.id}`,
            type: "urgent",
            title: "Vehicle Arrived Today",
            description: `Open Job Card for ${app.vehicle?.vehicle_number || "Vehicle"}`,
            time: app.scheduled_at,
            link: "/admin/work-orders",
          });
        });
      }

      // 3. Pending Part Requests
      if (pendingPartRequests > 0) {
        const { data } = await supabase
          .from("part_requests")
          .select("id, created_at, part:inventory(item_name)")
          .eq("status", "pending")
          .limit(4);

        (data as any[])?.forEach((req) => {
          items.push({
            id: `part-${req.id}`,
            type: "part",
            title: "Part Requisition",
            description: `Requested: ${req.part?.item_name || "Stock Item"}`,
            time: req.created_at,
            link: "/admin/requests?tab=part-requests",
          });
        });
      }

      // 4. Pending Work Approvals
      if (pendingWorkApprovals > 0) {
        const { data } = await supabase
          .from("work_orders")
          .select("id, created_at, vehicle:vehicles(vehicle_number)")
          .eq("status", "Pending Approval")
          .limit(4);

        (data as any[])?.forEach((wo) => {
          items.push({
            id: `wo-${wo.id}`,
            type: "approval",
            title: "Approval Required",
            description: `Review Job Card for ${wo.vehicle?.vehicle_number || "Vehicle"}`,
            time: wo.created_at,
            link: "/admin/requests?tab=work-approvals",
          });
        });
      }

      // 5. Service Due Reminders (due within 2 days or past date, or remaining km <= 500)
      if (serviceDueReminders > 0 || true) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 2);
        const targetDateStr = targetDate.toISOString().split("T")[0];

        const { data: dueVehicles } = await supabase
          .from("vehicles")
          .select(`
            id, vehicle_number, model, kilometers_driven, next_service_km, next_service_date,
            customer:customers(id, name, company_name, phone),
            primary_contact:customer_contacts(id, name, designation, phone)
          `)
          .or(`next_service_date.lte.${targetDateStr},next_service_km.not.is.null`)
          .limit(10);

        // Fetch existing 'informed' reminders to exclude acknowledged ones
        const { data: informedReminders } = await supabase
          .from("service_reminders")
          .select("vehicle_id, due_date, due_km")
          .eq("status", "informed");

        const informedSet = new Set(
          (informedReminders || []).map((r) => `${r.vehicle_id}_${r.due_date || ""}_${r.due_km || ""}`)
        );

        (dueVehicles || []).forEach((v: any) => {
          const isDateDue = v.next_service_date && v.next_service_date <= targetDateStr;
          const remainingKm = (v.next_service_km || 0) - (v.kilometers_driven || 0);
          const isKmDue = v.next_service_km && remainingKm <= 500;

          if (isDateDue || isKmDue) {
            const key = `${v.id}_${v.next_service_date || ""}_${v.next_service_km || ""}`;
            if (!informedSet.has(key)) {
              const compName = v.customer?.company_name || v.customer?.name || "Customer";
              const contactName = v.primary_contact?.name || v.customer?.name || "Customer Contact";
              const contactPhone = v.primary_contact?.phone || v.customer?.phone || null;

              let reason = "";
              if (isDateDue && isKmDue) reason = `Due on ${v.next_service_date} & ${remainingKm} km left`;
              else if (isDateDue) reason = `Due on ${v.next_service_date}`;
              else reason = `${remainingKm <= 0 ? "Overdue by " + Math.abs(remainingKm) : remainingKm} km left`;

              items.push({
                id: `serv-${v.id}`,
                type: "service_due",
                title: `Service Due: ${v.vehicle_number}`,
                description: `${compName} • ${reason} • Contact: ${contactName}`,
                time: v.next_service_date ? new Date(v.next_service_date).toISOString() : new Date().toISOString(),
                link: "/admin/service-due",
                vehicleId: v.id,
                vehicleNumber: v.vehicle_number,
                dueDate: v.next_service_date,
                dueKm: v.next_service_km,
                contactName,
                contactPhone,
              });
            }
          }
        });
      }

      setNotifications(items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
    } catch (err) {
      console.error("Error fetching notification details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchNotificationDetails();
    }
  }, [open, totalPending]);

  const activeItems = notifications.filter((n) => !dismissedIds.includes(n.id));

  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDismissedIds((prev) => [...prev, id]);
  };

  const handleAcknowledgeService = async (e: React.MouseEvent, item: NotificationItem) => {
    e.stopPropagation();
    if (!item.vehicleId) return;

    setAckingIds((prev) => [...prev, item.id]);
    try {
      const { error } = await supabase.from("service_reminders").insert({
        vehicle_id: item.vehicleId,
        due_date: item.dueDate || null,
        due_km: item.dueKm || null,
        service_type: "Routine Service",
        service_description: `Acknowledged via Notification Center by ${user?.full_name || "Admin"}`,
        trigger_type: item.dueKm ? "kilometer" : "date",
        status: "informed",
        informed_at: new Date().toISOString(),
        informed_by: user?.id,
        notes: `Customer contacted (${item.contactName || ""}). Confirmed informed.`,
      });

      if (error) throw error;

      toast({
        title: "Service Reminder Acknowledged",
        description: `Marked as Informed / Okay for ${item.vehicleNumber}. Archived to audit log.`,
      });

      // Remove from current list
      setNotifications((prev) => prev.filter((n) => n.id !== item.id));
      await refreshCounts();
    } catch (err: any) {
      console.error("Error acknowledging service reminder:", err);
      toast({
        title: "Acknowledgment Failed",
        description: err.message || "Could not save acknowledgment",
        variant: "destructive",
      });
    } finally {
      setAckingIds((prev) => prev.filter((id) => id !== item.id));
    }
  };

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "service_due":
        return <Wrench className="h-4 w-4 text-amber-500" />;
      case "appointment":
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case "urgent":
        return <AlertCircle className="h-4 w-4 text-rose-500" />;
      case "part":
        return <Package className="h-4 w-4 text-amber-500" />;
      case "approval":
        return <FileText className="h-4 w-4 text-emerald-500" />;
      default:
        return <Bell className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-xl h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          title="Notifications & Approvals"
        >
          <Bell className="h-5 w-5" />
          {totalPending > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              {urgentAppointments > 0 || serviceDueReminders > 0 ? (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              ) : null}
              <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600 text-[9px] font-black text-white items-center justify-center">
                {totalPending > 9 ? "9+" : totalPending}
              </span>
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 sm:w-96 p-0 rounded-2xl shadow-xl border-border/80 overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b bg-muted/40">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Notifications</span>
            {totalPending > 0 && (
              <Badge variant="secondary" className="text-[11px] font-bold px-1.5 py-0">
                {totalPending} pending
              </Badge>
            )}
            {serviceDueReminders > 0 && (
              <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 border-amber-300 dark:border-amber-800 text-[10px] px-1.5 py-0">
                {serviceDueReminders} service due
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 text-primary hover:text-primary font-medium"
            onClick={() => {
              setOpen(false);
              navigate("/admin/requests");
            }}
          >
            Inbox
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>

        <ScrollArea className="max-h-[380px]">
          {activeItems.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <CheckCheck className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-foreground">Inbox Zero</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                All requests, appointments, and service reminders are up to date!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {activeItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setOpen(false);
                    navigate(item.link);
                  }}
                  className="p-3 hover:bg-muted/50 cursor-pointer transition-colors flex items-start gap-3 group relative"
                >
                  <div className="p-2 rounded-xl bg-muted shrink-0 mt-0.5">
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold truncate group-hover:text-primary transition-colors">
                        {item.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                        {item.time ? formatDistanceToNow(new Date(item.time), { addSuffix: true }) : ""}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                      {item.description}
                    </p>

                    {item.type === "service_due" && (
                      <div className="flex items-center gap-2 mt-2 pt-1 border-t border-border/40">
                        {item.contactPhone && (
                          <a
                            href={`tel:${item.contactPhone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-md transition-colors"
                          >
                            <Phone className="h-3 w-3" />
                            Call
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={ackingIds.includes(item.id)}
                          onClick={(e) => handleAcknowledgeService(e, item)}
                          className="h-6 text-[10px] px-2 font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60"
                        >
                          <Check className="h-3 w-3 mr-1 text-emerald-600" />
                          {ackingIds.includes(item.id) ? "Saving..." : "Informed / Okay"}
                        </Button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDismiss(e, item.id)}
                    className="text-muted-foreground/40 hover:text-muted-foreground p-1 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                    title="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-2.5 border-t bg-muted/20 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-xs font-medium text-muted-foreground hover:text-foreground h-8"
            onClick={() => {
              setOpen(false);
              navigate("/admin/service-due");
            }}
          >
            <Wrench className="h-3.5 w-3.5 mr-1 text-amber-500" />
            Service Due ({serviceDueReminders})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-xs font-medium text-muted-foreground hover:text-foreground h-8"
            onClick={() => {
              setOpen(false);
              navigate("/admin/requests");
            }}
          >
            Approvals & Inbox
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
