import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Calendar, AlertCircle, Package, FileText, ArrowRight, CheckCheck, X } from "lucide-react";
import { useRequests } from "@/contexts/RequestsContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

interface NotificationItem {
  id: string;
  type: "appointment" | "urgent" | "part" | "approval";
  title: string;
  description: string;
  time: string;
  link: string;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { totalPending, urgentAppointments, pendingAppointments, pendingPartRequests, pendingWorkApprovals } = useRequests();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

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

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
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
              {urgentAppointments > 0 && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              )}
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

        <ScrollArea className="max-h-[340px]">
          {activeItems.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <CheckCheck className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-foreground">Inbox Zero</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                All requests, appointments, and approvals are up to date!
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
                  className="p-3 hover:bg-muted/50 cursor-pointer transition-colors flex items-start gap-3 group"
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
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                      {item.description}
                    </p>
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

        <div className="p-2.5 border-t bg-muted/20 text-center">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs font-medium text-muted-foreground hover:text-foreground h-8"
            onClick={() => {
              setOpen(false);
              navigate("/admin/requests");
            }}
          >
            Go to Approvals & Inbox
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
