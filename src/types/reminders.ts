export type ReminderCategory =
  | "general"
  | "customer"
  | "vendor_parts"
  | "payment"
  | "workshop"
  | "urgent";

export type ReminderPriority = "low" | "medium" | "high" | "urgent";

export type ReminderColor = "amber" | "blue" | "emerald" | "purple" | "rose" | "slate";

export type AlarmTone = "chime" | "digital" | "bell" | "radar";

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface ReminderItem {
  id: string;
  user_id?: string | null;
  title: string;
  description?: string | null;
  category: ReminderCategory;
  priority: ReminderPriority;
  color: ReminderColor;
  due_at?: string | null;
  has_alarm: boolean;
  alarm_tone?: AlarmTone;
  is_completed: boolean;
  completed_at?: string | null;
  snoozed_until?: string | null;
  is_pinned: boolean;
  checklist: ChecklistItem[];
  vehicle_id?: string | null;
  vehicle?: {
    id: string;
    vehicle_number: string;
    model?: string | null;
  } | null;
  customer_id?: string | null;
  customer?: {
    id: string;
    name: string;
    phone?: string | null;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface ReminderFormData {
  title: string;
  description?: string;
  category: ReminderCategory;
  priority: ReminderPriority;
  color: ReminderColor;
  due_at?: string | null;
  has_alarm: boolean;
  alarm_tone?: AlarmTone;
  is_pinned?: boolean;
  checklist?: ChecklistItem[];
  vehicle_id?: string | null;
  customer_id?: string | null;
}
