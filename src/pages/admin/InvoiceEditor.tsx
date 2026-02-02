import { useState, useEffect } from "react";
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
    RefreshCw
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { generateInvoicePDF } from "@/utils/pdfGenerator";
import { Separator } from "@/components/ui/separator";
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

export default function InvoiceEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Data
    const [invoice, setInvoice] = useState<any>(null);
    const [items, setItems] = useState<InvoiceItem[]>([]);

    // Catalogs
    const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
    const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);

    // Derived Totals
    const [subtotal, setSubtotal] = useState(0);
    const [taxAmount, setTaxAmount] = useState(0);
    const [grandTotal, setGrandTotal] = useState(0);
    const [companyProfile, setCompanyProfile] = useState<any>(null);

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

    const fetchCompanyProfile = async () => {
        const { data } = await supabase.from('company_profiles').select('*').single();
        setCompanyProfile(data);
    };

    useEffect(() => {
        calculateTotals();
    }, [items, taxRate]);

    const fetchCatalogs = async () => {
        const { data: st, error: stError } = await supabase.from('service_types').select('*').order('name');
        if (stError) console.error("Error fetching service types:", stError);
        console.log("Service Types loaded:", st?.length);
        setServiceTypes(st || []);

        const { data: tt, error: ttError } = await supabase.from('task_templates').select('*').order('name');
        if (ttError) console.error("Error fetching task templates:", ttError);
        console.log("Task Templates loaded:", tt?.length);
        setTaskTemplates(tt || []);
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
                    )
                `)
                .eq('id', id)
                .single();

            if (invError) throw invError;
            setInvoice(inv);

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

    const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
        const newItems = [...items];
        const item = { ...newItems[index] };

        // @ts-ignore
        item[field] = field === 'description' ? value : (parseFloat(value) || 0);

        if (field === 'quantity' || field === 'unit_price' || field === 'gst_rate' || field === 'cgst_rate' || field === 'sgst_rate') {
            const taxable = item.quantity * item.unit_price;
            const gst = item.gst_rate ?? taxRate;

            // If HSN changed or we are initializing, we might set these
            if (field === 'gst_rate') {
                item.cgst_rate = gst / 2;
                item.sgst_rate = gst / 2;
            }

            const cgst_r = item.cgst_rate ?? (gst / 2);
            const sgst_r = item.sgst_rate ?? (gst / 2);

            item.taxable_value = taxable;
            item.cgst_amount = taxable * (cgst_r / 100);
            item.sgst_amount = taxable * (sgst_r / 100);
            item.total = taxable + item.cgst_amount + item.sgst_amount;
        }

        newItems[index] = item;
        setItems(newItems);
    };

    const handleAddItem = (category: string = "") => {
        const newItem: InvoiceItem = {
            id: `temp-${Date.now()}`, // Temporary ID
            description: "",
            quantity: 1,
            unit_price: 0,
            total: 0,
            type: 'service',
            category: category // Use passed category
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
                                </h1>
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
                            <Button variant="outline" onClick={() => generateInvoicePDF(invoice.work_order_id, 'preview')} className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/20">
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
                                                <Button size="sm" variant="outline" onClick={() => handleAddItem("service")}>
                                                    <Plus className="h-4 w-4 mr-2" /> Add Service
                                                </Button>
                                            )}
                                        </div>
                                        <div className="border rounded-xl shadow-sm bg-white overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-primary/5 hover:bg-primary/5 border-b-2 border-primary/20">
                                                        <TableHead className="w-[40px] font-bold text-primary py-4 px-2 text-center border-x">#</TableHead>
                                                        <TableHead className="font-bold text-primary px-3 border-x">Particulars</TableHead>
                                                        <TableHead className="w-[90px] font-bold text-primary px-2 border-x">HSN</TableHead>
                                                        <TableHead className="w-[100px] font-bold text-primary text-right px-2 border-x">Taxable</TableHead>
                                                        <TableHead className="w-[50px] font-bold text-primary text-center px-1 border-x">%</TableHead>
                                                        <TableHead className="w-[90px] font-bold text-primary text-right px-2 border-x">CGST</TableHead>
                                                        <TableHead className="w-[90px] font-bold text-primary text-right px-2 border-x">SGST</TableHead>
                                                        <TableHead className="w-[110px] text-right font-bold text-primary pr-4 border-x">Total</TableHead>
                                                        <TableHead className="w-[40px] border-x"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {items.filter(i => i.type === 'service').map((item, idx) => {
                                                        const originalIndex = items.findIndex(orig => orig.id === item.id);
                                                        return (
                                                            <TableRow key={item.id}>
                                                                <TableCell className="px-2 font-medium text-muted-foreground text-center border-x">{idx + 1}</TableCell>
                                                                <TableCell className="px-2 border-x">
                                                                    <Input
                                                                        value={item.description}
                                                                        onChange={(e) => handleItemChange(originalIndex, 'description', e.target.value)}
                                                                        className="h-8 border-none focus-visible:ring-1 px-1"
                                                                        disabled={isFinalized}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="px-1 border-x">
                                                                    <Input
                                                                        value={item.hsn_code || ''}
                                                                        onChange={(e) => handleItemChange(originalIndex, 'hsn_code', e.target.value)}
                                                                        className="h-8 border-none focus-visible:ring-1 px-1"
                                                                        disabled={isFinalized}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-right px-1 border-x">
                                                                    <Input
                                                                        type="number"
                                                                        value={item.unit_price}
                                                                        onChange={(e) => handleItemChange(originalIndex, 'unit_price', e.target.value)}
                                                                        className="h-8 text-right font-medium border-none focus-visible:ring-1 px-1"
                                                                        disabled={isFinalized}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="px-1 border-x">
                                                                    <Input
                                                                        type="number"
                                                                        value={item.gst_rate || taxRate}
                                                                        onChange={(e) => handleItemChange(originalIndex, 'gst_rate', e.target.value)}
                                                                        className="h-8 text-center border-none focus-visible:ring-1 px-1"
                                                                        disabled={isFinalized}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono text-xs text-muted-foreground whitespace-nowrap px-2 border-x">₹{item.cgst_amount?.toFixed(2)}</TableCell>
                                                                <TableCell className="text-right font-mono text-xs text-muted-foreground whitespace-nowrap px-2 border-x">₹{item.sgst_amount?.toFixed(2)}</TableCell>
                                                                <TableCell className="text-right font-bold text-primary pr-4 whitespace-nowrap border-x">₹{item.total.toFixed(2)}</TableCell>
                                                                <TableCell className="px-1 border-x text-center">
                                                                    {!isFinalized && (
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveItem(originalIndex)}>
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>

                                    {/* Inventory Bill Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <h3 className="text-lg font-bold text-primary">II. INVENTORY BILL</h3>
                                            {!isFinalized && (
                                                <Button size="sm" variant="outline" onClick={() => handleAddItem("part")}>
                                                    <Plus className="h-4 w-4 mr-2" /> Add Part
                                                </Button>
                                            )}
                                        </div>
                                        <div className="border rounded-xl shadow-sm bg-white overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-primary/5 hover:bg-primary/5 border-b-2 border-primary/20">
                                                        <TableHead className="w-[40px] font-bold text-primary py-4 px-2 text-center border-x">#</TableHead>
                                                        <TableHead className="font-bold text-primary px-3 border-x">Particulars</TableHead>
                                                        <TableHead className="w-[90px] font-bold text-primary px-2 border-x">HSN</TableHead>
                                                        <TableHead className="w-[100px] font-bold text-primary text-right px-2 border-x">Taxable</TableHead>
                                                        <TableHead className="w-[50px] font-bold text-primary text-center px-1 border-x">%</TableHead>
                                                        <TableHead className="w-[90px] font-bold text-primary text-right px-2 border-x">CGST</TableHead>
                                                        <TableHead className="w-[90px] font-bold text-primary text-right px-2 border-x">SGST</TableHead>
                                                        <TableHead className="w-[110px] text-right font-bold text-primary pr-4 border-x">Total</TableHead>
                                                        <TableHead className="w-[40px] border-x"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {items.filter(i => i.type === 'part').map((item, idx) => {
                                                        const originalIndex = items.findIndex(orig => orig.id === item.id);
                                                        return (
                                                            <TableRow key={item.id}>
                                                                <TableCell className="px-2 font-medium text-muted-foreground text-center border-x">{idx + 1}</TableCell>
                                                                <TableCell className="px-2 border-x">
                                                                    <Input
                                                                        value={item.description}
                                                                        onChange={(e) => handleItemChange(originalIndex, 'description', e.target.value)}
                                                                        className="h-8 border-transparent hover:border-slate-200 focus-visible:ring-1 px-1 text-slate-900 font-medium"
                                                                        disabled={isFinalized}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="px-1 border-x">
                                                                    <Input
                                                                        value={item.hsn_code || ''}
                                                                        onChange={(e) => handleItemChange(originalIndex, 'hsn_code', e.target.value)}
                                                                        className="h-8 border-none focus-visible:ring-1 px-1"
                                                                        disabled={isFinalized}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-right px-1 border-x">
                                                                    <Input
                                                                        type="number"
                                                                        value={item.unit_price}
                                                                        onChange={(e) => handleItemChange(originalIndex, 'unit_price', e.target.value)}
                                                                        className="h-8 text-right font-medium border-none focus-visible:ring-1 px-1"
                                                                        disabled={isFinalized}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="px-1 border-x">
                                                                    <Input
                                                                        type="number"
                                                                        value={item.gst_rate || taxRate}
                                                                        onChange={(e) => handleItemChange(originalIndex, 'gst_rate', e.target.value)}
                                                                        className="h-8 text-center border-none focus-visible:ring-1 px-1"
                                                                        disabled={isFinalized}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono text-xs text-muted-foreground whitespace-nowrap px-2 border-x">₹{item.cgst_amount?.toFixed(2)}</TableCell>
                                                                <TableCell className="text-right font-mono text-xs text-muted-foreground whitespace-nowrap px-2 border-x">₹{item.sgst_amount?.toFixed(2)}</TableCell>
                                                                <TableCell className="text-right font-bold text-primary pr-4 whitespace-nowrap border-x">₹{item.total.toFixed(2)}</TableCell>
                                                                <TableCell className="px-1 border-x text-center">
                                                                    {!isFinalized && (
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveItem(originalIndex)}>
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
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
                                    <CardTitle>Payment Summary</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Subtotal</span>
                                        <span>₹{subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Tax ({taxRate}%) {isQuotation && "(Estimate)"}</span>
                                        <span>₹{taxAmount.toFixed(2)}</span>
                                    </div>
                                    {/* Configurable Tax Rate */}
                                    {!isFinalized && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-xs text-muted-foreground">Rate:</span>
                                            <Input
                                                type="number"
                                                value={taxRate}
                                                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                                                className="h-6 w-16 text-xs"
                                            />
                                            <span className="text-xs text-muted-foreground">%</span>
                                        </div>
                                    )}
                                    {isQuotation && (
                                        <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                                            * Valid for 30 days. This is not a tax invoice.
                                        </div>
                                    )}
                                    <Separator className="my-2" />
                                    <div className="flex justify-between font-bold text-lg">
                                        <span>Total</span>
                                        <span>₹{grandTotal.toFixed(2)}</span>
                                    </div>
                                    <div className="mt-4 pt-4 border-t">
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Amount in Words:</p>
                                        <p className="text-xs font-semibold">{toWords.convert(grandTotal)}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            {!isQuotation && companyProfile && (
                                <Card>
                                    <CardHeader className="py-3">
                                        <CardTitle className="text-sm">Bank Account Details</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-xs space-y-1">
                                        <div className="flex justify-between"><span className="text-muted-foreground">Acc Name:</span> <span className="font-medium">{companyProfile.acc_name || companyProfile.company_name}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Acc No:</span> <span className="font-medium font-mono">{companyProfile.acc_number}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">IFSC:</span> <span className="font-medium font-mono">{companyProfile.ifsc}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Bank:</span> <span className="font-medium">{companyProfile.bank_name}</span></div>
                                        {companyProfile.upi_id && <div className="flex justify-between"><span className="text-muted-foreground">UPI ID:</span> <span className="font-medium">{companyProfile.upi_id}</span></div>}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
