/**
 * Staff Dashboard - Enhanced with Dynamic Inspection → Repair → Approval Workflow
 * Staff can only see and manage their assigned work
 * Repairs are HIDDEN until Admin/Manager approves inspection
 * Shows dynamically generated repair tasks with individual submit actions
 */
import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/useAuth"
import { supabase } from "@/integrations/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import {
  LogOut, CheckCircle2, Clock, AlertTriangle,
  Briefcase, User, RefreshCw, Eye, EyeOff,
  Wrench, Shield, Lock, LockOpen, Activity, QrCode,
  Package, ChevronRight, XCircle, Archive, Zap, Calendar
} from "lucide-react"
import { format } from "date-fns"
import logo from "@/assets/logo.png"
import { PartRequestList } from "@/components/inventory/PartRequestList"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useNavigate } from "react-router-dom"

// Delivery Status Types and Utilities
type DeliveryStatus = 'overdue' | 'urgent' | 'soon' | 'normal' | 'none';

interface DeliveryInfo {
  status: DeliveryStatus;
  timeRemaining: number;
  formatted: string;
  color: string;
}

const getDeliveryStatus = (deliveryDate: string | null, currentTime: number): DeliveryInfo => {
  if (!deliveryDate) {
    return {
      status: 'none',
      timeRemaining: 0,
      formatted: 'No delivery date',
      color: 'text-muted-foreground'
    };
  }

  const deliveryTime = new Date(deliveryDate).getTime();
  const timeRemaining = deliveryTime - currentTime;
  const hoursRemaining = timeRemaining / (1000 * 60 * 60);

  if (timeRemaining < 0) {
    return {
      status: 'overdue',
      timeRemaining,
      formatted: formatCountdown(Math.abs(timeRemaining), true),
      color: 'text-red-600'
    };
  } else if (hoursRemaining < 6) {
    return {
      status: 'urgent',
      timeRemaining,
      formatted: formatCountdown(timeRemaining, false),
      color: 'text-red-600'
    };
  } else if (hoursRemaining < 24) {
    return {
      status: 'soon',
      timeRemaining,
      formatted: formatCountdown(timeRemaining, false),
      color: 'text-orange-600'
    };
  } else {
    return {
      status: 'normal',
      timeRemaining,
      formatted: formatCountdown(timeRemaining, false),
      color: 'text-green-600'
    };
  }
};

const formatCountdown = (ms: number, isOverdue: boolean): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / (24 * 60 * 60));
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);

  const prefix = isOverdue ? 'Overdue by ' : '';

  if (days > 0) {
    return `${prefix}${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${prefix}${hours}h ${minutes}m`;
  } else {
    return `${prefix}${minutes}m`;
  }
};

interface RepairTask {
  id: string
  task_name: string
  task_type: 'inspection' | 'repair' | 'testing' | 'quality'
  service_id?: string | null
  price?: number
  is_completed: boolean
  completed_at: string | null
  is_rejected?: boolean;
  rejection_reason?: string;
}

// Types for vehicle-based work display
interface VehicleWork {
  id: string                    // Service employee assignment ID
  service_id: string           // Service ID (for status updates)
  work_order_id: string
  vehicle_number: string
  vehicle_model: string
  customer_name: string
  company_name: string | null
  service_type: string
  description: string
  priority: string
  status: string
  work_order_status: string
  current_stage: string | null
  inspection_status: 'pending' | 'completed' | 'approved'
  repair_status: 'pending' | 'in_progress' | 'completed' | 'approved'
  review_status: 'pending' | 'approved'
  customer_visible: boolean
  tasks: RepairTask[]
  estimated_cost: number | null
  assigned_at: string | null
  accepted_at: string | null
  created_at: string | null
  estimated_delivery_date: string | null
  queue_position: number
  progress: number
  completed_tasks?: number
  total_tasks?: number
  is_reopened?: boolean;
  reopen_reason?: string;
}

