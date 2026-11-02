import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, QrCode, RefreshCw, Download, Truck, Car, Globe, CheckCircle2, X, Search, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface InventoryFormProps {
    initialData?: any;
    onSubmit: (data: any) => Promise<void>;
    onCancel: () => void;
    onPrintLabels?: (item: any, copies: number) => void;
    loading?: boolean;
}

interface VehicleModelOption {
    id: string;
    name: string;
    category_name?: string;
    manufacturer_name?: string;
    image_url?: string | null;
    fuel_type?: string | null;
    engine_specs?: string | null;
}

const CATEGORIES = [
    "Mechanical",
    "Electrical",
    "Body",
    "Consumable",
    "Accessory",
    "Others",
];

export function InventoryForm({ initialData, onSubmit, onCancel, onPrintLabels, loading }: InventoryFormProps) {
    const [vehicleModels, setVehicleModels] = useState<VehicleModelOption[]>([]);
    const [vehicleCategories, setVehicleCategories] = useState<string[]>([]);
    const [modelSearch, setModelSearch] = useState("");
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");

    const defaultCompatibilityType = initialData
        ? (initialData.compatibility_type || (initialData.compatible_models?.length ? "specific" : "universal"))
        : "universal";

    const form = useForm({
        defaultValues: initialData ? {
            ...initialData,
            compatibility_type: defaultCompatibilityType,
            compatible_models: initialData.compatible_models || [],
            oem_part_number: initialData.oem_part_number || "",
            is_universal: initialData.is_universal ?? (defaultCompatibilityType === "universal"),
        } : {
            item_name: "",
            brand_name: "",
            sku: "",
            category: "Mechanical",
            quantity: 0,
            unit_price: 0,
            reorder_level: 5,
            location: "",
            qr_code: "",
            hsn_code: "",
            gst_rate: 18,
            cgst_rate: 9,
            sgst_rate: 9,
            compatibility_type: "universal",
            compatible_models: [],
            oem_part_number: "",
            is_universal: true,
        },
    });

    // Fetch vehicle catalog
    useEffect(() => {
        const fetchVehicleCatalogs = async () => {
            try {
                const { data, error } = await supabase
                    .from("vehicle_models")
                    .select(`
                        id,
                        name,
                        image_url,
                        fuel_type,
                        engine_specs,
                        vehicle_manufacturers(name),
                        vehicle_types(name, vehicle_categories(name))
                    `)
                    .order("name");

                if (!error && data) {
                    const formatted: VehicleModelOption[] = data.map((m: any) => ({
                        id: m.id,
                        name: m.name,
                        manufacturer_name: m.vehicle_manufacturers?.name,
                        category_name: m.vehicle_types?.vehicle_categories?.name,
                        image_url: m.image_url,
                        fuel_type: m.fuel_type,
                        engine_specs: m.engine_specs,
                    }));
                    setVehicleModels(formatted);

                    const cats = Array.from(
                        new Set(formatted.map((m) => m.category_name).filter(Boolean))
                    ) as string[];
                    setVehicleCategories(cats);
                }
            } catch (err) {
                console.error("Failed to fetch vehicle models:", err);
            }
        };

        fetchVehicleCatalogs();
    }, []);

    const [qrValue, setQrValue] = useState(form.getValues("qr_code") || "");

    useEffect(() => {
        if (initialData) {
            const compType = initialData.compatibility_type || (initialData.compatible_models?.length ? "specific" : "universal");
            form.reset({
                ...initialData,
                compatibility_type: compType,
                compatible_models: initialData.compatible_models || [],
                oem_part_number: initialData.oem_part_number || "",
                is_universal: initialData.is_universal ?? (compType === "universal"),
            });
            setQrValue(initialData.qr_code || initialData.sku || "");
        }
    }, [initialData, form]);

    const generateSKU = async () => {
        const category = form.getValues("category") || "Mechanical";
        const prefix = category.substring(0, 3).toUpperCase();

        let isUnique = false;
        let finalSku = "";

        while (!isUnique) {
            // Format: CAT-XXXXX (5 random alphanumeric)
            const random = Math.random().toString(36).substring(2, 7).toUpperCase();
            finalSku = `${prefix}-${random}`;

            // Uniqueness check against DB
            const { data } = await supabase
                .from("inventory")
                .select("sku")
                .eq("sku", finalSku)
                .maybeSingle();

            if (!data) isUnique = true;
        }

        form.setValue("sku", finalSku);
        if (!form.getValues("qr_code")) {
            setQrValue(finalSku);
            form.setValue("qr_code", finalSku);
        }
    };

    // Auto-generate SKU for new products on mount or category change
    useEffect(() => {
        if (!initialData && !form.getValues("sku")) {
            generateSKU();
        }
    }, [initialData, form.watch("category")]);


    const watchSku = form.watch("sku");
    useEffect(() => {
        if (watchSku && !form.getValues("qr_code")) {
            setQrValue(watchSku);
        }
    }, [watchSku]);

    const handlePrintRequest = () => {
        const count = prompt("Enter number of copies to print:", "1");
        if (count && !isNaN(parseInt(count))) {
            const copies = parseInt(count);
            if (copies > 0) {
                onPrintLabels?.(initialData, copies);
            }
        }
    };

    const filteredAvailableModels = useMemo(() => {
        return vehicleModels.filter((m) => {
            const matchesCategory = selectedCategoryFilter === "all" || m.category_name === selectedCategoryFilter;
            const matchesSearch = !modelSearch.trim() ||
                m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
                (m.manufacturer_name && m.manufacturer_name.toLowerCase().includes(modelSearch.toLowerCase()));
            return matchesCategory && matchesSearch;
        });
    }, [vehicleModels, selectedCategoryFilter, modelSearch]);

    const handleFormSubmit = async (values: any) => {
        const isUniversal = values.compatibility_type === "universal";
        const finalPayload = {
            ...values,
            is_universal: isUniversal,
            compatibility_type: values.compatibility_type,
            compatible_models: isUniversal ? [] : (values.compatible_models || []),
            oem_part_number: values.oem_part_number?.trim() || null,
        };
        await onSubmit(finalPayload);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                        control={form.control}
                        name="item_name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Product Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. Engine Oil 5W-30" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="brand_name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Brand Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. Shell, Castrol, Bosch..." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="oem_part_number"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>OEM / Part Number (Optional)</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. 16510-M68K00, BP-407-F" {...field} />
                                </FormControl>
                                <FormDescription className="text-[11px]">
                                    Manufacturer or spare part cross-reference number.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Category</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {CATEGORIES.map((cat) => (
                                            <SelectItem key={cat} value={cat}>
                                                {cat}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="flex gap-2 items-end">
                        <FormField
                            control={form.control}
                            name="sku"
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormLabel>Product Code (Auto-generated)</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Generating..."
                                            {...field}
                                            disabled
                                            className="bg-muted font-mono"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {!initialData && (
                            <Button type="button" variant="outline" size="icon" onClick={generateSKU} title="Regenerate Code">
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        )}
                    </div>


                    <FormField
                        control={form.control}
                        name="unit_price"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Unit Price (₹)</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Total Quantity</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="hsn_code"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>HSN Code</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. 8708" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="gst_rate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>GST Rate (%)</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        {...field}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value) || 0;
                                            field.onChange(val);
                                            form.setValue("cgst_rate", val / 2);
                                            form.setValue("sgst_rate", val / 2);
                                        }}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid grid-cols-2 gap-2">
                        <FormField
                            control={form.control}
                            name="cgst_rate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>CGST %</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} disabled />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="sgst_rate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>SGST %</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} disabled />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="reorder_level"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Reorder Level (Low Stock Alert)</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Stock Location (Room-Rack-Shelf)</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. R1-S2-P3" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Vehicle Fitment & Compatibility Section */}
                    <div className="col-span-1 md:col-span-2 p-5 border rounded-xl bg-card shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                            <div>
                                <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                                    <Truck className="h-4 w-4 text-primary" /> Vehicle & Model Compatibility
                                </h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Specify whether this part is universal across all vehicles or specific to certain models.
                                </p>
                            </div>
                            <FormField
                                control={form.control}
                                name="compatibility_type"
                                render={({ field }) => (
                                    <div className="inline-flex p-1 bg-muted rounded-lg text-xs font-medium self-start sm:self-auto">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                field.onChange("universal");
                                                form.setValue("is_universal", true);
                                            }}
                                            className={cn(
                                                "px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer",
                                                field.value === "universal"
                                                    ? "bg-background text-foreground shadow-xs font-semibold"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <Globe className="h-3.5 w-3.5" /> Universal (All)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                field.onChange("specific");
                                                form.setValue("is_universal", false);
                                            }}
                                            className={cn(
                                                "px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer",
                                                field.value === "specific"
                                                    ? "bg-background text-foreground shadow-xs font-semibold"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <Car className="h-3.5 w-3.5" /> Model Specific
                                        </button>
                                    </div>
                                )}
                            />
                        </div>

                        {form.watch("compatibility_type") === "universal" ? (
                            <div className="flex items-center gap-3 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-5 w-5 shrink-0" />
                                <div className="text-xs">
                                    <span className="font-semibold">Universal Part:</span> Compatible with all vehicles (standard consumables, lubricants, engine oils, fluids, bulbs, fuses, fasteners).
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3 pt-1">
                                {/* Selected Models Summary */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                            Compatible Models:
                                            <Badge variant="secondary" className="text-[10px] h-5">
                                                {(form.watch("compatible_models") || []).length} selected
                                            </Badge>
                                        </label>
                                        {(form.watch("compatible_models") || []).length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => form.setValue("compatible_models", [])}
                                                className="text-[11px] text-destructive hover:underline cursor-pointer"
                                            >
                                                Clear all
                                            </button>
                                        )}
                                    </div>

                                    {/* Selected tags */}
                                    <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 bg-muted/40 rounded-md border border-dashed">
                                        {(form.watch("compatible_models") || []).length === 0 ? (
                                            <span className="text-xs text-muted-foreground italic flex items-center">
                                                No models selected yet. Click from the list below to add compatible vehicle models.
                                            </span>
                                        ) : (
                                            (form.watch("compatible_models") || []).map((modelName: string) => (
                                                <Badge
                                                    key={modelName}
                                                    variant="default"
                                                    className="pl-2 pr-1 py-0.5 text-xs flex items-center gap-1 bg-primary text-primary-foreground"
                                                >
                                                    <span>{modelName}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const current = form.getValues("compatible_models") || [];
                                                            form.setValue("compatible_models", current.filter((m: string) => m !== modelName));
                                                        }}
                                                        className="hover:bg-primary-foreground/20 rounded p-0.5 cursor-pointer"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Model Search and Quick Filters */}
                                <div className="space-y-2">
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                            <Input
                                                placeholder="Search models (e.g. Tata 407, Eicher Pro, Dost...)"
                                                value={modelSearch}
                                                onChange={(e) => setModelSearch(e.target.value)}
                                                className="h-8 text-xs pl-8"
                                            />
                                        </div>
                                        {/* Category Filter */}
                                        <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={selectedCategoryFilter === "all" ? "default" : "outline"}
                                                className="h-7 text-[11px] px-2.5"
                                                onClick={() => setSelectedCategoryFilter("all")}
                                            >
                                                All
                                            </Button>
                                            {vehicleCategories.map((cat) => (
                                                <Button
                                                    key={cat}
                                                    type="button"
                                                    size="sm"
                                                    variant={selectedCategoryFilter === cat ? "default" : "outline"}
                                                    className="h-7 text-[11px] px-2"
                                                    onClick={() => setSelectedCategoryFilter(cat)}
                                                >
                                                    {cat}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Quick Add By Category */}
                                    {selectedCategoryFilter !== "all" && (
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const categoryModels = vehicleModels
                                                        .filter((m) => m.category_name === selectedCategoryFilter)
                                                        .map((m) => m.name);
                                                    const current = form.getValues("compatible_models") || [];
                                                    const combined = Array.from(new Set([...current, ...categoryModels]));
                                                    form.setValue("compatible_models", combined);
                                                }}
                                                className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
                                            >
                                                + Select All {selectedCategoryFilter} Models
                                            </button>
                                        </div>
                                    )}

                                    {/* Clickable Model Pills */}
                                    <div className="max-h-40 overflow-y-auto p-2 bg-background border rounded-lg flex flex-wrap gap-1.5">
                                        {filteredAvailableModels.length === 0 ? (
                                            <p className="text-xs text-muted-foreground p-2">No matching vehicle models found.</p>
                                        ) : (
                                            filteredAvailableModels.map((m) => {
                                                const isSelected = (form.watch("compatible_models") || []).includes(m.name);
                                                return (
                                                    <button
                                                        key={m.id}
                                                        type="button"
                                                        onClick={() => {
                                                            const current = form.getValues("compatible_models") || [];
                                                            if (isSelected) {
                                                                form.setValue("compatible_models", current.filter((x: string) => x !== m.name));
                                                            } else {
                                                                form.setValue("compatible_models", [...current, m.name]);
                                                            }
                                                        }}
                                                        className={cn(
                                                            "text-xs px-2.5 py-1 rounded-md border transition-colors flex items-center gap-1.5 cursor-pointer",
                                                            isSelected
                                                                ? "bg-primary text-primary-foreground border-primary font-medium shadow-xs"
                                                                : "bg-muted/50 hover:bg-muted text-foreground border-border"
                                                        )}
                                                        title={m.engine_specs || undefined}
                                                    >
                                                        {isSelected ? (
                                                            <Check className="h-3 w-3 shrink-0" />
                                                        ) : m.image_url ? (
                                                            <img
                                                                src={m.image_url}
                                                                alt=""
                                                                className="w-4 h-4 rounded object-cover shrink-0 border border-border/40"
                                                            />
                                                        ) : null}
                                                        <span>{m.name}</span>
                                                        {m.fuel_type && (
                                                            <span className={cn("text-[9px] uppercase px-1 py-0.2 rounded font-medium", isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground")}>
                                                                {m.fuel_type}
                                                            </span>
                                                        )}
                                                        {m.category_name && (
                                                            <span className={cn("text-[9px] opacity-70", isSelected ? "text-primary-foreground" : "text-muted-foreground")}>
                                                                ({m.category_name})
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-4 p-4 border rounded-lg bg-muted/30">
                        <FormLabel className="flex items-center gap-2">
                            <QrCode className="h-4 w-4" /> QR Code Preview
                        </FormLabel>
                        <p className="text-[10px] text-muted-foreground mb-2">
                            This is the Master QR (SKU). Unique unit-level QRs will be generated automatically for all {form.watch("quantity") || 0} items upon saving.
                        </p>
                        <div className="flex items-center justify-center bg-white p-2 border rounded self-center">
                            {qrValue ? (
                                <div className="space-y-2 flex flex-col items-center">
                                    <QRCodeSVG value={qrValue} size={100} />
                                    {initialData && onPrintLabels && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={handlePrintRequest}
                                            className="text-[10px] h-7 px-2"
                                        >
                                            <Download className="h-3 w-3 mr-1" /> Print Labels
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="w-[100px] h-[100px] flex items-center justify-center text-xs text-muted-foreground text-center">
                                    Gen SKU to see QR
                                </div>
                            )}
                        </div>
                        <FormField
                            control={form.control}
                            name="qr_code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            placeholder="Custom QR Value (optional)"
                                            {...field}
                                            onChange={(e) => {
                                                field.onChange(e.target.value);
                                                setQrValue(e.target.value);
                                            }}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {initialData ? "Update Product" : "Add Product"}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
