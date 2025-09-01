import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Wrench } from "lucide-react"

interface Vehicle {
  id: string
  vehicle_number: string
  model: string
  customer_name: string
}

interface WorkOrderFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function WorkOrderForm({ onSuccess, onCancel }: WorkOrderFormProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [formData, setFormData] = useState({
    vehicle_id: "",
    service_type: "",
    description: "",
    estimated_cost: 0
  })
  const [isLoading, setIsLoading] = useState(false)
  const [loadingVehicles, setLoadingVehicles] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchVehicles()
  }, [])

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          id,
          vehicle_number,
          model,
          customers!inner(name)
        `)
        .eq('current_status', 'Inspection')

      if (error) {
        toast({
          title: "Error",
          description: "Failed to load vehicles",
          variant: "destructive",
        })
      } else {
        const formattedData = data?.map(vehicle => ({
          id: vehicle.id,
          vehicle_number: vehicle.vehicle_number,
          model: vehicle.model,
          customer_name: (vehicle.customers as any).name
        })) || []
        setVehicles(formattedData)
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error)
    } finally {
      setLoadingVehicles(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.vehicle_id || !formData.service_type || !formData.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const { error } = await supabase
        .from('work_orders')
        .insert([{
          ...formData,
          status: 'Pending',
          start_date: new Date().toISOString()
        }])

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        })
      } else {
        // Update vehicle status
        await supabase
          .from('vehicles')
          .update({ current_status: 'In Progress' })
          .eq('id', formData.vehicle_id)

        toast({
          title: "Success",
          description: "Work order created successfully",
        })
        onSuccess()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const serviceTypes = [
    "Mechanical Repair",
    "Body Building",
    "Painting",
    "Electrical Work",
    "Tinker Work",
    "Engine Overhaul",
    "Transmission Repair",
    "Brake System",
    "Suspension Work",
    "Air Conditioning",
    "Custom Modification"
  ]

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="w-5 h-5" />
          Create Work Order
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vehicle">Vehicle *</Label>
            {loadingVehicles ? (
              <div className="flex items-center gap-2 p-3 border rounded-md">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading vehicles...
              </div>
            ) : (
              <Select value={formData.vehicle_id} onValueChange={(value) => handleChange('vehicle_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.vehicle_number} - {vehicle.model} ({vehicle.customer_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service_type">Service Type *</Label>
              <Select value={formData.service_type} onValueChange={(value) => handleChange('service_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimated_cost">Estimated Cost (₹)</Label>
              <Input
                id="estimated_cost"
                type="number"
                min="0"
                step="100"
                placeholder="Enter estimated cost"
                value={formData.estimated_cost}
                onChange={(e) => handleChange('estimated_cost', parseFloat(e.target.value) || 0)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Service Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe the work to be performed..."
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              disabled={isLoading}
              rows={4}
            />
          </div>

          <div className="flex gap-2 justify-end">
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
                  Creating...
                </>
              ) : (
                "Create Work Order"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}