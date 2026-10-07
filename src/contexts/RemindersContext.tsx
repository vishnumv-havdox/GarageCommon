import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ReminderItem, ReminderFormData, ChecklistItem, AlarmTone } from "@/types/reminders";
import { startAlarmLoop, stopAlarmLoop, playTone } from "@/utils/alarmSound";
import { sendBrowserNotification, requestNotificationPermission } from "@/utils/browserNotifications";

const LOCAL_STORAGE_KEY = "amma_reminders_and_notes_v1";

interface RemindersContextType {
  reminders: ReminderItem[];
  loading: boolean;
  activeAlarm: ReminderItem | null;
  todayAlarmsCount: number;
  overdueCount: number;
  createReminder: (data: ReminderFormData) => Promise<ReminderItem | null>;
  updateReminder: (id: string, data: Partial<ReminderFormData>) => Promise<boolean>;
  deleteReminder: (id: string) => Promise<boolean>;
  toggleComplete: (id: string) => Promise<boolean>;
  togglePin: (id: string) => Promise<boolean>;
  updateChecklist: (reminderId: string, checklist: ChecklistItem[]) => Promise<boolean>;
  snoozeAlarm: (id: string, minutes: number) => Promise<boolean>;
  dismissActiveAlarm: () => void;
  markActiveAlarmDone: () => Promise<void>;
  refreshReminders: () => Promise<void>;
  testAlarmTone: (tone: AlarmTone) => void;
  requestDesktopAlerts: () => Promise<NotificationPermission>;
}

const RemindersContext = createContext<RemindersContextType | undefined>(undefined);

