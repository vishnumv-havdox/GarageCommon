import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    Save,
    Trash2,
    Plus,
    Loader2,
    Calendar as CalendarIcon,
    Printer,
    Download,
    Eye,
    Lock,
    RefreshCw,
    Info,
    Receipt
} from "lucide-react";
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { Label } from "@/components/ui/label";

import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { generateInvoicePDF } from "@/utils/pdfGenerator";
import { Separator } from "@/components/ui/separator";
import { useReactToPrint } from "react-to-print";
import { InvoiceTemplate } from "@/components/invoices/InvoiceTemplate";
import { ToWords } from 'to-words';

const toWords = new ToWords({
    localeCode: 'en-IN',
    converterOptions: {
        currency: true,
        ignoreDecimal: false,
        ignoreZeroCurrency: false,
        doNotAddOnly: false,
        currencyOptions: {
            name: 'Rupee',
            plural: 'Rupees',
            symbol: '₹',
            fractionalUnit: {
                name: 'Paisa',
                plural: 'Paise',
                symbol: '',
            }
        }
    }
});

interface InvoiceItem {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
    type: string;
    category?: string;
    hsn_code?: string;
    taxable_value?: number;
    gst_rate?: number;
    cgst_rate?: number;
    sgst_rate?: number;
    cgst_amount?: number;
    sgst_amount?: number;
}

interface ServiceType {
    id: string;
    name: string;
}

interface TaskTemplate {
    id: string;
    service_type_id: string;
    name: string;
}

