// @ts-nocheck
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { validateIndianPhoneNumber } from "@/lib/phoneValidation";
import { checkDuplicatePhone, DuplicatePhoneResult } from "@/lib/duplicatePhoneCheck";
import { DuplicatePhoneDialog } from "@/components/shared/DuplicatePhoneDialog";
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
import { Loader2, Wrench, Search, ChevronDown, ChevronRight, Plus, IndianRupee, Layers, Edit, Trash2, Activity, Settings, ClipboardList, User, Camera, Upload as UploadIcon, X, Package, CheckCircle2 } from "lucide-react"
import { ServiceSection, ServiceSectionData } from "@/components/work-orders/ServiceSection"
import { TaskItem, TaskTemplate } from "@/components/work-orders/TaskSelector"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Clock } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { calculateServicePrice, checkServiceApplicability } from "@/utils/pricingEngine"

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
  next_service_date?: string
  primary_contact_id?: string
  vehicle_type_name?: string
  vehicle_category_name?: string
  manufacturer_name?: string
  vehicle_type_id?: string
  vehicle_category_id?: string
  model_id?: string
  manufacturer_id?: string
}

interface Employee {
  id: string
  name: string
  email: string
  position_id: string
  access_level: string
  status: string
}

interface Manufacturer {
  id: string
  name: string
}

interface Category {
  id: string
  name: string
}

interface VehicleType {
  id: string
  name: string
  category_id: string
}

interface VehicleModel {
  id: string
  name: string
  manufacturer_id: string
  vehicle_type_id: string
}

interface WorkOrderPhoto {
  id?: string;
  file?: File;
  previewUrl: string;
  photo_type: 'arrival' | 'issue_area';
  description: string;
}

interface BelongingItem {
  id?: string;
  name: string;
  description: string;
  file?: File;
  previewUrl: string;
}

interface WorkOrderFormProps {
  onSuccess: () => void
  onCancel: () => void
  initialWorkOrderId?: string
  isReopening?: boolean
  reopenReason?: string
  initialData?: {
    customerId?: string
    vehicleId?: string
    serviceType?: string // Name of service
    description?: string
    serviceIds?: string[] // IDs of catalog items (not used directly unless mapped to service types)
    serviceTypeNames?: string[] // Names of service types to select
    requestedServices?: string[] // Original services requested by customer
  }
}

