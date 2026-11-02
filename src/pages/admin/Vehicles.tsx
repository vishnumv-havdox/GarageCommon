import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { NavLink, useSearchParams, Link, useNavigate } from "react-router-dom";
import {
  LogOut,
  Users,
  Shield,
  Plus,
  Search,
  Truck,
  Trash2,
  Car,
  CheckSquare,
  Square,
  Check,
  Loader2,
  Edit2,
  X,
  History,
} from "lucide-react";
import { VehicleForm } from "@/components/forms/VehicleForm";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { SearchInput } from "@/components/shared/SearchInput";
import { ModernVehicleCard } from "@/components/vehicles/ModernVehicleCard";
import { HavDoxLoader } from "@/components/brand/HavDoxLoader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VehicleModelsManager } from "@/components/vehicles/VehicleModelsManager";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"

interface Vehicle {
  id: string;
  created_at: string;
  customer_id: string;
  vehicle_number: string;
  model_id: string;
  year?: number;
  status: string;
  customer?: {
    name: string;
  };
  color?: string;
  vin?: string;
  engine_number?: string;
  notes?: string;
  kilometers_driven?: number;
  next_service_km?: number;
  next_service_date?: string;
  fc_number?: string;
  fc_expiry_date?: string;
  // Joined names
  vehicle_models?: {
    id?: string;
    name: string;
    image_url?: string | null;
    fuel_type?: string | null;
    engine_specs?: string | null;
    vehicle_manufacturers: { name: string };
    vehicle_types: {
      name: string;
      vehicle_categories: { name: string };
    };
  };
  photo_url?: string;
  photos?: string[];
}



