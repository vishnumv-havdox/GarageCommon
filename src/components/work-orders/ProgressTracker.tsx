/**
 * ProgressTracker Component
 * Visual progress indicator for work order stages
 */

import { useState } from "react"
import { CheckCircle2, Circle, Clock, ChevronRight, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type WorkOrderStage =
  | 'Inspection'
  | 'Repair'
  | 'Review'
  | 'Quality Check'
  | 'Delivery'

interface StageInfo {
  name: WorkOrderStage
  label: string
  description: string
}

const stages: StageInfo[] = [
  { name: 'Inspection', label: 'Inspection', description: 'Initial vehicle inspection and diagnosis' },
  { name: 'Repair', label: 'Repair', description: 'Main repair and maintenance work' },
  { name: 'Review', label: 'Review', description: 'Internal review of completed work' },
  { name: 'Quality Check', label: 'Quality Check', description: 'Quality assurance verification' },
  { name: 'Delivery', label: 'Delivery', description: 'Final delivery preparation' },
]

interface ProgressTrackerProps {
  currentStage: string | null
  stagesData?: Array<{
    id: string
    stage: string
    status: string
    started_at: string | null
    completed_at: string | null
    notes: string | null
  }>
  onAdvanceStage?: (nextStage: string) => void
  canAdvance?: boolean
  isAdmin?: boolean
}

export function ProgressTracker({
  currentStage,
  stagesData,
  onAdvanceStage,
  canAdvance = false,
  isAdmin = false
}: ProgressTrackerProps) {
  const [expanded, setExpanded] = useState(false)

  const currentStageIndex = stages.findIndex(s => s.name === currentStage) || 0

  const getStageStatus = (stageName: string): 'completed' | 'in_progress' | 'pending' => {
    // If we have a currentStage, use strict sequential logic based on index
    if (currentStage) {
      const stageIndex = stages.findIndex(s => s.name === stageName)

      if (stageIndex < currentStageIndex) return 'completed'
      if (stageIndex === currentStageIndex) return 'in_progress'
      return 'pending'
    }

    // Fallback if no currentStage is provided (shouldn't happen in main flows)
    if (!stagesData) {
      const index = stages.findIndex(s => s.name === stageName)
      if (index < currentStageIndex) return 'completed'
      if (index === currentStageIndex) return 'in_progress'
      return 'pending'
    }

    const stage = stagesData.find(s => s.stage === stageName)
    if (stage?.status === 'completed') return 'completed'
    if (stage?.status === 'in_progress') return 'in_progress'
    return 'pending'
  }

  const getStageTimestamp = (stageName: string): string | null => {
    if (!stagesData) return null
    const stage = stagesData.find(s => s.stage === stageName)
    if (stage?.completed_at) return stage.completed_at
    if (stage?.started_at) return stage.started_at
    return null
  }

  const formatTimestamp = (timestamp: string | null): string => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleAdvanceStage = () => {
    if (currentStage && onAdvanceStage) {
      const nextStageIndex = currentStageIndex + 1
      if (nextStageIndex < stages.length) {
        onAdvanceStage(stages[nextStageIndex].name)
      }
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Work Progress
          </CardTitle>
          <div className="flex items-center gap-2">
            {currentStage && (
              <Badge variant="outline" className="text-sm">
                Stage: {currentStage}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronRight className="h-4 w-4 mr-1" />
                  Show Details
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress Bar */}
        <div className="relative mb-6">
          <div className="absolute top-4 left-4 right-4 h-1 bg-muted rounded" />
          <div
            className="absolute top-4 left-4 h-1 bg-primary rounded transition-all duration-500"
            style={{ width: `${(currentStageIndex / (stages.length - 1)) * 100}%` }}
          />

          <div className="relative flex justify-between">
            {stages.map((stage, index) => {
              const status = getStageStatus(stage.name)
              const isCompleted = status === 'completed'
              const isCurrent = status === 'in_progress'
              const timestamp = getStageTimestamp(stage.name)

              return (
                <div key={stage.name} className="flex flex-col items-center">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                      isCompleted ? "bg-primary text-primary-foreground" :
                        isCurrent ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                          "bg-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </div>
                  <span className={cn(
                    "text-xs mt-2 font-medium",
                    isCurrent ? "text-primary" : "text-muted-foreground"
                  )}>
                    {stage.label}
                  </span>
                  {expanded && timestamp && (
                    <span className="text-[10px] text-muted-foreground mt-1">
                      {formatTimestamp(timestamp)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Stage Details (Expanded) */}
        {expanded && (
          <div className="space-y-3 border-t pt-4 mt-4">
            {stages.map((stage) => {
              const status = getStageStatus(stage.name)
              const stageData = stagesData?.find(s => s.stage === stage.name)

              return (
                <div
                  key={stage.name}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg transition-colors",
                    status === 'in_progress' ? "bg-primary/5 border border-primary/20" : "bg-muted/30"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center mt-0.5",
                    status === 'completed' ? "bg-primary text-primary-foreground" :
                      status === 'in_progress' ? "bg-primary text-primary-foreground" :
                        "bg-muted text-muted-foreground"
                  )}>
                    {status === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : status === 'in_progress' ? (
                      <Clock className="h-4 w-4 animate-pulse" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{stage.label}</span>
                      <Badge variant={status === 'completed' ? 'default' : status === 'in_progress' ? 'secondary' : 'outline'} className="text-xs">
                        {status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{stage.description}</p>
                    {stageData?.completed_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Completed: {formatTimestamp(stageData.completed_at)}
                      </p>
                    )}
                    {stageData?.notes && (
                      <p className="text-xs mt-2 p-2 bg-muted rounded">
                        {stageData.notes}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Advance Stage Button */}
        {canAdvance && isAdmin && currentStageIndex < stages.length - 1 && (
          <div className="flex justify-end mt-4 pt-4 border-t">
            <Button onClick={handleAdvanceStage} size="sm">
              Advance to {stages[currentStageIndex + 1]?.label}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Compact version for lists
interface CompactProgressTrackerProps {
  currentStage: string | null
  status?: string
  className?: string
}

export function CompactProgressTracker({ currentStage, status, className }: CompactProgressTrackerProps) {
  const currentStageIndex = stages.findIndex(s => s.name === currentStage) || 0
  const isCompleted = status === 'Completed'
  const progress = isCompleted ? 100 : (currentStageIndex / (stages.length - 1)) * 100

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{stages[0]?.label}</span>
        <span>{stages[stages.length - 1]?.label}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden border border-border/10">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isCompleted ? "bg-green-500" : "bg-primary"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className={cn("text-xs font-medium", isCompleted ? "text-green-600" : "text-primary")}>
        {isCompleted ? "Completed" : currentStage || 'Not Started'}
      </div>
    </div>
  )
}

