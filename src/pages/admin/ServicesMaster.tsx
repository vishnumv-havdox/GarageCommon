import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";
import {
    Plus,
    Search,
    Wrench,
    Edit,
    Trash2,
    ListTodo,
    IndianRupee,
    Clock,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    RefreshCw,
    MoreVertical,
    Filter,
    History,
    ShieldCheck,
    ChevronRight,
    ChevronDown,
    Loader2
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { SearchInput } from "@/components/shared/SearchInput";
import { format } from "date-fns";

import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

interface PricingRule {
    id?: string;
    service_type_id?: string;
    task_template_id?: string; // New field
    vehicle_category_id?: string;
    vehicle_type_id?: string;
    customer_id?: string;
    modifier_type: 'fixed' | 'percentage' | 'override';
    modifier_value: number;
    name: string;
    is_active: boolean;
}

interface VehicleCategory {
    id: string;
    name: string;
}

interface TaskTemplate {
    id: string;
    service_type_id: string;
    name: string;
    price: number;
    is_active: boolean;
}

interface ServiceType {
    id: string;
    name: string;
    category: string;
    description: string;
    base_price: number;
    estimated_duration: string;
    tax_applicable: boolean;
    is_active: boolean;
    required_fields: string[];
    inventory_categories: string[];
    updated_at: string;
    task_templates?: TaskTemplate[];
    pricing_rules?: PricingRule[];
}

// Helper for highlighting text
const HighlightText = ({ text, highlight }: { text: string, highlight: string }) => {
    if (!highlight.trim()) return <>{text}</>;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
        <span>
            {parts.map((part, i) =>
                part.toLowerCase() === highlight.toLowerCase() ?
                    <mark key={i} className="bg-yellow-200 rounded-sm px-0.5 text-black font-semibold">{part}</mark> :
                    part
            )}
        </span>
    );
};

