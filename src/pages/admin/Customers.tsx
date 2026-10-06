import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Plus, Search, Trash2, Edit, Mail, Phone, Building2, MapPin, Calendar, Car, ChevronDown, ChevronUp, Receipt, Users, History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CustomerForm } from "@/components/forms/CustomerForm";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { format } from "date-fns";
import { SearchInput } from "@/components/shared/SearchInput";
import { validateIndianPhoneNumber } from "@/lib/phoneValidation";
import { DriverHistoryDialog } from "@/components/drivers/DriverHistoryDialog";

interface Customer {
  id: string;
  user_id?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  company_name?: string;
  gst_number?: string;
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

interface Invoice {
  id: string;
  customer_id: string;
  bill_number?: number;
  invoice_number?: string;
  status: string;
  total: number;
  total_deductions: number;
  created_at: string;
}

interface DriverPosition {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

interface Driver {
  id: string;
  company_id: string;
  name: string;
  contact_number?: string;
  driver_position?: string;
  is_active: boolean;
  created_at: string;
}

interface WorkOrder {
  id: string;
  vehicle_id: string;
  customer_id: string;
  service_type: string;
  status: string;
  created_at: string;
  priority: string;
  driver_id?: string;
  vehicle?: { vehicle_number: string; model: string; customer_id: string };
  driver?: { name: string; contact_number: string };
}

export default function AdminCustomers() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, Vehicle[]>>({});
  const [invoices, setInvoices] = useState<Record<string, Invoice[]>>({});
  const [activeWorkOrders, setActiveWorkOrders] = useState<Record<string, WorkOrder[]>>({});
  const [drivers, setDrivers] = useState<Record<string, Driver[]>>({});
  const [driverPositions, setDriverPositions] = useState<DriverPosition[]>([]);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Driver management state
  const [showDriverDialog, setShowDriverDialog] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [selectedCustomerForDriver, setSelectedCustomerForDriver] = useState<string | null>(null);
  const [driverFormData, setDriverFormData] = useState({
    name: "",
    contact_number: "",
    driver_position: "Driver"
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("customers");
  const [driverSearchTerm, setDriverSearchTerm] = useState("");

  // Position management state
  const [showPositionDialog, setShowPositionDialog] = useState(false);
  const [editingPosition, setEditingPosition] = useState<DriverPosition | null>(null);
  const [positionFormData, setPositionFormData] = useState({ name: "", description: "" });
  const [viewingDriverHistory, setViewingDriverHistory] = useState<{ id: string, name: string } | null>(null);

  // Delete confirmation dialogs
  const [showDeleteDriverDialog, setShowDeleteDriverDialog] = useState(false);
  const [deletingDriverId, setDeletingDriverId] = useState<string | null>(null);
  const [showDeletePositionDialog, setShowDeletePositionDialog] = useState(false);
  const [deletingPositionId, setDeletingPositionId] = useState<string | null>(null);

  // Handle URL-based edit requests
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && customers.length > 0 && !editingCustomer) {
      const customerToEdit = customers.find(c => c.id === editId);
      if (customerToEdit) {
        setEditingCustomer(customerToEdit);
        // Optional: clear the param so refreshing doesn't re-open, 
        // OR keep it if we want persistent link. 
        // Let's keep it for now as it makes the link shareable.
      }
    }
  }, [customers, searchParams]);

  const driverJobs = useMemo(() => {
    const map: Record<string, WorkOrder> = {};
    Object.values(activeWorkOrders).flat().forEach(wo => {
      if (wo.driver_id) {
        map[wo.driver_id] = wo;
      }
    });
    return map;
  }, [activeWorkOrders]);

  const vehicleJobs = useMemo(() => {
    const map: Record<string, WorkOrder> = {};
    Object.values(activeWorkOrders).flat().forEach(wo => {
      const current = map[wo.vehicle_id];

      // Status priority: In Progress > Under QC/Inspection > Pending/Awaiting > Ready > Completed
      const getPriority = (status: string) => {
        const lowerStatus = status.toLowerCase();
        if (lowerStatus.includes('progress') || lowerStatus === 'repair') return 5;
        if (lowerStatus.includes('qc') || lowerStatus.includes('inspection') || lowerStatus === 'review') return 4;
        if (lowerStatus.includes('pending') || lowerStatus.includes('approval') || lowerStatus === 'awaiting') return 3;
        if (lowerStatus.includes('ready')) return 2;
        if (lowerStatus.includes('completed')) return 1;
        return 0;
      };

      if (!current || getPriority(wo.status) > getPriority(current.status)) {
        map[wo.vehicle_id] = wo;
      }
    });
    return map;
  }, [activeWorkOrders]);

