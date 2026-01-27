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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Wrench, Search, ChevronDown, Plus, IndianRupee, Layers, Edit, Trash2, Activity } from "lucide-react"
import { serviceTypeConfig, ServiceType } from "@/config/serviceTypeConfig"
import { ServiceSection, ServiceSectionData } from "@/components/work-orders/ServiceSection"
import { TaskItem, TaskTemplate } from "@/components/work-orders/TaskSelector"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Clock } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
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
  kilometers_driven?: number
  next_service_km?: number
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

  // Dynamic Service Types
  interface DBServiceType { id: string; name: string }
  const [dbServiceTypes, setDbServiceTypes] = useState<DBServiceType[]>([])
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([])

  const [newServiceName, setNewServiceName] = useState("")
  const [newServiceTasks, setNewServiceTasks] = useState<string[]>([])
  const [newTaskInput, setNewTaskInput] = useState("")
  const [isAddingService, setIsAddingService] = useState(false)
  const [showAddServiceDialog, setShowAddServiceDialog] = useState(false)

  // Edit Service State
  const [editingService, setEditingService] = useState<DBServiceType | null>(null)
  const [editServiceName, setEditServiceName] = useState("")
  const [isUpdatingService, setIsUpdatingService] = useState(false)

  // Delete Service State
  const [deletingService, setDeletingService] = useState<DBServiceType | null>(null)
  const [isDeletingService, setIsDeletingService] = useState(false)

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
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState<Date | undefined>(undefined)
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState("18:00")

  // Multi-service state
  const [selectedServices, setSelectedServices] = useState<ServiceType[]>([])
  const [serviceSections, setServiceSections] = useState<Record<string, ServiceSectionData>>({})

  // New Vehicle Dialog State
  const [showAddVehicleDialog, setShowAddVehicleDialog] = useState(false)
  const [newVehicleData, setNewVehicleData] = useState({
    vehicle_number: "",
    vehicle_type: "Truck",
    model: "",
    year: new Date().getFullYear(),
    color: "",
    vin: "",
    engine_number: "",
    kilometers_driven: 0,
  })
  const [isCreatingVehicle, setIsCreatingVehicle] = useState(false)

  // New Customer + Vehicle Dialog State
  const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false)
  const [newCustomerData, setNewCustomerData] = useState({
    name: "",
    email: "",
    phone: "",
    company_name: "",
    address: "",
  })
  const [newCustomerVehicleData, setNewCustomerVehicleData] = useState({
    vehicle_number: "",
    vehicle_type: "Truck",
    model: "",
    year: new Date().getFullYear(),
    color: "",
    vin: "",
    engine_number: "",
    kilometers_driven: 0,
  })
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false)
  const [includeVehicle, setIncludeVehicle] = useState(true)

  // Lifecycle State
  const [lifecycleData, setLifecycleData] = useState({
    odometer_reading: 0,
    next_service_due_km: 0,
    is_fc_renewal: false
  })

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    setLoadingCustomers(true)
    setLoadingVehicles(true)
    setLoadingEmployees(true)

    try {
      const [customersRes, vehiclesRes, employeesRes, serviceTypesRes, taskTemplatesRes] = await Promise.all([
        supabase.from('customers').select('id, name, company_name').order('name'),
        supabase.from('vehicles').select('id, vehicle_number, model, customer_id, kilometers_driven, next_service_km, customers(name)'),
        supabase.from('employees').select('id, name, email, position_id, access_level, status').eq('status', 'active'),
        supabase.from('service_types').select('id, name').order('name'),
        supabase.from('task_templates').select('id, name, service_type_id').eq('is_active', true),
      ])

      if (customersRes.data) setCustomers(customersRes.data)
      if (vehiclesRes.data) {
        const formatted = vehiclesRes.data.map((v: any) => ({
          id: v.id,
          vehicle_number: v.vehicle_number,
          model: v.model,
          customer_id: v.customer_id,
          customer_name: v.customers?.name,
          kilometers_driven: v.kilometers_driven,
          next_service_km: v.next_service_km
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

      // Set service types from DB
      if (serviceTypesRes?.data) {
        setDbServiceTypes(serviceTypesRes.data)
      }

      // Set task templates
      if (taskTemplatesRes?.data) {
        setTaskTemplates(taskTemplatesRes.data)
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

    // Pre-fill lifecycle data
    const selectedVehicle = vehicles.find(v => v.id === id)
    if (selectedVehicle) {
      setLifecycleData(prev => ({
        ...prev,
        odometer_reading: selectedVehicle.kilometers_driven || 0,
        next_service_due_km: selectedVehicle.next_service_km || 0
      }))
    }
  }

  const handleServiceToggle = (type: string, checked: boolean) => {
    // Cast to ServiceType for compatibility with existing types, 
    // effectively treating new dynamic types as ServiceType
    const serviceType = type as ServiceType;

    if (checked) {
      setSelectedServices(prev => [...prev, serviceType])
      // Initialize section data
      setServiceSections(prev => ({
        ...prev,
        [serviceType]: {
          serviceType: serviceType,
          tasks: [], // Pre-defined tasks can be auto-added here if needed? No, let user select.
          selectedEmployeeIds: [],
          notes: "",
          cost: 0
        }
      }))
    } else {
      setSelectedServices(prev => prev.filter(t => t !== serviceType))
      const newSections = { ...serviceSections }
      delete newSections[serviceType]
      setServiceSections(newSections)
    }
  }

  const handleAddCustomService = async () => {
    if (!newServiceName.trim()) return;

    setIsAddingService(true);
    try {
      const { data, error } = await supabase
        .from('service_types')
        .insert({ name: newServiceName.trim() })
        .select()
        .single();

      if (error) throw error;

      // Add tasks if any
      if (newServiceTasks.length > 0) {
        const taskInserts = newServiceTasks.map(t => ({
          service_type_id: data.id,
          name: t,
          is_active: true
        }));
        const { data: tasksData, error: taskError } = await supabase
          .from('task_templates')
          .insert(taskInserts)
          .select();

        if (taskError) console.error("Error adding tasks:", taskError);
        if (tasksData) {
          setTaskTemplates(prev => [...prev, ...tasksData]);
        }
      }

      // Add to local list and select it
      setDbServiceTypes(prev => [...prev, data]);
      handleServiceToggle(data.name, true);

      toast({ title: "Service Added", description: `${data.name} added with ${newServiceTasks.length} tasks.` });
      setShowAddServiceDialog(false);
      setNewServiceName("");
      setNewServiceTasks([]);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsAddingService(false);
    }
  };

  const handleUpdateService = async () => {
    if (!editingService || !editServiceName.trim()) return;

    setIsUpdatingService(true);
    try {
      const { error } = await supabase
        .from('service_types')
        .update({ name: editServiceName.trim() })
        .eq('id', editingService.id);

      if (error) throw error;

      setDbServiceTypes(prev => prev.map(s => s.id === editingService.id ? { ...s, name: editServiceName.trim() } : s));
      // If selected, update selection logic? 
      // Complex if name is used as key. WorkOrderForm uses name as key currently.
      // Updating name in `selectedServices` and `serviceSections` is needed.

      if (selectedServices.includes(editingService.name as ServiceType)) {
        const newName = editServiceName.trim();
        // Update selectedServices
        setSelectedServices(prev => prev.map(s => s === editingService.name ? newName as ServiceType : s));
        // Update serviceSections key and serviceType field
        setServiceSections(prev => {
          const section = prev[editingService.name];
          if (!section) return prev;
          const { [editingService.name]: _, ...rest } = prev;
          return {
            ...rest,
            [newName]: { ...section, serviceType: newName }
          };
        });
      }

      toast({ title: "Service Updated", description: "Service name updated successfully." });
      setEditingService(null);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsUpdatingService(false);
    }
  }

  const handleDeleteService = (service: DBServiceType) => {
    // Open dialog instead of confirm
    setDeletingService(service);
  }

  const handleDeleteServiceConfirm = async () => {
    if (!deletingService) return;

    setIsDeletingService(true);
    try {
      // Deselect if selected
      if (selectedServices.includes(deletingService.name as ServiceType)) {
        handleServiceToggle(deletingService.name, false);
      }

      const { error } = await supabase
        .from('service_types')
        .delete()
        .eq('id', deletingService.id);

      if (error) throw error;

      setDbServiceTypes(prev => prev.filter(s => s.id !== deletingService.id));
      toast({ title: "Service Deleted", description: "Service deleted successfully." });
      setDeletingService(null);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsDeletingService(false);
    }
  }

  const getServiceIdByName = (name: string) => {
    return dbServiceTypes.find(s => s.name === name)?.id;
  }

  const handleCustomTaskAdd = async (serviceTypeId: string, taskName: string): Promise<TaskTemplate | null> => {
    try {
      const { data, error } = await supabase
        .from('task_templates')
        .insert({
          service_type_id: serviceTypeId,
          name: taskName,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      if (data) {
        setTaskTemplates(prev => [...prev, data]);
        return data;
      }
      return null;
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: "Failed to create task template" });
      console.error(error);
      return null;
    }
  }

  const handleUpdateTaskTemplate = async (task: TaskTemplate, newName: string) => {
    try {
      const { error } = await supabase
        .from('task_templates')
        .update({ name: newName })
        .eq('id', task.id);

      if (error) throw error;

      setTaskTemplates(prev => prev.map(t => t.id === task.id ? { ...t, name: newName } : t));
      toast({ title: "Task Updated", description: "Task template name updated." });

      // Note: This won't automatically update tasks already added to the list (TaskItem[]) 
      // because they are copied by value (name string). 
      // That's acceptable behavior for now (snapshots).
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  }

  const handleDeleteTaskTemplate = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('task_templates')
        .update({ is_active: false }) // Soft delete or hard delete? User might prefer hard delete if unused.
        // Let's stick to Soft Delete based on schema 'is_active' usually implies soft delete.
        // Actually, for cleanup, maybe delete? 
        // If I delete, it might break integrity if I have FKs.
        // Schema didn't specify cascade on 'task_templates' for work_orders... wait, work_order_tasks doesn't copy ID?
        // work_order_tasks usually copies values.
        // Let's restart: schema usually implies soft delete if is_active exists.
        // But user asked to "Delete".
        // Let's try Delete and let DB strictness decide. 
        // If we want to hide it from dropdown, setting is_active=false is safer.
        // But let's try delete to keep list clean.
        .delete()
        .eq('id', taskId);

      if (error) {
        // Fallback to soft delete if FK constraint fails
        console.warn("Hard delete failed, trying soft delete", error);
        const { error: softError } = await supabase
          .from('task_templates')
          .update({ is_active: false })
          .eq('id', taskId);

        if (softError) throw softError;
      }

      setTaskTemplates(prev => prev.filter(t => t.id !== taskId));
      toast({ title: "Task Deleted", description: "Task template removed." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
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

  // Handle creating a new vehicle inline
  const handleCreateVehicle = async () => {
    if (!customerId) {
      toast({
        title: "Error",
        description: "Please select a customer first before adding a vehicle",
        variant: "destructive",
      })
      return
    }

    if (!newVehicleData.vehicle_number || !newVehicleData.vehicle_type) {
      toast({
        title: "Error",
        description: "Please fill in required fields (Vehicle Number, Type)",
        variant: "destructive",
      })
      return
    }

    setIsCreatingVehicle(true)
    try {
      const { data: newVehicle, error } = await supabase
        .from('vehicles')
        .insert({
          customer_id: customerId,
          vehicle_number: newVehicleData.vehicle_number,
          vehicle_type: newVehicleData.vehicle_type,
          model: newVehicleData.model || null,
          year: newVehicleData.year || null,
          color: newVehicleData.color || null,
          vin: newVehicleData.vin || null,
          engine_number: newVehicleData.engine_number || null,
          kilometers_driven: newVehicleData.kilometers_driven || 0,
          status: 'Inspection'
        })
        .select()
        .single()

      if (error) throw error

      // Refresh vehicles list
      const { data: vehiclesRes } = await supabase
        .from('vehicles')
        .select('id, vehicle_number, model, customer_id, kilometers_driven, next_service_km, customers(name)')
        .eq('customer_id', customerId)

      if (vehiclesRes) {
        const formatted = vehiclesRes.map((v: any) => ({
          id: v.id,
          vehicle_number: v.vehicle_number,
          model: v.model,
          customer_id: v.customer_id,
          customer_name: v.customers?.name,
          kilometers_driven: v.kilometers_driven,
          next_service_km: v.next_service_km
        }))
        setVehicles(prev => [...prev, ...formatted])
      }

      // Auto-select the new vehicle
      if (newVehicle) {
        setVehicleId(newVehicle.id)
        // Pre-fill lifecycle data
        setLifecycleData(prev => ({
          ...prev,
          odometer_reading: newVehicleData.kilometers_driven || 0,
          next_service_due_km: 0
        }))
      }

      // Reset form and close dialog
      setNewVehicleData({
        vehicle_number: "",
        vehicle_type: "Truck",
        model: "",
        year: new Date().getFullYear(),
        color: "",
        vin: "",
        engine_number: "",
      })
      setShowAddVehicleDialog(false)

      toast({
        title: "Success",
        description: `Vehicle ${newVehicleData.vehicle_number} created successfully!`,
      })
    } catch (error: any) {
      console.error("Error creating vehicle:", error)
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsCreatingVehicle(false)
    }
  }

  // Handle creating a new customer with optional vehicle
  const handleCreateCustomer = async () => {
    // Validate customer fields
    if (!newCustomerData.name || !newCustomerData.phone) {
      toast({
        title: "Error",
        description: "Please fill in required customer fields (Name, Phone)",
        variant: "destructive",
      })
      return
    }

    // Validate vehicle fields if includeVehicle is checked
    if (includeVehicle && (!newCustomerVehicleData.vehicle_number || !newCustomerVehicleData.vehicle_type || !newCustomerVehicleData.model)) {
      toast({
        title: "Error",
        description: "Please fill in required vehicle fields or uncheck 'Include Vehicle'",
        variant: "destructive",
      })
      return
    }

    setIsCreatingCustomer(true)
    try {
      // 1. Create customer
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          name: newCustomerData.name,
          email: newCustomerData.email || null,
          phone: newCustomerData.phone,
          company_name: newCustomerData.company_name || null,
          address: newCustomerData.address || null,
        })
        .select()
        .single()

      if (customerError) throw customerError

      let newVehicle = null

      // 2. Create vehicle if included
      if (includeVehicle) {
        const { data: vehicleData, error: vehicleError } = await supabase
          .from('vehicles')
          .insert({
            customer_id: newCustomer.id,
            vehicle_number: newCustomerVehicleData.vehicle_number,
            vehicle_type: newCustomerVehicleData.vehicle_type,
            model: newCustomerVehicleData.model,
            year: newCustomerVehicleData.year || null,
            color: newCustomerVehicleData.color || null,
            vin: newCustomerVehicleData.vin || null,
            engine_number: newCustomerVehicleData.engine_number || null,
            status: 'Inspection'
          })
          .select()
          .single()

        if (vehicleError) throw vehicleError
        newVehicle = vehicleData
      }

      // 3. Refresh customers list
      const { data: customersRes } = await supabase
        .from('customers')
        .select('id, name, company_name')
        .order('name')

      if (customersRes) {
        setCustomers(customersRes)
      }

      // 4. Refresh vehicles list
      const { data: vehiclesRes } = await supabase
        .from('vehicles')
        .select('id, vehicle_number, model, customer_id, customers!inner(name)')

      if (vehiclesRes) {
        const formatted = vehiclesRes.map((v: any) => ({
          id: v.id,
          vehicle_number: v.vehicle_number,
          model: v.model,
          customer_id: v.customer_id,
          customer_name: v.customers?.name
        }))
        setVehicles(formatted)
      }

      // 5. Auto-select the customer
      setCustomerId(newCustomer.id)

      // 6. Auto-select vehicle if created
      if (newVehicle) {
        setVehicleId(newVehicle.id)
      }

      // 7. Reset form and close dialog
      setNewCustomerData({
        name: "",
        email: "",
        phone: "",
        company_name: "",
        address: "",
      })
      setNewCustomerVehicleData({
        vehicle_number: "",
        vehicle_type: "Truck",
        model: "",
        year: new Date().getFullYear(),
        color: "",
        vin: "",
        engine_number: "",
      })
      setShowAddCustomerDialog(false)

      toast({
        title: "Success",
        description: includeVehicle
          ? `Customer ${newCustomerData.name} and vehicle ${newCustomerVehicleData.vehicle_number} created successfully!`
          : `Customer ${newCustomerData.name} created successfully!`,
      })
    } catch (error: any) {
      console.error("Error creating customer:", error)
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsCreatingCustomer(false)
    }
  }

  // Calculate total estimated cost
  const totalEstimatedCost = Object.values(serviceSections).reduce((sum, s) => sum + (s.cost || 0), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!customerId || !vehicleId || selectedServices.length === 0) {
      toast({
        title: "Error",
        description: "Please fill in all required fields (Customer, Vehicle, Services)",
        variant: "destructive",
      })
      return
    }

    if (!estimatedDeliveryDate) {
      toast({
        title: "Error",
        description: "Please select an Estimated Delivery Date",
        variant: "destructive",
      })
      return
    }

    // Combine Date and Time
    const deliveryDateTime = new Date(estimatedDeliveryDate);
    const [hours, minutes] = estimatedDeliveryTime.split(':').map(Number);
    deliveryDateTime.setHours(hours || 0, minutes || 0, 0, 0);

    setIsLoading(true)
    try {
      // 1. Create Main Work Order
      const mainServiceType = selectedServices.length === 1 ? selectedServices[0] : "Multi-Service";

      const { data: workOrder, error } = await supabase
        .from('work_orders')
        .insert([{
          vehicle_id: vehicleId,
          service_type: mainServiceType,
          description: generalDescription || "No description provided",
          priority: priority,
          estimated_cost: totalEstimatedCost,
          status: 'Pending',
          current_stage: 'Inspection', // Initial stage
          started_at: new Date().toISOString(),
          notes: JSON.stringify({
            service_types: selectedServices,
            total_sections: selectedServices.length
          }),
          // Lifecycle Fields
          odometer_reading: lifecycleData.odometer_reading || null,
          next_service_due_km: lifecycleData.next_service_due_km || null,
          is_fc_renewal: lifecycleData.is_fc_renewal,
          estimated_delivery_date: deliveryDateTime.toISOString()
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

      // Update vehicle status and lifecycle data
      await supabase
        .from('vehicles')
        .update({
          status: 'In Progress',
          // Update master data with latest values from this work order intake
          kilometers_driven: lifecycleData.odometer_reading || undefined,
          next_service_km: lifecycleData.next_service_due_km || undefined
        })
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Customer / Company *</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-muted-foreground hover:text-foreground ml-auto"
                      onClick={() => setShowAddCustomerDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Customer
                    </Button>
                  </div>
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
                      <Command shouldFilter={false}>
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Vehicle *</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-muted-foreground hover:text-foreground ml-auto"
                      onClick={() => {
                        if (!customerId) {
                          toast({
                            title: "Select Customer",
                            description: "Please select a customer first",
                            variant: "destructive",
                          })
                          return
                        }
                        setShowAddVehicleDialog(true)
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Vehicle
                    </Button>
                  </div>
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
                      <Command shouldFilter={false}>
                        <CommandInput placeholder="Search vehicle..." value={vehicleSearch} onValueChange={setVehicleSearch} />
                        <CommandList>
                          <CommandEmpty>
                            <div className="p-2 text-center">
                              <p className="text-sm text-muted-foreground mb-2">No vehicle found</p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                  setVehicleSearchOpen(false)
                                  setShowAddVehicleDialog(true)
                                }}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add New Vehicle
                              </Button>
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            {filteredVehicleList.map((vehicle) => (
                              <CommandItem key={vehicle.id} value={`${vehicle.vehicle_number} ${vehicle.model}`} onSelect={() => handleVehicleSelect(vehicle.id)}>
                                {vehicle.vehicle_number} - {vehicle.model}
                              </CommandItem>
                            ))}
                            {filteredVehicleList.length > 0 && (
                              <div className="border-t pt-2 mt-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-center"
                                  onClick={() => {
                                    setVehicleSearchOpen(false)
                                    setShowAddVehicleDialog(true)
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Another Vehicle
                                </Button>
                              </div>
                            )}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>General Description</Label>
                  <Textarea
                    placeholder="Brief overview of the requested work..."
                    rows={2}
                    value={generalDescription}
                    onChange={(e) => setGeneralDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-4 border-t pt-4 mt-4">
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    Reference & Delivery
                  </h3>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" /> Estimated Delivery Date <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !estimatedDeliveryDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {estimatedDeliveryDate ? format(estimatedDeliveryDate, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={estimatedDeliveryDate}
                            onSelect={setEstimatedDeliveryDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <div className="w-[120px]">
                        <Input
                          type="time"
                          value={estimatedDeliveryTime}
                          onChange={(e) => setEstimatedDeliveryTime(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
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
              <div className="flex justify-end mb-2">
                <Popover open={showAddServiceDialog} onOpenChange={setShowAddServiceDialog}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1">
                      <Plus className="h-3.5 w-3.5" /> Add New Service
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 p-4" align="end">
                    <div className="space-y-4">
                      <h4 className="font-medium leading-none">Add New Service Type</h4>
                      <div className="grid gap-2">
                        <Label htmlFor="new-service">Service Name</Label>
                        <Input
                          id="new-service"
                          value={newServiceName}
                          onChange={(e) => setNewServiceName(e.target.value)}
                          placeholder="e.g. Ceramic Coating"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>Default Tasks</Label>
                        <div className="flex gap-2">
                          <Input
                            value={newTaskInput}
                            onChange={(e) => setNewTaskInput(e.target.value)}
                            placeholder="Add task..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (newTaskInput.trim()) {
                                  setNewServiceTasks(prev => [...prev, newTaskInput.trim()]);
                                  setNewTaskInput("");
                                }
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (newTaskInput.trim()) {
                                setNewServiceTasks(prev => [...prev, newTaskInput.trim()]);
                                setNewTaskInput("");
                              }
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {newServiceTasks.length > 0 && (
                          <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-muted rounded-md">
                            {newServiceTasks.map((task, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm bg-white dark:bg-zinc-900 p-1.5 rounded border">
                                <span>{task}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 hover:text-destructive"
                                  onClick={() => setNewServiceTasks(prev => prev.filter((_, i) => i !== idx))}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <Button
                        onClick={handleAddCustomService}
                        disabled={!newServiceName.trim() || isAddingService}
                        className="w-full"
                      >
                        {isAddingService ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Save Service
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Edit Service Dialog */}
                <Dialog open={!!editingService} onOpenChange={(open) => !open && setEditingService(null)}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Service</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="edit-service-name">Service Name</Label>
                        <Input
                          id="edit-service-name"
                          value={editServiceName}
                          onChange={(e) => setEditServiceName(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setEditingService(null)}>Cancel</Button>
                      <Button onClick={handleUpdateService} disabled={!editServiceName.trim() || isUpdatingService}>
                        {isUpdatingService && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Update
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <AlertDialog open={!!deletingService} onOpenChange={(open) => !open && setDeletingService(null)}>
                  <AlertDialogContent className="w-[95vw] max-w-md rounded-lg mx-auto">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the service "{deletingService?.name}".
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                      <AlertDialogCancel disabled={isDeletingService} className="mt-0">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDeleteServiceConfirm(); }} disabled={isDeletingService} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {isDeletingService && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {dbServiceTypes.map((type) => (
                  <div key={type.id} className="group relative flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/50 transition-colors pr-12">
                    <Checkbox
                      id={`service-${type.id}`}
                      checked={selectedServices.includes(type.name as ServiceType)}
                      onCheckedChange={(checked) => handleServiceToggle(type.name, checked as boolean)}
                    />
                    <Label
                      htmlFor={`service-${type.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer w-full select-none"
                    >
                      {type.name}
                    </Label>

                    {/* Action Buttons */}
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:text-blue-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingService(type);
                          setEditServiceName(type.name);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteService(type);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
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
                  {selectedServices.map(type => {
                    const data = serviceSections[type];
                    if (!data) return null; // Should not happen if selectedServices and serviceSections are in sync

                    const serviceId = getServiceIdByName(data.serviceType);
                    const sectionTasks = serviceId ? taskTemplates.filter(t => t.service_type_id === serviceId) : [];

                    return (
                      <ServiceSection
                        key={type}
                        serviceType={data.serviceType as ServiceType} // Keep cast until refactor
                        serviceId={serviceId}
                        data={data}
                        availableEmployees={employees}
                        availableTasks={sectionTasks}
                        onChange={handleSectionUpdate}
                        onRemove={() => handleRemoveSection(type)}
                        onCustomTaskAdd={serviceId ? (name) => handleCustomTaskAdd(serviceId, name) : undefined}
                        onTaskUpdate={handleUpdateTaskTemplate}
                        onTaskDelete={handleDeleteTaskTemplate}
                      />
                    )
                  })}  </div>
              </div>
            )}

            {/* Lifecycle & Service Tracking Section */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Service Tracking & Lifecycle
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="odometer">Current Odometer (KM)</Label>
                  <Input
                    id="odometer"
                    type="number"
                    value={lifecycleData.odometer_reading || ''}
                    onChange={(e) => setLifecycleData(prev => ({ ...prev, odometer_reading: parseInt(e.target.value) || 0 }))}
                    placeholder="e.g. 50000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="next_service">Next Service Due (KM)</Label>
                  <Input
                    id="next_service"
                    type="number"
                    value={lifecycleData.next_service_due_km || ''}
                    onChange={(e) => setLifecycleData(prev => ({ ...prev, next_service_due_km: parseInt(e.target.value) || 0 }))}
                    placeholder="e.g. 55000"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 border p-3 rounded-md bg-muted/20">
                <Checkbox
                  id="fc_renewal"
                  checked={lifecycleData.is_fc_renewal}
                  onCheckedChange={(checked) => setLifecycleData(prev => ({ ...prev, is_fc_renewal: checked as boolean }))}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="fc_renewal"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Includes FC Renewal?
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Check if this work order involves Fitness Certificate renewal tasks.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row gap-4 sm:justify-end pt-6 border-t">
              <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || selectedServices.length === 0} size="lg" className="w-full sm:w-auto">
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

      {/* Add New Vehicle Dialog */}
      <Dialog open={showAddVehicleDialog} onOpenChange={setShowAddVehicleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Register New Vehicle
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleCreateVehicle(); }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new_vehicle_number">Vehicle Number *</Label>
                <Input
                  id="new_vehicle_number"
                  placeholder="e.g., TN09H5565"
                  value={newVehicleData.vehicle_number}
                  onChange={(e) => setNewVehicleData(prev => ({ ...prev, vehicle_number: e.target.value.toUpperCase() }))}
                  disabled={isCreatingVehicle}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new_vehicle_type">Vehicle Type *</Label>
                <Select
                  value={newVehicleData.vehicle_type}
                  onValueChange={(value) => setNewVehicleData(prev => ({ ...prev, vehicle_type: value }))}
                  disabled={isCreatingVehicle}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Truck">Truck</SelectItem>
                    <SelectItem value="Bus">Bus</SelectItem>
                    <SelectItem value="Heavy Machinery">Heavy Machinery</SelectItem>
                    <SelectItem value="Commercial Van">Commercial Van</SelectItem>
                    <SelectItem value="Trailer">Trailer</SelectItem>
                    <SelectItem value="Construction Equipment">Construction Equipment</SelectItem>
                    <SelectItem value="Agricultural Equipment">Agricultural Equipment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new_model">Model *</Label>
                <Input
                  id="new_model"
                  placeholder="e.g., Tata 407"
                  value={newVehicleData.model}
                  onChange={(e) => setNewVehicleData(prev => ({ ...prev, model: e.target.value }))}
                  disabled={isCreatingVehicle}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new_year">Year</Label>
                <Input
                  id="new_year"
                  type="number"
                  min="1990"
                  max={new Date().getFullYear() + 1}
                  value={newVehicleData.year}
                  onChange={(e) => setNewVehicleData(prev => ({ ...prev, year: parseInt(e.target.value) || new Date().getFullYear() }))}
                  disabled={isCreatingVehicle}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new_color">Color</Label>
                <Input
                  id="new_color"
                  placeholder="e.g., White"
                  value={newVehicleData.color}
                  onChange={(e) => setNewVehicleData(prev => ({ ...prev, color: e.target.value }))}
                  disabled={isCreatingVehicle}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new_vin">VIN / Chassis</Label>
                <Input
                  id="new_vin"
                  placeholder="Chassis Number"
                  value={newVehicleData.vin}
                  onChange={(e) => setNewVehicleData(prev => ({ ...prev, vin: e.target.value.toUpperCase() }))}
                  disabled={isCreatingVehicle}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_engine_number">Engine Number</Label>
              <Input
                id="new_engine_number"
                placeholder="Engine Serial Number"
                value={newVehicleData.engine_number}
                onChange={(e) => setNewVehicleData(prev => ({ ...prev, engine_number: e.target.value.toUpperCase() }))}
                disabled={isCreatingVehicle}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_kilometers">Current Odometer (KM)</Label>
              <Input
                id="new_kilometers"
                type="number"
                placeholder="e.g. 50000"
                value={newVehicleData.kilometers_driven || ''}
                onChange={(e) => setNewVehicleData(prev => ({ ...prev, kilometers_driven: parseInt(e.target.value) || 0 }))}
                disabled={isCreatingVehicle}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddVehicleDialog(false)}
                disabled={isCreatingVehicle}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreatingVehicle}>
                {isCreatingVehicle ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Registering...
                  </>
                ) : (
                  "Register Vehicle"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add New Customer + Vehicle Dialog */}
      <Dialog open={showAddCustomerDialog} onOpenChange={setShowAddCustomerDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Customer {includeVehicle ? '& Vehicle' : ''}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleCreateCustomer(); }} className="space-y-6">
            {/* Customer Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider border-b pb-2">
                Customer Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_name">Name *</Label>
                  <Input
                    id="customer_name"
                    placeholder="Customer name"
                    value={newCustomerData.name}
                    onChange={(e) => setNewCustomerData(prev => ({ ...prev, name: e.target.value }))}
                    disabled={isCreatingCustomer}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_phone">Phone *</Label>
                  <Input
                    id="customer_phone"
                    placeholder="Phone number"
                    value={newCustomerData.phone}
                    onChange={(e) => setNewCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                    disabled={isCreatingCustomer}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_email">Email</Label>
                  <Input
                    id="customer_email"
                    type="email"
                    placeholder="Email address"
                    value={newCustomerData.email}
                    onChange={(e) => setNewCustomerData(prev => ({ ...prev, email: e.target.value }))}
                    disabled={isCreatingCustomer}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_company">Company Name</Label>
                  <Input
                    id="customer_company"
                    placeholder="Company name (optional)"
                    value={newCustomerData.company_name}
                    onChange={(e) => setNewCustomerData(prev => ({ ...prev, company_name: e.target.value }))}
                    disabled={isCreatingCustomer}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_address">Address</Label>
                <Input
                  id="customer_address"
                  placeholder="Address (optional)"
                  value={newCustomerData.address}
                  onChange={(e) => setNewCustomerData(prev => ({ ...prev, address: e.target.value }))}
                  disabled={isCreatingCustomer}
                />
              </div>
            </div>

            {/* Include Vehicle Toggle */}
            <div className="flex items-center gap-2 pb-2 border-b">
              <Checkbox
                id="include_vehicle"
                checked={includeVehicle}
                onCheckedChange={(checked) => setIncludeVehicle(checked as boolean)}
                disabled={isCreatingCustomer}
              />
              <Label
                htmlFor="include_vehicle"
                className="text-sm font-medium cursor-pointer"
              >
                Include Vehicle Details
              </Label>
            </div>

            {/* Vehicle Section */}
            <div className={`space-y-4 ${includeVehicle ? '' : 'opacity-50 pointer-events-none'}`}>
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Vehicle Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cv_vehicle_number">Vehicle Number *</Label>
                  <Input
                    id="cv_vehicle_number"
                    placeholder="e.g., TN09H5565"
                    value={newCustomerVehicleData.vehicle_number}
                    onChange={(e) => setNewCustomerVehicleData(prev => ({ ...prev, vehicle_number: e.target.value.toUpperCase() }))}
                    disabled={isCreatingCustomer || !includeVehicle}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cv_vehicle_type">Vehicle Type *</Label>
                  <Select
                    value={newCustomerVehicleData.vehicle_type}
                    onValueChange={(value) => setNewCustomerVehicleData(prev => ({ ...prev, vehicle_type: value }))}
                    disabled={isCreatingCustomer || !includeVehicle}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Truck">Truck</SelectItem>
                      <SelectItem value="Bus">Bus</SelectItem>
                      <SelectItem value="Heavy Machinery">Heavy Machinery</SelectItem>
                      <SelectItem value="Commercial Van">Commercial Van</SelectItem>
                      <SelectItem value="Trailer">Trailer</SelectItem>
                      <SelectItem value="Construction Equipment">Construction Equipment</SelectItem>
                      <SelectItem value="Agricultural Equipment">Agricultural Equipment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cv_model">Model *</Label>
                  <Input
                    id="cv_model"
                    placeholder="e.g., Tata 407"
                    value={newCustomerVehicleData.model}
                    onChange={(e) => setNewCustomerVehicleData(prev => ({ ...prev, model: e.target.value }))}
                    disabled={isCreatingCustomer || !includeVehicle}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cv_year">Year</Label>
                  <Input
                    id="cv_year"
                    type="number"
                    min="1990"
                    max={new Date().getFullYear() + 1}
                    value={newCustomerVehicleData.year}
                    onChange={(e) => setNewCustomerVehicleData(prev => ({ ...prev, year: parseInt(e.target.value) || new Date().getFullYear() }))}
                    disabled={isCreatingCustomer || !includeVehicle}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cv_color">Color</Label>
                  <Input
                    id="cv_color"
                    placeholder="e.g., White"
                    value={newCustomerVehicleData.color}
                    onChange={(e) => setNewCustomerVehicleData(prev => ({ ...prev, color: e.target.value }))}
                    disabled={isCreatingCustomer || !includeVehicle}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cv_vin">VIN / Chassis</Label>
                  <Input
                    id="cv_vin"
                    placeholder="Chassis Number"
                    value={newCustomerVehicleData.vin}
                    onChange={(e) => setNewCustomerVehicleData(prev => ({ ...prev, vin: e.target.value.toUpperCase() }))}
                    disabled={isCreatingCustomer || !includeVehicle}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cv_engine_number">Engine Number</Label>
                <Input
                  id="cv_engine_number"
                  placeholder="Engine Serial Number"
                  value={newCustomerVehicleData.engine_number}
                  onChange={(e) => setNewCustomerVehicleData(prev => ({ ...prev, engine_number: e.target.value.toUpperCase() }))}
                  disabled={isCreatingCustomer || !includeVehicle}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddCustomerDialog(false)}
                disabled={isCreatingCustomer}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreatingCustomer}>
                {isCreatingCustomer ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    {includeVehicle ? 'Create Customer & Vehicle' : 'Create Customer'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
