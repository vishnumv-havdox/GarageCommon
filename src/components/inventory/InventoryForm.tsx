import { useState, useEffect } from "react";
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
import { Loader2, QrCode, RefreshCw, Download } from "lucide-react";

interface InventoryFormProps {
    initialData?: any;
    onSubmit: (data: any) => Promise<void>;
    onCancel: () => void;
    onPrintLabels?: (item: any, copies: number) => void;
    loading?: boolean;
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
    const form = useForm({
        defaultValues: initialData || {
            item_name: "",
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
        },
    });

    const [qrValue, setQrValue] = useState(form.getValues("qr_code") || "");

    useEffect(() => {
        if (initialData) {
            form.reset(initialData);
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

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