export default function StaffDashboard() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [workItems, setWorkItems] = useState<VehicleWork[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("active")
  const [notificationCount, setNotificationCount] = useState(0)
  const [expandedParts, setExpandedParts] = useState<Record<string, boolean>>({})
  const [currentTime, setCurrentTime] = useState(Date.now())

  const [employeeProfile, setEmployeeProfile] = useState<any>(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false) // Profile Modal State

  // Update current time every minute for live countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);


  const fetchWorkItems = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // Use the new SECURITY DEFINER function to get staff's assigned work
      const { data: workData, error: workError } = await (supabase as any)
        .rpc('get_staff_assigned_work', { p_user_id: user.id })

      if (workError && workError.code !== 'PGRST116') {
        console.error("Error fetching work:", workError)
        // Fallback to direct query if function doesn't exist yet
        throw workError
      }

      // Transform to vehicle-based work items
      const workItemsData: VehicleWork[] = (workData || []).map((row: any) => {
        const tasks = row.tasks || [];
        const completedTasks = tasks.filter((t: any) => t.is_completed).length;
        const progress = tasks.length > 0 ? Math.round((completedTasks * 100) / tasks.length) : 0;

        return {
          id: row.assignment_id,
          service_id: row.service_id,
          work_order_id: row.work_order_id || "",
          vehicle_number: row.vehicle_number || "Unknown",
          vehicle_model: row.vehicle_model || "",
          customer_name: row.customer_name || "Unknown",
          company_name: row.company_name || null,
          service_type: row.service_type || "Service",
          description: row.description || "",
          priority: row.priority || "Medium",
          status: (row.assignment_status || "").toLowerCase(),
          work_order_status: (row.work_order_status || "").toLowerCase(),
          current_stage: row.service_status || row.current_stage,
          inspection_status: (row.inspection_status as 'pending' | 'completed' | 'approved') || 'pending',
          repair_status: (row.repair_status as 'pending' | 'in_progress' | 'completed' | 'approved') || 'pending',
          review_status: (row.review_status as 'pending' | 'approved') || 'pending',
          customer_visible: row.customer_visible || false,
          tasks: row.tasks || [],
          estimated_cost: row.estimated_cost || null,
          assigned_at: row.assigned_at,
          accepted_at: row.accepted_at,
          created_at: row.created_at,
          estimated_delivery_date: row.estimated_delivery_date || null,
          queue_position: row.queue_position || 0,
          progress: progress
        }
      })

      // Sort by queue_position primarily
      workItemsData.sort((a, b) => {
        if (a.queue_position !== b.queue_position) return a.queue_position - b.queue_position;
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
        const aPriority = priorityOrder[a.priority?.toLowerCase() as keyof typeof priorityOrder] || 3
        const bPriority = priorityOrder[b.priority?.toLowerCase() as keyof typeof priorityOrder] || 3
        if (aPriority !== bPriority) return aPriority - bPriority
        return new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime()
      })

      setWorkItems(workItemsData)

      // Fetch personal profile details
      const { data: profileData, error: profileError } = await supabase
        .from("employees")
        .select(`
          *,
          position:positions(*)
        `)
        .eq("user_id", user.id)
        .single()

      if (!profileError) {
        setEmployeeProfile(profileData)
      }

      // Count pending acceptance tasks
      const pendingCount = workItemsData.filter(w =>
        w.status === "pending_acceptance" || w.status === "assigned"
      ).length
      setNotificationCount(pendingCount)
    } catch (error: any) {
      console.error("Error fetching work items:", error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Filter work items based on active tab
  // Use work_order_status to determine if a vehicle is fully processed (delivered/completed/approved)
  // Define all states that should be considered as "completed/delivered"
  const completedStates = ["completed", "delivered", "cancelled", "rejected", "approved"];

  // Group work items by work_order_id AND by vehicle to consolidate services into single cards
  // This handles cases where services are stored as separate work orders with the same vehicle
  const workItemsByOrderId = workItems.reduce((acc, item) => {
    // Create a composite key: work_order_id OR vehicle_id
    // This groups work orders with the same vehicle together
    const key = item.work_order_id ||
      (item.vehicle_number ? `vehicle-${item.vehicle_number}` : `unknown-${Math.random()}`);

    if (!acc[key]) {
      acc[key] = { ...item, service_types: new Set([item.service_type].filter(Boolean)) };
    } else {
      // Add service_type to combined set
      if (item.service_type) {
        acc[key].service_types.add(item.service_type);
      }
      // FIXED: Merge tasks from all services
      if (item.tasks && item.tasks.length > 0) {
        acc[key].tasks = [...(acc[key].tasks || []), ...item.tasks];
        // Recalculate progress with merged tasks
        const allTasks = acc[key].tasks;
        const completedTasks = allTasks.filter((t: any) => t.is_completed).length;
        acc[key].completed_tasks = completedTasks;
        acc[key].total_tasks = allTasks.length;
        acc[key].progress = allTasks.length > 0 ? Math.round((completedTasks * 100) / allTasks.length) : 0;
      }
    }
    return acc;
  }, {} as Record<string, VehicleWork & { service_types: Set<string> }>);

  const activeWorkItems = Object.values(workItemsByOrderId)
    .filter(w => !completedStates.includes(w.work_order_status?.toLowerCase() || ""))
    .sort((a, b) => {
      // 1. Sort by Queue Position (Primary)
      const posA = a.queue_position && a.queue_position > 0 ? a.queue_position : 999999;
      const posB = b.queue_position && b.queue_position > 0 ? b.queue_position : 999999;
      if (posA !== posB) return posA - posB;

      // 2. Sort by Priority (Secondary)
      const pOrder: Record<string, number> = { 'urgent': 1, 'high': 2, 'medium': 3, 'low': 4 };
      const pA = pOrder[a.priority?.toLowerCase()] || 5;
      const pB = pOrder[b.priority?.toLowerCase()] || 5;
      if (pA !== pB) return pA - pB;

      // 3. Created At (Tertiary - Most recent first)
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

  const completedWorkItems = Object.values(workItemsByOrderId).filter(w =>
    completedStates.includes(w.work_order_status?.toLowerCase() || "")
  )

  const subscribeToChanges = useCallback(() => {
    const channel = supabase
      .channel('staff-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'work_order_service_employees'
      }, () => {
        console.log('Service employee change detected')
        fetchWorkItems()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'work_orders'
      }, () => {
        console.log('Work order change detected')
        fetchWorkItems()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'work_order_tasks'
      }, () => {
        console.log('Work order task change detected')
        fetchWorkItems()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchWorkItems])

  useEffect(() => {
    if (user?.id) {
      fetchWorkItems()
      const unsubscribe = subscribeToChanges()
      return () => {
        unsubscribe()
      }
    }
  }, [user?.id, fetchWorkItems, subscribeToChanges])

  const handleAcceptWork = async (assignmentId: string) => {
    try {
      console.log('Accepting assignment:', assignmentId)
      // Find the work item by assignment ID
      const workItem = workItems.find(w => w.id === assignmentId)
      if (!workItem) return

      // Update the service employee assignment
      // @ts-ignore
      const { error: empError } = await supabase.from("work_order_service_employees").update({
        status: "Accepted",
        accepted_at: new Date().toISOString()
      } as any).eq("id", assignmentId)

      if (empError) throw empError

      // Update the service status
      // @ts-ignore
      const { error: serviceError } = await supabase.from("work_order_services").update({
        status: "In Progress",
        started_at: new Date().toISOString()
      } as any).eq("id", workItem.service_id)

      if (serviceError) throw serviceError

      toast({
        title: "Work Accepted",
        description: "You have accepted this assignment.",
      })
      await fetchWorkItems()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      })
    }
  }

  const handleToggleTask = async (taskId: string, workOrderId: string, completed: boolean) => {
    try {
      // @ts-ignore
      const { error } = await supabase.rpc('update_work_order_task_status', {
        p_task_id: taskId,
        p_work_order_id: workOrderId,
        p_completed: completed,
        p_employee_id: user?.id
      })

      if (error) throw error

      toast({
        title: completed ? "Task Completed" : "Task Reopened",
        description: "Task status has been updated.",
      })
      fetchWorkItems()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      })
    }
  }

  const handleSubmitForApproval = async (workOrderId: string) => {
    try {
      const workItem = workItems.find(w => w.work_order_id === workOrderId)
      if (!workItem) return

      // Check if all repair tasks are completed
      const completedTasks = workItem.tasks?.filter(t => t.is_completed).length || 0
      const totalTasks = workItem.tasks?.length || 0

      if (completedTasks < totalTasks) {
        toast({
          variant: "destructive",
          title: "Cannot Submit",
          description: `Please complete all ${totalTasks} repair tasks before submitting for approval.`,
        })
        return
      }

      // Update service employee status to pending approval
      // @ts-ignore
      await supabase.from("work_order_service_employees").update({
        status: "pending_approval",
        completed_at: new Date().toISOString()
      }).eq("id", workItem.id)

      // Update service status
      // @ts-ignore
      await supabase.from("work_order_services").update({
        status: "Pending Approval"
      }).eq("id", workItem.service_id)

      // Update work order status - ONLY if it's not already in a final state
      // @ts-ignore
      await supabase.from("work_orders").update({
        status: "Pending Approval"
      }).eq("id", workOrderId)
        .in("status", ["Pending", "In Progress"]) // Guard against overriding Completed/Delivered status

      toast({
        title: "Submitted for Approval",
        description: "All repairs completed. Waiting for manager approval.",
      })
      fetchWorkItems()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      })
    }
  }

  // Calculate stats
  const pendingTasks = workItems.filter(w => w.status === "pending_acceptance").length
  const inProgressTasks = workItems.filter(w => w.status === "accepted" || w.status === "in_progress").length
  const awaitingApproval = workItems.filter(w => w.status === "pending_approval").length

  // Helper function to calculate progress
  const calculateProgress = (tasks: RepairTask[]) => {
    if (tasks.length === 0) return { completed: 0, total: 0, percent: 0 }
    const completed = tasks.filter(t => t.is_completed).length
    return {
      completed,
      total: tasks.length,
      percent: Math.round((completed / tasks.length) * 100)
    }
  }

  // Get inspection status badge
  const getInspectionStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>
      case 'completed':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><CheckCircle2 className="h-3 w-3 mr-1" />Awaiting Admin Approval</Badge>
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />In Progress</Badge>
    }
  }

  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    const fetchCompany = async () => {
      const { data } = await supabase.from('company_profiles').select('company_name, logo_url').limit(1).maybeSingle();
      if (data) setCompany(data);
    };
    fetchCompany();
  }, []);

  if (loading && workItems.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
        <div className="relative">
          <div className="h-24 w-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <img src={company?.logo_url || logo} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-12 object-contain animate-pulse" alt="Logo" />
        </div>
        <p className="mt-4 text-xs font-bold text-primary uppercase tracking-wider animate-pulse">
          Loading Dashboard...
        </p>
        <p className="mt-2 text-muted-foreground text-sm uppercase tracking-wider">
          {company?.company_name || 'Amma Auto Garage'} Dashboard
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary-foreground">
      {/* Background Overlay */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(var(--primary),0.05)_0%,transparent_50%)]" />
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_100%_100%,rgba(var(--primary),0.02)_0%,transparent_30%)]" />
      </div>

      {/* Header */}
      <header className="border-b border-border bg-background/80 sticky top-0 z-50 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-20 grid grid-cols-3 items-center">
          {/* Column 1: Branding */}
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary),0.3)] overflow-hidden shrink-0">
              <img src={company?.logo_url || logo} className="h-9 w-9 object-contain brightness-0 invert" alt="Logo" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-primary uppercase tracking-tight leading-tight">
                {company?.company_name || "Amma Auto Garage"}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  System Active
                </span>
              </div>
            </div>
          </div>

          {/* Column 2: Page Title (Centered) */}
          <div className="flex flex-col items-center justify-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase text-center">
              Dashboard
            </h1>
            <div className="h-0.5 w-12 bg-primary mt-1 rounded-full opacity-50" />
          </div>

          {/* Column 3: Sync & Controls */}
          <div className="flex items-center justify-end gap-3">
            <div className="hidden xl:flex items-center gap-3 px-4 py-2 bg-background/50 rounded-2xl border border-border shadow-inner mr-4">
              <User className="h-4 w-4 text-primary" />
              <div className="flex flex-col cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setIsProfileOpen(true)}>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">Employee</span>
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  {user?.full_name || user?.email?.split('@')[0]}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl border-border bg-secondary shadow-inner relative group transition-all"
              onClick={fetchWorkItems}
            >
              <RefreshCw className={cn("h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors", loading && "animate-spin")} />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-foreground font-bold flex items-center justify-center border-2 border-background shadow-lg">
                  {notificationCount}
                </span>
              )}
            </Button>

            {employeeProfile?.attendance_self_service && (
              <Button
                variant="outline"
                className="hidden sm:flex h-10 px-4 rounded-xl border-border bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 transition-all font-bold uppercase tracking-tight gap-2 shadow-sm"
                onClick={() => navigate("/staff/attendance")}
              >
                <Calendar className="h-4 w-4" />
                <span>Attendance</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl border-border bg-secondary shadow-inner text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={signOut}
              title="Log Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Profile Dialog */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>My Profile</DialogTitle>
            <DialogDescription>Your personal and official employment details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Full Name</p>
                      <p className="font-medium">{employeeProfile?.name || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Blood Group</p>
                      <p className="font-medium text-destructive">{employeeProfile?.blood_group || "Not Set"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Date of Birth</p>
                      <p className="font-medium">{employeeProfile?.date_of_birth ? format(new Date(employeeProfile.date_of_birth), "PPP") : "Not Set"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Joining Date</p>
                      <p className="font-medium">{employeeProfile?.joining_date ? format(new Date(employeeProfile.joining_date), "PPP") : "N/A"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="font-medium text-sm">{employeeProfile?.address || "No address on record"}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Employment Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Position</p>
                      <p className="font-medium">{employeeProfile?.position?.name || "Not Assigned"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Department</p>
                      <p className="font-medium">{employeeProfile?.position?.department || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Access Level</p>
                      <Badge variant="outline" className="capitalize">{employeeProfile?.access_level || "Staff"}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Monthly Salary</p>
                      <p className="font-medium">₹{employeeProfile?.salary?.toLocaleString() || "Private"}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-muted-foreground">Aadhaar Number</p>
                      <p className="font-mono text-xs">{employeeProfile?.aadhaar_number || "Pending Verification"}</p>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-muted-foreground">PAN Number</p>
                      <p className="font-mono text-xs uppercase">{employeeProfile?.pan_number || "Pending Verification"}</p>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-muted-foreground">Emergency Contact</p>
                      <p className="text-xs font-medium">{employeeProfile?.emergency_contact || "Not Set"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Data Privacy Notice</p>
                Your identity information (Aadhaar, PAN) and salary details are encrypted and visible only to you and the payroll administration.
                If any information is incorrect, please contact the HR manager.
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <main className="container mx-auto px-4 py-8">
        {/* Performance HUD / Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-background/40 border-border backdrop-blur-md relative overflow-hidden group shadow-sm transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <img src={company?.logo_url || logo} className="h-12 w-12 object-contain grayscale brightness-0 invert" alt="..." />
            </div>
            <CardContent className="p-6">
              <p className="text-muted-foreground font-bold uppercase tracking-wider mb-2 text-xs">New Assignments</p>
              <h3 className="text-4xl font-bold text-foreground tracking-tight leading-none">{workItems.filter(w => w.status === 'assigned' || w.status === 'pending_acceptance').length}</h3>
              <p className="text-[11px] font-bold text-blue-500 uppercase tracking-wider mt-3 italic">Awaiting Acceptance</p>
            </CardContent>
          </Card>

          <Card className="bg-background/40 border-border backdrop-blur-md relative overflow-hidden group shadow-sm transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <img src={company?.logo_url || logo} className="h-12 w-12 object-contain grayscale brightness-0 invert" alt="..." />
            </div>
            <CardContent className="p-6">
              <p className="text-muted-foreground font-bold uppercase tracking-wider mb-2 text-xs">Active Jobs</p>
              <h3 className="text-4xl font-bold text-foreground tracking-tight leading-none">{activeWorkItems.length}</h3>
              <p className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider mt-3 italic">In Progress</p>
            </CardContent>
          </Card>

          <Card className="bg-background/40 border-border backdrop-blur-md relative overflow-hidden group shadow-sm transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <img src={company?.logo_url || logo} className="h-12 w-12 object-contain grayscale brightness-0 invert" alt="..." />
            </div>
            <CardContent className="p-6">
              <p className="text-muted-foreground font-bold uppercase tracking-wider mb-2 text-xs">Approval Queue</p>
              <h3 className="text-4xl font-bold text-foreground tracking-tight leading-none">{workItems.filter(w => w.status === 'pending_approval').length}</h3>
              <p className="text-[11px] font-bold text-purple-500 uppercase tracking-wider mt-3 italic">Awaiting Approval</p>
            </CardContent>
          </Card>

          <Card className="bg-background/40 border-border backdrop-blur-md relative overflow-hidden group shadow-sm transition-all text-primary">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <img src={company?.logo_url || logo} className="h-12 w-12 object-contain grayscale brightness-0 invert" alt="..." />
            </div>
            <CardContent className="p-6">
              <p className="text-muted-foreground font-bold uppercase tracking-wider mb-2 text-xs">Performance</p>
              <h3 className="text-4xl font-bold text-foreground tracking-tight leading-none">{completedWorkItems.length}%</h3>
              <p className="text-[11px] font-bold text-primary uppercase tracking-wider mt-3 italic">Total Completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Info Banner */}
        <div className="mb-8 border border-border bg-secondary/20 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 opacity-5 pointer-events-none -mr-8 -mt-8">
            <Shield className="w-full h-full text-primary" />
          </div>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-1">Standard Procedure</h3>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider leading-relaxed">
                Repairs are locked until inspection is verified. Complete individual tasks and submit for approval.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchWorkItems}
              disabled={loading}
              className="rounded-xl bg-secondary/50 border-border bg-secondary/50 hover:bg-secondary/80 h-10 px-6 group"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-2 text-primary", loading && 'animate-spin')} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Work Items Tabs */}
        {/* Mission Tabs */}
        <div className="space-y-6">
          <div className="flex p-1.5 rounded-2xl border-border bg-secondary/80 backdrop-blur-md shadow-2xl w-full max-w-2xl mx-auto">
            <button
              onClick={() => setActiveTab("active")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-[10px] font-bold uppercase tracking-wider transition-all",
                activeTab === "active"
                  ? "bg-primary text-black shadow-[0_0_20px_rgba(var(--primary),0.3)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              )}
            >
              <Activity className="h-3.5 w-3.5" />
              Active Jobs ({activeWorkItems.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-[10px] font-bold uppercase tracking-wider transition-all",
                activeTab === "history"
                  ? "bg-primary text-black shadow-[0_0_20px_rgba(var(--primary),0.3)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              )}
            >
              <Archive className="h-3.5 w-3.5" />
              History ({completedWorkItems.length})
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                  {activeTab === "active" ? "Active Assignments" : "Assignment History"}
                </h3>
                <p className="text-[10px] font-bold text-muted-foreground italic uppercase tracking-wider mt-0.5">
                  {activeTab === "active"
                    ? "Live data from ongoing jobs."
                    : "Historical records and completed jobs."}
                </p>
              </div>
              <Badge variant="outline" className="border-border bg-card text-muted-foreground text-[9px]">
                {activeTab === "active" ? activeWorkItems.length : completedWorkItems.length} RECORDS FOUND
              </Badge>
            </div>

            <div className="min-h-[400px]">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="w-full animate-pulse">
                      <CardContent className="p-6">
                        <div className="space-y-4">
                          <div className="h-6 bg-muted rounded w-1/3" />
                          <div className="h-4 bg-muted rounded w-2/3" />
                          <div className="h-4 bg-muted rounded w-1/2" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (activeTab === "active" ? activeWorkItems : completedWorkItems).length === 0 ? (
                <div className="p-20 bg-secondary/20 border border-border border-dashed rounded-3xl flex flex-col items-center justify-center text-center gap-6 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--primary)_0%,transparent_70%)] opacity-[0.03] group-hover:opacity-[0.05] transition-opacity" />
                  <div className="h-20 w-20 rounded-3xl bg-card border-border shadow-lg shadow-primary/20 flex items-center justify-center relative overflow-hidden p-3 group">
                    <img src={company?.logo_url || logo} className="h-full w-full object-contain opacity-50 grayscale group-hover:grayscale-0 transition-all duration-500" alt="Logo" />
                    <div className="absolute inset-0 rounded-3xl border border-primary/20 scale-110 animate-ping opacity-0 group-hover:opacity-100" />
                  </div>
                  <div className="space-y-2 relative z-10">
                    <h3 className="text-xl font-bold text-foreground uppercase tracking-tight">No Data Found</h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider max-w-[280px]">
                      {activeTab === "active"
                        ? "No active assignments found."
                        : "No history records found."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {(activeTab === "active" ? activeWorkItems : completedWorkItems).map((work, index) => {
                    const isCompletedHistory = activeTab === "history"

                    // Statuses: 'assigned' (Admin assigned) -> 'pending_acceptance' (Admin released) -> 'accepted' (Staff accepted)
                    const status = (work.status || "").toLowerCase()
                    const isAssigned = status === "assigned"
                    const isReleased = status === "pending_acceptance"
                    const hasAccepted = status === "accepted" || status === "in_progress" || status === "approved"

                    const canComplete = hasAccepted

                    const isPendingApproval = work.work_order_status.includes("pending approval") || work.status === "pending_approval"
                    const isFinished = ["completed", "delivered", "cancelled", "rejected", "approved"].includes(work.work_order_status?.toLowerCase() || "")
                    const repairsAvailable = work.inspection_status === 'approved'
                    const repairsApproved = work.repair_status === 'approved'

                    // User Rule: Button shows only if Inspection Approved AND Admin has Released it (isReleased)
                    const canAccept = isReleased && repairsAvailable

                    // Waiting States
                    const isWaitingForInspection = (isAssigned || isReleased) && !repairsAvailable
                    const isWaitingForAdminRelease = isAssigned && repairsAvailable

                    const currentStageTasks = (work.tasks || []).filter(t =>
                      repairsAvailable ? (t.task_type !== 'inspection') : (t.task_type === 'inspection')
                    )
                    const progress = calculateProgress(currentStageTasks)
                    const allRepairsCompleted = repairsAvailable && progress.completed === progress.total && progress.total > 0 && !isFinished
                    const deliveryInfo = getDeliveryStatus(work.estimated_delivery_date, currentTime)

                    return (
                      <Card key={work.id} className={cn(
                        "bg-card shadow-inner border border-border backdrop-blur-md hover:border-primary/20 transition-all overflow-hidden rounded-2xl relative",
                        work.priority === 'urgent' && "border-l-4 border-l-red-600",
                        work.priority === 'high' && "border-l-4 border-l-orange-500",
                        work.priority === 'medium' && "border-l-4 border-l-blue-500",
                        work.priority === 'low' && "border-l-4 border-l-emerald-500"
                      )}>
                        {/* Industrial Warning Stripe for High Priority */}
                        {(work.priority === 'urgent' || work.priority === 'high') && (
                          <div className={cn(
                            "absolute top-0 right-0 w-32 h-6 -mr-8 mt-2 rotate-45 opacity-20 pointer-events-none",
                            work.priority === 'urgent' ? "bg-red-500" : "bg-orange-500"
                          )} style={{
                            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.2) 10px, rgba(0,0,0,0.2) 20px)'
                          }} />
                        )}
                        <CardContent className="p-0">
                          {/* Header - Job Details */}
                          <div className="p-6 border-b border-border bg-card/20">
                            <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-4">
                                  <Badge className={cn(
                                    "uppercase text-[9px] font-bold tracking-wider px-3 py-0.5 border",
                                    work.priority === 'urgent' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                      work.priority === 'high' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                        "bg-secondary text-muted-foreground border-border shadow-inner p-1 rounded-md px-2 py-0.5 text-[9px]"
                                  )}>
                                    Priority: {work.priority}
                                  </Badge>

                                  {deliveryInfo.status !== 'none' && (
                                    <Badge variant="outline" className={cn("flex items-center gap-1.5 text-[9px] py-0.5 px-2 bg-secondary border-border shadow-inner p-1", deliveryInfo.status === 'overdue' || deliveryInfo.status === 'urgent' ? 'text-red-500 border-red-500/20' : 'text-muted-foreground')}>
                                      <Clock className="h-3 w-3" />
                                      {deliveryInfo.formatted}
                                    </Badge>
                                  )}

                                  {work.is_reopened && (
                                    <Badge className="bg-orange-500 text-black text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 animate-pulse">
                                      <RefreshCw className="h-2.5 w-2.5 mr-1" /> Reopened
                                    </Badge>
                                  )}
                                </div>

                                <div className="mb-4">
                                  <div className="flex items-center gap-3 mb-1">
                                    <h3 className="text-2xl font-bold text-foreground tracking-tight uppercase">
                                      {work.vehicle_number}
                                    </h3>
                                    <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
                                      ID: {work.work_order_id.slice(0, 8).toUpperCase()}
                                    </Badge>
                                  </div>
                                  <p className="text-muted-foreground font-bold text-sm uppercase tracking-wide">{work.vehicle_model}</p>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 mb-6">
                                  <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-background/50 border-border">
                                    <User className="h-3 w-3 text-primary" />
                                    <span>{work.customer_name}</span>
                                    {work.company_name && (
                                      <>
                                        <div className="bg-muted-foreground w-1 h-1 rounded-full opacity-50" />
                                        <span className="text-primary">{work.company_name}</span>
                                      </>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {Array.from((work as any).service_types || [work.service_type]).map((st: any, i: number) => (
                                      <div key={i} className="flex items-center gap-1.5 bg-primary/5 text-primary border border-primary/20 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">
                                        <Wrench className="h-2.5 w-2.5" />
                                        {st}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {work.description && (
                                  <div className="bg-background/50 p-4 rounded-xl border border-border border-l-2 border-l-primary/50 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-2 opacity-5">
                                      <Activity className="h-12 w-12" />
                                    </div>
                                    <span className="text-[9px] font-bold text-primary uppercase tracking-wider block mb-2">Instructions</span>
                                    <p className="text-xs text-foreground leading-relaxed italic">"{work.description}"</p>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-col items-center md:items-end gap-4 min-w-[160px]">
                                <div className="text-right">
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Inspection Status</span>
                                  {getInspectionStatusBadge(work.inspection_status)}
                                </div>

                                <div className="w-full h-px bg-white/5" />

                                <div className="w-full text-right">
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Work Status</span>
                                  <div className="flex flex-col items-end gap-2">
                                    {canAccept ? (
                                      <Badge className="bg-orange-500 text-black border-0 text-[9px] font-bold uppercase px-2 py-0.5">
                                        Ready to Start
                                      </Badge>
                                    ) : isWaitingForInspection ? (
                                      <Badge variant="outline" className="text-yellow-500 border-yellow-500/20 text-[9px] font-bold uppercase px-2 py-0.5 bg-yellow-500/5">
                                        Inspection Pending...
                                      </Badge>
                                    ) : isWaitingForAdminRelease ? (
                                      <Badge variant="outline" className="text-blue-400 border-blue-500/20 text-[9px] font-bold uppercase px-2 py-0.5 bg-blue-400/5">
                                        Pending Admin Approval
                                      </Badge>
                                    ) : hasAccepted ? (
                                      <Badge className="bg-emerald-500 text-black border-0 text-[10px] font-bold uppercase px-2 py-0.5">
                                        In Progress
                                      </Badge>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="w-full mt-2">
                                  <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                                    <span>Progress</span>
                                    <span className="text-primary font-bold">{work.progress}%</span>
                                  </div>
                                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border">
                                    <div
                                      className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)] transition-all duration-1000 ease-out"
                                      style={{ width: `${work.progress}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Waiting States Tactical Banners */}
                          {isWaitingForInspection && (
                            <div className="p-12 bg-card/40 border-b border-border flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden group">
                              <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_center,var(--primary)_0%,transparent_70%)] animate-pulse" />
                              <div className="bg-secondary border-border shadow-inner rounded-2xl flex flex-col items-center justify-center h-16 w-16 mb-2 shadow-2xl group-hover:border-primary/30 transition-colors">
                                <Eye className="h-8 w-8 text-primary shadow-primary/20 group-hover:scale-110 transition-transform" />
                              </div>
                              <h3 className="text-xl font-bold text-foreground uppercase tracking-tight">Inspection Pending</h3>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider max-w-[320px] leading-loose">
                                System awaiting Admin approval for vehicle inspection. Work cannot start until verified.
                              </p>
                              <div className="flex gap-2 mt-2">
                                <div className="h-1 w-8 bg-primary/20 rounded-full animate-pulse" />
                                <div className="h-1 w-8 bg-primary/20 rounded-full animate-pulse delay-75" />
                                <div className="h-1 w-8 bg-primary/20 rounded-full animate-pulse delay-150" />
                              </div>
                            </div>
                          )}

                          {isWaitingForAdminRelease && (
                            <div className="p-12 bg-card/40 border-b border-border flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden group">
                              <div className="bg-secondary/50 border-border shadow-inner rounded-2xl flex flex-col items-center justify-center p-4 h-16 w-16 mb-2 shadow-2xl group-hover:border-blue-500/50 transition-colors">
                                <Lock className="h-8 w-8 text-blue-500" />
                              </div>
                              <h3 className="text-xl font-bold text-foreground uppercase tracking-tight">Admin Approval Needed</h3>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider max-w-[320px] leading-loose">
                                Inspection approved. Awaiting work assignment from Manager.
                              </p>
                            </div>
                          )}

                          {/* Mission Acceptance Terminal */}
                          {canAccept && (
                            <div className="p-12 bg-orange-500/5 border-b border-orange-500/10 flex flex-col items-center justify-center text-center gap-6 relative overflow-hidden">
                              <div className="absolute inset-0 opacity-10" style={{
                                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(249,115,22,0.1) 10px, rgba(249,115,22,0.1) 20px)'
                              }} />

                              <div className="h-20 w-20 rounded-3xl bg-card border border-orange-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(249,115,22,0.15)] animate-bounce-slow">
                                <Clock className="h-10 w-10 text-orange-500" />
                              </div>

                              <div className="space-y-2 relative z-10">
                                <h3 className="text-2xl font-bold text-foreground uppercase tracking-tight">Ready to Start</h3>
                                <p className="text-[10px] font-bold text-orange-500/70 uppercase tracking-wider">Accept Assignment to Begin Work</p>
                              </div>

                              <Button
                                size="lg"
                                onClick={() => handleAcceptWork(work.id)}
                                className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold uppercase tracking-wider px-10 py-7 text-sm rounded-xl shadow-[0_10px_30px_rgba(16,185,129,0.3)] transform transition-all hover:scale-105 active:scale-95 group"
                              >
                                <CheckCircle2 className="h-5 w-5 mr-3 group-hover:rotate-12 transition-transform" />
                                Start Work
                              </Button>
                            </div>
                          )}

                          {/* Progress Section - Active Intelligence Gathering / Deployment */}
                          {(hasAccepted && !isFinished) && (
                            <div className={cn(
                              "bg-background/80 shadow-inner p-6 border-b border-border transition-all duration-300",
                              repairsAvailable ? 'bg-emerald-500/5' : 'bg-blue-500/5'
                            )}>
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "h-8 w-8 rounded-lg flex items-center justify-center border",
                                    repairsAvailable ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-500'
                                  )}>
                                    {repairsAvailable ? <Wrench className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </div>
                                  <div>
                                    <h4 className={cn(
                                      "text-xs font-bold uppercase tracking-wider leading-none mb-1",
                                      repairsAvailable ? 'text-emerald-500' : 'text-blue-500'
                                    )}>
                                      {repairsAvailable ? 'Current Stage: Repair' : 'Current Stage: Inspection'}
                                    </h4>
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                      {progress.completed} / {progress.total} Tasks Completed
                                    </span>
                                  </div>
                                </div>
                                {repairsApproved && (
                                  <Badge className="bg-emerald-500 text-black border-0 text-[9px] font-bold uppercase px-2 py-0.5">
                                    Approved
                                  </Badge>
                                )}
                              </div>

                              <div className="relative pt-1">
                                <div className="flex mb-2 items-center justify-between">
                                  <div className="text-right">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider inline-block">
                                      Progress: {progress.percent}%
                                    </span>
                                  </div>
                                </div>
                                <div className="overflow-hidden h-2 mb-2 text-xs flex rounded-full bg-card border border-border">
                                  <div
                                    style={{ width: `${progress.percent}%` }}
                                    className={cn(
                                      "shadow-none flex flex-col text-center whitespace-nowrap text-foreground justify-center transition-all duration-1000",
                                      repairsAvailable ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                                    )}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Tasks Section */}
                          {(hasAccepted || isFinished) && work.tasks && work.tasks.length > 0 && (
                            <div className="p-6 space-y-6">
                              {/* Show all unique tasks (no duplication) */}
                              {(() => {
                                // Get unique tasks by id
                                const uniqueTasks = work.tasks.reduce((acc: RepairTask[], task) => {
                                  if (!acc.find(t => t.id === task.id)) {
                                    acc.push(task);
                                  }
                                  return acc;
                                }, []);

                                const inspectionTasks = uniqueTasks.filter(t => t.task_type === 'inspection');
                                const repairTasks = uniqueTasks.filter(t => t.task_type !== 'inspection');
                                const currentTasks = repairsAvailable ? repairTasks : inspectionTasks;
                                const allCurrentCompleted = currentTasks.every(t => t.is_completed) && currentTasks.length > 0;

                                return (
                                  <>
                                    {currentTasks.length > 0 && (
                                      <div className="bg-secondary/30 rounded-2xl border border-border overflow-hidden">
                                        <div className="bg-background border-b border-border shadow-inner p-4 flex items-center justify-between">
                                          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <Activity className="h-3 w-3 text-primary" />
                                            Tasks
                                          </h4>
                                          <Badge variant="outline" className="text-[9px] text-muted-foreground border-border bg-card">
                                            {currentTasks.filter(t => t.is_completed).length} / {currentTasks.length} COMPLETED
                                          </Badge>
                                        </div>

                                        <div className="divide-y divide-border">
                                          {currentTasks.map((task: RepairTask, index: number) => (
                                            <div
                                              key={task.id}
                                              className={cn(
                                                "flex flex-col p-4 transition-all group/task hover:bg-white/[0.02]",
                                                task.is_completed ? "bg-primary/10" : ""
                                              )}
                                            >
                                              <div className="flex items-center gap-4">
                                                <div className="relative">
                                                  <Checkbox
                                                    id={`task-${task.id}`}
                                                    checked={task.is_completed}
                                                    onCheckedChange={(checked) => handleToggleTask(task.id, work.work_order_id, checked === true)}
                                                    disabled={isPendingApproval || repairsApproved || isFinished}
                                                    className={cn(
                                                      "h-6 w-6 border-2 transition-all rounded-lg",
                                                      task.is_completed
                                                        ? "bg-emerald-500 border-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                                        : "bg-card border-border group-hover/task:border-primary/50"
                                                    )}
                                                  />
                                                </div>
                                                <div className="flex-1">
                                                  <div className="flex items-center justify-between gap-4">
                                                    <label
                                                      htmlFor={`task-${task.id}`}
                                                      className={cn(
                                                        "text-sm font-bold tracking-tight cursor-pointer",
                                                        task.is_completed ? "text-muted-foreground italic line-through opacity-70" : "text-foreground"
                                                      )}
                                                    >
                                                      {task.task_name}
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                      {task.price !== undefined && task.price > 0 && (
                                                        <span className="text-[10px] font-bold text-primary/70">
                                                          ₹{task.price}
                                                        </span>
                                                      )}
                                                      <span className="text-[8px] font-bold text-muted-foreground uppercase border border-border px-1.5 py-0.5 rounded shadow-sm">
                                                        {task.task_type}
                                                      </span>
                                                    </div>
                                                  </div>

                                                  {task.completed_at && (
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                      <div className="h-1 w-1 rounded-full bg-emerald-500" />
                                                      <span className="text-[9px] font-bold text-primary/70 uppercase tracking-wider">
                                                        Completed {format(new Date(task.completed_at), "h:mm a")}
                                                      </span>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>

                                              {task.is_rejected && (
                                                <div className="mt-3 ml-10 p-3 bg-red-500/5 border border-red-500/10 rounded-xl flex items-start gap-3">
                                                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                                  <div className="space-y-1">
                                                    <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider">Task Rejected</span>
                                                    <p className="text-[10px] text-destructive-foreground font-medium leading-relaxed italic">"{task.rejection_reason}"</p>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Tactical Notification */}
                                    {allCurrentCompleted && !repairsAvailable && work.inspection_status === 'pending' && (
                                      <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-500">
                                          <Shield className="h-4 w-4" />
                                        </div>
                                        <div>
                                          <h5 className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1">Inspection Verification Pending</h5>
                                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Wait for Manager verification to proceed with repairs.</p>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}

                              {/* Action Terminal Bottom */}
                              {allRepairsCompleted && !isFinished && !repairsApproved && (
                                <div className="space-y-3 pt-2">
                                  <Button
                                    className={cn(
                                      "w-full h-14 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg",
                                      isPendingApproval
                                        ? "bg-secondary/50 text-muted-foreground cursor-not-allowed border border-border shadow-inner p-2 rounded-xl"
                                        : "bg-primary text-black hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
                                    )}
                                    onClick={() => handleSubmitForApproval(work.work_order_id)}
                                    disabled={isPendingApproval || repairsApproved}
                                  >
                                    {isPendingApproval ? (
                                      <div className="flex items-center gap-3">
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                        Approval Pending...
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-3">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Submit for Approval
                                      </div>
                                    )}
                                  </Button>
                                  {!isPendingApproval && (
                                    <p className="text-[9px] text-center font-bold text-muted-foreground/60 uppercase tracking-wider">
                                      Final Verification Step Required Before Release
                                    </p>
                                  )}
                                </div>
                              )}

                              {isPendingApproval && !repairsApproved && (
                                <div className="flex flex-col items-center gap-3 p-6 bg-secondary/50 p-6 rounded-2xl border border-border shadow-inner">
                                  <div className="h-10 w-10 rounded-full bg-card flex items-center justify-center border border-border relative">
                                    <Clock className="h-5 w-5 text-purple-500 animate-pulse" />
                                    <div className="absolute inset-0 rounded-full border border-purple-500/20 animate-ping" />
                                  </div>
                                  <div className="text-center">
                                    <h5 className="text-[10px] font-bold text-purple-400 uppercase tracking-wider leading-none mb-1.5">Waiting for Approval</h5>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Manager is reviewing work.</p>
                                  </div>
                                </div>
                              )}

                              {/* Post-Repair States (Review, Quality Check, Delivery) */}
                              {repairsApproved && !isFinished && (
                                <div className="space-y-3 pt-2">
                                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                                      <CheckCircle2 className="h-5 w-5" />
                                    </div>
                                    <div>
                                      <h5 className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider leading-none mb-1">Repairs Approved</h5>
                                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1">
                                        Your work on this vehicle is complete.
                                        {work.current_stage === 'Review' ? " Currently in Review." :
                                          work.current_stage === 'Quality Check' ? " Waiting for Quality Check." :
                                            work.current_stage === 'Delivery' ? " Ready for Delivery." : ""}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="p-6">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-11 rounded-xl bg-card border-border hover:border-primary/30 flex justify-between items-center group transition-all"
                              onClick={() => setExpandedParts(prev => ({
                                ...prev,
                                [work.work_order_id]: !prev[work.work_order_id]
                              }))}
                            >
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-primary" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Parts & Inventory</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[9px] text-muted-foreground border-border">
                                  ACCESS PORTAL
                                </Badge>
                                <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedParts[work.work_order_id] && 'rotate-90')} />
                              </div>
                            </Button>

                            {expandedParts[work.work_order_id] && (
                              <div className="mt-4 p-4 bg-card/50 rounded-xl border border-border animate-in fade-in slide-in-from-top-2 duration-300">
                                <PartRequestList workOrderId={work.work_order_id} isAdmin={false} isReadOnly={isFinished} />
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </div >
        </div >
      </main >
    </div >
  );
}
