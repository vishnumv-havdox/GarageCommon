/**
 * Staff Dashboard - Enhanced with Dynamic Inspection → Repair → Approval Workflow
 * Staff can only see and manage their assigned work
 * Repairs are HIDDEN until Admin/Manager approves inspection
 * Shows dynamically generated repair tasks with individual submit actions
 */
import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/useAuth"
import { supabase } from "@/integrations/supabase/client"
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
  Package, ChevronRight
} from "lucide-react"
import { format } from "date-fns"
import { PartRequestList } from "@/components/inventory/PartRequestList"

interface RepairTask {
  id: string
  task_name: string
  task_type: 'inspection' | 'repair' | 'testing' | 'quality'
  service_id?: string | null
  is_completed: boolean
  completed_at: string | null
}

// Types for vehicle-based work display
interface VehicleWork {
  id: string                    // Service employee assignment ID
  service_id: string           // Service ID (for status updates)
  work_order_id: string
  vehicle_number: string
  vehicle_model: string
  customer_name: string
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
}

export default function StaffDashboard() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const [workItems, setWorkItems] = useState<VehicleWork[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("active")
  const [notificationCount, setNotificationCount] = useState(0)
  const [expandedParts, setExpandedParts] = useState<Record<string, boolean>>({})

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
      const workItemsData: VehicleWork[] = (workData || []).map((row: any) => ({
        id: row.assignment_id,
        service_id: row.service_id,
        work_order_id: row.work_order_id || "",
        vehicle_number: row.vehicle_number || "Unknown",
        vehicle_model: row.vehicle_model || "",
        customer_name: row.customer_name || "Unknown",
        service_type: row.service_type || "Service",
        description: row.description || "",
        priority: row.priority || "Medium",
        status: (row.assignment_status || "").toLowerCase() === "assigned" ? "pending_acceptance" :
          (row.assignment_status || "").toLowerCase() === "accepted" ? "accepted" :
            (row.assignment_status || "").toLowerCase() === "pending_approval" ? "pending_approval" :
              (row.assignment_status || "").toLowerCase(),
        work_order_status: (row.work_order_status || "").toLowerCase(),
        current_stage: row.service_status || row.current_stage,
        // Workflow fields - now returned directly from RPC
        inspection_status: (row.inspection_status as 'pending' | 'completed' | 'approved') || 'pending',
        repair_status: (row.repair_status as 'pending' | 'in_progress' | 'completed' | 'approved') || 'pending',
        review_status: (row.review_status as 'pending' | 'approved') || 'pending',
        customer_visible: row.customer_visible || false,
        tasks: row.tasks || [],
        estimated_cost: row.estimated_cost || null,
        assigned_at: row.assigned_at,
        accepted_at: row.accepted_at,
        created_at: row.created_at
      }))

      // Sort by priority
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
      workItemsData.sort((a, b) => {
        const aPriority = priorityOrder[a.priority?.toLowerCase() as keyof typeof priorityOrder] || 3
        const bPriority = priorityOrder[b.priority?.toLowerCase() as keyof typeof priorityOrder] || 3
        if (aPriority !== bPriority) return aPriority - bPriority
        return new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime()
      })

      setWorkItems(workItemsData)

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
    }
    return acc;
  }, {} as Record<string, VehicleWork & { service_types: Set<string> }>);

  const activeWorkItems = Object.values(workItemsByOrderId).filter(w =>
    !completedStates.includes(w.work_order_status?.toLowerCase() || "")
  )
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Briefcase className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Staff Portal</h1>
              <p className="text-sm text-muted-foreground">
                Welcome, {user?.full_name || user?.email || "Staff Member"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {notificationCount > 0 && (
              <Button variant="outline" size="icon" className="relative" onClick={fetchWorkItems}>
                <AlertTriangle className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                  {notificationCount}
                </span>
              </Button>
            )}
            <Badge variant="secondary">Staff</Badge>
            <Button variant="outline" onClick={() => window.location.href = "/inventory/room"}>
              <QrCode className="h-4 w-4 mr-2" />
              Inventory Room
            </Button>
            <Button onClick={signOut} variant="outline">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Acceptance</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{pendingTasks}</div>
              <p className="text-xs text-muted-foreground">Awaiting your action</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
              <Briefcase className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{inProgressTasks}</div>
              <p className="text-xs text-muted-foreground">Active work</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Awaiting Approval</CardTitle>
              <Activity className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{awaitingApproval}</div>
              <p className="text-xs text-muted-foreground">Pending manager review</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Assigned</CardTitle>
              <User className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{workItems.length}</div>
              <p className="text-xs text-muted-foreground">Vehicles assigned</p>
            </CardContent>
          </Card>
        </div>

        {/* Workflow Info Banner */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <h3 className="font-semibold">Dynamic Repair Workflow</h3>
                <p className="text-sm text-muted-foreground">
                  Repairs are hidden until inspection is approved. Complete tasks individually and submit for approval.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchWorkItems} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Work Items Tabs */}
        <div className="space-y-4">
          <div className="flex space-x-1 rounded-xl bg-muted p-1">
            <button
              onClick={() => setActiveTab("active")}
              className={`w-full rounded-lg py-2.5 text-sm font-medium leading-5 ring-offset-background transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${activeTab === "active"
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:bg-white/[0.12] hover:text-white"
                }`}
            >
              Active Work ({activeWorkItems.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`w-full rounded-lg py-2.5 text-sm font-medium leading-5 ring-offset-background transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${activeTab === "history"
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:bg-white/[0.12] hover:text-white"
                }`}
            >
              Completed History ({completedWorkItems.length})
            </button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                {activeTab === "active" ? "My Assigned Work" : "Work History"}
              </CardTitle>
              <CardDescription>
                {activeTab === "active"
                  ? "Active and pending tasks requiring your attention."
                  : "Completed work orders and delivered vehicles."}
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                <Card>
                  <CardContent className="p-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-12 w-12 text-muted-foreground" />
                      <h3 className="font-medium text-lg">No Items Found</h3>
                      <p className="text-muted-foreground">
                        {activeTab === "active"
                          ? "No active work assigned to you right now."
                          : "You haven't completed any work orders yet."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {(activeTab === "active" ? activeWorkItems : completedWorkItems).map((work) => {
                    const isCompletedHistory = activeTab === "history"
                    const canAccept = (work.status || "").toLowerCase() === "pending_acceptance" || (work.status || "").toLowerCase() === "assigned"
                    const canComplete = (work.status || "").toLowerCase() === "accepted" || (work.status || "").toLowerCase() === "in_progress"
                    const isPendingApproval = work.work_order_status.includes("pending approval") || work.status === "pending_approval"
                    // Treat approved as finished as well (it's an intermediate step before delivery)
                    const isFinished = ["completed", "delivered", "cancelled", "rejected", "approved"].includes(work.work_order_status?.toLowerCase() || "")
                    const repairsAvailable = work.inspection_status === 'approved'
                    const repairsApproved = work.repair_status === 'approved'

                    const currentStageTasks = (work.tasks || []).filter(t =>
                      repairsAvailable ? (t.task_type !== 'inspection') : (t.task_type === 'inspection')
                    )
                    const progress = calculateProgress(currentStageTasks)
                    const allRepairsCompleted = repairsAvailable && progress.completed === progress.total && progress.total > 0 && !isFinished

                    return (
                      <Card key={work.id} className={`overflow-hidden ${work.priority === "urgent" ? "border-l-4 border-l-destructive" : ""
                        }`}>
                        <CardContent className="p-0">
                          {/* Header */}
                          <div className="p-4 border-b bg-muted/30">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Wrench className="h-5 w-5 text-primary" />
                                  <h3 className="font-semibold text-lg">{work.vehicle_number}</h3>
                                  <Badge variant="outline">{work.vehicle_model}</Badge>
                                  {work.priority === "urgent" && (
                                    <Badge variant="destructive">Urgent</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {work.customer_name}
                                  </span>
                                  {/* Show all service types for consolidated work orders */}
                                  {(work as any).service_types && (work as any).service_types.size > 1 ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs">Services:</span>
                                      {Array.from((work as any).service_types).map((st: string, i: number) => (
                                        <Badge key={i} variant="outline" className="text-[10px]">
                                          {st}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="flex items-center gap-1">
                                      <Briefcase className="h-3 w-3" />
                                      {work.service_type}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                {getInspectionStatusBadge(work.inspection_status)}
                                {canAccept ? (
                                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Awaiting Your Acceptance
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Accepted & Working
                                  </Badge>
                                )}
                                {isFinished && (
                                  <Badge variant="default" className="bg-zinc-800">
                                    {['completed', 'delivered', 'approved'].includes(work.work_order_status?.toLowerCase())
                                      ? "Successfully Delivered"
                                      : work.work_order_status}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Assignment Prominence - Show big button if not accepted */}
                          {canAccept && (
                            <div className="p-8 bg-orange-50/50 border-b flex flex-col items-center justify-center text-center gap-4">
                              <div className="h-16 w-16 rounded-full bg-orange-100 flex items-center justify-center">
                                <Clock className="h-8 w-8 text-orange-600 animate-pulse" />
                              </div>
                              <div className="space-y-1">
                                <h3 className="font-bold text-lg text-orange-900 text-zinc-900">New Assignment Received</h3>
                                <p className="text-sm text-orange-700 max-w-[250px]">
                                  Please accept this assignment to begin the inspection and repair workflow.
                                </p>
                              </div>
                              <Button
                                size="lg"
                                onClick={() => handleAcceptWork(work.id)}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 shadow-lg transform transition-transform active:scale-95"
                              >
                                <CheckCircle2 className="h-5 w-5 mr-2" />
                                Accept & Start Work
                              </Button>
                            </div>
                          )}

                          {/* Progress Section - Visible when tasks are available or being worked on */}
                          {(repairsAvailable || work.inspection_status === 'pending') && !canAccept && (
                            <div className={`p-4 border-b ${repairsAvailable ? 'bg-green-50/50' : 'bg-blue-50/50'}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {repairsAvailable ? (
                                    <Wrench className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Eye className="h-4 w-4 text-blue-600" />
                                  )}
                                  <h4 className={`font-medium ${repairsAvailable ? 'text-green-800' : 'text-blue-800'}`}>
                                    {repairsAvailable ? 'Repair Progress' : 'Inspection Progress'}
                                  </h4>
                                  {repairsApproved && (
                                    <Badge variant="default" className="bg-green-600">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Approved
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-sm font-medium">
                                  {progress.completed} of {progress.total} completed
                                </span>
                              </div>
                              <Progress value={progress.percent} className="h-2 mb-2" />
                              <div className="text-xs text-muted-foreground">
                                {progress.percent}% Complete
                              </div>
                            </div>
                          )}



                          {/* Tasks Section - Visible when NOT pending acceptance */}
                          {!canAccept && !isFinished && work.tasks && work.tasks.length > 0 && (
                            <div className="p-4 space-y-4">
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
                                      <div className="border rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-3">
                                          <h4 className="text-sm font-medium flex items-center gap-2">
                                            <Wrench className="h-4 w-4" />
                                            {repairsAvailable ? 'Repair Tasks' : 'Inspection Tasks'}
                                          </h4>
                                          <Badge variant="outline" className="text-xs">
                                            {currentTasks.filter(t => t.is_completed).length}/{currentTasks.length} tasks
                                          </Badge>
                                        </div>

                                        <div className="space-y-2">
                                          {currentTasks.map((task: RepairTask, index: number) => (
                                            <div
                                              key={task.id}
                                              className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${task.is_completed
                                                ? "bg-green-50 border-green-200"
                                                : "bg-muted/30 border-transparent hover:bg-muted/50"
                                                }`}
                                            >
                                              <Checkbox
                                                id={`task-${task.id}`}
                                                checked={task.is_completed}
                                                onCheckedChange={(checked) => {
                                                  handleToggleTask(task.id, work.work_order_id, checked === true);
                                                }}
                                                disabled={isPendingApproval || repairsApproved || isFinished}
                                                className="h-5 w-5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                              />
                                              <div className="flex-1">
                                                <label
                                                  htmlFor={`task-${task.id}`}
                                                  className={`text-sm cursor-pointer ${task.is_completed ? "line-through text-muted-foreground" : ""
                                                    }`}
                                                >
                                                  {index + 1}. {task.task_name}
                                                </label>
                                                <div className="flex items-center gap-2 mt-1">
                                                  <Badge variant="outline" className="text-[10px] uppercase">
                                                    {task.task_type}
                                                  </Badge>
                                                </div>
                                              </div>
                                              {task.completed_at && (
                                                <span className="text-xs text-green-600">
                                                  ✓ {format(new Date(task.completed_at), "MMM d, HH:mm")}
                                                </span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Notification if all current stage tasks are done */}
                                    {allCurrentCompleted && !repairsAvailable && work.inspection_status === 'pending' && (
                                      <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-center gap-2 text-blue-800 text-sm">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Inspection completed. Waiting for Admin approval to start repairs.
                                      </div>
                                    )}
                                  </>
                                );
                              })()}

                              {/* Submit for Approval Button */}
                              {allRepairsCompleted && !isFinished && (
                                <Button
                                  className="w-full mt-4"
                                  onClick={() => handleSubmitForApproval(work.work_order_id)}
                                  disabled={isPendingApproval || repairsApproved}
                                  variant={isPendingApproval ? "secondary" : "default"}
                                >
                                  {isPendingApproval ? (
                                    <>
                                      <Clock className="h-4 w-4 mr-2 animate-pulse" />
                                      Waiting for Approval
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      All Repairs Complete - Submit for Approval
                                    </>
                                  )}
                                </Button>
                              )}

                              {isPendingApproval && !repairsApproved && (
                                <div className="flex items-center justify-center gap-2 p-3 bg-purple-50 rounded-lg">
                                  <Clock className="h-4 w-4 text-purple-600 animate-pulse" />
                                  <span className="text-sm font-medium text-purple-800">
                                    Awaiting Manager Approval
                                  </span>
                                </div>
                              )}
                            </div>
                          )}


                          {/* Description */}
                          <div className="p-4 text-sm text-muted-foreground border-b bg-muted/5">
                            <span className="font-semibold block mb-1">Service Description:</span>
                            {work.description}
                          </div>

                          {/* Parts Section */}
                          <div className="p-4 border-b">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full flex justify-between items-center group"
                              onClick={() => setExpandedParts(prev => ({
                                ...prev,
                                [work.work_order_id]: !prev[work.work_order_id]
                              }))}
                            >
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-primary" />
                                <span>Parts & Inventory</span>
                              </div>
                              <ChevronRight className={`h-4 w-4 transition-transform ${expandedParts[work.work_order_id] ? 'rotate-90' : ''}`} />
                            </Button>

                            {expandedParts[work.work_order_id] && (
                              <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <PartRequestList workOrderId={work.work_order_id} isAdmin={false} />
                              </div>
                            )}
                          </div>

                          {/* Footer Actions */}
                          <div className="p-4 border-t bg-muted/10 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              Assigned: {work.assigned_at ? format(new Date(work.assigned_at), "PPP p") : "N/A"}
                            </span>
                            <div className="flex gap-2">
                              {/* Prominent button is now in the body, keeping footer clean or adding secondary actions */}
                              {canComplete && !repairsAvailable && work.inspection_status === 'approved' && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
                                  <LockOpen className="h-4 w-4" />
                                  <span>Ready for repair stage</span>
                                </div>
                              )}
                              {canComplete && !repairsAvailable && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Lock className="h-4 w-4" />
                                  <span>Waiting for inspection approval</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

