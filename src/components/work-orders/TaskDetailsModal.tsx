/**
 * TaskDetailsModal Component
 * Displays detailed information about a work order task
 */

import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ProgressTracker, CompactProgressTracker } from "./ProgressTracker"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  Truck, User, Calendar, DollarSign, Wrench, CheckCircle2,
  Clock, AlertTriangle, FileText, List
} from "lucide-react"
import { format } from "date-fns"

interface TaskDetailsModalProps {
  taskId: string | null
  open: boolean
  onClose: () => void
  onAccept?: (taskId: string) => void
  onComplete?: (taskId: string) => void
}

interface TaskDetails {
  id: string
  work_order_id: string
  service_type: string
  description: string
  priority: string
  status: string
  current_stage: string | null
  estimated_cost: number | null
  actual_cost: number | null
  vehicle_number: string | null
  model: string | null
  customer_name: string | null
  customer_phone: string | null
  employee_name: string | null
  assigned_at: string | null
  accepted_at: string | null
  completed_at: string | null
  work_order_created: string | null
  // Additional details
  tasks?: Array<{
    id: string
    task_name: string
    completed: boolean
    task_type?: string
  }>
  employee_assignments?: Array<{
    id: string
    employee_id: string
    status: string
    employee: { name: string } | null
  }>
}

export function TaskDetailsModal({ taskId, open, onClose, onAccept, onComplete }: TaskDetailsModalProps) {
  const [task, setTask] = useState<TaskDetails | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (taskId && open) {
      fetchTaskDetails()
    } else {
      setTask(null)
    }
  }, [taskId, open])

  const fetchTaskDetails = async () => {
    if (!taskId) return
    setLoading(true)
    try {
      // First check if it's a legacy assignment or service employee
      const { data: legacyAssignment } = await supabase
        .from("work_order_assignments")
        .select(`
          *,
          work_orders (
            *,
            vehicle:vehicles(vehicle_number, model, customers!inner(name, phone))
          )
        `)
        .eq("id", taskId)
        .maybeSingle()

      if (legacyAssignment) {
        const doc = legacyAssignment as any;
        const wo = doc.work_orders as any
        setTask({
          id: doc.id,
          work_order_id: doc.work_order_id,
          service_type: wo?.service_type || "General",
          description: wo?.description || "",
          priority: wo?.priority || "Medium",
          status: doc.status,
          current_stage: wo?.current_stage,
          estimated_cost: wo?.estimated_cost,
          actual_cost: wo?.actual_cost,
          vehicle_number: wo?.vehicle?.vehicle_number,
          model: wo?.vehicle?.model,
          customer_name: wo?.vehicle?.customers?.name,
          customer_phone: wo?.vehicle?.customers?.phone,
          employee_name: null,
          assigned_at: (legacyAssignment as any).assigned_at,
          accepted_at: (legacyAssignment as any).accepted_at,
          completed_at: (legacyAssignment as any).completed_at,
          work_order_created: wo?.created_at
        })
        return
      }

      // Try service employee
      const { data: serviceAssignment } = await supabase
        .from("work_order_service_employees")
        .select(`
          *,
          service:work_order_services (
            *,
            work_order:work_orders (
              *,
              vehicle:vehicles(vehicle_number, model, customers!inner(name, phone)),
              tasks:work_order_tasks(id, task_name, completed, service_id)
            )
          ),
          employee:employees(name)
        `)
        .eq("id", taskId)
        .maybeSingle()

      if (serviceAssignment) {
        const doc = serviceAssignment as any;
        const service = doc.service as any
        const wo = service?.work_order as any
        setTask({
          id: doc.id,
          work_order_id: service?.work_order_id,
          service_type: service?.service_type || "Service",
          description: service?.work_order?.description || "",
          priority: wo?.priority || "Medium",
          status: doc.status,
          current_stage: service?.status,
          estimated_cost: service?.estimated_cost,
          actual_cost: service?.actual_cost,
          vehicle_number: wo?.vehicle?.vehicle_number,
          model: wo?.vehicle?.model,
          customer_name: wo?.vehicle?.customers?.name,
          customer_phone: wo?.vehicle?.customers?.phone,
          employee_name: (serviceAssignment as any).employee?.name,
          assigned_at: (serviceAssignment as any).assigned_at,
          accepted_at: (serviceAssignment as any).accepted_at,
          completed_at: (serviceAssignment as any).completed_at,
          work_order_created: wo?.created_at,
          tasks: (wo?.tasks || []).filter((t: any) => t.service_id === service?.id),
          employee_assignments: []
        })
      }
    } catch (error) {
      console.error("Error fetching task details:", error)
    } finally {
      setLoading(false)
    }
  }

  const normalizeStatus = (status: string) => {
    const s = status.toLowerCase()
    if (s === "assigned") return "assigned"
    if (s === "accepted" || s === "in progress") return "accepted"
    if (s === "completed") return "completed"
    return "assigned"
  }

  const normalizedStatus = task ? normalizeStatus(task.status) : ""
  const canAccept = normalizedStatus === "assigned"
  const canComplete = normalizedStatus === "accepted"

  const formatDateTime = (date: string | null) => {
    if (!date) return "N/A"
    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Task Details
          </DialogTitle>
          <DialogDescription>
            Complete information about this work order task
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : task ? (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold">{task.service_type}</h3>
                <p className="text-sm text-muted-foreground">{task.description}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant={task.priority === "Urgent" ? "destructive" : "secondary"}>
                  {task.priority}
                </Badge>
                <Badge variant="outline">{normalizedStatus}</Badge>
              </div>
            </div>

            {/* Vehicle & Customer Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Vehicle & Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Truck className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Vehicle</p>
                    <p className="font-medium">
                      {task.vehicle_number || "N/A"} {task.model && `(${task.model})`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Customer</p>
                    <p className="font-medium">{task.customer_name || "N/A"}</p>
                    {task.customer_phone && (
                      <p className="text-xs text-muted-foreground">{task.customer_phone}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Progress */}
            <div className="bg-muted/30 rounded-lg p-4">
              <CompactProgressTracker currentStage={task.current_stage} status={task.status} />
            </div>

            {/* Cost Info */}
            {(task.estimated_cost || task.actual_cost) && (
              <Card>
                <CardContent className="pt-4 flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Estimated:</span>
                    <span className="font-semibold">₹{task.estimated_cost?.toLocaleString() || "0"}</span>
                  </div>
                  {task.actual_cost && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Actual:</span>
                      <span className="font-semibold">₹{task.actual_cost.toLocaleString()}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tasks Checklist */}
            {task.tasks && task.tasks.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <List className="h-4 w-4" />
                    Service Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {task.tasks.map((t) => (
                      <div key={t.id} className="flex items-center gap-2">
                        {t.completed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={t.completed ? "line-through text-muted-foreground" : ""}>
                          {t.task_name}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timestamps */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Created:</span>
                  <span className="font-medium">{formatDateTime(task.work_order_created)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Assigned:</span>
                  <span className="font-medium">{formatDateTime(task.assigned_at)}</span>
                </div>
                {task.accepted_at && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Accepted:</span>
                    <span className="font-medium">{formatDateTime(task.accepted_at)}</span>
                  </div>
                )}
                {task.completed_at && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Completed:</span>
                    <span className="font-medium">{formatDateTime(task.completed_at)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {canAccept && onAccept && (
                <Button onClick={() => onAccept(task.id)} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Accept Task
                </Button>
              )}
              {canComplete && onComplete && (
                <Button onClick={() => onComplete(task.id)}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark Complete
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Task not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

