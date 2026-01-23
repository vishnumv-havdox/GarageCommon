/**
 * Customer User Creation Form
 * Creates customer users with centralized user creation logic.
 * Role is AUTO-ASSIGNED to "customer" - no manual selection.
 * Creates: Auth user → Role → Profile → Customer record
 */
import { useState } from "react";
import { supabaseAdmin } from "@/integrations/supabase/adminClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Users, CheckCircle } from "lucide-react";
import { createUser, getUserConfig } from "@/config/userCreation";

interface CustomerFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}
const USER_TYPE: "customer" = "customer";

export function CustomerForm({ onSuccess, onCancel }: CustomerFormProps) {
  const config = getUserConfig(USER_TYPE);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", password: "", company_name: "", address: "" });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone || !formData.password) {
      toast({ title: "Error", description: "Please fill in all required fields (password is required for login)", variant: "destructive" });
      return;
    }
    if (formData.password.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const result = await createUser(USER_TYPE, {
      email: formData.email, password: formData.password, fullName: formData.name, phone: formData.phone || undefined, companyName: formData.company_name || undefined, address: formData.address || undefined,
    }, supabaseAdmin);
    if (!result.success) {
      toast({ title: "Error", description: result.error || "Failed to create customer", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    toast({ title: "Success", description: `${config.displayName} created successfully with ${config.role} role` });
    onSuccess();
  };

  const handleChange = (field: string, value: string) => setFormData((prev) => ({ ...prev, [field]: value }));

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />Create Customer User</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg mb-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="font-medium">Role is automatically assigned:</span>
              <span className="px-2 py-0.5 bg-secondary text-white text-xs rounded">{config.role.toUpperCase()}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="name">Customer Name *</Label><Input id="name" placeholder="Enter name" value={formData.name} onChange={(e) => handleChange("name", e.target.value)} disabled={isLoading} /></div>
            <div className="space-y-2"><Label htmlFor="phone">Phone Number *</Label><Input id="phone" type="tel" placeholder="Phone number" value={formData.phone} onChange={(e) => handleChange("phone", e.target.value)} disabled={isLoading} /></div>
            <div className="space-y-2"><Label htmlFor="email">Email *</Label><Input id="email" type="email" placeholder="Enter email" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} disabled={isLoading} /></div>
            <div className="space-y-2"><Label htmlFor="password">Password *</Label><Input id="password" type="password" placeholder="Min 6 characters" value={formData.password} onChange={(e) => handleChange("password", e.target.value)} disabled={isLoading} /></div>
            <div className="space-y-2"><Label htmlFor="company">Company Name</Label><Input id="company" placeholder="Company name" value={formData.company_name} onChange={(e) => handleChange("company_name", e.target.value)} disabled={isLoading} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="address">Address</Label><Textarea id="address" placeholder="Full address" value={formData.address} onChange={(e) => handleChange("address", e.target.value)} disabled={isLoading} rows={3} /></div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>) : (<><UserPlus className="mr-2 h-4 w-4" />Create Customer</>)}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
