import { useState, useEffect, useMemo } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/integrations/supabase/adminClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { NavLink } from "react-router-dom";
import {
  Users,
  Shield,
  Plus,
  Search,
  Briefcase,
  Edit,
  Trash2,
  User,
  TrendingUp,
  LogIn,
  LogOut,
  Palmtree,
  Coffee,
  CalendarCheck,
  Zap,
  Clock,
  Loader2
} from "lucide-react";
import { EmployeeForm } from "@/components/forms/EmployeeForm";
import { EmployeeTracker } from "@/components/employees/EmployeeTracker";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SearchInput } from "@/components/shared/SearchInput";
import { format, isToday } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Position {
  id: string;
  name: string;
  department: string;
  access_level: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  position_id: string;
  access_level: "admin" | "manager" | "staff";
  salary?: number;
  status?: string;
  position?: Position;
  joining_date?: string;
  created_at?: string;
  attendance_self_service: boolean;
}

export default function AdminEmployees() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [selectedEmployeeForTracker, setSelectedEmployeeForTracker] = useState<Employee | null>(null);
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<Record<string, any>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [workforceSettings, setWorkforceSettings] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch employees with position info
      const { data: employeesData, error: empError } = await supabase
        .from("employees")
        .select(`
          *,
          position:positions(*)
        `)
        .order("name");

      if (empError) throw empError;

      // Fetch positions
      const { data: positionsData, error: posError } = await supabase
        .from("positions")
        .select("*")
        .order("department");

      if (posError) throw posError;

      setEmployees(employeesData || []);
      setPositions(positionsData || []);

      // Fetch today's attendance
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", today);

      const attMap: Record<string, any> = {};
      attendanceData?.forEach(att => {
        attMap[att.employee_id] = att;
      });
      setTodayAttendance(attMap);

      // Fetch workforce settings for calculations
      const { data: wfSettings } = await supabase
        .from("workforce_settings")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();
      setWorkforceSettings(wfSettings);

    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingEmployee(null);
    fetchData();
    toast({
      title: "Success",
      description: editingEmployee
        ? "Employee updated successfully"
        : "Employee added successfully",
    });
  };

  const handlePositionAdd = (newPosition: Position) => {
    setPositions((prev) => [...prev, newPosition]);
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setShowForm(true);
  };

  const handleDelete = (employee: Employee) => {
    setDeletingEmployee(employee);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingEmployee) return;

    const employeeId = deletingEmployee.id;

    try {
      // Get the user_id for this employee
      const { data: employeeData } = await (supabaseAdmin
        .from("employees")
        .select("user_id")
        .eq("id", employeeId)
        .single() as any);

      if (!employeeData) {
        throw new Error("Employee not found");
      }

      const userId = employeeData.user_id;

      // Delete from employees table first using admin client
      const { error: empError } = await supabaseAdmin
        .from("employees")
        .delete()
        .eq("id", employeeId);

      if (empError) throw empError;

      // Delete from user_roles using admin client (if user_id exists)
      if (userId) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        await supabaseAdmin.from("profiles").delete().eq("id", userId);

        // Delete auth user using admin client
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId);
        } catch (e: any) {
          if (e.message !== 'User not found') {
            console.warn("auth user deletion skipped:", e);
          }
        }
      }

      toast({
        title: "Success",
        description: "Employee and associated user account deleted successfully",
      });
      fetchData();
    } catch (error: any) {
      console.error("Error deleting employee:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete employee",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingEmployee(null);
    }
  };



  const handleManualAction = async (employeeId: string, action: 'clock_in' | 'clock_out' | 'leave' | 'holiday') => {
    setActionLoading(`${employeeId}_${action}`);
    try {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const existing = todayAttendance[employeeId];

      if (action === 'clock_in') {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const { data, error } = await (supabase as any)
          .from("attendance")
          .upsert({
            employee_id: employeeId,
            date: today,
            status: 'present',
            check_in: now.toISOString(),
            marked_by: currentUser?.id,
            updated_by: currentUser?.id
          } as any, { onConflict: 'employee_id,date' })
          .select()
          .single();
        if (error) throw error;
        setTodayAttendance(prev => ({ ...prev, [employeeId]: data }));
        toast({ title: "Clocked In", description: `Manually clocked in at ${format(now, 'hh:mm a')}` });
      } else if (action === 'clock_out') {
        if (!existing?.check_in) throw new Error("Employee must be clocked in first.");
        const checkInTime = new Date(existing.check_in);
        const diff = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

        let overtime = 0;
        const standardHours = workforceSettings?.working_hours_per_day || 8;
        const otThreshold = workforceSettings?.overtime_threshold_daily || 0;

        if (diff > standardHours) {
          const excess = diff - standardHours;
          if (excess >= otThreshold) {
            overtime = parseFloat(excess.toFixed(2));
          }
        }

        const { data, error } = await (supabase as any)
          .from("attendance")
          .update({
            check_out: now.toISOString(),
            total_hours: parseFloat(diff.toFixed(2)),
            overtime_hours: overtime,
            status: overtime > 0 ? 'overtime' : 'present'
          } as any)
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        setTodayAttendance(prev => ({ ...prev, [employeeId]: data }));
        toast({ title: "Clocked Out", description: `Manually clocked out. Total hours: ${diff.toFixed(2)}` });
      } else {
        // Leave or Holiday
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const status = action === 'leave' ? 'leave' : 'paid-holiday';
        const { data, error } = await (supabase as any)
          .from("attendance")
          .upsert({
            employee_id: employeeId,
            date: today,
            status: status,
            remarks: `Marked as ${status} by Admin`,
            marked_by: currentUser?.id,
            updated_by: currentUser?.id
          } as any, { onConflict: 'employee_id,date' })
          .select()
          .single();
        if (error) throw error;
        setTodayAttendance(prev => ({ ...prev, [employeeId]: data }));
        toast({ title: "Success", description: `Employee marked as ${status} for today.` });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Action Failed", description: error.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleSelfService = async (employeeId: string, current: boolean) => {
    try {
      const { error } = await supabase
        .from("employees")
        .update({ attendance_self_service: !current })
        .eq("id", employeeId);

      if (error) throw error;
      setEmployees(prev => prev.map(emp => emp.id === employeeId ? { ...emp, attendance_self_service: !current } : emp));
      toast({ title: "Updated", description: `Self-service ${!current ? 'enabled' : 'disabled'} for employee.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const getAccessBadgeVariant = (
    access: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (access) {
      case "admin":
        return "destructive";
      case "manager":
        return "default";
      default:
        return "secondary";
    }
  };

  const getAccessLabel = (access: string): string => {
    switch (access) {
      case "admin":
        return "Admin";
      case "manager":
        return "Manager";
      default:
        return "Staff";
    }
  };

  // --- Summary Metrics ---
  const metrics = useMemo(() => {
    const total = employees.length;
    const present = Object.values(todayAttendance).filter((a: any) => a.status === 'present' || a.status === 'overtime').length;
    const leave = Object.values(todayAttendance).filter((a: any) => a.status === 'leave').length;
    const absent = Object.values(todayAttendance).filter((a: any) => a.status === 'absent' || a.status === 'holiday').length;
    // Note: 'absent' status might strictly be 'absent' in DB, but checking for un-marked employees logic is different.
    // Ideally absent count = total - present - leave (if everyone else is considered absent) or specific status.
    // For now, let's use explicit status counting. Unmarked people are technically "Not In Yet" rather than absent until day end.
    // Adjusted logic:
    const active = total; // Simple total
    const checkedIn = Object.values(todayAttendance).filter((a: any) => a.check_in).length;
    const onLeave = Object.values(todayAttendance).filter((a: any) => a.status === 'leave').length;

    return { total: active, present: checkedIn, leave: onLeave, absent: total - checkedIn - onLeave };
  }, [employees, todayAttendance]);


  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.position?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const suggestions = useMemo(() => {
    const sets = [
      new Set(employees.map(e => e.name)),
      new Set(employees.map(e => e.email)),
      new Set(employees.map(e => e.position?.name)),
      new Set(employees.map(e => e.position?.department)),
    ];
    return Array.from(new Set(sets.flatMap(s => Array.from(s)))).filter(Boolean);
  }, [employees]);

  // Handle department filter logic (simplified)
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const departments = Array.from(new Set(positions.map(p => p.department)));

  const finalEmployees = filteredEmployees.filter(e => selectedDept === "all" || e.position?.department === selectedDept);


  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/5">
      <AdminSidebar />
      <div className="flex-1 p-6 md:p-8 space-y-8 overflow-y-auto h-screen">

        {/* 1. Header & Workforce Summary */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">Workforce Management</h1>
              <p className="text-muted-foreground mt-1">Manage staff, track attendance, and monitor performance.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => { setEditingEmployee(null); setShowForm(true); }} className="gap-2 shadow-lg hover:shadow-xl transition-all">
                <Plus className="h-4 w-4" /> Add Employee
              </Button>
            </div>
          </div>

          {/* Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-primary shadow-sm bg-card">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Staff</p>
                  <h3 className="text-2xl font-bold mt-1">{metrics.total}</h3>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Users className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-500 shadow-sm bg-card">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Present Today</p>
                  <h3 className="text-2xl font-bold mt-1 text-emerald-700">{metrics.present}</h3>
                </div>
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <User className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500 shadow-sm bg-card">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">On Leave</p>
                  <h3 className="text-2xl font-bold mt-1 text-amber-700">{metrics.leave}</h3>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                  <Palmtree className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-rose-500 shadow-sm bg-card">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Absent / Late</p>
                  <h3 className="text-2xl font-bold mt-1 text-rose-700">{metrics.absent}</h3>
                </div>
                <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                  <Clock className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 2. Toolbar & Filter */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, role or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. Employee Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {finalEmployees.map((employee) => {
            const att = todayAttendance[employee.id];
            const isOnline = att?.status === 'present' || att?.status === 'overtime';

            return (
              <Card key={employee.id} className="group hover:shadow-lg transition-all duration-300 border-muted/60 overflow-hidden relative">
                {/* Status Strip */}
                <div className={cn("absolute top-0 left-0 w-1 h-full transition-colors",
                  isOnline ? "bg-emerald-500" :
                    att?.status === 'leave' ? "bg-amber-500" :
                      att?.status === 'holiday' ? "bg-indigo-500" :
                        "bg-gray-200"
                )} />

                <CardContent className="p-5 pl-7">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-14 w-14 border-2 border-white shadow-sm ring-1 ring-slate-100">
                        <AvatarFallback className={cn("text-lg font-bold text-white",
                          isOnline ? "bg-emerald-500" : "bg-primary/80"
                        )}>
                          {employee.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900 group-hover:text-primary transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedEmployeeForTracker(employee);
                            setIsTrackerOpen(true);
                          }}
                        >
                          {employee.name}
                        </h3>
                        <Badge variant="secondary" className="mt-1 font-normal text-xs bg-muted text-muted-foreground border-transparent">
                          {employee.position?.name || "No Position"}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={cn("h-3 w-3 rounded-full border-2 border-white ring-1 ring-offset-1",
                              isOnline ? "bg-emerald-500 ring-emerald-200" :
                                att?.status === 'leave' ? "bg-amber-500 ring-amber-200" :
                                  att?.status === 'holiday' ? "bg-indigo-500 ring-indigo-200" :
                                    "bg-gray-300 ring-gray-100"
                            )} />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{att?.status ? att.status.toUpperCase() : 'NOT CHECKED IN'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-5 p-3 bg-muted/40 rounded-lg border border-dashed">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Department</p>
                      <p className="text-sm font-medium truncate">{employee.position?.department || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Access</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="h-5 text-[10px] px-1.5 bg-background">
                          {employee.access_level}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-dashed">
                    <div className="flex items-center gap-1">
                      {!att?.check_in && att?.status !== 'leave' && att?.status !== 'holiday' ? (
                        <div className="flex items-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => handleManualAction(employee.id, 'clock_in')}
                                  disabled={actionLoading === `${employee.id}_clock_in`}
                                >
                                  {actionLoading === `${employee.id}_clock_in` ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogIn className="h-4 w-4" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Quick Sign In</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  onClick={() => handleManualAction(employee.id, 'leave')}
                                  disabled={actionLoading === `${employee.id}_leave`}
                                >
                                  <Palmtree className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Mark Leave</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md">
                          <Clock className="h-3 w-3" />
                          {att?.check_in ? format(new Date(att.check_in), 'hh:mm a') : att?.status?.toUpperCase()}
                          {att?.check_out && ` - ${format(new Date(att.check_out), 'hh:mm a')}`}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEdit(employee)}>
                        <Edit className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => {
                        setSelectedEmployeeForTracker(employee);
                        setIsTrackerOpen(true);
                      }}>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty State */}
        {finalEmployees.length === 0 && (
          <div className="text-center py-20 bg-muted/10 rounded-xl border-2 border-dashed border-muted-foreground/10 flex flex-col items-center">
            <div className="bg-muted rounded-full p-4 mb-3">
              <Users className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-medium text-muted-foreground">No employees found</h3>
            <p className="text-sm text-muted-foreground/60 mt-1 max-w-xs mx-auto">
              Try adjusting your filters or search terms. If adding a new employee, use the button above.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => { setSearchTerm(""); setSelectedDept("all"); }}>
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Edit Employee" : "Add New Employee"}</DialogTitle>
          </DialogHeader>
          <EmployeeForm
            editingEmployee={editingEmployee}
            positions={positions}
            onPositionAdd={handlePositionAdd}
            onSuccess={handleFormSuccess}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      <EmployeeTracker
        employee={selectedEmployeeForTracker}
        open={isTrackerOpen}
        onOpenChange={setIsTrackerOpen}
      />

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete {deletingEmployee?.name}? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
