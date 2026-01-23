
/**
 * StaffWorkCard Component
 * Displays work for a single vehicle with step-by-step task completion
 */

import { useState } from "react"
import {
  CheckCircle2, Clock, AlertTriangle, User, Calendar,
  Wrench, ChevronDown, ChevronUp, Car, Truck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface TaskStep {
  id: string
  task_name: string
  status: string
  is_completed: boolean
  completed_at?: string | null
}

interface VehicleWork {
  id: string
  work_order_id: string
  vehicle_number: string
  vehicle_model: string
  customer_name: string
  service_type: string
  description: string
  priority: string
  status: string
  current_stage: string | null
  tasks: TaskStep[]
  estimated_cost: number | null
  assigned_at: string | null
  accepted_at: string | null
  created_at: string | null
}

interface StaffWorkCardProps {
  work: VehicleWork
  onAccept?: (assignmentId: string) => void
  onCompleteStep?: (taskId: string, assignmentId: string) => void
  onViewDetails?: (workOrderId: string) => void
  isLoading?: boolean
}

// Priority configuration
const priorityConfig: Record<string, { color: string; icon: typeof AlertTriangle; label: string }> = {
  urgent: { color: "destructive", icon: AlertTriangle, label: "Urgent" },
  high: { color: "destructive", icon: AlertTriangle, label: "High" },
  medium: { color: "default", icon: Clock, label: "Medium" },
  low: { color: "secondary", icon: Clock, label: "Low" },
}

// Status configuration
const statusConfig: Record<string, { color: string; label: string; action?: string }> = {
  pending_acceptance: { color: "outline", label: "Pending Acceptance", action: "Accept" },
  accepted: { color: "secondary", label: "Accepted" },
  in_progress: { color: "default", label: "In Progress" },
  pending_approval: { color: "warning", label: "Pending Approval" },
  approved: { color: "default", label: "Approved" },
  rejected: { color: "destructive", label: "Rejected" },
  completed: { color: "default", label: "Completed" },
}

export function StaffWorkCard({
  work,
  onAccept,
  onCompleteStep,
  onViewDetails,
  isLoading = false
}: StaffWorkCardProps) {
  const [expanded, setExpanded] = useState(false)

  const priority = priorityConfig[work.priority?.toLowerCase()] || priorityConfig.medium
  const status = statusConfig[work.status.toLowerCase()] || statusConfig.pending_acceptance
  const PriorityIcon = priority.icon

  const completedTasks = work.tasks.filter(t => t.is_completed).length
  const totalTasks = work.tasks.length
  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
  const canAccept = work.status === "pending_acceptance" || work.status === "assigned"
  const canComplete = work.status === "accepted" || work.status === "in_progress"
  const isPendingApproval = work.status === "pending_approval"

  const formatDateTime = (date: string | null) => {
    if (!date) return "N/A"
    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const handleStepToggle = (taskId: string) => {
    if (onCompleteStep && !isLoading) {
      onCompleteStep(taskId, work.id)
    }
  }

  return (
    <Card className={cn(
      "w-full transition-all",
      work.priority === "urgent" && "border-l-4 border-l-destructive",
      work.priority === "high" && "border-l-4 border-l-orange-500"
    )}>
      <CardHeader className="pb-3">
        {/* Vehicle & Customer Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl font-bold">
                {work.vehicle_number}
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {work.vehicle_model}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {work.customer_name}
              </span>
              <span className="flex items-center gap-1">
                <Wrench className="h-3 w-3" />
                {work.service_type}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={priority.color as any} className="flex items-center gap-1">
              <PriorityIcon className="h-3 w-3" />
              {priority.label}
            </Badge>
            <Badge variant="secondary" className={cn(
              status.color === "warning" && "bg-orange-100 text-orange-800"
            )}>
              {status.label}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {totalTasks > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{completedTasks} / {totalTasks} tasks</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {/* Description */}
        <div className="text-sm text-muted-foreground">
          {work.description}
        </div>

        {/* Timestamps */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>Assigned: {formatDateTime(work.assigned_at)}</span>
          </div>
          {work.accepted_at && (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              <span>Accepted: {formatDateTime(work.accepted_at)}</span>
            </div>
          )}
        </div>

        {/* Expandable Task List */}
        {work.tasks.length > 0 && (
          <div className="border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="mb-3 w-full justify-between"
            >
              <span>Task Checklist ({totalTasks} tasks)</span>
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            {expanded && (
              <div className="space-y-2">
                {work.tasks.map((task, index) => (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all",
                      task.is_completed
                        ? "bg-green-50 border-green-200"
                        : "bg-muted/30 border-transparent"
                    )}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStepToggle(task.id)}
                      disabled={isLoading || isPendingApproval}
                      className={cn(
                        "h-8 w-8 rounded-full p-0",
                        task.is_completed
                          ? "bg-green-500 hover:bg-green-600 text-white"
                          : "border-2 border-muted-foreground/30"
                      )}
                    >
                      {task.is_completed && (
                        <CheckCircle2 className="h-5 w-5" />
                      )}
                    </Button>

                    <div className="flex-1">
                      <span className={cn(
                        "text-sm",
                        task.is_completed && "line-through text-muted-foreground"
                      )}>
                        {index + 1}. {task.task_name}
                      </span>
                      {task.completed_at && (
                        <div className="text-xs text-muted-foreground">
                          Completed: {formatDateTime(task.completed_at)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails?.(work.work_order_id)}
          >
            View Details
          </Button>

          <div className="flex gap-2">
            {canAccept && onAccept && (
              <Button
                size="sm"
                onClick={() => onAccept(work.id)}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Accept Assignment
              </Button>
            )}
            {canComplete && !isPendingApproval && (
              <Button
                size="sm"
                onClick={() => {
                  // Complete all pending tasks and submit for approval
                  const pendingTasks = work.tasks.filter(t => !t.is_completed)
                  if (pendingTasks.length > 0) {
                    // Complete remaining tasks
                    pendingTasks.forEach(t => {
                      onCompleteStep?.(t.id, work.id)
                    })
                  }
                }}
                disabled={isLoading}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Complete All & Submit
              </Button>
            )}
            {isPendingApproval && (
              <Badge variant="outline" className="bg-orange-50 text-orange-800">
                Awaiting Manager Approval
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Work List Component
interface StaffWorkListProps {
  workItems: VehicleWork[]
  onAccept?: (assignmentId: string) => void
  onCompleteStep?: (taskId: string, assignmentId: string) => void
  onViewDetails?: (workOrderId: string) => void
  isLoading?: boolean
  emptyMessage?: string
}

export function StaffWorkList({
  workItems,
  onAccept,
  onCompleteStep,
  onViewDetails,
  isLoading = false,
  emptyMessage = "No work assigned to you yet"
}: StaffWorkListProps) {
  if (isLoading) {
    return (
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
    )
  }

  if (workItems.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center gap-2">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground" />
            <h3 className="font-medium text-lg">All Caught Up!</h3>
            <p className="text-muted-foreground">{emptyMessage}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Sort by priority (urgent first) and then by date
  const sortedWork = [...workItems].sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
    const aPriority = priorityOrder[a.priority?.toLowerCase() as keyof typeof priorityOrder] || 3
    const bPriority = priorityOrder[b.priority?.toLowerCase() as keyof typeof priorityOrder] || 3
    if (aPriority !== bPriority) return aPriority - bPriority
    return new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime()
  })

  return (
    <div className="space-y-4">
      {sortedWork.map((work) => (
        <StaffWorkCard
          key={work.id}
          work={work}
          onAccept={onAccept}
          onCompleteStep={onCompleteStep}
          onViewDetails={onViewDetails}
          isLoading={isLoading}
        />
      ))}
    </div>
  )
}

