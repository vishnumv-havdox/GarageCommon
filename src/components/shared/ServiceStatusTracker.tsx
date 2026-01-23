import { CheckCircle, Circle, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type ServiceStatus = "pending" | "in-progress" | "completed" | "ready";
export type ServiceBranch = "mechanical" | "tinker" | "painting" | "electrical" | "final-check";

interface ServiceStep {
  branch: ServiceBranch;
  name: string;
  status: ServiceStatus;
  assignedTo?: string;
  estimatedTime?: string;
  completedAt?: string;
}

interface ServiceStatusTrackerProps {
  vehicleNumber: string;
  customerName: string;
  steps: ServiceStep[];
  overallStatus?: ServiceStatus;
}

const statusColors = {
  pending: "bg-status-pending",
  "in-progress": "bg-status-progress", 
  completed: "bg-status-completed",
  ready: "bg-status-ready"
};

const statusIcons = {
  pending: Clock,
  "in-progress": Circle,
  completed: CheckCircle,
  ready: CheckCircle
};

const branchIcons = {
  mechanical: "🔧",
  tinker: "🔨", 
  painting: "🎨",
  electrical: "⚡",
  "final-check": "✅"
};

export default function ServiceStatusTracker({ 
  vehicleNumber, 
  customerName, 
  steps, 
  overallStatus = "pending" 
}: ServiceStatusTrackerProps) {
  const completedSteps = steps.filter(step => step.status === "completed").length;
  const progressPercentage = (completedSteps / steps.length) * 100;

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{vehicleNumber}</h3>
            <p className="text-sm text-muted-foreground">{customerName}</p>
          </div>
          <Badge 
            variant="secondary" 
            className={`${statusColors[overallStatus]} text-white font-medium`}
          >
            {overallStatus === "ready" ? "Ready for Delivery" : overallStatus.toUpperCase()}
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Progress</span>
            <span className="text-sm text-muted-foreground">{completedSteps}/{steps.length} completed</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div 
              className="bg-gradient-primary h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Service Steps */}
        <div className="space-y-4">
          {steps.map((step, index) => {
            const StatusIcon = statusIcons[step.status];
            const isLast = index === steps.length - 1;
            
            return (
              <div key={step.branch} className="relative">
                {/* Connecting Line */}
                {!isLast && (
                  <div 
                    className={`absolute left-6 top-12 w-0.5 h-8 ${
                      step.status === "completed" ? "bg-status-completed" : "bg-border"
                    }`} 
                  />
                )}
                
                {/* Step Content */}
                <div className="flex items-start space-x-4">
                  {/* Icon */}
                  <div className={`
                    relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300
                    ${step.status === "completed" 
                      ? "bg-status-completed border-status-completed text-white" 
                      : step.status === "in-progress"
                      ? "bg-status-progress border-status-progress text-white animate-glow"
                      : "bg-card border-border text-muted-foreground"
                    }
                  `}>
                    <span className="text-xl">{branchIcons[step.branch]}</span>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-foreground">{step.name}</h4>
                      <StatusIcon className={`h-4 w-4 ${
                        step.status === "completed" 
                          ? "text-status-completed" 
                          : step.status === "in-progress"
                          ? "text-status-progress"
                          : "text-muted-foreground"
                      }`} />
                    </div>
                    
                    {step.assignedTo && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Assigned to: {step.assignedTo}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant="outline" className="text-xs">
                        {step.status.replace("-", " ")}
                      </Badge>
                      {step.estimatedTime && step.status !== "completed" && (
                        <span className="text-xs text-muted-foreground">
                          Est: {step.estimatedTime}
                        </span>
                      )}
                      {step.completedAt && (
                        <span className="text-xs text-status-completed">
                          Completed: {step.completedAt}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}