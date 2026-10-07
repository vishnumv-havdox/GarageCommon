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
import { ModernVehicleCard } from "@/components/vehicles/ModernVehicleCard";
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
                    <ModernVehicleCard 
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
