import React, { useState, useEffect, useMemo, useRef } from "react";
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
    Info,
    Receipt,
    Palette,
    RefreshCw,
    ChevronUp,
    ChevronDown
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

const InvoiceItemRow = ({
    item,
    index,
    onChange,
    onRemove,
    isReadOnly,
    serviceTypes,
    itemType = 'service',
    taxRate,
    templates = [],
    onRowComplete
}: {
    item: InvoiceItem;
    index: number;
    onChange: (index: number, field: keyof InvoiceItem | Partial<InvoiceItem>, value?: any) => void;
    onRemove: (index: number) => void;
    isReadOnly: boolean;
    serviceTypes?: ServiceType[];
    itemType?: 'service' | 'part';
    taxRate: number;
    templates?: any[];
    onRowComplete?: () => void;
}) => {
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const handleDescriptionChange = (val: string) => {
        onChange(index, 'description', val);
        if (!val.trim()) {
            setSuggestions([]);
            setShowDropdown(false);
            return;
        }
        const query = val.toLowerCase();
        const matches = templates.filter(t => {
            const name = t.name || t.item_name || "";
            const brand = t.brand_name || "";
            return name.toLowerCase().includes(query) || brand.toLowerCase().includes(query);
        });
        setSuggestions(matches.slice(0, 6));
        setActiveIndex(0);
        setShowDropdown(true);
    };

    const handleSelectSuggestion = (suggestion: any) => {
        const name = suggestion.name || suggestion.item_name;
        const displayName = suggestion.brand_name ? `[${suggestion.brand_name}] ${name}` : name;
        const price = suggestion.price || suggestion.unit_price || 0;
        const hsn = suggestion.hsn_code || suggestion.sac_code || "";
        
        const resolvedCategory = itemType === 'service' && serviceTypes 
            ? serviceTypes.find(st => st.id === suggestion.service_type_id)?.name 
            : undefined;

        const updateFields: Partial<InvoiceItem> = {
            description: displayName,
            unit_price: price,
            hsn_code: hsn
        };

        if (resolvedCategory) {
            updateFields.category = resolvedCategory;
        }

        onChange(index, updateFields);
        
        setSuggestions([]);
        setShowDropdown(false);
        
        // Focus the next input: Qty
        setTimeout(() => {
            const nextEl = document.getElementById(`${itemType}-qty-${index}`);
            if (nextEl) nextEl.focus();
        }, 50);
    };

    const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (showDropdown && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex(prev => (prev + 1) % suggestions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                handleSelectSuggestion(suggestions[activeIndex]);
            } else if (e.key === 'Escape') {
                setShowDropdown(false);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            // Don't move to the next column if empty!
            if (!item.description?.trim()) {
                return;
            }
            const nextEl = document.getElementById(`${itemType}-hsn-${index}`);
            if (nextEl) nextEl.focus();
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <TableRow className="hover:bg-muted/10 border-b border-slate-100">
            {/* Index */}
            <TableCell className="p-1 font-mono text-xs text-muted-foreground w-8 text-center align-middle">
                {index + 1}
            </TableCell>

            {/* Category (Services only) */}
            {itemType === 'service' && serviceTypes && (
                <TableCell className="p-1 w-[180px] align-middle">
                    <Select
                        value={item.category || ""}
                        onValueChange={(val) => {
                            onChange(index, 'category', val);
                        }}
                        disabled={isReadOnly}
                    >
                        <SelectTrigger className="h-8 border-none bg-transparent hover:bg-slate-100/50 focus:ring-0 shadow-none px-2 text-xs">
                            <SelectValue placeholder="Category..." />
                        </SelectTrigger>
                        <SelectContent>
                            {serviceTypes.map(st => (
                                <SelectItem key={st.id} value={st.name}>{st.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </TableCell>
            )}

            {/* Item Name / Description */}
            <TableCell className="p-1 min-w-[200px] align-middle relative">
                <Input
                    id={`${itemType}-desc-${index}`}
                    value={item.description || ''}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    onFocus={() => {
                        if (item.description) {
                            handleDescriptionChange(item.description);
                        }
                    }}
                    onKeyDown={handleNameKeyDown}
                    disabled={isReadOnly}
                    placeholder={itemType === 'service' ? "Service description..." : "Part name..."}
                    className="h-8 border-none bg-transparent hover:bg-slate-100/50 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none px-2 font-sans text-xs"
                    autoComplete="off"
                />

                {showDropdown && suggestions.length > 0 && (
                    <div 
                        ref={dropdownRef} 
                        className="absolute left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto"
                        style={{ top: '100%' }}
                    >
                        {suggestions.map((s, idx) => {
                            const name = s.name || s.item_name;
                            const brand = s.brand_name || "";
                            const price = s.price || s.unit_price || 0;
                            const category = serviceTypes?.find(st => st.id === s.service_type_id)?.name || "";
                            return (
                                <div
                                    key={s.id || idx}
                                    onClick={() => handleSelectSuggestion(s)}
                                    className={cn(
                                        "px-3 py-2 text-xs cursor-pointer flex justify-between items-center transition-colors rounded-sm",
                                        idx === activeIndex 
                                            ? "bg-primary/10 text-primary-foreground font-semibold" 
                                            : "hover:bg-slate-50 text-slate-700"
                                    )}
                                >
                                    <div className="flex flex-col min-w-0">
                                        <span className={cn(
                                            "truncate font-medium",
                                            idx === activeIndex ? "text-primary" : "text-slate-800"
                                        )}>
                                            {brand ? `[${brand}] ` : ''}{name}
                                        </span>
                                        {category && <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">{category}</span>}
                                    </div>
                                    {price > 0 && <span className="font-mono font-bold text-slate-600 shrink-0 ml-2">₹{price}</span>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </TableCell>

            {/* HSN Code */}
            <TableCell className="p-1 w-[100px] align-middle">
                <Input
                    id={`${itemType}-hsn-${index}`}
                    value={item.hsn_code || ''}
                    onChange={(e) => onChange(index, 'hsn_code', e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            document.getElementById(`${itemType}-qty-${index}`)?.focus();
                        }
                    }}
                    disabled={isReadOnly}
                    placeholder="HSN"
                    className="h-8 border-none bg-transparent hover:bg-slate-100/50 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none font-mono text-xs text-center px-1"
                />
            </TableCell>

            {/* Quantity */}
            <TableCell className="p-1 w-[80px] align-middle">
                <Input
                    id={`${itemType}-qty-${index}`}
                    type="number"
                    value={item.quantity || ''}
                    onChange={(e) => onChange(index, 'quantity', e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            document.getElementById(`${itemType}-price-${index}`)?.focus();
                        }
                    }}
                    disabled={isReadOnly}
                    min={1}
                    className="h-8 border-none bg-transparent hover:bg-slate-100/50 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none font-mono text-xs text-right px-2"
                />
            </TableCell>

            {/* Unit Price */}
            <TableCell className="p-1 w-[120px] align-middle">
                <div className="relative">
                    <span className="absolute left-1 top-2 text-muted-foreground text-xs">₹</span>
                    <Input
                        id={`${itemType}-price-${index}`}
                        type="number"
                        value={item.unit_price || ''}
                        onChange={(e) => onChange(index, 'unit_price', e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                document.getElementById(`${itemType}-gst-${index}`)?.focus();
                            }
                        }}
                        disabled={isReadOnly}
                        min={0}
                        className="h-8 pl-4 pr-2 border-none bg-transparent hover:bg-slate-100/50 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none font-mono text-xs text-right"
                    />
                </div>
            </TableCell>

            {/* GST Rate (Dropdown presets) */}
            <TableCell className="p-1 w-[140px] align-middle">
                <Select
                    value={String(item.gst_rate ?? taxRate)}
                    onValueChange={(val) => {
                        onChange(index, 'gst_rate', parseFloat(val));
                    }}
                    disabled={isReadOnly}
                >
                    <SelectTrigger 
                        id={`${itemType}-gst-${index}`}
                        className="h-8 border-none bg-transparent hover:bg-slate-100/50 focus:ring-0 shadow-none px-2 text-xs"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                onRowComplete?.();
                            }
                        }}
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="5">5%</SelectItem>
                        <SelectItem value="12">12%</SelectItem>
                        <SelectItem value="18">18%</SelectItem>
                        <SelectItem value="28">28%</SelectItem>
                    </SelectContent>
                </Select>
            </TableCell>

            {/* Line Total */}
            <TableCell className="p-1 w-[120px] text-right font-mono font-bold text-slate-800 pr-4 align-middle">
                ₹{(item.total || 0).toFixed(2)}
            </TableCell>

            {/* Remove Action */}
            {!isReadOnly && (
                <TableCell className="p-1 w-10 text-center align-middle">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 h-7 w-7 rounded"
                        onClick={() => onRemove(index)}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </TableCell>
            )}
        </TableRow>
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
    const [taxRate, setTaxRate] = useState(18); // Default 18% GST (should be configurable)

    // Work Order Intake / Sync Data
    const [woServices, setWoServices] = useState<any[]>([]);
    const [woTasks, setWoTasks] = useState<any[]>([]);
    const [woParts, setWoParts] = useState<any[]>([]);

    // Catalogs
    const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
    const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);

    // Derived Totals (Memoized for high performance and to prevent redundant renders)
    const { subtotal, taxAmount, grandTotal } = useMemo(() => {
        let sub = 0;
        let cgst_total = 0;
        let sgst_total = 0;

        items.forEach(item => {
            const taxable = (item.quantity || 0) * (item.unit_price || 0);
            const cgst_rate = item.cgst_rate ?? (taxRate / 2);
            const sgst_rate = item.sgst_rate ?? (taxRate / 2);

            const cgst = taxable * (cgst_rate / 100);
            const sgst = taxable * (sgst_rate / 100);

            sub += taxable;
            cgst_total += cgst;
            sgst_total += sgst;
        });

        return {
            subtotal: sub,
            taxAmount: cgst_total + sgst_total,
            grandTotal: sub + cgst_total + sgst_total
        };
    }, [items, taxRate]);
    const [companyProfile, setCompanyProfile] = useState<any>(null);
    const [invoiceSettings, setInvoiceSettings] = useState<any>(null);

    // Invoice Designer Settings States
    const [themeColor, setThemeColor] = useState<'slate' | 'blue' | 'emerald' | 'indigo' | 'rose'>(() => {
        return (localStorage.getItem('invoice_theme_color') as any) || 'slate';
    });
    const [showLogo, setShowLogo] = useState<boolean>(() => {
        const stored = localStorage.getItem('invoice_show_logo');
        return stored === null ? true : stored === 'true';
    });
    const [customTerms, setCustomTerms] = useState<string>(() => {
        return localStorage.getItem('invoice_custom_terms') || '';
    });
    const [customFooter, setCustomFooter] = useState<string>(() => {
        return localStorage.getItem('invoice_custom_footer') || '';
    });
    const [showDesignerPanel, setShowDesignerPanel] = useState<boolean>(false);
    const [showLivePreview, setShowLivePreview] = useState<boolean>(false);

    // Quick Add Search States
    const [serviceQuickAddOpen, setServiceQuickAddOpen] = useState(false);
    const [serviceSearch, setServiceSearch] = useState("");
    const [partQuickAddOpen, setPartQuickAddOpen] = useState(false);
    const [partSearch, setPartSearch] = useState("");

    const handleQuickAddService = (template: { name: string, category: string, price?: number, hsn_code?: string }) => {
        const price = template.price || 0;
        const newItem: InvoiceItem = {
            id: `temp-${Date.now()}-${Math.random()}`,
            description: template.name,
            quantity: 1,
            unit_price: price,
            total: 0,
            type: 'service',
            category: template.category,
            hsn_code: template.hsn_code || "",
            gst_rate: taxRate,
            cgst_rate: taxRate / 2,
            sgst_rate: taxRate / 2,
            cgst_amount: 0,
            sgst_amount: 0
        };

        const taxable = price;
        newItem.taxable_value = taxable;
        newItem.cgst_amount = taxable * (newItem.cgst_rate / 100);
        newItem.sgst_amount = taxable * (newItem.sgst_rate / 100);
        newItem.total = taxable + newItem.cgst_amount + newItem.sgst_amount;

        setItems(prev => [...prev, newItem]);
        toast({ title: "Service Added", description: `Added "${template.name}" to invoice.` });
    };

    const handleQuickAddPart = (part: { name: string, brand?: string, price?: number, hsn_code?: string }) => {
        const price = part.price || 0;
        const displayName = part.brand ? `[${part.brand}] ${part.name}` : part.name;
        const newItem: InvoiceItem = {
            id: `temp-${Date.now()}-${Math.random()}`,
            description: displayName,
            quantity: 1,
            unit_price: price,
            total: 0,
            type: 'part',
            category: 'Spare',
            hsn_code: part.hsn_code || "",
            gst_rate: taxRate,
            cgst_rate: taxRate / 2,
            sgst_rate: taxRate / 2,
            cgst_amount: 0,
            sgst_amount: 0
        };

        const taxable = price;
        newItem.taxable_value = taxable;
        newItem.cgst_amount = taxable * (newItem.cgst_rate / 100);
        newItem.sgst_amount = taxable * (newItem.sgst_rate / 100);
        newItem.total = taxable + newItem.cgst_amount + newItem.sgst_amount;

        setItems(prev => [...prev, newItem]);
        toast({ title: "Spare Added", description: `Added "${displayName}" to invoice.` });
    };

    const handleRowComplete = (type: 'service' | 'part') => {
        const emptyRow = items.find(i => i.type === type && !i.description.trim());
        if (emptyRow) {
            const idx = items.findIndex(i => i.id === emptyRow.id);
            setTimeout(() => {
                const el = document.getElementById(`${type}-desc-${idx}`);
                if (el) el.focus();
            }, 50);
            return;
        }

        const newId = `temp-${Date.now()}-${Math.random()}`;
        const newItem: InvoiceItem = {
            id: newId,
            description: "",
            quantity: 1,
            unit_price: 0,
            total: 0,
            type: type,
            category: type === 'service' ? "General" : "Spare",
            gst_rate: taxRate,
            cgst_rate: taxRate / 2,
            sgst_rate: taxRate / 2,
            cgst_amount: 0,
            sgst_amount: 0
        };

        setItems(prev => {
            const nextItems = [...prev, newItem];
            setTimeout(() => {
                const targetIdx = nextItems.findIndex(i => i.id === newId);
                if (targetIdx !== -1) {
                    const el = document.getElementById(`${type}-desc-${targetIdx}`);
                    if (el) el.focus();
                }
            }, 50);
            return nextItems;
        });
    };

    const [selectedSignatureUrl, setSelectedSignatureUrl] = useState<string>(() => {
        return localStorage.getItem('invoice_selected_signature_url') || '';
    });

    const handleThemeChange = (color: 'slate' | 'blue' | 'emerald' | 'indigo' | 'rose') => {
        setThemeColor(color);
        localStorage.setItem('invoice_theme_color', color);
    };

    const handleShowLogoChange = (val: boolean) => {
        setShowLogo(val);
        localStorage.setItem('invoice_show_logo', String(val));
    };

    const handleCustomTermsChange = (val: string) => {
        setCustomTerms(val);
        localStorage.setItem('invoice_custom_terms', val);
    };

    const handleCustomFooterChange = (val: string) => {
        setCustomFooter(val);
        localStorage.setItem('invoice_custom_footer', val);
    };

    const handleSignatureChange = (val: string) => {
        setSelectedSignatureUrl(val);
        localStorage.setItem('invoice_selected_signature_url', val);
    };


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
        const { data: profile } = await supabase.from('company_profiles').select('*').limit(1).maybeSingle();
        setCompanyProfile(profile);

        const { data: settings } = await supabase.from('document_settings').select('*').eq('doc_type', 'invoice').single();
        setInvoiceSettings(settings);
    };


    const fetchCatalogs = async () => {
        const { data: st, error: stError } = await supabase.from('service_types').select('*').order('name');
        if (stError) console.error("Error fetching service types:", stError);
        setServiceTypes(st || []);

        const { data: tt, error: ttError } = await supabase.from('task_templates').select('*').order('name');
        if (ttError) console.error("Error fetching task templates:", ttError);
        setTaskTemplates(tt || []);

        const { data: inv, error: invError } = await supabase.from('inventory').select('id, item_name, brand_name, unit_price, sku, hsn_code').gt('quantity', 0);
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

            // 3. Fetch associated Work Order details for non-destructive import panel
            if (inv.work_order_id) {
                const [servicesRes, tasksRes, partsRes] = await Promise.all([
                    supabase.from('work_order_services').select('*').eq('work_order_id', inv.work_order_id),
                    supabase.from('work_order_tasks').select('*').eq('work_order_id', inv.work_order_id),
                    supabase.from('work_order_parts').select('*').eq('work_order_id', inv.work_order_id)
                ]);
                setWoServices(servicesRes.data || []);
                setWoTasks(tasksRes.data || []);
                setWoParts(partsRes.data || []);
            }

        } catch (error: any) {
            console.error("Error fetching invoice:", error);
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setLoading(false);
        }
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
            id: `temp-${Date.now()}-${Math.random()}`, // Unique temp ID
            description: "",
            quantity: 1,
            unit_price: 0,
            total: 0,
            type: type,
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

            const { error: upsertError } = await supabase
                .from('invoice_items')
                .upsert(itemsToUpsert as any);

            if (upsertError) throw upsertError;

            // 2. Identify and Delete Removed Items
            const currentIds = items.filter(i => !i.id.startsWith('temp-')).map(i => i.id);
            if (currentIds.length > 0) {
                await supabase
                    .from('invoice_items')
                    .delete()
                    .eq('invoice_id', id)
                    .not('id', 'in', `(${currentIds.join(',')})`);
            } else if (items.length === 0) {
                await supabase.from('invoice_items').delete().eq('invoice_id', id);
            }

            // 3. Update Invoice Header
            const updatePayload: any = {
                subtotal,
                tax: taxAmount,
                total: grandTotal,
                notes: invoice.notes,
            };

            if (finalize) {
                updatePayload.status = 'Sent';
            }

            const { error: headerError } = await (supabase.from('invoices') as any)
                .update(updatePayload)
                .eq('id', id);

            if (headerError) throw headerError;

            toast({ title: "Saved", description: finalize ? "Invoice finalized!" : "Invoice updated successfully." });
            fetchInvoiceData();

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
            window.location.reload();
        } catch (e: any) {
            toast({ variant: "destructive", title: "Error", description: e.message });
        } finally {
            setSaving(false);
        }
    };

    // Helper functions for importing items from the Work Order
    const importService = (service: any, task: any, price: number) => {
        const cgst = price * ((taxRate / 2) / 100);
        const sgst = price * ((taxRate / 2) / 100);
        return {
            id: `temp-${Date.now()}-${Math.random()}`,
            description: task ? task.task_name : service.service_type,
            quantity: 1,
            unit_price: price,
            total: price + cgst + sgst,
            type: 'service',
            category: service.service_type,
            gst_rate: taxRate,
            cgst_rate: taxRate / 2,
            sgst_rate: taxRate / 2,
            cgst_amount: cgst,
            sgst_amount: sgst,
            taxable_value: price
        };
    };

    const importPart = (part: any) => {
        const qty = part.quantity || 1;
        const price = part.unit_price || 0;
        const taxable = qty * price;
        const cgst = taxable * ((taxRate / 2) / 100);
        const sgst = taxable * ((taxRate / 2) / 100);
        return {
            id: `temp-${Date.now()}-${Math.random()}`,
            description: part.part_name,
            quantity: qty,
            unit_price: price,
            total: taxable + cgst + sgst,
            type: 'part',
            category: 'Spare',
            gst_rate: taxRate,
            cgst_rate: taxRate / 2,
            sgst_rate: taxRate / 2,
            cgst_amount: cgst,
            sgst_amount: sgst,
            taxable_value: taxable
        };
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50/50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!invoice) return <div className="p-8 text-center text-red-500 font-bold">Invoice not found</div>;

    return (
        <div className="min-h-screen bg-slate-50/50">
            <div className="flex flex-col lg:flex-row">
                <AdminSidebar />
                <main className="flex-1 p-4 lg:p-8 space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" onClick={() => navigate('/admin/invoices')} className="h-9 w-9">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div>
                                <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                                    {isQuotation ? (invoice.quotation_number ? `Quotation #${invoice.quotation_number}` : (invoice.id ? `Draft Quotation` : 'New Quotation')) : (invoice.bill_number ? `Invoice #${invoice.bill_number}` : 'Draft Invoice')}
                                    <Badge variant={isFinalized ? "default" : "secondary"} className={`ml-2 ${isQuotation ? 'bg-orange-500 hover:bg-orange-600' : ''}`}>
                                        {invoice.status}
                                    </Badge>
                                    {isQuotation && <Badge variant="outline" className="ml-2 border-orange-500 text-orange-600">Estimate</Badge>}
                                </h1>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {invoice.customer?.name} • {invoice.work_order?.vehicle?.vehicle_number}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => generateInvoicePDF(invoice.work_order_id, 'save', themeColor)} title="Download PDF">
                                <Download className="h-4 w-4 mr-2" /> PDF
                            </Button>
                            {!isFinalized && (
                                <Button size="sm" onClick={() => handleSave(false)} disabled={saving} variant="outline">
                                    <Save className="h-4 w-4 mr-2" /> Save Draft
                                </Button>
                            )}
                            {!isFinalized && (
                                <Button size="sm" onClick={() => handleSave(true)} disabled={saving} className={isQuotation ? "bg-orange-600 hover:bg-orange-700 text-white" : ""}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    <Lock className="h-4 w-4 mr-2" /> {isQuotation ? 'Finalize Estimate' : 'Finalize Invoice'}
                                </Button>
                            )}
                            {!isFinalized && isQuotation && (
                                <Button size="sm" onClick={handleConvertToInvoice} disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">
                                    <RefreshCw className="h-4 w-4 mr-2" /> Convert to Invoice
                                </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => handlePrint()} className="bg-primary/5 hover:bg-primary/10 text-primary border-primary/20">
                                <Printer className="h-4 w-4 mr-2" /> Print
                            </Button>
                            <Button
                                variant="destructive"
                                size="icon"
                                className="h-8 w-8"
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
                        </div>
                    </div>

                    {/* Hidden Invoice for printing */}
                    <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '210mm', minHeight: '297mm' }}>
                        <div ref={printRef}>
                            <InvoiceTemplate invoice={invoice} items={items} companyProfile={companyProfile} settings={invoiceSettings} themeColor={themeColor} showLogo={showLogo} customTerms={customTerms} customFooter={customFooter} selectedSignatureUrl={selectedSignatureUrl} />
                        </div>
                    </div>

                    <div className="w-full space-y-6">
                        {/* Work Order Sync / Import panel */}
                        {!isFinalized && (woServices.length > 0 || woParts.length > 0) && (
                            <Card className="border border-orange-200/60 bg-orange-50/20 shadow-sm overflow-hidden">
                                <CardHeader className="pb-3 bg-orange-50/40 border-b border-orange-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-orange-800">
                                                <RefreshCw className="h-4 w-4 text-orange-600 animate-spin-slow" /> Work Order Import Center
                                            </CardTitle>
                                            <CardDescription className="text-xs text-orange-600/85 mt-1">
                                                Select services/parts from the Work Order to add to this invoice.
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 space-y-4">
                                    {/* Services */}
                                    {woServices.length > 0 && (
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold tracking-wider text-orange-800/80 uppercase">Available Services</Label>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {woServices.map(service => {
                                                    const tasksForService = woTasks.filter(t => t.service_id === service.id);
                                                    const finalPrice = service.billing_price || service.estimated_cost || 0;
                                                    
                                                    const isImported = items.some(item => 
                                                        item.type === 'service' && 
                                                        (item.category === service.service_type || tasksForService.some(t => t.task_name === item.description))
                                                    );

                                                    return (
                                                        <div 
                                                            key={service.id}
                                                            onClick={() => {
                                                                if (isImported) return;
                                                                if (tasksForService.length > 0) {
                                                                    const newItems = tasksForService.map((task, idx) => 
                                                                        importService(service, task, idx === 0 ? finalPrice : 0)
                                                                    );
                                                                    setItems(prev => [...prev, ...newItems]);
                                                                } else {
                                                                    const newItem = importService(service, null, finalPrice);
                                                                    setItems(prev => [...prev, newItem]);
                                                                }
                                                                toast({ title: "Imported Service", description: `Added "${service.service_type}" to invoice.` });
                                                            }}
                                                            className={cn(
                                                                "flex items-start gap-3 p-3 rounded-lg border text-xs bg-white transition-all",
                                                                isImported 
                                                                    ? "opacity-60 border-slate-200/85 bg-slate-50/50 cursor-not-allowed select-none" 
                                                                    : "border-orange-100 hover:border-orange-300 hover:shadow-sm cursor-pointer"
                                                            )}
                                                        >
                                                            <input 
                                                                type="checkbox" 
                                                                checked={isImported}
                                                                readOnly
                                                                className="mt-0.5 h-3.5 w-3.5 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-semibold text-slate-800 truncate">{service.service_type}</p>
                                                                {tasksForService.length > 0 && (
                                                                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                                                        {tasksForService.map(t => t.task_name).join(', ')}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="font-mono font-bold text-slate-700">
                                                                ₹{finalPrice}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Parts */}
                                    {woParts.length > 0 && (
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold tracking-wider text-orange-800/80 uppercase">Available Parts & Spares</Label>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {woParts.map(part => {
                                                    const isImported = items.some(item => 
                                                        item.type === 'part' && item.description === part.part_name
                                                    );

                                                    return (
                                                        <div 
                                                            key={part.id}
                                                            onClick={() => {
                                                                if (isImported) return;
                                                                const newItem = importPart(part);
                                                                setItems(prev => [...prev, newItem]);
                                                                toast({ title: "Imported Part", description: `Added "${part.part_name}" to invoice.` });
                                                            }}
                                                            className={cn(
                                                                "flex items-start gap-3 p-3 rounded-lg border text-xs bg-white transition-all",
                                                                isImported 
                                                                    ? "opacity-60 border-slate-200/85 bg-slate-50/50 cursor-not-allowed select-none" 
                                                                    : "border-orange-100 hover:border-orange-300 hover:shadow-sm cursor-pointer"
                                                            )}
                                                        >
                                                            <input 
                                                                type="checkbox" 
                                                                checked={isImported}
                                                                readOnly
                                                                className="mt-0.5 h-3.5 w-3.5 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-semibold text-slate-800 truncate">{part.part_name}</p>
                                                                <p className="text-[10px] text-slate-500 mt-0.5">
                                                                    Qty: {part.quantity} • Unit: ₹{part.unit_price}
                                                                </p>
                                                            </div>
                                                            <div className="font-mono font-bold text-slate-700">
                                                                ₹{part.quantity * part.unit_price}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Main Service and Spares billing layout */}
                        <Card className="border border-slate-200 shadow-sm w-full">
                            <CardHeader className="pb-3 border-b bg-slate-50/50">
                                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                                    <div>
                                        <CardTitle className="text-base font-bold text-slate-800">Invoice Creator</CardTitle>
                                        <CardDescription className="text-xs">Add, edit, or customize tasks and parts for billing</CardDescription>
                                    </div>
                                    {!isFinalized && (
                                        <div className="flex gap-2">
                                            <Select onValueChange={(val) => handleAddItem(val)}>
                                                <SelectTrigger className="w-[180px] h-9 text-xs bg-white">
                                                    <SelectValue placeholder="Add Service Section..." />
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
                            <CardContent className="space-y-8 p-6">
                                
                                {/* Customer & Vehicle Quick Details inside Line Items Card */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b pb-6 mb-6 bg-slate-50/30 p-4 rounded-lg">
                                    <div>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Client Details</h4>
                                        <div className="font-semibold text-slate-800 mt-1">{invoice.customer?.name}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{invoice.customer?.company_name || 'Individual Customer'}</div>
                                        {!isQuotation && invoice.customer?.gst_number && (
                                            <div className="text-[9px] mt-1 bg-slate-100 px-1.5 py-0.5 rounded w-max text-slate-700 font-mono font-medium">
                                                GSTIN: {invoice.customer.gst_number}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vehicle Details</h4>
                                        <div className="text-xs font-semibold text-slate-800 mt-1">{invoice.work_order?.vehicle?.model || 'N/A'}</div>
                                        <div className="text-xs font-mono text-slate-600 mt-0.5">{invoice.work_order?.vehicle?.vehicle_number || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Invoice Metadata</h4>
                                        <div className="text-xs text-slate-800 mt-1">
                                            Status: <Badge variant="outline" className="text-[10px] ml-1 bg-white">{invoice.status}</Badge>
                                        </div>
                                        <div className="text-[11px] text-muted-foreground mt-1">
                                            Date: {invoice.invoice_date ? format(new Date(invoice.invoice_date), "dd MMM yyyy") : 'N/A'}
                                        </div>
                                    </div>
                                </div>

                                {/* Service Bill Section */}
                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-2 gap-2">
                                        <h3 className="text-sm font-bold text-primary tracking-wide flex items-center gap-2">
                                            <Receipt className="h-4 w-4" /> I. SERVICE BILL
                                        </h3>
                                        {!isFinalized && (
                                            <div className="flex gap-2 items-center flex-wrap">
                                                {/* Quick Search Combobox */}
                                                <Popover open={serviceQuickAddOpen} onOpenChange={setServiceQuickAddOpen}>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className="w-[260px] justify-between h-8 text-xs bg-white border-slate-200"
                                                        >
                                                            <span className="flex items-center gap-1 text-slate-500 font-normal truncate">
                                                                <Plus className="h-3 w-3 text-primary mr-1" />
                                                                Quick Search & Add Service...
                                                            </span>
                                                            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[320px] p-0" align="end">
                                                        <Command>
                                                            <CommandInput 
                                                                placeholder="Search templates (e.g. Wash, Brake)..." 
                                                                value={serviceSearch} 
                                                                onValueChange={setServiceSearch} 
                                                            />
                                                            <CommandList>
                                                                <CommandEmpty className="p-3 text-xs text-muted-foreground flex flex-col gap-2 items-center">
                                                                    <span>No templates found.</span>
                                                                    {serviceSearch.trim().length > 0 && (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="text-[10px] h-7 px-2"
                                                                            onClick={() => {
                                                                                handleQuickAddService({
                                                                                    name: serviceSearch,
                                                                                    category: "General",
                                                                                    price: 0,
                                                                                    hsn_code: ""
                                                                                });
                                                                                setServiceQuickAddOpen(false);
                                                                                setServiceSearch("");
                                                                            }}
                                                                        >
                                                                            Add "{serviceSearch}" as custom service
                                                                        </Button>
                                                                    )}
                                                                </CommandEmpty>
                                                                <CommandGroup heading="Service templates">
                                                                    {taskTemplates.map((task) => {
                                                                        const catName = serviceTypes.find(st => st.id === task.service_type_id)?.name || "General";
                                                                        return (
                                                                            <CommandItem
                                                                                key={task.id}
                                                                                value={`${catName} ${task.name}`}
                                                                                onSelect={() => {
                                                                                    handleQuickAddService({
                                                                                        name: task.name,
                                                                                        category: catName,
                                                                                        price: (task as any).price,
                                                                                        hsn_code: (task as any).sac_code || (task as any).hsn_code
                                                                                    });
                                                                                    setServiceQuickAddOpen(false);
                                                                                    setServiceSearch("");
                                                                                }}
                                                                                className="flex justify-between items-center py-1.5"
                                                                            >
                                                                                <div className="flex flex-col min-w-0">
                                                                                    <span className="font-semibold text-slate-800 text-xs truncate">{task.name}</span>
                                                                                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">{catName}</span>
                                                                                </div>
                                                                                {(task as any).price && <span className="font-mono text-xs font-bold text-slate-700 ml-2 shrink-0">₹{(task as any).price}</span>}
                                                                            </CommandItem>
                                                                        );
                                                                    })}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>

                                                <Button size="sm" variant="outline" className="h-8 text-xs border-dashed" onClick={() => handleAddItem("General", "service")}>
                                                    <Plus className="h-3 w-3 mr-1" /> Add Empty Row
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="border rounded-lg overflow-visible bg-white shadow-sm font-sans">
                                        <Table wrapperClassName="overflow-visible">
                                            <TableHeader className="bg-slate-50/50 font-sans">
                                                <TableRow>
                                                    <TableHead className="w-8 text-center text-xs font-semibold">#</TableHead>
                                                    <TableHead className="w-[180px] text-xs font-semibold">Category</TableHead>
                                                    <TableHead className="min-w-[200px] text-xs font-semibold">Task Name</TableHead>
                                                    <TableHead className="w-[100px] text-xs font-semibold">HSN Code</TableHead>
                                                    <TableHead className="w-[80px] text-right text-xs font-semibold">Qty</TableHead>
                                                    <TableHead className="w-[120px] text-right text-xs font-semibold">Unit Price</TableHead>
                                                    <TableHead className="w-[140px] text-xs font-semibold">GST Rate</TableHead>
                                                    <TableHead className="w-[120px] text-right text-xs font-semibold">Total</TableHead>
                                                    {!isFinalized && <TableHead className="w-10 text-center"></TableHead>}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {items.filter(i => i.type === 'service').map((item, idx) => {
                                                    const originalIndex = items.findIndex(orig => orig.id === item.id);
                                                    return (
                                                        <InvoiceItemRow
                                                            key={item.id}
                                                            item={item}
                                                            index={originalIndex}
                                                            onChange={handleItemChange}
                                                            onRemove={handleRemoveItem}
                                                            isReadOnly={isFinalized}
                                                            serviceTypes={serviceTypes}
                                                            itemType="service"
                                                            taxRate={taxRate}
                                                            templates={taskTemplates}
                                                            onRowComplete={() => handleRowComplete('service')}
                                                        />
                                                    );
                                                })}
                                                {items.filter(i => i.type === 'service').length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={isFinalized ? 8 : 9} className="text-center py-6 text-xs text-muted-foreground bg-slate-50/10">
                                                            No service items added.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                                {/* Inventory Bill Section */}
                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-2 gap-2">
                                        <h3 className="text-sm font-bold text-primary tracking-wide flex items-center gap-2">
                                            <Receipt className="h-4 w-4" /> II. INVENTORY / SPARES BILL
                                        </h3>
                                        {!isFinalized && (
                                            <div className="flex gap-2 items-center flex-wrap">
                                                {/* Quick Search Spares Combobox */}
                                                <Popover open={partQuickAddOpen} onOpenChange={setPartQuickAddOpen}>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className="w-[260px] justify-between h-8 text-xs bg-white border-slate-200"
                                                        >
                                                            <span className="flex items-center gap-1 text-slate-500 font-normal truncate">
                                                                <Plus className="h-3 w-3 text-primary mr-1" />
                                                                Quick Search & Add Spare...
                                                            </span>
                                                            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[320px] p-0" align="end">
                                                        <Command>
                                                            <CommandInput 
                                                                placeholder="Search inventory (e.g. Filter, Plug)..." 
                                                                value={partSearch} 
                                                                onValueChange={setPartSearch} 
                                                            />
                                                            <CommandList>
                                                                <CommandEmpty className="p-3 text-xs text-muted-foreground flex flex-col gap-2 items-center">
                                                                    <span>No parts found.</span>
                                                                    {partSearch.trim().length > 0 && (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="text-[10px] h-7 px-2"
                                                                            onClick={() => {
                                                                                handleQuickAddPart({
                                                                                    name: partSearch,
                                                                                    brand: "",
                                                                                    price: 0,
                                                                                    hsn_code: ""
                                                                                });
                                                                                setPartQuickAddOpen(false);
                                                                                setPartSearch("");
                                                                            }}
                                                                        >
                                                                            Add "{partSearch}" as custom spare
                                                                        </Button>
                                                                    )}
                                                                </CommandEmpty>
                                                                <CommandGroup heading="Inventory parts">
                                                                    {inventoryItems.map((item) => (
                                                                        <CommandItem
                                                                            key={item.id}
                                                                            value={`${item.brand_name || ''} ${item.item_name}`}
                                                                            onSelect={() => {
                                                                                handleQuickAddPart({
                                                                                    name: item.item_name,
                                                                                    brand: item.brand_name || "",
                                                                                    price: item.unit_price,
                                                                                    hsn_code: item.hsn_code
                                                                                });
                                                                                setPartQuickAddOpen(false);
                                                                                setPartSearch("");
                                                                            }}
                                                                            className="flex justify-between items-center py-1.5"
                                                                        >
                                                                            <div className="flex flex-col min-w-0">
                                                                                <span className="font-semibold text-slate-800 text-xs truncate">{item.item_name}</span>
                                                                                {item.brand_name && <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">{item.brand_name}</span>}
                                                                            </div>
                                                                            <span className="font-mono text-xs font-bold text-slate-700 ml-2 shrink-0">₹{item.unit_price}</span>
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>

                                                <Button size="sm" variant="outline" className="h-8 text-xs border-dashed" onClick={() => handleAddItem("Spare", "part")}>
                                                    <Plus className="h-3 w-3 mr-1" /> Add Empty Row
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="border rounded-lg overflow-visible bg-white shadow-sm font-sans">
                                        <Table wrapperClassName="overflow-visible">
                                            <TableHeader className="bg-slate-50/50 font-sans">
                                                <TableRow>
                                                    <TableHead className="w-8 text-center text-xs font-semibold">#</TableHead>
                                                    <TableHead className="min-w-[200px] text-xs font-semibold">Part Name</TableHead>
                                                    <TableHead className="w-[100px] text-xs font-semibold">HSN Code</TableHead>
                                                    <TableHead className="w-[80px] text-right text-xs font-semibold">Qty</TableHead>
                                                    <TableHead className="w-[120px] text-right text-xs font-semibold">Unit Price</TableHead>
                                                    <TableHead className="w-[140px] text-xs font-semibold">GST Rate</TableHead>
                                                    <TableHead className="w-[120px] text-right text-xs font-semibold">Total</TableHead>
                                                    {!isFinalized && <TableHead className="w-10 text-center"></TableHead>}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {items.filter(i => i.type === 'part').map((item, idx) => {
                                                    const originalIndex = items.findIndex(orig => orig.id === item.id);
                                                    return (
                                                        <InvoiceItemRow
                                                            key={item.id}
                                                            item={item}
                                                            index={originalIndex}
                                                            onChange={handleItemChange}
                                                            onRemove={handleRemoveItem}
                                                            isReadOnly={isFinalized}
                                                            itemType="part"
                                                            taxRate={taxRate}
                                                            templates={inventoryItems}
                                                            onRowComplete={() => handleRowComplete('part')}
                                                        />
                                                    );
                                                })}
                                                {items.filter(i => i.type === 'part').length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={isFinalized ? 7 : 8} className="text-center py-6 text-xs text-muted-foreground bg-slate-50/10">
                                                            No spare parts added.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                                {/* Billing Summary, Remittance, Notes inside main Card */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-slate-100">
                                    {/* Left side: Notes & Bank Remittance */}
                                    <div className="space-y-4">
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-700 mb-2">Invoice Terms & Notes</h4>
                                            <Textarea
                                                value={invoice.notes || ''}
                                                onChange={(e) => setInvoice({ ...invoice, notes: e.target.value })}
                                                placeholder="Add payment guidelines, warranty specifications, or general notes..."
                                                disabled={isFinalized}
                                                className="min-h-[100px] text-xs bg-slate-50/30"
                                            />
                                        </div>
                                        
                                        <div className="border border-dashed rounded-lg p-3 bg-slate-50/50 text-[10px]">
                                            <p className="font-bold text-[9px] text-slate-400 uppercase tracking-wider mb-2">Remittance Instructions</p>
                                            {companyProfile?.bank_name ? (
                                                <div className="space-y-1 font-mono text-slate-600">
                                                    <div className="flex justify-between"><span>Bank:</span> <span className="font-semibold text-slate-700">{companyProfile.bank_name}</span></div>
                                                    <div className="flex justify-between"><span>Acct:</span> <span className="font-semibold text-slate-700">{companyProfile.acc_number}</span></div>
                                                    <div className="flex justify-between"><span>IFSC:</span> <span className="font-semibold text-slate-700">{companyProfile.ifsc}</span></div>
                                                </div>
                                            ) : (
                                                <p className="italic text-muted-foreground">No bank account details configured in Company Profile.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right side: Calculations */}
                                    <div className="bg-slate-50/40 border border-slate-100 rounded-lg p-5 space-y-4">
                                        <h4 className="text-xs font-bold text-slate-700 border-b pb-2">Billing Summary</h4>
                                        <div className="space-y-2 text-xs">
                                            <div className="flex justify-between text-muted-foreground">
                                                <span>Subtotal</span>
                                                <span className="font-mono">₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            
                                            <div className="flex justify-between items-center text-muted-foreground">
                                                <div className="flex items-center gap-1.5">
                                                    <span>Tax (GST)</span>
                                                    {!isFinalized && (
                                                        <div className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                                            <span className="text-[10px] text-slate-500">Global Rate:</span>
                                                            <Input
                                                                type="number"
                                                                className="w-10 h-5 text-[10px] p-0.5 text-center font-mono border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                value={taxRate}
                                                                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                                                            />
                                                            <span className="text-[10px] text-slate-500">%</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="font-mono">₹{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            
                                            <Separator className="my-2" />
                                            
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-bold text-slate-800">Grand Total</span>
                                                <span className="text-lg font-bold font-mono text-primary">
                                                    ₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>

                                            {/* Payments tracker */}
                                            {invoice?.status !== 'Draft' && (
                                                <>
                                                    <Separator className="my-2" />
                                                    <div className="space-y-1.5">
                                                        <div className="flex justify-between text-green-600 font-medium">
                                                            <span>Total Paid</span>
                                                            <span className="font-mono">₹{payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + (p.amount_applied || p.amount), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                        <div className="flex justify-between text-orange-600 font-medium">
                                                            <span>Deductions Applied</span>
                                                            <span className="font-mono">₹{(invoice?.total_deductions || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center pt-2 border-t font-bold text-sm text-slate-800">
                                                            <span>Balance Due</span>
                                                            <span className={cn(
                                                                "font-mono font-bold",
                                                                grandTotal - payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + (p.amount_applied || p.amount), 0) - (invoice?.total_deductions || 0) <= 0 
                                                                    ? "text-green-600" 
                                                                    : "text-destructive"
                                                            )}>
                                                                ₹{Math.max(0, grandTotal - payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + (p.amount_applied || p.amount), 0) - (invoice?.total_deductions || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Collapsible Invoice Designer Settings Panel */}
                        <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden w-full">
                            <CardHeader 
                                className="bg-gradient-to-r from-slate-50 to-slate-100/50 pb-3 border-b cursor-pointer hover:bg-slate-100/50 transition-colors select-none"
                                onClick={() => setShowDesignerPanel(!showDesignerPanel)}
                            >
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                        <Palette className="h-4 w-4 text-primary" /> Invoice Designer Settings
                                    </CardTitle>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[10px] bg-white border-slate-200">Style Engine</Badge>
                                        {showDesignerPanel ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                                    </div>
                                </div>
                                <CardDescription className="text-[11px] mt-0.5">Customize layout styles, colors, and terms</CardDescription>
                            </CardHeader>
                            {showDesignerPanel && (
                                <CardContent className="p-4 space-y-4 animate-in fade-in duration-200">
                                    {/* Accent Color Selection */}
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Accent Theme Color</Label>
                                        <div className="flex gap-3 pt-1">
                                            {[
                                                { name: 'slate', bg: 'bg-slate-900', ring: 'ring-slate-400' },
                                                { name: 'blue', bg: 'bg-blue-600', ring: 'ring-blue-400' },
                                                { name: 'emerald', bg: 'bg-emerald-600', ring: 'ring-emerald-400' },
                                                { name: 'indigo', bg: 'bg-indigo-600', ring: 'ring-indigo-400' },
                                                { name: 'rose', bg: 'bg-rose-600', ring: 'ring-rose-400' },
                                            ].map((color) => (
                                                <button
                                                    key={color.name}
                                                    type="button"
                                                    onClick={() => handleThemeChange(color.name as any)}
                                                    className={`h-7 w-7 rounded-full ${color.bg} transition-all duration-200 flex items-center justify-center hover:scale-110 shadow-sm ${
                                                        themeColor === color.name 
                                                        ? `ring-4 ${color.ring} ring-offset-2 scale-105` 
                                                        : 'opacity-70 hover:opacity-100'
                                                    }`}
                                                    title={`Select ${color.name} theme`}
                                                >
                                                    {themeColor === color.name && (
                                                        <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Toggle & Visibility */}
                                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Company Logo</Label>
                                            <span className="text-[10px] text-muted-foreground">Show logo at the top of document</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleShowLogoChange(!showLogo)}
                                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                showLogo ? 'bg-primary' : 'bg-slate-200'
                                            }`}
                                        >
                                            <span
                                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                    showLogo ? 'translate-x-4' : 'translate-x-0'
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    {/* Custom Document Overrides */}
                                    <div className="pt-3 border-t border-slate-100 space-y-3">
                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Custom Terms & Conditions</Label>
                                            <Textarea
                                                value={customTerms}
                                                onChange={(e) => handleCustomTermsChange(e.target.value)}
                                                placeholder="Override default terms and conditions..."
                                                className="text-xs min-h-[70px] bg-slate-50/50 focus:bg-white transition-colors"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Custom Footer Note</Label>
                                            <Input
                                                value={customFooter}
                                                onChange={(e) => handleCustomFooterChange(e.target.value)}
                                                placeholder="Override default footer note..."
                                                className="text-xs bg-slate-50/50 focus:bg-white transition-colors"
                                            />
                                        </div>
                                        <div className="space-y-1 pt-1">
                                            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Authorized Signatory</Label>
                                            <Select
                                                value={selectedSignatureUrl || "default"}
                                                onValueChange={(val) => handleSignatureChange(val === "default" ? "" : val)}
                                            >
                                                <SelectTrigger className="w-full h-8 text-xs bg-slate-50/50 focus:bg-white transition-colors">
                                                    <SelectValue placeholder="System Default" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="default">System Default</SelectItem>
                                                    {(companyProfile?.bank_details?.signatures || []).map((sig: any) => (
                                                        <SelectItem key={sig.id} value={sig.signature_url}>
                                                            {sig.username} ({sig.role}) {sig.is_default ? "(Default)" : ""}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </CardContent>
                            )}
                        </Card>

                        {/* Collapsible Live Interactive Invoice Preview Panel */}
                        <Card className="border border-slate-200 shadow-sm overflow-hidden bg-slate-50 w-full">
                            <CardHeader 
                                className="bg-white border-b py-3 px-4 flex flex-row items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors select-none"
                                onClick={() => setShowLivePreview(!showLivePreview)}
                            >
                                <div>
                                    <CardTitle className="text-xs font-bold flex items-center gap-1.5 text-slate-800">
                                        <Eye className="h-3.5 w-3.5 text-primary" /> Live Document Preview
                                    </CardTitle>
                                    <CardDescription className="text-[10px]">Real-time visual display of printing layout</CardDescription>
                                </div>
                                {showLivePreview ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                            </CardHeader>
                            {showLivePreview && (
                                <CardContent className="p-4 max-h-[70vh] overflow-y-auto bg-slate-100 animate-in fade-in duration-200">
                                    <div className="bg-white rounded-lg shadow border border-slate-200 p-6 min-h-[500px] text-xs">
                                        <InvoiceTemplate 
                                            invoice={invoice} 
                                            items={items} 
                                            companyProfile={companyProfile} 
                                            settings={invoiceSettings} 
                                            themeColor={themeColor}
                                            showLogo={showLogo}
                                            customTerms={customTerms}
                                            customFooter={customFooter}
                                            selectedSignatureUrl={selectedSignatureUrl}
                                        />
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                        
                        {/* Payment History Log */}
                        {payments.length > 0 && (
                            <Card className="border border-slate-200 shadow-sm">
                                <CardHeader className="py-4">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <Receipt className="h-4 w-4 text-primary" /> Payment History Log
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 pt-0 text-xs">
                                    {payments.map((p) => (
                                        <div key={p.id} className="p-3 border rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                            <div className="flex justify-between items-start mb-1">
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-bold text-slate-800">₹{(p.amount_applied || p.amount).toLocaleString()}</span>
                                                        <Badge variant={p.status === 'approved' ? 'default' : p.status === 'pending' ? 'outline' : 'destructive'} className="text-[9px] px-1 py-0 h-4">
                                                            {p.status}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                                        {format(new Date(p.created_at), "MMM d, yyyy")} via {p.payment_method}
                                                    </p>
                                                </div>
                                                {p.proof_url && (
                                                    <a href={p.proof_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline flex items-center">
                                                        <Download className="h-3 w-3 mr-0.5" /> Proof
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                    </div>\n                </main>
            </div>
        </div>
    );
}

