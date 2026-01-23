import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/adminClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Trash2, Edit, Mail, Phone, Building2, MapPin, Calendar, Car, ChevronDown, ChevronUp } from "lucide-react";
import { CustomerForm } from "@/components/forms/CustomerForm";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { format } from "date-fns";

interface Customer {
  id: string;
  user_id?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  company_name?: string;
  created_at: string;
}

interface Vehicle {
  id: string;
  customer_id: string;
  vehicle_number: string;
  vehicle_type: string;
  model: string | null;
  year: number | null;
  status: string;
  notes: string | null;
  entry_date: string | null;
  created_at: string;
}

export default function AdminCustomers() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, Vehicle[]>>({});
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);

  const toggleExpand = (customerId: string) => {
    setExpandedCustomers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data: customersData, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCustomers(customersData || []);

      // Fetch vehicles for all customers
      if (customersData && customersData.length > 0) {
        const customerIds = customersData.map((c: Customer) => c.id);
        const { data: vehiclesData, error: vehiclesError } = await supabase
          .from("vehicles")
          .select("*")
          .in("customer_id", customerIds)
          .order("created_at", { ascending: false });

        if (vehiclesError) throw vehiclesError;

        // Group vehicles by customer_id
        const vehiclesByCustomer: Record<string, Vehicle[]> = {};
        (vehiclesData || []).forEach((vehicle: Vehicle) => {
          if (!vehiclesByCustomer[vehicle.customer_id]) {
            vehiclesByCustomer[vehicle.customer_id] = [];
          }
          vehiclesByCustomer[vehicle.customer_id].push(vehicle);
        });
        setVehicles(vehiclesByCustomer);
      }
    } catch (error: any) {
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
    fetchCustomers();
    toast({
      title: "Success",
      description: "Customer saved successfully",
    });
  };

  const handleDelete = (customer: Customer) => {
    setDeletingCustomer(customer);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCustomer) return;
    
    const customerId = deletingCustomer.id;

    try {
      // Get the user_id for this customer
      const { data: customerData } = await (supabaseAdmin
        .from("customers")
        .select("user_id")
        .eq("id", customerId)
        .single() as any);

      if (!customerData) {
        throw new Error("Customer not found");
      }

      const userId = customerData.user_id;

      // First delete all vehicles belonging to this customer
      await supabaseAdmin.from("vehicles").delete().eq("customer_id", customerId);

      // Delete from customers table using admin client
      const { error: custError } = await supabaseAdmin
        .from("customers")
        .delete()
        .eq("id", customerId);

      if (custError) throw custError;

      // Delete from user_roles using admin client (if user_id exists)
      if (userId) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
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
      }

      toast({
        title: "Success",
        description: "Customer, vehicles, and associated user account deleted successfully",
      });
      fetchCustomers();
    } catch (error: any) {
      console.error("Error deleting customer:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete customer",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingCustomer(null);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.includes(searchTerm) ||
      c.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Customer Management</h1>
              <p className="text-muted-foreground">Manage customer records and accounts</p>
            </div>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </div>

          {showForm && (
            <div className="mb-8">
              <CustomerForm onSuccess={handleFormSuccess} onCancel={() => setShowForm(false)} />
            </div>
          )}

          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Customers ({filteredCustomers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No customers found</div>
              ) : (
                <div className="space-y-4">
                  {filteredCustomers.map((customer) => {
                    const customerVehicles = vehicles[customer.id] || [];
                    const isExpanded = expandedCustomers.has(customer.id);
                    return (
                    <div key={customer.id} className="border p-4 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">{customer.name}</h3>
                            <Badge variant="secondary">Customer</Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            {customer.email && (
                              <p className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="h-4 w-4" />
                                {customer.email}
                              </p>
                            )}
                            {customer.phone && (
                              <p className="flex items-center gap-2 text-muted-foreground">
                                <Phone className="h-4 w-4" />
                                {customer.phone}
                              </p>
                            )}
                            {customer.company_name && (
                              <p className="flex items-center gap-2 text-muted-foreground">
                                <Building2 className="h-4 w-4" />
                                {customer.company_name}
                              </p>
                            )}
                            <p className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              Joined: {format(new Date(customer.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                          {customer.address && (
                            <p className="flex items-start gap-2 text-sm text-muted-foreground mt-2">
                              <MapPin className="h-4 w-4 mt-0.5" />
                              {customer.address}
                            </p>
                          )}
                          
                          {/* Vehicles Section */}
                          {customerVehicles.length > 0 && (
                            <div className="mt-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex items-center gap-2 px-2 h-auto py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                                onClick={() => toggleExpand(customer.id)}
                              >
                                <Car className="h-4 w-4" />
                                <span>{customerVehicles.length} Vehicle{customerVehicles.length > 1 ? 's' : ''}</span>
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                              
                              {isExpanded && (
                                <div className="mt-3 space-y-2 pl-6 border-l-2 border-muted">
                                  {customerVehicles.map((vehicle) => (
                                    <div key={vehicle.id} className="bg-muted/50 p-3 rounded-md">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <Car className="h-4 w-4 text-muted-foreground" />
                                          <div>
                                            <p className="font-medium">{vehicle.vehicle_number}</p>
                                            <p className="text-xs text-muted-foreground">
                                              {vehicle.vehicle_type}
                                              {vehicle.model && ` • ${vehicle.model}`}
                                              {vehicle.year && ` • ${vehicle.year}`}
                                            </p>
                                          </div>
                                        </div>
                                        <Badge 
                                          variant={vehicle.status === 'Completed' ? 'default' : vehicle.status === 'In Progress' ? 'secondary' : 'outline'}
                                        >
                                          {vehicle.status}
                                        </Badge>
                                      </div>
                                      {vehicle.notes && (
                                        <p className="text-xs text-muted-foreground mt-2">
                                          {vehicle.notes}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {customerVehicles.length === 0 && (
                            <div className="mt-4 text-xs text-muted-foreground flex items-center gap-2">
                              <Car className="h-4 w-4" />
                              No vehicles registered
                            </div>
                          )}
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(customer)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  )})}
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
              Delete Customer
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete this customer? This action cannot be undone and will also delete all vehicles and the associated user account.
            </p>
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{deletingCustomer?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'CU'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{deletingCustomer?.name}</p>
                    <p className="text-sm text-muted-foreground">{deletingCustomer?.email || deletingCustomer?.phone}</p>
                  </div>
                  <Badge variant="secondary" className="ml-auto">Customer</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsDeleteDialogOpen(false);
              setDeletingCustomer(null);
            }}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

