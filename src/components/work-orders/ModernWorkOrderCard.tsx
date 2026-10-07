import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VehiclePlateBadge } from "@/components/shared/VehiclePlateBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Eye,
  Trash2,
  MoreVertical,
  Play,
  CheckCircle,
  RefreshCw,
  ClipboardCheck,
  Receipt,
  Clock,
  Clock5,
  AlertTriangle,
  User,
  Building2,
  Calendar,
  ArrowRight,
  ShieldAlert,
  Wrench,
  CheckCircle2,
} from "lucide-react";

interface ModernWorkOrderCardProps {
  order: any;
  deliveryInfo: {
    formatted: string;
    status: "normal" | "urgent" | "overdue";
    color: string;
  };
  onViewDetails: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAdvanceStage: (id: string, currentStage: string) => void;
  onDelete: (order: any) => void;
  onInvoice?: (id: string) => void;
  onReopen?: (id: string) => void;
}

export const ModernWorkOrderCard: React.FC<ModernWorkOrderCardProps> = ({
  order,
  deliveryInfo,
  onViewDetails,
  onUpdateStatus,
  onAdvanceStage,
  onDelete,
  onInvoice,
  onReopen,
}) => {
  const isFinalized = ["completed", "approved", "delivered", "finalized"].includes(
    order.status.toLowerCase()
  );
  const isOverdue = deliveryInfo.status === "overdue" && !isFinalized;
  const isUrgent = (deliveryInfo.status === "urgent" || order.priority === "Urgent") && !isFinalized;

  // Determine stage progress (1 to 5)
  const stages = [
    { key: "triage", label: "Triage" },
    { key: "inspection", label: "Inspection" },
    { key: "repair", label: "Repair" },
    { key: "review", label: "QC / Review" },
    { key: "ready", label: "Ready" },
  ];

  const currentStageLower = (order.current_stage || "").toLowerCase();
  const getStageIndex = () => {
    if (isFinalized) return 5;
    if (currentStageLower.includes("ready") || currentStageLower.includes("delivery")) return 4;
    if (currentStageLower.includes("review") || currentStageLower.includes("qc") || currentStageLower.includes("inspection_completed")) return 3;
    if (currentStageLower.includes("repair") || currentStageLower.includes("work")) return 2;
    if (currentStageLower.includes("inspect")) return 1;
    return 0;
  };

  const stageIndex = getStageIndex();

  // Status badge helper
  const getStatusBadge = () => {
    const s = order.status.toLowerCase();
    if (s === "pending") {
      return (
        <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/40 font-semibold text-xs">
          Pending Triage
        </Badge>
      );
    }
    if (s === "pending approval") {
      return (
        <Badge variant="outline" className="border-purple-400 text-purple-700 bg-purple-50 dark:bg-purple-950/40 font-semibold text-xs">
          Pending Approval
        </Badge>
      );
    }
    if (s === "approved" || s === "ready") {
      return (
        <Badge variant="outline" className="border-emerald-500 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 font-semibold text-xs">
          Ready for Pickup
        </Badge>
      );
    }
    if (s === "completed" || s === "delivered") {
      return (
        <Badge variant="outline" className="border-slate-300 text-slate-700 bg-slate-100 dark:bg-slate-800 font-semibold text-xs">
          Delivered
        </Badge>
      );
    }
    if (s === "rejected" || s === "cancelled") {
      return (
        <Badge variant="destructive" className="font-semibold text-xs">
          {order.status}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 font-semibold text-xs">
        In Progress
      </Badge>
    );
  };

  // Card border & accent classes
  let borderAccentClass = "border-l-4 border-l-blue-500";
  let bgClass = "bg-white dark:bg-slate-900";

  if (isFinalized) {
    borderAccentClass = "border-l-4 border-l-emerald-500";
    bgClass = "bg-emerald-50/20 dark:bg-emerald-950/10";
  } else if (isOverdue) {
    borderAccentClass = "border-l-4 border-l-red-500";
    bgClass = "bg-red-50/25 dark:bg-red-950/15";
  } else if (isUrgent) {
    borderAccentClass = "border-l-4 border-l-amber-500";
    bgClass = "bg-amber-50/20 dark:bg-amber-950/10";
  }

  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${borderAccentClass} ${bgClass}`}
    >
      <div className="p-4 sm:p-5 space-y-4">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Vehicle Plate Badge */}
            <VehiclePlateBadge
              plateNumber={order.vehicle?.vehicle_number || "NO-PLATE"}
              size="md"
            />

            {/* Service Type */}
            <h3
              onClick={() => onViewDetails(order.id)}
              className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
            >
              {order.service_type || "General Service"}
            </h3>

            {/* WO ID */}
            <span className="text-xs font-mono font-medium text-slate-400 dark:text-slate-500">
              #WO-{order.id.slice(0, 6).toUpperCase()}
            </span>

            {/* Status Badge */}
            {getStatusBadge()}

            {/* Reopened state indicator */}
            {order.is_reopened && (
              <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950/40 text-[10px] font-bold">
                <RefreshCw className="h-2.5 w-2.5 mr-1" /> Reopened
              </Badge>
            )}

            {/* Overdue alert */}
            {isOverdue && (
              <Badge variant="destructive" className="text-xs animate-pulse font-bold">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Overdue
              </Badge>
            )}

            {/* Priority Flag */}
            {order.priority === "Urgent" && !isOverdue && (
              <Badge variant="destructive" className="text-xs font-bold">
                <Clock5 className="h-3 w-3 mr-1" />
                Urgent Priority
              </Badge>
            )}
          </div>

          {/* Right quick dropdown menu */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
              Created {new Date(order.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 text-xs">
                <DropdownMenuLabel>Work Order Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {order.status === "Pending" && (
                  <DropdownMenuItem onClick={() => onUpdateStatus(order.id, "In Progress")}>
                    <Play className="h-3.5 w-3.5 mr-2 text-blue-600" /> Accept Order
                  </DropdownMenuItem>
                )}

                {order.status === "Pending Approval" && (
                  <DropdownMenuItem onClick={() => onUpdateStatus(order.id, "Approved")}>
                    <CheckCircle className="h-3.5 w-3.5 mr-2 text-emerald-600" /> Approve Work
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem onClick={() => onAdvanceStage(order.id, order.current_stage)}>
                  <RefreshCw className="h-3.5 w-3.5 mr-2 text-indigo-600" /> Advance Stage
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => onViewDetails(order.id)}>
                  <ClipboardCheck className="h-3.5 w-3.5 mr-2" /> Full Details
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <div className="w-full text-destructive hover:bg-destructive/10 px-2 py-1.5 rounded-sm flex items-center cursor-pointer">
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Work Order
                    </div>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Work Order</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this work order? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => onDelete(order)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Customer, Driver & Description Strip */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs text-slate-600 dark:text-slate-300">
          <div className="md:col-span-8 space-y-1.5">
            {/* Customer & Company */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                <User className="h-3.5 w-3.5 text-slate-400" />
                {order.customer?.name || "Customer Not Assigned"}
                {order.customer?.company_name && (
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    ({order.customer.company_name})
                  </span>
                )}
              </span>

              {/* Driver info if linked */}
              {order.driver && (
                <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <span className="opacity-60">•</span>
                  <span>Driver: <strong className="text-slate-700 dark:text-slate-300">{order.driver.name}</strong></span>
                  {order.driver.driver_position && (
                    <span className="text-[10px] font-mono opacity-75">({order.driver.driver_position})</span>
                  )}
                </span>
              )}
            </div>

            {/* Description / Instructions */}
            {order.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                {order.description}
              </p>
            )}
          </div>

          {/* Delivery Due Date Pill */}
          <div className="md:col-span-4 flex md:justify-end items-start">
            {order.estimated_delivery_date && !isFinalized ? (
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                  isOverdue
                    ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:border-red-900"
                    : isUrgent
                    ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900"
                    : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:border-slate-700"
                }`}
              >
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>Delivery: {deliveryInfo.formatted}</span>
              </div>
            ) : isFinalized ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 text-xs font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Work Completed</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* 5-Stage Visual Workflow Stepper */}
        <div className="pt-2 pb-1 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <span>Workflow Stage</span>
            <span className="text-slate-700 dark:text-slate-300 capitalize font-bold">
              {order.current_stage || "Triage Stage"}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {stages.map((stg, idx) => {
              const isPastStep = idx < stageIndex;
              const isCurrent = idx === stageIndex;

              return (
                <div key={stg.key} className="space-y-1">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      isPastStep
                        ? "bg-emerald-500"
                        : isCurrent
                        ? "bg-blue-600 animate-pulse"
                        : "bg-slate-200 dark:bg-slate-800"
                    }`}
                  />
                  <div className="text-[10px] truncate text-center font-medium">
                    <span
                      className={
                        isCurrent
                          ? "text-blue-600 dark:text-blue-400 font-bold"
                          : isPastStep
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-slate-400"
                      }
                    >
                      {stg.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Action Strip */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-semibold"
              onClick={() => onViewDetails(order.id)}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" /> View Details
            </Button>

            {!isFinalized && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs font-semibold border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                onClick={() => onAdvanceStage(order.id, order.current_stage)}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Advance Stage
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {["ready", "ready for delivery", "completed", "delivered", "approved", "finalized"].includes(
              order.status.toLowerCase()
            ) && onInvoice && (
              <Button
                size="sm"
                className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                onClick={() => onInvoice(order.id)}
                title="1-Click Create / View Invoice"
              >
                <Receipt className="h-3.5 w-3.5 mr-1.5" /> Invoice
              </Button>
            )}

            {["approved", "completed", "delivered"].includes(order.status.toLowerCase()) && onReopen && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs font-semibold text-orange-700 dark:text-orange-300 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/40"
                onClick={() => onReopen(order.id)}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reopen
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