const InvoiceItemEditor = ({
    item,
    index,
    onChange,
    onRemove,
    isReadOnly,
    taskTemplates,
    serviceTypes,
    itemType = 'service'
}: {
    item: InvoiceItem;
    index: number;
    onChange: (index: number, field: keyof InvoiceItem | Partial<InvoiceItem>, value?: any) => void;
    onRemove: (index: number) => void;
    isReadOnly: boolean;
    taskTemplates: any[];
    serviceTypes?: ServiceType[];
    itemType?: 'service' | 'part';
}) => {
    const [open, setOpen] = useState(false);

    // Filter tasks by selected category name
    const selectedServiceId = serviceTypes?.find(st => st.name === item.category)?.id;

    // Filter tasks by selected category name
    // Filter tasks by selected category name if serviceTypes is present (meaning it's a Service item)
    // If serviceTypes is undefined, it's an Inventory item, so show all templates (which are parts)
    const filteredTasks = itemType === 'service' && serviceTypes
        ? (selectedServiceId ? taskTemplates.filter(t => t.service_type_id === selectedServiceId) : taskTemplates)
        : taskTemplates;

    return (
        <Card className="mb-4 relative border-l-4 border-l-primary/20 hover:border-l-primary transition-all">
            <CardContent className="p-4 grid gap-4">
                <div className="flex justify-between items-start gap-4">
                    {itemType === 'service' && serviceTypes && (
                        <div className="flex-1 space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase">Service Category</Label>
                            <Select
                                value={item.category || ""}
                                onValueChange={(val) => {
                                    onChange(index, "category", val);
                                    onChange(index, "description", ""); // Clear task when category changes
                                    onChange(index, "unit_price", 0);
                                    onChange(index, "hsn_code", "");
                                }}
                                disabled={isReadOnly}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Service..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {serviceTypes.map(st => (
                                        <SelectItem key={st.id} value={st.name}>{st.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="flex-[2] space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase">Task / Item Name</Label>
                        <Popover open={open} onOpenChange={setOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={open}
                                    className="w-full justify-between"
                                    disabled={isReadOnly}
                                >
                                    {item.description || "Select or Type Item..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Search tasks..." />
                                    <CommandList>
                                        <CommandEmpty>No task found.</CommandEmpty>
                                        <CommandGroup heading="Tasks">
                                            {filteredTasks.map((task) => (
                                                <CommandItem
                                                    key={task.id}
                                                    value={task.name}
                                                    onSelect={() => {
                                                        const updates: any = { description: task.name };

                                                        // Auto-fill details
                                                        if (task.price) {
                                                            updates.unit_price = task.price;
                                                        }

                                                        // Auto-fill HSN/SAC
                                                        const taxCode = task.sac_code || task.hsn_code;
                                                        if (taxCode) updates.hsn_code = taxCode;

                                                        onChange(index, updates);
                                                        setOpen(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            item.description === task.name ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {task.name}
                                                    {task.price && <span className="ml-auto text-xs text-muted-foreground">₹{task.price}</span>}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                        <CommandGroup heading="Custom">
                                            <CommandItem
                                                value="custom-input"
                                                onSelect={() => { }}
                                            >
                                                Type to search or enter custom description below.
                                            </CommandItem>
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        {/* Fallback Text Input */}
                        <Input
                            value={item.description || ''}
                            onChange={(e) => onChange(index, "description", e.target.value)}
                            placeholder="Or type custom description here..."
                            className="mt-1"
                            disabled={isReadOnly}
                        />
                    </div>
                    {!isReadOnly && (
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => onRemove(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                        <Label className="text-xs">HSN Code</Label>
                        <Input
                            value={item.hsn_code || ''}
                            onChange={(e) => onChange(index, 'hsn_code', e.target.value)}
                            disabled={isReadOnly}
                            placeholder="HSN/SAC"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Quantity</Label>
                        <Input
                            type="number"
                            value={item.quantity || ''}
                            onChange={(e) => onChange(index, 'quantity', e.target.value)}
                            disabled={isReadOnly}
                            min={1}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Unit Price (₹)</Label>
                        <Input
                            type="number"
                            value={item.unit_price || ''}
                            onChange={(e) => onChange(index, 'unit_price', e.target.value)}
                            disabled={isReadOnly}
                            min={0}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">GST Rate (%)</Label>
                        <Input
                            type="number"
                            value={item.gst_rate ?? ''}
                            onChange={(e) => onChange(index, 'gst_rate', e.target.value)}
                            disabled={isReadOnly}
                        />
                    </div>
                </div>

                {/* Read-only Calculations */}
                <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg text-xs border border-slate-100 items-center">
                    <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Taxable</span>
                        <span className="font-mono font-medium">₹{(item.taxable_value || 0).toFixed(2)}</span>
                    </div>
                    <div>
                        <span className="text-slate-400 block text-[10px] uppercase">CGST ({item.cgst_rate}%)</span>
                        <span className="font-mono text-slate-600">₹{(item.cgst_amount || 0).toFixed(2)}</span>
                    </div>
                    <div>
                        <span className="text-slate-400 block text-[10px] uppercase">SGST ({item.sgst_rate}%)</span>
                        <span className="font-mono text-slate-600">₹{(item.sgst_amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-slate-400 block text-[10px] uppercase">Line Total</span>
                        <span className="font-bold text-base text-primary">₹{(item.total || 0).toFixed(2)}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default function InvoiceEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Data
    const [invoice, setInvoice] = useState<any>(null);
    const [items, setItems] = useState<InvoiceItem[]>([]);
    const [payments, setPayments] = useState<any[]>([]);

    // Catalogs
    const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
    const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);

    // Derived Totals
    const [subtotal, setSubtotal] = useState(0);
    const [taxAmount, setTaxAmount] = useState(0);
    const [grandTotal, setGrandTotal] = useState(0);
    const [companyProfile, setCompanyProfile] = useState<any>(null);
    const [invoiceSettings, setInvoiceSettings] = useState<any>(null);

    // Settings (could come from DB)
    const [taxRate, setTaxRate] = useState(18); // Default 18% GST (should be configurable)

    // Quotation specific
    const isQuotation = invoice?.type === 'quotation';
    const isFinalized = invoice?.status !== 'Draft';

    // Effect to set initial tax rate based on type
    useEffect(() => {
        if (invoice?.type === 'quotation' && !invoice.subtotal) {
            // If new quotation, default tax to 0
            setTaxRate(0);
        } else if (invoice?.type === 'quotation' && invoice.tax === 0) {
            setTaxRate(0);
        }
    }, [invoice?.type]);

    useEffect(() => {
        if (id) fetchInvoiceData();
        fetchCatalogs();
        fetchCompanyProfile();
    }, [id]);

    const printRef = React.useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: invoice ? `${invoice.type === 'quotation' ? 'QTN' : 'INV'}-${invoice.bill_number || invoice.invoice_number}` : 'Invoice',
    });

    const fetchCompanyProfile = async () => {
        const { data: profile } = await supabase.from('company_profiles').select('*').single();
        setCompanyProfile(profile);

        const { data: settings } = await supabase.from('document_settings').select('*').eq('doc_type', 'invoice').single();
        setInvoiceSettings(settings);
    };

    useEffect(() => {
        calculateTotals();
    }, [items, taxRate]);

    const fetchCatalogs = async () => {
        const { data: st, error: stError } = await supabase.from('service_types').select('*').order('name');
        if (stError) console.error("Error fetching service types:", stError);
        setServiceTypes(st || []);

        const { data: tt, error: ttError } = await supabase.from('task_templates').select('*').order('name');
        if (ttError) console.error("Error fetching task templates:", ttError);
        setTaskTemplates(tt || []);

        const { data: inv, error: invError } = await supabase.from('inventory').select('id, item_name, unit_price, sku, hsn_code').gt('quantity', 0);
        if (invError) console.error("Error fetching inventory:", invError);
        setInventoryItems(inv || []);
    };

    const fetchInvoiceData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Invoice
            const { data: inv, error: invError } = await supabase
                .from('invoices')
                .select(`
                    *,
                    customer:customers(*),
                    work_order:work_orders(
                        *,
                        vehicle:vehicles!vehicle_id(*)
                    ),
                    payment_links(
                      amount_applied,
                      payment:payments(*)
                    )
                `)
                .eq('id', id)
                .single();

            if (invError) throw invError;
            if (!inv) throw new Error("Invoice not found");
            setInvoice(inv);

            // Extract payments from links
            const linkedPayments = (inv as any).payment_links?.map((l: any) => ({
                ...l.payment,
                amount_applied: l.amount_applied
            })) || [];

            // Also fetch payments that directly reference this invoice_id (legacy or direct)
            const { data: directPayments } = await supabase
                .from('payments')
                .select('*')
                .eq('invoice_id', id);

            // Merge and deduplicate
            const allPayments = [...linkedPayments];
            directPayments?.forEach((dp: any) => {
                if (!allPayments.some(p => p.id === dp.id)) {
                    allPayments.push({ ...dp, amount_applied: dp.amount });
                }
            });

            setPayments(allPayments);

            // 2. Fetch Items
            const { data: invItems, error: itemsError } = await supabase
                .from('invoice_items')
                .select('*')
                .eq('invoice_id', id)
                .order('created_at', { ascending: true });

            if (itemsError) throw itemsError;
            setItems(invItems || []);

        } catch (error: any) {
            console.error("Error fetching invoice:", error);
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const calculateTotals = () => {
        let sub = 0;
        let cgst_total = 0;
        let sgst_total = 0;

        items.forEach(item => {
            const taxable = item.quantity * item.unit_price;
            const cgst_rate = item.cgst_rate ?? (taxRate / 2);
            const sgst_rate = item.sgst_rate ?? (taxRate / 2);

            const cgst = taxable * (cgst_rate / 100);
            const sgst = taxable * (sgst_rate / 100);

            sub += taxable;
            cgst_total += cgst;
            sgst_total += sgst;

            // Note: We don't update state here to avoid loops, 
            // the individual item amounts should be set in handleItemChange
        });

        setSubtotal(sub);
        setTaxAmount(cgst_total + sgst_total);
        setGrandTotal(sub + cgst_total + sgst_total);
    };

    const handleItemChange = (index: number, field: keyof InvoiceItem | Partial<InvoiceItem>, value?: any) => {
        setItems(prevItems => {
            const newItems = [...prevItems];
            const item = { ...newItems[index] };

            if (typeof field === 'string') {
                // Single field update
                // @ts-ignore
                item[field] = field === 'description' || field === 'hsn_code' || field === 'category' ? value : (parseFloat(value) || 0);
            } else {
                // Batch update
                Object.assign(item, field);
            }

            // Recalculate totals
            const qty = item.quantity || 0;
            const price = item.unit_price || 0;
            const gst = item.gst_rate ?? taxRate; // Default to global rate if item rate unset

            // Update tax rates if needed (e.g. if gst_rate specifically changed or simple re-calc)
            // Ideally we check if gst_rate changed, but re-calculating always is safer for consistency
            if (typeof field === 'string' && field === 'gst_rate') {
                item.cgst_rate = gst / 2;
                item.sgst_rate = gst / 2;
            } else if (typeof field === 'object' && 'gst_rate' in field) {
                item.cgst_rate = (field.gst_rate as number) / 2;
                item.sgst_rate = (field.gst_rate as number) / 2;
            }
            // Ensure rates exist
            item.cgst_rate = item.cgst_rate ?? (gst / 2);
            item.sgst_rate = item.sgst_rate ?? (gst / 2);

            // Calculations
            const taxable = qty * price;
            item.taxable_value = taxable;
            item.cgst_amount = taxable * (item.cgst_rate / 100);
            item.sgst_amount = taxable * (item.sgst_rate / 100);
            item.total = taxable + item.cgst_amount + item.sgst_amount;

            newItems[index] = item;
            return newItems;
        });
    };

    const handleAddItem = (category: string = "", type: string = "service") => {
        const newItem: InvoiceItem = {
            id: `temp-${Date.now()}`, // Temporary ID
            description: "",
            quantity: 1,
            unit_price: 0,
            total: 0,
            type: type, // Use passed type
            category: category,
            gst_rate: taxRate,
            cgst_rate: taxRate / 2,
            sgst_rate: taxRate / 2,
            cgst_amount: 0,
            sgst_amount: 0
        };
        setItems([...items, newItem]);
    };

    const handleRemoveItem = async (index: number) => {
        const item = items[index];
        // If it's a temp item, just remove from state
        if (item.id.startsWith('temp-')) {
            setItems(items.filter((_, i) => i !== index));
            return;
        }
        // If DB item, remove from state (will be deleted on save)
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSave = async (finalize = false) => {
        setSaving(true);
        try {
            // 1. Upsert Items
            const itemsToUpsert = items.map(item => {
                const payload: any = {
                    invoice_id: id,
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total: item.total,
                    type: item.type,
                    category: item.category,
                    hsn_code: item.hsn_code,
                    taxable_value: item.taxable_value || (item.quantity * item.unit_price),
                    gst_rate: item.gst_rate ?? taxRate,
                    cgst_rate: item.cgst_rate ?? ((item.gst_rate ?? taxRate) / 2),
                    sgst_rate: item.sgst_rate ?? ((item.gst_rate ?? taxRate) / 2),
                    cgst_amount: item.cgst_amount ?? ((item.quantity * item.unit_price) * ((item.cgst_rate ?? taxRate / 2) / 100)),
                    sgst_amount: item.sgst_amount ?? ((item.quantity * item.unit_price) * ((item.sgst_rate ?? taxRate / 2) / 100)),
                };
                if (!item.id.startsWith('temp-')) {
                    payload.id = item.id;
                }
                return payload;
            });

            // Upsert all items
            const { error: upsertError } = await supabase
                .from('invoice_items')
                .upsert(itemsToUpsert as any);

            if (upsertError) throw upsertError;

            // 2. Identify and Delete Removed Items
            // We need to find items in DB that are NOT in our current `items` list
            const currentIds = items.filter(i => !i.id.startsWith('temp-')).map(i => i.id);
            if (currentIds.length > 0) {
                await supabase
                    .from('invoice_items')
                    .delete()
                    .eq('invoice_id', id)
                    .not('id', 'in', `(${currentIds.join(',')})`);
            } else if (items.length === 0) {
                // If all items removed
                await supabase.from('invoice_items').delete().eq('invoice_id', id);
            }


            // 3. Update Invoice Header
            const updatePayload: any = {
                subtotal,
                tax: taxAmount,
                total: grandTotal,
                notes: invoice.notes, // If we added a notes field editor
            };

            if (finalize) {
                updatePayload.status = 'Sent'; // Or 'Unpaid'/'Finalized'
            }

            const { error: headerError } = await (supabase.from('invoices') as any)
                .update(updatePayload)
                .eq('id', id);

            if (headerError) throw headerError;

            toast({ title: "Saved", description: finalize ? "Invoice finalized!" : "Invoice updated successfully." });
            fetchInvoiceData(); // Refresh to get proper IDs and Bill Number

        } catch (error: any) {
            console.error("Save error:", error);
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleConvertToInvoice = async () => {
        if (!confirm("Convert this Quotation to a Tax Invoice? This will change the document type.")) return;
        setSaving(true);
        try {
            await (supabase.from('invoices') as any).update({ type: 'invoice', status: 'Draft' }).eq('id', id);
            toast({ title: "Converted", description: "Document converted to Tax Invoice." });
            window.location.reload(); // Simple reload to refresh all state
        } catch (e: any) {
            toast({ variant: "destructive", title: "Error", description: e.message });
        } finally {
            setSaving(false);
        }
    };

    // Helper to get filtered tasks based on category
    const getTasksForCategory = (categoryName?: string) => {
        if (!categoryName) return [];
        const typeId = serviceTypes.find(st => st.name === categoryName)?.id;
        if (!typeId) return [];
        return taskTemplates.filter(t => t.service_type_id === typeId);
    }

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!invoice) return <div>Invoice not found</div>;

    return (
        <div className="min-h-screen bg-background">
            <div className="flex flex-col lg:flex-row">
                <AdminSidebar />
                <main className="flex-1 p-4 lg:p-8 space-y-8">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" onClick={() => navigate('/admin/invoices')}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold flex items-center gap-2">
                                    {isQuotation ? (invoice.quotation_number ? `Quotation #${invoice.quotation_number}` : (invoice.id ? `Draft Quotation` : 'New Quotation')) : (invoice.bill_number ? `Invoice #${invoice.bill_number}` : 'Draft Invoice')}
                                    <Badge variant={isFinalized ? "default" : "secondary"} className={`ml-2 ${isQuotation ? 'bg-orange-500' : ''}`}>
                                        {invoice.status}
                                    </Badge>
                                    {isQuotation && <Badge variant="outline" className="ml-2 border-orange-500 text-orange-600">Estimate</Badge>}
                                    {invoice.work_order?.is_reopened && (
                                        <Badge variant="outline" className="ml-2 border-orange-500 text-orange-600 bg-orange-50 animate-pulse">
                                            <RefreshCw className="h-3 w-3 mr-1" /> Reopened
                                        </Badge>
                                    )}
                                </h1>
                                {invoice.work_order?.is_reopened && invoice.work_order?.reopen_reason && (
                                    <div className="mt-1 flex items-center gap-2 text-orange-600 text-[10px] font-medium uppercase tracking-wider">
                                        <Info className="h-3 w-3" /> Reason: {invoice.work_order.reopen_reason}
                                    </div>
                                )}
                                <p className="text-muted-foreground">
                                    {invoice.customer?.name} • {invoice.work_order?.vehicle?.vehicle_number}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => generateInvoicePDF(invoice.work_order_id, 'save')} title="Download PDF">
                                <Download className="h-4 w-4 mr-2" /> PDF
                            </Button>
                            <Button variant="outline" onClick={() => generateInvoicePDF(invoice.work_order_id, 'preview')} className="bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200">
                                <Eye className="h-4 w-4 mr-2" /> Preview
                            </Button>
                            {!isFinalized && (
                                <Button onClick={() => handleSave(false)} disabled={saving} variant="outline">
                                    <Save className="h-4 w-4 mr-2" /> Save Draft
                                </Button>
                            )}
                            {!isFinalized && (
                                <Button onClick={() => handleSave(true)} disabled={saving} className={isQuotation ? "bg-orange-600 hover:bg-orange-700 text-white" : ""}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    <Lock className="h-4 w-4 mr-2" /> {isQuotation ? 'Finalize Quotation' : 'Finalize Invoice'}
                                </Button>
                            )}
                            {!isFinalized && isQuotation && (
                                <Button onClick={handleConvertToInvoice} disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">
                                    <RefreshCw className="h-4 w-4 mr-2" /> Convert to Invoice
                                </Button>
                            )}
                            <Button variant="outline" onClick={() => handlePrint()} className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/20">
                                <Printer className="h-4 w-4 mr-2" /> Print
                            </Button>
                            <Button
                                variant="destructive"
                                size="icon"
                                title="Delete Invoice"
                                onClick={async () => {
                                    if (confirm("Are you sure you want to DELETE this invoice? This action cannot be undone.")) {
                                        setLoading(true);
                                        const { error } = await supabase.from('invoices').delete().eq('id', id);
                                        if (error) {
                                            toast({ variant: "destructive", title: "Error", description: error.message });
                                            setLoading(false);
                                        } else {
                                            toast({ title: "Deleted", description: "Invoice deleted successfully." });
                                            navigate('/admin/invoices');
                                        }
                                    }
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            {!isFinalized && (
                                <Button variant="ghost" size="icon" title="Reset from Work Order" onClick={async () => {
                                    if (confirm("Reset invoice items from Work Order? This will overwrite changes.")) {
                                        setLoading(true);
                                        // Delete existing items
                                        await supabase.from('invoice_items').delete().eq('invoice_id', id);

                                        // Fetch services, tasks, and parts
                                        const { data: services }: any = await supabase.from('work_order_services').select('*').eq('work_order_id', invoice.work_order_id);
                                        const { data: tasks }: any = await supabase.from('work_order_tasks').select('*').eq('work_order_id', invoice.work_order_id);
                                        const { data: parts }: any = await supabase.from('work_order_parts').select('*').eq('work_order_id', invoice.work_order_id);

                                        const newItems: any[] = [];

                                        if (services && services.length > 0) {
                                            services.forEach(service => {
                                                const serviceTasks = tasks?.filter(t => t.service_id === service.id) || [];

                                                if (serviceTasks.length > 0) {
                                                    serviceTasks.forEach((task, idx) => {
                                                        const finalPrice = service.billing_price || service.estimated_cost;
                                                        newItems.push({
                                                            invoice_id: id,
                                                            work_order_service_id: service.id,
                                                            description: task.task_name,
                                                            quantity: 1,
                                                            unit_price: idx === 0 ? finalPrice : 0,
                                                            total: idx === 0 ? finalPrice : 0,
                                                            type: 'service',
                                                            category: service.service_type
                                                        });
                                                    });
                                                } else {
                                                    const finalPrice = service.billing_price || service.estimated_cost;
                                                    newItems.push({
                                                        invoice_id: id,
                                                        work_order_service_id: service.id,
                                                        description: "",
                                                        quantity: 1,
                                                        unit_price: finalPrice,
                                                        total: finalPrice,
                                                        type: 'service',
                                                        category: service.service_type
                                                    });
                                                }
                                            });
                                        }

                                        if (parts && parts.length > 0) {
                                            parts.forEach(part => {
                                                newItems.push({
                                                    invoice_id: id,
                                                    description: part.part_name,
                                                    quantity: part.quantity,
                                                    unit_price: part.unit_price,
                                                    total: part.quantity * part.unit_price,
                                                    type: 'part',
                                                    category: 'Spare'
                                                });
                                            });
                                        }

                                        if (newItems.length > 0) {
                                            await (supabase.from('invoice_items') as any).insert(newItems);
                                        }

                                        toast({ title: "Reset Complete", description: "Items synced from Work Order (Services & Parts)." });
                                        fetchInvoiceData();
                                    }
                                }}>
                                    <RefreshCw className="h-4 w-4 text-orange-500" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Hidden Invoice for Printing - Using off-screen positioning to ensure render */}
                    <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '210mm', minHeight: '297mm' }}>
                        <div ref={printRef}>
                            <InvoiceTemplate invoice={invoice} items={items} companyProfile={companyProfile} settings={invoiceSettings} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Main Content: Items */}
                        <div className="md:col-span-2 space-y-6">
                            <Card>
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <CardTitle>Line Items</CardTitle>
                                            <CardDescription>Services grouped by Category</CardDescription>
                                        </div>
                                        {!isFinalized && (
                                            <div className="flex gap-2">
                                                <Select onValueChange={(val) => handleAddItem(val)}>
                                                    <SelectTrigger className="w-[180px]">
                                                        <SelectValue placeholder="Add New Section..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {serviceTypes.map(st => (
                                                            <SelectItem key={st.id} value={st.name}>{st.name}</SelectItem>
                                                        ))}
                                                        <SelectItem value="General">General / Other</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-8 pt-0">
                                    {/* Service Bill Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <h3 className="text-lg font-bold text-primary">I. SERVICE BILL</h3>
                                            {!isFinalized && (
                                                <Button size="sm" variant="outline" onClick={() => handleAddItem("General", "service")}>
                                                    <Plus className="h-4 w-4 mr-2" /> Add Service
                                                </Button>
                                            )}
                                        </div>
                                        <div>
                                            {items.filter(i => i.type === 'service').map((item, idx) => {
                                                const originalIndex = items.findIndex(orig => orig.id === item.id);
                                                return (
                                                    <InvoiceItemEditor
                                                        key={item.id}
                                                        item={item}
                                                        index={originalIndex}
                                                        onChange={handleItemChange}
                                                        onRemove={handleRemoveItem}
                                                        isReadOnly={isFinalized}
                                                        taskTemplates={taskTemplates}
                                                        serviceTypes={serviceTypes}
                                                        itemType="service"
                                                    />
                                                );
                                            })}
                                            {items.filter(i => i.type === 'service').length === 0 && (
                                                <div className="text-center py-8 text-muted-foreground border-dashed border-2 rounded-lg bg-slate-50">
                                                    No service items added.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Inventory Bill Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <h3 className="text-lg font-bold text-primary">II. INVENTORY BILL</h3>
                                            {!isFinalized && (
                                                <Button size="sm" variant="outline" onClick={() => handleAddItem("Spare", "part")}>
                                                    <Plus className="h-4 w-4 mr-2" /> Add Part
                                                </Button>
                                            )}
                                        </div>
                                        <div>
                                            {items.filter(i => i.type === 'part').map((item, idx) => {
                                                const originalIndex = items.findIndex(orig => orig.id === item.id);
                                                return (
                                                    <InvoiceItemEditor
                                                        key={item.id}
                                                        item={item}
                                                        index={originalIndex}
                                                        onChange={handleItemChange}
                                                        onRemove={handleRemoveItem}
                                                        isReadOnly={isFinalized}
                                                        taskTemplates={inventoryItems.map(i => ({ id: i.id, name: i.item_name, price: i.unit_price, hsn_code: i.hsn_code, service_type_id: 'spare' }))}
                                                        itemType="part"
                                                    />
                                                );
                                            })}
                                            {items.filter(i => i.type === 'part').length === 0 && (
                                                <div className="text-center py-8 text-muted-foreground border-dashed border-2 rounded-lg bg-slate-50">
                                                    No parts added.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {items.length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground border-dashed border-2 rounded-lg">
                                            No items yet. Add a section above.
                                        </div>
                                    )}

                                </CardContent>
                            </Card>

                            {/* Notes */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Invoice Notes</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Textarea
                                        value={invoice.notes || ''}
                                        onChange={(e) => setInvoice({ ...invoice, notes: e.target.value })}
                                        placeholder="Additional notes, payment terms, etc."
                                        disabled={isFinalized}
                                    />
                                </CardContent>
                            </Card>
                        </div>

                        {/* Sidebar: Summary & Customer Info */}
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Customer Details</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <div>
                                        <div className="font-semibold">{invoice.customer?.name}</div>
                                        <div className="text-muted-foreground">{invoice.customer?.company_name}</div>
                                        {/* Show GST only for Tax Invoices */}
                                        {!isQuotation && invoice.customer?.gst_number && (
                                            <div className="text-xs mt-1 text-muted-foreground">
                                                <span className="font-medium">GSTIN:</span> {invoice.customer.gst_number}
                                            </div>
                                        )}
                                    </div>
                                    <Separator />
                                    <div>
                                        <div className="font-medium">Vehicle</div>
                                        <div>{invoice.work_order?.vehicle?.vehicle_number}</div>
                                        <div className="text-muted-foreground">{invoice.work_order?.vehicle?.model}</div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Payment Details</CardTitle>
                                    {/* Subtotal & Taxes Section */}
                                    <div className="space-y-3 bg-muted/20 p-6 rounded-xl border border-dashed">
                                        <div className="flex justify-between items-center text-sm text-muted-foreground italic">
                                            <span>Subtotal</span>
                                            <span className="font-mono">₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm text-muted-foreground italic">
                                            <span>Total Tax (GST)</span>
                                            <span className="font-mono">₹{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <Separator className="bg-muted-foreground/10" />
                                        <div className="flex justify-between items-center">
                                            <span className="text-lg font-bold">Grand Total</span>
                                            <span className="text-2xl font-black text-primary font-mono tracking-tighter">
                                                ₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        {/* Payment Summary */}
                                        {invoice?.status !== 'Draft' && (
                                            <>
                                                <Separator className="bg-muted-foreground/10" />
                                                <div className="space-y-2 pt-2">
                                                    <div className="flex justify-between items-center text-sm text-green-600 font-medium">
                                                        <span>Total Paid</span>
                                                        <span className="font-mono">₹{payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + (p.amount_applied || p.amount), 0).toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm text-orange-600 font-medium">
                                                        <span>Deductions Applied</span>
                                                        <span className="font-mono">₹{(invoice?.total_deductions || 0).toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center pt-2 border-t font-bold text-lg">
                                                        <span>Balance Due</span>
                                                        <span className={grandTotal - payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + (p.amount_applied || p.amount), 0) - (invoice?.total_deductions || 0) <= 0 ? "text-green-600 font-mono" : "text-destructive font-mono"}>
                                                            ₹{Math.max(0, grandTotal - payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + (p.amount_applied || p.amount), 0) - (invoice?.total_deductions || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Payment History Section */}
                                    {payments.length > 0 && (
                                        <div className="mt-8 space-y-4">
                                            <h3 className="font-bold text-lg flex items-center gap-2">
                                                <Receipt className="h-5 w-5 text-primary" /> Payment History
                                            </h3>
                                            <div className="space-y-3">
                                                {payments.map((p) => (
                                                    <div key={p.id} className="p-4 border rounded-lg bg-background hover:bg-muted/5 transition-colors group">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold">₹{(p.amount_applied || p.amount).toLocaleString()}</span>
                                                                    <Badge variant={p.status === 'approved' ? 'default' : p.status === 'pending' ? 'outline' : 'destructive'} className={p.status === 'approved' ? 'bg-green-600 text-[10px]' : 'text-[10px]'}>
                                                                        {p.status}
                                                                    </Badge>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground mt-1">
                                                                    {format(new Date(p.created_at), "MMM d, yyyy • hh:mm a")} via {p.payment_method}
                                                                </p>
                                                            </div>
                                                            {p.proof_url && (
                                                                <Button variant="ghost" size="sm" className="h-8 text-xs p-1" asChild>
                                                                    <a href={p.proof_url} target="_blank" rel="noreferrer">
                                                                        <Download className="h-3 w-3 mr-1" /> Proof
                                                                    </a>
                                                                </Button>
                                                            )}
                                                        </div>
                                                        {p.deduction_amount > 0 && (
                                                            <div className="mt-2 py-1 px-2 bg-orange-50 border border-orange-100 rounded text-[11px] text-orange-700 flex justify-between items-center">
                                                                <span>Deduction: <span className="font-bold">₹{p.deduction_amount.toLocaleString()}</span> ({p.deduction_reason})</span>
                                                                {p.is_final_settlement && <Badge variant="outline" className="h-4 text-[9px] bg-orange-100 border-orange-200 text-orange-800">Final Settlement</Badge>}
                                                            </div>
                                                        )}
                                                        {p.admin_remarks && (
                                                            <p className="mt-2 text-[11px] text-muted-foreground italic border-l-2 pl-2">
                                                                Admin: {p.admin_remarks}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {isQuotation && (
                                        <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-100 mt-2">
                                            * Valid for 30 days. This is not a tax invoice.
                                        </div>
                                    )}

                                    <Separator className="my-4" />

                                    {companyProfile?.bank_name ? (
                                        <div className="text-xs space-y-1 bg-muted/50 p-2 rounded">
                                            <div className="font-semibold text-muted-foreground mb-1">Bank Account</div>
                                            <div className="flex justify-between"><span>Bank:</span> <span>{companyProfile.bank_name}</span></div>
                                            <div className="flex justify-between"><span>Acct:</span> <span>{companyProfile.acc_number}</span></div>
                                            <div className="flex justify-between"><span>IFSC:</span> <span>{companyProfile.ifsc}</span></div>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-muted-foreground italic">
                                            No bank details configured. Go to Settings.
                                        </div>
                                    )}
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-muted-foreground">Subtotal</span>
                                        <span>₹{subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground">Tax</span>
                                            {!isFinalized && (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[10px] text-muted-foreground">Global Rate:</span>
                                                    <Input
                                                        className="w-12 h-6 text-xs p-1"
                                                        value={taxRate}
                                                        onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                                                    />
                                                    <span className="text-[10px]">%</span>
                                                </div>
                                            )}
                                        </div>
                                        <span>₹{taxAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between pt-2 text-lg font-bold">
                                        <span>Total</span>
                                        <span>₹{grandTotal.toFixed(2)}</span>
                                    </div>

                                    {isQuotation && (
                                        <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-100 mt-2">
                                            * Valid for 30 days. This is not a tax invoice.
                                        </div>
                                    )}

                                    <Separator className="my-4" />

                                    {companyProfile?.bank_name ? (
                                        <div className="text-xs space-y-1 bg-muted/50 p-2 rounded">
                                            <div className="font-semibold text-muted-foreground mb-1">Bank Account</div>
                                            <div className="flex justify-between"><span>Bank:</span> <span>{companyProfile.bank_name}</span></div>
                                            <div className="flex justify-between"><span>Acct:</span> <span>{companyProfile.acc_number}</span></div>
                                            <div className="flex justify-between"><span>IFSC:</span> <span>{companyProfile.ifsc}</span></div>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-muted-foreground italic">
                                            No bank details configured. Go to Settings.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </main >
            </div >
        </div >
    );
}
