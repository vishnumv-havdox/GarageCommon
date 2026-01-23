/**
 * WorkOrderTimeline Component
 * Customer-facing timeline view showing the entire service lifecycle
 */

import { useState } from "react"
import { CheckCircle2, Circle, Clock, Truck, User, DollarSign, Calendar, MapPin } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface TimelineEvent {
  stage: string
  status: 'completed' | 'in_progress' | 'pending'
  timestamp: string | null
  notes?: string
  location?: string
}

interface WorkOrderTimelineProps {
  workOrder: {
    id: string
    service_type: string
    description: string
    status: string
    current_stage: string | null
    estimated_cost: number | null
    actual_cost: number | null
    approved_at: string | null
    customer_visible: boolean | null
    vehicle_number: string | null
    model: string | null
    customer_name: string | null
    created_at: string
  }
  stages?: Array<{
    stage: string
    status: string
    started_at: string | null
    completed_at: string | null
    notes: string | null
  }>
  onContactSupport?: () => void
}

const stageConfig = [
  { key: 'Inspection', icon: Clock, label: 'Vehicle Inspection', description: 'Initial diagnosis and assessment' },
  { key: 'Repair', icon: Truck, label: 'Repair Work', description: 'Main repair and maintenance' },
  { key: 'Review', icon: User, label: 'Internal Review', description: 'Work quality verification' },
  { key: 'Quality Check', icon: CheckCircle2, label: 'Quality Check', description: 'Final quality assurance' },
  { key: 'Delivery', icon: MapPin, label: 'Ready for Delivery', description: 'Vehicle ready for pickup' },
]

export function WorkOrderTimeline({ workOrder, stages, onContactSupport }: WorkOrderTimelineProps) {
  const [showDetails, setShowDetails] = useState(false)
  
  const getStageStatus = (stageKey: string): 'completed' | 'in_progress' | 'pending' => {
    const currentStageIndex = stageConfig.findIndex(s => s.key === workOrder.current_stage)
    const stageIndex = stageConfig.findIndex(s => s.key === stageKey)
    
    if (stageIndex < currentStageIndex) return 'completed'
    if (stageIndex === currentStageIndex) return 'in_progress'
    return 'pending'
  }

  const getStageTimestamp = (stageKey: string): string | null => {
    if (!stages) return null
    const stage = stages.find(s => s.stage === stageKey)
    if (stage?.completed_at) return stage.completed_at
    if (stage?.started_at) return stage.started_at
    return null
  }

  const formatDateTime = (timestamp: string | null): string => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const currentStageIndex = stageConfig.findIndex(s => s.key === workOrder.current_stage)
  const isCompleted = workOrder.status === 'Completed'
  const canShowCost = workOrder.customer_visible && workOrder.actual_cost

  const completedStages = stageConfig.filter((_, i) => i < currentStageIndex).length
  const progressPercentage = (completedStages / (stageConfig.length - 1)) * 100

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">{workOrder.service_type}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Vehicle: {workOrder.vehicle_number} {workOrder.model && `- ${workOrder.model}`}
            </p>
          </div>
          <Badge 
            variant={isCompleted ? "default" : workOrder.status === "In Progress" ? "secondary" : "outline"}
            className="text-sm"
          >
            {workOrder.status}
          </Badge>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Started</span>
            <span>{Math.round(progressPercentage)}% Complete</span>
            <span>Delivery</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {/* Timeline */}
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-muted" />
          
          <div className="space-y-6">
            {stageConfig.map((stage, index) => {
              const status = getStageStatus(stage.key)
              const timestamp = getStageTimestamp(stage.key)
              const isLast = index === stageConfig.length - 1
              const StageIcon = stage.icon
              
              return (
                <div key={stage.key} className="relative flex gap-4">
                  {/* Icon */}
                  <div 
                    className={cn(
                      "relative z-10 w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all",
                      status === 'completed' ? "bg-primary text-primary-foreground" :
                      status === 'in_progress' ? "bg-primary text-primary-foreground ring-4 ring-primary/20 animate-pulse" :
                      "bg-muted text-muted-foreground"
                    )}
                  >
                    {status === 'completed' ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      <StageIcon className="h-5 w-5" />
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className={cn(
                          "font-medium",
                          status === 'in_progress' && "text-primary"
                        )}>
                          {stage.label}
                        </h4>
                        <p className="text-sm text-muted-foreground">{stage.description}</p>
                      </div>
                      {timestamp && (
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(timestamp)}
                        </span>
                      )}
                    </div>
                    
                    {/* Status Badge */}
                    <div className="mt-2">
                      <Badge 
                        variant={status === 'completed' ? "default" : status === 'in_progress' ? "secondary" : "outline"}
                        className="text-xs"
                      >
                        {status === 'completed' ? "Completed" : 
                         status === 'in_progress' ? "In Progress" : "Pending"}
                      </Badge>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Cost Information */}
        {(workOrder.estimated_cost || canShowCost) && (
          <div className="mt-8 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <h4 className="font-medium">Cost Details</h4>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Estimated Cost</span>
                <p className="text-lg font-semibold">₹{workOrder.estimated_cost?.toLocaleString() || "TBD"}</p>
              </div>
              {canShowCost && (
                <div>
                  <span className="text-sm text-muted-foreground">Final Cost</span>
                  <p className="text-lg font-semibold text-primary">₹{workOrder.actual_cost?.toLocaleString()}</p>
                </div>
              )}
            </div>
            {!canShowCost && workOrder.status !== 'Completed' && (
              <p className="text-xs text-muted-foreground mt-2">
                Final cost will be shared after work completion and approval
              </p>
            )}
          </div>
        )}

        {/* Order Details */}
        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Created:</span>
            <span>{formatDateTime(workOrder.created_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Customer:</span>
            <span>{workOrder.customer_name}</span>
          </div>
        </div>

        {/* Description */}
        <div className="mt-4 p-3 bg-muted/20 rounded-lg">
          <p className="text-sm text-muted-foreground">{workOrder.description}</p>
        </div>

        {/* Actions */}
        {onContactSupport && (
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDetails(!showDetails)}>
              {showDetails ? "Hide" : "Show"} Details
            </Button>
            <Button onClick={onContactSupport}>
              Contact Support
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Compact timeline for lists
interface CompactTimelineProps {
  currentStage: string | null
  status: string
  className?: string
}

export function CompactTimeline({ currentStage, status, className }: CompactTimelineProps) {
  const currentStageIndex = stageConfig.findIndex(s => s.key === currentStage)
  const isCompleted = status === 'Completed'
  const progress = isCompleted ? 100 : (currentStageIndex / (stageConfig.length - 1)) * 100

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isCompleted ? "bg-green-500" : "bg-primary"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-medium">
          {isCompleted ? "Done" : currentStage || "Started"}
        </span>
      </div>
    </div>
  )
}

