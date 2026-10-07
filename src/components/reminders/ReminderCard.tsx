import React from "react";
import { ReminderItem, ReminderColor } from "@/types/reminders";
import { useReminders } from "@/contexts/RemindersContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pin,
  Clock,
  Bell,
  CheckCircle2,
  Circle,
  MoreVertical,
  Edit2,
  Trash2,
  Car,
  User,
  AlertTriangle,
  Volume2,
} from "lucide-react";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";

interface ReminderCardProps {
  reminder: ReminderItem;
  onEdit: (reminder: ReminderItem) => void;
}

export const ReminderCard: React.FC<ReminderCardProps> = ({ reminder, onEdit }) => {
  const {
    toggleComplete,
    togglePin,
    deleteReminder,
    updateChecklist,
    snoozeAlarm,
    testAlarmTone,
  } = useReminders();

  const colorStyles: Record<
    ReminderColor,
    {
      cardBg: string;
      topBar: string;
      border: string;
      badgeBg: string;
      pinColor: string;
    }
  > = {
    amber: {
      cardBg: "bg-amber-50/70 dark:bg-amber-950/20",
      topBar: "bg-amber-500/20 text-amber-900 dark:text-amber-200",
      border: "border-amber-200/90 dark:border-amber-800/40",
      badgeBg: "bg-amber-100 text-amber-800 border-amber-300",
      pinColor: "text-amber-600 dark:text-amber-400 fill-amber-500",
    },
    blue: {
      cardBg: "bg-sky-50/70 dark:bg-sky-950/20",
      topBar: "bg-sky-500/20 text-sky-900 dark:text-sky-200",
      border: "border-sky-200/90 dark:border-sky-800/40",
      badgeBg: "bg-sky-100 text-sky-800 border-sky-300",
      pinColor: "text-sky-600 dark:text-sky-400 fill-sky-500",
    },
    emerald: {
      cardBg: "bg-emerald-50/70 dark:bg-emerald-950/20",
      topBar: "bg-emerald-500/20 text-emerald-900 dark:text-emerald-200",
      border: "border-emerald-200/90 dark:border-emerald-800/40",
      badgeBg: "bg-emerald-100 text-emerald-800 border-emerald-300",
      pinColor: "text-emerald-600 dark:text-emerald-400 fill-emerald-500",
    },
    purple: {
      cardBg: "bg-purple-50/70 dark:bg-purple-950/20",
      topBar: "bg-purple-500/20 text-purple-900 dark:text-purple-200",
      border: "border-purple-200/90 dark:border-purple-800/40",
      badgeBg: "bg-purple-100 text-purple-800 border-purple-300",
      pinColor: "text-purple-600 dark:text-purple-400 fill-purple-500",
    },
    rose: {
      cardBg: "bg-rose-50/70 dark:bg-rose-950/20",
      topBar: "bg-rose-500/20 text-rose-900 dark:text-rose-200",
      border: "border-rose-200/90 dark:border-rose-800/40",
      badgeBg: "bg-rose-100 text-rose-800 border-rose-300",
      pinColor: "text-rose-600 dark:text-rose-400 fill-rose-500",
    },
    slate: {
      cardBg: "bg-slate-50/80 dark:bg-slate-900/40",
      topBar: "bg-slate-500/15 text-slate-800 dark:text-slate-300",
      border: "border-slate-200 dark:border-slate-800",
      badgeBg: "bg-slate-100 text-slate-800 border-slate-300",
      pinColor: "text-slate-600 dark:text-slate-400 fill-slate-500",
    },
  };

  const currentTheme = colorStyles[reminder.color] || colorStyles.amber;

  const categoryLabels: Record<string, string> = {
    general: "General",
    customer: "Customer",
    vendor_parts: "Parts & Vendor",
    payment: "Payment",
    workshop: "Workshop",
    urgent: "Urgent",
  };

  const priorityMeta: Record<string, { label: string; class: string }> = {
    low: { label: "Low", class: "bg-slate-100 text-slate-700 border-slate-200" },
    medium: { label: "Medium", class: "bg-amber-100 text-amber-700 border-amber-200" },
    high: { label: "High", class: "bg-orange-100 text-orange-700 border-orange-200" },
    urgent: { label: "Urgent", class: "bg-red-100 text-red-700 border-red-200 animate-pulse" },
  };

  // Checklist stats
  const totalChecks = reminder.checklist?.length || 0;
  const completedChecks = reminder.checklist?.filter((c) => c.completed).length || 0;
  const checkProgress = totalChecks > 0 ? (completedChecks / totalChecks) * 100 : 0;

  const handleToggleCheck = (itemId: string) => {
    const nextList = reminder.checklist.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    updateChecklist(reminder.id, nextList);
  };

  // Due time calculation
  const getDueInfo = () => {
    if (!reminder.due_at) return null;
    const dueDate = new Date(reminder.due_at);
    const past = isPast(dueDate);
    const today = isToday(dueDate);

    let relativeText = formatDistanceToNow(dueDate, { addSuffix: true });
    let dateFormatted = format(dueDate, "MMM d, h:mm a");

    return {
      past,
      today,
      relativeText,
      dateFormatted,
    };
  };

  const dueInfo = getDueInfo();

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-2xl border ${
        currentTheme.border
      } ${currentTheme.cardBg} shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${
        reminder.is_completed ? "opacity-75 grayscale-[20%]" : ""
      }`}
    >
      {/* Top Banner & Header */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          {/* Category & Priority */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${currentTheme.badgeBg}`}
            >
              {categoryLabels[reminder.category] || "General"}
            </span>

            {reminder.priority !== "medium" && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  priorityMeta[reminder.priority]?.class
                }`}
              >
                {priorityMeta[reminder.priority]?.label}
              </span>
            )}

            {reminder.has_alarm && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-semibold">
                <Bell className="h-2.5 w-2.5" />
                Alarm
              </span>
            )}
          </div>

          {/* Quick Actions (Pin & Dropdown) */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => togglePin(reminder.id)}
              className={`p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                reminder.is_pinned ? currentTheme.pinColor : "text-slate-400 hover:text-slate-700"
              }`}
              title={reminder.is_pinned ? "Unpin note" : "Pin note to top"}
            >
              <Pin className={`h-4 w-4 ${reminder.is_pinned ? "fill-current" : ""}`} />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 text-xs">
                <DropdownMenuItem onClick={() => onEdit(reminder)}>
                  <Edit2 className="h-3.5 w-3.5 mr-2" />
                  Edit Reminder
                </DropdownMenuItem>

                {reminder.has_alarm && (
                  <>
                    <DropdownMenuItem
                      onClick={() => testAlarmTone(reminder.alarm_tone || "chime")}
                    >
                      <Volume2 className="h-3.5 w-3.5 mr-2 text-amber-600" />
                      Preview Alarm Tone
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => snoozeAlarm(reminder.id, 15)}>
                      <Clock className="h-3.5 w-3.5 mr-2 text-blue-600" />
                      Snooze 15 Mins
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => snoozeAlarm(reminder.id, 60)}>
                      <Clock className="h-3.5 w-3.5 mr-2 text-blue-600" />
                      Snooze 1 Hour
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => deleteReminder(reminder.id)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete Note
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Title */}
        <div>
          <h4
            className={`text-base font-bold text-slate-900 dark:text-white leading-snug cursor-pointer hover:underline ${
              reminder.is_completed ? "line-through text-slate-500 dark:text-slate-400" : ""
            }`}
            onClick={() => onEdit(reminder)}
          >
            {reminder.title}
          </h4>

          {/* Description */}
          {reminder.description && (
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {reminder.description}
            </p>
          )}
        </div>

        {/* Linked Vehicle / Customer Pill */}
        {(reminder.vehicle || reminder.customer) && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {reminder.vehicle && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50 text-[11px] font-medium">
                <Car className="h-3 w-3" />
                {reminder.vehicle.vehicle_number}
              </span>
            )}
            {reminder.customer && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 text-[11px] font-medium">
                <User className="h-3 w-3" />
                {reminder.customer.name}
              </span>
            )}
          </div>
        )}

        {/* Checklist inside note */}
        {totalChecks > 0 && (
          <div className="pt-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
              <span>
                To-Do ({completedChecks}/{totalChecks})
              </span>
              <span>{Math.round(checkProgress)}%</span>
            </div>
            <Progress value={checkProgress} className="h-1 bg-black/10 dark:bg-white/10" />

            <div className="space-y-1 pt-1 max-h-28 overflow-y-auto pr-1">
              {reminder.checklist.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleToggleCheck(item.id)}
                  className="w-full flex items-center gap-2 text-left text-xs py-0.5 hover:bg-black/5 dark:hover:bg-white/5 rounded px-1 transition-colors"
                >
                  <div
                    className={`h-3.5 w-3.5 rounded border flex items-center justify-center transition-colors ${
                      item.completed
                        ? "bg-emerald-500 border-emerald-600 text-white"
                        : "border-slate-400 dark:border-slate-500"
                    }`}
                  >
                    {item.completed && <CheckCircle2 className="h-2.5 w-2.5" />}
                  </div>
                  <span
                    className={
                      item.completed
                        ? "line-through text-slate-400"
                        : "text-slate-800 dark:text-slate-200 font-medium"
                    }
                  >
                    {item.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Due Date & Alarm pill */}
        {dueInfo && (
          <div
            className={`mt-2 flex items-center justify-between p-2 rounded-xl text-xs border ${
              reminder.is_completed
                ? "bg-slate-100 text-slate-500 border-slate-200"
                : dueInfo.past
                ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:border-red-900/50"
                : dueInfo.today
                ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50"
                : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/50"
            }`}
          >
            <div className="flex items-center gap-1.5 font-medium">
              <Clock className="h-3.5 w-3.5" />
              <span>{dueInfo.dateFormatted}</span>
            </div>

            <span className="text-[10px] font-semibold opacity-85">
              {!reminder.is_completed && dueInfo.past ? "Overdue" : dueInfo.relativeText}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Bar: Quick Mark Done & Created time */}
      <div className="px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.02] border-t border-black/[0.05] dark:border-white/[0.05] flex items-center justify-between text-xs">
        <button
          onClick={() => toggleComplete(reminder.id)}
          className={`flex items-center gap-1.5 font-semibold transition-colors ${
            reminder.is_completed
              ? "text-emerald-600 hover:text-emerald-700"
              : "text-slate-600 hover:text-emerald-600 dark:text-slate-400"
          }`}
        >
          {reminder.is_completed ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Completed</span>
            </>
          ) : (
            <>
              <Circle className="h-4 w-4" />
              <span>Mark Done</span>
            </>
          )}
        </button>

        <span className="text-[10px] text-slate-400">
          {format(new Date(reminder.created_at), "MMM d")}
        </span>
      </div>
    </div>
  );
};
