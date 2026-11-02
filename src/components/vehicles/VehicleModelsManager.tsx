import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
    Plus,
    Search,
    Truck,
    Car,
    Globe,
    Sparkles,
    Trash2,
    Edit2,
    Upload,
    ExternalLink,
    RefreshCw,
    Fuel,
    Gauge,
    Calendar,
    Image as ImageIcon,
    CheckCircle2,
    Loader2,
    X,
    CheckSquare,
    Square,
    Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { broadcastDataUpdate, useRealtimeSync } from "@/utils/realtimeSync";
import {
    lookupVehicleModelInfo,
    VehicleOnlineDetails,
} from "@/utils/vehicleLookupService";

export interface VehicleModelRecord {
    id: string;
    name: string;
    manufacturer_id: string;
    vehicle_type_id: string;
    created_at?: string;
    image_url?: string | null;
    fuel_type?: string | null;
    engine_specs?: string | null;
    description?: string | null;
    year_introduced?: number | null;
    vehicle_manufacturers?: { id: string; name: string };
    vehicle_types?: {
        id: string;
        name: string;
        category_id: string;
        vehicle_categories?: { id: string; name: string };
    };
}

interface Manufacturer {
    id: string;
    name: string;
}

interface Category {
    id: string;
    name: string;
}

interface VehicleType {
    id: string;
    name: string;
    category_id: string;
}

interface VehicleModelsManagerProps {
    onModelSelect?: (model: VehicleModelRecord) => void;
}

