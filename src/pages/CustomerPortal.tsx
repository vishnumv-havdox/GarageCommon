import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Truck, ClipboardList, FileText } from "lucide-react";

export default function CustomerPortal() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      // First get customer record
      const { data: customerData } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!customerData) {
        setLoading(false);
        return;
      }

      // Then fetch related data
      const [vehiclesRes, invoicesRes] = await Promise.all([
        supabase
          .from("vehicles")
          .select("*")
          .eq("customer_id", customerData.id),
        supabase
          .from("invoices")
          .select("*")
          .eq("customer_id", customerData.id),
      ]);

      setVehicles(vehiclesRes.data || []);
      setInvoices(invoicesRes.data || []);

      // Fetch work orders for customer's vehicles
      if (vehiclesRes.data && vehiclesRes.data.length > 0) {
        const vehicleIds = vehiclesRes.data.map((v) => v.id);
        const { data: workOrdersData } = await supabase
          .from("work_orders")
          .select("*, vehicle:vehicles(*)")
          .in("vehicle_id", vehicleIds);
        
        setWorkOrders(workOrdersData || []);
      }
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Truck className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Customer Portal</h1>
              <p className="text-sm text-muted-foreground">
                Welcome, {user?.full_name || user?.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline">Customer</Badge>
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
              <CardTitle className="text-sm font-medium">My Vehicles</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vehicles.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Work Orders</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {workOrders.filter((wo) => wo.status !== "completed").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {invoices.filter((inv) => inv.status === "pending").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Tables */}
        <Tabs defaultValue="vehicles" className="w-full">
          <TabsList>
            <TabsTrigger value="vehicles">My Vehicles</TabsTrigger>
            <TabsTrigger value="workorders">Work Orders</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="vehicles">
            <Card>
              <CardHeader>
                <CardTitle>My Vehicles</CardTitle>
              </CardHeader>
              <CardContent>
                {vehicles.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No vehicles registered yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {vehicles.map((vehicle) => (
                      <div key={vehicle.id} className="border p-4 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{vehicle.vehicle_number}</h3>
                            <p className="text-sm text-muted-foreground">
                              {vehicle.vehicle_type} - {vehicle.model}
                            </p>
                            {vehicle.year && (
                              <p className="text-sm text-muted-foreground">Year: {vehicle.year}</p>
                            )}
                          </div>
                          <Badge variant={vehicle.status === "active" ? "default" : "secondary"}>
                            {vehicle.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workorders">
            <Card>
              <CardHeader>
                <CardTitle>My Work Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {workOrders.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No work orders yet
                  </p>
                ) : (
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
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>My Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No invoices yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {invoices.map((invoice) => (
                      <div key={invoice.id} className="border p-4 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{invoice.invoice_number}</h3>
                            <p className="text-sm font-semibold">Total: ₹{invoice.total}</p>
                            {invoice.due_date && (
                              <p className="text-sm text-muted-foreground">
                                Due: {new Date(invoice.due_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <Badge variant={
                            invoice.status === "paid" ? "default" :
                            invoice.status === "draft" ? "secondary" : "destructive"
                          }>
                            {invoice.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}