import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useReminders } from "@/contexts/RemindersContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ReminderItem,
  ReminderFormData,
  ReminderCategory,
  ReminderPriority,
  ReminderColor,
  AlarmTone,
  ChecklistItem,
} from "@/types/reminders";
import {
  Bell,
  Clock,
  Pin,
  Plus,
  Trash2,
  Volume2,
  Car,
  User,
  CheckCircle2,
} from "lucide-react";
import { format, addHours } from "date-fns";

interface ReminderFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: ReminderItem | null;
}

export const ReminderFormModal: React.FC<ReminderFormModalProps> = ({
  open,
  onOpenChange,
  initialData,
}) => {
  const { createReminder, updateReminder, testAlarmTone, requestDesktopAlerts } = useReminders();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ReminderCategory>("general");
  const [priority, setPriority] = useState<ReminderPriority>("medium");
  const [color, setColor] = useState<ReminderColor>("amber");
  const [isPinned, setIsPinned] = useState(false);

  // Alarm settings
  const [hasAlarm, setHasAlarm] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [alarmTone, setAlarmTone] = useState<AlarmTone>("chime");

  // Checklist
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState("");

  // Linked entities
  const [vehicleId, setVehicleId] = useState<string>("none");
  const [customerId, setCustomerId] = useState<string>("none");

  // Database options
  const [vehiclesList, setVehiclesList] = useState<{ id: string; vehicle_number: string; model: string | null }[]>([]);
  const [customersList, setCustomersList] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Populate data when modal opens
  useEffect(() => {
    if (open) {
      if (initialData) {
        setTitle(initialData.title);
        setDescription(initialData.description || "");
        setCategory(initialData.category);
        setPriority(initialData.priority);
        setColor(initialData.color);
        setIsPinned(initialData.is_pinned);
        setHasAlarm(initialData.has_alarm);
        setAlarmTone(initialData.alarm_tone || "chime");
        setChecklist(initialData.checklist || []);
        setVehicleId(initialData.vehicle_id || "none");
        setCustomerId(initialData.customer_id || "none");

        if (initialData.due_at) {
          const d = new Date(initialData.due_at);
          setDueDate(format(d, "yyyy-MM-dd"));
          setDueTime(format(d, "HH:mm"));
        } else {
          const nowPlus1 = addHours(new Date(), 1);
          setDueDate(format(nowPlus1, "yyyy-MM-dd"));
          setDueTime(format(nowPlus1, "HH:00"));
        }
      } else {
        // Reset defaults
        setTitle("");
        setDescription("");
        setCategory("general");
        setPriority("medium");
        setColor("amber");
        setIsPinned(false);
        setHasAlarm(false);
        setAlarmTone("chime");
        setChecklist([]);
        setNewChecklistText("");
        setVehicleId("none");
        setCustomerId("none");

        const nowPlus1 = addHours(new Date(), 1);
        setDueDate(format(nowPlus1, "yyyy-MM-dd"));
        setDueTime(format(nowPlus1, "HH:00"));
      }

      // Fetch active vehicles & customers for quick dropdown tagging
      fetchDropdownData();
    }
  }, [open, initialData]);

  const fetchDropdownData = async () => {
    try {
      const [vRes, cRes] = await Promise.all([
        supabase.from("vehicles").select("id, vehicle_number, model").limit(50),
        supabase.from("customers").select("id, name, phone").limit(50),
      ]);
      if (vRes.data) setVehiclesList(vRes.data);
      if (cRes.data) setCustomersList(cRes.data);
    } catch (e) {
      console.warn("Error fetching vehicle/customer options:", e);
    }
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setChecklist((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text: newChecklistText.trim(),
        completed: false,
      },
    ]);
    setNewChecklistText("");
  };

  const handleRemoveChecklistItem = (itemId: string) => {
    setChecklist((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleToggleChecklistItem = (itemId: string) => {
    setChecklist((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, completed: !i.completed } : i))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);

    let dueAtIso: string | null = null;
    if (hasAlarm && dueDate && dueTime) {
      dueAtIso = new Date(`${dueDate}T${dueTime}`).toISOString();
    } else if (dueDate && dueTime) {
      dueAtIso = new Date(`${dueDate}T${dueTime}`).toISOString();
    }

    const payload: ReminderFormData = {
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      priority,
      color,
      is_pinned: isPinned,
      has_alarm: hasAlarm,
      alarm_tone: alarmTone,
      due_at: dueAtIso,
      checklist,
      vehicle_id: vehicleId === "none" ? undefined : vehicleId,
      customer_id: customerId === "none" ? undefined : customerId,
    };

    if (hasAlarm) {
      requestDesktopAlerts();
    }

    if (initialData) {
      await updateReminder(initialData.id, payload);
    } else {
      await createReminder(payload);
    }

    setSubmitting(false);
    onOpenChange(false);
  };

  const colorOptions: { id: ReminderColor; name: string; bg: string; border: string }[] = [
    { id: "amber", name: "Amber Gold", bg: "bg-amber-400", border: "border-amber-500" },
    { id: "blue", name: "Sky Blue", bg: "bg-sky-400", border: "border-sky-500" },
    { id: "emerald", name: "Emerald Green", bg: "bg-emerald-400", border: "border-emerald-500" },
    { id: "purple", name: "Violet", bg: "bg-purple-400", border: "border-purple-500" },
    { id: "rose", name: "Rose Pink", bg: "bg-rose-400", border: "border-rose-500" },
    { id: "slate", name: "Graphite", bg: "bg-slate-400", border: "border-slate-500" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-600" />
              {initialData ? "Edit Reminder or Note" : "Create Reminder / Note"}
            </DialogTitle>
            <Button
              type="button"
              variant={isPinned ? "default" : "outline"}
              size="sm"
              className={`h-8 gap-1.5 text-xs ${
                isPinned ? "bg-amber-600 hover:bg-amber-700 text-white" : ""
              }`}
              onClick={() => setIsPinned(!isPinned)}
            >
              <Pin className={`h-3.5 w-3.5 ${isPinned ? "fill-current" : ""}`} />
              {isPinned ? "Pinned to Top" : "Pin Note"}
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-sm font-semibold">
              Title / Task Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g. Call supplier for brake pads, Collect invoice payment..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="font-medium text-base"
              autoFocus
            />
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Category
              </Label>
              <Select value={category} onValueChange={(v: ReminderCategory) => setCategory(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="customer">Customer Follow-up</SelectItem>
                  <SelectItem value="vendor_parts">Parts & Vendors</SelectItem>
                  <SelectItem value="payment">Billing & Accounts</SelectItem>
                  <SelectItem value="workshop">Workshop Operations</SelectItem>
                  <SelectItem value="urgent">Urgent Action</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Priority
              </Label>
              <Select value={priority} onValueChange={(v: ReminderPriority) => setPriority(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Priority</SelectItem>
                  <SelectItem value="medium">Medium Priority</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                  <SelectItem value="urgent">Urgent Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Color Tag Picker */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Note Card Color
            </Label>
            <div className="flex items-center gap-2.5 pt-1">
              {colorOptions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  title={c.name}
                  className={`h-7 w-7 rounded-full ${c.bg} transition-all flex items-center justify-center ${
                    color === c.id
                      ? "ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-110"
                      : "opacity-70 hover:opacity-100 hover:scale-105"
                  }`}
                >
                  {color === c.id && <CheckCircle2 className="h-4 w-4 text-white stroke-[2.5]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Description / Content */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Details / Scratchpad Notes
            </Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Add extra instructions, contact numbers, parts specifications, or key notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none text-sm"
            />
          </div>

          {/* Alarm & Scheduled Time Toggle */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/70 dark:bg-slate-900/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-600">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    Set Alarm & Due Notification
                  </div>
                  <div className="text-xs text-slate-500">
                    Plays sound & sends alert popup when time strikes
                  </div>
                </div>
              </div>
              <Switch checked={hasAlarm} onCheckedChange={setHasAlarm} />
            </div>

            {hasAlarm && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Alarm Date
                  </Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required={hasAlarm}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Alarm Time
                  </Label>
                  <Input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    required={hasAlarm}
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Chime Sound Tone
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-amber-600 hover:text-amber-700"
                      onClick={() => testAlarmTone(alarmTone)}
                    >
                      <Volume2 className="h-3 w-3 mr-1" />
                      Test Tone
                    </Button>
                  </div>
                  <Select value={alarmTone} onValueChange={(t: AlarmTone) => setAlarmTone(t)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chime">Gentle Chime (Bell Tone)</SelectItem>
                      <SelectItem value="digital">Digital Pulse (Pulsed Alarm)</SelectItem>
                      <SelectItem value="bell">Workshop Bell (Standard Ring)</SelectItem>
                      <SelectItem value="radar">Radar Signal (Sonar Alert)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Mini Checklist Builder */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              To-Do Checklist Items ({checklist.length})
            </Label>

            {checklist.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleChecklistItem(item.id)}
                      className="flex items-center gap-2 text-left flex-1"
                    >
                      <div
                        className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                          item.completed
                            ? "bg-emerald-500 border-emerald-600 text-white"
                            : "border-slate-300 dark:border-slate-600"
                        }`}
                      >
                        {item.completed && <CheckCircle2 className="h-3 w-3" />}
                      </div>
                      <span className={item.completed ? "line-through text-slate-400" : "text-slate-800 dark:text-slate-200"}>
                        {item.text}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveChecklistItem(item.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="Add a checklist bullet item..."
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddChecklistItem();
                  }
                }}
                className="h-8 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={handleAddChecklistItem}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>
          </div>

          {/* Optional Tagging to Vehicle or Customer */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Car className="h-3 w-3 text-blue-500" />
                Tag Vehicle (Optional)
              </Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  <SelectItem value="none">None</SelectItem>
                  {vehiclesList.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.vehicle_number} {v.model ? `(${v.model})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <User className="h-3 w-3 text-emerald-500" />
                Tag Customer (Optional)
              </Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  <SelectItem value="none">None</SelectItem>
                  {customersList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
              disabled={submitting || !title.trim()}
            >
              {submitting ? "Saving..." : initialData ? "Save Changes" : "Create Reminder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