export default function ServicesMaster() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [services, setServices] = useState<ServiceType[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [previewCategory, setPreviewCategory] = useState<string>("base"); // Price Simulator Context

    // Dialog states
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [currentService, setCurrentService] = useState<ServiceType | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form states
    const [formData, setFormData] = useState<Partial<ServiceType>>({
        name: "",
        category: "General",
        description: "",
        base_price: 0,
        estimated_duration: "",
        tax_applicable: true,
        is_active: true,
        required_fields: [],
        inventory_categories: []
    });

    // Task Template management in Dialog
    const [newTasks, setNewTasks] = useState<{ name: string, price: number }[]>([]);
    const [newTaskInput, setNewTaskInput] = useState("");
    const [newTaskPrice, setNewTaskPrice] = useState<number>(0);
    const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null); // Track which rule is being edited

    // Expanded Rows State (Multiple expansion support)
    const [expandedServiceIds, setExpandedServiceIds] = useState<Set<string>>(new Set());

    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editingTaskName, setEditingTaskName] = useState("");
    const [editingTaskPrice, setEditingTaskPrice] = useState<number>(0);


    // Pricing Rules State
    const [vehicleCategories, setVehicleCategories] = useState<VehicleCategory[]>([]);
    const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
    const [newRule, setNewRule] = useState<Partial<PricingRule>>({
        modifier_type: 'fixed',
        modifier_value: 0,
        name: '',
        vehicle_category_id: '',
        task_template_id: '' // New state init
    });

    const categories = ["Mechanical", "Bodywork", "Electrical", "General", "Inspection", "Custom"];

    const fetchServices = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('service_types')
                .select(`
          *,
          task_templates(*),
          pricing_rules(*)
        `)
                .order('name');

            if (error) throw error;
            const updatedServices = data || [];
            setServices(updatedServices);

            // If we are currently editing a service, refresh its data too
            if (currentService) {
                const refreshed = updatedServices.find(s => s.id === currentService.id);
                if (refreshed) {
                    setCurrentService(refreshed);
                }
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        const { data } = await supabase.from('vehicle_categories').select('*').order('name');
        if (data) setVehicleCategories(data);
    };

    const filteredServices = useMemo(() => {
        return services.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.task_templates?.some(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesCategory = categoryFilter === "all" || s.category === categoryFilter;
            const matchesStatus = statusFilter === "all" ||
                (statusFilter === "active" ? s.is_active : !s.is_active);
            return matchesSearch && matchesCategory && matchesStatus;
        });
    }, [services, searchTerm, categoryFilter, statusFilter]);

    // Auto-expand logic when searching
    useEffect(() => {
        if (!searchTerm) {
            setExpandedServiceIds(new Set());
            return;
        }

        const idsToExpand = new Set<string>();
        services.forEach(s => {
            // Expand if any task matches the search term
            if (s.task_templates?.some(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()))) {
                idsToExpand.add(s.id);
            }
        });

        if (idsToExpand.size > 0) {
            setExpandedServiceIds(idsToExpand);
        }
    }, [searchTerm, services]);

    const toggleExpansion = (id: string) => {
        const newSet = new Set(expandedServiceIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpandedServiceIds(newSet);
    };

    const suggestions = useMemo(() => {
        return Array.from(new Set(services.map(s => s.name)));
    }, [services]);

    // Helper: Calculate single task price for a specific category
    const calculateTaskPrice = (task: any, rules: any[], categoryId: string) => {
        if (categoryId === "base") return task.price || 0;

        let price = task.price || 0;

        // Find specific rule for this task & category
        const rule = rules?.find(r =>
            r.is_active !== false &&
            r.task_template_id === task.id &&
            r.vehicle_category_id === categoryId
        );

        if (rule) {
            if (rule.modifier_type === 'fixed') price += rule.modifier_value;
            else if (rule.modifier_type === 'percentage') price += (price * (rule.modifier_value / 100));
            else if (rule.modifier_type === 'override') price = rule.modifier_value;
        }

        return price;
    };

    // Price Engine Simulator (simplified)
    const calculateEffectivePrice = (service: ServiceType, categoryId: string, overrideRules?: any[]) => {
        const rules = overrideRules || service.pricing_rules || [];

        if (categoryId === "base") {
            // Just sum of tasks
            return service.task_templates?.reduce((sum, t) => sum + (t.price || 0), 0) || 0;
        }

        let basePrice = 0;
        const tasks = service.task_templates || [];

        // 1. Calculate weighted task prices
        tasks.forEach(task => {
            let taskPrice = task.price || 0;
            // Find specific rule for this task & category
            const rule = rules.find((r: any) =>
                r.is_active !== false &&
                r.task_template_id === task.id &&
                (r.vehicle_category_id === categoryId)
            );

            if (rule) {
                if (rule.modifier_type === 'fixed') taskPrice += rule.modifier_value;
                else if (rule.modifier_type === 'percentage') taskPrice += (taskPrice * (rule.modifier_value / 100));
                else if (rule.modifier_type === 'override') taskPrice = rule.modifier_value;
            }
            basePrice += taskPrice;
        });

        // 2. Apply Service-Level Rules
        const serviceRule = rules.find((r: any) =>
            (r.is_active !== false) && !r.task_template_id && r.vehicle_category_id === categoryId
        );

        if (serviceRule) {
            if (serviceRule.modifier_type === 'fixed') basePrice += serviceRule.modifier_value;
            else if (serviceRule.modifier_type === 'percentage') basePrice += (basePrice * (serviceRule.modifier_value / 100));
            else if (serviceRule.modifier_type === 'override') basePrice = serviceRule.modifier_value;
        }

        return basePrice;
    };

    const handleOpenDialog = (service: ServiceType | null = null) => {
        if (service) {
            setCurrentService(service);
            setFormData({
                name: service.name,
                category: service.category,
                description: service.description,
                base_price: service.base_price,
                estimated_duration: service.estimated_duration,
                tax_applicable: service.tax_applicable,
                is_active: service.is_active,
                required_fields: service.required_fields,
                inventory_categories: service.inventory_categories
            });
            setPricingRules(service.pricing_rules || []);
            // Pre-populate tasks from service.task_templates if needed
            // Actually tasks might be better managed in a separate section or within this dialog
        } else {
            setCurrentService(null);
            setFormData({
                name: "",
                category: "General",
                description: "",
                base_price: 0,
                estimated_duration: "",
                tax_applicable: true,
                is_active: true,
                required_fields: [],
                inventory_categories: []
            });
            setPricingRules([]);
        }
        setNewTasks([]);
        setIsDialogOpen(true);
    };

    // Auto-calculate base price from tasks
    useEffect(() => {
        const existingTasksTotal = currentService?.task_templates?.reduce((sum, t) => sum + (t.price || 0), 0) || 0;
        const newTasksTotal = newTasks.reduce((sum, t) => sum + (t.price || 0), 0);
        const total = existingTasksTotal + newTasksTotal;

        if (formData.base_price !== total) {
            setFormData(prev => ({ ...prev, base_price: total }));
        }
    }, [currentService?.task_templates, newTasks]);

    const handleSaveService = async () => {
        if (!formData.name) {
            toast({ variant: "destructive", title: "Required", description: "Service name is required" });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                ...formData,
                last_updated_by: user?.id,
                updated_at: new Date().toISOString()
            };

            let serviceId = currentService?.id;

            if (currentService) {
                const { error } = await supabase
                    .from('service_types')
                    .update(payload)
                    .eq('id', currentService.id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('service_types')
                    .insert(payload)
                    .select()
                    .single();
                if (error) throw error;
                serviceId = data.id;
            }

            // Handle new tasks addition if any
            if (serviceId && newTasks.length > 0) {
                const taskPayload = newTasks.map(t => ({
                    service_type_id: serviceId,
                    name: t.name,
                    price: t.price,
                    is_active: true,
                    last_updated_by: user?.id
                }));
                const { error: taskError } = await supabase
                    .from('task_templates')
                    .insert(taskPayload);
                if (taskError) throw taskError;
            }

            // Handle Pricing Rules (Full Sync)
            if (serviceId) {
                // 1. Delete all existing rules
                const { error: delError } = await supabase
                    .from('pricing_rules')
                    .delete()
                    .eq('service_type_id', serviceId);

                if (delError) throw delError;

                // 2. Insert current rules
                if (pricingRules.length > 0) {
                    const rulesPayload = pricingRules.map(r => ({
                        service_type_id: serviceId,
                        vehicle_category_id: r.vehicle_category_id || null,
                        vehicle_type_id: r.vehicle_type_id || null,
                        customer_id: r.customer_id || null,
                        task_template_id: r.task_template_id || null, // Include in payload
                        modifier_type: r.modifier_type,
                        modifier_value: r.modifier_value,
                        name: r.name,
                        is_active: r.is_active !== false,
                        priority: r.task_template_id ? 10 : 5 // Priority Boost for Task Rules
                    }));
                    const { error: rulesError } = await supabase.from('pricing_rules').insert(rulesPayload);
                    if (rulesError) throw rulesError;
                }
            }

            toast({ title: "Success", description: "Service configuration saved" });
            setIsDialogOpen(false);
            fetchServices();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteService = async () => {
        if (!currentService) return;

        setIsSubmitting(true);
        try {
            // Check if service is used in work_order_services
            const { count, error: checkError } = await supabase
                .from('work_order_services')
                .select('*', { count: 'exact', head: true })
                .eq('service_type', currentService.name);

            if (checkError) throw checkError;

            if (count && count > 0) {
                // Soft delete instead
                const { error } = await supabase
                    .from('service_types')
                    .update({ is_active: false, last_updated_by: user?.id })
                    .eq('id', currentService.id);
                if (error) throw error;
                toast({ title: "Service Deactivated", description: "Service is used in existing work orders, so it was deactivated instead of deleted." });
            } else {
                const { error } = await supabase
                    .from('service_types')
                    .delete()
                    .eq('id', currentService.id);
                if (error) throw error;
                toast({ title: "Service Deleted", description: "Service has been removed successfully" });
            }

            setIsDeleteDialogOpen(false);
            fetchServices();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const addTask = () => {
        if (newTaskInput.trim()) {
            setNewTasks([...newTasks, { name: newTaskInput.trim(), price: newTaskPrice }]);
            setNewTaskInput("");
            setNewTaskPrice(0);
        }
    };

    const removeNewTask = (index: number) => {
        setNewTasks(newTasks.filter((_, i) => i !== index));
    };

    const handleAddRule = () => {
        if (!newRule.name || !newRule.modifier_value || !newRule.vehicle_category_id) {
            toast({ variant: "destructive", title: "Missing Fields", description: "Please fill all rule fields." });
            return;
        }

        setPricingRules([...pricingRules, {
            ...newRule,
            is_active: true,
            modifier_type: newRule.modifier_type as any,
            modifier_value: Number(newRule.modifier_value)
        } as PricingRule]);

        setNewRule({
            modifier_type: 'fixed',
            modifier_value: 0,
            name: '',
            vehicle_category_id: '',
            task_template_id: ''
        });
    };

    const handleRemoveRule = (index: number) => {
        setPricingRules(pricingRules.filter((_, i) => i !== index));
    };

    const updateTaskDetails = async (taskId: string, newName: string, newPrice: number) => {
        try {
            // Find the service that owns this task
            const service = services.find(s => s.task_templates?.some(t => t.id === taskId));
            if (!service) return;

            // Calculate new total base price
            const updatedTasks = service.task_templates?.map(t =>
                t.id === taskId ? { ...t, name: newName, price: newPrice } : t
            ) || [];
            const newTotal = updatedTasks.reduce((sum, t) => sum + (t.price || 0), 0);

            // 1. Update task template details
            const { error: tError } = await supabase
                .from('task_templates')
                .update({ name: newName, price: newPrice, last_updated_by: user?.id } as any)
                .eq('id', taskId);

            if (tError) throw tError;

            // 2. Update service base price
            const { error: sError } = await supabase
                .from('service_types')
                .update({ base_price: newTotal, last_updated_by: user?.id } as any)
                .eq('id', service.id);

            if (sError) throw sError;

            toast({ title: "Success", description: "Task details updated" });
            setEditingTaskId(null); // Exit edit mode
            fetchServices();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    const updateExistingTaskPrice = async (taskId: string, newPrice: number) => {
        try {
            // Find the service that owns this task to calculate new total
            const service = services.find(s => s.task_templates?.some(t => t.id === taskId));
            if (!service) return;

            // Calculate new total base price
            const updatedTasks = service.task_templates?.map(t =>
                t.id === taskId ? { ...t, price: newPrice } : t
            ) || [];
            const newTotal = updatedTasks.reduce((sum, t) => sum + (t.price || 0), 0);

            // 1. Update task template price
            const { error: tError } = await supabase
                .from('task_templates')
                .update({ price: newPrice, last_updated_by: user?.id } as any)
                .eq('id', taskId);

            if (tError) throw tError;

            // 2. Update service base price immediately
            const { error: sError } = await supabase
                .from('service_types')
                .update({ base_price: newTotal, last_updated_by: user?.id } as any)
                .eq('id', service.id);

            if (sError) throw sError;

            toast({ title: "Success", description: "Price synced to master" });
            fetchServices(); // Refresh to update total in list
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        try {
            const { error } = await supabase
                .from('task_templates')
                .delete()
                .eq('id', taskId);

            if (error) throw error;

            toast({ title: "Success", description: "Task deleted successfully" });
            fetchServices(); // Refresh to update list
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    return (
        <div className="flex min-h-screen bg-background">
            <AdminSidebar />
            <main className="flex-1 p-8">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Services Master</h1>
                        <p className="text-muted-foreground">Manage service types, pricing, and tasks centrally</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={() => fetchServices()} disabled={loading} title="Refresh Services">
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button onClick={() => handleOpenDialog()}>
                            <Plus className="h-4 w-4 mr-2" /> Add New Service
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                        <div className="md:col-span-1">
                            <SearchInput
                                placeholder="Search services..."
                                value={searchTerm}
                                onChange={setSearchTerm}
                                suggestions={suggestions}
                            />
                        </div>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Price Simulator */}
                    <div className="w-full md:w-auto bg-blue-50 p-2 rounded border border-blue-100 flex flex-col gap-1">
                        <Label className="text-[10px] uppercase text-blue-600 font-bold">Preview Prices For</Label>
                        <Select value={previewCategory} onValueChange={setPreviewCategory}>
                            <SelectTrigger className="w-full md:w-[200px] h-8 bg-white">
                                <SelectValue placeholder="Vehicle Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="base">⭐ Base Price (Generic)</SelectItem>
                                {vehicleCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Services Table */}
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[200px]">Service Name</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>
                                        <div className="flex flex-col">
                                            <span>Price</span>
                                            <span className="text-[10px] font-normal text-muted-foreground">
                                                {previewCategory === 'base' ? '(Base)' : `(${vehicleCategories.find(c => c.id === previewCategory)?.name})`}
                                            </span>
                                        </div>
                                    </TableHead>
                                    <TableHead>Duration</TableHead>
                                    <TableHead>Tasks</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8">
                                            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredServices.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            No services found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredServices.map((service) => (
                                        <React.Fragment key={service.id}>
                                            <TableRow
                                                className={`cursor-pointer hover:bg-muted/50 ${expandedServiceIds.has(service.id) ? 'bg-muted/50 border-b-0' : ''}`}
                                                onClick={() => toggleExpansion(service.id)}
                                            >
                                                <TableCell className="font-medium">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            {expandedServiceIds.has(service.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                            <span>{service.name}</span>
                                                        </div>
                                                        <span className="text-xs text-muted-foreground line-clamp-1 ml-6">{service.description}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{service.category}</Badge>
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    <div className="flex flex-col">
                                                        <span className={previewCategory !== 'base' ? "text-blue-700 font-bold" : ""}>
                                                            ₹{calculateEffectivePrice(service, previewCategory).toLocaleString()}
                                                        </span>
                                                        {previewCategory === 'base' ? (
                                                            <span className="text-[10px] text-muted-foreground font-normal">Task Sum</span>
                                                        ) : (
                                                            <span className="text-[10px] text-blue-600 font-normal">Effective Cost</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1 text-sm">
                                                        <Clock className="h-3 w-3 text-muted-foreground" />
                                                        {service.estimated_duration || "N/A"}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">{service.task_templates?.length || 0} tasks</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={service.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                                                        {service.is_active ? "Active" : "Inactive"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(service)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => { setCurrentService(service); setIsDeleteDialogOpen(true); }}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                            {expandedServiceIds.has(service.id) && (
                                                <TableRow className="bg-muted/30 hover:bg-muted/30 border-t-0">
                                                    <TableCell colSpan={7} className="p-0">
                                                        <div className="p-4 pl-10 grid gap-2">
                                                            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                                                                Task Breakdown ({previewCategory === 'base' ? 'Base Prices' : vehicleCategories.find(c => c.id === previewCategory)?.name || 'Preview'})
                                                            </p>
                                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                                {(service.task_templates || []).length > 0 ? (
                                                                    service.task_templates?.map(task => {
                                                                        const taskPrice = calculateTaskPrice(task, service.pricing_rules || [], previewCategory);
                                                                        const isOverridden = taskPrice !== task.price;
                                                                        return (
                                                                            <div key={task.id} className="flex justify-between items-center bg-background border rounded px-3 py-2 text-sm shadow-sm">
                                                                                {editingTaskId === task.id ? (
                                                                                    <div className="flex items-center gap-2 flex-1 mr-2 bg-white p-1 rounded border border-blue-200">
                                                                                        <Input
                                                                                            value={editingTaskName}
                                                                                            onChange={(e) => setEditingTaskName(e.target.value)}
                                                                                            className="h-8 text-sm flex-1 min-w-[120px]"
                                                                                            autoFocus
                                                                                            placeholder="Task Name"
                                                                                        />
                                                                                        <div className="relative w-24">
                                                                                            <span className="absolute left-2 top-2 text-xs text-muted-foreground">₹</span>
                                                                                            <Input
                                                                                                type="number"
                                                                                                value={editingTaskPrice}
                                                                                                onChange={(e) => setEditingTaskPrice(parseFloat(e.target.value) || 0)}
                                                                                                className="h-8 text-sm pl-5"
                                                                                            />
                                                                                        </div>
                                                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-50" onClick={() => updateTaskDetails(task.id, editingTaskName, editingTaskPrice)}>
                                                                                            <CheckCircle2 className="h-5 w-5" />
                                                                                        </Button>
                                                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => setEditingTaskId(null)}>
                                                                                            <XCircle className="h-5 w-5" />
                                                                                        </Button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex items-center gap-2 group/task flex-1">
                                                                                        <span className="text-muted-foreground">
                                                                                            <HighlightText text={task.name} highlight={searchTerm} />
                                                                                        </span>
                                                                                        <Button
                                                                                            size="icon"
                                                                                            variant="ghost"
                                                                                            className="h-6 w-6 opacity-0 group-hover/task:opacity-100 transition-opacity"
                                                                                            onClick={() => { setEditingTaskId(task.id); setEditingTaskName(task.name); setEditingTaskPrice(task.price || 0); }}
                                                                                        >
                                                                                            <Edit className="h-3 w-3 text-muted-foreground" />
                                                                                        </Button>
                                                                                    </div>
                                                                                )}
                                                                                <div className="flex items-center gap-2">
                                                                                    {isOverridden && previewCategory !== 'base' && (
                                                                                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded">Rule</span>
                                                                                    )}
                                                                                    <span className={`font-medium ${isOverridden ? 'text-blue-700' : ''}`}>₹{taskPrice}</span>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })
                                                                ) : (
                                                                    <p className="text-sm text-muted-foreground italic col-span-2">No tasks defined for this service.</p>
                                                                )}
                                                            </div>
                                                            <div className="flex justify-end border-t pt-2 mt-2">
                                                                <div className="flex gap-4 text-sm">
                                                                    <span className="text-muted-foreground">Total:</span>
                                                                    <span className="font-bold">₹{calculateEffectivePrice(service, previewCategory).toLocaleString()}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Add/Edit Dialog */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{currentService ? "Edit Service" : "Add New Service"}</DialogTitle>
                            <DialogDescription>Configure service pricing, tasks, and metadata</DialogDescription>
                        </DialogHeader>
                        <Tabs defaultValue="overview" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="overview">Configuration</TabsTrigger>
                                <TabsTrigger value="pricing">Pricing Rules</TabsTrigger>
                            </TabsList>
                            <TabsContent value="overview">
                                <div className="grid gap-6 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Service Name</Label>
                                            <Input
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                placeholder="e.g. Engine Tuning"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Category</Label>
                                            <Select
                                                value={formData.category}
                                                onValueChange={val => setFormData({ ...formData, category: val })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Description</Label>
                                        <Textarea
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Detailed description of the service..."
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Estimated Duration</Label>
                                        <Input
                                            value={formData.estimated_duration}
                                            onChange={e => setFormData({ ...formData, estimated_duration: e.target.value })}
                                            placeholder="e.g. 2-3 hours"
                                        />
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                id="tax"
                                                checked={formData.tax_applicable}
                                                onChange={e => setFormData({ ...formData, tax_applicable: e.target.checked })}
                                            />
                                            <Label htmlFor="tax">Tax Applicable (GST)</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                id="active"
                                                checked={formData.is_active}
                                                onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                            />
                                            <Label htmlFor="active">Is Active</Label>
                                        </div>
                                    </div>

                                    <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                            <Label className="flex items-center gap-2">
                                                <ListTodo className="h-4 w-4" /> Predefined Tasks & Pricing
                                            </Label>

                                            <div className="flex flex-col md:flex-row items-end md:items-center gap-3 bg-background p-2 rounded border">
                                                {/* Preview Dropdown */}
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Preview:</span>
                                                    <Select value={previewCategory} onValueChange={setPreviewCategory}>
                                                        <SelectTrigger className="h-7 w-[160px] text-xs">
                                                            <SelectValue placeholder="Preview For..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="base">⭐ Base Price</SelectItem>
                                                            {vehicleCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="h-4 w-px bg-border hidden md:block"></div>

                                                {/* Total Price Display */}
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground">Total:</span>
                                                    <span className={`text-sm font-bold ${previewCategory !== 'base' ? 'text-blue-700' : ''}`}>
                                                        ₹{(
                                                            (currentService ? calculateEffectivePrice(currentService, previewCategory, pricingRules) : 0) +
                                                            newTasks.reduce((sum, t) => sum + (t.price || 0), 0)
                                                        ).toLocaleString()}
                                                    </span>
                                                    {previewCategory !== 'base' && (
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-blue-200 text-blue-600 bg-blue-50">Effective</Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex gap-2">
                                                <Input
                                                    className="flex-[3]"
                                                    value={newTaskInput}
                                                    onChange={e => setNewTaskInput(e.target.value)}
                                                    placeholder="Task name (e.g. Brake Pad Cleaning)"
                                                    onKeyDown={(e) => e.key === 'Enter' && addTask()}
                                                />
                                                <div className="relative flex-1">
                                                    <span className="absolute left-2 top-2.5 text-xs text-muted-foreground">₹</span>
                                                    <Input
                                                        type="number"
                                                        className="pl-5"
                                                        value={newTaskPrice}
                                                        onChange={e => setNewTaskPrice(parseFloat(e.target.value) || 0)}
                                                        placeholder="Price"
                                                    />
                                                </div>
                                                <Button type="button" variant="outline" onClick={addTask}>Add</Button>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground px-1 italic">
                                                Tasks added here will be saved when you Save the Configuration.
                                            </p>
                                        </div>

                                        {currentService?.task_templates && currentService.task_templates.length > 0 && (
                                            <div className="space-y-1 mt-4">
                                                <div className="flex justify-between items-center px-1">
                                                    <p className="text-xs text-muted-foreground uppercase font-bold">
                                                        Existing Templates {previewCategory !== 'base' ? '(Preview Mode)' : '(Editable)'}
                                                    </p>
                                                    {previewCategory !== 'base' && (
                                                        <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200 bg-blue-50">
                                                            Values modified by pricing rules
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="max-h-[200px] overflow-y-auto space-y-1">
                                                    {currentService.task_templates.map(task => {
                                                        const effectivePrice = calculateTaskPrice(task, pricingRules, previewCategory);
                                                        const isPreview = previewCategory !== 'base';

                                                        return (
                                                            <div key={task.id} className={`flex items-center justify-between border rounded p-2 text-sm gap-2 ${isPreview ? 'bg-blue-50/50 border-blue-100' : 'bg-card'}`}>
                                                                {isPreview ? (
                                                                    <span className="flex-1 truncate">{task.name}</span>
                                                                ) : (
                                                                    <div className="flex flex-1 items-center mr-2">
                                                                        <Input
                                                                            key={task.name}
                                                                            className="h-8 text-xs flex-1"
                                                                            defaultValue={task.name}
                                                                            onBlur={(e) => {
                                                                                if (e.target.value !== task.name) {
                                                                                    updateTaskDetails(task.id, e.target.value, task.price);
                                                                                }
                                                                            }}
                                                                        />
                                                                        <Button
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            className="h-8 w-8 text-destructive hover:bg-destructive/10 ml-1"
                                                                            title="Delete Task"
                                                                            onClick={() => handleDeleteTask(task.id)}
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center gap-2 w-32">
                                                                    <span className={`text-xs ${isPreview ? 'text-blue-600' : 'text-muted-foreground'}`}>₹</span>
                                                                    <Input
                                                                        type="number"
                                                                        className={`h-8 text-xs ${isPreview ? 'text-blue-700 font-bold bg-white' : ''}`}
                                                                        value={isPreview ? effectivePrice : undefined}
                                                                        defaultValue={isPreview ? undefined : task.price}
                                                                        key={`${task.id}-${previewCategory}-${task.price}`} // Re-mount if category or underlying price changes
                                                                        title={isPreview ? "Edit effective price for this category" : "Edit base price"}
                                                                        onChange={(e) => {
                                                                            if (isPreview) {
                                                                                const val = parseFloat(e.target.value) || 0;
                                                                                const newRules = [...pricingRules];
                                                                                const existingIdx = newRules.findIndex(r => r.task_template_id === task.id && r.vehicle_category_id === previewCategory);
                                                                                const catName = vehicleCategories.find(c => c.id === previewCategory)?.name || "General";

                                                                                // Rule Logic: Always Override to new price
                                                                                const rulePayload: any = {
                                                                                    service_type_id: currentService.id,
                                                                                    vehicle_category_id: previewCategory,
                                                                                    task_template_id: task.id,
                                                                                    modifier_type: 'override',
                                                                                    modifier_value: val,
                                                                                    name: `${task.name} - ${catName}`,
                                                                                    is_active: true,
                                                                                    priority: 10
                                                                                };

                                                                                if (existingIdx >= 0) {
                                                                                    newRules[existingIdx] = { ...newRules[existingIdx], ...rulePayload };
                                                                                } else {
                                                                                    newRules.push(rulePayload);
                                                                                }
                                                                                setPricingRules(newRules);
                                                                            }
                                                                        }}
                                                                        onBlur={(e) => {
                                                                            if (!isPreview) {
                                                                                const val = parseFloat(e.target.value) || 0;
                                                                                if (val !== task.price) updateTaskDetails(task.id, task.name, val);
                                                                            }
                                                                        }}
                                                                    />

                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {newTasks.length > 0 && (
                                            <div className="space-y-1 mt-4 border-t pt-4">
                                                <p className="text-xs text-blue-600 uppercase font-bold px-1 py-1">New Tasks to Add</p>
                                                {newTasks.map((task, i) => (
                                                    <div key={i} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded p-2 text-sm">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{task.name}</span>
                                                            <span className="text-xs text-blue-600">₹{task.price}</span>
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeNewTask(i)}>
                                                            <XCircle className="h-3 w-3 text-destructive" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>
                            <TabsContent value="pricing">
                                <div className="space-y-4 py-4">
                                    <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                                        <h4 className="text-sm font-medium">Add Pricing Rule</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Rule Name <span className="text-xs text-muted-foreground font-normal">(Auto-generated)</span></Label>
                                                <Input value={newRule.name} disabled className="bg-muted" placeholder="Auto-generated..." />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Apply Rule To</Label>
                                                <Select value={newRule.task_template_id || "service"} onValueChange={v => {
                                                    const taskId = v === "service" ? "" : v;
                                                    const taskName = v === "service" ? "Base Service" : currentService?.task_templates?.find(t => t.id === v)?.name;
                                                    const catName = vehicleCategories.find(c => c.id === newRule.vehicle_category_id)?.name || "General";

                                                    setNewRule({
                                                        ...newRule,
                                                        task_template_id: taskId,
                                                        name: `${taskName} - ${catName}`
                                                    });
                                                }}>
                                                    <SelectTrigger><SelectValue placeholder="Scope" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="service">Entire Service (Base Price)</SelectItem>
                                                        {currentService?.task_templates?.map(t => (
                                                            <SelectItem key={t.id} value={t.id}>Task: {t.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Vehicle Category</Label>
                                                <Select value={newRule.vehicle_category_id} onValueChange={v => {
                                                    const categoryName = vehicleCategories.find(c => c.id === v)?.name || "General";
                                                    const taskName = newRule.task_template_id
                                                        ? currentService?.task_templates?.find(t => t.id === newRule.task_template_id)?.name
                                                        : "Base Service";

                                                    setNewRule({
                                                        ...newRule,
                                                        vehicle_category_id: v,
                                                        name: `${taskName} - ${categoryName}`
                                                    })
                                                }}>
                                                    <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all_categories">All Categories</SelectItem>
                                                        {vehicleCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Modifier Type</Label>
                                                <Select value={newRule.modifier_type} onValueChange={v => setNewRule({ ...newRule, modifier_type: v as any })}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="fixed">Fixed Amount (+)</SelectItem>
                                                        <SelectItem value="percentage">Percentage (+%)</SelectItem>
                                                        <SelectItem value="override">Override Price (=)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Value</Label>
                                                <Input type="number" value={newRule.modifier_value} onChange={e => setNewRule({ ...newRule, modifier_value: parseFloat(e.target.value) })} />
                                            </div>
                                        </div>
                                        <Button onClick={handleAddRule} className="w-full">Add Pricing Rule</Button>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium">Existing Rules</h4>
                                        {pricingRules.length === 0 && <p className="text-sm text-muted-foreground">No custom pricing rules configured.</p>}
                                        {pricingRules.map((rule, idx) => (
                                            <div key={idx} className="flex flex-col border rounded p-2 text-sm gap-2">
                                                {editingRuleIndex === idx ? (
                                                    <div className="space-y-2 bg-muted/20 p-2 rounded">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Category</Label>
                                                                <Select
                                                                    value={rule.vehicle_category_id || "all_categories"}
                                                                    onValueChange={(val) => {
                                                                        const newRules = [...pricingRules];
                                                                        const catId = val === "all_categories" ? null : val;
                                                                        newRules[idx] = { ...newRules[idx], vehicle_category_id: catId };

                                                                        // Update name auto-gen logic
                                                                        const catName = vehicleCategories.find(c => c.id === catId)?.name || "General";
                                                                        const taskName = rule.task_template_id
                                                                            ? currentService?.task_templates?.find(t => t.id === rule.task_template_id)?.name
                                                                            : "Base Service";
                                                                        newRules[idx].name = `${taskName} - ${catName}`;

                                                                        setPricingRules(newRules);
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="all_categories">All Categories</SelectItem>
                                                                        {vehicleCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Rule Type</Label>
                                                                <Select
                                                                    value={rule.modifier_type}
                                                                    onValueChange={(val: any) => {
                                                                        const newRules = [...pricingRules];
                                                                        newRules[idx] = { ...newRules[idx], modifier_type: val };
                                                                        setPricingRules(newRules);
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="fixed">Fixed (+)</SelectItem>
                                                                        <SelectItem value="percentage">Percent (+%)</SelectItem>
                                                                        <SelectItem value="override">Override (=)</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 items-end">
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Value</Label>
                                                                <Input
                                                                    type="number"
                                                                    className="h-8 text-xs"
                                                                    value={rule.modifier_value}
                                                                    onChange={(e) => {
                                                                        const newRules = [...pricingRules];
                                                                        newRules[idx] = { ...newRules[idx], modifier_value: parseFloat(e.target.value) || 0 };
                                                                        setPricingRules(newRules);
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <Button size="sm" className="h-8 text-xs flex-1" onClick={() => setEditingRuleIndex(null)}>
                                                                    Done
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-medium">{rule.name}</p>
                                                                {rule.task_template_id ? (
                                                                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 hover:bg-blue-50">
                                                                        Task: {currentService?.task_templates?.find(t => t.id === rule.task_template_id)?.name || 'Unknown Task'}
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-[10px]">Entire Service</Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">
                                                                {vehicleCategories.find(c => c.id === rule.vehicle_category_id)?.name || 'Unknown Category'} •
                                                                {rule.modifier_type === 'fixed' ? ` +₹${rule.modifier_value}` :
                                                                    rule.modifier_type === 'percentage' ? ` +${rule.modifier_value}%` :
                                                                        ` =₹${rule.modifier_value}`}
                                                            </p>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingRuleIndex(idx)}>
                                                                <Edit className="h-3 w-3 text-muted-foreground" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveRule(idx)}>
                                                                <Trash2 className="h-3 w-3 text-destructive" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveService} disabled={isSubmitting}>
                                {isSubmitting && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
                                Save Configuration
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation */}
                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Service?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete "{currentService?.name}" from your service library.
                                If this service has been used in previous work orders, it will be deactivated instead.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteService} className="bg-destructive hover:bg-destructive/90">
                                Confirm
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </main>
        </div>
    );
}