export default function AdminVehicles() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [viewingVehicle, setViewingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);

  // Multi-select state
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "fleet";

  const handleTabChange = (val: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (val === "fleet") {
      newParams.delete("tab");
    } else {
      newParams.set("tab", val);
    }
    setSearchParams(newParams);
  };

  // Handle URL-based edit requests
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && vehicles.length > 0 && !editingVehicle) {
      const vehicleToEdit = vehicles.find(v => v.id === editId);
      if (vehicleToEdit) {
        setEditingVehicle(vehicleToEdit);
        setShowForm(true);
      }
    }
  }, [vehicles, searchParams]);

  useEffect(() => { fetchVehicles(); }, []);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("vehicles")
        .select(`
          *,
          customer:customers(name),
          vehicle_models (
            id,
            name,
            image_url,
            fuel_type,
            engine_specs,
            manufacturer_id,
            vehicle_manufacturers (id, name),
            vehicle_type_id,
            vehicle_types (
              id,
              name,
              category_id,
              vehicle_categories (id, name)
            )
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setVehicles(data as any[] || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally { setLoading(false); }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingVehicle(null);
    fetchVehicles();
    toast({ title: "Success", description: editingVehicle ? "Vehicle updated successfully" : "Vehicle saved successfully" });
  };

  const handleDelete = async () => {
    if (!deletingVehicle) return;
    try {
      const { error } = await supabase.from('vehicles').delete().eq('id', deletingVehicle.id);
      if (error) throw error;
      toast({ title: "Success", description: "Vehicle deleted successfully" });
      setSelectedVehicleIds(prev => prev.filter(id => id !== deletingVehicle.id));
      fetchVehicles();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setDeletingVehicle(null);
    }
  };

  const handleToggleSelectVehicle = (id: string) => {
    setSelectedVehicleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredVehicles = vehicles.filter((v) =>
    v.vehicle_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.vehicle_models?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isAllFilteredSelected =
    filteredVehicles.length > 0 &&
    filteredVehicles.every((v) => selectedVehicleIds.includes(v.id));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredVehicles.map((v) => v.id));
      setSelectedVehicleIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const newSelected = new Set(selectedVehicleIds);
      filteredVehicles.forEach((v) => newSelected.add(v.id));
      setSelectedVehicleIds(Array.from(newSelected));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedVehicleIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const { error } = await supabase
        .from("vehicles")
        .delete()
        .in("id", selectedVehicleIds);

      if (error) throw error;

      toast({
        title: "Vehicles Deleted",
        description: `Successfully deleted ${selectedVehicleIds.length} vehicle(s).`,
      });
      setSelectedVehicleIds([]);
      fetchVehicles();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Cannot Delete Vehicles",
        description:
          error.message ||
          "Could not delete selected vehicles because one or more are linked to active work orders or history records.",
      });
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const suggestions = useMemo(() => {
    const sets = [
      new Set(vehicles.map(v => v.vehicle_number)),
      new Set(vehicles.map(v => v.vehicle_models?.name)),
      new Set(vehicles.map(v => v.customer?.name)),
    ];
    return Array.from(new Set(sets.flatMap(s => Array.from(s)))).filter(Boolean);
  }, [vehicles]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col lg:flex-row">
        <AdminSidebar />
        <main className="flex-1 p-4 lg:p-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold">Vehicle Management</h1>
              <p className="text-muted-foreground">Manage fleet vehicles and models catalog</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
              <TabsList className="bg-muted p-1 rounded-xl">
                <TabsTrigger value="fleet" className="text-xs font-semibold px-4 py-2 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-xs">
                  <Truck className="h-4 w-4" />
                  <span>Registered Fleet</span>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-1">
                    {vehicles.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="models" className="text-xs font-semibold px-4 py-2 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-xs">
                  <Car className="h-4 w-4" />
                  <span>Vehicle Models</span>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-1">
                    Catalog
                  </Badge>
                </TabsTrigger>
              </TabsList>

              {activeTab === "fleet" && (
                <Button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90 text-xs h-9 shadow-xs">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Register Vehicle
                </Button>
              )}
            </div>

            {/* Tab 1: Registered Fleet */}
            <TabsContent value="fleet" className="space-y-6 m-0 outline-none">
              <Dialog
                open={showForm}
                onOpenChange={(open) => {
                  setShowForm(open);
                  if (!open) {
                    setEditingVehicle(null);
                    const newParams = new URLSearchParams(searchParams);
                    newParams.delete('edit');
                    setSearchParams(newParams);
                  }
                }}
              >
                <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 border-none shadow-2xl bg-transparent">
                  <VehicleForm
                    onSuccess={() => {
                      handleFormSuccess();
                      setShowForm(false);
                      setEditingVehicle(null);
                    }}
                    onCancel={() => {
                      setShowForm(false);
                      setEditingVehicle(null);
                      const newParams = new URLSearchParams(searchParams);
                      newParams.delete('edit');
                      setSearchParams(newParams);
                    }}
                    initialData={editingVehicle || undefined}
                  />
                </DialogContent>
              </Dialog>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="relative max-w-md flex-1">
                  <SearchInput
                    placeholder="Search vehicles by number, model, or owner..."
                    value={searchTerm}
                    onChange={setSearchTerm}
                    suggestions={suggestions}
                  />
                </div>
                {filteredVehicles.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant={isAllFilteredSelected ? "secondary" : "outline"}
                      size="sm"
                      onClick={handleToggleSelectAll}
                      className="text-xs h-9 gap-1.5 font-semibold"
                    >
                      {isAllFilteredSelected ? (
                        <>
                          <CheckSquare className="h-4 w-4 text-primary" />
                          <span>Deselect All</span>
                        </>
                      ) : (
                        <>
                          <Square className="h-4 w-4 text-muted-foreground" />
                          <span>Select All ({filteredVehicles.length})</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Bulk Selection Floating / Sticky Bar */}
              {selectedVehicleIds.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-primary/10 border-2 border-primary/30 rounded-xl shadow-md transition-all animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className="text-xs px-2.5 py-1 font-bold shadow-xs">
                      {selectedVehicleIds.length} Vehicle{selectedVehicleIds.length > 1 ? "s" : ""} Selected
                    </Badge>
                    <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
                      {selectedVehicleIds.length === filteredVehicles.length
                        ? `All ${filteredVehicles.length} vehicles selected`
                        : `${selectedVehicleIds.length} of ${filteredVehicles.length} vehicles selected`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedVehicleIds([])}
                      className="text-xs h-8 bg-background/80 hover:bg-background"
                    >
                      Clear Selection
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowBulkDeleteDialog(true)}
                      className="text-xs h-8 gap-1.5 shadow-sm font-semibold"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Selected ({selectedVehicleIds.length})
                    </Button>
                  </div>
                </div>
              )}

              <Card>
                <CardHeader className="flex flex-row items-center justify-between py-4">
                  <CardTitle className="text-base font-semibold">
                    Vehicles ({filteredVehicles.length})
                  </CardTitle>
                  {selectedVehicleIds.length > 0 && (
                    <span className="text-xs font-semibold text-primary">
                      {selectedVehicleIds.length} selected
                    </span>
                  )}
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <HavDoxLoader variant="section" message="Loading registered garage vehicles..." />
                  ) : filteredVehicles.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No vehicles found</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredVehicles.map((vehicle) => (
                        <ModernVehicleCard 
                          key={vehicle.id} 
                          vehicle={vehicle} 
                          isSelected={selectedVehicleIds.includes(vehicle.id)}
                          onToggleSelect={() => handleToggleSelectVehicle(vehicle.id)}
                          isSelectionMode={selectedVehicleIds.length > 0}
                          onView={() => setViewingVehicle(vehicle)}
                          onEdit={() => { setEditingVehicle(vehicle); setShowForm(true); }}
                          onDelete={() => setDeletingVehicle(vehicle)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 2: Vehicle Models Catalog */}
            <TabsContent value="models" className="space-y-6 m-0 outline-none">
              <VehicleModelsManager
                onModelSelect={(model) => {
                  // Switch to fleet registration with pre-selected model if needed
                  setEditingVehicle(null);
                  setShowForm(true);
                }}
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* View Dialog */}
      <Dialog open={!!viewingVehicle} onOpenChange={(open) => !open && setViewingVehicle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vehicle Details</DialogTitle>
          </DialogHeader>
          {viewingVehicle && (
            <div className="space-y-4">
              {/* Vehicle Photo Gallery Header */}
              {((viewingVehicle.photos && viewingVehicle.photos.length > 0) || viewingVehicle.photo_url) && (
                <div className="space-y-2">
                    <div className="w-full h-48 bg-muted rounded-lg overflow-hidden relative border shadow-inner">
                        <img 
                            src={viewingVehicle.photos?.[0] || viewingVehicle.photo_url} 
                            alt="Vehicle Primary"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    {viewingVehicle.photos && viewingVehicle.photos.length > 1 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                            {viewingVehicle.photos.slice(1).map((photo, i) => (
                                <img 
                                    key={i}
                                    src={photo} 
                                    alt={`Gallery ${i+1}`}
                                    className="h-16 w-24 object-cover rounded border shadow-sm flex-shrink-0"
                                />
                            ))}
                        </div>
                    )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Vehicle Number</Label>
                  <p className="font-medium">{viewingVehicle.vehicle_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="font-medium">{viewingVehicle.vehicle_models?.vehicle_types?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Model</Label>
                  <p className="font-medium">{viewingVehicle.vehicle_models?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Manufacturer</Label>
                  <p className="font-medium">{viewingVehicle.vehicle_models?.vehicle_manufacturers?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="font-medium">{viewingVehicle.vehicle_models?.vehicle_types?.vehicle_categories?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Year</Label>
                  <p className="font-medium">{viewingVehicle.year || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Owner</Label>
                  <p className="font-medium">{viewingVehicle.customer?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p className="font-medium">{viewingVehicle.status}</p>
                </div>
                {viewingVehicle.color && (
                  <div>
                    <Label className="text-muted-foreground">Color</Label>
                    <p className="font-medium">{viewingVehicle.color}</p>
                  </div>
                )}
                {viewingVehicle.vin && (
                  <div>
                    <Label className="text-muted-foreground">VIN</Label>
                    <p className="font-medium">{viewingVehicle.vin}</p>
                  </div>
                )}
                {viewingVehicle.engine_number && (
                  <div>
                    <Label className="text-muted-foreground">Engine No</Label>
                    <p className="font-medium">{viewingVehicle.engine_number}</p>
                  </div>
                )}
              </div>

              {/* Service Tracking Section */}
              <div className="border-t pt-4 grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground">Odometer (KM)</Label>
                  <p className="font-medium">{viewingVehicle.kilometers_driven?.toLocaleString() || '0'} km</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Next Service @</Label>
                  <p className="font-medium">{viewingVehicle.next_service_km ? `${viewingVehicle.next_service_km.toLocaleString()} km` : 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Next Service Date</Label>
                  <p className="font-medium">{viewingVehicle.next_service_date ? new Date(viewingVehicle.next_service_date).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>

              {/* FC Management Section */}
              <div className="border-t pt-4 grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">FC Number</Label>
                  <p className="font-medium">{viewingVehicle.fc_number || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">FC Expiry Date</Label>
                  <div className="flex items-center gap-2">
                    <p className={`font-medium ${viewingVehicle.fc_expiry_date && new Date(viewingVehicle.fc_expiry_date) < new Date()
                      ? 'text-destructive'
                      : 'text-foreground'
                      }`}>
                      {viewingVehicle.fc_expiry_date ? new Date(viewingVehicle.fc_expiry_date).toLocaleDateString() : 'N/A'}
                    </p>
                    {viewingVehicle.fc_expiry_date && new Date(viewingVehicle.fc_expiry_date) < new Date() && (
                      <Badge variant="destructive" className="text-[10px] h-5">Expired</Badge>
                    )}
                  </div>
                </div>
              </div>

              {viewingVehicle.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="text-sm bg-muted p-2 rounded mt-1">{viewingVehicle.notes}</p>
                </div>
              )}

              {/* View Modal Footer Actions */}
              <div className="flex flex-wrap items-center justify-between pt-4 border-t gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const v = viewingVehicle;
                    setViewingVehicle(null);
                    setDeletingVehicle(v);
                  }}
                  className="gap-1.5 text-xs h-9"
                >
                  <Trash2 className="h-4 w-4" /> Delete Vehicle
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const v = viewingVehicle;
                      setViewingVehicle(null);
                      navigate(`/admin/vehicles/${v?.id}#service-history`);
                    }}
                    className="gap-1.5 text-xs h-9 font-semibold text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-900/60 dark:hover:bg-amber-950/40"
                  >
                    <History className="h-4 w-4 text-amber-600" /> Full History & Bills
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const v = viewingVehicle;
                      setViewingVehicle(null);
                      setEditingVehicle(v);
                      setShowForm(true);
                    }}
                    className="gap-1.5 text-xs h-9 font-semibold"
                  >
                    <Edit2 className="h-4 w-4" /> Edit Vehicle
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setViewingVehicle(null)}
                    className="text-xs h-9"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Single Vehicle Delete Dialog */}
      <AlertDialog open={!!deletingVehicle} onOpenChange={(open) => !open && setDeletingVehicle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vehicle?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the vehicle <b>{deletingVehicle?.vehicle_number}</b> from your garage registry.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Vehicles Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete {selectedVehicleIds.length} Vehicle{selectedVehicleIds.length > 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2 text-left">
              <p>
                Are you sure you want to permanently delete these <b>{selectedVehicleIds.length}</b> selected vehicles from your fleet?
              </p>
              
              {/* Selected vehicle list preview */}
              <div className="max-h-36 overflow-y-auto p-2.5 bg-muted/70 rounded-lg text-xs space-y-1.5 border">
                {vehicles
                  .filter((v) => selectedVehicleIds.includes(v.id))
                  .map((v) => (
                    <div key={v.id} className="flex items-center justify-between font-mono py-0.5 border-b border-border/40 last:border-b-0">
                      <span className="font-bold">{v.vehicle_number}</span>
                      <span className="text-muted-foreground truncate max-w-[180px]">
                        {v.vehicle_models?.name || "Standard Model"}
                      </span>
                    </div>
                  ))}
              </div>

              <p className="text-[11px] text-muted-foreground">
                Note: If any vehicle is associated with active work orders or invoices, deletion will be blocked to maintain data integrity.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
            >
              {isBulkDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Deleting...
                </>
              ) : (
                `Confirm Delete (${selectedVehicleIds.length})`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
