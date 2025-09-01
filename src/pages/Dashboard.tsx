import { Car, Users, Wrench, DollarSign, Package, TrendingUp, Clock, CheckCircle } from "lucide-react";
import StatsCard from "@/components/StatsCard";
import ServiceStatusTracker from "@/components/ServiceStatusTracker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Mock data for demonstration
const mockServiceSteps = [
  {
    branch: "mechanical" as const,
    name: "Mechanical Works",
    status: "completed" as const,
    assignedTo: "John Smith",
    completedAt: "2024-01-15 10:30"
  },
  {
    branch: "tinker" as const,
    name: "Tinker Works",
    status: "completed" as const,
    assignedTo: "Mike Johnson", 
    completedAt: "2024-01-15 14:45"
  },
  {
    branch: "painting" as const,
    name: "Painting Works",
    status: "in-progress" as const,
    assignedTo: "Sarah Davis",
    estimatedTime: "2 hours"
  },
  {
    branch: "electrical" as const,
    name: "Electrical Works", 
    status: "pending" as const,
    estimatedTime: "1 hour"
  },
  {
    branch: "final-check" as const,
    name: "Final Check",
    status: "pending" as const,
    estimatedTime: "30 mins"
  }
];

const recentActivities = [
  { id: 1, action: "Vehicle KA-01-AB-1234 service started", time: "2 hours ago", type: "service" },
  { id: 2, action: "Payment received from John Doe - ₹8,500", time: "3 hours ago", type: "payment" },
  { id: 3, action: "New employee added - Alex Kumar", time: "5 hours ago", type: "employee" },
  { id: 4, action: "Inventory alert - Brake pads low stock", time: "6 hours ago", type: "inventory" },
];

const pendingTasks = [
  { id: 1, task: "Review KA-01-AB-5678 estimate", priority: "high", dueTime: "1 hour" },
  { id: 2, task: "Order spare parts for electrical work", priority: "medium", dueTime: "Today" },
  { id: 3, task: "Schedule employee shift for tomorrow", priority: "low", dueTime: "Tomorrow" },
];

export default function Dashboard() {
  return (
    <div className="p-6 space-y-8 bg-background min-h-screen">
      {/* Welcome Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Welcome back!</h1>
        <p className="text-muted-foreground">
          Here's what's happening at AMMA AUTO GARAGE today.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Active Vehicles"
          value={24}
          subtitle="Currently in service"
          icon={Car}
          trend={{ value: 12, isPositive: true }}
          variant="primary"
        />
        <StatsCard
          title="Today's Revenue"
          value="₹45,250"
          subtitle="From 8 completed services"
          icon={DollarSign}
          trend={{ value: 8, isPositive: true }}
          variant="success"
        />
        <StatsCard
          title="Active Employees"
          value={18}
          subtitle="Currently on duty"
          icon={Users}
          variant="default"
        />
        <StatsCard
          title="Pending Tasks"
          value={12}
          subtitle="Require attention"
          icon={Clock}
          variant="warning"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Vehicle Status Tracking */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Live Service Tracking</h2>
            <Button variant="outline" size="sm">View All</Button>
          </div>
          
          <div className="space-y-4">
            <ServiceStatusTracker
              vehicleNumber="KA-01-AB-1234"
              customerName="Rajesh Kumar"
              steps={mockServiceSteps}
              overallStatus="in-progress"
            />
            
            <ServiceStatusTracker
              vehicleNumber="KA-02-CD-5678"
              customerName="Priya Sharma"
              steps={[
                { branch: "mechanical", name: "Mechanical Works", status: "completed", completedAt: "2024-01-15 09:00" },
                { branch: "tinker", name: "Tinker Works", status: "completed", completedAt: "2024-01-15 11:30" },
                { branch: "painting", name: "Painting Works", status: "completed", completedAt: "2024-01-15 16:00" },
                { branch: "electrical", name: "Electrical Works", status: "completed", completedAt: "2024-01-15 17:30" },
                { branch: "final-check", name: "Final Check", status: "completed", completedAt: "2024-01-15 18:00" }
              ]}
              overallStatus="ready"
            />
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Pending Tasks */}
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-primary" />
                <span>Pending Tasks</span>
              </CardTitle>
              <CardDescription>Tasks requiring your attention</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingTasks.map((task) => (
                <div key={task.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/50">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{task.task}</p>
                    <p className="text-xs text-muted-foreground">Due: {task.dueTime}</p>
                  </div>
                  <Badge 
                    variant={task.priority === "high" ? "destructive" : task.priority === "medium" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {task.priority}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span>Recent Activity</span>
              </CardTitle>
              <CardDescription>Latest updates from your garage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex-shrink-0 w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div className="space-y-1">
                    <p className="text-sm text-foreground">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start" variant="outline">
                <Car className="h-4 w-4 mr-2" />
                Add New Vehicle
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Users className="h-4 w-4 mr-2" />
                Manage Employees
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Package className="h-4 w-4 mr-2" />
                Check Inventory
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Wrench className="h-4 w-4 mr-2" />
                Schedule Service
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}