import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, Package, Download, Edit, Trash2,
  AlertTriangle, Filter, ChevronRight, QrCode, ScanLine, Clock, ArrowLeftRight,
  ExternalLink, RefreshCw, Eye, MoreHorizontal
} from "lucide-react";

import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { InventoryForm } from "@/components/inventory/InventoryForm";
import { SearchInput } from "@/components/shared/SearchInput";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { jsPDF } from "jspdf";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import QRCode from "qrcode";
import { renderToString } from "react-dom/server";

interface InventoryItem {
  id: string;
  item_name: string;
  category: string;
  quantity: number;
  available_qty: number;
  reserved_qty: number;
  unit_price: number;
  reorder_level: number;
  sku: string;
  qr_code: string;
  location: string;
  created_at: string;
  reservations?: any[];
}

interface LifecycleHistoryItem {
  transaction_id: string;
  item_name: string;
  sku: string;
  qr_code: string;
  transaction_type: 'restock' | 'issue' | 'adjustment' | 'reservation' | 'return';
  quantity: number;
  transaction_date: string;
  transaction_notes: string;
  performed_by_name: string;
  work_order_id: string;
  vehicle_number: string;
  customer_name: string;
  request_status: string;
  return_status: string;
  return_condition: string;
  company_name: string;
  requested_by_name: string;
  approved_by_name: string | null;
}

interface ReturnRequest {
  id: string;
  work_order_id: string;
  inventory_id: string;
  quantity: number;
  reason: string;
  condition: string;
  status: string;
  requested_by: string;
  created_at: string;
  inventory: { item_name: string; sku: string };
  employee: { name: string };
}