export function WorkOrderForm({
  onSuccess,
  onCancel,
  initialWorkOrderId,
  isReopening = false,
  reopenReason = "",
  initialData
}: WorkOrderFormProps) {
  const { toast } = useToast()

  const arrivalCaptureRef = useRef<HTMLInputElement>(null);
  const arrivalUploadRef = useRef<HTMLInputElement>(null);
  const issueCaptureRef = useRef<HTMLInputElement>(null);
  const issueUploadRef = useRef<HTMLInputElement>(null);

  const arrivalCaptureId = `arrival-capture-${initialWorkOrderId || 'new'}`;
  const arrivalUploadId = `arrival-upload-${initialWorkOrderId || 'new'}`;
  const issueCaptureId = `issue-capture-${initialWorkOrderId || 'new'}`;
  const issueUploadId = `issue-upload-${initialWorkOrderId || 'new'}`;

  // Basic data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  // Dynamic Service Types
  interface DBServiceType {
    id: string;
    name: string;
    category?: string;
    base_price?: number;
    required_fields?: string[];
    is_fc_exclusive?: boolean; // Added for FC Work flow
  }
  const [dbServiceTypes, setDbServiceTypes] = useState<DBServiceType[]>([])
  const [isFCWork, setIsFCWork] = useState(false) // Toggle state for FC Work
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([])

  interface PricingRule {
    id: string;
    task_template_id: string;
    vehicle_category_id: string;
    modifier_type: string;
    modifier_value: number;
    is_active: boolean;
  }
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([])

  const [newServiceName, setNewServiceName] = useState("")
  const [newServiceCategory, setNewServiceCategory] = useState("Mechanical")
  const [serviceCategories, setServiceCategories] = useState<{ id: string, name: string }[]>([])
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
  const [isLoadingExisting, setIsLoadingExisting] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)

  // Search states
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [vehicleSearchOpen, setVehicleSearchOpen] = useState(false)
  const [customerSearch, setCustomerSearch] = useState("")
  const [vehicleSearch, setVehicleSearch] = useState("")

  // Form state
  const [customerId, setCustomerId] = useState("")
  const [vehicleId, setVehicleId] = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const [priority, setPriority] = useState("Medium")

  const [generalDescription, setGeneralDescription] = useState("")
  const [internalReopenReason, setInternalReopenReason] = useState(reopenReason)
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState<Date | undefined>(undefined)
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState("18:00")

  // Company Contacts for this work order
  const [companyContacts, setCompanyContacts] = useState<any[]>([])
  const [contactId, setContactId] = useState<string>("")

  const [lifecycleData, setLifecycleData] = useState({
    odometer_reading: 0,
    next_service_due_km: 0,
    next_service_due_date: "",
    service_notes: "",
    is_fc_renewal: false
  })

  // Driver state
  interface Driver {
    id: string;
    name: string;
    contact_number?: string;
    driver_position?: string;
  }
  const [driverSuggestions, setDriverSuggestions] = useState<Driver[]>([])
  const [driverSearchOpen, setDriverSearchOpen] = useState(false)
  const [driverSearch, setDriverSearch] = useState("")
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)
  const [driverName, setDriverName] = useState("")
  const [driverContact, setDriverContact] = useState("")
  const [driverPosition, setDriverPosition] = useState("")

  // Duplicate phone detection state
  const [duplicatePhoneData, setDuplicatePhoneData] = useState<DuplicatePhoneResult | null>(null)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)

  // Multi-service state
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [serviceSections, setServiceSections] = useState<Record<string, ServiceSectionData>>({})

  // New photo and belongings state
  const [arrivalPhotos, setArrivalPhotos] = useState<WorkOrderPhoto[]>([])
  const [issuePhotos, setIssuePhotos] = useState<WorkOrderPhoto[]>([])
  const [belongings, setBelongings] = useState<BelongingItem[]>([])
  const [belongingTemplates, setBelongingTemplates] = useState<{ id: string, name: string, description: string }[]>([])
  const [isAddingBelongingTemplate, setIsAddingBelongingTemplate] = useState(false)

  // New Vehicle Dialog State
  const [showAddVehicleDialog, setShowAddVehicleDialog] = useState(false)
  const [newVehicleData, setNewVehicleData] = useState({
    vehicle_number: "",
    manufacturer_id: "",
    category_id: "",
    vehicle_type_id: "",
    model_id: "",
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
  const [includeVehicle, setIncludeVehicle] = useState(true)
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false)
  const [newCustomerVehicleData, setNewCustomerVehicleData] = useState({
    vehicle_number: "",
    vehicle_type_id: "",
    manufacturer_id: "",
    category_id: "",
    model_id: "",
    year: new Date().getFullYear(),
    color: "",
    vin: "",
    engine_number: "",
    kilometers_driven: 0,
  })

  // Normalized catalogs
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [vehicleModels, setVehicleModels] = useState<VehicleModel[]>([])

  // Master Data Add Dialog State
  const [showAddMasterDialog, setShowAddMasterDialog] = useState(false)
  const [masterType, setMasterType] = useState<'Manufacturer' | 'Category' | 'Type' | 'Model'>('Manufacturer')
  const [masterName, setMasterName] = useState("")
  const [isAddingMaster, setIsAddingMaster] = useState(false)

  const [applicableServiceIds, setApplicableServiceIds] = useState<string[] | null>(null)

  // Applicability Rules Cache
  interface ApplicabilityRule {
    service_type_id: string;
    vehicle_category_id?: string;
    vehicle_type_id?: string;
    vehicle_manufacturer_id?: string;
  }
  const [applicabilityRules, setApplicabilityRules] = useState<ApplicabilityRule[]>([]);

  const selectedVehicle = useMemo(() => vehicles.find(v => v.id === vehicleId), [vehicles, vehicleId]);

  const [newBelonging, setNewBelonging] = useState({ name: "", description: "" });
  const [belongingFile, setBelongingFile] = useState<File | null>(null);

  // --- START DRAFT PERSISTENCE ---
  const draftKey = `wo_form_draft_${initialWorkOrderId || 'new'}`;

  // Restore draft on mount
  useEffect(() => {
    const restoreDraft = async () => {
      const savedDraft = sessionStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          if (draft.customerId) setCustomerId(draft.customerId);
          if (draft.vehicleId) setVehicleId(draft.vehicleId);
          if (draft.kilometers) setLifecycleData(prev => ({ ...prev, odometer_reading: draft.kilometers }));
          if (draft.generalDescription) setGeneralDescription(draft.generalDescription);
          if (draft.selectedServices) setSelectedServices(draft.selectedServices);
          if (draft.serviceSections) setServiceSections(draft.serviceSections);
          if (draft.priority) setPriority(draft.priority);
          if (draft.estimatedDeliveryDate) setEstimatedDeliveryDate(new Date(draft.estimatedDeliveryDate));
          if (draft.estimatedDeliveryTime) setEstimatedDeliveryTime(draft.estimatedDeliveryTime);
          if (draft.newBelonging) setNewBelonging(draft.newBelonging);
          console.log("[Draft] Restored form fields from session storage");
        } catch (e) {
          console.warn("[Draft] Failed to restore form fields", e);
        }
      }

      // Restore Photos
      const restorePhotos = async (type: 'arrival' | 'issue_area') => {
        const storageKey = `wo_photos_${initialWorkOrderId || 'new'}_${type}`;
        const savedPhotos = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
        if (savedPhotos.length > 0) {
          const restored = await Promise.all(savedPhotos.map(async (p: any) => {
            // Convert base64 back to File object
            const res = await fetch(p.base64);
            const blob = await res.blob();
            const file = new File([blob], `restored_${type}_${p.id}.jpg`, { type: "image/jpeg" });
            return {
              file,
              previewUrl: URL.createObjectURL(file),
              photo_type: type,
              description: ""
            };
          }));
          if (type === 'arrival') setArrivalPhotos(prev => [...restored, ...prev]);
          else setIssuePhotos(prev => [...restored, ...prev]);
          console.log(`[Draft] Restored ${restored.length} ${type} photos`);
        }
      };

      await restorePhotos('arrival');
      await restorePhotos('issue_area');
    };

    restoreDraft();
  }, []);

  // Save text/selection fields on change
  useEffect(() => {
    const draft = {
      customerId,
      vehicleId,
      kilometers: lifecycleData.odometer_reading,
      generalDescription,
      selectedServices,
      serviceSections,
      priority,
      estimatedDeliveryDate: estimatedDeliveryDate?.toISOString(),
      estimatedDeliveryTime,
      newBelonging
    };
    sessionStorage.setItem(draftKey, JSON.stringify(draft));
  }, [customerId, vehicleId, lifecycleData.odometer_reading, generalDescription, selectedServices, serviceSections, priority, estimatedDeliveryDate, estimatedDeliveryTime, newBelonging]);

  // --- END DRAFT PERSISTENCE ---

  // --- START NATIVE DOM FILE RESTORE (ANDROID CAMERA FIX) ---
  useEffect(() => {
    // When Android kills the browser for the camera app and restores it,
    // the native <input type="file"> might retain the file, but React loses its state.
    // We manually check the DOM for restored files.
    const checkRestoredFiles = () => {
      [arrivalCaptureId, arrivalUploadId].forEach(id => {
        const input = document.getElementById(id) as HTMLInputElement;
        if (input && input.files && input.files.length > 0) {
           Array.from(input.files).forEach(f => handleAddPhoto('arrival', f));
           input.value = ''; // Clear it so it doesn't trigger again
        }
      });
      [issueCaptureId, issueUploadId].forEach(id => {
        const input = document.getElementById(id) as HTMLInputElement;
        if (input && input.files && input.files.length > 0) {
           Array.from(input.files).forEach(f => handleAddPhoto('issue_area', f));
           input.value = '';
        }
      });
      // Handle belongings capture/upload
      [`belonging-capture-${initialWorkOrderId || 'new'}`, `belonging-upload-${initialWorkOrderId || 'new'}`].forEach(id => {
        const belongingInput = document.getElementById(id) as HTMLInputElement;
        if (belongingInput && belongingInput.files && belongingInput.files.length > 0) {
          setBelongingFile(belongingInput.files[0]);
          // Do not clear the value so they can still see it's attached and click "Add"
        }
      });
    };

    // Check immediately, and also slightly delayed in case DOM restoration takes a moment
    checkRestoredFiles();
    const t1 = setTimeout(checkRestoredFiles, 500);
    const t2 = setTimeout(checkRestoredFiles, 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [arrivalCaptureId, arrivalUploadId, issueCaptureId, issueUploadId]);
  // --- END NATIVE DOM FILE RESTORE ---

  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase.from('belonging_templates').select('*').order('name');
      if (data) setBelongingTemplates(data);
    };
    fetchTemplates();
  }, []);

  const handleAddPhoto = async (type: 'arrival' | 'issue_area', file: File) => {
    const previewUrl = URL.createObjectURL(file);
    const newPhoto: WorkOrderPhoto = { file, previewUrl, photo_type: type, description: "" };
    
    if (type === 'arrival') {
      setArrivalPhotos(prev => [...prev, newPhoto]);
    } else {
      setIssuePhotos(prev => [...prev, newPhoto]);
    }

    // Persist to session storage for refresh resilience
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const storageKey = `wo_photos_${initialWorkOrderId || 'new'}_${type}`;
        const existing = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
        // We store metadata and base64. On restore, we'll convert base64 back to Blob/File if needed, 
        // or just keep it as base64 for preview.
        const photoData = { id: Math.random().toString(36).substr(2, 9), base64, type };
        sessionStorage.setItem(storageKey, JSON.stringify([...existing, photoData]));
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.warn("Failed to save photo to session draft", e);
    }
  };

  const handleRemovePhoto = (type: 'arrival' | 'issue_area', index: number) => {
    if (type === 'arrival') {
      const photo = arrivalPhotos[index];
      URL.revokeObjectURL(photo.previewUrl);
      setArrivalPhotos(prev => prev.filter((_, i) => i !== index));
      
      const storageKey = `wo_photos_${initialWorkOrderId || 'new'}_arrival`;
      const existing = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
      sessionStorage.setItem(storageKey, JSON.stringify(existing.filter((_: any, i: number) => i !== index)));
    } else {
      const photo = issuePhotos[index];
      URL.revokeObjectURL(photo.previewUrl);
      setIssuePhotos(prev => prev.filter((_, i) => i !== index));

      const storageKey = `wo_photos_${initialWorkOrderId || 'new'}_issue_area`;
      const existing = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
      sessionStorage.setItem(storageKey, JSON.stringify(existing.filter((_: any, i: number) => i !== index)));
    }
  };

  const handleAddBelongingItem = () => {
    if (!newBelonging.name || !belongingFile) {
      toast({
        title: "Missing Information",
        description: "Please provide both an item name and a photo.",
        variant: "destructive"
      });
      return;
    }

    const newItem: BelongingItem = {
      ...newBelonging,
      file: belongingFile,
      previewUrl: URL.createObjectURL(belongingFile)
    };

    setBelongings(prev => [...prev, newItem]);
    setNewBelonging({ name: "", description: "" });
    setBelongingFile(null);
  };

  const handleAddBelongingTemplate = async () => {
    if (!newBelonging.name.trim()) return;
    setIsAddingBelongingTemplate(true);
    try {
      const { data, error } = await supabase
        .from('belonging_templates')
        .insert([{ name: newBelonging.name.trim() }])
        .select()
        .single();
      if (error) throw error;
      if (data) {
        setBelongingTemplates(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        toast({ title: "Template Added", description: `"${data.name}" available in dropdown.` });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsAddingBelongingTemplate(false);
    }
  };

  const handleRemoveBelonging = (index: number) => {
    const item = belongings[index];
    URL.revokeObjectURL(item.previewUrl);
    setBelongings(prev => prev.filter((_, i) => i !== index));
  };

  const displayedServices = useMemo(() => {
    const filtered = dbServiceTypes.filter(service => {
      // 1. FC Filter (Global Priority)
      if (isFCWork) {
        // In FC Mode: Show ALL services (FC + Normal)
        // No filtering needed here, logic falls through to standard applicability
      } else {
        // In Standard Mode: Show ONLY non-FC services
        // (treat undefined/null as false for backward compatibility)
        if (service.is_fc_exclusive === true) return false;
      }

      // 2. Initial State: If no vehicle selected, show all (that passed FC filter)
      if (!selectedVehicle) return true;

      // 3. Strict Applicability Rules
      const serviceRules = applicabilityRules.filter(r => r.service_type_id === service.id);
      if (serviceRules.length === 0) return true; // Universal (No rules defined)

      // Check if ANY rule matches the current vehicle (OR logic between rules)
      const matches = serviceRules.some(rule => {
        // Within a rule, ALL defined constraints must match (AND logic)
        if (rule.vehicle_manufacturer_id && rule.vehicle_manufacturer_id !== selectedVehicle.manufacturer_id) return false;
        if (rule.vehicle_type_id && rule.vehicle_type_id !== selectedVehicle.vehicle_type_id) return false;
        if (rule.vehicle_category_id && rule.vehicle_category_id !== selectedVehicle.vehicle_category_id) return false;
        return true;
      });

      return matches;
    });

    // Sort FC exclusive services to the top if in FC mode
    if (isFCWork) {
      return [...filtered].sort((a, b) => {
        if (a.is_fc_exclusive === b.is_fc_exclusive) return 0;
        return a.is_fc_exclusive ? -1 : 1;
      });
    }

    return filtered;
  }, [dbServiceTypes, applicabilityRules, selectedVehicle, isFCWork]);

  // Computed Task Templates (Context-Aware Pricing)
  const computedTaskTemplates = useMemo(() => {
    // If no vehicle selected or no category, return base prices
    if (!selectedVehicle?.vehicle_category_id) {
      return taskTemplates;
    }

    const catId = selectedVehicle.vehicle_category_id;
    // console.log(`ComputedTemplates: Recomputing for Category ${catId} with ${pricingRules.length} rules.`);

    return taskTemplates.map(task => {
      // Find rule for this task and category
      const rule = pricingRules.find(r =>
        r.task_template_id === task.id &&
        r.vehicle_category_id === catId &&
        r.is_active
      );

      if (rule) {
        let price = Number(task.price) || 0;
        if (rule.modifier_type === 'fixed') {
          price += Number(rule.modifier_value);
        } else if (rule.modifier_type === 'percentage') {
          price += (price * (Number(rule.modifier_value) / 100));
        } else if (rule.modifier_type === 'override') {
          price = Number(rule.modifier_value);
        }
        return { ...task, price };
      }
      return task;
    });
  }, [taskTemplates, pricingRules, selectedVehicle?.vehicle_category_id]);

  // Derived lists for cascading dropdowns
  const availableTypes = useMemo(() => {
    return vehicleTypes.filter(t => !newVehicleData.category_id || t.category_id === newVehicleData.category_id)
  }, [vehicleTypes, newVehicleData.category_id])

  const availableModels = useMemo(() => {
    return vehicleModels.filter(m => {
      const matchMfr = !newVehicleData.manufacturer_id || m.manufacturer_id === newVehicleData.manufacturer_id
      const matchType = !newVehicleData.vehicle_type_id || m.vehicle_type_id === newVehicleData.vehicle_type_id
      return matchMfr && matchType
    })
  }, [vehicleModels, newVehicleData.manufacturer_id, newVehicleData.vehicle_type_id])



  const fetchAllData = async () => {
    setLoadingCustomers(true)
    setLoadingVehicles(true)
    setLoadingEmployees(true)

    try {
      const [
        customersRes,
        vehiclesRes,
        employeesRes,
        serviceTypesRes,
        taskTemplatesRes,
        mfrsRes,
        catsRes,
        typesRes,
        modelsRes,
        rulesRes,
        pricingRulesRes,
        serviceCategoriesRes
      ] = await Promise.all([
        supabase.from('customers').select('id, name, company_name').order('name'),
        supabase.from('vehicles').select(`
          id,
          vehicle_number,
          model_id,
          customer_id,
          kilometers_driven,
          next_service_km,
          customers(name),
          vehicle_models (
            id,
            name,
            manufacturer_id,
            vehicle_type_id,
            vehicle_manufacturers (id, name),
            vehicle_types (
              id,
              name,
              category_id,
              vehicle_categories (id, name)
            )
          )
        `),
        supabase.from('employees').select('id, name, email, phone, position_id, access_level, status').eq('status', 'active'),
        supabase.from('service_types').select('*').order('name'),
        supabase.from('task_templates').select('id, name, service_type_id, price, is_active').eq('is_active', true),
        supabase.from('vehicle_manufacturers').select('*').order('name'),
        supabase.from('vehicle_categories').select('*').order('name'),
        supabase.from('vehicle_types').select('*').order('name'),
        supabase.from('vehicle_models').select('*').order('name'),
        supabase.from('service_vehicle_applicability').select('*'),
        supabase.from('pricing_rules').select('*').eq('is_active', true),
        supabase.from('service_categories').select('*').order('name')
      ])

      if (rulesRes.data) setApplicabilityRules(rulesRes.data);
      if (pricingRulesRes.data) setPricingRules(pricingRulesRes.data);
      if (serviceCategoriesRes?.data) setServiceCategories(serviceCategoriesRes.data);

      if (mfrsRes.data) setManufacturers(mfrsRes.data)
      if (catsRes.data) setCategories(catsRes.data)
      if (typesRes.data) setVehicleTypes(typesRes.data)
      if (modelsRes.data) setVehicleModels(modelsRes.data)


      if (customersRes.data) setCustomers(customersRes.data)
      if (vehiclesRes.data) {
        const formatted = vehiclesRes.data.map((v: any) => {
          const rawModel = v.vehicle_models;
          const m = Array.isArray(rawModel) ? rawModel[0] : rawModel;
          const rawType = m?.vehicle_types;
          const t = Array.isArray(rawType) ? rawType[0] : rawType;

          return {
            id: v.id,
            vehicle_number: v.vehicle_number,
            model: m?.name || "Unknown",
            model_id: v.model_id,
            vehicle_type_id: m?.vehicle_type_id || t?.id,
            vehicle_category_id: t?.category_id || t?.vehicle_categories?.id,
            manufacturer_id: m?.manufacturer_id || m?.vehicle_manufacturers?.id,
            customer_id: v.customer_id,
            customer_name: v.customers?.name || "Unknown",
            kilometers_driven: v.kilometers_driven,
            next_service_km: v.next_service_km,
            vehicle_type_name: t?.name,
            vehicle_category_name: t?.vehicle_categories?.name,
            manufacturer_name: m?.vehicle_manufacturers?.name
          }
        })
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

  // Load master data on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  // Filter vehicles by customer
  const filteredVehicles = customerId
    ? vehicles.filter(v => v.customer_id === customerId)
    : []

  const handleCustomerSelect = (id: string) => {
    setCustomerId(id)
    setCustomerSearch("")
    setCustomerSearchOpen(false)
    setVehicleId("")

    // Fetch driver suggestions for this customer/company
    fetchDriverSuggestions(id)
  }

  // Load company contacts whenever customer changes
  useEffect(() => {
    if (customerId) {
      supabase
        .from('customer_contacts')
        .select('id, name, designation, phone, is_primary')
        .eq('customer_id', customerId)
        .order('is_primary', { ascending: false })
        .then(({ data }) => {
          setCompanyContacts(data || []);
          if (!contactId && data && data.length > 0) {
            const primary = data.find(c => c.is_primary) || data[0];
            setContactId(primary.id);
          }
        });
    } else {
      setCompanyContacts([]);
      setContactId("");
    }
  }, [customerId]);

  const fetchDriverSuggestions = async (companyId: string) => {
    try {
      const { data, error } = await supabase.rpc('suggest_drivers', {
        company_id_param: companyId,
        search_term: ''
      })

      if (error) throw error
      setDriverSuggestions(data || [])
    } catch (error) {
      console.error("Error fetching driver suggestions:", error)
      setDriverSuggestions([])
    }
  }

  const handleDriverSelect = (driver: Driver) => {
    setSelectedDriverId(driver.id)
    setDriverName(driver.name)
    setDriverContact(driver.contact_number || "")
    setDriverPosition(driver.driver_position || "")
    setDriverSearch("")
    setDriverSearchOpen(false)
  }

  const handleDriverNameChange = (value: string) => {
    setDriverName(value)
    setDriverSearch(value)
    // Clear selected driver if user is typing new name
    if (selectedDriverId && value !== driverSuggestions.find(d => d.id === selectedDriverId)?.name) {
      setSelectedDriverId(null)
    }
  }

  const handleVehicleSelect = async (id: string) => {
    setVehicleId(id)
    setVehicleSearch("")
    setVehicleSearchOpen(false)

    // Pre-fill lifecycle data
    const selectedVehicle = vehicles.find(v => v.id === id)
    if (selectedVehicle) {
      setLifecycleData(prev => ({
        ...prev,
        odometer_reading: selectedVehicle.kilometers_driven || 0,
        next_service_due_km: selectedVehicle.next_service_km || 0,
        next_service_due_date: selectedVehicle.next_service_date || ""
      }))

      if (selectedVehicle.primary_contact_id) {
        setContactId(selectedVehicle.primary_contact_id);
      }

      setApplicableServiceIds(null); // Reset as we are using client-side calculation now
      // The filtered list is calculated below in the render or via a memo
    }
  }
  // Effect to resync prices when vehicle/customer changes
  useEffect(() => {
    if (Object.keys(serviceSections).length === 0 || (!vehicleId && !customerId)) return;

    const resyncPrices = async () => {
      const newSections = { ...serviceSections };
      let globalChanges = false;

      for (const serviceType of Object.keys(newSections)) {
        const section = newSections[serviceType];
        if (!section.serviceTypeId) continue;

        let sectionChanged = false;
        // Re-run pricing engine for this service in the new context
        const priceResult = await calculateServicePrice(section.serviceTypeId, vehicleId, customerId);

        // Update task prices if they are predefined
        const updatedTasks = section.tasks.map(task => {
          if (task.isPredefined) {
            const ruleForTask = priceResult.taskBreakdown?.find(tb => tb.name === task.name);
            // If the price or the applied rule has changed, update it
            if (ruleForTask && (ruleForTask.calculatedPrice !== task.price || ruleForTask.appliedRule !== task.appliedRuleName)) {
              sectionChanged = true;
              return {
                ...task,
                price: ruleForTask.calculatedPrice,
                appliedRuleName: ruleForTask.appliedRule
              };
            }
          }
          return task;
        });

        // Check if any metadata changed
        if (
          priceResult.calculatedPrice !== section.calculatedPrice ||
          JSON.stringify(priceResult.appliedRules) !== JSON.stringify(section.appliedRules)
        ) {
          sectionChanged = true;
        }

        if (sectionChanged) {
          globalChanges = true;
          newSections[serviceType] = {
            ...section,
            tasks: updatedTasks,
            cost: updatedTasks.length > 0 ? updatedTasks.reduce((sum, t) => sum + (t.price || 0), 0) : priceResult.calculatedPrice || 0,
            calculatedPrice: priceResult.calculatedPrice,
            basePrice: priceResult.basePrice,
            appliedRules: priceResult.appliedRules,
            taskBreakdown: priceResult.taskBreakdown
          };
        }
      }

      if (globalChanges) {
        setServiceSections(newSections);
      }
    };

    resyncPrices();
  }, [vehicleId, customerId, isLoadingExisting]);

  const loadExistingWorkOrder = useCallback(async (id: string) => {
    setIsLoadingExisting(true);
    try {
      // 1. Fetch Work Order Header
      const { data: wo, error: woError } = await supabase
        .from('work_orders')
        .select(`
          *,
          vehicles (
            *,
            customers (*)
          )
        `)
        .eq('id', id)
        .single();

      if (woError) throw woError;

      // Update basic fields
      setCustomerId(wo.vehicles.customer_id);
      setVehicleId(wo.vehicle_id);
      setAssignedTo(wo.assigned_to || "");
      setPriority(wo.priority);
      setGeneralDescription(wo.description);

      if (wo.estimated_delivery_date) {
        const date = new Date(wo.estimated_delivery_date);
        setEstimatedDeliveryDate(date);
        setEstimatedDeliveryTime(format(date, "h:mm a"));
      }

      setLifecycleData({
        odometer_reading: wo.odometer_reading || 0,
        next_service_due_km: wo.next_service_due_km || 0,
        next_service_due_date: wo.next_service_due_date || "",
        service_notes: "",
        is_fc_renewal: wo.is_fc_renewal || false
      });

      if (wo.contact_id) {
        setContactId(wo.contact_id);
      }

      // 2. Fetch Services and joined data
      const { data: services, error: sError } = await supabase
        .from('work_order_services')
        .select(`
          *,
          work_order_tasks (*),
          work_order_service_employees (*)
        `)
        .eq('work_order_id', id);

      if (sError) throw sError;

      const loadedSelectedServices: string[] = [];
      const loadedServiceSections: Record<string, ServiceSectionData> = {};

      for (const s of (services || [])) {
        loadedSelectedServices.push(s.service_type);

        const tasks: TaskItem[] = (s.work_order_tasks || []).map((t: any) => ({
          id: t.id,
          name: t.task_name,
          price: t.price,
          completed: t.completed,
          isPredefined: t.is_predefined
        }));

        const assignments = (s.work_order_service_employees || []).map((a: any) => ({
          id: a.employee_id,
          queue_position: a.queue_position || 1,
          status: a.status // Capture existing status
        }));

        loadedServiceSections[s.service_type] = {
          serviceType: s.service_type,
          serviceTypeId: s.service_type_id,
          dbId: s.id,
          tasks,
          selectedEmployees: assignments,
          notes: "", // Notes are in a separate table, but we'll stick to this for now or skip
          cost: s.estimated_cost || 0,
          calculatedPrice: s.calculated_price,
          basePrice: s.base_price_snapshot
        };
      }

      setSelectedServices(loadedSelectedServices);
      setServiceSections(loadedServiceSections);

      toast({
        title: "Work Order Loaded",
        description: `Successfully loaded details for ${wo.vehicles.vehicle_number}`,
      });

    } catch (error: any) {
      console.error("Error loading work order:", error);
      toast({
        title: "Error",
        description: "Failed to load work order data: " + error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoadingExisting(false);
    }
  }, [toast]);

  useEffect(() => {
    if (initialWorkOrderId) {
      loadExistingWorkOrder(initialWorkOrderId);
    }
  }, [initialWorkOrderId, loadExistingWorkOrder]);

  const { user } = useAuth()
  useEffect(() => {
    if (!initialWorkOrderId && user?.email && employees.length > 0 && !assignedTo) {
      const currentEmployee = employees.find(e => e.email?.toLowerCase() === user.email?.toLowerCase())
      if (currentEmployee) {
        setAssignedTo(currentEmployee.id)
      }
    }
  }, [initialWorkOrderId, user, employees, assignedTo])




  const handleServiceToggle = async (type: string, checked: boolean) => {
    const serviceMaster = dbServiceTypes.find(s => s.name === type);
    if (!serviceMaster) return;

    if (checked) {
      // Calculate dynamic price
      const priceResult = await calculateServicePrice(serviceMaster.id, vehicleId, customerId);

      let initialTasks: TaskItem[] = [];

      // Tasks should not be auto-added unless there are mandatory one.
      // Current requirement: "only the user should select"
      // So we start with empty tasks, but user can add them from the selector.
      initialTasks = [];

      // We still calculate priceResult to get base/calculated price metadata if needed,
      // but we override the tasks list to be empty.

      /*
      // Original Auto-Add Logic (Commented out)
      if (priceResult.taskBreakdown && priceResult.taskBreakdown.length > 0) {
        initialTasks = priceResult.taskBreakdown.map(tb => ({
          id: crypto.randomUUID(),
          name: tb.name,
          price: tb.calculatedPrice,
          isPredefined: true,
          appliedRuleName: tb.appliedRule
        }));
      } else {
        // Find master tasks for this service (Fallback)
        const serviceTemplates = taskTemplates.filter(t => t.service_type_id === serviceMaster.id);
        initialTasks = serviceTemplates.map(t => ({
          id: crypto.randomUUID(),
          name: t.name,
          price: t.price || 0,
          isPredefined: true
        }));
      }
      */

      setSelectedServices(prev => [...prev, type])
      setServiceSections(prev => ({
        ...prev,
        [type]: {
          serviceType: type,
          serviceTypeId: serviceMaster.id, // Ensure ID is stored
          tasks: initialTasks,
          selectedEmployees: [],
          notes: "",
          cost: priceResult.calculatedPrice,
          calculatedPrice: priceResult.calculatedPrice,
          basePrice: priceResult.basePrice,
          appliedRules: priceResult.appliedRules,
          taskBreakdown: priceResult.taskBreakdown
        }
      }))
    } else {
      setSelectedServices(prev => prev.filter(t => t !== type))
      const newSections = { ...serviceSections }
      delete newSections[type]
      setServiceSections(newSections)
    }
  }

  // Handle Initial Data (from Appointment) - Moved here to avoid hoisting issues
  useEffect(() => {
    if (initialData && !isLoading && !loadingCustomers && !loadingVehicles) {
      if (initialData.customerId) {
        setCustomerId(initialData.customerId);
      }
      if (initialData.vehicleId) {
        setVehicleId(initialData.vehicleId);
        setLifecycleData(prev => ({ ...prev, odometer_reading: 0, next_service_due_km: 0 }));
      }
      if (initialData.description) {
        setGeneralDescription(initialData.description);
      }

      // Handle services
      if (initialData.serviceTypeNames && initialData.serviceTypeNames.length > 0) {
        initialData.serviceTypeNames.forEach(name => {
          const exists = dbServiceTypes.find(s => s.name === name);
          if (exists && !selectedServices.includes(name)) {
            handleServiceToggle(name, true);
          }
        });
      } else if (initialData.serviceType && !selectedServices.includes(initialData.serviceType)) {
        // Legacy or single service
        const exists = dbServiceTypes.find(s => s.name === initialData.serviceType);
        if (exists) handleServiceToggle(initialData.serviceType, true);
      }
    }
  }, [initialData, isLoading, loadingCustomers, loadingVehicles, dbServiceTypes]);

  const handleAddCustomService = async () => {
    if (!newServiceName.trim()) return;

    setIsAddingService(true);
    try {
      const { data, error } = await supabase
        .from('service_types')
        .insert({
          name: newServiceName.trim(),
          category: newServiceCategory
        })
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

      if (selectedServices.includes(editingService.name)) {
        const newName = editServiceName.trim();
        // Update selectedServices
        setSelectedServices(prev => prev.map(s => s === editingService.name ? newName : s));
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
      if (selectedServices.includes(deletingService.name)) {
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

  const handleCustomTaskAdd = async (serviceTypeId: string, taskName: string, price: number): Promise<TaskTemplate | null> => {
    console.log("handleCustomTaskAdd called with:", { serviceTypeId, taskName, price });
    console.log("Selected Vehicle Context:", selectedVehicle);

    try {
      // 1. Create Base Task (Price 0)
      const { data: newTask, error } = await supabase
        .from('task_templates')
        .insert({
          service_type_id: serviceTypeId,
          name: taskName,
          price: 0, // Base price is 0 for custom tasks, specific price is via rule
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      let finalTask = newTask;

      // 2. If vehicle has category and price > 0, create Pricing Rule
      if (price > 0 && selectedVehicle && selectedVehicle.vehicle_category_id) {
        const { error: ruleError } = await supabase
          .from('pricing_rules')
          .insert({
            service_type_id: serviceTypeId,
            task_template_id: newTask.id,
            vehicle_category_id: selectedVehicle.vehicle_category_id,
            modifier_type: 'override',
            modifier_value: price,
            name: `${taskName} - ${selectedVehicle.vehicle_category_name} Override`,
            is_active: true,
            priority: 10
          });

        if (ruleError) {
          console.error("Failed to create pricing rule for custom task:", ruleError);
          toast({ variant: "destructive", title: "Warning", description: "Task added but pricing rule failed." });
        } else {
          // Return the task WITH the specific price so the UI updates immediately
          finalTask = { ...newTask, price: price };
        }
      }

      // Update local state and return
      setTaskTemplates(prev => [...prev, finalTask]);
      return finalTask;

    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: "Failed to create task template" });
      console.error(error);
      return null;
    }
  }

  const handleUpdateTaskTemplate = useCallback(async (task: TaskTemplate, newName: string, newPrice?: number) => {

    try {
      // 1. Update Name (Global)
      if (newName !== task.name) {
        const { error } = await supabase
          .from('task_templates')
          .update({ name: newName })
          .eq('id', task.id);

        if (error) throw error;
        setTaskTemplates(prev => prev.map(t => t.id === task.id ? { ...t, name: newName } : t));
      }

      // 2. Update Price (Category Specific)
      if (newPrice !== undefined && selectedVehicle && selectedVehicle.vehicle_category_id) {
        const catId = selectedVehicle.vehicle_category_id;

        // Check for existing rule
        const { data: existingRules, error: fetchError } = await supabase
          .from('pricing_rules')
          .select('id')
          .eq('task_template_id', task.id)
          .eq('vehicle_category_id', catId)
          .eq('is_active', true);

        if (fetchError) console.error("Error fetching rules:", fetchError);

        if (existingRules && existingRules.length > 0) {
          // Update existing
          const { data: updatedRule, error: ruleError } = await supabase
            .from('pricing_rules')
            .update({
              modifier_type: 'override',
              modifier_value: newPrice
            })
            .eq('id', existingRules[0].id)
            .select()
            .single();
          if (ruleError) throw ruleError;

          if (updatedRule) {
            setPricingRules(prev => prev.map(r => r.id === updatedRule.id ? updatedRule : r));
          }
        } else {
          // Create new rule
          const { data: newRule, error: ruleError } = await supabase
            .from('pricing_rules')
            .insert({
              service_type_id: task.service_type_id,
              task_template_id: task.id,
              vehicle_category_id: catId,
              modifier_type: 'override',
              modifier_value: newPrice,
              name: `${newName || task.name} - ${selectedVehicle.vehicle_category_name} Override`,
              is_active: true,
              priority: 10
            })
            .select()
            .single();
          if (ruleError) throw ruleError;

          if (newRule) {
            setPricingRules(prev => [...prev, newRule]);
          }
        }
        toast({ title: "Price Updated", description: "Updated price for this vehicle category." });

        // NOTE: We updated pricingRules state above, which triggers computedTaskTemplates recalc.
        // We do NOT need to manually mutate taskTemplates anymore.

        // Update local state so dropdown reflects new price immediately
        // setTaskTemplates(prev => prev.map(t => t.id === task.id ? { ...t, price: newPrice } : t));

        // Trigger re-calculation of current service section by toggling it off and on? 
        // Or just wait for next interaction. 
        // Ideally we should update local state, but recalculation is complex.
        // Re-selecting the service type might be easiest user flow or we simply notify.
      }

      toast({ title: "Task Updated", description: "Task template details updated." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  }, [selectedVehicle, taskTemplates]); // Dependencies to ensure fresh closure

  const handleDeleteTaskTemplate = async (taskId: string) => {
    try {
      const task = taskTemplates.find(t => t.id === taskId);
      const { error } = await supabase
        .from('task_templates')
        .delete()
        .eq('id', taskId);

      if (error) {
        const { error: softError } = await supabase
          .from('task_templates')
          .update({ is_active: false })
          .eq('id', taskId);
        if (softError) throw softError;
      }

      // Sync base_price if we deleted a master task
      if (task) {
        const serviceId = task.service_type_id;
        const remainingTasks = taskTemplates.filter(t => t.service_type_id === serviceId && t.id !== taskId);
        const newTotal = remainingTasks.reduce((sum, t) => sum + (t.price || 0), 0);

        await supabase
          .from('service_types')
          .update({ base_price: newTotal } as any)
          .eq('id', serviceId);
      }

      setTaskTemplates(prev => prev.filter(t => t.id !== taskId));
      toast({ title: "Task Deleted", description: "Task template removed and master base price recalculated." });
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

  const handleRemoveSection = (type: string) => {
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

    if (!newVehicleData.vehicle_number || !newVehicleData.model_id) {
      toast({
        title: "Error",
        description: "Please fill in required fields (Vehicle Number, Model)",
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
          model_id: newVehicleData.model_id,
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
      const { data: vRes } = await supabase.from('vehicles').select(`
          id, 
          vehicle_number, 
          model_id, 
          customer_id, 
          kilometers_driven, 
          next_service_km, 
          customers(name),
          vehicle_models (
            name,
            vehicle_manufacturers (name),
            vehicle_types (
              name,
              vehicle_categories (name)
            )
          )
        `)

      if (vRes) {
        const formatted = vRes.map((v: any) => {
          const m = v.vehicle_models;
          return {
            id: v.id,
            vehicle_number: v.vehicle_number,
            model: m?.name || "Unknown",
            model_id: v.model_id,
            vehicle_type_id: m?.vehicle_type_id,
            vehicle_category_id: m?.vehicle_types?.category_id,
            customer_id: v.customer_id,
            customer_name: v.customers?.name || "Unknown",
            kilometers_driven: v.kilometers_driven,
            next_service_km: v.next_service_km,
            vehicle_type_name: m?.vehicle_types?.name,
            vehicle_category_name: m?.vehicle_types?.vehicle_categories?.name,
            manufacturer_name: m?.vehicle_manufacturers?.name
          }
        })
        setVehicles(formatted)
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
        manufacturer_id: "",
        category_id: "",
        vehicle_type_id: "",
        model_id: "",
        year: new Date().getFullYear(),
        color: "",
        vin: "",
        engine_number: "",
        kilometers_driven: 0,
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

  // Create Master Data Helpers
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

  const handleCreateTypeData = async (name: string, category_id: string) => {
    try {
      const { data, error } = await supabase.from('vehicle_types').insert({ name, category_id }).select().single()
      if (error) throw error
      setVehicleTypes(prev => [...prev, data as VehicleType].sort((a, b) => a.name.localeCompare(b.name)))
      return data.id
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleCreateModelData = async (name: string, manufacturer_id: string, vehicle_type_id: string) => {
    try {
      const { data, error } = await supabase.from('vehicle_models').insert({ name, manufacturer_id, vehicle_type_id }).select().single()
      if (error) throw error
      setVehicleModels(prev => [...prev, data as VehicleModel].sort((a, b) => a.name.localeCompare(b.name)))
      return data.id
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
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
    if (includeVehicle && (!newCustomerVehicleData.vehicle_number || !newCustomerVehicleData.model_id)) {
      toast({
        title: "Error",
        description: "Please fill in required vehicle fields (Number, Model)",
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
            model_id: newCustomerVehicleData.model_id,
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
      const { data: vRes } = await supabase.from('vehicles').select(`
          id, 
          vehicle_number, 
          model_id, 
          customer_id, 
          kilometers_driven, 
          next_service_km, 
          customers(name),
          vehicle_models (
            name,
            vehicle_manufacturers (name),
            vehicle_types (
              name,
              vehicle_categories (name)
            )
          )
        `)

      if (vRes) {
        const formatted = vRes.map((v: any) => {
          const m = v.vehicle_models;
          return {
            id: v.id,
            vehicle_number: v.vehicle_number,
            model: m?.name || "Unknown",
            model_id: v.model_id,
            vehicle_type_id: m?.vehicle_type_id,
            vehicle_category_id: m?.vehicle_types?.category_id,
            customer_id: v.customer_id,
            customer_name: v.customers?.name || "Unknown",
            kilometers_driven: v.kilometers_driven,
            next_service_km: v.next_service_km,
            vehicle_type_name: m?.vehicle_types?.name,
            vehicle_category_name: m?.vehicle_types?.vehicle_categories?.name,
            manufacturer_name: m?.vehicle_manufacturers?.name
          }
        })
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
        manufacturer_id: "",
        category_id: "",
        vehicle_type_id: "",
        model_id: "",
        year: new Date().getFullYear(),
        color: "",
        vin: "",
        engine_number: "",
        kilometers_driven: 0,
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault()

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

    // Validate driver information (mandatory)
    if (!driverName || !driverName.trim()) {
      toast({
        title: "Driver Information Required",
        description: "Please enter the driver's name",
        variant: "destructive",
      })
      return
    }

    if (!driverContact || !driverContact.trim()) {
      toast({
        title: "Driver Information Required",
        description: "Please enter the driver's contact number",
        variant: "destructive",
      })
      return
    }

    // Validate driver phone number format
    const phoneValidation = validateIndianPhoneNumber(driverContact);
    if (!phoneValidation.isValid) {
      toast({
        title: "Invalid Phone Number",
        description: phoneValidation.error || "Please enter a valid 10-digit Indian phone number",
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
      const mainServiceType = selectedServices.length === 1 ? selectedServices[0] : "Multi-Service";

      const orderPayload: any = {
        vehicle_id: vehicleId,
        assigned_to: assignedTo || null,
        service_type: mainServiceType,
        description: generalDescription || "No description provided",
        priority: priority,
        estimated_cost: totalEstimatedCost,
        status: 'In Progress',
        notes: JSON.stringify({
          service_types: selectedServices,
          total_sections: selectedServices.length,
          reopened_at: isReopening ? new Date().toISOString() : undefined,
          original_reopen_reason: isReopening ? internalReopenReason : undefined
        }),
        odometer_reading: lifecycleData.odometer_reading || null,
        next_service_due_km: lifecycleData.next_service_due_km || null,
        next_service_due_date: lifecycleData.next_service_due_date || null,
        contact_id: contactId || null,
        is_fc_renewal: lifecycleData.is_fc_renewal,
        estimated_delivery_date: deliveryDateTime.toISOString()
      };

      if (isReopening) {
        orderPayload.is_reopened = true;
        orderPayload.reopen_reason = internalReopenReason;
        orderPayload.rejection_reason = null;
        orderPayload.review_status = 'pending';
        orderPayload.quality_check_status = 'pending';
        orderPayload.repair_status = 'in_progress';
        orderPayload.current_stage = 'Repair';
        orderPayload.customer_notified = false;
      }

      let workOrderId = initialWorkOrderId;

      if (initialWorkOrderId) {
        // UPDATE
        const { error: updateError } = await supabase
          .from('work_orders')
          .update(orderPayload)
          .eq('id', initialWorkOrderId);

        if (updateError) throw updateError;

        if (isReopening) {
          // Reset stages in work_order_stages table
          await supabase
            .from('work_order_stages')
            .update({ status: 'pending', completed_at: null })
            .in('stage', ['Quality Check', 'Review', 'Delivery'])
            .eq('work_order_id', initialWorkOrderId);
        }
      } else {
        // CREATE
        const { data: workOrder, error } = await supabase
          .from('work_orders')
          .insert([{
            ...orderPayload,
            current_stage: 'Inspection',
            started_at: new Date().toISOString(),
          }])
          .select()
          .single()

        if (error) throw error
        if (!workOrder) throw new Error("Failed to create work order")
        workOrderId = workOrder.id;
      }

      // Handle Photos and Belongings Uploads
      if (workOrderId) {
        // 1. Process Photos
        const photoUploads = [...arrivalPhotos, ...issuePhotos].filter(p => !p.id && p.file);
        const uploadedPhotoRecords = [];

        for (const photo of photoUploads) {
          if (!photo.file) continue;
          const fileExt = photo.file.name.split('.').pop();
          const fileName = `${workOrderId}/${photo.photo_type}/${Math.random().toString(36).substring(2)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('work-order-assets')
            .upload(fileName, photo.file);

          if (uploadError) {
            console.error("Photo upload error:", uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('work-order-assets')
            .getPublicUrl(fileName);

          uploadedPhotoRecords.push({
            work_order_id: workOrderId,
            vehicle_id: vehicleId,
            photo_url: publicUrl,
            photo_type: photo.photo_type,
            uploaded_by: user?.id
          });
        }

        if (uploadedPhotoRecords.length > 0) {
          const { error: photoDbError } = await supabase
            .from('work_order_photos')
            .insert(uploadedPhotoRecords);
          if (photoDbError) throw photoDbError;
        }

        // 2. Process Belongings
        const belongingUploads = belongings.filter(b => !b.id && b.file);
        const uploadedBelongingRecords = [];

        for (const item of belongingUploads) {
          if (!item.file) continue;
          const fileExt = item.file.name.split('.').pop();
          const fileName = `${workOrderId}/belongings/${Math.random().toString(36).substring(2)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('work-order-assets')
            .upload(fileName, item.file);

          if (uploadError) {
            console.error("Belonging photo upload error:", uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('work-order-assets')
            .getPublicUrl(fileName);

          uploadedBelongingRecords.push({
            work_order_id: workOrderId,
            item_name: item.name,
            description: item.description,
            photo_url: publicUrl
          });
        }

        if (uploadedBelongingRecords.length > 0) {
          const { error: belongingDbError } = await supabase
            .from('work_order_belongings')
            .insert(uploadedBelongingRecords);
          if (belongingDbError) throw belongingDbError;
        }
      }

      // Handle Driver Assignment/Creation
      let finalDriverId = selectedDriverId;

      if (driverName && !selectedDriverId) {
        // Create new driver if name provided but not selected from existing
        try {
          const { data: newDriver, error: driverError } = await supabase
            .from('drivers')
            .insert([{
              company_id: customerId,
              name: driverName.trim(),
              contact_number: driverContact.trim() || null,
              driver_position: driverPosition || 'Driver'
            }])
            .select()
            .single();

          if (driverError) {
            // Check if it's a unique constraint violation (driver already exists)
            if (driverError.code === '23505') {
              console.log("Driver already exists, fetching existing driver");
              const { data: existingDriver } = await supabase
                .from('drivers')
                .select('id')
                .eq('company_id', customerId)
                .eq('name', driverName.trim())
                .eq('contact_number', driverContact.trim() || null)
                .single();

              if (existingDriver) {
                finalDriverId = existingDriver.id;
              }
            } else {
              console.error("Error creating driver:", driverError);
            }
          } else if (newDriver) {
            finalDriverId = newDriver.id;
          }
        } catch (err) {
          console.error("Driver creation error:", err);
        }
      }

      // Update work order with driver_id
      if (finalDriverId) {
        await supabase
          .from('work_orders')
          .update({ driver_id: finalDriverId })
          .eq('id', workOrderId);
      }

      // 2. Sync Service Sections
      // Fetch existing services to know what to keep/update/delete
      const { data: existingServices } = await supabase
        .from('work_order_services')
        .select('id, service_type')
        .eq('work_order_id', workOrderId);

      const existingServiceMap = new Map((existingServices || []).map(s => [s.service_type, s.id]));

      // Delete services no longer selected
      const servicesToDelete = (existingServices || [])
        .filter(s => !selectedServices.includes(s.service_type))
        .map(s => s.id);

      if (servicesToDelete.length > 0) {
        // Cascade should handle tasks/assignments, but we'll be safe
        await supabase.from('work_order_services').delete().in('id', servicesToDelete);
      }

      for (const type of selectedServices) {
        const sectionData = serviceSections[type];
        if (!sectionData) continue;

        let serviceId = existingServiceMap.get(type);
        const servicePayload = {
          work_order_id: workOrderId,
          service_type: type,
          estimated_cost: sectionData.cost,
          calculated_price: sectionData.calculatedPrice,
          base_price_snapshot: sectionData.basePrice,
          billing_price: sectionData.cost,
          status: 'In Progress'
        };

        if (serviceId) {
          await supabase.from('work_order_services').update(servicePayload).eq('id', serviceId);
        } else {
          const { data: serviceRecord, error: serviceError } = await supabase
            .from('work_order_services')
            .insert(servicePayload)
            .select()
            .single();

          if (serviceError) throw serviceError;
          serviceId = serviceRecord.id;
        }

        // 3. Sync Tasks - Delete and Re-insert for simplicity and to handle reordering/new tasks
        await supabase.from('work_order_tasks').delete().eq('service_id', serviceId);

        const tasksPayload = sectionData.tasks.map(task => ({
          work_order_id: workOrderId,
          service_id: serviceId,
          task_name: task.name,
          task_type: 'repair',
          is_predefined: task.isPredefined,
          price: task.price || 0,
          completed: task.completed ?? false,
          is_rejected: false // Reset rejection on sync/reopen
        }));

        if (tasksPayload.length > 0) {
          await supabase.from('work_order_tasks').insert(tasksPayload);
        }

        // 4. Sync Employee Assignments
        // We'll use the direct delete since it was proven to work in WorkOrderDetail
        await supabase.from('work_order_service_employees').delete().eq('service_id', serviceId);

        if (sectionData.selectedEmployees.length > 0) {
          for (const empEntry of sectionData.selectedEmployees) {
            // Insert into work_order_service_employees via RPC
            await supabase.rpc('insert_work_order_service_employee', {
              p_service_id: serviceId,
              p_employee_id: empEntry.id,
              p_status: empEntry.status || 'Assigned', // Preserve existing status or default to Assigned
              p_queue_position: empEntry.queue_position || 1
            })

            // Link to main assignments (Staff Portal)
            await supabase.rpc('insert_work_order_assignment', {
              p_work_order_id: workOrderId,
              p_employee_id: empEntry.id,
              p_notes: `Assigned to ${type}`
            })
          }
        }

        // Create notes if new
        if (sectionData.notes) {
          await supabase.from('work_order_service_notes').insert({
            service_id: serviceId,
            note_content: sectionData.notes,
            note_type: 'General',
            is_internal: true
          })
        }
      }

      // Update vehicle status
      await supabase
        .from('vehicles')
        .update({
          status: 'In Progress',
          kilometers_driven: lifecycleData.odometer_reading || undefined,
          next_service_km: lifecycleData.next_service_due_km || undefined
        })
        .eq('id', vehicleId)

      // Clear draft on success
      sessionStorage.removeItem(`wo_form_draft_${initialWorkOrderId || 'new'}`);
      sessionStorage.removeItem(`wo_photos_${initialWorkOrderId || 'new'}_arrival`);
      sessionStorage.removeItem(`wo_photos_${initialWorkOrderId || 'new'}_issue_area`);

      setIsReviewing(false);

      toast({
        title: "Success",
        description: initialWorkOrderId
          ? `Work order ${isReopening ? 'reopened' : 'updated'} successfully.`
          : `Work order created successfully.`,
      })
      onSuccess()
    } catch (error: any) {
      console.error('Error submitting work order:', error)
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

  // Handle Initial Data (from Appointment) - Moved here to avoid hoisting issues
  useEffect(() => {
    if (initialData && !isLoading && !loadingCustomers && !loadingVehicles) {
      if (initialData.customerId) {
        setCustomerId(initialData.customerId);
      }
      if (initialData.vehicleId) {
        setVehicleId(initialData.vehicleId);
        setLifecycleData(prev => ({ ...prev, odometer_reading: 0, next_service_due_km: 0 }));
      }
      if (initialData.description) {
        setGeneralDescription(initialData.description);
      }

      // Handle services
      if (initialData.serviceTypeNames && initialData.serviceTypeNames.length > 0) {
        initialData.serviceTypeNames.forEach(name => {
          const exists = dbServiceTypes.find(s => s.name === name);
          if (exists && !selectedServices.includes(name)) {
            handleServiceToggle(name, true);
          }
        });
      } else if (initialData.serviceType && !selectedServices.includes(initialData.serviceType)) {
        // Legacy or single service
        const exists = dbServiceTypes.find(s => s.name === initialData.serviceType);
        if (exists) handleServiceToggle(initialData.serviceType, true);
      }
    }
  }, [initialData, isLoading, loadingCustomers, loadingVehicles, dbServiceTypes]);

  const filteredCustomers = customers.filter(c =>
    getCustomerDisplayName(c).toLowerCase().includes(customerSearch.toLowerCase())
  )

  const filteredVehicleList = filteredVehicles.filter(v =>
    `${v.vehicle_number} ${v.model}`.toLowerCase().includes(vehicleSearch.toLowerCase())
  )

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Hidden Native File Inputs - Placed at the top for maximum stability */}
      <input
        type="file"
        id={arrivalCaptureId}
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          e.stopPropagation();
          const files = Array.from(e.target.files || []);
          files.forEach(f => handleAddPhoto('arrival', f));
          e.target.value = '';
        }}
      />
      <input
        type="file"
        id={arrivalUploadId}
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          e.stopPropagation();
          const files = Array.from(e.target.files || []);
          files.forEach(f => handleAddPhoto('arrival', f));
          e.target.value = '';
        }}
      />
      <input
        type="file"
        id={issueCaptureId}
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          e.stopPropagation();
          const files = Array.from(e.target.files || []);
          files.forEach(f => handleAddPhoto('issue_area', f));
          e.target.value = '';
        }}
      />
      <input
        type="file"
        id={issueUploadId}
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          e.stopPropagation();
          const files = Array.from(e.target.files || []);
          files.forEach(f => handleAddPhoto('issue_area', f));
          e.target.value = '';
        }}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isReopening ? <Activity className="w-5 h-5 text-orange-500" /> : <Wrench className="w-5 h-5" />}
            {initialWorkOrderId ? (isReopening ? "Reopen & Configure Work Order" : "Edit Work Order Configuration") : "Create Work Order"}
          </CardTitle>
          <CardDescription>
            {isReopening
              ? `Reopening work order for ${selectedVehicle?.vehicle_number || 'this vehicle'}. Please review and update services.`
              : "Configure multiple services, tasks, and staff assignments for this vehicle."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isReviewing ? (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex items-center justify-between border-b pb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Review Work Order Details
                </h3>
                <Button variant="outline" size="sm" onClick={() => setIsReviewing(false)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Form
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Vehicle & Customer Summary */}
                <div className="space-y-4">
                  <div className="p-4 bg-muted/30 rounded-xl border space-y-3 relative group">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => { setIsReviewing(false); setTimeout(() => document.getElementById('vehicle-selection')?.scrollIntoView({ behavior: 'smooth' }), 100); }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Vehicle & Customer
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Customer</p>
                        <p className="font-medium">{customers.find(c => c.id === customerId)?.name || "New Customer"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Vehicle Number</p>
                        <p className="font-medium uppercase">{selectedVehicle?.vehicle_number || "New Vehicle"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Odometer Reading</p>
                        <p className="font-medium">{lifecycleData.odometer_reading} KM</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Priority</p>
                        <Badge variant="outline" className={cn(
                          "text-[10px]",
                          priority === 'High' ? "bg-red-50 text-red-700 border-red-200" :
                          priority === 'Medium' ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-blue-50 text-blue-700 border-blue-200"
                        )}>
                          {priority}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* 2. Photo Gallery Summary */}
                  <div className="p-4 bg-muted/30 rounded-xl border space-y-4 relative group">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => { setIsReviewing(false); setTimeout(() => document.getElementById('photo-section')?.scrollIntoView({ behavior: 'smooth' }), 100); }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      Condition Photos ({arrivalPhotos.length + issuePhotos.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {[...arrivalPhotos, ...issuePhotos].map((photo, i) => (
                        <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border shadow-sm">
                          <img src={photo.previewUrl} className="w-full h-full object-cover" alt="Preview" />
                        </div>
                      ))}
                      {arrivalPhotos.length + issuePhotos.length === 0 && <p className="text-xs italic text-muted-foreground">No photos captured</p>}
                    </div>
                  </div>
                </div>

                {/* 3. Service & Task Breakdown */}
                <div className="space-y-4">
                  <div className="p-4 bg-muted/30 rounded-xl border space-y-4 relative group">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => { setIsReviewing(false); setTimeout(() => document.getElementById('service-selection')?.scrollIntoView({ behavior: 'smooth' }), 100); }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <ListOrdered className="h-4 w-4" />
                      Service Breakdown
                    </h4>
                    <div className="space-y-3">
                      {selectedServices.map(type => {
                        const data = serviceSections[type];
                        if (!data) return null;
                        return (
                          <div key={type} className="border-b border-dashed pb-2 last:border-0 last:pb-0">
                            <div className="flex justify-between items-start">
                              <span className="font-medium text-sm">{data.serviceType}</span>
                              <span className="text-sm font-bold">₹{data.cost}</span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {data.tasks.map((t, i) => (
                                <Badge key={i} variant="outline" className="text-[9px] h-4 py-0">{t.name}</Badge>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                      <div className="pt-2 flex justify-between items-center text-lg font-bold text-primary">
                        <span>Total Estimated Cost</span>
                        <span>₹{totalEstimatedCost}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Controls */}
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center pt-6 border-t mt-8">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setIsReviewing(false)}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Form
                </Button>
                
                <div className="flex gap-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onCancel}
                  >
                    Discard Draft
                  </Button>
                  <Button 
                    type="button" 
                    size="lg" 
                    className="px-8 font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200"
                    onClick={() => handleSubmit()}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 mr-2" />
                        Finalize & Create Work Order
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
          {isReopening && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg mb-6 flex items-start gap-4">
              <div className="p-2 bg-orange-100 rounded-full">
                <Activity className="h-5 w-5 text-orange-600" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-orange-800">Reopen Reason</h4>
                <p className="text-sm text-orange-700 italic">"{internalReopenReason}"</p>
              </div>
            </div>
          )}

          {initialData?.requestedServices && initialData.requestedServices.length > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6 flex items-start gap-4">
              <div className="p-2 bg-blue-100 rounded-full">
                <ClipboardList className="h-5 w-5 text-blue-600" />
              </div>
              <div className="space-y-1 flex-1">
                <h4 className="font-bold text-blue-800 uppercase text-xs tracking-wider">Services Requested by Customer</h4>
                <div className="flex flex-wrap gap-2 mt-2">
                  {initialData.requestedServices.map((s, i) => (
                    <Badge key={i} variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="space-y-8">

              {/* 1. Vehicle & Customer Details */}
              <div id="vehicle-selection" className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-semibold">Vehicle Details</h3>
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
                      disabled={!!initialWorkOrderId}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Customer
                    </Button>
                  </div>
                  <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-between" disabled={loadingCustomers || !!initialWorkOrderId}>
                        {customerId
                          ? getCustomerDisplayName(customers.find(c => c.id === customerId) || { id: customerId, name: "Loading..." } as any)
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
                              <CommandItem key={customer.id} value={getCustomerDisplayName(customer)} onSelect={() => handleCustomerSelect(customer.id)} className="flex justify-between items-center group cursor-pointer">
                                <span>{getCustomerDisplayName(customer)}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-muted"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`/admin/customers?edit=${customer.id}`, '_blank');
                                  }}
                                  title="Edit Customer"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
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
                      disabled={!!initialWorkOrderId}
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
                      <Button type="button" variant="outline" className="w-full justify-between" disabled={!customerId || loadingVehicles || !!initialWorkOrderId}>
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
                                type="button"
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
                              <CommandItem key={vehicle.id} value={`${vehicle.vehicle_number} ${vehicle.model}`} onSelect={() => handleVehicleSelect(vehicle.id)} className="flex justify-between items-center group cursor-pointer">
                                <span>{vehicle.vehicle_number} - {vehicle.model}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-muted"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`/admin/vehicles?edit=${vehicle.id}`, '_blank');
                                  }}
                                  title="Edit Vehicle"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </CommandItem>
                            ))}
                            {filteredVehicleList.length > 0 && (
                              <div className="border-t pt-2 mt-2">
                                <Button
                                  type="button"
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
                  {/* Vehicle Type Display */}
                  {vehicleId && selectedVehicle && (
                    <div className="mt-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded-md border flex items-center gap-2">
                      <span className="font-semibold">Type:</span>
                      {selectedVehicle.vehicle_type_name || 'N/A'}
                      <span className="text-gray-300">|</span>
                      <span className="font-semibold">Category:</span>
                      {selectedVehicle.vehicle_category_name || 'N/A'}
                    </div>
                  )}
                </div>

                {/* Driver Information Section */}
                {customerId && (
                  <div className="space-y-4 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      <h4 className="font-bold text-base text-blue-900">Driver Information *</h4>
                      <span className="text-xs text-red-600 font-semibold">(Required)</span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {/* Driver Name with Auto-Suggest */}
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Driver Name *</Label>
                        <Popover open={driverSearchOpen} onOpenChange={setDriverSearchOpen}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" className="w-full justify-between h-11 text-base border-2 hover:border-blue-400">
                              {driverName || "Select or enter driver name..."}
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Search or type new driver..."
                                value={driverSearch}
                                onValueChange={handleDriverNameChange}
                              />
                              <CommandList>
                                {driverSuggestions.length === 0 && driverSearch && (
                                  <CommandEmpty>
                                    <div className="p-2 text-center">
                                      <p className="text-sm text-muted-foreground mb-2">
                                        No existing driver found. Type to add new.
                                      </p>
                                    </div>
                                  </CommandEmpty>
                                )}
                                {driverSuggestions.length === 0 && !driverSearch && (
                                  <CommandEmpty>No drivers found for this company.</CommandEmpty>
                                )}
                                {driverSuggestions.length > 0 && (
                                  <CommandGroup heading="Existing Drivers">
                                    {driverSuggestions
                                      .filter(d => d.name.toLowerCase().includes(driverSearch.toLowerCase()))
                                      .map((driver) => (
                                        <CommandItem
                                          key={driver.id}
                                          value={driver.name}
                                          onSelect={() => handleDriverSelect(driver)}
                                          className="flex flex-col items-start cursor-pointer"
                                        >
                                          <span className="font-medium">{driver.name}</span>
                                          <span className="text-xs text-muted-foreground">
                                            {driver.driver_position || 'Driver'} • {driver.contact_number || 'No contact'}
                                          </span>
                                        </CommandItem>
                                      ))}
                                  </CommandGroup>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Driver Contact and Position - Grid Layout (only show if name is filled) */}
                      {driverName && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Driver Contact */}
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-gray-700">Contact Number *</Label>
                            <Input
                              type="tel"
                              placeholder="Enter driver contact number..."
                              value={driverContact}
                              onChange={async (e) => {
                                // Only allow digits, max 10
                                const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                                setDriverContact(value);

                                // Check for duplicates when 10 digits and valid
                                if (value.length === 10 && /^[6-9]/.test(value)) {
                                  const result = await checkDuplicatePhone(value);
                                  if (result.isDuplicate) {
                                    setDuplicatePhoneData(result);
                                    setShowDuplicateDialog(true);
                                  }
                                }
                              }}
                              className={`h-11 text-base border-2 ${driverContact.length === 10 && /^[6-9]/.test(driverContact)
                                ? 'border-green-500 focus-visible:ring-green-500'
                                : driverContact.length === 10
                                  ? 'border-destructive focus-visible:ring-destructive'
                                  : driverContact.length > 0
                                    ? 'border-blue-400 focus-visible:ring-blue-400'
                                    : ''
                                }`}
                              maxLength={10}
                              pattern="[0-9]*"
                              inputMode="numeric"
                            />
                            {driverContact.length > 0 && (
                              <p className={`text-xs ${driverContact.length === 10 && /^[6-9]/.test(driverContact)
                                ? 'text-green-600'
                                : driverContact.length === 10
                                  ? 'text-destructive'
                                  : 'text-muted-foreground'
                                }`}>
                                {driverContact.length === 10 && /^[6-9]/.test(driverContact)
                                  ? '✓ Valid phone number'
                                  : driverContact.length === 10
                                    ? 'Must start with 6, 7, 8, or 9'
                                    : `${driverContact.length}/10 digits`}
                              </p>
                            )}
                          </div>

                          {/* Driver Position */}
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-gray-700">Position/Role</Label>
                            <Select value={driverPosition} onValueChange={setDriverPosition}>
                              <SelectTrigger className="h-11 text-base border-2">
                                <SelectValue placeholder="Select driver position..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Driver">Driver</SelectItem>
                                <SelectItem value="Fleet Supervisor">Fleet Supervisor</SelectItem>
                                <SelectItem value="Transport Manager">Transport Manager</SelectItem>
                                <SelectItem value="Owner">Owner</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}


                {/* General Description - Full Width */}
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-semibold text-gray-700">General Description</Label>
                  <Textarea
                    placeholder="Brief overview of the requested work..."
                    rows={2}
                    value={generalDescription}
                    onChange={(e) => setGeneralDescription(e.target.value)}
                    className="resize-none"
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
                            type="button"
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
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      Service Advisor
                    </label>
                    <div className="flex items-center gap-2">
                      {user?.email && employees.find(e => e.email === user.email) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => {
                            const me = employees.find(e => e.email === user.email);
                            if (me) setAssignedTo(me.id);
                          }}
                        >
                          Set to Me
                        </Button>
                      )}
                      {assignedTo && (
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                          Advisor Selected
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Select value={assignedTo} onValueChange={setAssignedTo}>
                    <SelectTrigger className={!assignedTo ? "border-orange-500 bg-orange-50/30" : ""}>
                      <SelectValue placeholder="Select Advisor" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!assignedTo && (
                    <p className="text-[10px] text-orange-600 font-medium italic">
                      Please select the advisor for this work order
                    </p>
                  )}
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
              {selectedVehicle && (
                <div className="text-xs flex items-center gap-2 ml-6 text-muted-foreground mb-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Type</span>
                    <span className="font-medium text-foreground">{selectedVehicle.vehicle_type_name || 'N/A'}</span>
                  </div>
                  <div className="h-8 w-px bg-border mx-2"></div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Category</span>
                    <span className="font-medium text-foreground">{selectedVehicle.vehicle_category_name || 'N/A'}</span>
                  </div>
                </div>
              )}
              {selectedVehicle && (
                <div className="mx-6 mb-4 p-2 bg-yellow-50/50 border border-yellow-100 rounded text-[10px] text-yellow-700">
                  <span className="font-semibold">Note:</span> Price updates for tasks will be applied to the <strong>{selectedVehicle.vehicle_category_name}</strong> category only.
                </div>
              )}
              <div className="flex justify-end mb-2">
                <Popover open={showAddServiceDialog} onOpenChange={setShowAddServiceDialog}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1">
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
                        <div className="flex items-center justify-between">
                          <Label>Category</Label>
                          <Button
                            type="button"
                            variant="ghost" size="sm" className="h-6 w-6 p-0"
                            onClick={() => { setMasterType('Category'); setShowAddMasterDialog(true); }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Select
                          value={newServiceCategory}
                          onValueChange={setNewServiceCategory}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select Category" />
                          </SelectTrigger>
                          <SelectContent>
                            {serviceCategories.map(c => (
                              <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                                  type="button"
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
                        type="button"
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
                      <Button type="button" variant="outline" onClick={() => setEditingService(null)}>Cancel</Button>
                      <Button type="button" onClick={handleUpdateService} disabled={!editServiceName.trim() || isUpdatingService}>
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

              {/* Service Selection Header & FC Toggle */}
              <div className="flex items-center justify-between mt-6 mb-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Service Details
                </h3>

                {/* FC Work Toggle - Prominent placement */}
                <div className="flex items-center space-x-2 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-200">
                  <Checkbox
                    id="fc_mode"
                    checked={isFCWork}
                    onCheckedChange={(checked) => {
                      setIsFCWork(checked as boolean);
                      setLifecycleData(prev => ({ ...prev, is_fc_renewal: checked as boolean }));
                    }}
                    className="data-[state=checked]:bg-yellow-600 data-[state=checked]:border-yellow-600"
                  />
                  <label
                    htmlFor="fc_mode"
                    className="text-sm font-bold leading-none cursor-pointer text-yellow-900"
                  >
                    FC Work Order?
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {displayedServices
                  .map((type) => (
                    <div key={type.id} className="group relative flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/50 transition-colors pr-12">
                      <Checkbox
                        id={`service-${type.id}`}
                        checked={selectedServices.includes(type.name)}
                        onCheckedChange={(checked) => handleServiceToggle(type.name, checked as boolean)}
                      />
                      <Label
                        htmlFor={`service-${type.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                      >
                        {type.name}
                      </Label>

                      {/* Action Buttons */}
                      < div className="absolute right-1 top-1/2 -translate-y-1/2 flex opacity-0 group-hover:opacity-100 transition-opacity" >
                        <Button
                          type="button"
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
                          type="button"
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

                    // Use computedTaskTemplates instead of raw taskTemplates
                    const sectionTasks = serviceId ? computedTaskTemplates.filter(t => t.service_type_id === serviceId) : [];

                    return (
                      <ServiceSection
                        key={type}
                        serviceType={data.serviceType}
                        serviceId={serviceId}
                        basePrice={dbServiceTypes.find(s => s.id === serviceId)?.base_price}
                        data={data}
                        availableEmployees={employees}
                        availableTasks={sectionTasks}
                        onChange={handleSectionUpdate}
                        onRemove={() => handleRemoveSection(type)}
                        onCustomTaskAdd={serviceId ? (name, price) => handleCustomTaskAdd(serviceId, name, price) : undefined}
                        onTaskUpdate={handleUpdateTaskTemplate}
                        onTaskDelete={handleDeleteTaskTemplate}
                        workOrderId={initialWorkOrderId}
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="odometer" className="text-xs">Current Odometer (KM)</Label>
                  <Input
                    id="odometer"
                    type="number"
                    value={lifecycleData.odometer_reading || ''}
                    onChange={(e) => {
                      const km = parseInt(e.target.value) || 0;
                      setLifecycleData(prev => ({
                        ...prev,
                        odometer_reading: km,
                        next_service_due_km: prev.next_service_due_km && prev.next_service_due_km > km ? prev.next_service_due_km : (km > 0 ? km + 10000 : 0)
                      }));
                    }}
                    placeholder="e.g. 50000"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="next_service" className="text-xs">Next Service Due (KM)</Label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setLifecycleData(p => ({ ...p, next_service_due_km: (p.odometer_reading || 0) + 5000 }))}
                        className="text-[10px] text-primary hover:underline font-medium"
                      >
                        +5k
                      </button>
                      <button
                        type="button"
                        onClick={() => setLifecycleData(p => ({ ...p, next_service_due_km: (p.odometer_reading || 0) + 10000 }))}
                        className="text-[10px] text-primary hover:underline font-medium"
                      >
                        +10k
                      </button>
                    </div>
                  </div>
                  <Input
                    id="next_service"
                    type="number"
                    value={lifecycleData.next_service_due_km || ''}
                    onChange={(e) => setLifecycleData(prev => ({ ...prev, next_service_due_km: parseInt(e.target.value) || 0 }))}
                    placeholder="e.g. 60000"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="next_service_date" className="text-xs">Next Service Due Date</Label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setMonth(d.getMonth() + 3);
                          setLifecycleData(p => ({ ...p, next_service_due_date: d.toISOString().split('T')[0] }));
                        }}
                        className="text-[10px] text-primary hover:underline font-medium"
                      >
                        +3m
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setMonth(d.getMonth() + 6);
                          setLifecycleData(p => ({ ...p, next_service_due_date: d.toISOString().split('T')[0] }));
                        }}
                        className="text-[10px] text-primary hover:underline font-medium"
                      >
                        +6m
                      </button>
                    </div>
                  </div>
                  <Input
                    id="next_service_date"
                    type="date"
                    value={lifecycleData.next_service_due_date || ''}
                    onChange={(e) => setLifecycleData(prev => ({ ...prev, next_service_due_date: e.target.value }))}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Relevant Contact Person for this service */}
              {companyContacts.length > 0 && (
                <div className="space-y-1.5 p-3 rounded-lg border bg-muted/20">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="service_contact" className="text-xs font-semibold flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-primary" />
                      Relevant Contact Person for this Work Order
                    </Label>
                    <span className="text-[10px] text-muted-foreground">
                      Person to notify upon service completion & reminders
                    </span>
                  </div>
                  <Select
                    value={contactId || "none"}
                    onValueChange={(val) => setContactId(val === "none" ? "" : val)}
                  >
                    <SelectTrigger id="service_contact" className="h-9 text-xs">
                      <SelectValue placeholder="Select contact person..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Use Company Default</SelectItem>
                      {companyContacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.designation || 'Contact'}) • {c.phone} {c.is_primary ? "★ Primary" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}


            </div>

            {/* 4. Vehicle Photos Section */}
            <div id="photo-section" className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Vehicle Arrival & Condition Photos
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Arrival Photos */}
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Arrival Photos (Overall Condition)</Label>
                  <div className="flex flex-wrap gap-2">
                    {arrivalPhotos.map((photo, index) => (
                      <div key={index} className="relative w-24 h-24 rounded-lg overflow-hidden border shadow-sm group">
                        <img src={photo.previewUrl} className="w-full h-full object-cover" alt="Arrival condition" />
                        <button type="button"
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemovePhoto('arrival', index)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2">
                      <label
                        htmlFor={arrivalCaptureId}
                        className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors bg-muted/20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Camera className="h-6 w-6 text-muted-foreground" />
                        <span className="text-[10px] mt-1 font-medium">Capture</span>
                      </label>
                      
                      <label
                        htmlFor={arrivalUploadId}
                        className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors bg-muted/20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <UploadIcon className="h-6 w-6 text-muted-foreground" />
                        <span className="text-[10px] mt-1 font-medium">Upload</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Issue Area Photos */}
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Issue Area Photos (Damage/Concern)</Label>
                  <div className="flex flex-wrap gap-2">
                    {issuePhotos.map((photo, index) => (
                      <div key={index} className="relative w-24 h-24 rounded-lg overflow-hidden border shadow-sm group">
                        <img src={photo.previewUrl} className="w-full h-full object-cover" alt="Issue area" />
                        <button type="button"
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemovePhoto('issue_area', index)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2">
                      <label
                        htmlFor={issueCaptureId}
                        className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors bg-muted/20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Camera className="h-6 w-6 text-muted-foreground" />
                        <span className="text-[10px] mt-1 font-medium">Capture</span>
                      </label>

                      <label
                        htmlFor={issueUploadId}
                        className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors bg-muted/20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <UploadIcon className="h-6 w-6 text-muted-foreground" />
                        <span className="text-[10px] mt-1 font-medium">Upload</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Vehicle Belongings Section */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Package className="h-4 w-4" />
                Vehicle Belongings Tracker
              </h3>

              <div className="bg-muted/30 p-4 rounded-xl border border-dashed border-muted-foreground/30">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end mb-4">
                  <div className="space-y-1">
                    <Label htmlFor="item-name" className="text-xs">Item Name *</Label>
                    <div className="flex gap-2">
                      <Select
                        value={newBelonging.name}
                        onValueChange={(val) => setNewBelonging(prev => ({ ...prev, name: val }))}
                      >
                        <SelectTrigger className="h-9 min-w-[150px]">
                          <SelectValue placeholder="Select Item" />
                        </SelectTrigger>
                        <SelectContent>
                          {belongingTemplates.map(t => (
                            <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                          ))}
                          <div className="p-2 border-t">
                            <div className="flex gap-1">
                              <Input
                                placeholder="Other item..."
                                className="h-7 text-xs"
                                onKeyDown={(e) => e.stopPropagation()}
                                onChange={(e) => setNewBelonging(prev => ({ ...prev, name: e.target.value }))}
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 px-2"
                                onClick={handleAddBelongingTemplate}
                                disabled={isAddingBelongingTemplate}
                              >
                                {isAddingBelongingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                              </Button>
                            </div>
                          </div>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="item-desc" className="text-xs">Description (Color, Brand)</Label>
                    <Input
                      id="item-desc"
                      placeholder="e.g. Black Dell Bag"
                      value={newBelonging.description}
                      onChange={(e) => setNewBelonging(prev => ({ ...prev, description: e.target.value }))}
                      className="h-9"
                    />
                  </div>
                  <div className="flex gap-2">
                    <label
                      className={cn(
                        "flex-1 h-9 flex items-center justify-center gap-2 border rounded-md cursor-pointer text-xs font-medium transition-colors",
                        belongingFile ? "bg-green-50 border-green-200 text-green-700" : "bg-background border-input hover:bg-accent"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {belongingFile ? <CheckCircle2 className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                      {belongingFile ? "Attached" : "Capture"}
                      <input
                        id={`belonging-capture-${initialWorkOrderId || 'new'}`}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          e.stopPropagation();
                          setBelongingFile(e.target.files?.[0] || null);
                        }}
                      />
                    </label>
                    <label
                      className={cn(
                        "flex-1 h-9 flex items-center justify-center gap-2 border rounded-md cursor-pointer text-xs font-medium transition-colors",
                        belongingFile ? "bg-green-50 border-green-200 text-green-700" : "bg-background border-input hover:bg-accent"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {belongingFile ? <CheckCircle2 className="h-4 w-4" /> : <UploadIcon className="h-4 w-4" />}
                      {belongingFile ? "Attached" : "Upload"}
                      <input
                        id={`belonging-upload-${initialWorkOrderId || 'new'}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          e.stopPropagation();
                          setBelongingFile(e.target.files?.[0] || null);
                        }}
                      />
                    </label>
                    <Button type="button" onClick={handleAddBelongingItem} size="sm" className="h-9">
                      Add Item
                    </Button>
                  </div>
                </div>

                {belongings.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {belongings.map((item, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-background border rounded-lg shadow-sm">
                        <div className="w-12 h-12 rounded overflow-hidden border">
                          <img src={item.previewUrl} className="w-full h-full object-cover" alt={item.name} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{item.description || "No description"}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveBelonging(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-muted-foreground">
                    No belongings recorded. Items like jackets, electronics, or tools should be tracked.
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {!isReviewing && (
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center pt-6 border-t mt-8">
                <Button type="button" variant="ghost" onClick={onCancel}>
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  onClick={() => {
                    if (!customerId || !vehicleId || selectedServices.length === 0) {
                      toast({
                        title: "Incomplete Form",
                        description: "Please select a Customer, Vehicle, and at least one Service.",
                        variant: "destructive"
                      });
                      return;
                    }
                    setIsReviewing(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }} 
                  disabled={isLoading || (selectedServices.length === 0 && !isReopening)} 
                  size="lg" 
                  className="w-full sm:w-auto font-bold"
                >
                  Next: Review Details
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
          </>
          )}
        </CardContent>
      </Card >

      {/* Add New Vehicle Dialog */}
      < Dialog open={showAddVehicleDialog} onOpenChange={setShowAddVehicleDialog} >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Register New Vehicle
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleCreateVehicle(); }} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 border p-3 rounded-md bg-muted/20">
              {/* Manufacturer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Manufacturer *</Label>
                  <Button
                    type="button" variant="ghost" size="sm" className="h-6 w-6 p-0"
                    onClick={() => { setMasterType('Manufacturer'); setShowAddMasterDialog(true); }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Select
                  value={newVehicleData.manufacturer_id}
                  onValueChange={(val) => setNewVehicleData(prev => ({ ...prev, manufacturer_id: val }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select Manufacturer" /></SelectTrigger>
                  <SelectContent>
                    {manufacturers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Category *</Label>
                  <Button
                    type="button" variant="ghost" size="sm" className="h-6 w-6 p-0"
                    onClick={() => { setMasterType('Category'); setShowAddMasterDialog(true); }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Select
                  value={newVehicleData.category_id}
                  onValueChange={(val) => setNewVehicleData(prev => ({ ...prev, category_id: val, vehicle_type_id: "" }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Type */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Vehicle Type *</Label>
                  <Button
                    type="button" variant="ghost" size="sm" className="h-6 w-6 p-0"
                    onClick={() => { setMasterType('Type'); setShowAddMasterDialog(true); }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Select
                  value={newVehicleData.vehicle_type_id}
                  onValueChange={(val) => setNewVehicleData(prev => ({ ...prev, vehicle_type_id: val, model_id: "" }))}
                  disabled={!newVehicleData.category_id}
                >
                  <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                  <SelectContent>
                    {availableTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Model */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Model *</Label>
                  <Button
                    type="button" variant="ghost" size="sm" className="h-6 w-6 p-0"
                    onClick={() => { setMasterType('Model'); setShowAddMasterDialog(true); }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Select
                  value={newVehicleData.model_id}
                  onValueChange={(val) => setNewVehicleData(prev => ({ ...prev, model_id: val }))}
                  disabled={!newVehicleData.manufacturer_id || !newVehicleData.vehicle_type_id}
                >
                  <SelectTrigger><SelectValue placeholder="Select Model" /></SelectTrigger>
                  <SelectContent>
                    {availableModels.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

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
      </Dialog >

      {/* Add Master Data Dialog */}
      <Dialog open={showAddMasterDialog} onOpenChange={setShowAddMasterDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New {masterType}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{masterType} Name</Label>
              <Input
                value={masterName}
                onChange={(e) => setMasterName(e.target.value)}
                placeholder={`Enter ${masterType.toLowerCase()} name`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowAddMasterDialog(false)}>Cancel</Button>
            <Button
              type="button"
              onClick={async () => {
                if (!masterName.trim()) return;
                setIsAddingMaster(true);
                let newId = "";
                if (masterType === 'Manufacturer') newId = await handleCreateManufacturerData(masterName.trim()) || "";
                if (masterType === 'Category') {
                  newId = await handleCreateCategoryData(masterName.trim()) || "";
                  // Also refresh Service categories if it was a service category
                  const { data: scav } = await supabase.from('service_categories').select('*').order('name');
                  if (scav) setServiceCategories(scav);
                }
                if (masterType === 'Type') newId = await handleCreateTypeData(masterName.trim(), newVehicleData.category_id || newCustomerVehicleData.category_id) || "";
                if (masterType === 'Model') newId = await handleCreateModelData(masterName.trim(), newVehicleData.manufacturer_id || newCustomerVehicleData.manufacturer_id, newVehicleData.vehicle_type_id || newCustomerVehicleData.vehicle_type_id) || "";

                if (newId) {
                  // Auto select the newly created item in the corresponding data state
                  if (masterType === 'Manufacturer') setNewVehicleData(prev => ({ ...prev, manufacturer_id: newId }));
                  if (masterType === 'Category') setNewVehicleData(prev => ({ ...prev, category_id: newId }));
                  if (masterType === 'Type') setNewVehicleData(prev => ({ ...prev, vehicle_type_id: newId }));
                  if (masterType === 'Model') setNewVehicleData(prev => ({ ...prev, model_id: newId }));
                }

                setMasterName("");
                setShowAddMasterDialog(false);
                setIsAddingMaster(false);
              }}
              disabled={isAddingMaster || !masterName.trim()}
            >
              {isAddingMaster ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Add New Customer + Vehicle Dialog */}
      <Dialog open={showAddCustomerDialog} onOpenChange={setShowAddCustomerDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add New Customer & Vehicle</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); handleCreateCustomer(); }} className="space-y-6 py-4">
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Customer Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Name *</Label><Input value={newCustomerData.name} onChange={e => setNewCustomerData(p => ({ ...p, name: e.target.value }))} required /></div>
                <div className="space-y-2"><Label>Phone *</Label><Input value={newCustomerData.phone} onChange={e => setNewCustomerData(p => ({ ...p, phone: e.target.value }))} required /></div>
              </div>
            </div>

            <div className="flex items-center gap-2 py-2 border-y">
              <Checkbox id="inc_v_cust" checked={includeVehicle} onCheckedChange={v => setIncludeVehicle(v as boolean)} />
              <Label htmlFor="inc_v_cust" className="text-sm font-medium cursor-pointer">Register Vehicle now?</Label>
            </div>

            {includeVehicle && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Manufacturer *</Label>
                    <Select value={newCustomerVehicleData.manufacturer_id} onValueChange={v => setNewCustomerVehicleData(p => ({ ...p, manufacturer_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{manufacturers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Select value={newCustomerVehicleData.category_id} onValueChange={v => setNewCustomerVehicleData(p => ({ ...p, category_id: v, vehicle_type_id: "" }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type *</Label>
                    <Select
                      value={newCustomerVehicleData.vehicle_type_id}
                      onValueChange={v => setNewCustomerVehicleData(p => ({ ...p, vehicle_type_id: v, model_id: "" }))}
                      disabled={!newCustomerVehicleData.category_id}
                    >
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{vehicleTypes.filter(t => t.category_id === newCustomerVehicleData.category_id).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Model *</Label>
                    <Select
                      value={newCustomerVehicleData.model_id}
                      onValueChange={v => setNewCustomerVehicleData(p => ({ ...p, model_id: v }))}
                      disabled={!newCustomerVehicleData.manufacturer_id || !newCustomerVehicleData.vehicle_type_id}
                    >
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{vehicleModels.filter(m => m.manufacturer_id === newCustomerVehicleData.manufacturer_id && m.vehicle_type_id === newCustomerVehicleData.vehicle_type_id).map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Vehicle Number *</Label>
                    <Input value={newCustomerVehicleData.vehicle_number} onChange={e => setNewCustomerVehicleData(p => ({ ...p, vehicle_number: e.target.value.toUpperCase() }))} />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowAddCustomerDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={isCreatingCustomer}>
                {isCreatingCustomer ? "Creating..." : "Create Customer & Vehicle"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Duplicate Phone Dialog */}
      {duplicatePhoneData && (
        <DuplicatePhoneDialog
          open={showDuplicateDialog}
          onOpenChange={setShowDuplicateDialog}
          duplicateData={duplicatePhoneData}
          onContinue={() => {
            // User wants to proceed with the existing driver
            if (duplicatePhoneData.existingUser?.type === 'driver') {
              setDriverName(duplicatePhoneData.existingUser.name);
              setDriverContact(duplicatePhoneData.existingUser.phone);
            }
            setShowDuplicateDialog(false);
          }}
          onCancel={() => {
            // Clear the phone number
            setDriverContact('');
            setShowDuplicateDialog(false);
          }}
        />
      )}
    </div >
  )
}
