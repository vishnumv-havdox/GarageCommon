import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Wrench, Search, ChevronDown, Plus, IndianRupee, Layers } from "lucide-react"
import { serviceTypeConfig, ServiceType, serviceTypes } from "@/config/serviceTypeConfig"
import { ServiceSection, ServiceSectionData } from "@/components/work-orders/ServiceSection"
import { TaskItem } from "@/components/work-orders/TaskSelector"
import { cn } from "@/lib/utils"

interface Customer {
  id: string
  name: string
  company_name?: string
}

interface Vehicle {
  id: string
  vehicle_number: string
  model: string
  customer_id: string
  customer_name: string
}

interface Employee {
  id: string
  name: string
  email: string
  position_name: string
  department: string
  status: string
}

interface WorkOrderFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function WorkOrderForm({ onSuccess, onCancel }: WorkOrderFormProps) {
  const { toast } = useToast()

  // Basic data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  // Loading states
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [loadingVehicles, setLoadingVehicles] = useState(true)
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  // Search states
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [vehicleSearchOpen, setVehicleSearchOpen] = useState(false)
  const [customerSearch, setCustomerSearch] = useState("")
  const [vehicleSearch, setVehicleSearch] = useState("")

  // Form state
  const [customerId, setCustomerId] = useState("")
  const [vehicleId, setVehicleId] = useState("")
  const [priority, setPriority] = useState("Medium")
  const [generalDescription, setGeneralDescription] = useState("")

  // Multi-service state
  const [selectedServices, setSelectedServices] = useState<ServiceType[]>([])
  const [serviceSections, setServiceSections] = useState<Record<string, ServiceSectionData>>({})

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    setLoadingCustomers(true)
    setLoadingVehicles(true)
    setLoadingEmployees(true)

    try {
      const [customersRes, vehiclesRes, employeesRes] = await Promise.all([
        supabase.from('customers').select('id, name, company_name').order('name'),
        supabase.from('vehicles').select('id, vehicle_number, model, customer_id, customers!inner(name)'),
        supabase.from('employees').select('id, name, email, position_id, access_level, status').eq('status', 'active'),
      ])

      if (customersRes.data) setCustomers(customersRes.data)
      if (vehiclesRes.data) {
        const formatted = vehiclesRes.data.map((v: any) => ({
          id: v.id,
          vehicle_number: v.vehicle_number,
          model: v.model,
          customer_id: v.customer_id,
          customer_name: v.customers?.name
        }))
        setVehicles(formatted)
      }
      if (employeesRes.data) {
        const employeesWithPositions = await Promise.all(
          employeesRes.data.map(async (emp: any) => {
            const { data: pos } = await supabase
              .from('positions')
              .select('name, department')
              .eq('id', emp.position_id)
              .single()
            return {
              ...emp,
              position_name: pos?.name || 'Staff',
              department: pos?.department || 'Service',
              status: emp.status
            }
          })
        )
        setEmployees(employeesWithPositions)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoadingCustomers(false)
      setLoadingVehicles(false)
      setLoadingEmployees(false)
    }
  }

  // Filter vehicles by customer
  const filteredVehicles = customerId
    ? vehicles.filter(v => v.customer_id === customerId)
    : []

  const handleCustomerSelect = (id: string) => {
    setCustomerId(id)
    setCustomerSearch("")
    setCustomerSearchOpen(false)
    setVehicleId("")
  }

  const handleVehicleSelect = (id: string) => {
    setVehicleId(id)
    setVehicleSearch("")
    setVehicleSearchOpen(false)
  }

  const handleServiceToggle = (type: ServiceType, checked: boolean) => {
    if (checked) {
      setSelectedServices(prev => [...prev, type])
      // Initialize section data
      setServiceSections(prev => ({
        ...prev,
        [type]: {
          serviceType: type,
          tasks: [], // Pre-defined tasks can be auto-added here if needed? No, let user select.
          selectedEmployeeIds: [],
          notes: "",
          cost: 0
        }
      }))
    } else {
      setSelectedServices(prev => prev.filter(t => t !== type))
      const newSections = { ...serviceSections }
      delete newSections[type]
      setServiceSections(newSections)
    }
  }

  const handleSectionUpdate = (data: ServiceSectionData) => {
    setServiceSections(prev => ({
      ...prev,
      [data.serviceType]: data
    }))
  }

  const handleRemoveSection = (type: ServiceType) => {
    handleServiceToggle(type, false)
  }

