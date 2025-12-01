import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Truck, ClipboardList, Package, Plus } from "lucide-react";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { WorkOrderForm } from "@/components/workorders/WorkOrderForm";

export default function StaffDashboard() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [activeForm, setActiveForm] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vehiclesRes, workOrdersRes, inventoryRes] = await Promise.all([
        supabase.from("vehicles").select("*, customer:customers(*)"),
        supabase.from("work_orders").select("*, vehicle:vehicles(*, customer:customers(*))"),
        supabase.from("inventory").select("*"),
      ]);

      setVehicles(vehiclesRes.data || []);
      setWorkOrders(workOrdersRes.data || []);
      setInventory(inventoryRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch data",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = () => {
    setActiveForm(null);
    fetchData();
    toast({
      title: "Success",
      description: "Data saved successfully",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Truck className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Staff Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Welcome, {user?.full_name || user?.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">Staff</Badge>
            <Button onClick={signOut} variant="outline">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Vehicles</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vehicles.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Work Orders</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workOrders.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Inventory Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inventory.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4 flex-wrap">
            <Button onClick={() => setActiveForm("vehicle")}>
              <Plus className="h-4 w-4 mr-2" />
              Register Vehicle
            </Button>
            <Button onClick={() => setActiveForm("workorder")}>
              <Plus className="h-4 w-4 mr-2" />
              Create Work Order
            </Button>
          </CardContent>
        </Card>

        {/* Forms */}
        {activeForm === "vehicle" && (
          <VehicleForm
            onSuccess={handleFormSuccess}
            onCancel={() => setActiveForm(null)}
          />
        )}
        {activeForm === "workorder" && (
          <WorkOrderForm
            onSuccess={handleFormSuccess}
            onCancel={() => setActiveForm(null)}
          />
        )}

        {/* Data Tables */}
        <Tabs defaultValue="vehicles" className="w-full">
          <TabsList>
            <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
            <TabsTrigger value="workorders">Work Orders</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
          </TabsList>

          <TabsContent value="vehicles">
            <Card>
              <CardHeader>
                <CardTitle>All Vehicles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {vehicles.map((vehicle) => (
                    <div key={vehicle.id} className="border p-4 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{vehicle.vehicle_number}</h3>
                          <p className="text-sm text-muted-foreground">
                            {vehicle.vehicle_type} - {vehicle.model}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Customer: {vehicle.customer?.name}
                          </p>
                        </div>
                        <Badge variant={vehicle.status === "active" ? "default" : "secondary"}>
                          {vehicle.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workorders">
            <Card>
              <CardHeader>
                <CardTitle>All Work Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {workOrders.map((order) => (
                    <div key={order.id} className="border p-4 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{order.work_type}</h3>
                          <p className="text-sm text-muted-foreground">{order.description}</p>
                          <p className="text-sm text-muted-foreground">
                            Vehicle: {order.vehicle?.vehicle_number}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={
                            order.status === "completed" ? "default" :
                            order.status === "in_progress" ? "secondary" : "outline"
                          }>
                            {order.status}
                          </Badge>
                          <Badge variant={
                            order.priority === "high" ? "destructive" :
                            order.priority === "medium" ? "default" : "secondary"
                          }>
                            {order.priority}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory">
            <Card>
              <CardHeader>
                <CardTitle>Inventory</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {inventory.map((item) => (
                    <div key={item.id} className="border p-4 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{item.item_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Category: {item.category}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Quantity: {item.quantity} | Price: ₹{item.unit_price}
                          </p>
                        </div>
                        {item.quantity <= item.reorder_level && (
                          <Badge variant="destructive">Low Stock</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}