export const RemindersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAlarm, setActiveAlarm] = useState<ReminderItem | null>(null);

  // Store IDs of reminders that were already triggered/handled in the current session
  const triggeredAlarmsRef = useRef<Set<string>>(new Set());
  const usingSupabaseTableRef = useRef<boolean | null>(null);

  // 1. Load initial data from localStorage as immediate cache
  const loadLocalReminders = (): ReminderItem[] => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Failed to load local reminders:", e);
    }
    return [];
  };

  const saveLocalReminders = (items: ReminderItem[]) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Failed to save local reminders:", e);
    }
  };

  // 2. Fetch reminders from Supabase or fallback
  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("reminders_and_notes" as any)
        .select(`
          *,
          vehicle:vehicles(id, vehicle_number, model),
          customer:customers(id, name, phone)
        `)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        // Table may not exist yet in Supabase schema cache
        console.info("Supabase reminders_and_notes table not yet available, using local storage:", error.message);
        usingSupabaseTableRef.current = false;
        const local = loadLocalReminders();
        setReminders(local);
      } else {
        usingSupabaseTableRef.current = true;
        const formatted: ReminderItem[] = (data || []).map((row: any) => ({
          ...row,
          checklist: Array.isArray(row.checklist) ? row.checklist : [],
        }));
        setReminders(formatted);
        saveLocalReminders(formatted);
      }
    } catch (err) {
      console.warn("Error fetching reminders, using local cache:", err);
      const local = loadLocalReminders();
      setReminders(local);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  // 3. Periodic alarm checker (every 10 seconds)
  useEffect(() => {
    const checkAlarms = () => {
      // If an alarm is already ringing, don't interrupt
      if (activeAlarm) return;

      const now = new Date().getTime();

      for (const item of reminders) {
        if (item.is_completed || !item.has_alarm) continue;

        // Check snoozed time or due time
        const targetTimeStr = item.snoozed_until || item.due_at;
        if (!targetTimeStr) continue;

        const targetTime = new Date(targetTimeStr).getTime();
        // Alarm triggers if target time is in the past, but not older than 12 hours
        const diffMinutes = (now - targetTime) / (1000 * 60);

        if (diffMinutes >= 0 && diffMinutes <= 720) {
          const alarmKey = `${item.id}_${targetTimeStr}`;
          if (!triggeredAlarmsRef.current.has(alarmKey)) {
            triggeredAlarmsRef.current.add(alarmKey);
            triggerAlarm(item);
            break;
          }
        }
      }
    };

    const interval = setInterval(checkAlarms, 10000);
    checkAlarms(); // Run initial check

    return () => clearInterval(interval);
  }, [reminders, activeAlarm]);

  // Trigger an alarm
  const triggerAlarm = (reminder: ReminderItem) => {
    setActiveAlarm(reminder);
    startAlarmLoop(reminder.alarm_tone || "chime", 0.6);

    // Desktop notification
    sendBrowserNotification(`Alarm: ${reminder.title}`, {
      body: reminder.description || "You have an active AmmaAuto reminder due now.",
      tag: `alarm-${reminder.id}`,
    });
  };

  // Dismiss / Silence active alarm
  const dismissActiveAlarm = () => {
    stopAlarmLoop();
    setActiveAlarm(null);
  };

  // Snooze active alarm
  const snoozeAlarm = async (id: string, minutes: number): Promise<boolean> => {
    stopAlarmLoop();
    setActiveAlarm(null);

    const snoozeDate = new Date(Date.now() + minutes * 60 * 1000).toISOString();

    const success = await updateReminder(id, {
      due_at: snoozeDate,
    });

    if (success) {
      toast({
        title: "Alarm Snoozed",
        description: `Reminder will ring again in ${minutes} minutes.`,
      });
    }
    return success;
  };

  // Mark active alarm as completed
  const markActiveAlarmDone = async () => {
    if (!activeAlarm) return;
    const id = activeAlarm.id;
    stopAlarmLoop();
    setActiveAlarm(null);
    await toggleComplete(id);
  };

  // Create new reminder
  const createReminder = async (formData: ReminderFormData): Promise<ReminderItem | null> => {
    const newItem: ReminderItem = {
      id: crypto.randomUUID(),
      user_id: user?.id || null,
      title: formData.title,
      description: formData.description || null,
      category: formData.category || "general",
      priority: formData.priority || "medium",
      color: formData.color || "amber",
      due_at: formData.due_at || null,
      has_alarm: formData.has_alarm || false,
      alarm_tone: formData.alarm_tone || "chime",
      is_completed: false,
      completed_at: null,
      snoozed_until: null,
      is_pinned: formData.is_pinned || false,
      checklist: formData.checklist || [],
      vehicle_id: formData.vehicle_id || null,
      customer_id: formData.customer_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Attempt Supabase insert if available
    let insertedInDb = false;
    if (usingSupabaseTableRef.current !== false) {
      try {
        const { data, error } = await supabase
          .from("reminders_and_notes" as any)
          .insert({
            title: newItem.title,
            description: newItem.description,
            category: newItem.category,
            priority: newItem.priority,
            color: newItem.color,
            due_at: newItem.due_at,
            has_alarm: newItem.has_alarm,
            alarm_tone: newItem.alarm_tone,
            is_completed: false,
            is_pinned: newItem.is_pinned,
            checklist: newItem.checklist,
            vehicle_id: newItem.vehicle_id,
            customer_id: newItem.customer_id,
          })
          .select(`
            *,
            vehicle:vehicles(id, vehicle_number, model),
            customer:customers(id, name, phone)
          `)
          .single();

        if (!error && data) {
          insertedInDb = true;
          const freshItem: ReminderItem = {
            ...data,
            checklist: Array.isArray(data.checklist) ? data.checklist : [],
          };
          setReminders((prev) => [freshItem, ...prev]);
          saveLocalReminders([freshItem, ...reminders]);
          return freshItem;
        }
      } catch (err) {
        console.warn("DB insert error, falling back to local:", err);
      }
    }

    // Local fallback
    const updated = [newItem, ...reminders];
    setReminders(updated);
    saveLocalReminders(updated);
    return newItem;
  };

  // Update existing reminder
  const updateReminder = async (id: string, patch: Partial<ReminderFormData>): Promise<boolean> => {
    const updated = reminders.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          ...patch,
          updated_at: new Date().toISOString(),
        };
      }
      return item;
    });
    setReminders(updated);
    saveLocalReminders(updated);

    // Try DB update
    if (usingSupabaseTableRef.current !== false) {
      try {
        await supabase
          .from("reminders_and_notes" as any)
          .update({
            ...patch,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
      } catch (e) {
        console.warn("DB update sync error:", e);
      }
    }
    return true;
  };

  // Delete reminder
  const deleteReminder = async (id: string): Promise<boolean> => {
    const filtered = reminders.filter((item) => item.id !== id);
    setReminders(filtered);
    saveLocalReminders(filtered);

    if (activeAlarm?.id === id) {
      stopAlarmLoop();
      setActiveAlarm(null);
    }

    if (usingSupabaseTableRef.current !== false) {
      try {
        await supabase
          .from("reminders_and_notes" as any)
          .delete()
          .eq("id", id);
      } catch (e) {
        console.warn("DB delete error:", e);
      }
    }
    return true;
  };

  // Toggle Complete
  const toggleComplete = async (id: string): Promise<boolean> => {
    const current = reminders.find((r) => r.id === id);
    if (!current) return false;

    const nextCompleted = !current.is_completed;
    const completedAt = nextCompleted ? new Date().toISOString() : null;

    const updated = reminders.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          is_completed: nextCompleted,
          completed_at: completedAt,
          updated_at: new Date().toISOString(),
        };
      }
      return item;
    });

    setReminders(updated);
    saveLocalReminders(updated);

    if (activeAlarm?.id === id) {
      stopAlarmLoop();
      setActiveAlarm(null);
    }

    if (usingSupabaseTableRef.current !== false) {
      try {
        await supabase
          .from("reminders_and_notes" as any)
          .update({
            is_completed: nextCompleted,
            completed_at: completedAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
      } catch (e) {
        console.warn("DB toggle complete error:", e);
      }
    }

    toast({
      title: nextCompleted ? "Reminder Completed" : "Marked Incomplete",
      description: current.title,
    });
    return true;
  };

  // Toggle Pin
  const togglePin = async (id: string): Promise<boolean> => {
    const current = reminders.find((r) => r.id === id);
    if (!current) return false;

    const nextPinned = !current.is_pinned;
    const updated = reminders.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          is_pinned: nextPinned,
          updated_at: new Date().toISOString(),
        };
      }
      return item;
    });

    // Re-sort with pinned on top
    updated.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));

    setReminders(updated);
    saveLocalReminders(updated);

    if (usingSupabaseTableRef.current !== false) {
      try {
        await supabase
          .from("reminders_and_notes" as any)
          .update({
            is_pinned: nextPinned,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
      } catch (e) {
        console.warn("DB toggle pin error:", e);
      }
    }
    return true;
  };

  // Update Checklist
  const updateChecklist = async (reminderId: string, checklist: ChecklistItem[]): Promise<boolean> => {
    const updated = reminders.map((item) => {
      if (item.id === reminderId) {
        return {
          ...item,
          checklist,
          updated_at: new Date().toISOString(),
        };
      }
      return item;
    });
    setReminders(updated);
    saveLocalReminders(updated);

    if (usingSupabaseTableRef.current !== false) {
      try {
        await supabase
          .from("reminders_and_notes" as any)
          .update({
            checklist,
            updated_at: new Date().toISOString(),
          })
          .eq("id", reminderId);
      } catch (e) {
        console.warn("DB update checklist error:", e);
      }
    }
    return true;
  };

  // Test Tone
  const testAlarmTone = (tone: AlarmTone) => {
    playTone(tone, 0.6);
  };

  // Request notifications
  const requestDesktopAlerts = async () => {
    return await requestNotificationPermission();
  };

  // Compute stats
  const now = new Date();
  const todayAlarmsCount = reminders.filter((r) => {
    if (r.is_completed || !r.has_alarm || !r.due_at) return false;
    const dueDate = new Date(r.due_at);
    return (
      dueDate.getDate() === now.getDate() &&
      dueDate.getMonth() === now.getMonth() &&
      dueDate.getFullYear() === now.getFullYear()
    );
  }).length;

  const overdueCount = reminders.filter((r) => {
    if (r.is_completed || !r.due_at) return false;
    return new Date(r.due_at) < now;
  }).length;

  return (
    <RemindersContext.Provider
      value={{
        reminders,
        loading,
        activeAlarm,
        todayAlarmsCount,
        overdueCount,
        createReminder,
        updateReminder,
        deleteReminder,
        toggleComplete,
        togglePin,
        updateChecklist,
        snoozeAlarm,
        dismissActiveAlarm,
        markActiveAlarmDone,
        refreshReminders: fetchReminders,
        testAlarmTone,
        requestDesktopAlerts,
      }}
    >
      {children}
    </RemindersContext.Provider>
  );
};

export const useReminders = () => {
  const context = useContext(RemindersContext);
  if (!context) {
    throw new Error("useReminders must be used within a RemindersProvider");
  }
  return context;
};
