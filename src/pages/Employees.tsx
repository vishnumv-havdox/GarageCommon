import { useState } from "react";
import { Users, Plus, Search, Filter, Edit, Trash2, Calendar, Clock, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StatsCard from "@/components/StatsCard";

// Mock data
const employees = [
  {
    id: 1,
    name: "John Smith",
    category: "Mechanics",
    phone: "+91 98765 43210",
    email: "john@ammaautiogarage.com",
    shift: "Morning (8AM - 4PM)",
    salary: 25000,
    status: "Active",
    joinDate: "2023-06-15",
    experience: "5 years",
    currentTask: "Engine repair - KA-01-AB-1234"
  },
  {
    id: 2,
    name: "Sarah Davis",
    category: "Painters",
    phone: "+91 87654 32109",
    email: "sarah@ammaautiogarage.com",
    shift: "Day (9AM - 6PM)",
    salary: 22000,
    status: "Active",
    joinDate: "2023-08-20",
    experience: "3 years",
    currentTask: "Full body paint - KA-02-CD-5678"
  },
  {
    id: 3,
    name: "Mike Johnson",
    category: "Tinker",
    phone: "+91 76543 21098",
    email: "mike@ammaautiogarage.com",
    shift: "Evening (2PM - 10PM)",
    salary: 20000,
    status: "Active",
    joinDate: "2023-03-10",
    experience: "7 years",
    currentTask: "Dent removal - KA-03-EF-9012"
  },
  {
    id: 4,
    name: "Alex Kumar",
    category: "Electricians",
    phone: "+91 65432 10987",
    email: "alex@ammaautiogarage.com",
    shift: "Morning (8AM - 4PM)",
    salary: 24000,
    status: "On Leave",
    joinDate: "2023-11-05",
    experience: "4 years",
    currentTask: "AC repair - KA-04-GH-3456"
  },
  {
    id: 5,
    name: "Ravi Sharma",
    category: "Helpers",
    phone: "+91 54321 09876",
    email: "ravi@ammaautiogarage.com",
    shift: "Day (9AM - 6PM)",
    salary: 15000,
    status: "Active",
    joinDate: "2024-01-02",
    experience: "1 year",
    currentTask: "Assisting with vehicle prep"
  }
];

const categoryColors = {
  "Mechanics": "bg-status-progress",
  "Painters": "bg-status-pending",
  "Tinker": "bg-status-completed",
  "Electricians": "bg-primary",
  "Helpers": "bg-garage-silver",
  "Admin": "bg-destructive"
};

const statusColors = {
  "Active": "bg-status-completed",
  "On Leave": "bg-status-pending",
  "Inactive": "bg-muted"
};

export default function Employees() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", "Mechanics", "Painters", "Tinker", "Electricians", "Helpers", "Admin"];
  
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || employee.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const activeEmployees = employees.filter(emp => emp.status === "Active").length;
  const totalSalary = employees.reduce((sum, emp) => sum + emp.salary, 0);

  return (
    <div className="p-6 space-y-8 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Employee Management</h1>
          <p className="text-muted-foreground">
            Manage your garage team and track their performance
          </p>
        </div>
        <Button className="bg-gradient-primary text-primary-foreground hover:shadow-glow">
          <Plus className="h-4 w-4 mr-2" />
          Add Employee
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Employees"
          value={employees.length}
          subtitle="All team members"
          icon={Users}
          variant="primary"
        />
        <StatsCard
          title="Active Today"
          value={activeEmployees}
          subtitle="Currently working"
          icon={Clock}
          variant="success"
        />
        <StatsCard
          title="Monthly Payroll"
          value={`₹${totalSalary.toLocaleString()}`}
          subtitle="Total salary cost"
          icon={DollarSign}
          variant="default"
        />
        <StatsCard
          title="On Leave"
          value={employees.filter(emp => emp.status === "On Leave").length}
          subtitle="Absent today"
          icon={Calendar}
          variant="warning"
        />
      </div>

      {/* Search and Filters */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search employees by name or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full lg:w-auto">
              <TabsList className="grid grid-cols-4 lg:grid-cols-7 w-full lg:w-auto">
                {categories.map((category) => (
                  <TabsTrigger key={category} value={category} className="text-xs">
                    {category}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Employee Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmployees.map((employee) => (
          <Card key={employee.id} className="bg-gradient-card border-border shadow-card hover:shadow-elegant transition-all duration-300">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {employee.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{employee.name}</CardTitle>
                    <CardDescription>{employee.email}</CardDescription>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <Button size="sm" variant="ghost">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Category and Status */}
              <div className="flex items-center justify-between">
                <Badge className={`${categoryColors[employee.category]} text-white`}>
                  {employee.category}
                </Badge>
                <Badge className={`${statusColors[employee.status]} text-white`}>
                  {employee.status}
                </Badge>
              </div>

              {/* Contact Info */}
              <div className="space-y-2">
                <div className="flex items-center text-sm text-muted-foreground">
                  <span className="font-medium w-20">Phone:</span>
                  <span>{employee.phone}</span>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <span className="font-medium w-20">Shift:</span>
                  <span>{employee.shift}</span>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <span className="font-medium w-20">Experience:</span>
                  <span>{employee.experience}</span>
                </div>
              </div>

              {/* Current Task */}
              {employee.currentTask && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium text-foreground">Current Task:</p>
                  <p className="text-sm text-muted-foreground">{employee.currentTask}</p>
                </div>
              )}

              {/* Salary Info */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Salary</p>
                  <p className="text-lg font-semibold text-foreground">₹{employee.salary.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Joined</p>
                  <p className="text-sm font-medium text-foreground">{employee.joinDate}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredEmployees.length === 0 && (
        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No employees found matching your search criteria</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}