export function VehicleModelsManager({ onModelSelect }: VehicleModelsManagerProps) {
    const { toast } = useToast();
    const [models, setModels] = useState<VehicleModelRecord[]>([]);
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedManufacturerFilter, setSelectedManufacturerFilter] = useState("all");
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");

    // Add / Edit Dialog State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingModel, setEditingModel] = useState<VehicleModelRecord | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [deletingModel, setDeletingModel] = useState<VehicleModelRecord | null>(null);

    // Multi-select models state
    const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
    const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    // Online Auto-Fill State
    const [isFetchingOnline, setIsFetchingOnline] = useState(false);
    const [onlineSearchResult, setOnlineSearchResult] = useState<VehicleOnlineDetails | null>(null);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    // Form fields
    const [formName, setFormName] = useState("");
    const [formManufacturerId, setFormManufacturerId] = useState("");
    const [formCategoryId, setFormCategoryId] = useState("");
    const [formTypeId, setFormTypeId] = useState("");
    const [formImageUrl, setFormImageUrl] = useState("");
    const [formFuelType, setFormFuelType] = useState("Diesel");
    const [formEngineSpecs, setFormEngineSpecs] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [formYear, setFormYear] = useState<string>("");

    // Quick add master state
    const [isQuickAddMfrOpen, setIsQuickAddMfrOpen] = useState(false);
    const [newMfrName, setNewMfrName] = useState("");

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [mRes, cRes, tRes, moRes] = await Promise.all([
                supabase.from("vehicle_manufacturers").select("*").order("name"),
                supabase.from("vehicle_categories").select("*").order("name"),
                supabase.from("vehicle_types").select("*").order("name"),
                supabase
                    .from("vehicle_models")
                    .select(`
                        *,
                        vehicle_manufacturers(id, name),
                        vehicle_types(
                            id,
                            name,
                            category_id,
                            vehicle_categories(id, name)
                        )
                    `)
                    .order("name"),
            ]);

            if (mRes.data) setManufacturers(mRes.data);
            if (cRes.data) setCategories(cRes.data);
            if (tRes.data) setVehicleTypes(tRes.data);
            if (moRes.data) setModels(moRes.data as any[]);
        } catch (err: any) {
            toast({ variant: "destructive", title: "Error", description: err.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    useRealtimeSync(["vehicle_models", "vehicle_manufacturers"], () => {
        fetchAllData();
    });

    // Reset or populate form when opening dialog
    const handleOpenForm = (model?: VehicleModelRecord) => {
        if (model) {
            setEditingModel(model);
            setFormName(model.name);
            setFormManufacturerId(model.manufacturer_id || "");
            const catId = model.vehicle_types?.category_id || "";
            setFormCategoryId(catId);
            setFormTypeId(model.vehicle_type_id || "");
            setFormImageUrl(model.image_url || "");
            setFormFuelType(model.fuel_type || "Diesel");
            setFormEngineSpecs(model.engine_specs || "");
            setFormDescription(model.description || "");
            setFormYear(model.year_introduced ? String(model.year_introduced) : "");
            setOnlineSearchResult(null);
        } else {
            setEditingModel(null);
            setFormName("");
            setFormManufacturerId(manufacturers[0]?.id || "");
            setFormCategoryId(categories[0]?.id || "");
            setFormTypeId("");
            setFormImageUrl("");
            setFormFuelType("Diesel");
            setFormEngineSpecs("");
            setFormDescription("");
            setFormYear(new Date().getFullYear().toString());
            setOnlineSearchResult(null);
        }
        setIsFormOpen(true);
    };

    // Filter available vehicle types based on chosen category
    const availableTypesForForm = useMemo(() => {
        if (!formCategoryId) return vehicleTypes;
        return vehicleTypes.filter((t) => t.category_id === formCategoryId);
    }, [vehicleTypes, formCategoryId]);

    // Handle online smart lookup for vehicle model & photo
    const handleSmartLookup = async (queryName: string) => {
        if (!queryName.trim()) {
            toast({ title: "Please enter a model name first" });
            return;
        }

        setIsFetchingOnline(true);
        try {
            const currentMfr = manufacturers.find((m) => m.id === formManufacturerId);
            const result = await lookupVehicleModelInfo(queryName, currentMfr?.name);

            if (result) {
                setOnlineSearchResult(result);

                // Auto-fill fields with fetched details
                if (result.photoUrl) {
                    setFormImageUrl(result.photoUrl);
                }
                if (result.description) {
                    setFormDescription(result.description);
                }
                if (result.engineSpecs) {
                    setFormEngineSpecs(result.engineSpecs);
                }
                if (result.fuelType) {
                    setFormFuelType(result.fuelType);
                }
                if (result.yearIntroduced) {
                    setFormYear(String(result.yearIntroduced));
                }

                // Match Category
                if (result.categorySuggestion) {
                    const matchedCat = categories.find(
                        (c) => c.name.toLowerCase() === result.categorySuggestion?.toLowerCase()
                    );
                    if (matchedCat) {
                        setFormCategoryId(matchedCat.id);
                        const matchedType = vehicleTypes.find((t) => t.category_id === matchedCat.id);
                        if (matchedType) {
                            setFormTypeId(matchedType.id);
                        }
                    }
                }

                // Match Make/Manufacturer if found
                if (result.makeName) {
                    const matchedMfr = manufacturers.find(
                        (m) => m.name.toLowerCase().includes(result.makeName!.toLowerCase()) ||
                               result.makeName!.toLowerCase().includes(m.name.toLowerCase())
                    );
                    if (matchedMfr) {
                        setFormManufacturerId(matchedMfr.id);
                    }
                }

                toast({
                    title: "Details & Photo Found!",
                    description: `Loaded online information via ${result.source.toUpperCase()}.`,
                });
            } else {
                toast({
                    title: "No online data found",
                    description: "You can manually enter details or paste a photo link.",
                });
            }
        } catch (err: any) {
            toast({ variant: "destructive", title: "Lookup Failed", description: err.message });
        } finally {
            setIsFetchingOnline(false);
        }
    };

    // Handle photo file upload to Supabase storage bucket
    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingPhoto(true);
        try {
            const fileExt = file.name.split(".").pop() || "jpg";
            const fileName = `model-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from("public-assets")
                .upload(fileName, file, { cacheControl: "3600", upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from("public-assets")
                .getPublicUrl(fileName);

            setFormImageUrl(publicUrl);
            toast({ title: "Photo Uploaded", description: "Image attached successfully." });
        } catch (err: any) {
            toast({ variant: "destructive", title: "Upload Failed", description: err.message });
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    // Quick add manufacturer
    const handleCreateManufacturer = async () => {
        if (!newMfrName.trim()) return;
        try {
            const { data, error } = await supabase
                .from("vehicle_manufacturers")
                .insert({ name: newMfrName.trim() })
                .select()
                .single();

            if (error) throw error;
            setManufacturers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
            setFormManufacturerId(data.id);
            setNewMfrName("");
            setIsQuickAddMfrOpen(false);
            toast({ title: "Manufacturer Added", description: `Added "${data.name}"` });
        } catch (err: any) {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    };

    // Submit model creation or edit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName.trim()) {
            toast({ variant: "destructive", title: "Missing Name", description: "Please enter model name" });
            return;
        }

        if (!formManufacturerId) {
            toast({ variant: "destructive", title: "Missing Manufacturer", description: "Please select a manufacturer" });
            return;
        }

        // Auto-resolve or create vehicle type if empty
        let typeId = formTypeId;
        if (!typeId) {
            // Find first type of category or create default
            const existingType = vehicleTypes.find((t) => !formCategoryId || t.category_id === formCategoryId);
            if (existingType) {
                typeId = existingType.id;
            } else {
                // Insert a default type for this category
                const catObj = categories.find((c) => c.id === formCategoryId) || categories[0];
                const typeName = `${catObj?.name || "General"} Type`;
                const { data: newType } = await supabase
                    .from("vehicle_types")
                    .insert({ name: typeName, category_id: catObj?.id })
                    .select()
                    .single();
                if (newType) {
                    typeId = newType.id;
                    setVehicleTypes((prev) => [...prev, newType]);
                }
            }
        }

        setIsSaving(true);
        try {
            const payload = {
                name: formName.trim(),
                manufacturer_id: formManufacturerId,
                vehicle_type_id: typeId,
                image_url: formImageUrl.trim() || null,
                fuel_type: formFuelType,
                engine_specs: formEngineSpecs.trim() || null,
                description: formDescription.trim() || null,
                year_introduced: formYear ? parseInt(formYear) : null,
            };

            if (editingModel) {
                const { error } = await supabase
                    .from("vehicle_models")
                    .update(payload)
                    .eq("id", editingModel.id);

                if (error) throw error;
                toast({ title: "Model Updated", description: `${payload.name} updated successfully.` });
            } else {
                const { error } = await supabase.from("vehicle_models").insert(payload);
                if (error) throw error;
                toast({ title: "Model Added", description: `${payload.name} added to catalog.` });
            }

            broadcastDataUpdate(["vehicle_models", "vehicles"]);
            setIsFormOpen(false);
            setEditingModel(null);
            fetchAllData();
        } catch (err: any) {
            toast({ variant: "destructive", title: "Error Saving Model", description: err.message });
        } finally {
            setIsSaving(false);
        }
    };

    // Delete model
    const handleDeleteModel = async () => {
        if (!deletingModel) return;
        try {
            const { error } = await supabase
                .from("vehicle_models")
                .delete()
                .eq("id", deletingModel.id);

            if (error) throw error;
            toast({ title: "Model Removed", description: `${deletingModel.name} deleted.` });
            broadcastDataUpdate(["vehicle_models", "vehicles"]);
            setDeletingModel(null);
            setSelectedModelIds((prev) => prev.filter((id) => id !== deletingModel.id));
            fetchAllData();
        } catch (err: any) {
            toast({ variant: "destructive", title: "Cannot Delete Model", description: err.message });
        }
    };

    // Model selection handlers
    const handleToggleSelectModel = (id: string) => {
        setSelectedModelIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    // Filter models list
    const filteredModels = useMemo(() => {
        return models.filter((m) => {
            const term = searchTerm.toLowerCase();
            const matchesSearch =
                !term ||
                m.name.toLowerCase().includes(term) ||
                m.vehicle_manufacturers?.name.toLowerCase().includes(term) ||
                m.engine_specs?.toLowerCase().includes(term) ||
                m.description?.toLowerCase().includes(term);

            const matchesMfr =
                selectedManufacturerFilter === "all" ||
                m.manufacturer_id === selectedManufacturerFilter;

            const categoryName = m.vehicle_types?.vehicle_categories?.name;
            const matchesCategory =
                selectedCategoryFilter === "all" ||
                categoryName === selectedCategoryFilter;

            return matchesSearch && matchesMfr && matchesCategory;
        });
    }, [models, searchTerm, selectedManufacturerFilter, selectedCategoryFilter]);

    const isAllFilteredModelsSelected =
        filteredModels.length > 0 &&
        filteredModels.every((m) => selectedModelIds.includes(m.id));

    const handleToggleSelectAllModels = () => {
        if (isAllFilteredModelsSelected) {
            const filteredSet = new Set(filteredModels.map((m) => m.id));
            setSelectedModelIds((prev) => prev.filter((id) => !filteredSet.has(id)));
        } else {
            const newSet = new Set(selectedModelIds);
            filteredModels.forEach((m) => newSet.add(m.id));
            setSelectedModelIds(Array.from(newSet));
        }
    };

    const handleBulkDeleteModels = async () => {
        if (selectedModelIds.length === 0) return;
        setIsBulkDeleting(true);
        try {
            const { error } = await supabase
                .from("vehicle_models")
                .delete()
                .in("id", selectedModelIds);

            if (error) throw error;
            toast({
                title: "Models Deleted",
                description: `Successfully deleted ${selectedModelIds.length} vehicle model(s).`,
            });
            broadcastDataUpdate(["vehicle_models", "vehicles"]);
            setSelectedModelIds([]);
            fetchAllData();
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Cannot Delete Models",
                description:
                    err.message ||
                    "One or more models could not be deleted because they are assigned to existing fleet vehicles.",
            });
        } finally {
            setIsBulkDeleting(false);
            setShowBulkDeleteDialog(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Action Bar & Stats Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-xs">
                <div>
                    <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                        <Truck className="h-5 w-5 text-primary" /> Vehicle Models Catalog ({filteredModels.length})
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Central master library of commercial and passenger models with photos and engine specifications.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {filteredModels.length > 0 && (
                        <Button
                            variant={isAllFilteredModelsSelected ? "secondary" : "outline"}
                            size="sm"
                            onClick={handleToggleSelectAllModels}
                            className="text-xs h-9 gap-1.5 font-semibold"
                        >
                            {isAllFilteredModelsSelected ? (
                                <>
                                    <CheckSquare className="h-4 w-4 text-primary" />
                                    <span>Deselect All</span>
                                </>
                            ) : (
                                <>
                                    <Square className="h-4 w-4 text-muted-foreground" />
                                    <span>Select All ({filteredModels.length})</span>
                                </>
                            )}
                        </Button>
                    )}
                    <Button onClick={() => handleOpenForm()} className="bg-primary hover:bg-primary/90 text-xs h-9 shadow-xs">
                        <Plus className="h-4 w-4 mr-1.5" /> Add Vehicle Model
                    </Button>
                </div>
            </div>

            {/* Bulk Selection Floating / Sticky Bar */}
            {selectedModelIds.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-primary/10 border-2 border-primary/30 rounded-xl shadow-md transition-all animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <Badge variant="default" className="text-xs px-2.5 py-1 font-bold shadow-xs">
                            {selectedModelIds.length} Model{selectedModelIds.length > 1 ? "s" : ""} Selected
                        </Badge>
                        <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
                            {selectedModelIds.length === filteredModels.length
                                ? `All ${filteredModels.length} models selected`
                                : `${selectedModelIds.length} of ${filteredModels.length} models selected`}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedModelIds([])}
                            className="text-xs h-8 bg-background/80 hover:bg-background"
                        >
                            Clear Selection
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowBulkDeleteDialog(true)}
                            className="text-xs h-8 gap-1.5 shadow-sm font-semibold"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete Selected ({selectedModelIds.length})
                        </Button>
                    </div>
                </div>
            )}

            {/* Search and Filters Toolbar */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search models, manufacturers, or specifications..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 text-xs"
                    />
                </div>

                {/* Manufacturer Filter */}
                <Select
                    value={selectedManufacturerFilter}
                    onValueChange={setSelectedManufacturerFilter}
                >
                    <SelectTrigger className="w-[180px] h-9 text-xs">
                        <SelectValue placeholder="Manufacturer" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Manufacturers</SelectItem>
                        {manufacturers.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                                {m.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Category Filter */}
                <Select
                    value={selectedCategoryFilter}
                    onValueChange={setSelectedCategoryFilter}
                >
                    <SelectTrigger className="w-[160px] h-9 text-xs">
                        <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((c) => (
                            <SelectItem key={c.id} value={c.name}>
                                {c.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Models Cards Grid */}
            {loading ? (
                <div className="text-center py-16 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground font-medium">Loading vehicle models...</p>
                </div>
            ) : filteredModels.length === 0 ? (
                <div className="text-center py-16 bg-muted/20 border border-dashed rounded-xl space-y-3">
                    <Truck className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                    <h4 className="text-sm font-semibold text-foreground">No vehicle models match your search</h4>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        Add a new vehicle model or select a preset from the banner above to get started.
                    </p>
                    <Button size="sm" onClick={() => handleOpenForm()}>
                        <Plus className="h-4 w-4 mr-1" /> Add Model
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredModels.map((model) => {
                        const mfrName = model.vehicle_manufacturers?.name || "Independent";
                        const catName = model.vehicle_types?.vehicle_categories?.name || "Fleet";
                        const isSelected = selectedModelIds.includes(model.id);

                        return (
                            <Card
                                key={model.id}
                                className={cn(
                                    "overflow-hidden flex flex-col justify-between group transition-all duration-200 relative",
                                    isSelected
                                        ? "ring-2 ring-primary border-primary bg-primary/[0.03] shadow-md"
                                        : "hover:border-primary/50 hover:shadow-md"
                                )}
                            >
                                <div>
                                    {/* Model Image Header */}
                                    <div className="relative h-40 bg-muted/50 overflow-hidden flex items-center justify-center border-b">
                                        {model.image_url ? (
                                            <img
                                                src={model.image_url}
                                                alt={model.name}
                                                referrerPolicy="no-referrer"
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = "none";
                                                }}
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center gap-1.5 text-muted-foreground/40">
                                                <Car className="h-12 w-12" />
                                                <span className="text-[10px] font-medium uppercase tracking-wider">No Photo</span>
                                            </div>
                                        )}

                                        {/* Top-Left: Selection Checkbox & Category Badge */}
                                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleSelectModel(model.id);
                                                }}
                                                className={cn(
                                                    "h-6 w-6 rounded-md flex items-center justify-center transition-all shadow-md border cursor-pointer",
                                                    isSelected
                                                        ? "bg-primary text-primary-foreground border-primary ring-2 ring-white/60 dark:ring-black/60 scale-105"
                                                        : selectedModelIds.length > 0
                                                        ? "bg-black/60 hover:bg-black/80 border-white/60 text-transparent"
                                                        : "bg-black/40 hover:bg-black/70 border-white/40 text-transparent opacity-75 group-hover:opacity-100"
                                                )}
                                                title={isSelected ? "Deselect model" : "Select model"}
                                                aria-label={isSelected ? "Deselect model" : "Select model"}
                                            >
                                                <Check
                                                    className={cn(
                                                        "h-3.5 w-3.5 stroke-[3]",
                                                        isSelected ? "text-primary-foreground opacity-100" : "opacity-0 hover:opacity-50 text-white"
                                                    )}
                                                />
                                            </button>
                                            <Badge
                                                variant="secondary"
                                                className="text-[10px] bg-black/60 text-white backdrop-blur-md border-white/10"
                                            >
                                                {catName}
                                            </Badge>
                                        </div>

                                        {/* Fuel Badge */}
                                        {model.fuel_type && (
                                            <Badge
                                                variant="outline"
                                                className="absolute top-2.5 right-2.5 text-[10px] bg-background/80 backdrop-blur-md font-semibold"
                                            >
                                                {model.fuel_type}
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Model Info */}
                                    <div className="p-4 space-y-2">
                                        <div className="space-y-0.5">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                                                {mfrName}
                                            </span>
                                            <h4 className="font-bold text-base text-foreground leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                                                {model.name}
                                            </h4>
                                        </div>

                                        {/* Engine Specs */}
                                        {model.engine_specs && (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                                                <Gauge className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                                                <span className="truncate">{model.engine_specs}</span>
                                            </div>
                                        )}

                                        {/* Description */}
                                        {model.description && (
                                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                                {model.description}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="p-3 border-t bg-muted/10 flex items-center justify-between gap-2">
                                    <span className="text-[11px] text-muted-foreground font-medium">
                                        {model.year_introduced ? `Est. ${model.year_introduced}` : ""}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            onClick={() => handleOpenForm(model)}
                                            title="Edit Model"
                                        >
                                            <Edit2 className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                            onClick={() => setDeletingModel(model)}
                                            title="Delete Model"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Add / Edit Vehicle Model Dialog */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Truck className="h-5 w-5 text-primary" />
                            {editingModel ? `Edit Model: ${editingModel.name}` : "Add New Vehicle Model"}
                        </DialogTitle>
                        <DialogDescription>
                            Configure vehicle model details, photo, and engine specifications for use across job cards and inventory.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Online Smart Search & Auto-Fill Section */}
                    <div className="p-3.5 bg-gradient-to-r from-blue-500/10 via-primary/10 to-indigo-500/10 border border-primary/20 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-primary" /> Free Online Auto-Fill & Photo Fetcher
                            </Label>
                            <span className="text-[10px] text-muted-foreground">Powered by Wikipedia & Wikimedia</span>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                placeholder="e.g. Tata 407, Mahindra Bolero, Toyota Hilux..."
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                className="h-9 text-xs bg-background"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleSmartLookup(formName)}
                                disabled={isFetchingOnline || !formName.trim()}
                                className="h-9 text-xs shrink-0 cursor-pointer bg-background hover:bg-primary hover:text-primary-foreground"
                            >
                                {isFetchingOnline ? (
                                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                ) : (
                                    <Globe className="h-3.5 w-3.5 mr-1.5 text-primary" />
                                )}
                                {isFetchingOnline ? "Fetching..." : "Fetch Info & Photo"}
                            </Button>
                        </div>
                        {onlineSearchResult && (
                            <div className="flex items-center gap-3 p-2 bg-background/80 rounded-lg border text-xs">
                                {onlineSearchResult.photoUrl && (
                                    <img
                                        key={onlineSearchResult.photoUrl}
                                        src={onlineSearchResult.photoUrl}
                                        alt="Preview"
                                        referrerPolicy="no-referrer"
                                        className="w-14 h-14 rounded-md object-cover border shrink-0 bg-muted"
                                        onError={(e) => {
                                            e.currentTarget.style.display = "none";
                                        }}
                                    />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-foreground truncate">{onlineSearchResult.modelName}</p>
                                    <p className="text-[11px] text-muted-foreground line-clamp-1">{onlineSearchResult.description}</p>
                                </div>
                                <Badge variant="secondary" className="text-[10px] shrink-0">
                                    {onlineSearchResult.source.toUpperCase()}
                                </Badge>
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Model Name */}
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label className="text-xs font-semibold">Model Name *</Label>
                                <Input
                                    placeholder="e.g. Tata 407 Gold 29 WB"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    required
                                    className="h-9 text-xs"
                                />
                            </div>

                            {/* Manufacturer */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold">Manufacturer *</Label>
                                    <button
                                        type="button"
                                        onClick={() => setIsQuickAddMfrOpen(true)}
                                        className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                                    >
                                        + New Make
                                    </button>
                                </div>
                                <Select
                                    value={formManufacturerId}
                                    onValueChange={setFormManufacturerId}
                                >
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Select Manufacturer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {manufacturers.map((m) => (
                                            <SelectItem key={m.id} value={m.id}>
                                                {m.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Category */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Category *</Label>
                                <Select
                                    value={formCategoryId}
                                    onValueChange={(val) => {
                                        setFormCategoryId(val);
                                        setFormTypeId("");
                                    }}
                                >
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Select Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map((c) => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Fuel Type */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Fuel Type</Label>
                                <Select value={formFuelType} onValueChange={setFormFuelType}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Fuel" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Diesel">Diesel</SelectItem>
                                        <SelectItem value="Petrol">Petrol</SelectItem>
                                        <SelectItem value="CNG">CNG</SelectItem>
                                        <SelectItem value="Electric">Electric</SelectItem>
                                        <SelectItem value="Hybrid">Hybrid</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Year Introduced */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Year Introduced</Label>
                                <Input
                                    type="number"
                                    placeholder="e.g. 2021"
                                    value={formYear}
                                    onChange={(e) => setFormYear(e.target.value)}
                                    className="h-9 text-xs"
                                />
                            </div>

                            {/* Engine & Transmission Specs */}
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label className="text-xs font-semibold">Engine & Power Specifications</Label>
                                <Input
                                    placeholder="e.g. 2956 cc 4-Cyl Turbo Diesel, 100 HP, 300 Nm"
                                    value={formEngineSpecs}
                                    onChange={(e) => setFormEngineSpecs(e.target.value)}
                                    className="h-9 text-xs"
                                />
                            </div>

                            {/* Model Photo Section */}
                            <div className="space-y-2 sm:col-span-2 border p-3 rounded-lg bg-muted/20">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                                        <ImageIcon className="h-3.5 w-3.5 text-primary" /> Vehicle Photo (Image URL or Upload)
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <label className="text-[11px] text-primary hover:underline font-medium cursor-pointer flex items-center gap-1">
                                            <Upload className="h-3 w-3" /> Upload Device Image
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handlePhotoUpload}
                                                disabled={isUploadingPhoto}
                                            />
                                        </label>
                                    </div>
                                </div>

                                <div className="flex gap-2 items-center">
                                    <Input
                                        placeholder="https://... photo url"
                                        value={formImageUrl}
                                        onChange={(e) => setFormImageUrl(e.target.value)}
                                        className="h-8 text-xs bg-background"
                                    />
                                    {formImageUrl && (
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => setFormImageUrl("")}
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>

                                {formImageUrl && (
                                    <div className="relative w-full h-36 rounded-lg overflow-hidden border bg-background mt-2 flex items-center justify-center">
                                        <img
                                            key={formImageUrl}
                                            src={formImageUrl}
                                            alt="Preview"
                                            referrerPolicy="no-referrer"
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.currentTarget.style.display = "none";
                                            }}
                                        />
                                        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-xs flex items-center gap-1 font-medium">
                                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                            Photo Loaded
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Description / Notes */}
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label className="text-xs font-semibold">Description / Notes</Label>
                                <Textarea
                                    placeholder="Notes on payload capacity, fleet usage, or common service points..."
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    rows={2}
                                    className="text-xs"
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-3 border-t">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsFormOpen(false)}
                                disabled={isSaving}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/90">
                                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                {editingModel ? "Save Changes" : "Create Vehicle Model"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Quick Add Manufacturer Modal */}
            <Dialog open={isQuickAddMfrOpen} onOpenChange={setIsQuickAddMfrOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-base">Add Vehicle Manufacturer</DialogTitle>
                        <DialogDescription className="text-xs">
                            Add a new brand or automaker (e.g. BharatBenz, Volvo, Isuzu).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Input
                            placeholder="Manufacturer name..."
                            value={newMfrName}
                            onChange={(e) => setNewMfrName(e.target.value)}
                            className="h-9 text-xs"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsQuickAddMfrOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleCreateManufacturer}>
                            Save Make
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Single Delete Alert */}
            <AlertDialog open={!!deletingModel} onOpenChange={(open) => !open && setDeletingModel(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Vehicle Model?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove <strong>{deletingModel?.name}</strong> from the catalog?
                            Vehicles currently referencing this model will maintain their records.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteModel}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete Model
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Confirm Bulk Delete Models Alert */}
            <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <Trash2 className="h-5 w-5" />
                            Delete {selectedModelIds.length} Vehicle Model{selectedModelIds.length > 1 ? "s" : ""}?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3 pt-2 text-left">
                            <p>
                                Are you sure you want to permanently delete these <b>{selectedModelIds.length}</b> selected models from the catalog?
                            </p>

                            <div className="max-h-36 overflow-y-auto p-2.5 bg-muted/70 rounded-lg text-xs space-y-1.5 border">
                                {models
                                    .filter((m) => selectedModelIds.includes(m.id))
                                    .map((m) => (
                                        <div key={m.id} className="flex items-center justify-between font-medium py-0.5 border-b border-border/40 last:border-b-0">
                                            <span>{m.name}</span>
                                            <span className="text-muted-foreground text-[11px]">
                                                {m.vehicle_manufacturers?.name || "Independent"}
                                            </span>
                                        </div>
                                    ))}
                            </div>

                            <p className="text-[11px] text-muted-foreground">
                                Note: If any model is currently associated with registered vehicles in your garage, deletion will be blocked by database integrity rules.
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleBulkDeleteModels}
                            disabled={isBulkDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
                        >
                            {isBulkDeleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" /> Deleting...
                                </>
                            ) : (
                                `Confirm Delete (${selectedModelIds.length})`
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
