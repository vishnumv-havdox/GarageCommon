/**
 * TaskCard Component
 * Displays a work order task for employees with accept/start/complete actions
 */

import { useState } from "react"
import { CheckCircle2, Clock, AlertTriangle, User, Calendar, DollarSign, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ProgressTracker, CompactProgressTracker } from "./ProgressTracker"
import { cn } from "@/lib/utils"

interface TaskCardProps {
  task: {
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
    employee_name: string | null
    assigned_at: string | null
    accepted_at: string | null
    completed_at: string | null
    work_order_created: string | null
  }
  onAccept?: (taskId: string) => void
  onComplete?: (taskId: string) => void
  onViewDetails?: (taskId: string) => void
  isLoading?: boolean
}

const priorityConfig = {
  urgent: { color: "destructive", icon: AlertTriangle, label: "Urgent" },
  high: { color: "destructive", icon: AlertTriangle, label: "High" },
  medium: { color: "default", icon: Clock, label: "Medium" },
  low: { color: "secondary", icon: Clock, label: "Low" },
}

const statusConfig = {
  assigned: { color: "outline", label: "Assigned" },
  accepted: { color: "secondary", label: "Accepted" },
  in_progress: { color: "default", label: "In Progress" },
  completed: { color: "default", label: "Completed" },
  rejected: { color: "destructive", label: "Rejected" },
}

export function TaskCard({
  task,
  onAccept,
  onComplete,
  onViewDetails,
  isLoading = false
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(false)
  
  const priority = priorityConfig[task.priority?.toLowerCase() as keyof typeof priorityConfig] || priorityConfig.medium
  const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.assigned
  const PriorityIcon = priority.icon
  
  const formatDate = (date: string | null) => {
    if (!date) return "N/A"
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const formatDateTime = (date: string | null) => {
    if (!date) return "N/A"
    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const canAccept = task.status === "assigned"
  const canComplete = task.status === "accepted" || task.status === "in_progress"
  const isCompleted = task.status === "completed"

  return (
    <Card className={cn(
      "w-full transition-all",
      isCompleted && "opacity-75",
      task.priority === "urgent" && "border-l-4 border-l-destructive"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-lg">{task.service_type}</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={priority.color as any} className="flex items-center gap-1">
              <PriorityIcon className="h-3 w-3" />
              {priority.label}
            </Badge>
            <Badge variant={status.color as any}>
              {status.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Vehicle & Customer Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <User className="h-3 w-3" />
              <span>Customer</span>
            </div>
            <span className="font-medium">{task.customer_name || "N/A"}</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Wrench className="h-3 w-3" />
              <span>Vehicle</span>
            </div>
            <span className="font-medium">
              {task.vehicle_number || "N/A"}
              {task.model && ` (${task.model})`}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-muted/30 rounded-lg p-3">
          <CompactProgressTracker currentStage={task.current_stage} />
        </div>

        {/* Cost Info (if available) */}
        {(task.estimated_cost || task.actual_cost) && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Estimated:</span>
              <span className="font-medium">₹{task.estimated_cost?.toLocaleString() || "0"}</span>
            </div>
            {task.actual_cost && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Actual:</span>
                <span className="font-medium">₹{task.actual_cost.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Timestamps */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>Assigned: {formatDateTime(task.assigned_at)}</span>
          </div>
          {task.accepted_at && (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              <span>Accepted: {formatDateTime(task.accepted_at)}</span>
            </div>
          )}
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="pt-3 border-t space-y-3">
            <div>
              <h4 className="text-sm font-medium mb-2">Full Description</h4>
              <p className="text-sm text-muted-foreground">{task.description}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Hide Details" : "View Details"}
          </Button>
          
          <div className="flex gap-2">
            {canAccept && onAccept && (
              <Button
                size="sm"
                onClick={() => onAccept(task.id)}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Accept Task
              </Button>
            )}
            {canComplete && onComplete && (
              <Button
                size="sm"
                onClick={() => onComplete(task.id)}
                disabled={isLoading}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Mark Complete
              </Button>
            )}
            {onViewDetails && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDetails(task.id)}
              >
                View Details
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Task List Component
interface TaskListProps {
  tasks: TaskCardProps["task"][]
  onAccept?: (taskId: string) => void
  onComplete?: (taskId: string) => void
  onViewDetails?: (taskId: string) => void
  isLoading?: boolean
  emptyMessage?: string
}

export function TaskList({
  tasks,
  onAccept,
  onComplete,
  onViewDetails,
  isLoading = false,
  emptyMessage = "No tasks assigned"
}: TaskListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="w-full">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
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

  if (tasks.length === 0) {
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
  const sortedTasks = [...tasks].sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
    const aPriority = priorityOrder[a.priority?.toLowerCase() as keyof typeof priorityOrder] || 3
    const bPriority = priorityOrder[b.priority?.toLowerCase() as keyof typeof priorityOrder] || 3
    if (aPriority !== bPriority) return aPriority - bPriority
    return new Date(b.work_order_created || "").getTime() - new Date(a.work_order_created || "").getTime()
  })

  return (
    <div className="space-y-4">
      {sortedTasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onAccept={onAccept}
          onComplete={onComplete}
          onViewDetails={onViewDetails}
          isLoading={isLoading}
        />
      ))}
    </div>
  )
}

