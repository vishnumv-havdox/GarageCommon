import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { NavLink } from "react-router-dom";
import { LogOut, Users, Shield, Plus, Search, Package } from "lucide-react";

interface InventoryItem {
  id: string;
  item_name: string;
  category: string;
  quantity: number;
  unit_price: number;
  reorder_level: number;
  created_at: string;
}

export default function AdminInventory() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => { fetchInventory(); }, []);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("inventory").select("*").order("item_name");
      if (error) throw error;
      setInventory(data || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally { setLoading(false); }
  };

  const filteredInventory = inventory.filter((item) =>
    item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || item.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <aside className="w-64 min-h-screen bg-card border-r flex flex-col">
          <div className="p-4 border-b">
            <NavLink to="/admin" className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><Shield className="h-6 w-6 text-primary" /></div>
              <div><h1 className="font-bold">AMMA AUTO</h1><p className="text-xs text-muted-foreground">Admin Panel</p></div>
            </NavLink>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            <NavLink to="/admin" end className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}><Users className="h-5 w-5" />Dashboard</NavLink>
            <NavLink to="/admin/users" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}><Shield className="h-5 w-5" />Users</NavLink>
            <NavLink to="/admin/customers" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}><Users className="h-5 w-5" />Customers</NavLink>
            <NavLink to="/admin/vehicles" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}><Users className="h-5 w-5" />Vehicles</NavLink>
            <NavLink to="/admin/work-orders" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}><Users className="h-5 w-5" />Work Orders</NavLink>
            <NavLink to="/admin/inventory" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}><Package className="h-5 w-5" />Inventory</NavLink>
            <NavLink to="/admin/invoices" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}><Users className="h-5 w-5" />Invoices</NavLink>
          </nav>
          <div className="p-4 border-t">
            <div className="flex items-center gap-3 mb-3"><Badge variant="default">Admin</Badge><span className="text-sm truncate">{user?.full_name || user?.email}</span></div>
            <Button onClick={signOut} variant="outline" className="w-full" size="sm"><LogOut className="h-4 w-4 mr-2" />Logout</Button>
          </div>
        </aside>
        <main className="flex-1 p-8">
          <div className="flex items-center justify-between mb-8">
            <div><h1 className="text-3xl font-bold">Inventory</h1><p className="text-muted-foreground">Manage parts and inventory</p></div>
            <Button><Plus className="h-4 w-4 mr-2" />Add Item</Button>
          </div>
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search inventory..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Inventory Items ({filteredInventory.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredInventory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No inventory items found</div>
              ) : (
                <div className="space-y-4">
                  {filteredInventory.map((item) => (
                    <div key={item.id} className="border p-4 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{item.item_name}</h3>
                          <p className="text-sm text-muted-foreground">Category: {item.category}</p>
                          <p className="text-sm text-muted-foreground">Qty: {item.quantity} | Price: ₹{item.unit_price}</p>
                        </div>
                        {item.quantity <= item.reorder_level && <Badge variant="destructive">Low Stock</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

