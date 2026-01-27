import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Truck } from "lucide-react"

interface Customer {
  id: string
  name: string
  company_name?: string
}

interface Vehicle {
  id: string
  customer_id: string
  vehicle_number: string
  vehicle_type: string
  model: string
  year: number
  color?: string
  vin?: string
  engine_number?: string
  notes?: string
  kilometers_driven?: number
  next_service_km?: number
  next_service_date?: string
}

interface VehicleFormProps {
  onSuccess: () => void
  onCancel: () => void
  initialData?: Vehicle
}

export function VehicleForm({ onSuccess, onCancel, initialData }: VehicleFormProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [formData, setFormData] = useState({
    customer_id: initialData?.customer_id || "",
    vehicle_number: initialData?.vehicle_number || "",
    vehicle_type: initialData?.vehicle_type || "",
    model: initialData?.model || "",
    year: initialData?.year || new Date().getFullYear(),
    color: initialData?.color || "",
    vin: initialData?.vin || "",
    engine_number: initialData?.engine_number || "",
    notes: initialData?.notes || "",
    kilometers_driven: initialData?.kilometers_driven || 0,
    next_service_km: initialData?.next_service_km || 0,
    next_service_date: initialData?.next_service_date || ""
  })
  const [isLoading, setIsLoading] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, company_name')
        .order('name')

      if (error) {
        toast({
          title: "Error",
          description: "Failed to load customers",
          variant: "destructive",
        })
      } else {
        setCustomers(data || [])
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoadingCustomers(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.customer_id || !formData.vehicle_number || !formData.vehicle_type || !formData.model) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const payload = {
        ...formData,
        // Ensure optional number fields are null if 0 or empty for cleaner DB (optional preference, but 0 is fine too)
        // For dates, empty string should be null
        next_service_date: formData.next_service_date || null,
        // Only set default status for new vehicles
        ...(initialData ? {} : { status: 'active', entry_date: new Date().toISOString() })
      }

      let error;

      if (initialData) {
        const { error: updateError } = await supabase
          .from('vehicles')
          .update(payload)
          .eq('id', initialData.id)
        error = updateError
      } else {
        const { error: insertError } = await supabase
          .from('vehicles')
          .insert([payload])
        error = insertError
      }

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Success",
          description: `Vehicle ${initialData ? 'updated' : 'registered'} successfully`,
        })
        onSuccess()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const vehicleTypes = [
    "Truck",
    "Bus",
    "Heavy Machinery",
    "Commercial Van",
    "Trailer",
    "Construction Equipment",
    "Agricultural Equipment"
  ]

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="w-5 h-5" />
          {initialData ? 'Edit Vehicle' : 'Register New Vehicle'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer">Customer *</Label>
            {loadingCustomers ? (
              <div className="flex items-center gap-2 p-3 border rounded-md">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading customers...
              </div>
            ) : (
              <Select value={formData.customer_id} onValueChange={(value) => handleChange('customer_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} {customer.company_name && `(${customer.company_name})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle_number">Vehicle Number *</Label>
              <Input
                id="vehicle_number"
                placeholder="e.g., TN01AB1234"
                value={formData.vehicle_number}
                onChange={(e) => handleChange('vehicle_number', e.target.value.toUpperCase())}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle_type">Vehicle Type *</Label>
              <Select value={formData.vehicle_type} onValueChange={(value) => handleChange('vehicle_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle type" />
                </SelectTrigger>
                <SelectContent>
                  {vehicleTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model *</Label>
              <Input
                id="model"
                placeholder="e.g., Tata 407, Ashok Leyland"
                value={formData.model}
                onChange={(e) => handleChange('model', e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                min="1990"
                max={new Date().getFullYear() + 1}
                value={formData.year}
                onChange={(e) => handleChange('year', parseInt(e.target.value))}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                placeholder="e.g., White"
                value={formData.color}
                onChange={(e) => handleChange('color', e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vin">VIN / Chassis Number</Label>
              <Input
                id="vin"
                placeholder="e.g., MAT..."
                value={formData.vin}
                onChange={(e) => handleChange('vin', e.target.value.toUpperCase())}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="engine_number">Engine Number</Label>
              <Input
                id="engine_number"
                placeholder="e.g., 497..."
                value={formData.engine_number}
                onChange={(e) => handleChange('engine_number', e.target.value.toUpperCase())}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="kilometers_driven">Kilometers Driven</Label>
              <Input
                id="kilometers_driven"
                type="number"
                placeholder="e.g., 50000"
                value={formData.kilometers_driven}
                onChange={(e) => handleChange('kilometers_driven', parseInt(e.target.value))}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next_service_km">Next Service @ KM</Label>
              <Input
                id="next_service_km"
                type="number"
                placeholder="e.g., 55000"
                value={formData.next_service_km}
                onChange={(e) => handleChange('next_service_km', parseInt(e.target.value))}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next_service_date">Next Service Date</Label>
              <Input
                id="next_service_date"
                type="date"
                value={formData.next_service_date}
                onChange={(e) => handleChange('next_service_date', e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              placeholder="Any additional information..."
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {initialData ? 'Updating...' : 'Registering...'}
                </>
              ) : (
                initialData ? 'Update Vehicle' : 'Register Vehicle'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}