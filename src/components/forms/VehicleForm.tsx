import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Combobox } from "@/components/ui/combobox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Loader2,
  Truck,
  Plus,
  Trash2,
  Car,
  Calendar,
  Gauge,
  FileText,
  CheckCircle2,
  X,
  Layers,
  Wrench,
  Camera,
  UserCheck
} from "lucide-react"
import { ImageDropzone } from "@/components/shared/ImageDropzone"
import { VehiclePlateBadge } from "@/components/shared/VehiclePlateBadge"
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
    if (!formData.customer_id || !formData.vehicle_number.trim() || !formData.model_id) {
      toast({
        title: "Required Fields Missing",
        description: "Please select Customer, enter Vehicle Number, and select Model.",
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
        vehicle_number: cleanFormData.vehicle_number.trim().toUpperCase(),
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

  const handleUploadVehiclePhotos = async (files: File[]) => {
    if (!files || files.length === 0) return;
    setIsLoading(true);
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop() || 'jpg';
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
  };

  const selectedCustomerObj = customers.find(c => c.id === formData.customer_id);

  return (
    <div className="w-full bg-background rounded-2xl overflow-hidden border border-border shadow-xl">
      {/* Premium Header */}
      <div className="p-6 bg-gradient-to-r from-card via-card to-muted/40 border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                {initialData ? 'Edit Vehicle Specifications' : 'Register New Vehicle'}
              </h2>
              {formData.vehicle_number && (
                <Badge variant="outline" className="font-mono text-xs font-bold uppercase tracking-wider">
                  {formData.vehicle_number}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {initialData
                ? 'Update registration details, odometer readings, and technical specs'
                : 'Enter registration number, assign fleet owner, technical specs, and photos'}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCancel}
          disabled={isLoading}
          className="self-end sm:self-center h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Section 1: Vehicle Identification & Indian Number Plate */}
        <div className="rounded-xl border border-border/80 bg-card/60 p-4 sm:p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-2 border-b border-border/60">
            <Car className="w-4 h-4 text-primary" />
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
              Registration & Ownership
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left 7 cols: Inputs */}
            <div className="lg:col-span-7 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="customer" className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                  <span>Customer / Fleet Owner</span>
                  <span className="text-[10px] text-destructive font-bold">Required</span>
                </Label>
                {loadingCustomers ? (
                  <div className="flex items-center gap-2 p-2.5 border rounded-lg text-xs text-muted-foreground bg-muted/20">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    Loading customers...
                  </div>
                ) : (
                  <Combobox
                    items={customers.map(c => ({
                      value: c.id,
                      label: `${c.name} ${c.company_name ? `(${c.company_name})` : ''}`
                    }))}
                    value={formData.customer_id}
                    onSelect={(val) => {
                      handleChange('customer_id', val);
                      handleChange('primary_contact_id', '');
                    }}
                    placeholder="Search & select owner..."
                    searchPlaceholder="Type customer or company name..."
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vehicle_number" className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                  <span>Vehicle Registration Number</span>
                  <span className="text-[10px] text-destructive font-bold">Required</span>
                </Label>
                <div className="relative">
                  <Car className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="vehicle_number"
                    placeholder="e.g. TN01AB1234 or KL07CD5678"
                    value={formData.vehicle_number}
                    onChange={(e) => handleChange('vehicle_number', e.target.value.toUpperCase().replace(/\s+/g, ''))}
                    disabled={isLoading}
                    className="pl-9 text-sm font-mono uppercase font-bold tracking-wider"
                    required
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Standard Indian vehicle registration format</p>
              </div>

              {/* Assigned Contact Person for this Vehicle */}
              {formData.customer_id && customerContacts.length > 0 && (
                <div className="space-y-1.5 p-3 rounded-lg border border-border/80 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="primary_contact" className="text-xs font-semibold flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-primary" />
                      Assigned Point of Contact
                    </Label>
                    <span className="text-[10px] text-muted-foreground">
                      Service updates & alerts
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
                          {ct.name} ({ct.designation || "Contact"}) • {ct.phone} {ct.is_primary ? "[Primary]" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Right 5 cols: Live License Plate Preview */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center p-5 rounded-xl border border-dashed border-border/80 bg-muted/20 min-h-[160px] text-center">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">
                Live License Plate Preview
              </span>
              <div className="transform scale-110 sm:scale-125 transition-transform duration-200">
                <VehiclePlateBadge
                  plateNumber={formData.vehicle_number || "REG NUMBER"}
                  size="lg"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-4">
                {selectedCustomerObj ? `Registered to: ${selectedCustomerObj.name}` : 'Select a customer to link vehicle'}
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Technical Specifications & Model */}
        <div className="rounded-xl border border-border/80 bg-card/60 p-4 sm:p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-2 border-b border-border/60">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
              Make, Model & Classification
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Manufacturer */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground/90">Manufacturer</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1 text-[11px] text-primary hover:bg-primary/10"
                  onClick={() => { setMasterType('Manufacturer'); setShowAddMasterDialog(true); }}
                >
                  <Plus className="h-3 w-3 mr-0.5" /> New
                </Button>
              </div>
              <Combobox
                items={manufacturers.map(m => ({ value: m.id, label: m.name }))}
                value={formData.manufacturer_id}
                onSelect={(val) => handleChange('manufacturer_id', val)}
                onCreate={(name) => { setMasterType('Manufacturer'); setMasterName(name); setShowAddMasterDialog(true); }}
                placeholder="e.g. Tata, Ashok Leyland"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground/90">Category</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1 text-[11px] text-primary hover:bg-primary/10"
                  onClick={() => { setMasterType('Category'); setShowAddMasterDialog(true); }}
                >
                  <Plus className="h-3 w-3 mr-0.5" /> New
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
                placeholder="e.g. Commercial, Heavy"
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground/90">Vehicle Type</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1 text-[11px] text-primary hover:bg-primary/10"
                  onClick={() => { setMasterType('Type'); setShowAddMasterDialog(true); }}
                  disabled={!formData.category_id}
                >
                  <Plus className="h-3 w-3 mr-0.5" /> New
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
                placeholder="e.g. Tipper, Bus, Truck"
                disabled={!formData.category_id}
              />
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                  <span>Model</span>
                  <span className="text-[10px] text-destructive font-bold ml-1">Required</span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1 text-[11px] text-primary hover:bg-primary/10"
                  onClick={() => { setMasterType('Model'); setShowAddMasterDialog(true); }}
                  disabled={!formData.manufacturer_id}
                >
                  <Plus className="h-3 w-3 mr-0.5" /> New
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
                placeholder="e.g. Signa 4825.TK"
                disabled={!formData.manufacturer_id}
              />
            </div>

            {/* Model Year */}
            <div className="space-y-1.5">
              <Label htmlFor="year" className="text-xs font-semibold text-foreground/90">Manufacturing Year</Label>
              <Input
                id="year"
                type="number"
                min="1990"
                max={new Date().getFullYear() + 1}
                value={formData.year}
                onChange={(e) => handleChange('year', parseInt(e.target.value) || new Date().getFullYear())}
                disabled={isLoading}
                className="text-sm font-mono"
              />
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <Label htmlFor="color" className="text-xs font-semibold text-foreground/90">Body Color</Label>
              <Input
                id="color"
                placeholder="e.g. Royal Blue, White"
                value={formData.color}
                onChange={(e) => handleChange('color', e.target.value)}
                disabled={isLoading}
                className="text-sm"
              />
            </div>

            {/* VIN / Chassis Number */}
            <div className="space-y-1.5">
              <Label htmlFor="vin" className="text-xs font-semibold text-foreground/90">Chassis / VIN</Label>
              <Input
                id="vin"
                placeholder="e.g. MAT445012A..."
                value={formData.vin}
                onChange={(e) => handleChange('vin', e.target.value.toUpperCase())}
                disabled={isLoading}
                className="text-sm font-mono uppercase"
              />
            </div>

            {/* Engine Number */}
            <div className="space-y-1.5">
              <Label htmlFor="engine_number" className="text-xs font-semibold text-foreground/90">Engine Number</Label>
              <Input
                id="engine_number"
                placeholder="e.g. 497TC72..."
                value={formData.engine_number}
                onChange={(e) => handleChange('engine_number', e.target.value.toUpperCase())}
                disabled={isLoading}
                className="text-sm font-mono uppercase"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Odometer & Service Lifecycle Tracking */}
        <div className="rounded-xl border border-border/80 bg-card/60 p-4 sm:p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-2 border-b border-border/60">
            <Gauge className="w-4 h-4 text-primary" />
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
              Odometer & Preventive Maintenance
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="kilometers_driven" className="text-xs font-semibold text-foreground/90">
                Current Odometer (KM)
              </Label>
              <div className="relative">
                <Gauge className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="kilometers_driven"
                  type="number"
                  placeholder="e.g. 45000"
                  value={formData.kilometers_driven}
                  onChange={(e) => handleChange('kilometers_driven', parseInt(e.target.value) || 0)}
                  disabled={isLoading}
                  className="pl-9 text-sm font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="next_service_km" className="text-xs font-semibold text-foreground/90">
                Next Service Threshold (KM)
              </Label>
              <div className="relative">
                <Wrench className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="next_service_km"
                  type="number"
                  placeholder="e.g. 50000"
                  value={formData.next_service_km}
                  onChange={(e) => handleChange('next_service_km', parseInt(e.target.value) || 0)}
                  disabled={isLoading}
                  className="pl-9 text-sm font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="next_service_date" className="text-xs font-semibold text-foreground/90">
                Next Service Due Date
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="next_service_date"
                  type="date"
                  value={formData.next_service_date}
                  onChange={(e) => handleChange('next_service_date', e.target.value)}
                  disabled={isLoading}
                  className="pl-9 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Vehicle Photos */}
        <div className="rounded-xl border border-border/80 bg-card/60 p-4 sm:p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" />
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
                Vehicle Inspection Photos
              </h3>
            </div>
            <Badge variant="secondary" className="text-[11px] font-semibold">
              {formData.photos.length} photo(s)
            </Badge>
          </div>

          {/* Photo Gallery Grid */}
          {formData.photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 mb-3">
              {formData.photos.map((url, index) => (
                <div key={index} className="relative group aspect-[4/3] rounded-lg overflow-hidden border border-border/80 bg-muted/30 shadow-sm">
                  <img src={url} alt={`Vehicle ${index + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 backdrop-blur-[2px]">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs shadow-md"
                      onClick={() => {
                        const newPhotos = [...formData.photos];
                        newPhotos.splice(index, 1);
                        setFormData({ ...formData, photos: newPhotos });
                      }}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Dropzone */}
          <ImageDropzone
            compact={formData.photos.length > 0}
            onDropFiles={handleUploadVehiclePhotos}
            disabled={isLoading}
            title={formData.photos.length === 0 ? "Drag & drop vehicle photos here" : "Add more vehicle photos"}
            subtitle="JPG, PNG, WEBP files supported (multi-upload allowed)"
          />
        </div>

        {/* Section 5: Workshop Notes */}
        <div className="rounded-xl border border-border/80 bg-card/60 p-4 sm:p-5 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 pb-2 border-b border-border/60">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
              Fleet & Workshop Notes
            </h3>
          </div>
          <Input
            id="notes"
            placeholder="Special handling, maintenance contract, or vehicle observations..."
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            disabled={isLoading}
            className="text-sm"
          />
        </div>

        {/* Action Controls */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="w-full sm:w-auto text-xs font-semibold"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full sm:w-auto text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {initialData ? 'Updating Vehicle...' : 'Registering Vehicle...'}
              </>
            ) : (
              <>
                {initialData ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                {initialData ? 'Update Vehicle Specs' : 'Register Vehicle to Fleet'}
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Add Master Data Dialog */}
      <Dialog open={showAddMasterDialog} onOpenChange={setShowAddMasterDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New {masterType}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={masterName}
              onChange={(e) => setMasterName(e.target.value)}
              placeholder={`Enter ${masterType} name`}
              className="text-sm"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAddMasterDialog(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
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
                setMasterName("");
                setShowAddMasterDialog(false);
                setIsAddingMaster(false);
              }}
              disabled={isAddingMaster || !masterName.trim()}
            >
              {isAddingMaster ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}