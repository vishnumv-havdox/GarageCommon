import { useState, useEffect } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Plus,
    Search,
    Edit,
    Trash2,
    BookOpen,
    Car,
    Wrench,
    IndianRupee,
    Info
} from "lucide-react";
import { Label } from "@/components/ui/label";

export default function BookingCatalog() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [catalogItems, setCatalogItems] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reference data
    const [serviceTypes, setServiceTypes] = useState<any[]>([]);
    const [vehicleCategories, setVehicleCategories] = useState<any[]>([]);

    const [formData, setFormData] = useState<any>({
        display_name: "",
        description: "",
        estimated_cost: 0,
        is_active: true,
        service_type_id: "none",
        vehicle_category_id: "none"
    });

    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [catalogRes, servicesRes, categoriesRes] = await Promise.all([
                supabase.from("booking_catalog").select(`
                    *,
                    service_type:service_types(name),
                    vehicle_category:vehicle_categories(name)
                `).order("created_at", { ascending: false }),
                supabase.from("service_types").select("id, name").eq("is_active", true).order("name"),
                supabase.from("vehicle_categories").select("id, name").order("name")
            ]);

            if (catalogRes.error) throw catalogRes.error;
            if (servicesRes.error) throw servicesRes.error;
            if (categoriesRes.error) throw categoriesRes.error;

            setCatalogItems(catalogRes.data || []);
            setServiceTypes(servicesRes.data || []);
            setVehicleCategories(categoriesRes.data || []);
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error fetching data",
                description: error.message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenDialog = (item?: any) => {
        if (item) {
            setEditingId(item.id);
            setFormData({
                display_name: item.display_name,
                description: item.description || "",
                estimated_cost: item.estimated_cost || 0,
                is_active: item.is_active,
                service_type_id: item.service_type_id || "none",
                vehicle_category_id: item.vehicle_category_id || "none"
            });
        } else {
            setEditingId(null);
            setFormData({
                display_name: "",
                description: "",
                estimated_cost: 0,
                is_active: true,
                service_type_id: "none",
                vehicle_category_id: "none"
            });
        }
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.display_name) {
            toast({ variant: "destructive", title: "Missing Name", description: "Display Name is required" });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                display_name: formData.display_name,
                description: formData.description,
                estimated_cost: parseFloat(formData.estimated_cost),
                is_active: formData.is_active,
                service_type_id: formData.service_type_id === "none" ? null : formData.service_type_id,
                vehicle_category_id: formData.vehicle_category_id === "none" ? null : formData.vehicle_category_id,
            };

            if (editingId) {
                const { error } = await supabase
                    .from("booking_catalog")
                    .update({ ...payload, updated_at: new Date().toISOString() })
                    .eq("id", editingId);
                if (error) throw error;
                toast({ title: "Updated", description: "Catalog item updated successfully" });
            } else {
                const { error } = await supabase
                    .from("booking_catalog")
                    .insert(payload);
                if (error) throw error;
                toast({ title: "Created", description: "New catalog item created" });
            }

            setIsDialogOpen(false);
            fetchData();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this item?")) return;
        try {
            const { error } = await supabase.from("booking_catalog").delete().eq("id", id);
            if (error) throw error;
            toast({ title: "Deleted", description: "Item removed from catalog" });
            fetchData();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    const filteredItems = catalogItems.filter(item =>
        item.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50/50 dark:bg-background">
            <AdminSidebar />
            <main className="flex-1 p-8">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Booking Catalog</h1>
                        <p className="text-muted-foreground">Manage services visible to customers for online booking.</p>
                    </div>
                    <Button onClick={() => handleOpenDialog()}>
                        <Plus className="h-4 w-4 mr-2" /> Add New Item
                    </Button>
                </div>

                <div className="flex flex-col gap-6">
                    {/* Search & Stats */}
                    <div className="flex gap-4 items-center">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search catalog..."
                                className="pl-9 bg-white dark:bg-card"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 text-sm text-muted-foreground ml-auto">
                            <Badge variant="outline" className="bg-white">{catalogItems.length} Items</Badge>
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                {catalogItems.filter(i => i.is_active).length} Active
                            </Badge>
                        </div>
                    </div>

                    <Card className="border-none shadow-md">
                        <CardHeader className="p-0" />
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead>Service Name</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Price Estimate</TableHead>
                                        <TableHead>Internal Mapping</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-20">Loading catalog...</TableCell>
                                        </TableRow>
                                    ) : filteredItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                                No items found. Create one to get started.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredItems.map((item) => (
                                            <TableRow key={item.id} className="group hover:bg-muted/20">
                                                <TableCell className="font-medium">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold">{item.display_name}</span>
                                                        <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={item.description}>
                                                            {item.description || "-"}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {item.vehicle_category ? (
                                                        <Badge variant="outline">{item.vehicle_category.name}</Badge>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">All Vehicles</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1 font-mono text-sm">
                                                        <IndianRupee className="h-3 w-3" />
                                                        {item.estimated_cost?.toLocaleString() || 0}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {item.service_type ? (
                                                        <div className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md w-fit border border-blue-100">
                                                            <Wrench className="h-3 w-3" />
                                                            {item.service_type.name}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">Unmapped</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Switch
                                                        checked={item.is_active}
                                                        onCheckedChange={async (checked) => {
                                                            // Optimistic update
                                                            const newItem = { ...item, is_active: checked };
                                                            setCatalogItems(catalogItems.map(i => i.id === item.id ? newItem : i));
                                                            await supabase.from("booking_catalog").update({ is_active: checked }).eq("id", item.id);
                                                            toast({ title: checked ? "Activated" : "Deactivated", duration: 1500 });
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button size="sm" variant="ghost" onClick={() => handleOpenDialog(item)}>
                                                            <Edit className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(item.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>{editingId ? "Edit Catalog Item" : "New Catalog Item"}</DialogTitle>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">Display Name *</Label>
                                <Input
                                    id="name"
                                    value={formData.display_name}
                                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                                    className="col-span-3"
                                    placeholder="e.g. General Service (Bikes)"
                                />
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="desc" className="text-right">Description</Label>
                                <Textarea
                                    id="desc"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="col-span-3"
                                    placeholder="What does this service include?"
                                />
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="cost" className="text-right">Est. Price (₹)</Label>
                                <Input
                                    id="cost"
                                    type="number"
                                    value={formData.estimated_cost}
                                    onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">Category</Label>
                                <div className="col-span-3">
                                    <Select
                                        value={formData.vehicle_category_id}
                                        onValueChange={(val) => setFormData({ ...formData, vehicle_category_id: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Vehicles" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">All Vehicles</SelectItem>
                                            {vehicleCategories.map(c => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground mt-1">If selected, this item only appears for vehicles of this category.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 items-start gap-4 pt-4 border-t">
                                <Label className="text-right pt-2 font-semibold text-blue-600">Map to Internal Service</Label>
                                <div className="col-span-3 space-y-2">
                                    <Select
                                        value={formData.service_type_id}
                                        onValueChange={(val) => setFormData({ ...formData, service_type_id: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Internal Service to Link" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No Mapping</SelectItem>
                                            {serviceTypes.map(s => (
                                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="bg-blue-50 p-2 rounded-md flex gap-2 text-xs text-blue-700">
                                        <Info className="h-4 w-4 shrink-0" />
                                        <p>Linking allows automatic pre-filling of Work Orders when converting appointments.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleSave} disabled={isSubmitting}>
                                {isSubmitting ? "Saving..." : "Save Item"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
}
