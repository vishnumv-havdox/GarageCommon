import { useState, useEffect, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    Calendar as CalendarIcon,
    Clock,
    User,
    Car,
    Wrench,
    CheckCircle2,
    Plus,
    Search,
    Building2,
    Phone,
    X,
    AlertCircle,
    Check,
    ChevronsUpDown,
    Users,
    FileText,
    Sparkles,
    Loader2
} from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VehiclePlateBadge } from "@/components/shared/VehiclePlateBadge";

interface AdminBookAppointmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultDate?: Date;
    onSuccess?: () => void;
}

interface CustomerOption {
    id: string;
    name: string;
    phone: string;
    company_name?: string | null;
    email?: string | null;
}

interface VehicleOption {
    id: string;
    customer_id: string;
    vehicle_number: string;
    vehicle_no?: string | null;
    model?: string | null;
    year?: number | null;
    vehicle_type?: string | null;
    color?: string | null;
    model_id?: string | null;
    vehicle_models?: {
        id: string;
        name: string;
        vehicle_manufacturers?: {
            id: string;
            name: string;
        } | null;
        vehicle_types?: {
            id: string;
            name: string;
        } | null;
    } | null;
}

interface CatalogOption {
    id: string;
    display_name: string;
    description?: string | null;
    estimated_cost: number;
    estimated_duration_minutes?: number | null;
}

const PRESET_TIMES = [
    { label: "09:00 AM", value: "09:00" },
    { label: "09:30 AM", value: "09:30" },
    { label: "10:00 AM", value: "10:00" },
    { label: "10:30 AM", value: "10:30" },
    { label: "11:00 AM", value: "11:00" },
    { label: "11:30 AM", value: "11:30" },
    { label: "12:00 PM", value: "12:00" },
    { label: "02:00 PM", value: "14:00" },
    { label: "02:30 PM", value: "14:30" },
    { label: "03:00 PM", value: "15:00" },
    { label: "03:30 PM", value: "15:30" },
    { label: "04:00 PM", value: "16:00" },
    { label: "04:30 PM", value: "16:30" },
    { label: "05:00 PM", value: "17:00" },
    { label: "05:30 PM", value: "17:30" },
    { label: "06:00 PM", value: "18:00" }
];

