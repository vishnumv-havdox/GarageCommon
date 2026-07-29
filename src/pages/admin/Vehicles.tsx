import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { NavLink, useSearchParams, Link } from "react-router-dom";
import { LogOut, Users, Shield, Plus, Search, Truck, Trash2 } from "lucide-react";
import { VehicleForm } from "@/components/forms/VehicleForm";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { SearchInput } from "@/components/shared/SearchInput";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
    name: string;
    vehicle_manufacturers: { name: string };
    vehicle_types: {
      name: string;
      vehicle_categories: { name: string };
    };
  };
  photo_url?: string;
  photos?: string[];
}

function VehicleCardItem({ 
  vehicle, 
  onView, 
  onEdit, 
  onDelete 
}: { 
  vehicle: Vehicle, 
  onView: () => void, 
  onEdit: () => void, 
  onDelete: () => void 
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = vehicle.photos && vehicle.photos.length > 0 ? vehicle.photos : (vehicle.photo_url ? [vehicle.photo_url] : []);
  const hasMultipleImages = images.length > 1;

  useEffect(() => {
    if (!hasMultipleImages) return;
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [hasMultipleImages, images.length]);

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all group border-slate-200 dark:border-slate-800 flex flex-col h-full">
      {/* Vehicle Image */}
      <div className="relative h-40 bg-muted/30 border-b border-slate-100 dark:border-slate-800 overflow-hidden group/image">
        {images.length > 0 ? (
            <img 
                src={images[currentImageIndex]} 
                alt={vehicle.vehicle_number}
                className="w-full h-full object-cover transition-transform duration-500"
            />
        ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 bg-slate-50 dark:bg-slate-900/50">
                <Truck className="h-12 w-12 mb-2 opacity-50" />
                <span className="text-[10px] uppercase tracking-widest font-bold">No Photo</span>
            </div>
        )}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          <Badge variant="outline" className="bg-background/80 backdrop-blur-sm border-white/20 text-[10px] uppercase font-bold">
            {vehicle.status}
          </Badge>
          {hasMultipleImages && (
            <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-[10px] font-bold shadow-sm">
              {currentImageIndex + 1}/{images.length} Photos
            </Badge>
          )}
        </div>
        
        {/* Manual Image Navigation Controls */}
        {hasMultipleImages && (
            <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover/image:opacity-100 transition-opacity">
                {images.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(idx); }}
                        className={`w-2 h-2 rounded-full border border-white/50 transition-all ${currentImageIndex === idx ? 'bg-white scale-125' : 'bg-black/50 hover:bg-white/50'}`}
                    />
                ))}
            </div>
        )}
      </div>

      {/* Card Content */}
      <CardContent className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-black text-lg tracking-tight">{vehicle.vehicle_number}</h3>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
                {vehicle.vehicle_models?.vehicle_types?.name} • {vehicle.vehicle_models?.name} {vehicle.year ? `• ${vehicle.year}` : ''}
            </p>
          </div>
        </div>

        <div className="mt-2 space-y-1 mb-4 flex-1">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>
              <span className="font-semibold text-foreground/80">{vehicle.vehicle_models?.vehicle_manufacturers?.name}</span> • {vehicle.vehicle_models?.vehicle_types?.vehicle_categories?.name}
            </p>
            {vehicle.customer && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3 w-3" />
                Owner: <span className="font-semibold text-foreground/80 truncate">{vehicle.customer.name}</span>
              </p>
            )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-100 dark:border-slate-800">
          <Link to={`/admin/vehicles/${vehicle.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full h-8 text-xs bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary">
              View
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={onEdit} className="flex-1 h-8 text-xs">
            Edit
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminVehicles() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [viewingVehicle, setViewingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

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
      fetchVehicles();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setDeletingVehicle(null);
    }
  }


  const filteredVehicles = vehicles.filter((v) =>
    v.vehicle_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.vehicle_models?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              <p className="text-muted-foreground">Manage vehicle records</p>
            </div>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Register Vehicle
            </Button>
          </div>

          {showForm && (
            <div className="mb-8">
              <VehicleForm onSuccess={handleFormSuccess} onCancel={() => { setShowForm(false); setEditingVehicle(null); }} initialData={editingVehicle || undefined} />
            </div>
          )}

          <div className="mb-6">
            <div className="relative max-w-md">
              <SearchInput
                placeholder="Search vehicles by number, model, or owner..."
                value={searchTerm}
                onChange={setSearchTerm}
                suggestions={suggestions}
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Vehicles ({filteredVehicles.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredVehicles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No vehicles found</div>
              ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredVehicles.map((vehicle) => (
                    <VehicleCardItem 
                      key={vehicle.id} 
                      vehicle={vehicle} 
                      onView={() => setViewingVehicle(vehicle)}
                      onEdit={() => { setEditingVehicle(vehicle); setShowForm(true); }}
                      onDelete={() => setDeletingVehicle(vehicle)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deletingVehicle} onOpenChange={(open) => !open && setDeletingVehicle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the vehicle <b>{deletingVehicle?.vehicle_number}</b>.
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

    </div>
  );
}
