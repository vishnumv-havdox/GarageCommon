import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning";
}

const variantStyles = {
  default: "bg-gradient-card border-border",
  primary: "bg-gradient-primary text-primary-foreground border-primary",
  success: "bg-gradient-to-br from-status-completed/10 to-status-completed/5 border-status-completed/20",
  warning: "bg-gradient-to-br from-status-pending/10 to-status-pending/5 border-status-pending/20"
};

export default function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  variant = "default" 
}: StatsCardProps) {
  return (
    <Card className={`${variantStyles[variant]} shadow-card hover:shadow-elegant transition-all duration-300 hover:scale-105`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className={`text-sm font-medium ${
              variant === "primary" ? "text-primary-foreground/80" : "text-muted-foreground"
            }`}>
              {title}
            </p>
            <div className="space-y-1">
              <p className={`text-2xl font-bold ${
                variant === "primary" ? "text-primary-foreground" : "text-foreground"
              }`}>
                {value}
              </p>
              {subtitle && (
                <p className={`text-sm ${
                  variant === "primary" ? "text-primary-foreground/70" : "text-muted-foreground"
                }`}>
                  {subtitle}
                </p>
              )}
            </div>
            {trend && (
              <div className="flex items-center space-x-1">
                <span className={`text-sm font-medium ${
                  trend.isPositive ? "text-status-completed" : "text-destructive"
                }`}>
                  {trend.isPositive ? "+" : ""}{trend.value}%
                </span>
                <span className={`text-xs ${
                  variant === "primary" ? "text-primary-foreground/70" : "text-muted-foreground"
                }`}>
                  vs last month
                </span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-full ${
            variant === "primary" 
              ? "bg-primary-foreground/10" 
              : variant === "success"
              ? "bg-status-completed/10"
              : variant === "warning"
              ? "bg-status-pending/10"
              : "bg-primary/10"
          }`}>
            <Icon className={`h-6 w-6 ${
              variant === "primary" 
                ? "text-primary-foreground" 
                : variant === "success"
                ? "text-status-completed"
                : variant === "warning"
                ? "text-status-pending"
                : "text-primary"
            }`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}