  const getJobStatusHighlight = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('pending') || s.includes('approval') || s === 'awaiting')
      return "bg-amber-100 border-amber-500 text-amber-900 font-bold";
    if (s.includes('progress') || s === 'accepted' || s === 'repair')
      return "bg-blue-100 border-blue-500 text-blue-900 font-bold";
    if (s.includes('qc') || s.includes('quality') || s.includes('inspection') || s === 'review')
      return "bg-purple-100 border-purple-500 text-purple-900 font-bold";
    if (s.includes('ready') || s.includes('completed'))
      return "bg-green-100 border-green-500 text-green-900 font-bold";
    return "bg-gray-100 border-gray-400 text-gray-900";
  };

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
    fetchPositions();
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

      // Fetch vehicles AND invoices for all customers
      if (customersData && customersData.length > 0) {
        const customerIds = customersData.map((c: Customer) => c.id);

        // Vehicles
        const { data: vehiclesData, error: vehiclesError } = await supabase
          .from("vehicles")
          .select("*")
          .in("customer_id", customerIds)
          .order("created_at", { ascending: false });

        if (vehiclesError) throw vehiclesError;

        const vehiclesByCustomer: Record<string, Vehicle[]> = {};
        (vehiclesData || []).forEach((vehicle: Vehicle) => {
          if (!vehiclesByCustomer[vehicle.customer_id]) {
            vehiclesByCustomer[vehicle.customer_id] = [];
          }
          vehiclesByCustomer[vehicle.customer_id].push(vehicle);
        });
        setVehicles(vehiclesByCustomer);

        // Invoices
        const { data: invoicesData, error: invoicesError } = await supabase
          .from("invoices")
          .select("*")
          .in("customer_id", customerIds)
          .order("created_at", { ascending: false });

        if (invoicesError) throw invoicesError;

        const invoicesByCustomer: Record<string, Invoice[]> = {};
        (invoicesData || []).forEach((inv: Invoice) => {
          if (!invoicesByCustomer[inv.customer_id]) {
            invoicesByCustomer[inv.customer_id] = [];
          }
          invoicesByCustomer[inv.customer_id].push(inv);
        });
        setInvoices(invoicesByCustomer);

        // Drivers
        const { data: driversData, error: driversError } = await supabase
          .from("drivers")
          .select("*")
          .in("company_id", customerIds)
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (driversError) throw driversError;

        const driversByCustomer: Record<string, Driver[]> = {};
        (driversData || []).forEach((driver: Driver) => {
          if (!driversByCustomer[driver.company_id]) {
            driversByCustomer[driver.company_id] = [];
          }
          driversByCustomer[driver.company_id].push(driver);
        });
        setDrivers(driversByCustomer);

        // [NEW] Active Work Orders
        const { data: woData, error: woError } = await supabase
          .from("work_orders")
          .select(`
                id, 
                vehicle_id,
                service_type, 
                status, 
                created_at, 
                priority,
                driver_id,
                vehicle:vehicles!inner(customer_id, vehicle_number, model),
                driver:drivers(name, contact_number)
            `)
          // Use vehicle.customer_id for filtering
          .in("vehicle.customer_id", customerIds)
          .in("status", ["Pending", "In Progress", "Accepted", "Under QC", "Inspection", "Repair", "Review", "Quality Check", "Pending Approval", "Ready", "Ready for Release"])
          .order("created_at", { ascending: false });

        if (woError) throw woError;

        const woByCustomer: Record<string, WorkOrder[]> = {};
        (woData || []).forEach((wo: any) => {
          // Access customer_id from vehicle relation
          const customerId = wo.vehicle?.customer_id;
          if (customerId) {
            if (!woByCustomer[customerId]) {
              woByCustomer[customerId] = [];
            }
            woByCustomer[customerId].push(wo);
          }
        });
        setActiveWorkOrders(woByCustomer);
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

  // Driver Management Functions
  const handleAddDriver = (customerId: string) => {
    setSelectedCustomerForDriver(customerId);
    setEditingDriver(null);
    setDriverFormData({
      name: "",
      contact_number: "",
      driver_position: "Driver"
    });
    setShowDriverDialog(true);
  };

  const handleEditDriver = (driver: Driver) => {
    setEditingDriver(driver);
    setSelectedCustomerForDriver(driver.company_id);
    setDriverFormData({
      name: driver.name,
      contact_number: driver.contact_number || "",
      driver_position: driver.driver_position || "Driver"
    });
    setShowDriverDialog(true);
  };

  const handleSaveDriver = async () => {
    if (!selectedCustomerForDriver) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please select a company/customer for this driver"
      });
      return;
    }

    if (!driverFormData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Driver name is required"
      });
      return;
    }

    // Validate phone number if provided
    if (driverFormData.contact_number.trim()) {
      const phoneValidation = validateIndianPhoneNumber(driverFormData.contact_number);
      if (!phoneValidation.isValid) {
        toast({
          variant: "destructive",
          title: "Invalid Phone Number",
          description: phoneValidation.error
        });
        return;
      }
    }

    try {
      if (editingDriver) {
        // Update existing driver
        const { error } = await supabase
          .from("drivers")
          // @ts-ignore
          .update({
            name: driverFormData.name.trim(),
            contact_number: driverFormData.contact_number.trim() || null,
            driver_position: driverFormData.driver_position
          })
          .eq("id", editingDriver.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Driver updated successfully"
        });
      } else {
        // Create new driver
        const { error } = await supabase
          .from("drivers")
          // @ts-ignore
          .insert([{
            company_id: selectedCustomerForDriver,
            name: driverFormData.name.trim(),
            contact_number: driverFormData.contact_number.trim() || null,
            driver_position: driverFormData.driver_position,
            is_active: true
          }]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Driver added successfully"
        });
      }

      setShowDriverDialog(false);
      fetchCustomers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    }
  };

  const handleDeleteDriver = (driverId: string) => {
    setDeletingDriverId(driverId);
    setShowDeleteDriverDialog(true);
  };

  const confirmDeleteDriver = async () => {
    if (!deletingDriverId) return;

    try {
      const { error } = await supabase
        .from("drivers")
        // @ts-ignore
        .update({ is_active: false })
        .eq("id", deletingDriverId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Driver deactivated successfully"
      });
      fetchCustomers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    } finally {
      setShowDeleteDriverDialog(false);
      setDeletingDriverId(null);
    }
  };

  // Position Management Functions
  const fetchPositions = async () => {
    try {
      const { data, error } = await supabase
        .from("driver_positions")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setDriverPositions(data || []);
    } catch (error: any) {
      console.error("Error fetching positions:", error);
    }
  };

  const handleAddPosition = () => {
    setEditingPosition(null);
    setPositionFormData({ name: "", description: "" });
    setShowPositionDialog(true);
  };

  const handleEditPosition = (position: DriverPosition) => {
    setEditingPosition(position);
    setPositionFormData({ name: position.name, description: position.description || "" });
    setShowPositionDialog(true);
  };

  const handleSavePosition = async () => {
    if (!positionFormData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Position name is required"
      });
      return;
    }

    try {
      if (editingPosition) {
        const { error } = await supabase
          .from("driver_positions")
          // @ts-ignore
          .update({
            name: positionFormData.name.trim(),
            description: positionFormData.description.trim() || null
          })
          .eq("id", editingPosition.id);

        if (error) throw error;
        toast({ title: "Success", description: "Position updated successfully" });
      } else {
        const { error } = await supabase
          .from("driver_positions")
          // @ts-ignore
          .insert([{
            name: positionFormData.name.trim(),
            description: positionFormData.description.trim() || null,
            is_active: true
          }]);

        if (error) throw error;
        toast({ title: "Success", description: "Position added successfully" });
      }

      setShowPositionDialog(false);
      fetchPositions();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    }
  };

  const handleDeletePosition = (positionId: string) => {
    setDeletingPositionId(positionId);
    setShowDeletePositionDialog(true);
  };

  const confirmDeletePosition = async () => {
    if (!deletingPositionId) return;

    try {
      const { error } = await supabase
        .from("driver_positions")
        // @ts-ignore
        .update({ is_active: false })
        .eq("id", deletingPositionId);

      if (error) throw error;
      toast({ title: "Success", description: "Position deleted successfully" });
      fetchPositions();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    } finally {
      setShowDeletePositionDialog(false);
      setDeletingPositionId(null);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.includes(searchTerm) ||
      c.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const suggestions = useMemo(() => {
    const sets = [
      new Set(customers.map(c => c.name)),
      new Set(customers.map(c => c.company_name)),
      new Set(customers.map(c => c.phone)),
      new Set(customers.map(c => c.email)),
    ];
    return Array.from(new Set(sets.flatMap(s => Array.from(s)))).filter(Boolean);
  }, [customers]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col lg:flex-row">
        <AdminSidebar />
        <main className="flex-1 p-4 lg:p-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold">Customer & Driver Management</h1>
              <p className="text-muted-foreground">Manage customer records, accounts, and drivers</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
              <TabsTrigger value="customers" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Customers
              </TabsTrigger>
              <TabsTrigger value="drivers" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Drivers
              </TabsTrigger>
            </TabsList>

            <TabsContent value="customers" className="mt-0">
              <div className="flex justify-end mb-4">
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Customer
                </Button>
              </div>

              {(showForm || editingCustomer) && (
                <div className="mb-8">
                  <CustomerForm
                    onSuccess={() => {
                      handleFormSuccess();
                      setEditingCustomer(null);
                    }}
                    onCancel={() => {
                      setShowForm(false);
                      setEditingCustomer(null);
                    }}
                    initialData={editingCustomer}
                  />
                </div>
              )}

              <div className="mb-6">
                <div className="relative max-w-md">
                  <SearchInput
                    placeholder="Search customers by name, company, phone, etc..."
                    value={searchTerm}
                    onChange={setSearchTerm}
                    suggestions={suggestions}
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
                        const customerWorkOrders = activeWorkOrders[customer.id] || [];
                        const isExpanded = expandedCustomers.has(customer.id);
                        return (
                          <div key={customer.id} className="border p-4 rounded-lg">
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <h3 className="font-semibold text-lg">{customer.name}</h3>
                                  <Badge variant="secondary">Customer</Badge>
                                  {customerWorkOrders.length > 0 && (
                                    <Badge
                                      className={`animate-pulse border-2 ${getJobStatusHighlight(
                                        Object.values(vehicleJobs).find(vj => vj.vehicle?.customer_id === customer.id)?.status || customerWorkOrders[0].status
                                      )}`}
                                    >
                                      <Car className="h-3 w-3 mr-1" />
                                      {new Set(customerWorkOrders.map(wo => wo.vehicle_id)).size} Vehicle{new Set(customerWorkOrders.map(wo => wo.vehicle_id)).size > 1 ? 's' : ''} in Service
                                    </Badge>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                  {customer.email && (
                                    <p className="flex items-center gap-2 text-muted-foreground truncate">
                                      <Mail className="h-4 w-4 shrink-0" />
                                      <span className="truncate">{customer.email}</span>
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
                                  {customer.gst_number && (
                                    <p className="flex items-center gap-2 text-muted-foreground">
                                      <Receipt className="h-4 w-4" />
                                      GST: {customer.gst_number}
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

                                {/* Vehicles & Invoices Section */}
                                {(customerVehicles.length > 0 || (invoices[customer.id]?.length || 0) > 0) && (
                                  <div className="mt-4">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="flex items-center gap-2 px-2 h-auto py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                                      onClick={() => toggleExpand(customer.id)}
                                    >
                                      <Car className="h-4 w-4" />
                                      <span>{customerVehicles.length} Vehicle{customerVehicles.length > 1 ? 's' : ''}</span>
                                      {/* Also show invoice count if any */}
                                      {(invoices[customer.id]?.length || 0) > 0 && (
                                        <span className="flex items-center gap-1 ml-2">
                                          <Receipt className="h-3 w-3" />
                                          {invoices[customer.id]?.length} Invoice{(invoices[customer.id]?.length || 0) > 1 ? 's' : ''}
                                        </span>
                                      )}
                                      {isExpanded ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </Button>

                                    {isExpanded && (
                                      <div className="mt-3 space-y-4 pl-6 border-l-2 border-muted">
                                        {/* Billing Overview Summary */}
                                        <div className="bg-muted/30 border rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                                          <div>
                                            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Invoiced</p>
                                            <p className="text-sm font-bold">₹{(invoices[customer.id]?.reduce((sum, i) => sum + (i.total || 0), 0) || 0).toLocaleString()}</p>
                                          </div>
                                          <div>
                                            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Paid (Full)</p>
                                            <p className="text-sm font-bold text-green-600">₹{(invoices[customer.id]?.filter(i => i.status === 'Paid').reduce((sum, i) => sum + (i.total || 0), 0) || 0).toLocaleString()}</p>
                                          </div>
                                          <div>
                                            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Deductions</p>
                                            <p className="text-sm font-bold text-orange-600">₹{(invoices[customer.id]?.reduce((sum, i) => sum + (i.total_deductions || 0), 0) || 0).toLocaleString()}</p>
                                          </div>
                                          <div>
                                            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Pending</p>
                                            <p className="text-sm font-black text-destructive">₹{Math.max(0, (invoices[customer.id]?.reduce((sum, i) => sum + (i.total || 0), 0) || 0) - (invoices[customer.id]?.filter(i => i.status === 'Paid').reduce((sum, i) => sum + (i.total || 0), 0) || 0) - (invoices[customer.id]?.reduce((sum, i) => sum + (i.total_deductions || 0), 0) || 0)).toLocaleString()}</p>
                                          </div>
                                        </div>
                                        {/* Vehicles */}
                                        {customerVehicles.length > 0 && (
                                          <div className="space-y-2">
                                            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Vehicles</h4>
                                            {customerVehicles.map((vehicle) => {
                                              const activeJob = vehicleJobs[vehicle.id];
                                              const highlight = activeJob ? getJobStatusHighlight(activeJob.status) : "";
                                              const containerClasses = activeJob ? highlight.split(' ').slice(0, 3).join(' ') : "bg-muted/50";

                                              return (
                                                <div key={vehicle.id} className={`${containerClasses} p-3 rounded-md border transition-all hover:shadow-sm`}>
                                                  <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                      <Car className={`h-4 w-4 ${activeJob ? "" : "text-muted-foreground"}`} />
                                                      <div>
                                                        <div className="flex items-center gap-2">
                                                          <p className="font-bold">{vehicle.vehicle_number}</p>
                                                          {activeJob && (
                                                            <Badge variant="outline" className="bg-white/80 backdrop-blur-sm text-[10px] h-5 shadow-sm border-inherit uppercase">
                                                              {activeJob.status}
                                                            </Badge>
                                                          )}
                                                        </div>
                                                        <p className="text-xs opacity-80">
                                                          {vehicle.vehicle_type}
                                                          {vehicle.model && ` • ${vehicle.model}`}
                                                          {activeJob?.service_type && ` • ${activeJob.service_type}`}
                                                        </p>
                                                      </div>
                                                    </div>
                                                    {activeJob && (
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-[10px] px-2 bg-white/50 hover:bg-white/80 shadow-sm"
                                                        onClick={() => window.location.href = `/admin/work-orders/${activeJob.id}`}
                                                      >
                                                        View Job
                                                      </Button>
                                                    )}
                                                  </div>

                                                  {activeJob?.driver && (
                                                    <div className="flex items-center gap-2 text-[10px] bg-white/40 p-1 rounded border border-inherit/30 mt-2">
                                                      <Users className="h-3 w-3 opacity-70" />
                                                      <span className="font-semibold">{activeJob.driver.name}</span>
                                                      {activeJob.driver.contact_number && (
                                                        <span className="opacity-60 border-l border-current/20 pl-2 ml-1 flex items-center gap-1">
                                                          <Phone className="h-2.5 w-2.5" />
                                                          {activeJob.driver.contact_number}
                                                        </span>
                                                      )}
                                                    </div>
                                                  )}

                                                  {vehicle.notes && !activeJob && (
                                                    <p className="text-xs text-muted-foreground mt-2 italic">
                                                      {vehicle.notes}
                                                    </p>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}

                                        {/* Invoices */}
                                        {(invoices[customer.id]?.length || 0) > 0 && (
                                          <div className="space-y-2">
                                            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mt-4">Invoices</h4>
                                            {invoices[customer.id]?.map((inv) => (
                                              <div key={inv.id} className="bg-muted/50 p-3 rounded-md flex justify-between items-center">
                                                <div>
                                                  <div className="flex items-center gap-2">
                                                    <Receipt className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-medium text-sm">
                                                      {inv.bill_number ? `#${inv.bill_number}` : 'Draft'}
                                                    </span>
                                                    <Badge variant={inv.status === 'Paid' ? 'default' : inv.status === 'Draft' ? 'secondary' : 'destructive'} className="text-[10px] h-5">
                                                      {inv.status}
                                                    </Badge>
                                                  </div>
                                                  <p className="text-xs text-muted-foreground mt-1">
                                                    {format(new Date(inv.created_at), "MMM d, yyyy")} • ₹{(inv.total || 0).toLocaleString()}
                                                    {inv.total_deductions > 0 && (
                                                      <span className="text-orange-600 font-medium ml-2">(-{inv.total_deductions} Deducted)</span>
                                                    )}
                                                  </p>
                                                </div>
                                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => window.location.href = `/admin/invoices/${inv.id}`}>
                                                  View
                                                </Button>
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        {/* Drivers Section */}
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between mt-4">
                                            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                                              <Users className="h-4 w-4" />
                                              Drivers ({(drivers[customer.id]?.length || 0)})
                                            </h4>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="h-7 text-xs"
                                              onClick={() => handleAddDriver(customer.id)}
                                            >
                                              <Plus className="h-3 w-3 mr-1" />
                                              Add Driver
                                            </Button>
                                          </div>
                                          {(drivers[customer.id]?.length || 0) > 0 ? (
                                            drivers[customer.id]?.map((driver) => (
                                              <div key={driver.id} className="bg-muted/50 p-3 rounded-md flex justify-between items-start">
                                                <div className="flex-1">
                                                  <div className="flex items-center gap-2 mb-1">
                                                    <Users className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-medium text-sm">{driver.name}</span>
                                                    {driver.driver_position && (
                                                      <Badge variant="secondary" className="text-xs h-5">
                                                        {driver.driver_position}
                                                      </Badge>
                                                    )}
                                                  </div>
                                                  {driver.contact_number && (
                                                    <p className="text-xs text-muted-foreground ml-6 flex items-center gap-1">
                                                      <Phone className="h-3 w-3" />
                                                      {driver.contact_number}
                                                    </p>
                                                  )}
                                                </div>
                                                <div className="flex gap-1">
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={() => handleEditDriver(driver)}
                                                  >
                                                    <Edit className="h-3 w-3 mr-1" />
                                                    Edit
                                                  </Button>
                                                  <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    className="h-7 text-xs text-destructive hover:text-destructive"
                                                    onClick={() => handleDeleteDriver(driver.id)}
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              </div>
                                            ))
                                          ) : (
                                            <div className="bg-muted/30 p-4 rounded-md text-center">
                                              <Users className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                                              <p className="text-xs text-muted-foreground">No drivers added yet</p>
                                              <Button
                                                variant="link"
                                                size="sm"
                                                className="h-auto text-xs mt-1"
                                                onClick={() => handleAddDriver(customer.id)}
                                              >
                                                Add first driver
                                              </Button>
                                            </div>
                                          )}
                                        </div>

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
                              <div className="flex gap-2 self-end sm:self-start shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingCustomer(customer);
                                    setShowForm(false); // Ensure create mode is off
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
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
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
              <DriverHistoryDialog
                isOpen={!!viewingDriverHistory}
                onClose={() => setViewingDriverHistory(null)}
                driverId={viewingDriverHistory?.id || null}
                driverName={viewingDriverHistory?.name || null}
              />
            </TabsContent>

            <TabsContent value="drivers" className="mt-0">
              <div className="flex justify-between items-center mb-4">
                <div className="relative max-w-md flex-1">
                  <SearchInput
                    placeholder="Search drivers by name, position, contact..."
                    value={driverSearchTerm}
                    onChange={setDriverSearchTerm}
                    suggestions={[]}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleAddPosition}>
                    <Plus className="h-4 w-4 mr-2" />
                    Manage Positions
                  </Button>
                  <Button onClick={() => {
                    setSelectedCustomerForDriver(null);
                    handleAddDriver(customers[0]?.id || "");
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Driver
                  </Button>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>All Drivers ({Object.values(drivers).flat().length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : Object.values(drivers).flat().length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Drivers Yet</h3>
                      <p className="text-muted-foreground mb-4">Start by adding drivers to your customers</p>
                      <Button onClick={() => setActiveTab("customers")}>
                        Go to Customers
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {customers
                        .filter(customer => {
                          const customerDrivers = drivers[customer.id] || [];
                          // If search term exists, filter customers who have matching drivers OR match the company name themselves
                          if (driverSearchTerm) {
                            const term = driverSearchTerm.toLowerCase();
                            const matchesCompany = (customer.company_name || customer.name).toLowerCase().includes(term);
                            const hasMatchingDriver = customerDrivers.some(d =>
                              d.name.toLowerCase().includes(term) ||
                              d.contact_number?.includes(term) ||
                              d.driver_position?.toLowerCase().includes(term)
                            );
                            return (matchesCompany || hasMatchingDriver) && customerDrivers.length > 0;
                          }
                          // Otherwise just show customers with drivers
                          return customerDrivers.length > 0;
                        })
                        .map(customer => {
                          const customerDrivers = drivers[customer.id] || [];
                          // Filter drivers within the customer if searching
                          const displayDrivers = driverSearchTerm
                            ? customerDrivers.filter(d =>
                              d.name.toLowerCase().includes(driverSearchTerm.toLowerCase()) ||
                              d.contact_number?.includes(driverSearchTerm) ||
                              d.driver_position?.toLowerCase().includes(driverSearchTerm.toLowerCase()) ||
                              (customer.company_name || customer.name).toLowerCase().includes(driverSearchTerm.toLowerCase())
                            )
                            : customerDrivers;

                          if (displayDrivers.length === 0) return null;

                          return (
                            <div key={customer.id} className="border rounded-lg overflow-hidden">
                              <div className="bg-muted/30 p-3 border-b flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  <h3 className="font-semibold">{customer.company_name || customer.name}</h3>
                                  <Badge variant="secondary" className="ml-2">
                                    {displayDrivers.length} Driver{displayDrivers.length !== 1 ? 's' : ''}
                                  </Badge>
                                </div>
                                <Button size="sm" variant="ghost" onClick={() => handleAddDriver(customer.id)}>
                                  <Plus className="h-3 w-3 mr-1" /> Add
                                </Button>
                              </div>

                              <div className="divide-y">
                                {displayDrivers.map((driver) => (
                                  <div key={driver.id} className="p-4 hover:bg-muted/10 transition-colors flex flex-col md:flex-row justify-between gap-4">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3 mb-1">
                                        <Users className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <h4 className="font-semibold">{driver.name}</h4>
                                            {driver.driver_position && (
                                              <Badge variant="outline" className="text-[10px] h-5">
                                                {driver.driver_position}
                                              </Badge>
                                            )}
                                            {driverJobs[driver.id] && (
                                              <Badge
                                                variant="outline"
                                                className={`text-[10px] h-5 border shadow-sm ${getJobStatusHighlight(driverJobs[driver.id].status)}`}
                                              >
                                                On Job: {driverJobs[driver.id].vehicle?.vehicle_number} ({driverJobs[driver.id].status})
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="ml-8 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                        {driver.contact_number && (
                                          <p className="flex items-center gap-2">
                                            <Phone className="h-3 w-3" />
                                            {driver.contact_number}
                                          </p>
                                        )}
                                        <p className="flex items-center gap-2">
                                          <Calendar className="h-3 w-3" />
                                          Added: {format(new Date(driver.created_at), 'MMM d, yyyy')}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 ml-8 md:ml-0">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8"
                                        onClick={() => {
                                          console.log("Viewing history for:", driver.id, driver.name);
                                          setViewingDriverHistory({ id: driver.id, name: driver.name });
                                        }}
                                      >
                                        <History className="h-3.5 w-3.5 mr-1.5" />
                                        History
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={() => handleEditDriver(driver)}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                        onClick={() => handleDeleteDriver(driver.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}

                      {/* Show message if search yields no results */}
                      {driverSearchTerm && customers.every(c => {
                        const customerDrivers = drivers[c.id] || [];
                        const term = driverSearchTerm.toLowerCase();
                        const matchesCompany = (c.company_name || c.name).toLowerCase().includes(term);
                        const hasMatchingDriver = customerDrivers.some(d =>
                          d.name.toLowerCase().includes(term) ||
                          d.contact_number?.includes(term) ||
                          d.driver_position?.toLowerCase().includes(term)
                        );
                        return !((matchesCompany || hasMatchingDriver) && customerDrivers.length > 0);
                      }) && (
                          <div className="text-center py-8 text-muted-foreground">
                            No drivers or companies found matching "{driverSearchTerm}"
                          </div>
                        )}
                    </div>
                  )}
                </CardContent>
              </Card>

            </TabsContent>

            <DriverHistoryDialog
              isOpen={!!viewingDriverHistory}
              onClose={() => setViewingDriverHistory(null)}
              driverId={viewingDriverHistory?.id || null}
              driverName={viewingDriverHistory?.name || null}
            />
          </Tabs>
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

      {/* Driver Management Dialog */}
      <Dialog open={showDriverDialog} onOpenChange={setShowDriverDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {editingDriver ? "Edit Driver" : "Add New Driver"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!editingDriver && (
              <div className="space-y-2">
                <Label htmlFor="driver-customer">Company/Customer *</Label>
                <Select
                  value={selectedCustomerForDriver || ""}
                  onValueChange={(value) => setSelectedCustomerForDriver(value)}
                >
                  <SelectTrigger id="driver-customer">
                    <SelectValue placeholder="Select company..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.company_name || customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="driver-name">Driver Name *</Label>
              <Input
                id="driver-name"
                placeholder="Enter driver name..."
                value={driverFormData.name}
                onChange={(e) => setDriverFormData({ ...driverFormData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver-contact">Contact Number</Label>
              <Input
                id="driver-contact"
                type="tel"
                placeholder="Enter contact number..."
                value={driverFormData.contact_number}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setDriverFormData({ ...driverFormData, contact_number: value });
                }}
                maxLength={10}
                pattern="[0-9]*"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver-position">Position/Role</Label>
              <Select
                value={driverFormData.driver_position}
                onValueChange={(value) => setDriverFormData({ ...driverFormData, driver_position: value })}
              >
                <SelectTrigger id="driver-position">
                  <SelectValue placeholder="Select position..." />
                </SelectTrigger>
                <SelectContent>
                  {driverPositions.map((position) => (
                    <SelectItem key={position.id} value={position.name}>
                      {position.name}
                    </SelectItem>
                  ))}
                  {driverPositions.length === 0 && (
                    <SelectItem value="Driver">Driver (Default)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDriverDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDriver}>
              {editingDriver ? "Update Driver" : "Add Driver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Position Management Dialog */}
      <Dialog open={showPositionDialog} onOpenChange={setShowPositionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Driver Positions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingPosition ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="position-name">Position Name *</Label>
                  <Input
                    id="position-name"
                    placeholder="e.g., Senior Driver"
                    value={positionFormData.name}
                    onChange={(e) => setPositionFormData({ ...positionFormData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position-description">Description</Label>
                  <Input
                    id="position-description"
                    placeholder="Optional description..."
                    value={positionFormData.description}
                    onChange={(e) => setPositionFormData({ ...positionFormData, description: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium">Current Positions</h4>
                  <Button size="sm" onClick={() => {
                    setEditingPosition({} as DriverPosition);
                    setPositionFormData({ name: "", description: "" });
                  }}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add New
                  </Button>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {driverPositions.map((position) => (
                    <div key={position.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{position.name}</p>
                        {position.description && (
                          <p className="text-sm text-muted-foreground">{position.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditPosition(position)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeletePosition(position.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            {editingPosition ? (
              <>
                <Button variant="outline" onClick={() => {
                  setEditingPosition(null);
                  setPositionFormData({ name: "", description: "" });
                }}>
                  Back
                </Button>
                <Button onClick={handleSavePosition}>
                  {editingPosition.id ? "Update Position" : "Add Position"}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setShowPositionDialog(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Driver Confirmation Dialog */}
      <Dialog open={showDeleteDriverDialog} onOpenChange={setShowDeleteDriverDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Deactivate Driver
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              Are you sure you want to deactivate this driver? This will hide them from the active driver list, but their historical work order associations will be preserved.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDriverDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteDriver}>
              Deactivate Driver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Position Confirmation Dialog */}
      <Dialog open={showDeletePositionDialog} onOpenChange={setShowDeletePositionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Position
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              Are you sure you want to delete this position? This action will remove it from the available positions list.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeletePositionDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeletePosition}>
              Delete Position
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

