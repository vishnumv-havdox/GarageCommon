/**
 * Employee User Creation Form
 * Creates staff users with centralized user creation logic.
 * Role is AUTO-ASSIGNED to "staff" - no manual selection for admin.
 * Creates: Auth user → Role → Profile → Employee record
 */
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/integrations/supabase/adminClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Briefcase, X, CheckCircle } from "lucide-react";
import { createUser, getUserConfig } from "@/config/userCreation";

interface Position {
  id: string;
  name: string;
  department: string;
  access_level: string;
}
interface EmployeeFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  editingEmployee?: any;
  positions: Position[];
  onPositionAdd: (position: Position) => void;
}
const USER_TYPE: "employee" = "employee";

export function EmployeeForm({ onSuccess, onCancel, editingEmployee, positions, onPositionAdd }: EmployeeFormProps) {
  const config = getUserConfig(USER_TYPE);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", password: "", position_id: "", access_level: "staff", salary: "" });
  const [showPositionForm, setShowPositionForm] = useState(false);
  const [newPosition, setNewPosition] = useState({ name: "", department: "", access_level: "staff" });
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingPosition, setIsSavingPosition] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (editingEmployee) {
      setFormData({ name: editingEmployee.name, email: editingEmployee.email, phone: editingEmployee.phone || "", password: "", position_id: editingEmployee.position_id, access_level: editingEmployee.access_level, salary: editingEmployee.salary?.toString() || "" });
    }
  }, [editingEmployee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.position_id || !formData.password) {
      toast({ title: "Error", description: "Please fill in all required fields (password is required for login)", variant: "destructive" });
      return;
    }
    if (formData.password.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const result = await createUser(USER_TYPE, {
      email: formData.email, password: formData.password, fullName: formData.name, phone: formData.phone || undefined, positionId: formData.position_id, accessLevel: formData.access_level as "admin" | "manager" | "staff", salary: formData.salary ? parseFloat(formData.salary) : undefined,
    }, supabaseAdmin);
    if (!result.success) {
      toast({ title: "Error", description: result.error || "Failed to create employee", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    toast({ title: "Success", description: `${config.displayName} created successfully with ${config.role} role` });
    onSuccess();
  };

  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPosition.name || !newPosition.department) {
      toast({ title: "Error", description: "Please fill in all position fields", variant: "destructive" });
      return;
    }
    setIsSavingPosition(true);
    const { data, error } = await supabase.from("positions").insert([{ name: newPosition.name, department: newPosition.department, access_level: newPosition.access_level }]).select().single();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      onPositionAdd(data);
      setNewPosition({ name: "", department: "", access_level: "staff" });
      setShowPositionForm(false);
      toast({ title: "Success", description: "Position created successfully" });
    }
    setIsSavingPosition(false);
  };

  const handleChange = (field: string, value: string) => setFormData((prev) => ({ ...prev, [field]: value }));
  const departments = ["Service", "Sales", "Administration", "Parts", "Finance", "HR"];
  const accessLevels = [{ value: "staff", label: "Staff" }, { value: "manager", label: "Manager" }];

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Briefcase className="w-5 h-5" />{editingEmployee ? "Edit Employee" : "Create Employee User"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg mb-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="font-medium">Role is automatically assigned:</span>
              <span className="px-2 py-0.5 bg-primary text-white text-xs rounded">{config.role.toUpperCase()}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="name">Full Name *</Label><Input id="name" placeholder="Enter name" value={formData.name} onChange={(e) => handleChange("name", e.target.value)} disabled={isLoading} /></div>
            <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" type="tel" placeholder="Phone number" value={formData.phone} onChange={(e) => handleChange("phone", e.target.value)} disabled={isLoading} /></div>
            <div className="space-y-2"><Label htmlFor="email">Email *</Label><Input id="email" type="email" placeholder="Enter email" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} disabled={isLoading} /></div>
            <div className="space-y-2"><Label htmlFor="password">Password *</Label><Input id="password" type="password" placeholder="Min 6 characters" value={formData.password} onChange={(e) => handleChange("password", e.target.value)} disabled={isLoading} /></div>
            <div className="space-y-2"><Label>Position *</Label><div className="flex gap-2"><Select value={formData.position_id} onValueChange={(v) => handleChange("position_id", v)}><SelectTrigger className="flex-1"><SelectValue placeholder="Select position" /></SelectTrigger><SelectContent>{positions.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name} - {p.department}</SelectItem>))}</SelectContent></Select><Button type="button" variant="outline" size="icon" onClick={() => setShowPositionForm(!showPositionForm)}><Briefcase className="h-4 w-4" /></Button></div></div>
            <div className="space-y-2"><Label>Access Level *</Label><Select value={formData.access_level} onValueChange={(v: "admin" | "manager" | "staff") => handleChange("access_level", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{accessLevels.map((l) => (<SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>))}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Monthly Salary (₹)</Label><Input id="salary" type="number" placeholder="Salary" value={formData.salary} onChange={(e) => handleChange("salary", e.target.value)} disabled={isLoading} /></div>
          </div>
          {showPositionForm && (
            <div className="border rounded-lg p-4 bg-muted/50 space-y-4">
              <div className="flex items-center justify-between"><h4 className="font-medium">Create New Position</h4><Button type="button" variant="ghost" size="sm" onClick={() => setShowPositionForm(false)}><X className="h-4 w-4" /></Button></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Position Name *</Label><Input placeholder="e.g., Mechanic" value={newPosition.name} onChange={(e) => setNewPosition((p) => ({ ...p, name: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Department *</Label><Select value={newPosition.department} onValueChange={(v) => setNewPosition((p) => ({ ...p, department: v }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{departments.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Access Level</Label><Select value={newPosition.access_level} onValueChange={(v: "admin" | "manager" | "staff") => setNewPosition((p) => ({ ...p, access_level: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{accessLevels.map((l) => (<SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>))}</SelectContent></Select></div>
              </div>
              <Button type="button" onClick={handleAddPosition} disabled={isSavingPosition}>{isSavingPosition ? "Creating..." : "Create Position"}</Button>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>) : (<><UserPlus className="mr-2 h-4 w-4" />{editingEmployee ? "Update Employee" : "Create Employee"}</>)}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