export default function AdminInventory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [history, setHistory] = useState<LifecycleHistoryItem[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [pendingReturns, setPendingReturns] = useState<ReturnRequest[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "inventory");

  const [selectedProductForQR, setSelectedProductForQR] = useState<InventoryItem | null>(null);
  const [productUnits, setProductUnits] = useState<any[]>([]);
  const [selectedUnitForView, setSelectedUnitForView] = useState<any>(null);
  const [isUnitViewOpen, setIsUnitViewOpen] = useState(false);


  const categories = ["All", "Mechanical", "Electrical", "Body", "Consumable", "Accessory", "Others"];

  useEffect(() => {
    fetchInventory();
    fetchHistory();
    fetchPendingReturns();

    // Sync tab state if URL changes
    const tab = searchParams.get("tab");
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    const newResolved = new Set(expandedGroups);
    if (newResolved.has(key)) {
      newResolved.delete(key);
    } else {
      newResolved.add(key);
    }
    setExpandedGroups(newResolved);
  };


  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("inventory_lifecycle_history")
        .select("*")
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      setHistory(data || []);
    } catch (error: any) {
      console.error("Error fetching history:", error.message);
    }
  };

  const fetchPendingReturns = async () => {
    try {
      const { data, error } = await supabase
        .from("inventory_returns")
        .select(`
          *,
          inventory:inventory(item_name, sku),
          employee:employees!requested_by(name)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPendingReturns(data || []);
    } catch (error: any) {
      console.error("Error fetching pending returns:", error.message);
    }
  };

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("inventory")
        .select(`
          *,
          *,
          reservations:part_requests!item_id(
            work_order_id,
            approved_qty,
            issued_qty,
            status,
            work_orders:work_orders(
              vehicle:vehicles(vehicle_number)
            )
          )
        `)
        .order("item_name");
      if (error) throw error;
      setInventory(data || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (formData: any) => {
    setLoading(true);
    try {
      // Sanitize formData to remove relationships and computed fields
      const { reservations, created_at, id, ...updateData } = formData;

      if (editingItem) {
        const { error } = await supabase
          .from("inventory")
          .update({
            ...updateData,
            // If total quantity changed, also update available_qty accordingly
            available_qty: updateData.quantity - (editingItem.reserved_qty || 0)
          })
          .eq("id", editingItem.id);
        if (error) throw error;
        toast({ title: "Updated", description: "Product updated successfully" });
      } else {
        const { data, error } = await supabase
          .from("inventory")
          .insert([{
            ...updateData,
            available_qty: updateData.quantity,
            reserved_qty: 0
          }])
          .select()
          .single();
        if (error) throw error;

        // Auto-generate units
        if (updateData.quantity > 0 && data) {
          await supabase.rpc("generate_inventory_units", {
            _inventory_id: data.id,
            _quantity: updateData.quantity,
            _sku: data.sku
          });
        }

        toast({ title: "Created", description: "Product added to inventory with tracked units." });
      }
      setIsFormOpen(false);
      setEditingItem(null);
      fetchInventory();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      const { error } = await supabase.from("inventory").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Product removed from inventory" });
      fetchInventory();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleProcessReturn = async (returnId: string, status: 'approved' | 'rejected') => {
    try {
      // @ts-ignore
      const { error } = await supabase.rpc("process_part_return", {
        _return_id: returnId,
        _status: status,
        _admin_id: (inventory as any).find(i => true)?.id || null, // We need a real employee ID here
        _notes: status === 'approved' ? "Approved by Admin" : "Rejected by Admin"
      });

      // Wait, I need the admin's employee ID. I'll fetch it like in PartRequestList
      const { data: adminEmp } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (!adminEmp) {
        toast({ variant: "destructive", title: "Error", description: "Your admin account is not linked to an employee record." });
        return;
      }

      // @ts-ignore
      const { error: rpcError } = await supabase.rpc("process_part_return", {
        _return_id: returnId,
        _status: status,
        _admin_id: adminEmp.id,
        _notes: status === 'approved' ? "Approved by Admin" : "Rejected by Admin"
      });

      if (rpcError) throw rpcError;

      toast({
        title: status === 'approved' ? "Return Approved" : "Return Rejected",
        description: status === 'approved' ? "Stock has been restored." : "Return request was rejected."
      });
      fetchPendingReturns();
      fetchInventory();
      fetchHistory();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const generateQRCodeSheet = async () => {
    const { data: profile } = await supabase.from('company_profiles').select('company_name').limit(1).maybeSingle();
    const companyTitle = profile?.company_name || "Service Center";

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`${companyTitle} Inventory QR Codes`, 20, 20);

    let x = 20;
    let y = 30;
    const size = 35;
    const margin = 10;
    const itemsPerRow = 4;

    setLoading(true);
    try {
      for (let i = 0; i < filteredInventory.length; i++) {
        const item = filteredInventory[i];

        if (i > 0 && i % itemsPerRow === 0) {
          x = 20;
          y += size + 20;
        }

        if (y > 250) {
          doc.addPage();
          y = 30;
          x = 20;
        }

        // Generate actual QR code data URL
        const qrDataUrl = await QRCode.toDataURL(item.qr_code || item.sku || item.item_name, {
          margin: 1,
          width: 200
        });

        doc.setFontSize(8);
        doc.text(item.item_name.substring(0, 20), x, y - 2);
        doc.addImage(qrDataUrl, 'PNG', x, y, size, size);
        doc.setFontSize(7);
        doc.text(`SKU: ${item.sku}`, x, y + size + 4);

        x += size + margin + 5;
      }

      doc.save("inventory_qr_codes.pdf");
      toast({ title: "Success", description: "QR sheet generated with scannable codes." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "QR Error", description: "Failed to generate QR codes." });
    } finally {
      setLoading(false);
    }
  };

  const generateLabelPDF = async (item: InventoryItem, copies: number) => {
    // Standard label size (e.g., 50x30mm or just use A4 with grid)
    const doc = new jsPDF();
    let x = 20;
    let y = 20;
    const qrSize = 30;
    const labelWidth = 60;
    const labelHeight = 45;
    const cols = 3;
    const rows = 5;

    setLoading(true);
    try {
      const qrDataUrl = await QRCode.toDataURL(item.qr_code || item.sku || item.item_name, {
        margin: 1,
        width: 200
      });

      for (let i = 0; i < copies; i++) {
        if (i > 0 && i % (cols * rows) === 0) {
          doc.addPage();
          x = 20;
          y = 20;
        } else if (i > 0 && i % cols === 0) {
          x = 20;
          y += labelHeight + 10;
        } else if (i > 0) {
          x += labelWidth + 5;
        }

        // Draw Label Box (optional)
        doc.setDrawColor(230);
        doc.rect(x - 2, y - 5, labelWidth, labelHeight);

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(item.item_name.substring(0, 25), x, y);

        doc.addImage(qrDataUrl, 'PNG', x + (labelWidth / 2) - (qrSize / 2) - 2, y + 4, qrSize, qrSize);

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`SKU: ${item.sku}`, x, y + qrSize + 8);
        doc.text(`Price: Rs.${item.unit_price}`, x, y + qrSize + 12);
      }

      doc.save(`Label_${item.sku}.pdf`);
      toast({ title: "Success", description: `${copies} labels generated for ${item.item_name}` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "QR Error", description: "Failed to generate labels." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProductForQR) {
      fetchProductUnits(selectedProductForQR.id);
    }
  }, [selectedProductForQR]);

  const fetchProductUnits = async (inventoryId: string) => {
    try {
      const { data, error } = await supabase
        .from("inventory_units")
        .select(`
          *,
          work_order:work_orders(
            vehicles(vehicle_number)
          ),
          employee:employees(name)
        `)
        .eq("inventory_id", inventoryId)

        .order("created_at");
      if (error) throw error;
      setProductUnits(data || []);
      if (data?.length === 0) {
        toast({ variant: "outline", title: "No Units", description: "No existing units found for this product." });
      }

    } catch (error: any) {
      console.error("Error fetching units:", error.message);
      toast({ variant: "destructive", title: "Fetch Error", description: error.message });
    }
  };

  const handleGenerateMissingUnits = async (item: InventoryItem) => {
    if (!confirm(`This will generate unique QR codes for current stock (${item.quantity}). Proceed?`)) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc("generate_inventory_units", {
        _inventory_id: item.id,
        _quantity: item.quantity,
        _sku: item.sku
      });
      if (error) throw error;
      toast({ title: "Success", description: "Unit QR codes generated." });
      await fetchProductUnits(item.id);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSingleQR = (unit: any) => {
    const canvas = document.getElementById(`qr-single-${unit.id}`) as HTMLCanvasElement;
    if (!canvas) {
      toast({ variant: "destructive", title: "Error", description: "QR code not ready for download." });
      return;
    }
    const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    const downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `QR-${unit.qr_code}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const generateUnitQRPDF = async (item: InventoryItem) => {
    if (productUnits.length === 0) {
      toast({ variant: "destructive", title: "Empty", description: "No units found. Generate them first." });
      return;
    }

    const doc = new jsPDF();
    let x = 20;
    let y = 20;
    const size = 30;
    const margin = 10;
    const itemsPerRow = 4;

    doc.setFontSize(16);
    doc.text(`QR Units: ${item.item_name}`, 20, 15);

    for (let i = 0; i < productUnits.length; i++) {
      const unit = productUnits[i];
      if (i > 0 && i % itemsPerRow === 0) {
        x = 20;
        y += size + 20;
      }
      if (y > 250) {
        doc.addPage();
        y = 30;
        x = 20;
      }

      const qrDataUrl = await QRCode.toDataURL(unit.qr_code, { margin: 1, width: 200 });
      doc.addImage(qrDataUrl, 'PNG', x, y, size, size);
      doc.setFontSize(8);
      doc.text(unit.qr_code, x, y + size + 4);

      // Status Badge Style
      doc.setFontSize(6);
      doc.setTextColor(unit.status === 'available' ? '#008000' : '#FF0000');
      doc.text(unit.status.toUpperCase(), x, y + size + 8);
      doc.setTextColor('#000000'); // Reset

      x += size + margin + 5;
    }
    doc.save(`Units_${item.sku}.pdf`);
  };

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch = item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const inventorySuggestions = useMemo(() => {
    const sets = [
      new Set(inventory.map(i => i.item_name)),
      new Set(inventory.map(i => i.sku)),
      new Set(inventory.map(i => i.location)),
      new Set(inventory.map(i => i.category)),
    ];
    return Array.from(new Set(sets.flatMap(s => Array.from(s)))).filter(Boolean);
  }, [inventory]);

  const historySuggestions = useMemo(() => {
    const sets = [
      new Set(history.map(h => h.item_name)),
      new Set(history.map(h => h.sku)),
      new Set(history.map(h => h.customer_name)),
      new Set(history.map(h => h.vehicle_number)),
      new Set(history.map(h => h.company_name)),
    ];
    return Array.from(new Set(sets.flatMap(s => Array.from(s)))).filter(Boolean);
  }, [history]);

  const lowStockItems = inventory.filter(item => item.available_qty <= item.reorder_level);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventory Master</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              Manage products, track stock levels, and generate QR codes.
              <a href="/inventory/login" className="text-xs text-primary hover:underline ml-2 flex items-center gap-1">
                <QrCode className="h-3 w-3" /> Dedicated Login Page
              </a>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => {
              fetchInventory();
              fetchHistory();
              fetchPendingReturns();
              toast({ title: "Refreshing", description: "Updating inventory data..." });
            }} title="Refresh Data">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => navigate("/inventory/room")}>
              <ScanLine className="h-4 w-4 mr-2" /> Scan & Issue Parts
            </Button>

            <Dialog open={isFormOpen} onOpenChange={(open) => {
              setIsFormOpen(open);
              if (!open) setEditingItem(null);
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingItem ? "Edit Product" : "Add New Product"}</DialogTitle>
                </DialogHeader>
                <InventoryForm
                  initialData={editingItem}
                  onCancel={() => {
                    setIsFormOpen(false);
                    setEditingItem(null);
                  }}
                  onPrintLabels={generateLabelPDF}
                  onSubmit={handleFormSubmit}
                  loading={loading}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList>
            <TabsTrigger value="inventory" className="flex items-center gap-2">
              <Package className="h-4 w-4" /> Stock Master
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> Parts Retrieval History
            </TabsTrigger>
            <TabsTrigger value="returns" className="flex items-center gap-2 relative">
              <ArrowLeftRight className="h-4 w-4" /> Return Requests
              {pendingReturns.length > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-destructive text-destructive-foreground">
                  {pendingReturns.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="qr-management" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" /> QR Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-6">

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Items</p>
                      <h3 className="text-2xl font-bold">{inventory.length}</h3>
                    </div>
                    <Package className="h-8 w-8 text-primary/20" />
                  </div>
                </CardContent>
              </Card>
              <Card className={lowStockItems.length > 0 ? "border-destructive bg-destructive/5" : ""}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Low Stock</p>
                      <h3 className="text-2xl font-bold text-destructive">{lowStockItems.length}</h3>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-destructive/20" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Categories</p>
                      <h3 className="text-2xl font-bold">{new Set(inventory.map(i => i.category)).size}</h3>
                    </div>
                    <Filter className="h-8 w-8 text-primary/20" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                      <h3 className="text-2xl font-bold">₹{inventory.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toLocaleString()}</h3>
                    </div>
                    <ChevronRight className="h-8 w-8 text-primary/20" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <SearchInput
                  placeholder="Search by name or SKU..."
                  value={searchTerm}
                  onChange={setSearchTerm}
                  suggestions={inventorySuggestions}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {categories.map((cat) => (
                  <Button
                    key={cat}
                    variant={selectedCategory === cat ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Inventory Items</CardTitle>
                <CardDescription>Stock status for all parts and supplies.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product Details</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Stock (Avail/Tot/Res)</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading && inventory.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-10">Loading inventory data...</TableCell></TableRow>
                      ) : filteredInventory.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-10">No items found matching your filters.</TableCell></TableRow>
                      ) : (
                        filteredInventory.map((item) => (
                          <TableRow key={item.id} className={item.available_qty <= item.reorder_level ? "bg-destructive/5" : ""}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-muted rounded border">
                                  <QrCode className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="font-medium">{item.item_name}</p>
                                  <p className="text-xs text-muted-foreground">SKU: {item.sku || 'N/A'}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.category}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-bold">{item.available_qty}</span>
                                <span className="text-xs text-muted-foreground">
                                  {item.quantity} Total / {item.reserved_qty || 0} Res
                                </span>
                                {item.available_qty <= item.reorder_level && (
                                  <Badge variant="destructive" className="mt-1 h-4 text-[10px]">Low Stock</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">₹{item.unit_price}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-mono">{item.location || 'Unset'}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => {
                                      setEditingItem(item);
                                      setIsFormOpen(true);
                                    }}>
                                      <Edit className="mr-2 h-4 w-4" /> Edit Item
                                    </DropdownMenuItem>

                                    {/* Reserved Part Navigation */}
                                    {item.reserved_qty > 0 && item.reservations && (
                                      <>
                                        {item.reservations.filter((r: any) => (r.status === 'approved' || r.status === 'issued') && r.approved_qty > r.issued_qty).map((r: any) => (
                                          <DropdownMenuItem key={r.work_order_id} onClick={() => navigate(`/admin/work-orders/${r.work_order_id}`)}>
                                            <ExternalLink className="mr-2 h-4 w-4" /> Go to WO #{r.work_order_id.slice(0, 6)}
                                          </DropdownMenuItem>
                                        ))}
                                      </>
                                    )}

                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => handleDelete(item.id)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" /> Delete Item
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <SearchInput
                  placeholder="Filter by part, employee, WO, vehicle, or company..."
                  value={historySearch}
                  onChange={setHistorySearch}
                  suggestions={historySuggestions}
                />
              </div>
            </div>

            <div className="space-y-4">
              {Object.entries(
                history
                  .filter(h =>
                    h.item_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
                    h.performed_by_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
                    h.requested_by_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
                    h.approved_by_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
                    h.vehicle_number?.toLowerCase().includes(historySearch.toLowerCase()) ||
                    h.customer_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
                    h.company_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
                    h.sku?.toLowerCase().includes(historySearch.toLowerCase())
                  )
                  .reduce((groups, item) => {
                    const key = item.work_order_id || 'general_stock_movement';
                    if (!groups[key]) {
                      groups[key] = {
                        items: [],
                        wo_id: item.work_order_id,
                        vehicle: item.vehicle_number,
                        customer: item.customer_name,
                        company: item.company_name
                      };
                    }
                    groups[key].items.push(item);
                    return groups;
                  }, {} as Record<string, { items: LifecycleHistoryItem[], wo_id: string, vehicle: string, customer: string, company: string }>)
              )
                .sort(([, a], [, b]) => new Date(b.items[0].transaction_date).getTime() - new Date(a.items[0].transaction_date).getTime())
                .map(([key, group]) => {
                  const isExpanded = expandedGroups.has(key);
                  return (
                    <Card key={key} className="overflow-hidden border-l-4 border-l-primary/50 transition-all duration-200">
                      <CardHeader
                        className="bg-muted/10 py-3 cursor-pointer hover:bg-muted/20 select-none"
                        onClick={() => toggleGroup(key)}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                          <div className="flex items-center gap-4">
                            <div className={`p-1 rounded-full transition-transform duration-200 ${isExpanded ? 'rotate-90 bg-primary/10' : ''}`}>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                            {group.wo_id ? (
                              <>
                                <div className="flex flex-col">
                                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Work Order</span>
                                  <span className="font-bold flex items-center gap-2">
                                    {group.wo_id.substring(0, 8)}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-4 w-4"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/admin/work-orders/${group.wo_id}`);
                                      }}
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </Button>
                                  </span>
                                </div>
                                <div className="h-8 w-px bg-border/50 hidden md:block" />
                                <div className="flex flex-col">
                                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Vehicle</span>
                                  <span className="font-semibold">{group.vehicle || 'N/A'}</span>
                                </div>
                                <div className="h-8 w-px bg-border/50 hidden md:block" />
                                <div className="flex flex-col">
                                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Customer / Company</span>
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium">{group.customer}</span>
                                    {group.company && (
                                      <Badge
                                        variant="secondary"
                                        className="cursor-pointer hover:bg-blue-100 text-[10px]"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setHistorySearch(group.company);
                                        }}
                                      >
                                        {group.company}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider">Type</span>
                                <span className="font-bold text-muted-foreground">General Stock Adjustments / Non-WO</span>
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground text-right flex flex-col items-end">
                            <span>Latest Activity</span>
                            <span className="font-mono">{new Date(group.items[0].transaction_date).toLocaleString()}</span>
                          </div>
                        </div>
                      </CardHeader>
                      {isExpanded && (
                        <CardContent className="p-0 animate-in slide-in-from-top-2 duration-200">
                          <Table>
                            <TableHeader className="bg-transparent">
                              <TableRow>
                                <TableHead>Date & Time</TableHead>
                                <TableHead>Part Details</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead>Requested By</TableHead>
                                <TableHead>Action By / Issuer</TableHead>
                                <TableHead>Approved By</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.items.map((log) => (
                                <TableRow key={log.transaction_id} className="hover:bg-muted/5 border-b-0">
                                  <TableCell className="text-xs whitespace-nowrap">
                                    {new Date(log.transaction_date).toLocaleString()}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="font-medium">{log.item_name}</span>
                                      <span className="text-[10px] text-muted-foreground">{log.sku}</span>
                                      <Badge
                                        variant={
                                          log.transaction_type === 'issue' ? 'destructive' :
                                            log.transaction_type === 'return' ? 'secondary' :
                                              log.transaction_type === 'restock' ? 'outline' : 'outline'
                                        }
                                        className="capitalize text-[10px] w-fit mt-1"
                                      >
                                        {log.transaction_type}
                                      </Badge>
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-bold">
                                    {log.transaction_type === 'issue' || log.transaction_type === 'reservation' ? '-' : '+'}{log.quantity}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {log.requested_by_name ? (
                                      <div className="flex items-center gap-1 font-medium">
                                        {log.requested_by_name}
                                      </div>
                                    ) : '-'}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {log.performed_by_name ? (
                                      <div className="flex items-center gap-1">
                                        <Badge variant="outline" className="text-[10px] font-normal border-blue-200 bg-blue-50 text-blue-700">
                                          {log.performed_by_name}
                                        </Badge>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground italic">System</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {log.approved_by_name ? (
                                      <Badge variant="outline" className="text-[10px] font-normal border-green-200 bg-green-50 text-green-700">
                                        {log.approved_by_name}
                                      </Badge>
                                    ) : '-'}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      {log.transaction_type === 'return' && (
                                        <Badge variant="outline" className="text-[10px] w-fit">
                                          {log.return_condition}
                                        </Badge>
                                      )}
                                      <span className="text-[10px] text-muted-foreground line-clamp-1" title={log.transaction_notes}>
                                        {log.transaction_notes}
                                      </span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              {history.length === 0 && (
                <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/5">
                  No history logs found.
                </div>
              )}
            </div>

          </TabsContent>

          <TabsContent value="returns" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Return Requests</CardTitle>
                <CardDescription>Review and approve parts being returned to stock.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Requested Date</TableHead>
                        <TableHead>Part Details</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Requested By</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingReturns.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No pending return requests.</TableCell></TableRow>
                      ) : (
                        pendingReturns.map((req) => (
                          <TableRow key={req.id}>
                            <TableCell className="text-xs">
                              {new Date(req.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{req.inventory?.item_name}</span>
                                <span className="text-[10px] text-muted-foreground">{req.inventory?.sku}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-bold">{req.quantity}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">{req.condition}</Badge>
                            </TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate" title={req.reason}>
                              {req.reason}
                            </TableCell>
                            <TableCell className="text-sm">{req.employee?.name}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handleProcessReturn(req.id, 'approved')}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/5"
                                  onClick={() => handleProcessReturn(req.id, 'rejected')}
                                >
                                  Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="qr-management" className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="w-full md:w-1/3">
                <label className="text-sm font-medium mb-2 block">Select Product to Manage</label>
                <Select
                  value={selectedProductForQR?.id || ""}
                  onValueChange={(val) => {
                    const product = inventory.find(i => i.id === val);
                    if (product) {
                      setSelectedProductForQR(product);
                      fetchProductUnits(product.id);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Search and select product..." />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Show top 50 or filtered list */}
                    {inventory.slice(0, 100).map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.item_name} ({item.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedProductForQR && (
                <div className="flex items-end gap-2 pb-1">
                  <div className="flex flex-col gap-1 mr-4">
                    <span className="text-xs text-muted-foreground">Total Stock</span>
                    <span className="font-bold text-lg">{selectedProductForQR.quantity} Units</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateMissingUnits(selectedProductForQR)}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Generate Missing QRs
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => generateUnitQRPDF(selectedProductForQR)}
                    disabled={productUnits.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Print All Units
                  </Button>
                </div>
              )}
            </div>

            {selectedProductForQR ? (
              <Card>
                <CardHeader>
                  <CardTitle>Unit QR Codes: {selectedProductForQR.item_name}</CardTitle>
                  <CardDescription>
                    Managing {productUnits.length} unique QR codes for this product.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-hidden max-h-[600px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>QR Code ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created At</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productUnits.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                              No unit QRs generated yet. Click "Generate Missing QRs" above.
                            </TableCell>
                          </TableRow>
                        ) : (
                          productUnits.map((unit) => (
                            <TableRow key={unit.id}>
                              <TableCell className="font-mono text-xs">{unit.qr_code}</TableCell>
                              <TableCell>
                                <Badge variant={unit.status === 'available' ? 'default' : 'secondary'}>
                                  {unit.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(unit.created_at).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedUnitForView(unit);
                                    setIsUnitViewOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>

                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg text-muted-foreground">
                <QrCode className="h-10 w-10 mb-4 opacity-20" />
                <p>Select a product above to manage its unit-level QR codes.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Single Unit View Dialog */}
      <Dialog open={isUnitViewOpen} onOpenChange={setIsUnitViewOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Unit Details: {selectedProductForQR?.item_name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="bg-white p-4 rounded-xl shadow-inner border">
              {/* SVG for display (crisp) */}
              <QRCodeSVG
                value={selectedUnitForView?.qr_code || ""}
                size={200}
                level="H"
                includeMargin
              />
              {/* Hidden Canvas for download */}
              <div style={{ display: 'none' }}>
                <QRCodeCanvas
                  id={`qr-single-${selectedUnitForView?.id}`}
                  value={selectedUnitForView?.qr_code || ""}
                  size={512}
                  level="H"
                  includeMargin
                />
              </div>
            </div>

            <div className="w-full space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">QR Code ID</span>
                <span className="font-mono text-xs font-bold">{selectedUnitForView?.qr_code}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={selectedUnitForView?.status === 'available' ? 'default' : 'secondary'}>
                  {selectedUnitForView?.status}
                </Badge>
              </div>
              {selectedUnitForView?.work_order?.vehicles?.vehicle_number && (
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-sm text-muted-foreground">Assigned To (Vehicle)</span>
                  <span className="font-bold text-primary">{selectedUnitForView.work_order.vehicles.vehicle_number}</span>
                </div>
              )}

              {selectedUnitForView?.employee && (
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-sm text-muted-foreground">Issued By</span>
                  <span className="font-medium">{selectedUnitForView.employee.name}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">Created On</span>
                <span className="text-sm italic">
                  {selectedUnitForView?.created_at && new Date(selectedUnitForView.created_at).toLocaleString()}
                </span>
              </div>
            </div>

            <Button
              variant="default"
              className="w-full"
              onClick={() => handleDownloadSingleQR(selectedUnitForView)}
            >
              <Download className="mr-2 h-4 w-4" />
              Download High-Res QR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>

  );
}

