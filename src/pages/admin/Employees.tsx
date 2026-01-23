import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/integrations/supabase/adminClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { NavLink } from "react-router-dom";
import {
  LogOut,
  Users,
  Shield,
  Plus,
  Search,
  Briefcase,
  Edit,
  Trash2,
  User,
} from "lucide-react";
import { EmployeeForm } from "@/components/forms/EmployeeForm";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Position {
  id: string;
  name: string;
  department: string;
  access_level: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  position_id: string;
  access_level: "admin" | "manager" | "staff";
  salary?: number;
  status?: string;
  position?: Position;
  created_at?: string;
}

export default function AdminEmployees() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch employees with position info
      const { data: employeesData, error: empError } = await supabase
        .from("employees")
        .select(`
          *,
          position:positions(*)
        `)
        .order("name");

      if (empError) throw empError;

      // Fetch positions
      const { data: positionsData, error: posError } = await supabase
        .from("positions")
        .select("*")
        .order("department");

      if (posError) throw posError;

      setEmployees(employeesData || []);
      setPositions(positionsData || []);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingEmployee(null);
    fetchData();
    toast({
      title: "Success",
      description: editingEmployee
        ? "Employee updated successfully"
        : "Employee added successfully",
    });
  };

  const handlePositionAdd = (newPosition: Position) => {
    setPositions((prev) => [...prev, newPosition]);
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setShowForm(true);
  };

  const handleDelete = (employee: Employee) => {
    setDeletingEmployee(employee);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingEmployee) return;
    
    const employeeId = deletingEmployee.id;

    try {
      // Get the user_id for this employee
      const { data: employeeData } = await (supabaseAdmin
        .from("employees")
        .select("user_id")
        .eq("id", employeeId)
        .single() as any);

      if (!employeeData) {
        throw new Error("Employee not found");
      }

      const userId = employeeData.user_id;

      // Delete from employees table first using admin client
      const { error: empError } = await supabaseAdmin
        .from("employees")
        .delete()
        .eq("id", employeeId);

      if (empError) throw empError;

      // Delete from user_roles using admin client (if user_id exists)
      if (userId) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        await supabaseAdmin.from("profiles").delete().eq("id", userId);
        
        // Delete auth user using admin client
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId);
        } catch (e: any) {
          if (e.message !== 'User not found') {
            console.warn("auth user deletion skipped:", e);
          }
        }
      }

      toast({
        title: "Success",
        description: "Employee and associated user account deleted successfully",
      });
      fetchData();
    } catch (error: any) {
      console.error("Error deleting employee:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete employee",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingEmployee(null);
    }
  };

  const getAccessBadgeVariant = (
    access: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (access) {
      case "admin":
        return "destructive";
      case "manager":
        return "default";
      default:
        return "secondary";
    }
  };

  const getAccessLabel = (access: string): string => {
    switch (access) {
      case "admin":
        return "Admin";
      case "manager":
        return "Manager";
      default:
        return "Staff";
    }
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.position?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeEmployees = employees.filter((e) => e.status === "active").length;
  const totalPositions = positions.length;

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen bg-card border-r flex flex-col">
          <div className="p-4 border-b">
            <NavLink to="/admin" className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="font-bold">AMMA AUTO</h1>
                <p className="text-xs text-muted-foreground">Admin Panel</p>
              </div>
            </NavLink>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            <NavLink
              to="/admin"
              end
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`
              }
            >
              <Users className="h-5 w-5" />
              Dashboard
            </NavLink>
            <NavLink
              to="/admin/employees"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`
              }
            >
              <User className="h-5 w-5" />
              Employees
            </NavLink>
            <NavLink
              to="/admin/customers"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`
              }
            >
              <Users className="h-5 w-5" />
              Customers
            </NavLink>
            <NavLink
              to="/admin/vehicles"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`
              }
            >
              <Users className="h-5 w-5" />
              Vehicles
            </NavLink>
            <NavLink
              to="/admin/work-orders"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`
              }
            >
              <Users className="h-5 w-5" />
              Work Orders
            </NavLink>
            <NavLink
              to="/admin/inventory"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`
              }
            >
              <Users className="h-5 w-5" />
              Inventory
            </NavLink>
            <NavLink
              to="/admin/invoices"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`
              }
            >
              <Users className="h-5 w-5" />
              Invoices
            </NavLink>
          </nav>

          <div className="p-4 border-t">
            <div className="flex items-center gap-3 mb-3">
              <Badge variant="default">Admin</Badge>
              <span className="text-sm truncate">{user?.full_name || user?.email}</span>
            </div>
            <Button onClick={signOut} variant="outline" className="w-full" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Employee Management</h1>
              <p className="text-muted-foreground">
                Manage internal staff and their access levels
              </p>
            </div>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{employees.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
                <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeEmployees}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Positions</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalPositions}</div>
              </CardContent>
            </Card>
          </div>

          {/* Employee Form Modal */}
          {showForm && (
            <div className="mb-8">
              <EmployeeForm
                onSuccess={handleFormSuccess}
                onCancel={() => {
                  setShowForm(false);
                  setEditingEmployee(null);
                }}
                editingEmployee={editingEmployee}
                positions={positions}
                onPositionAdd={handlePositionAdd}
              />
            </div>
          )}

          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Positions Overview */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Available Positions ({positions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {positions.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No positions defined. Add an employee to create a position.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {positions.map((pos) => (
                    <Badge
                      key={pos.id}
                      variant="outline"
                      className="px-3 py-1"
                    >
                      {pos.name} - {pos.department}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Employees List */}
          <Card>
            <CardHeader>
              <CardTitle>Employees ({filteredEmployees.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading employees...
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No employees found
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredEmployees.map((employee) => (
                    <div key={employee.id} className="border p-4 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{employee.name}</h3>
                            <Badge
                              variant={getAccessBadgeVariant(employee.access_level)}
                            >
                              {getAccessLabel(employee.access_level)}
                            </Badge>
                            {employee.status !== "active" && (
                              <Badge variant="outline">{employee.status}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {employee.email}
                          </p>
                          {employee.phone && (
                            <p className="text-sm text-muted-foreground">
                              Phone: {employee.phone}
                            </p>
                          )}
                          <div className="flex gap-4 mt-2">
                            <span className="text-sm">
                              <span className="font-medium">Position:</span>{" "}
                              {employee.position?.name || "Not Assigned"}
                            </span>
                            <span className="text-sm">
                              <span className="font-medium">Department:</span>{" "}
                              {employee.position?.department || "N/A"}
                            </span>
                            {employee.salary && (
                              <span className="text-sm">
                                <span className="font-medium">Salary:</span> ₹
                                {employee.salary.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(employee)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(employee)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Employee
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete this employee? This action cannot be undone and will also delete the associated user account.
            </p>
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{deletingEmployee?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'EM'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{deletingEmployee?.name}</p>
                    <p className="text-sm text-muted-foreground">{deletingEmployee?.email}</p>
                  </div>
                  <Badge variant={getAccessBadgeVariant(deletingEmployee?.access_level || 'staff')} className="ml-auto">
                    {getAccessLabel(deletingEmployee?.access_level || 'staff')}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsDeleteDialogOpen(false);
              setDeletingEmployee(null);
            }}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