  // Calculate total estimated cost
  const totalEstimatedCost = Object.values(serviceSections).reduce((sum, s) => sum + (s.cost || 0), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!customerId || !vehicleId || selectedServices.length === 0 || !generalDescription) {
      toast({
        title: "Error",
        description: "Please fill in all required fields (Customer, Vehicle, Description, Services)",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      // 1. Create Main Work Order
      const mainServiceType = selectedServices.length === 1 ? selectedServices[0] : "Multi-Service";

      const { data: workOrder, error } = await supabase
        .from('work_orders')
        .insert([{
          vehicle_id: vehicleId,
          service_type: mainServiceType,
          description: generalDescription,
          priority: priority,
          estimated_cost: totalEstimatedCost,
          status: 'Pending',
          current_stage: 'Inspection', // Initial stage
          started_at: new Date().toISOString(),
          notes: JSON.stringify({
            service_types: selectedServices,
            total_sections: selectedServices.length
          })
        }])
        .select()
        .single()

      if (error) throw error
      if (!workOrder) throw new Error("Failed to create work order")

      // 2. Create Service Sections and related data
      for (const type of selectedServices) {
        const sectionData = serviceSections[type];
        if (!sectionData) continue;

        // Create work_order_services entry
        const { data: serviceRecord, error: serviceError } = await supabase
          .from('work_order_services')
          .insert({
            work_order_id: workOrder.id,
            service_type: type,
            estimated_cost: sectionData.cost,
            status: 'Pending'
          })
          .select()
          .single()

        if (serviceError) throw serviceError
        if (!serviceRecord) continue;

        // Create tasks
        if (sectionData.tasks.length > 0) {
          const tasksPayload = sectionData.tasks.map(task => ({
            work_order_id: workOrder.id,
            service_id: serviceRecord.id,
            task_name: task.name,
            task_type: 'repair',
            is_predefined: task.isPredefined,
            completed: false
          }))
          await supabase.from('work_order_tasks').insert(tasksPayload)
        }

        // Create employee assignments
        if (sectionData.selectedEmployeeIds.length > 0) {
          // Use RPC functions to bypass RLS for assignments
          for (const empId of sectionData.selectedEmployeeIds) {
            // Insert into work_order_service_employees via RPC (bypasses RLS)
            await supabase.rpc('insert_work_order_service_employee', {
              p_service_id: serviceRecord.id,
              p_employee_id: empId,
              p_status: 'Assigned'
            })

            // Also link to main work_order_assignments for backward compatibility with staff portal
            // Use RPC function to bypass RLS
            await supabase.rpc('insert_work_order_assignment', {
              p_work_order_id: workOrder.id,
              p_employee_id: empId,
              p_notes: `Assigned to ${type}`
            })
          }
        }

        // Create notes
        if (sectionData.notes) {
          await supabase.from('work_order_service_notes').insert({
            service_id: serviceRecord.id,
            note_content: sectionData.notes,
            note_type: 'General',
            is_internal: true
          })
        }
      }

      // Update vehicle status
      await supabase
        .from('vehicles')
        .update({ status: 'In Progress' })
        .eq('id', vehicleId)

      toast({
        title: "Success",
        description: `Work order created with ${selectedServices.length} service sections.`,
      })
      onSuccess()
    } catch (error: any) {
      console.error('Error creating work order:', error)
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getCustomerDisplayName = (customer: Customer) => {
    return customer.company_name ? `${customer.name} (${customer.company_name})` : customer.name
  }

  const filteredCustomers = customers.filter(c =>
    getCustomerDisplayName(c).toLowerCase().includes(customerSearch.toLowerCase())
  )

  const filteredVehicleList = filteredVehicles.filter(v =>
    `${v.vehicle_number} ${v.model}`.toLowerCase().includes(vehicleSearch.toLowerCase())
  )

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Create Work Order
          </CardTitle>
          <CardDescription>
            Configure multiple services, tasks, and staff assignments for this vehicle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">

            {/* 1. Vehicle & Customer Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Vehicle Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer / Company *</Label>
                  <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between" disabled={loadingCustomers}>
                        {customerId
                          ? getCustomerDisplayName(customers.find(c => c.id === customerId)!)
                          : "Select customer..."}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search customer..." value={customerSearch} onValueChange={setCustomerSearch} />
                        <CommandList>
                          <CommandEmpty>No customer found.</CommandEmpty>
                          <CommandGroup>
                            {filteredCustomers.map((customer) => (
                              <CommandItem key={customer.id} value={getCustomerDisplayName(customer)} onSelect={() => handleCustomerSelect(customer.id)}>
                                {getCustomerDisplayName(customer)}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Vehicle *</Label>
                  <Popover open={vehicleSearchOpen} onOpenChange={setVehicleSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between" disabled={!customerId || loadingVehicles}>
                        {vehicleId
                          ? `${filteredVehicles.find(v => v.id === vehicleId)?.vehicle_number} - ${filteredVehicles.find(v => v.id === vehicleId)?.model}`
                          : "Select vehicle..."}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search vehicle..." value={vehicleSearch} onValueChange={setVehicleSearch} />
                        <CommandList>
                          <CommandEmpty>No vehicle found.</CommandEmpty>
                          <CommandGroup>
                            {filteredVehicleList.map((vehicle) => (
                              <CommandItem key={vehicle.id} value={`${vehicle.vehicle_number} ${vehicle.model}`} onSelect={() => handleVehicleSelect(vehicle.id)}>
                                {vehicle.vehicle_number} - {vehicle.model}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>General Description *</Label>
                  <Textarea
                    placeholder="Brief overview of the requested work..."
                    rows={2}
                    value={generalDescription}
                    onChange={(e) => setGeneralDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* 2. Service Selection */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Select Services Required
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {serviceTypes.map((type) => (
                  <div key={type} className="flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/50 transition-colors">
                    <Checkbox
                      id={`service-${type}`}
                      checked={selectedServices.includes(type)}
                      onCheckedChange={(checked) => handleServiceToggle(type, checked as boolean)}
                    />
                    <Label
                      htmlFor={`service-${type}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer w-full"
                    >
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Dynamic Service Sections */}
            {selectedServices.length > 0 && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Service Configuration</h3>
                  <div className="text-sm font-medium flex items-center gap-2 bg-secondary px-3 py-1 rounded-full">
                    <IndianRupee className="h-4 w-4" />
                    Total Est. Cost: ₹{totalEstimatedCost.toLocaleString()}
                  </div>
                </div>

                <div className="space-y-8">
                  {selectedServices.map(type => (
                    <ServiceSection
                      key={type}
                      serviceType={type}
                      data={serviceSections[type]}
                      availableEmployees={employees}
                      onChange={handleSectionUpdate}
                      onRemove={() => handleRemoveSection(type)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4 justify-end pt-6 border-t">
              <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || selectedServices.length === 0} size="lg">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Work Order...
                  </>
                ) : (
                  <>Create Work Order (₹{totalEstimatedCost})</>
                )}
              </Button>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  )
}
