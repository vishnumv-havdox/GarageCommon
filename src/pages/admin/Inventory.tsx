import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  ExternalLink
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
import { QRCodeSVG } from "qrcode.react";
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
  const [activeTab, setActiveTab] = useState("inventory");

  const categories = ["All", "Mechanical", "Electrical", "Body", "Consumable", "Accessory", "Others"];

  useEffect(() => {
    fetchInventory();
    fetchHistory();
    fetchPendingReturns();
  }, []);

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
          reservations:part_requests(
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
      if (editingItem) {
        const { error } = await supabase
          .from("inventory")
          .update({
            ...formData,
            // If total quantity changed, also update available_qty accordingly
            available_qty: formData.quantity - (editingItem.reserved_qty || 0)
          })
          .eq("id", editingItem.id);
        if (error) throw error;
        toast({ title: "Updated", description: "Product updated successfully" });
      } else {
        const { error } = await supabase
          .from("inventory")
          .insert([{
            ...formData,
            available_qty: formData.quantity,
            reserved_qty: 0
          }]);
        if (error) throw error;
        toast({ title: "Created", description: "Product added to inventory" });
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
    const companyTitle = profile?.company_name || "Amma Auto";

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
            <Button variant="outline" onClick={() => window.location.href = "/inventory/room"}>
              <ScanLine className="h-4 w-4 mr-2" /> Open Room Scanner
            </Button>
            <Button variant="outline" onClick={generateQRCodeSheet}>
              <Download className="h-4 w-4 mr-2" /> QR Sheet
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
          </TabsList>

          <TabsContent value="inventory" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <div className="flex gap-2">
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
                <div className="rounded-md border overflow-hidden">
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
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingItem(item);
                                    setIsFormOpen(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>

                                {/* Reserved Part Navigation */}
                                {item.reserved_qty > 0 && item.reservations && (
                                  (() => {
                                    const activeReservations = item.reservations.filter(r =>
                                      (r.status === 'approved' || r.status === 'issued') &&
                                      r.approved_qty > r.issued_qty
                                    );

                                    if (activeReservations.length === 1) {
                                      return (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                          title="Go to Work Order"
                                          onClick={() => navigate(`/admin/work-orders/${activeReservations[0].work_order_id}`)}
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                        </Button>
                                      );
                                    }

                                    if (activeReservations.length > 1) {
                                      return (
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                              title="View Reserved Work Orders"
                                            >
                                              <Clock className="h-4 w-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-56">
                                            <DropdownMenuLabel>Reserved In:</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            {activeReservations.map((res: any) => (
                                              <DropdownMenuItem
                                                key={res.work_order_id}
                                                onClick={() => navigate(`/admin/work-orders/${res.work_order_id}`)}
                                              >
                                                <ExternalLink className="mr-2 h-3 w-3" />
                                                <div className="flex flex-col">
                                                  <span className="text-xs font-bold">WO: {res.work_order_id.substring(0, 8)}</span>
                                                  <span className="text-[10px] text-muted-foreground">{res.work_orders?.vehicle?.vehicle_number || 'Unknown'}</span>
                                                </div>
                                              </DropdownMenuItem>
                                            ))}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      );
                                    }

                                    return null;
                                  })()
                                )}

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(item.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
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

          <TabsContent value="history" className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <SearchInput
                  placeholder="Filter history by part, employee, WO, or vehicle..."
                  value={historySearch}
                  onChange={setHistorySearch}
                  suggestions={historySuggestions}
                />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Lifecycle Logs</CardTitle>
                <CardDescription>Complete audit trail of all part issuances, returns, and adjustments.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Part Details</TableHead>
                        <TableHead>Movement</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Related To</TableHead>
                        <TableHead>Performed By</TableHead>
                        <TableHead>Status/Condition</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-10">No history logs found.</TableCell></TableRow>
                      ) : (
                        history
                          .filter(h =>
                            h.item_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
                            h.performed_by_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
                            h.vehicle_number?.toLowerCase().includes(historySearch.toLowerCase()) ||
                            h.customer_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
                            h.sku?.toLowerCase().includes(historySearch.toLowerCase())
                          )
                          .map((log) => (
                            <TableRow key={log.transaction_id}>
                              <TableCell className="text-xs whitespace-nowrap">
                                {new Date(log.transaction_date).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium">{log.item_name}</span>
                                  <span className="text-[10px] text-muted-foreground">{log.sku}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    log.transaction_type === 'issue' ? 'default' :
                                      log.transaction_type === 'return' ? 'secondary' :
                                        log.transaction_type === 'restock' ? 'outline' : 'ghost'
                                  }
                                  className="capitalize"
                                >
                                  {log.transaction_type}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-bold">
                                {log.transaction_type === 'issue' || log.transaction_type === 'reservation' ? '-' : '+'}{log.quantity}
                              </TableCell>
                              <TableCell>
                                {log.work_order_id ? (
                                  <div className="flex flex-col text-xs">
                                    <span className="font-medium">WO: {log.work_order_id.substring(0, 8)}</span>
                                    <span className="text-muted-foreground">{log.vehicle_number}</span>
                                  </div>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="text-xs">{log.performed_by_name || 'System'}</TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  {log.transaction_type === 'return' && (
                                    <Badge variant="outline" className="text-[10px] w-fit">
                                      {log.return_condition}
                                    </Badge>
                                  )}
                                  <span className="text-[10px] text-muted-foreground line-clamp-1">
                                    {log.transaction_notes}
                                  </span>
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
        </Tabs>
      </main>
    </div>
  );
}

