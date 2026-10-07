import React from "react";
import { useReminders } from "@/contexts/RemindersContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Clock,
  CheckCircle2,
  VolumeX,
  Car,
  User,
  AlertTriangle,
} from "lucide-react";

export const GlobalAlarmModal: React.FC = () => {
  const {
    activeAlarm,
    dismissActiveAlarm,
    markActiveAlarmDone,
    snoozeAlarm,
  } = useReminders();

  if (!activeAlarm) return null;

  const categoryLabels: Record<string, { label: string; color: string }> = {
    general: { label: "General", color: "bg-slate-100 text-slate-800 border-slate-300" },
    customer: { label: "Customer Call", color: "bg-blue-100 text-blue-800 border-blue-300" },
    vendor_parts: { label: "Parts & Vendor", color: "bg-amber-100 text-amber-800 border-amber-300" },
    payment: { label: "Payment Follow-up", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    workshop: { label: "Workshop Task", color: "bg-purple-100 text-purple-800 border-purple-300" },
    urgent: { label: "Urgent Action", color: "bg-red-100 text-red-800 border-red-300" },
  };

  const catMeta = categoryLabels[activeAlarm.category] || categoryLabels.general;

  return (
    <Dialog open={!!activeAlarm} onOpenChange={(open) => !open && dismissActiveAlarm()}>
      <DialogContent className="sm:max-w-md border-2 border-amber-500/60 shadow-2xl bg-white dark:bg-slate-950 overflow-hidden">
        {/* Pulsing alarm banner */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-red-500 to-amber-500 animate-pulse" />

        <DialogHeader className="pt-2">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 animate-bounce">
              <Bell className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className={`text-xs font-semibold ${catMeta.color}`}>
                  {catMeta.label}
                </Badge>
                {activeAlarm.priority === "urgent" && (
                  <Badge variant="destructive" className="text-xs flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Urgent
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {activeAlarm.title}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            AmmaAuto Scheduled Alarm Alert
          </DialogDescription>
        </DialogHeader>

        {/* Content body */}
        <div className="space-y-4 my-2">
          {activeAlarm.description && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {activeAlarm.description}
            </div>
          )}

          {/* Linked Vehicle / Customer */}
          {(activeAlarm.vehicle || activeAlarm.customer) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {activeAlarm.vehicle && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 font-medium">
                  <Car className="h-3.5 w-3.5" />
                  <span>{activeAlarm.vehicle.vehicle_number}</span>
                  {activeAlarm.vehicle.model && (
                    <span className="opacity-70">({activeAlarm.vehicle.model})</span>
                  )}
                </div>
              )}
              {activeAlarm.customer && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 font-medium">
                  <User className="h-3.5 w-3.5" />
                  <span>{activeAlarm.customer.name}</span>
                  {activeAlarm.customer.phone && (
                    <span className="opacity-70">({activeAlarm.customer.phone})</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mini Checklist preview if any */}
          {activeAlarm.checklist && activeAlarm.checklist.length > 0 && (
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-1.5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Checklist ({activeAlarm.checklist.filter((c) => c.completed).length}/
                {activeAlarm.checklist.length})
              </span>
              {activeAlarm.checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-xs">
                  <div
                    className={`h-3 w-3 rounded-sm border ${
                      item.completed
                        ? "bg-emerald-500 border-emerald-600"
                        : "border-slate-400 dark:border-slate-600"
                    }`}
                  />
                  <span
                    className={
                      item.completed ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-300"
                    }
                  >
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 h-11"
              onClick={markActiveAlarmDone}
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark as Done
            </Button>

            <Button
              variant="outline"
              className="h-11 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
              onClick={dismissActiveAlarm}
            >
              <VolumeX className="h-4 w-4 mr-1.5 text-slate-500" />
              Silence
            </Button>
          </div>

          <div className="pt-1">
            <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 text-center">
              Snooze Alarm
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                className="text-xs h-8"
                onClick={() => snoozeAlarm(activeAlarm.id, 5)}
              >
                <Clock className="h-3 w-3 mr-1 opacity-70" />
                5 mins
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="text-xs h-8"
                onClick={() => snoozeAlarm(activeAlarm.id, 15)}
              >
                <Clock className="h-3 w-3 mr-1 opacity-70" />
                15 mins
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="text-xs h-8"
                onClick={() => snoozeAlarm(activeAlarm.id, 60)}
              >
                <Clock className="h-3 w-3 mr-1 opacity-70" />
                1 hour
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
