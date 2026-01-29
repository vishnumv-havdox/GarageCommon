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

interface InvoiceItem {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
    type: string;
    category?: string;
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
    }, [id]);

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
        const sub = items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
        const tax = (sub * taxRate) / 100;
        const total = sub + tax;

        setSubtotal(sub);
        setTaxAmount(tax);
        setGrandTotal(total);
    };

    const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
        const newItems = [...items];
        const item = { ...newItems[index] };

        if (field === 'quantity' || field === 'unit_price') {
            const val = parseFloat(value) || 0;
            // @ts-ignore
            item[field] = val;
            item.total = item.quantity * item.unit_price;
        } else {
            // @ts-ignore
            item[field] = value;
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
                    total: item.quantity * item.unit_price,
                    type: item.type,
                    category: item.category
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

            const { error: headerError } = await supabase
                .from('invoices')
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
            await supabase.from('invoices').update({ type: 'invoice', status: 'Draft' } as any).eq('id', id);
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
                            <Button variant="outline" onClick={() => generateInvoicePDF(invoice.work_order_id)}>
                                <Download className="h-4 w-4 mr-2" /> PDF
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
                                        // Trigger sync (we need to call the sync logic here or in backend)
                                        // Since logic is in Invoices.tsx, let's duplicate strictly for this fix or call an RPC?
                                        // Easier: manually re-create items here from WO services.

                                        // Fetch services again
                                        const { data: services } = await supabase.from('work_order_services').select('*').eq('work_order_id', invoice.work_order_id);
                                        // Fetch tasks
                                        const { data: tasks } = await supabase.from('work_order_tasks').select('*').eq('work_order_id', invoice.work_order_id);

                                        if (services && services.length > 0) {
                                            const newItems: any[] = [];

                                            services.forEach(service => {
                                                const serviceTasks = tasks?.filter(t => t.service_id === service.id) || [];

                                                if (serviceTasks.length > 0) {
                                                    serviceTasks.forEach((task, idx) => {
                                                        newItems.push({
                                                            invoice_id: id,
                                                            work_order_service_id: service.id,
                                                            description: task.task_name,
                                                            quantity: 1,
                                                            unit_price: idx === 0 ? service.estimated_cost : 0,
                                                            total: idx === 0 ? service.estimated_cost : 0,
                                                            type: 'service',
                                                            category: service.service_type
                                                        });
                                                    });
                                                } else {
                                                    newItems.push({
                                                        invoice_id: id,
                                                        work_order_service_id: service.id,
                                                        description: "",
                                                        quantity: 1,
                                                        unit_price: service.estimated_cost,
                                                        total: service.estimated_cost,
                                                        type: 'service',
                                                        category: service.service_type
                                                    });
                                                }
                                            });

                                            await supabase.from('invoice_items').insert(newItems);
                                            toast({ title: "Reset Complete", description: "Items synced from Work Order (Tasks Included)." });
                                            fetchInvoiceData();
                                        }
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
                                <CardContent className="space-y-6 pt-0">
                                    {/* Helper to group items */}
                                    {(() => {
                                        // Get unique categories from items, plus any that might be manually added via a state if we wanted "empty" sections (skipped for now)
                                        // We'll iterate through existing item categories
                                        const categories = Array.from(new Set(items.map(i => i.category || 'General')));

                                        return categories.sort().map(category => {
                                            const categoryItems = items
                                                .map((item, originalIndex) => ({ ...item, originalIndex }))
                                                .filter(i => (i.category || 'General') === category);

                                            if (categoryItems.length === 0) return null;

                                            return (
                                                <div key={category} className="border rounded-lg overflow-hidden">
                                                    <div className="bg-muted px-4 py-2 font-semibold text-sm flex justify-between items-center">
                                                        <span>{category}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            Subtotal: ₹{categoryItems.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0).toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-[45%]">Description</TableHead>
                                                                <TableHead className="w-[15%]">Qty</TableHead>
                                                                <TableHead className="w-[20%]">Price</TableHead>
                                                                <TableHead className="w-[15%] text-right">Total</TableHead>
                                                                <TableHead className="w-[5%]"></TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {categoryItems.map((item, idx) => (
                                                                <TableRow key={item.id || `${category}-${idx}`}>
                                                                    <TableCell>
                                                                        {isFinalized ? (
                                                                            <span>{item.description}</span>
                                                                        ) : (
                                                                            <div className="relative flex gap-2">
                                                                                {/* Task Selector: Improved Visibility */}
                                                                                <DropdownMenu>
                                                                                    <DropdownMenuTrigger asChild>
                                                                                        <Button variant="ghost" className="h-8 w-[24px] px-0 justify-center border-dashed border-primary/50 hover:bg-primary/10 rounded-sm" title="Pick from Task List">
                                                                                            <Plus className="h-4 w-4 text-primary" />
                                                                                        </Button>
                                                                                    </DropdownMenuTrigger>
                                                                                    <DropdownMenuContent align="start" className="w-[200px]">
                                                                                        {getTasksForCategory(category).length > 0 ? (
                                                                                            getTasksForCategory(category).map(t => (
                                                                                                <DropdownMenuItem
                                                                                                    key={t.id}
                                                                                                    onClick={() => handleItemChange(item.originalIndex, "description", t.name)}
                                                                                                >
                                                                                                    {t.name}
                                                                                                </DropdownMenuItem>
                                                                                            ))
                                                                                        ) : (
                                                                                            <div className="p-2 text-xs text-muted-foreground text-center">No standard tasks found</div>
                                                                                        )}
                                                                                    </DropdownMenuContent>
                                                                                </DropdownMenu>

                                                                                {/* Input with Datalist for Autocomplete */}
                                                                                <Input
                                                                                    list={`tasks-${category.replace(/\s+/g, '-')}`}
                                                                                    value={item.description}
                                                                                    onChange={(e) => handleItemChange(item.originalIndex, "description", e.target.value)}
                                                                                    className="h-8 flex-1"
                                                                                    placeholder="Description (Type or Select)"
                                                                                />
                                                                                <datalist id={`tasks-${category.replace(/\s+/g, '-')}`}>
                                                                                    {getTasksForCategory(category).map(t => (
                                                                                        <option key={t.id} value={t.name} />
                                                                                    ))}
                                                                                </datalist>
                                                                            </div>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {isFinalized ? (
                                                                            <span>{item.quantity}</span>
                                                                        ) : (
                                                                            <Input
                                                                                type="number"
                                                                                value={item.quantity}
                                                                                onChange={(e) => handleItemChange(item.originalIndex, "quantity", e.target.value)}
                                                                                className="h-8"
                                                                                min="0"
                                                                                step="0.1"
                                                                            />
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {isFinalized ? (
                                                                            <span>{item.unit_price}</span>
                                                                        ) : (
                                                                            <Input
                                                                                type="number"
                                                                                value={item.unit_price}
                                                                                onChange={(e) => handleItemChange(item.originalIndex, "unit_price", e.target.value)}
                                                                                className="h-8"
                                                                                min="0"
                                                                            />
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-medium">
                                                                        ₹{(item.quantity * item.unit_price).toFixed(2)}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {!isFinalized && (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8 text-destructive"
                                                                                onClick={() => handleRemoveItem(item.originalIndex)}
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                            {!isFinalized && (
                                                                <TableRow>
                                                                    <TableCell colSpan={5}>
                                                                        <Button
                                                                            variant="ghost"
                                                                            className="w-full h-8 text-xs text-muted-foreground border-dashed border hover:text-primary"
                                                                            onClick={() => handleAddItem(category)}
                                                                        >
                                                                            <Plus className="h-3 w-3 mr-2" /> Add Item to {category}
                                                                        </Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                            )}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            );
                                        });
                                    })()}

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
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
