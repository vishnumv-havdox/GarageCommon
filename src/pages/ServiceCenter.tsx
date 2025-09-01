import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CustomerForm } from "@/components/customers/CustomerForm"
import { VehicleForm } from "@/components/vehicles/VehicleForm"
import { WorkOrderForm } from "@/components/workorders/WorkOrderForm"
import { LoginForm } from "@/components/auth/LoginForm"
import { useToast } from "@/hooks/use-toast"
import { 
  Users, 
  Truck, 
  Wrench, 
  FileText, 
  Package, 
  BarChart3, 
  Plus,
  LogOut,
  RefreshCw
} from "lucide-react"

interface User {
  id: string
  email: string
  role?: string
}

export default function ServiceCenter() {
  const [user, setUser] = useState<User | null>(null)
  const [activeForm, setActiveForm] = useState<string | null>(null)
  const [vehicles, setVehicles] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        // Get user profile with role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authUser.id)
          .single()
        
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          role: profile?.role || 'staff'
        })
        fetchData()
      }
    } catch (error) {
      console.error('Auth check failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchData = async () => {
    try {
      // Fetch vehicles with customer info
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select(`
          *,
          customers!inner(name, company_name)
        `)
        .order('created_at', { ascending: false })

      // Fetch work orders with vehicle and customer info
      const { data: workOrderData } = await supabase
        .from('work_orders')
        .select(`
          *,
          vehicles!inner(
            vehicle_number,
            customers!inner(name)
          )
        `)
        .order('created_at', { ascending: false })

      // Fetch customers
      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      setVehicles(vehicleData || [])
      setWorkOrders(workOrderData || [])
      setCustomers(customerData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      })
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    })
  }

  const handleFormSuccess = () => {
    setActiveForm(null)
    fetchData()
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'Inspection': 'outline',
      'In Progress': 'secondary',
      'Completed': 'default',
      'Ready for Delivery': 'default',
      'Pending': 'destructive'
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin" />
          Loading...
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginForm onSuccess={checkAuth} />
  }

  if (activeForm) {
    const formComponents = {
      customer: <CustomerForm onSuccess={handleFormSuccess} onCancel={() => setActiveForm(null)} />,
      vehicle: <VehicleForm onSuccess={handleFormSuccess} onCancel={() => setActiveForm(null)} />,
      workorder: <WorkOrderForm onSuccess={handleFormSuccess} onCancel={() => setActiveForm(null)} />
    }
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
        {formComponents[activeForm as keyof typeof formComponents]}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              AMMA AUTO GARAGE
            </h1>
            <p className="text-sm text-muted-foreground">Service Center Management System</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm">Welcome, {user.email}</span>
            <Badge variant="outline">{user.role}</Badge>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Button
            onClick={() => setActiveForm('customer')}
            className="h-20 flex flex-col gap-2 bg-gradient-to-br from-primary to-primary-glow"
          >
            <Users className="w-6 h-6" />
            Add Customer
          </Button>
          <Button
            onClick={() => setActiveForm('vehicle')}
            className="h-20 flex flex-col gap-2 bg-gradient-to-br from-secondary to-secondary/80"
          >
            <Truck className="w-6 h-6" />
            Register Vehicle
          </Button>
          <Button
            onClick={() => setActiveForm('workorder')}
            className="h-20 flex flex-col gap-2 bg-gradient-to-br from-accent to-accent/80"
          >
            <Wrench className="w-6 h-6" />
            Create Work Order
          </Button>
        </div>

        {/* Data Tables */}
        <Tabs defaultValue="vehicles" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
            <TabsTrigger value="workorders">Work Orders</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
          </TabsList>

          <TabsContent value="vehicles">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Vehicles ({vehicles.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vehicle Number</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Entry Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((vehicle: any) => (
                      <TableRow key={vehicle.id}>
                        <TableCell className="font-medium">{vehicle.vehicle_number}</TableCell>
                        <TableCell>{vehicle.model}</TableCell>
                        <TableCell>{vehicle.customers.name}</TableCell>
                        <TableCell>{getStatusBadge(vehicle.current_status)}</TableCell>
                        <TableCell>{new Date(vehicle.entry_date).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workorders">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="w-5 h-5" />
                  Work Orders ({workOrders.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Service Type</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workOrders.map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.vehicles.vehicle_number}</TableCell>
                        <TableCell>{order.service_type}</TableCell>
                        <TableCell>{order.vehicles.customers.name}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>₹{order.estimated_cost.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Customers ({customers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Registered</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer: any) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>{customer.company_name || '-'}</TableCell>
                        <TableCell>{customer.email}</TableCell>
                        <TableCell>{customer.phone}</TableCell>
                        <TableCell>{new Date(customer.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}