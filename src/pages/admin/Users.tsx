import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/adminClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Filter,
  Shield,
  Users,
  UserCog,
  Mail,
  Phone,
  Calendar,
  Building2,
  Truck,
  Edit,
  Trash2,
  Eye,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
  Briefcase,
  DollarSign,
  UserPlus
} from "lucide-react";
import { format } from "date-fns";
import { UserForm } from "@/components/forms/UserForm";

// Types
interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: 'admin';
  created_at: string;
}

interface EmployeeUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'staff';
  position_name?: string;
  department?: string;
  access_level?: string;
  status?: string;
  hire_date?: string;
  salary?: number;
  created_at: string;
}

interface CustomerUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: 'customer';
  company_name?: string;
  address?: string;
  vehicle_count: number;
  total_orders?: number;
  created_at: string;
}

type SortField = 'name' | 'email' | 'role' | 'created_at' | 'department';
type SortOrder = 'asc' | 'desc';

export default function AdminUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("admins");
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [employees, setEmployees] = useState<EmployeeUser[]>([]);
  const [customers, setCustomers] = useState<CustomerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<string>("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchAllUsers();
  }, []);

  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      // 1. Fetch user roles
      const { data: rolesData } = await (supabase.from("user_roles").select("user_id, role") as any);
      const adminUserIds = rolesData?.filter((r: any) => r.role === 'admin').map((r: any) => r.user_id) || [];
      const staffUserIds = rolesData?.filter((r: any) => r.role === 'staff').map((r: any) => r.user_id) || [];

      // 2. Fetch admins from profiles
      const { data: profilesData } = await supabase.from("profiles").select("*") as any;

      // 3. Fetch employees
      const { data: employeesData } = await (supabase
        .from("employees")
        .select("*, positions:position_id (name, department, access_level)") as any);

      // 4. Fetch customers
      const { data: customersData } = await (supabase.from("customers").select("*, vehicles(count)") as any);

      // Build admins list
      const adminList: AdminUser[] = (profilesData || [])
        .filter(p => adminUserIds.includes(p.id))
        .map(p => ({
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          phone: p.phone,
          role: 'admin' as const,
          created_at: p.created_at
        }));
      setAdmins(adminList);

      // Build employees list
      const employeeList: EmployeeUser[] = (employeesData || []).map(e => ({
        id: e.id,
        email: e.email,
        name: e.name,
        phone: e.phone,
        role: 'staff' as const,
        position_name: (e.positions as any)?.name || e.position_id,
        department: (e.positions as any)?.department || e.department,
        access_level: (e.positions as any)?.access_level || e.access_level,
        status: e.status,
        hire_date: e.hire_date,
        salary: e.salary,
        created_at: e.created_at
      }));
      setEmployees(employeeList);

      // Build customers list
      const customerList: CustomerUser[] = (customersData || []).map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        role: 'customer' as const,
        company_name: c.company_name,
        address: c.address,
        vehicle_count: (c.vehicles as any)?.[0]?.count || 0,
        created_at: c.created_at
      }));
      setCustomers(customerList);

    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort helpers
  const filterAndSort = <T extends { [key: string]: any }>(items: T[], nameField: keyof T, emailField: keyof T): T[] => {
    let result = [...items];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item =>
        String(item[nameField] || '').toLowerCase().includes(term) ||
        String(item[emailField] || '').toLowerCase().includes(term)
      );
    }
    result.sort((a, b) => {
      let comparison = 0;
      const aVal = String(a[nameField] || '').toLowerCase();
      const bVal = String(b[nameField] || '').toLowerCase();
      comparison = aVal.localeCompare(bVal);
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return result;
  };

  const getRoleBadgeVariant = (role: string) => role === 'admin' ? 'destructive' : role === 'staff' ? 'default' : 'secondary';
  const getRoleIcon = (role: string) => role === 'admin' ? <Shield className="h-4 w-4" /> : role === 'staff' ? <UserCog className="h-4 w-4" /> : <Users className="h-4 w-4" />;
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const userRole = selectedUser?.role ||
        (activeTab === 'admins' ? 'admin' : activeTab === 'employees' ? 'staff' : 'customer');

      // For employees and customers, we need to get the domain record by user_id
      if (userRole === 'staff') {
        // Get the employee record by user_id
        const { data: employeeData } = await (supabaseAdmin
          .from("employees")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle() as any);

        if (employeeData?.id) {
          await supabaseAdmin.from("employees").delete().eq("id", employeeData.id);
        }
      } else if (userRole === 'customer') {
        // Get the customer record by user_id
        const { data: customerData } = await (supabaseAdmin
          .from("customers")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle() as any);

        if (customerData?.id) {
          // First delete all vehicles belonging to this customer
          await supabaseAdmin.from("vehicles").delete().eq("customer_id", customerData.id);

          // Then delete the customer
          await supabaseAdmin.from("customers").delete().eq("id", customerData.id);
        }
      }

      // Delete from user_roles using admin client
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);

      // Delete from profiles using admin client
      await supabaseAdmin.from("profiles").delete().eq("id", userId);

      // Delete auth user using admin client
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (e: any) {
        // User might already be deleted, which is fine
        if (e.message !== 'User not found') {
          console.warn("auth user deletion skipped:", e);
        }
      }

      // Remove from local state based on which tab is active
      if (activeTab === 'admins') {
        setAdmins(prev => prev.filter(a => a.id !== userId));
      } else if (activeTab === 'employees') {
        setEmployees(prev => prev.filter(e => e.id !== userId));
      } else {
        setCustomers(prev => prev.filter(c => c.id !== userId));
      }
      toast({ title: "Success", description: "User and all associated data deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to delete user" });
    }
  };

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <Button variant="ghost" size="sm" className="gap-1 h-8" onClick={() => handleSort(field)}>
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </Button>
  );

  const canEdit = user?.role === 'admin';

  // Admin table columns
  const adminColumns = [
    { field: 'full_name' as SortField, label: 'Name' },
    { field: 'email' as SortField, label: 'Email' },
    { field: 'phone' as SortField, label: 'Phone' },
    { field: 'created_at' as SortField, label: 'Joined' },
  ];

  // Employee table columns
  const employeeColumns = [
    { field: 'name' as SortField, label: 'Name' },
    { field: 'email' as SortField, label: 'Email' },
    { field: 'department' as SortField, label: 'Department' },
    { field: 'position_name' as SortField, label: 'Position' },
    { field: 'status' as SortField, label: 'Status' },
  ];

  // Customer table columns
  const customerColumns = [
    { field: 'name' as SortField, label: 'Name' },
    { field: 'email' as SortField, label: 'Email' },
    { field: 'company_name' as SortField, label: 'Company' },
    { field: 'phone' as SortField, label: 'Phone' },
  ];

  const UserTable = ({
    data,
    columns,
    renderActions,
    nameField
  }: {
    data: any[],
    columns: { field: SortField; label: string }[],
    renderActions?: (item: any) => React.ReactNode,
    nameField: string
  }) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            {columns.map(col => (
              <th key={col.field} className="text-left p-3">
                <SortButton field={col.field} label={col.label} />
              </th>
            ))}
            <th className="text-left p-3">Role</th>
            {canEdit && <th className="w-20 p-3">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length + 2} className="text-center py-8 text-muted-foreground">
                Loading...
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 2} className="text-center py-8 text-muted-foreground">
                No users found
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr key={item.id} className="border-b hover:bg-muted/50">
                {columns.map(col => (
                  <td key={col.field} className="p-3">
                    {col.field === 'created_at'
                      ? format(new Date(item[col.field]), 'MMM d, yyyy')
                      : String(item[col.field] || '-')
                    }
                  </td>
                ))}
                <td className="p-3">
                  <Badge variant={getRoleBadgeVariant(item.role)} className="gap-1">
                    {getRoleIcon(item.role)}
                    {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
                  </Badge>
                </td>
                {canEdit && (
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedUser(item);
                          setEditingRole(item.role);
                          setIsDrawerOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedUser(item);
                          setEditingRole(item.role);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedUser(item);
                          setIsDeleteDialogOpen(true);
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col lg:flex-row">
        <AdminSidebar />
        <main className="flex-1 p-4 lg:p-8">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold">Users Management</h1>
              <p className="text-muted-foreground">Manage Admins, Employees, and Customers</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowForm(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Admin
              </Button>
              <Button onClick={fetchAllUsers} variant="outline" disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Search */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Add Admin Form */}
          {showForm && (
            <div className="mb-8">
              <UserForm
                onSuccess={() => {
                  setShowForm(false);
                  fetchAllUsers();
                }}
                onCancel={() => setShowForm(false)}
              />
            </div>
          )}

          {/* User Type Tabs */}
          <Card>
            <CardHeader className="pb-2">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex items-center justify-between">
                  <TabsList>
                    <TabsTrigger value="admins" className="gap-2">
                      <Shield className="h-4 w-4" />
                      Admins ({admins.length})
                    </TabsTrigger>
                    <TabsTrigger value="employees" className="gap-2">
                      <UserCog className="h-4 w-4" />
                      Employees ({employees.length})
                    </TabsTrigger>
                    <TabsTrigger value="customers" className="gap-2">
                      <Users className="h-4 w-4" />
                      Customers ({customers.length})
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="admins" className="mt-4">
                  <CardTitle className="text-lg mb-4">System Administrators</CardTitle>
                  <UserTable
                    data={filterAndSort(admins, 'full_name', 'email')}
                    columns={adminColumns}
                    nameField="full_name"
                  />
                </TabsContent>

                <TabsContent value="employees" className="mt-4">
                  <CardTitle className="text-lg mb-4">Staff Members</CardTitle>
                  <UserTable
                    data={filterAndSort(employees, 'name', 'email')}
                    columns={employeeColumns}
                    nameField="name"
                  />
                </TabsContent>

                <TabsContent value="customers" className="mt-4">
                  <CardTitle className="text-lg mb-4">Customers</CardTitle>
                  <UserTable
                    data={filterAndSort(customers, 'name', 'email')}
                    columns={customerColumns}
                    nameField="name"
                  />
                </TabsContent>
              </Tabs>
            </CardHeader>
          </Card>
        </main>
      </div>

      {/* User Detail Drawer */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>User Details</DrawerTitle>
          </DrawerHeader>
          {selectedUser && (
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback>{getInitials(selectedUser.full_name || selectedUser.name || '')}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">{selectedUser.full_name || selectedUser.name}</h3>
                  <Badge variant={getRoleBadgeVariant(selectedUser.role)} className="gap-1 mt-1">
                    {getRoleIcon(selectedUser.role)}
                    {selectedUser.role.charAt(0).toUpperCase() + selectedUser.role.slice(1)}
                  </Badge>
                </div>
              </div>

              {/* Admin Details */}
              {selectedUser.role === 'admin' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {selectedUser.email}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {selectedUser.phone || 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Joined</Label>
                    <p className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(selectedUser.created_at), 'MMMM d, yyyy')}
                    </p>
                  </div>
                </div>
              )}

              {/* Employee Details */}
              {selectedUser.role === 'staff' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {selectedUser.email}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Phone</Label>
                      <p className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {selectedUser.phone || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Department</Label>
                      <p className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        {selectedUser.department || 'Not assigned'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Position</Label>
                      <p>{selectedUser.position_name || 'Not assigned'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Access Level</Label>
                      <Badge variant={selectedUser.access_level === 'admin' ? 'destructive' : 'default'}>
                        {selectedUser.access_level}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <p>
                        <Badge variant={selectedUser.status === 'active' ? 'default' : 'secondary'}>
                          {selectedUser.status}
                        </Badge>
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Hire Date</Label>
                      <p>{selectedUser.hire_date ? format(new Date(selectedUser.hire_date), 'MMMM d, yyyy') : 'Not set'}</p>
                    </div>
                    {selectedUser.salary && (
                      <div>
                        <Label className="text-muted-foreground">Salary</Label>
                        <p className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          ₹{selectedUser.salary.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Customer Details */}
              {selectedUser.role === 'customer' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {selectedUser.email || 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {selectedUser.phone || 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Company</Label>
                    <p className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {selectedUser.company_name || 'Individual'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Vehicles</Label>
                    <p className="flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      {selectedUser.vehicle_count} vehicles
                    </p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Joined</Label>
                    <p className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(selectedUser.created_at), 'MMMM d, yyyy')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Edit Role Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Select new role for {selectedUser?.full_name || selectedUser?.name}</Label>
            <Select value={editingRole} onValueChange={setEditingRole}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Admin
                  </div>
                </SelectItem>
                <SelectItem value="staff">
                  <div className="flex items-center gap-2">
                    <UserCog className="h-4 w-4" />
                    Staff
                  </div>
                </SelectItem>
                <SelectItem value="customer">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Customer
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!selectedUser) return;
              try {
                const { error } = await (supabase.from("user_roles") as any)
                  .upsert({ user_id: selectedUser.id, role: editingRole }, { onConflict: 'user_id' });
                if (error) throw error;
                toast({ title: "Success", description: "User role updated" });
                setIsEditDialogOpen(false);
                fetchAllUsers();
              } catch (error: any) {
                toast({ variant: "destructive", title: "Error", description: error.message });
              }
            }}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete User
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete this user? This action cannot be undone.
            </p>
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{getInitials(selectedUser?.full_name || selectedUser?.name || '')}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedUser?.full_name || selectedUser?.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
                  </div>
                  <Badge variant={getRoleBadgeVariant(selectedUser?.role)} className="ml-auto">
                    {selectedUser?.role}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedUser?.id) {
                  handleDeleteUser(selectedUser.id);
                  setIsDeleteDialogOpen(false);
                }
              }}
            >
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

