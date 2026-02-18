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
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Briefcase, X, CheckCircle } from "lucide-react";
import { createUser, updateUser, getUserConfig } from "@/config/userCreation";
import { validateIndianPhoneNumber } from "@/lib/phoneValidation";

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
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    position_id: "",
    access_level: "staff",
    salary: "",
    pay_type: "monthly",
    address: "",
    joining_date: new Date().toISOString().split('T')[0],
    emergency_contact: "",
    aadhaar_number: "",
    pan_number: "",
    date_of_birth: "",
    blood_group: "",
    attendance_self_service: false
  });
  const [showPositionForm, setShowPositionForm] = useState(false);
  const [newPosition, setNewPosition] = useState({ name: "", department: "", access_level: "staff" });
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingPosition, setIsSavingPosition] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (editingEmployee) {
      setFormData({
        name: editingEmployee.name,
        email: editingEmployee.email,
        phone: editingEmployee.phone || "",
        password: "",
        position_id: editingEmployee.position_id,
        access_level: editingEmployee.access_level,
        salary: editingEmployee.salary?.toString() || "",
        pay_type: editingEmployee.pay_type || "monthly",
        address: editingEmployee.address || "",
        joining_date: editingEmployee.joining_date || new Date().toISOString().split('T')[0],
        emergency_contact: editingEmployee.emergency_contact || "",
        aadhaar_number: editingEmployee.aadhaar_number || "",
        pan_number: editingEmployee.pan_number || "",
        date_of_birth: editingEmployee.date_of_birth || "",
        blood_group: editingEmployee.blood_group || "",
        attendance_self_service: editingEmployee.attendance_self_service || false,
      });
    }
  }, [editingEmployee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate phone number if provided
    if (formData.phone) {
      const phoneValidation = validateIndianPhoneNumber(formData.phone);
      if (!phoneValidation.isValid) {
        toast({
          title: "Invalid Phone Number",
          description: phoneValidation.error || "Please enter a valid 10-digit Indian phone number",
          variant: "destructive"
        });
        return;
      }
    }

    setIsLoading(true);

    if (editingEmployee) {
      // Logic for UPDATING
      const result = await updateUser(USER_TYPE, editingEmployee.user_id, {
        email: formData.email,
        fullName: formData.name,
        phone: formData.phone || undefined,
        positionId: formData.position_id,
        accessLevel: formData.access_level as "admin" | "manager" | "staff",
        salary: formData.salary ? parseFloat(formData.salary) : undefined,
        address: formData.address,
        joiningDate: formData.joining_date,
        emergencyContact: formData.emergency_contact,
        aadhaarNumber: formData.aadhaar_number,
        panNumber: formData.pan_number,
        dateOfBirth: formData.date_of_birth,
        bloodGroup: formData.blood_group,
        payType: formData.pay_type,
        attendanceSelfService: formData.attendance_self_service,
      }, supabaseAdmin);

      if (!result.success) {
        toast({ title: "Error", description: result.error || "Failed to update employee", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      // Sync Salary Config on Update
      const { data: emp } = await supabase.from("employees").select("id").eq("user_id", editingEmployee.user_id).single();
      if (emp) {
        await supabase.from("employee_salary_configs").upsert({
          employee_id: emp.id,
          pay_type: formData.pay_type,
          base_amount: parseFloat(formData.salary) || 0,
          is_active: true
        }, { onConflict: 'employee_id' });
      }

      toast({ title: "Success", description: "Employee updated successfully" });
    } else {
      // Logic for CREATING
      if (!formData.password) {
        toast({ title: "Error", description: "Password is required for new employees", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      const result = await createUser(USER_TYPE, {
        email: formData.email,
        password: formData.password,
        fullName: formData.name,
        phone: formData.phone || undefined,
        positionId: formData.position_id,
        accessLevel: formData.access_level as "admin" | "manager" | "staff",
        salary: formData.salary ? parseFloat(formData.salary) : undefined,
        attendanceSelfService: formData.attendance_self_service,
      }, supabaseAdmin);

      if (!result.success) {
        toast({ title: "Error", description: result.error || "Failed to create employee", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      // Upsert Salary Config
      if (result.authUserId) {
        const { data: emp } = await supabase.from("employees").select("id").eq("user_id", result.authUserId).single();
        if (emp) {
          await supabase.from("employee_salary_configs").upsert({
            employee_id: emp.id,
            pay_type: formData.pay_type,
            base_amount: parseFloat(formData.salary) || 0,
            is_active: true
          });
        }
      }

      toast({ title: "Success", description: `${config.displayName} created successfully` });
    }
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

  const handleChange = (field: string, value: any) => setFormData((prev) => ({ ...prev, [field]: value }));
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
            <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" type="tel" placeholder="Phone number" value={formData.phone} onChange={(e) => { const value = e.target.value.replace(/\D/g, '').slice(0, 10); handleChange("phone", value); }} disabled={isLoading} maxLength={10} pattern="[0-9]*" inputMode="numeric" /></div>
            <div className="space-y-2"><Label htmlFor="email">Email *</Label><Input id="email" type="email" placeholder="Enter email" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} disabled={isLoading} /></div>
            <div className="space-y-2"><Label htmlFor="password">Password {editingEmployee ? "(Leave blank to keep same)" : "*"}</Label><Input id="password" type="password" placeholder="Min 6 characters" value={formData.password} onChange={(e) => handleChange("password", e.target.value)} disabled={isLoading} /></div>
            <div className="space-y-2"><Label>Position *</Label><div className="flex gap-2"><Select value={formData.position_id} onValueChange={(v) => handleChange("position_id", v)}><SelectTrigger className="flex-1"><SelectValue placeholder="Select position" /></SelectTrigger><SelectContent>{positions.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name} - {p.department}</SelectItem>))}</SelectContent></Select><Button type="button" variant="outline" size="icon" onClick={() => setShowPositionForm(!showPositionForm)}><Briefcase className="h-4 w-4" /></Button></div></div>
            <div className="space-y-2"><Label>Access Level *</Label><Select value={formData.access_level} onValueChange={(v: "admin" | "manager" | "staff") => handleChange("access_level", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{accessLevels.map((l) => (<SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>))}</SelectContent></Select></div>
            <div className="space-y-2">
              <Label>Base Pay (₹)</Label>
              <Input id="salary" type="number" placeholder="Amount" value={formData.salary} onChange={(e) => handleChange("salary", e.target.value)} disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label>Pay Type</Label>
              <Select value={formData.pay_type} onValueChange={(v) => handleChange("pay_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly Salary</SelectItem>
                  <SelectItem value="weekly">Weekly Wage</SelectItem>
                  <SelectItem value="daily">Daily Wage (Per Day)</SelectItem>
                  <SelectItem value="per-job">Per Job payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Joining Date *</Label><Input type="date" value={formData.joining_date} onChange={(e) => handleChange("joining_date", e.target.value)} disabled={isLoading} /></div>
            <div className="space-y-2"><Label>Emergency Contact</Label><Input placeholder="Name & Phone" value={formData.emergency_contact} onChange={(e) => handleChange("emergency_contact", e.target.value)} disabled={isLoading} /></div>
            <div className="space-y-2"><Label>Aadhaar Number</Label><Input placeholder="12-digit Aadhaar" value={formData.aadhaar_number} onChange={(e) => handleChange("aadhaar_number", e.target.value)} disabled={isLoading} /></div>
            <div className="space-y-2"><Label>PAN Number</Label><Input placeholder="PAN" value={formData.pan_number} onChange={(e) => handleChange("pan_number", e.target.value)} disabled={isLoading} /></div>
            <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={formData.date_of_birth} onChange={(e) => handleChange("date_of_birth", e.target.value)} disabled={isLoading} /></div>
            <div className="space-y-2"><Label>Blood Group</Label><Input placeholder="e.g., A+ve" value={formData.blood_group} onChange={(e) => handleChange("blood_group", e.target.value)} disabled={isLoading} /></div>
            <div className="md:col-span-2 space-y-2"><Label>Address</Label><Input placeholder="Full residential address" value={formData.address} onChange={(e) => handleChange("address", e.target.value)} disabled={isLoading} /></div>
            <div className="md:col-span-2 flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="space-y-0.5">
                <Label>Attendance Self-Service</Label>
                <p className="text-xs text-muted-foreground">Allow employee to clock in/out and request leaves from their dashboard.</p>
              </div>
              <Switch
                checked={formData.attendance_self_service}
                onCheckedChange={(checked) => handleChange("attendance_self_service", checked)}
                disabled={isLoading}
              />
            </div>
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
