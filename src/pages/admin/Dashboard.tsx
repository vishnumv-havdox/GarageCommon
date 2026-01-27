import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/adminClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { NavLink } from "react-router-dom";
import {
  Users,
  Truck,
  ClipboardList,
  Package,
  FileText,
  BarChart3,
  Shield,
  Plus,
  User,
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

interface SystemUser {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  created_at?: string;
  last_sign_in_at?: string;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [customersRes, vehiclesRes, workOrdersRes, inventoryRes, invoicesRes, usersRes] =
        await Promise.all([
          supabase.from("customers").select("*"),
          supabase.from("vehicles").select("*, customer:customers(*)"),
          supabase.from("work_orders").select("*, vehicle:vehicles(*, customer:customers(*))"),
          supabase.from("inventory").select("*"),
          supabase.from("invoices").select("*, customer:customers(*)"),
          fetchSystemUsers(),
        ]);

      setCustomers(customersRes.data || []);
      setVehicles(vehiclesRes.data || []);
      setWorkOrders(workOrdersRes.data || []);
      setInventory(inventoryRes.data || []);
      setInvoices(invoicesRes.data || []);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemUsers = async () => {
    try {
      const { data: authUsers, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) return [];

      const { data: rolesData } = await supabase.from("user_roles").select("user_id, role");

      const usersWithRoles = authUsers.users.map((authUser) => {
        const roleData = rolesData?.find((r) => r.user_id === authUser.id);
        return {
          id: authUser.id,
          email: authUser.email || "",
          full_name: authUser.user_metadata?.full_name || "",
          role: roleData?.role || "customer",
          created_at: authUser.created_at,
          last_sign_in_at: authUser.last_sign_in_at,
        };
      });

      setSystemUsers(usersWithRoles);
      return usersWithRoles;
    } catch (error) {
      console.error("Error fetching users:", error);
      return [];
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col lg:flex-row">
        {/* Shared Sidebar */}
        <AdminSidebar />

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground">Overview of work orders and shop performance</p>
            </div>
            <div className="flex items-center gap-2 w-full lg:w-auto"></div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{systemUsers.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Customers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{customers.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Vehicles</CardTitle>
                <Truck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{vehicles.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Work Orders</CardTitle>
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{workOrders.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Inventory</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{inventory.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Invoices</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{invoices.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4 flex-wrap">
              <Button asChild>
                <NavLink to="/admin/employees">
                  <User className="h-4 w-4 mr-2" />
                  Add Employee
                </NavLink>
              </Button>
              <Button asChild>
                <NavLink to="/admin/customers">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Customer
                </NavLink>
              </Button>
              <Button asChild>
                <NavLink to="/admin/vehicles">
                  <Plus className="h-4 w-4 mr-2" />
                  Register Vehicle
                </NavLink>
              </Button>
              <Button asChild>
                <NavLink to="/admin/work-orders">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Work Order
                </NavLink>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