export function AdminBookAppointmentDialog({
    open,
    onOpenChange,
    defaultDate,
    onSuccess
}: AdminBookAppointmentDialogProps) {
    const { user } = useAuth();
    const { toast } = useToast();

    // Data state
    const [customers, setCustomers] = useState<CustomerOption[]>([]);
    const [allVehicles, setAllVehicles] = useState<VehicleOption[]>([]);
    const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
    const [catalogItems, setCatalogItems] = useState<CatalogOption[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    const [loadingVehicles, setLoadingVehicles] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [customerComboboxOpen, setCustomerComboboxOpen] = useState(false);
    const [customerSearch, setCustomerSearch] = useState("");
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
    const [appointmentType, setAppointmentType] = useState<"service" | "face_to_face">("service");
    const [selectedDate, setSelectedDate] = useState<Date>(defaultDate || new Date());
    const [selectedTime, setSelectedTime] = useState<string>("10:00");
    const [initialStatus, setInitialStatus] = useState<"confirmed" | "pending">("confirmed");
    const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([]);
    const [customServices, setCustomServices] = useState<string[]>([]);
    const [newCustomService, setNewCustomService] = useState("");
    const [notes, setNotes] = useState("");

    // Initial load
    useEffect(() => {
        if (open) {
            loadInitialData();
            if (defaultDate) {
                setSelectedDate(defaultDate);
            } else {
                setSelectedDate(new Date());
            }
        } else {
            // Reset state
            setSelectedCustomerId("");
            setSelectedVehicleId("");
            setVehicles([]);
            setSelectedCatalogIds([]);
            setCustomServices([]);
            setNewCustomService("");
            setNotes("");
            setCustomerSearch("");
            setInitialStatus("confirmed");
            setAppointmentType("service");
            setSelectedTime("10:00");
        }
    }, [open, defaultDate]);

    // Load/sync vehicles whenever customer selection changes
    useEffect(() => {
        if (selectedCustomerId) {
            loadCustomerVehicles(selectedCustomerId);
        } else {
            setVehicles([]);
            setSelectedVehicleId("");
        }
    }, [selectedCustomerId, allVehicles]);

    const loadInitialData = async () => {
        setLoadingData(true);
        try {
            const [custRes, vehRes, catRes, svcTypesRes] = await Promise.all([
                supabase
                    .from("customers")
                    .select("id, name, phone, company_name, email")
                    .order("name", { ascending: true }),
                supabase
                    .from("vehicles")
                    .select(`
                        id,
                        customer_id,
                        vehicle_number,
                        vehicle_no,
                        model,
                        year,
                        vehicle_type,
                        color,
                        model_id,
                        vehicle_models (
                            id,
                            name,
                            vehicle_manufacturers (id, name),
                            vehicle_types (id, name)
                        )
                    `)
                    .order("created_at", { ascending: false }),
                supabase
                    .from("booking_catalog")
                    .select("id, display_name, description, estimated_cost, estimated_duration_minutes")
                    .eq("is_active", true)
                    .order("display_name", { ascending: true }),
                supabase
                    .from("service_types")
                    .select("id, name, base_price")
                    .eq("is_active", true)
                    .order("name", { ascending: true })
            ]);

            if (custRes.data) {
                setCustomers(custRes.data as CustomerOption[]);
            }

            let loadedVehicles: VehicleOption[] = [];
            if (!vehRes.error && vehRes.data) {
                loadedVehicles = vehRes.data as unknown as VehicleOption[];
            } else {
                // Safe fallback query if relationship names vary
                const { data: fallbackVeh } = await supabase
                    .from("vehicles")
                    .select("*")
                    .order("created_at", { ascending: false });
                loadedVehicles = (fallbackVeh || []) as unknown as VehicleOption[];
            }
            setAllVehicles(loadedVehicles);

            let loadedCatalog: CatalogOption[] = [];
            if (catRes.data && catRes.data.length > 0) {
                loadedCatalog = catRes.data as CatalogOption[];
            } else if (svcTypesRes.data && svcTypesRes.data.length > 0) {
                loadedCatalog = svcTypesRes.data.map((st: any) => ({
                    id: st.id,
                    display_name: st.name,
                    description: null,
                    estimated_cost: st.base_price || 0,
                    estimated_duration_minutes: 60
                }));
            }
            setCatalogItems(loadedCatalog);
        } catch (err: any) {
            console.error("Error loading appointment dependencies:", err);
            toast({
                variant: "destructive",
                title: "Failed to load data",
                description: err.message || "Could not fetch customers or service catalog."
            });
        } finally {
            setLoadingData(false);
        }
    };

    const loadCustomerVehicles = async (custId: string) => {
        if (!custId) {
            setVehicles([]);
            setSelectedVehicleId("");
            return;
        }

        // Instantly populate from already cached allVehicles
        const cached = allVehicles.filter(v => v.customer_id === custId);
        setVehicles(cached);
        if (cached.length > 0) {
            setSelectedVehicleId(cached[0].id);
        } else {
            setSelectedVehicleId("");
        }

        // Also fetch fresh from database to ensure no stale data
        setLoadingVehicles(true);
        try {
            const { data, error } = await supabase
                .from("vehicles")
                .select(`
                    id,
                    customer_id,
                    vehicle_number,
                    vehicle_no,
                    model,
                    year,
                    vehicle_type,
                    color,
                    model_id,
                    vehicle_models (
                        id,
                        name,
                        vehicle_manufacturers (id, name),
                        vehicle_types (id, name)
                    )
                `)
                .eq("customer_id", custId)
                .order("created_at", { ascending: false });

            if (!error && data) {
                const fresh = data as unknown as VehicleOption[];
                setVehicles(fresh);
                if (fresh.length > 0) {
                    setSelectedVehicleId(fresh[0].id);
                } else {
                    setSelectedVehicleId("");
                }
            } else {
                // Safe simple query fallback
                const { data: fallbackData } = await supabase
                    .from("vehicles")
                    .select("*")
                    .eq("customer_id", custId)
                    .order("created_at", { ascending: false });

                const fallbackList = (fallbackData || []) as unknown as VehicleOption[];
                setVehicles(fallbackList);
                if (fallbackList.length > 0) {
                    setSelectedVehicleId(fallbackList[0].id);
                } else {
                    setSelectedVehicleId("");
                }
            }
        } catch (err: any) {
            console.error("Error refreshing customer vehicles:", err);
        } finally {
            setLoadingVehicles(false);
        }
    };

    const selectedCustomer = useMemo(() => {
        return customers.find(c => c.id === selectedCustomerId);
    }, [customers, selectedCustomerId]);

    // Format vehicle name display
    const getVehicleDisplay = (v: VehicleOption) => {
        const make = v.vehicle_models?.vehicle_manufacturers?.name || "";
        const modelName = v.vehicle_models?.name || v.model || "";
        const title = [make, modelName].filter(Boolean).join(" ") || "Vehicle";
        const plate = v.vehicle_number || v.vehicle_no || "N/A";
        return { title, plate };
    };

    // Filter customers including by linked vehicle plate/model
    const filteredCustomers = useMemo(() => {
        if (!customerSearch.trim()) return customers.slice(0, 50);
        const q = customerSearch.toLowerCase().trim();

        return customers.filter(c => {
            const matchName = c.name.toLowerCase().includes(q);
            const matchPhone = c.phone && c.phone.includes(q);
            const matchCompany = c.company_name && c.company_name.toLowerCase().includes(q);
            const matchEmail = c.email && c.email.toLowerCase().includes(q);

            // Also check if customer owns any vehicle matching query
            const matchVehicle = allVehicles.some(v => {
                if (v.customer_id !== c.id) return false;
                const plate = (v.vehicle_number || v.vehicle_no || "").toLowerCase();
                const model = (v.model || v.vehicle_models?.name || "").toLowerCase();
                const mfr = (v.vehicle_models?.vehicle_manufacturers?.name || "").toLowerCase();
                return plate.includes(q) || model.includes(q) || mfr.includes(q);
            });

            return matchName || matchPhone || matchCompany || matchEmail || matchVehicle;
        }).slice(0, 50);
    }, [customers, allVehicles, customerSearch]);

    const totalEstimatedCost = useMemo(() => {
        return selectedCatalogIds.reduce((sum, id) => {
            const item = catalogItems.find(i => i.id === id);
            return sum + (item?.estimated_cost || 0);
        }, 0);
    }, [selectedCatalogIds, catalogItems]);

    const toggleCatalogService = (id: string) => {
        setSelectedCatalogIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleAddCustomService = () => {
        const trimmed = newCustomService.trim();
        if (!trimmed) return;
        if (!customServices.includes(trimmed)) {
            setCustomServices(prev => [...prev, trimmed]);
        }
        setNewCustomService("");
    };

    const handleRemoveCustomService = (name: string) => {
        setCustomServices(prev => prev.filter(s => s !== name));
    };

    const handleQuickDate = (daysAhead: number) => {
        setSelectedDate(addDays(new Date(), daysAhead));
    };

    const handleSubmit = async () => {
        if (!selectedCustomerId) {
            toast({
                variant: "destructive",
                title: "Customer Required",
                description: "Please select a customer for this appointment."
            });
            return;
        }

        if (appointmentType === "service" && vehicles.length > 0 && !selectedVehicleId) {
            toast({
                variant: "destructive",
                title: "Vehicle Required",
                description: "Please select a vehicle for workshop service."
            });
            return;
        }

        if (!selectedDate) {
            toast({
                variant: "destructive",
                title: "Date Required",
                description: "Please choose an appointment date."
            });
            return;
        }

        setIsSubmitting(true);
        try {
            // Build scheduled datetime
            const [hours, minutes] = selectedTime.split(":").map(Number);
            const scheduledAt = new Date(selectedDate);
            scheduledAt.setHours(hours || 9, minutes || 0, 0, 0);

            // 1. Insert appointment
            const { data: newApp, error: appError } = await (supabase
                .from("appointments") as any)
                .insert({
                    customer_id: selectedCustomerId,
                    vehicle_id: selectedVehicleId || null,
                    type: appointmentType,
                    status: initialStatus,
                    scheduled_at: scheduledAt.toISOString(),
                    notes: notes.trim() || null,
                    created_by: user?.id,
                    status_updated_by: user?.id
                })
                .select()
                .single();

            if (appError || !newApp) {
                throw appError || new Error("Failed to insert appointment record.");
            }

            // 2. Insert appointment services if any selected
            const servicesToInsert: any[] = [];
            selectedCatalogIds.forEach(id => {
                const item = catalogItems.find(i => i.id === id);
                if (item) {
                    servicesToInsert.push({
                        appointment_id: newApp.id,
                        catalog_item_id: item.id,
                        service_name: item.display_name,
                        cost_estimate: item.estimated_cost || 0
                    });
                }
            });

            customServices.forEach(name => {
                servicesToInsert.push({
                    appointment_id: newApp.id,
                    catalog_item_id: null,
                    service_name: name,
                    cost_estimate: 0
                });
            });

            if (servicesToInsert.length > 0) {
                const { error: servError } = await (supabase
                    .from("appointment_services") as any)
                    .insert(servicesToInsert);

                if (servError) {
                    console.error("Warning: Failed to insert appointment services:", servError);
                }
            }

            // 3. Insert audit history
            await (supabase.from("appointment_history") as any).insert({
                appointment_id: newApp.id,
                new_status: initialStatus,
                changed_by: user?.id,
                action_type: "created",
                notes: `Appointment created by admin (${user?.email || "Admin"})`
            });

            toast({
                title: "Appointment Scheduled",
                description: `Successfully scheduled for ${selectedCustomer?.name} on ${format(scheduledAt, "MMM d, yyyy 'at' h:mm a")}.`
            });

            onSuccess?.();
            onOpenChange(false);
        } catch (err: any) {
            console.error("Error creating appointment:", err);
            toast({
                variant: "destructive",
                title: "Error Scheduling Appointment",
                description: err.message || "An unexpected error occurred."
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0 bg-background/95 backdrop-blur-xl border-border shadow-2xl rounded-2xl">
                {/* Header */}
                <DialogHeader className="p-6 pb-4 border-b border-border/60 bg-muted/20 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                                <CalendarIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold tracking-tight">
                                    Book New Appointment
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                    Schedule a workshop service or consultation directly for any customer.
                                </DialogDescription>
                            </div>
                        </div>
                        <Badge variant="outline" className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 font-mono text-xs font-semibold bg-background/50">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                            Admin Booking
                        </Badge>
                    </div>
                </DialogHeader>

                {/* Form Body - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Section 1: Customer Selection */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold flex items-center gap-2">
                                <User className="h-4 w-4 text-primary" />
                                Customer <span className="text-destructive">*</span>
                            </Label>
                            {selectedCustomer && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedCustomerId("");
                                        setSelectedVehicleId("");
                                    }}
                                    className="h-7 text-xs text-muted-foreground hover:text-destructive"
                                >
                                    <X className="h-3 w-3 mr-1" /> Change Customer
                                </Button>
                            )}
                        </div>

                        {!selectedCustomerId ? (
                            <Popover open={customerComboboxOpen} onOpenChange={setCustomerComboboxOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={customerComboboxOpen}
                                        className="w-full justify-between h-11 text-left font-normal bg-background/60 hover:bg-muted/40 border-border"
                                        disabled={loadingData}
                                    >
                                        <span className="flex items-center gap-2 text-muted-foreground truncate">
                                            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            {loadingData ? "Loading customers..." : "Search by customer name, phone, company, or vehicle number..."}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                    <Command shouldFilter={false}>
                                        <CommandInput
                                            placeholder="Type name, phone number, vehicle plate..."
                                            value={customerSearch}
                                            onValueChange={setCustomerSearch}
                                            className="h-10 text-sm"
                                        />
                                        <CommandList className="max-h-64">
                                            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                                                No customer or vehicle matching "{customerSearch}".
                                            </CommandEmpty>
                                            <CommandGroup heading="Registered Customers">
                                                {filteredCustomers.map(c => {
                                                    const custVehicles = allVehicles.filter(v => v.customer_id === c.id);
                                                    return (
                                                        <CommandItem
                                                            key={c.id}
                                                            value={c.id}
                                                            onSelect={() => {
                                                                setSelectedCustomerId(c.id);
                                                                setCustomerComboboxOpen(false);
                                                                setCustomerSearch("");
                                                            }}
                                                            className="flex items-center justify-between py-2.5 px-3 cursor-pointer"
                                                        >
                                                            <div className="flex flex-col gap-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-semibold text-sm">{c.name}</span>
                                                                    {c.company_name && (
                                                                        <span className="text-xs text-muted-foreground">({c.company_name})</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                                    <span className="flex items-center gap-1 font-mono">
                                                                        <Phone className="h-3 w-3" /> {c.phone || "No phone"}
                                                                    </span>
                                                                    {custVehicles.length > 0 && (
                                                                        <div className="flex items-center gap-1.5 ml-1">
                                                                            <span>•</span>
                                                                            <VehiclePlateBadge
                                                                                plateNumber={custVehicles[0].vehicle_number || custVehicles[0].vehicle_no || ""}
                                                                                size="sm"
                                                                            />
                                                                            {custVehicles.length > 1 && (
                                                                                <span className="text-[10px] text-primary font-semibold">
                                                                                    +{custVehicles.length - 1} more
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <Check className={cn("h-4 w-4 text-primary ml-2 shrink-0", selectedCustomerId === c.id ? "opacity-100" : "opacity-0")} />
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        ) : (
                            <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                                        {selectedCustomer?.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-sm text-foreground flex items-center gap-2 flex-wrap">
                                            {selectedCustomer?.name}
                                            {selectedCustomer?.company_name && (
                                                <Badge variant="secondary" className="text-[10px] font-normal py-0 px-1.5 h-4">
                                                    {selectedCustomer.company_name}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 font-mono flex-wrap">
                                            <span className="flex items-center gap-1">
                                                <Phone className="h-3 w-3" /> {selectedCustomer?.phone}
                                            </span>
                                            {vehicles.length > 0 && (
                                                <>
                                                    <span>•</span>
                                                    <span className="text-primary font-semibold font-sans">
                                                        {vehicles.length} {vehicles.length === 1 ? "Vehicle Linked" : "Vehicles Linked"}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs font-semibold shrink-0">
                                    Selected
                                </Badge>
                            </div>
                        )}
                    </div>

                    {/* Section 2: Appointment Type */}
                    <div className="space-y-3">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-primary" />
                            Appointment Type
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setAppointmentType("service")}
                                className={cn(
                                    "p-3.5 rounded-xl border text-left transition-all flex items-start gap-3",
                                    appointmentType === "service"
                                        ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                                        : "border-border bg-card hover:bg-muted/30"
                                )}
                            >
                                <div className={cn(
                                    "p-2 rounded-lg shrink-0",
                                    appointmentType === "service" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}>
                                    <Car className="h-5 w-5" />
                                </div>
                                <div>
                                    <div className="font-semibold text-sm">Workshop Service</div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Physical vehicle maintenance, repair, or regular servicing visit.
                                    </p>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setAppointmentType("face_to_face")}
                                className={cn(
                                    "p-3.5 rounded-xl border text-left transition-all flex items-start gap-3",
                                    appointmentType === "face_to_face"
                                        ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                                        : "border-border bg-card hover:bg-muted/30"
                                )}
                            >
                                <div className={cn(
                                    "p-2 rounded-lg shrink-0",
                                    appointmentType === "face_to_face" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}>
                                    <Users className="h-5 w-5" />
                                </div>
                                <div>
                                    <div className="font-semibold text-sm">Customer Consultation</div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Estimate review, inspection discussion, or in-person advisory meeting.
                                    </p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Section 3: Vehicle Selection */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold flex items-center gap-2">
                                <Car className="h-4 w-4 text-primary" />
                                Vehicle {appointmentType === "service" && <span className="text-destructive">*</span>}
                            </Label>
                            {vehicles.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                    {vehicles.length} {vehicles.length === 1 ? "vehicle" : "vehicles"} found
                                </span>
                            )}
                        </div>

                        {!selectedCustomerId ? (
                            <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground bg-muted/10">
                                Select a customer above to display their registered vehicles.
                            </div>
                        ) : loadingVehicles && vehicles.length === 0 ? (
                            <div className="p-4 rounded-xl border border-border flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading customer vehicles...
                            </div>
                        ) : vehicles.length === 0 ? (
                            <div className="p-4 rounded-xl border border-amber-200/50 bg-amber-50/20 text-xs text-muted-foreground flex items-start gap-2.5">
                                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold text-foreground">No vehicles registered for this customer yet.</span>
                                    <p className="text-muted-foreground mt-0.5">
                                        You can continue booking this appointment as a consultation or without an initial vehicle link.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {vehicles.map(v => {
                                    const { title, plate } = getVehicleDisplay(v);
                                    const typeOrYear = [v.year, v.vehicle_models?.vehicle_types?.name || v.vehicle_type, v.color].filter(Boolean).join(" • ");
                                    const isSelected = selectedVehicleId === v.id;

                                    return (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => setSelectedVehicleId(v.id)}
                                            className={cn(
                                                "p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3",
                                                isSelected
                                                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                                                    : "border-border bg-card hover:bg-muted/30"
                                            )}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <VehiclePlateBadge plateNumber={plate} size="sm" />
                                                <div className="truncate">
                                                    <div className="text-xs font-semibold truncate text-foreground">
                                                        {title}
                                                    </div>
                                                    {typeOrYear && (
                                                        <div className="text-[10px] text-muted-foreground truncate">
                                                            {typeOrYear}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "h-5 w-5 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                                                isSelected
                                                    ? "border-primary bg-primary text-primary-foreground"
                                                    : "border-muted-foreground/30 bg-transparent"
                                            )}>
                                                {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Section 4: Date & Time Selection */}
                    <div className="space-y-3">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                            <Clock className="h-4 w-4 text-primary" />
                            Date & Arrival Time <span className="text-destructive">*</span>
                        </Label>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Date Picker */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground font-medium">Scheduled Date</span>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleQuickDate(0)}
                                            className="h-6 text-[10px] px-2 font-medium"
                                        >
                                            Today
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleQuickDate(1)}
                                            className="h-6 text-[10px] px-2 font-medium"
                                        >
                                            Tomorrow
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleQuickDate(2)}
                                            className="h-6 text-[10px] px-2 font-medium"
                                        >
                                            +2 Days
                                        </Button>
                                    </div>
                                </div>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full justify-between h-10 font-normal border-border bg-background/60"
                                        >
                                            <span className="flex items-center gap-2 text-sm font-medium">
                                                <CalendarIcon className="h-4 w-4 text-primary" />
                                                {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "Pick a date"}
                                            </span>
                                            <ChevronsUpDown className="h-4 w-4 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={selectedDate}
                                            onSelect={(d) => d && setSelectedDate(d)}
                                            initialFocus
                                            className="rounded-md border-0"
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Time Picker */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground font-medium">Arrival Time</span>
                                    <span className="text-[10px] font-mono text-muted-foreground">Standard 30m slots</span>
                                </div>
                                <Select value={selectedTime} onValueChange={setSelectedTime}>
                                    <SelectTrigger className="w-full h-10 border-border bg-background/60">
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                            <Clock className="h-4 w-4 text-primary" />
                                            <SelectValue placeholder="Select arrival time" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60">
                                        {PRESET_TIMES.map(slot => (
                                            <SelectItem key={slot.value} value={slot.value} className="font-mono text-xs">
                                                {slot.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Section 5: Services Multi-Select */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold flex items-center gap-2">
                                <Wrench className="h-4 w-4 text-primary" />
                                Services Requested
                            </Label>
                            {selectedCatalogIds.length > 0 && (
                                <Badge variant="secondary" className="text-xs font-semibold">
                                    {selectedCatalogIds.length} Selected (₹{totalEstimatedCost.toLocaleString()})
                                </Badge>
                            )}
                        </div>

                        {catalogItems.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border rounded-xl border-border bg-muted/10">
                                {catalogItems.map(item => {
                                    const isChecked = selectedCatalogIds.includes(item.id);
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => toggleCatalogService(item.id)}
                                            className={cn(
                                                "p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between gap-2",
                                                isChecked
                                                    ? "border-primary/50 bg-primary/10 shadow-sm"
                                                    : "border-border/60 bg-card hover:bg-muted/40"
                                            )}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <Checkbox
                                                    checked={isChecked}
                                                    onCheckedChange={() => toggleCatalogService(item.id)}
                                                    className="data-[state=checked]:bg-primary"
                                                />
                                                <div className="truncate">
                                                    <div className="text-xs font-semibold truncate text-foreground">
                                                        {item.display_name}
                                                    </div>
                                                    {item.description && (
                                                        <div className="text-[10px] text-muted-foreground truncate">
                                                            {item.description}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {item.estimated_cost > 0 && (
                                                <span className="text-xs font-mono font-bold text-foreground shrink-0">
                                                    ₹{item.estimated_cost.toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Custom Service additions */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Input
                                    placeholder="Add custom service (e.g. Brake inspection, AC diagnostic)..."
                                    value={newCustomService}
                                    onChange={(e) => setNewCustomService(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleAddCustomService();
                                        }
                                    }}
                                    className="h-9 text-xs"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAddCustomService}
                                    className="h-9 px-3 text-xs shrink-0"
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                                </Button>
                            </div>

                            {customServices.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {customServices.map(cs => (
                                        <Badge
                                            key={cs}
                                            variant="secondary"
                                            className="text-xs py-1 px-2.5 flex items-center gap-1.5 bg-secondary text-secondary-foreground"
                                        >
                                            <span>{cs}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveCustomService(cs)}
                                                className="hover:text-destructive transition-colors ml-1"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Section 6: Status & Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                                Initial Status
                            </Label>
                            <Select value={initialStatus} onValueChange={(v: any) => setInitialStatus(v)}>
                                <SelectTrigger className="h-10 border-border bg-background/60">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="confirmed">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                            <span className="font-semibold text-emerald-600">Confirmed (Immediate)</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="pending">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-yellow-500" />
                                            <span className="font-semibold text-yellow-600">Pending Review</span>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground">
                                {initialStatus === "confirmed"
                                    ? "Locks slot immediately on workshop schedule."
                                    : "Places in pending request inbox."}
                            </p>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                            <Label className="text-sm font-semibold flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                Customer Complaint / Internal Notes
                            </Label>
                            <Textarea
                                placeholder="Customer notes, symptoms, specific instructions, or parts pre-requisites..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="min-h-[80px] text-xs resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter className="p-4 px-6 border-t border-border/60 bg-muted/20 flex flex-row items-center justify-between gap-3 shrink-0">
                    <div className="text-xs text-muted-foreground hidden sm:block">
                        {selectedCustomer ? (
                            <span>Scheduling for <strong className="text-foreground">{selectedCustomer.name}</strong></span>
                        ) : (
                            <span>Please select customer to schedule</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                            className="h-9 px-4 text-xs font-semibold"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting || !selectedCustomerId}
                            className="h-9 px-5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Scheduling...
                                </>
                            ) : (
                                <>
                                    <CalendarIcon className="h-4 w-4 mr-2" />
                                    Confirm Appointment
                                </>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
