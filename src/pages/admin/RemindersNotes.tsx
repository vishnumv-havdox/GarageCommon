import React, { useState, useMemo } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useReminders } from "@/contexts/RemindersContext";
import { ReminderItem, ReminderCategory, ReminderPriority } from "@/types/reminders";
import { ReminderCard } from "@/components/reminders/ReminderCard";
import { ReminderFormModal } from "@/components/reminders/ReminderFormModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Bell,
  Clock,
  Pin,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  SlidersHorizontal,
  Volume2,
  Calendar,
  X,
} from "lucide-react";
import { isPast, isToday } from "date-fns";

export default function RemindersNotes() {
  const {
    reminders,
    loading,
    todayAlarmsCount,
    overdueCount,
    refreshReminders,
    testAlarmTone,
    requestDesktopAlerts,
  } = useReminders();

  const [activeTab, setActiveTab] = useState<"all" | "alarms" | "sticky" | "completed">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderItem | null>(null);

  const handleOpenCreate = () => {
    setEditingReminder(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (reminder: ReminderItem) => {
    setEditingReminder(reminder);
    setIsModalOpen(true);
  };

  // Filtered lists
  const filteredReminders = useMemo(() => {
    return reminders.filter((item) => {
      // Tab filter
      if (activeTab === "completed" && !item.is_completed) return false;
      if (activeTab !== "completed" && item.is_completed) return false;
      if (activeTab === "alarms" && !item.has_alarm) return false;
      if (activeTab === "sticky" && !item.is_pinned && item.checklist.length === 0 && !item.description) {
        // sticky board shows rich notes
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesDesc = item.description?.toLowerCase().includes(query) || false;
        const matchesVehicle = item.vehicle?.vehicle_number?.toLowerCase().includes(query) || false;
        const matchesCustomer = item.customer?.name?.toLowerCase().includes(query) || false;
        const matchesChecklist = item.checklist.some((c) => c.text.toLowerCase().includes(query));
        if (!matchesTitle && !matchesDesc && !matchesVehicle && !matchesCustomer && !matchesChecklist) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }

      // Priority filter
      if (priorityFilter !== "all" && item.priority !== priorityFilter) {
        return false;
      }

      return true;
    });
  }, [reminders, activeTab, searchTerm, categoryFilter, priorityFilter]);

  // Separate pinned and regular for visual hierarchy
  const pinnedList = useMemo(() => {
    return filteredReminders.filter((r) => r.is_pinned);
  }, [filteredReminders]);

  const unpinnedList = useMemo(() => {
    return filteredReminders.filter((r) => !r.is_pinned);
  }, [filteredReminders]);

  // Overall counts
  const totalActive = reminders.filter((r) => !r.is_completed).length;
  const totalPinned = reminders.filter((r) => r.is_pinned && !r.is_completed).length;
  const totalCompleted = reminders.filter((r) => r.is_completed).length;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950">
      <div className="flex flex-col lg:flex-row">
        <AdminSidebar />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Reminders & Notes
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Workshop scratchpad, time-based audible alarms, follow-ups & daily to-dos
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs text-slate-700 dark:text-slate-200"
                onClick={() => testAlarmTone("chime")}
                title="Preview Chime Sound"
              >
                <Volume2 className="h-3.5 w-3.5 text-amber-600" />
                Test Sound
              </Button>

              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={refreshReminders}
                title="Refresh Reminders"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>

              <Button
                onClick={handleOpenCreate}
                className="h-9 bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5 shadow-sm"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                Add Reminder
              </Button>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
            <Card
              className={`border-slate-200 dark:border-slate-800 shadow-sm transition-all cursor-pointer hover:border-amber-400 ${
                activeTab === "alarms" ? "ring-2 ring-amber-500" : ""
              }`}
              onClick={() => setActiveTab("alarms")}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Alarms Due Today
                  </p>
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                    {todayAlarmsCount}
                  </p>
                  <p className="text-[11px] text-slate-400">Sound alerts configured</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
                  <Clock className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card
              className="border-slate-200 dark:border-slate-800 shadow-sm transition-all cursor-pointer hover:border-red-400"
              onClick={() => {
                setActiveTab("all");
                setPriorityFilter("urgent");
              }}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Overdue Tasks
                  </p>
                  <p
                    className={`text-2xl font-black mt-0.5 ${
                      overdueCount > 0 ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {overdueCount}
                  </p>
                  <p className="text-[11px] text-slate-400">Past target date/time</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-950/40 text-red-600 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card
              className="border-slate-200 dark:border-slate-800 shadow-sm transition-all cursor-pointer hover:border-blue-400"
              onClick={() => setActiveTab("sticky")}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Pinned Notes
                  </p>
                  <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
                    {totalPinned}
                  </p>
                  <p className="text-[11px] text-slate-400">Quick-access scratchpad</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                  <Pin className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card
              className={`border-slate-200 dark:border-slate-800 shadow-sm transition-all cursor-pointer hover:border-emerald-400 ${
                activeTab === "completed" ? "ring-2 ring-emerald-500" : ""
              }`}
              onClick={() => setActiveTab("completed")}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Completed
                  </p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {totalCompleted}
                  </p>
                  <p className="text-[11px] text-slate-400">Archived to-dos</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filters */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Tab navigation */}
              <Tabs
                value={activeTab}
                onValueChange={(v: any) => setActiveTab(v)}
                className="w-full sm:w-auto"
              >
                <TabsList className="grid grid-cols-4 w-full sm:w-auto bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <TabsTrigger value="all" className="text-xs font-semibold">
                    All ({totalActive})
                  </TabsTrigger>
                  <TabsTrigger value="alarms" className="text-xs font-semibold gap-1">
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                    Alarms
                  </TabsTrigger>
                  <TabsTrigger value="sticky" className="text-xs font-semibold gap-1">
                    <Pin className="h-3.5 w-3.5 text-blue-600" />
                    Sticky Board
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="text-xs font-semibold gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Done ({totalCompleted})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Desktop alerts permission button */}
              {typeof window !== "undefined" && "Notification" in window && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-slate-500 hover:text-amber-600 h-8 self-end sm:self-auto"
                  onClick={() => requestDesktopAlerts()}
                >
                  <Bell className="h-3.5 w-3.5 mr-1" />
                  {Notification.permission === "granted"
                    ? "Desktop Alerts Active"
                    : "Enable Desktop Alerts"}
                </Button>
              )}
            </div>

            {/* Search + Filter Selects */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="sm:col-span-6 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search reminders, notes, vehicle number, customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 text-xs sm:text-sm h-9"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="sm:col-span-3">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="customer">Customer Follow-up</SelectItem>
                    <SelectItem value="vendor_parts">Parts & Vendors</SelectItem>
                    <SelectItem value="payment">Billing & Accounts</SelectItem>
                    <SelectItem value="workshop">Workshop Operations</SelectItem>
                    <SelectItem value="urgent">Urgent Action</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-3">
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Cards Grid / Display */}
          {filteredReminders.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center bg-white/50 dark:bg-slate-900/40">
              <div className="h-16 w-16 mx-auto rounded-3xl bg-amber-500/10 flex items-center justify-center text-amber-600 mb-4">
                <Bell className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {searchTerm || categoryFilter !== "all" || priorityFilter !== "all"
                  ? "No matching reminders found"
                  : activeTab === "completed"
                  ? "No completed reminders yet"
                  : activeTab === "alarms"
                  ? "No active alarms scheduled"
                  : "Your scratchpad is empty"}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
                {searchTerm || categoryFilter !== "all"
                  ? "Try clearing filters to see all workshop notes and alarms."
                  : "Create quick notes, schedule reminders for customer calls or parts arrival, and never miss a garage deadline."}
              </p>
              <Button
                onClick={handleOpenCreate}
                className="bg-amber-600 hover:bg-amber-700 text-white font-medium gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Create New Reminder
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Section: Pinned Notes (if on 'all' or 'sticky') */}
              {activeTab !== "completed" && pinnedList.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Pin className="h-4 w-4 text-amber-600 fill-amber-500" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Pinned To-Dos & Notes ({pinnedList.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {pinnedList.map((item) => (
                      <ReminderCard key={item.id} reminder={item} onEdit={handleOpenEdit} />
                    ))}
                  </div>
                </div>
              )}

              {/* Section: Regular / Other Reminders */}
              {unpinnedList.length > 0 && (
                <div className="space-y-3">
                  {pinnedList.length > 0 && activeTab !== "completed" && (
                    <div className="flex items-center gap-2 px-1 pt-2">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Other Reminders & Notes ({unpinnedList.length})
                      </h2>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {unpinnedList.map((item) => (
                      <ReminderCard key={item.id} reminder={item} onEdit={handleOpenEdit} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Create / Edit Modal */}
          <ReminderFormModal
            open={isModalOpen}
            onOpenChange={setIsModalOpen}
            initialData={editingReminder}
          />
        </main>
      </div>
    </div>
  );
}
