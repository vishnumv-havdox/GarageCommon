import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Combobox } from "@/components/ui/combobox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Truck, Plus, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

interface Customer {
  id: string
  name: string
  company_name?: string
}

interface Vehicle {
  id: string
  customer_id: string
  vehicle_number: string
  manufacturer_id?: string
  category_id?: string
  vehicle_type_id?: string
  model_id: string
  year: number
  color?: string
  vin?: string
  engine_number?: string
  notes?: string
  kilometers_driven?: number
  next_service_km?: number
  next_service_date?: string
  primary_contact_id?: string
  vehicle_type?: string // legacy
  model?: string // legacy
  photo_url?: string // legacy
  photos?: string[]
}

interface Manufacturer { id: string; name: string }
interface Category { id: string; name: string }
interface VehicleType { id: string; name: string; category_id: string }
interface VehicleModel { id: string; name: string; manufacturer_id: string; vehicle_type_id: string }

interface VehicleFormProps {
  onSuccess: () => void
  onCancel: () => void
  initialData?: Vehicle
}

export function VehicleForm({ onSuccess, onCancel, initialData }: VehicleFormProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerContacts, setCustomerContacts] = useState<any[]>([])
  const [formData, setFormData] = useState({
    customer_id: initialData?.customer_id || "",
    primary_contact_id: (initialData as any)?.primary_contact_id || "",
    vehicle_number: initialData?.vehicle_number || "",
    manufacturer_id: initialData?.manufacturer_id || (initialData as any)?.vehicle_models?.manufacturer_id || "",
    category_id: initialData?.category_id || (initialData as any)?.vehicle_models?.vehicle_types?.category_id || "",
    vehicle_type_id: initialData?.vehicle_type_id || (initialData as any)?.vehicle_models?.vehicle_type_id || "",
    model_id: initialData?.model_id || "",
    year: initialData?.year || new Date().getFullYear(),
    color: initialData?.color || "",
    vin: initialData?.vin || "",
    engine_number: initialData?.engine_number || "",
    notes: initialData?.notes || "",
    kilometers_driven: initialData?.kilometers_driven || 0,
    next_service_km: initialData?.next_service_km || 0,
    next_service_date: initialData?.next_service_date || "",
    photos: initialData?.photos || (initialData?.photo_url ? [initialData.photo_url] : [])
  })

  // Load customer contacts when selected customer changes
  useEffect(() => {
    if (formData.customer_id) {
      supabase
        .from('customer_contacts')
        .select('id, name, designation, phone, is_primary')
        .eq('customer_id', formData.customer_id)
        .order('is_primary', { ascending: false })
        .then(({ data }) => {
          setCustomerContacts(data || []);
        });
    } else {
      setCustomerContacts([]);
    }
  }, [formData.customer_id])

  // Normalized catalogs
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [vehicleModels, setVehicleModels] = useState<VehicleModel[]>([])

  // Master Data State
  const [showAddMasterDialog, setShowAddMasterDialog] = useState(false)
  const [masterType, setMasterType] = useState<'Manufacturer' | 'Category' | 'Type' | 'Model'>('Manufacturer')
  const [masterName, setMasterName] = useState("")
  const [isAddingMaster, setIsAddingMaster] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchCustomers();
    fetchCatalogs();
  }, [])

  const fetchCatalogs = async () => {
    try {
      const [mRes, cRes, tRes, moRes] = await Promise.all([
        supabase.from('vehicle_manufacturers').select('*').order('name'),
        supabase.from('vehicle_categories').select('*').order('name'),
        supabase.from('vehicle_types').select('*').order('name'),
        supabase.from('vehicle_models').select('*').order('name')
      ]);
      if (mRes.data) setManufacturers(mRes.data);
      if (cRes.data) setCategories(cRes.data);
      if (tRes.data) setVehicleTypes(tRes.data);
      if (moRes.data) setVehicleModels(moRes.data);
    } catch (e) {
      console.error("Error fetching catalogs:", e);
    }
  }

  const availableTypes = useMemo(() => {
    return vehicleTypes.filter(t => !formData.category_id || t.category_id === formData.category_id)
  }, [vehicleTypes, formData.category_id])

  const availableModels = useMemo(() => {
    return vehicleModels.filter(m => !formData.manufacturer_id || m.manufacturer_id === formData.manufacturer_id)
  }, [vehicleModels, formData.manufacturer_id])

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
    if (!formData.customer_id || !formData.vehicle_number || !formData.model_id) {
      toast({
        title: "Error",
        description: "Please fill in all required fields (Customer, Vehicle Number, Model)",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      // Strip UI-only fields that are not in the vehicles table
      const { manufacturer_id, category_id, vehicle_type_id, ...cleanFormData } = formData;

      const payload = {
        ...cleanFormData,
        primary_contact_id: cleanFormData.primary_contact_id || null,
        next_service_date: formData.next_service_date || null,
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

  const handleCreateManufacturerData = async (name: string) => {
    try {
      const { data, error } = await supabase.from('vehicle_manufacturers').insert({ name }).select().single()
      if (error) throw error
      setManufacturers(prev => [...prev, data as Manufacturer].sort((a, b) => a.name.localeCompare(b.name)))
      return data.id
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleCreateCategoryData = async (name: string) => {
    try {
      const { data, error } = await supabase.from('vehicle_categories').insert({ name }).select().single()
      if (error) throw error
      setCategories(prev => [...prev, data as Category].sort((a, b) => a.name.localeCompare(b.name)))
      return data.id
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleCreateTypeData = async (name: string, categoryId: string) => {
    try {
      const { data, error } = await supabase.from('vehicle_types').insert({ name, category_id: categoryId }).select().single()
      if (error) throw error
      setVehicleTypes(prev => [...prev, data as VehicleType].sort((a, b) => a.name.localeCompare(b.name)))
      return data.id
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleCreateModelData = async (name: string, mfrId: string, typeId: string) => {
    try {
      const { data, error } = await supabase.from('vehicle_models').insert({ name, manufacturer_id: mfrId, vehicle_type_id: typeId }).select().single()
      if (error) throw error
      setVehicleModels(prev => [...prev, data as VehicleModel].sort((a, b) => a.name.localeCompare(b.name)))
      return data.id
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

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
              <Combobox
                items={customers.map(c => ({ value: c.id, label: `${c.name} ${c.company_name ? `(${c.company_name})` : ''}` }))}
                value={formData.customer_id}
                onSelect={(val) => {
                  handleChange('customer_id', val);
                  handleChange('primary_contact_id', '');
                }}
                placeholder="Select customer"
                searchPlaceholder="Search customers..."
              />
            )}
          </div>

          {/* Assigned Contact Person for this Vehicle */}
          {formData.customer_id && customerContacts.length > 0 && (
            <div className="space-y-1.5 p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between">
                <Label htmlFor="primary_contact" className="text-xs font-semibold">
                  Assigned Contact Person (Optional)
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  Person to contact for service updates & reminders
                </span>
              </div>
              <Select
                value={formData.primary_contact_id || "none"}
                onValueChange={(val) => handleChange('primary_contact_id', val === "none" ? "" : val)}
              >
                <SelectTrigger id="primary_contact" className="h-9 text-xs">
                  <SelectValue placeholder="Select contact person..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default Company Phone / No Specific Contact</SelectItem>
                  {customerContacts.map((ct) => (
                    <SelectItem key={ct.id} value={ct.id}>
                      {ct.name} ({ct.designation || "Contact"}) • {ct.phone} {ct.is_primary ? "★ Primary" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-3 rounded-md bg-muted/20">
            {/* Vehicle Photos Upload */}
            <div className="md:col-span-2 space-y-2 pb-2">
              <div className="flex items-center justify-between">
                  <Label>Vehicle Photos</Label>
                  <span className="text-xs text-muted-foreground">{formData.photos.length} uploaded</span>
              </div>
              <div className="p-4 border rounded-lg bg-muted/50">
                  {/* Photo Gallery Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
                      {formData.photos.map((url, index) => (
                          <div key={index} className="relative group aspect-[4/3] rounded overflow-hidden border shadow-sm bg-white">
                              <img src={url} alt={`Vehicle ${index + 1}`} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                  <Button 
                                      type="button"
                                      variant="destructive" 
                                      size="sm" 
                                      className="h-8 shadow-lg"
                                      onClick={() => {
                                          const newPhotos = [...formData.photos];
                                          newPhotos.splice(index, 1);
                                          setFormData({ ...formData, photos: newPhotos });
                                      }}
                                  >
                                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                                  </Button>
                              </div>
                          </div>
                      ))}
                      {/* Empty Placeholder if no photos */}
                      {formData.photos.length === 0 && (
                          <div className="aspect-[4/3] col-span-full sm:col-span-3 md:col-span-4 flex flex-col items-center justify-center border-2 border-dashed rounded bg-muted/50 text-muted-foreground">
                              <Truck className="h-10 w-10 mb-2 opacity-50" />
                              <p className="text-sm font-medium">No photos uploaded</p>
                          </div>
                      )}
                  </div>

                  {/* Upload Input */}
                  <div className="flex items-center gap-4">
                      <Input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={async (e) => {
                              const files = e.target.files;
                              if (!files || files.length === 0) return;
                              setIsLoading(true);
                              try {
                                  const uploadedUrls: string[] = [];
                                  // Upload files sequentially to avoid hitting storage rate limits
                                  for (let i = 0; i < files.length; i++) {
                                      const file = files[i];
                                      const fileExt = file.name.split('.').pop();
                                      const fileName = `vehicle-${Date.now()}-${i}.${fileExt}`;
                                      const { error: uploadError } = await supabase.storage
                                          .from('public-assets')
                                          .upload(fileName, file);
                                      if (uploadError) throw uploadError;
                                      const { data: { publicUrl } } = supabase.storage
                                          .from('public-assets')
                                          .getPublicUrl(fileName);
                                      uploadedUrls.push(publicUrl);
                                  }
                                  setFormData(prev => ({ ...prev, photos: [...prev.photos, ...uploadedUrls] }));
                                  toast({ title: `${uploadedUrls.length} Photo(s) Uploaded` });
                              } catch (error: any) {
                                  toast({ variant: "destructive", title: "Upload Failed", description: error.message });
                              } finally {
                                  setIsLoading(false);
                              }
                          }}
                          disabled={isLoading}
                          className="flex-1 cursor-pointer bg-background"
                      />
                      <p className="text-[10px] text-muted-foreground hidden sm:block whitespace-nowrap">You can select multiple files.</p>
                  </div>
              </div>
            </div>

            {/* Manufacturer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Manufacturer *</Label>
                <Button
                  type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-primary/10"
                  onClick={() => { setMasterType('Manufacturer'); setShowAddMasterDialog(true); }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <Combobox
                items={manufacturers.map(m => ({ value: m.id, label: m.name }))}
                value={formData.manufacturer_id}
                onSelect={(val) => handleChange('manufacturer_id', val)}
                onCreate={(name) => { setMasterType('Manufacturer'); setMasterName(name); setShowAddMasterDialog(true); }}
                placeholder="Select Manufacturer"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Category *</Label>
                <Button
                  type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-primary/10"
                  onClick={() => { setMasterType('Category'); setShowAddMasterDialog(true); }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <Combobox
                items={categories.map(c => ({ value: c.id, label: c.name }))}
                value={formData.category_id}
                onSelect={(val) => {
                  handleChange('category_id', val);
                  handleChange('vehicle_type_id', "");
                  handleChange('model_id', "");
                }}
                onCreate={(name) => { setMasterType('Category'); setMasterName(name); setShowAddMasterDialog(true); }}
                placeholder="Select Category"
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Vehicle Type *</Label>
                <Button
                  type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-primary/10"
                  onClick={() => { setMasterType('Type'); setShowAddMasterDialog(true); }}
                  disabled={!formData.category_id}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <Combobox
                items={availableTypes.map(t => ({ value: t.id, label: t.name }))}
                value={formData.vehicle_type_id}
                onSelect={(val) => {
                  handleChange('vehicle_type_id', val);
                  handleChange('model_id', "");
                }}
                onCreate={(name) => { setMasterType('Type'); setMasterName(name); setShowAddMasterDialog(true); }}
                placeholder="Select Type"
                disabled={!formData.category_id}
              />
            </div>

            {/* Model */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Model *</Label>
                <Button
                  type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-primary/10"
                  onClick={() => { setMasterType('Model'); setShowAddMasterDialog(true); }}
                  disabled={!formData.manufacturer_id}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <Combobox
                items={availableModels.map(m => ({ value: m.id, label: m.name }))}
                value={formData.model_id}
                onSelect={(val) => {
                  const model = vehicleModels.find(m => m.id === val);
                  if (model) {
                    const type = vehicleTypes.find(t => t.id === model.vehicle_type_id);
                    setFormData(prev => ({
                      ...prev,
                      model_id: val,
                      vehicle_type_id: model.vehicle_type_id,
                      category_id: type?.category_id || prev.category_id
                    }));
                  } else {
                    handleChange('model_id', val);
                  }
                }}
                onCreate={(name) => { setMasterType('Model'); setMasterName(name); setShowAddMasterDialog(true); }}
                placeholder="Select Model"
                disabled={!formData.manufacturer_id}
              />
            </div>
          </div >

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
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
        </form >
      </CardContent >

      {/* Add Master Data Dialog */}
      < Dialog open={showAddMasterDialog} onOpenChange={setShowAddMasterDialog} >
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add New {masterType}</DialogTitle></DialogHeader>
          <div className="py-4"><Input value={masterName} onChange={(e) => setMasterName(e.target.value)} placeholder={`Enter ${masterType} name`} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMasterDialog(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!masterName.trim()) return;
                setIsAddingMaster(true);
                let newId = "";
                if (masterType === 'Manufacturer') newId = await handleCreateManufacturerData(masterName.trim()) || "";
                if (masterType === 'Category') newId = await handleCreateCategoryData(masterName.trim()) || "";
                if (masterType === 'Type') newId = await handleCreateTypeData(masterName.trim(), formData.category_id) || "";
                if (masterType === 'Model') newId = await handleCreateModelData(masterName.trim(), formData.manufacturer_id, formData.vehicle_type_id) || "";

                if (newId) {
                  if (masterType === 'Manufacturer') handleChange('manufacturer_id', newId);
                  if (masterType === 'Category') handleChange('category_id', newId);
                  if (masterType === 'Type') handleChange('vehicle_type_id', newId);
                  if (masterType === 'Model') handleChange('model_id', newId);
                }
                setMasterName(""); setShowAddMasterDialog(false); setIsAddingMaster(false);
              }}
              disabled={isAddingMaster || !masterName.trim()}
            >
              {isAddingMaster ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >
    </Card >
  )
}