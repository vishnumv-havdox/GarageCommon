/**
 * Admin User Creation Form
 * Creates ONLY admin users with centralized user creation logic.
 * Role is AUTO-ASSIGNED to "admin" - no manual selection.
 */
import { useState } from "react";
import { supabaseAdmin } from "@/integrations/supabase/adminClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Shield, CheckCircle } from "lucide-react";
import { createUser, getUserConfig } from "@/config/userCreation";
import { validateIndianPhoneNumber } from "@/lib/phoneValidation";

interface UserFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}
const USER_TYPE: "admin" = "admin";

export function UserForm({ onSuccess, onCancel }: UserFormProps) {
  const config = getUserConfig(USER_TYPE);
  const [formData, setFormData] = useState({ email: "", password: "", fullName: "", phone: "" });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.fullName) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (formData.password.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

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
    const result = await createUser(USER_TYPE, {
      email: formData.email, password: formData.password, fullName: formData.fullName, phone: formData.phone || undefined,
    }, supabaseAdmin);
    if (!result.success) {
      toast({ title: "Error", description: result.error || "Failed to create user", variant: "destructive" });
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
        <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-destructive" />Create Admin User</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg mb-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="font-medium">Role is automatically assigned:</span>
              <span className="px-2 py-0.5 bg-destructive text-white text-xs rounded">{config.role.toUpperCase()}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="fullName">Full Name *</Label><Input id="fullName" placeholder="Enter full name" value={formData.fullName} onChange={(e) => handleChange("fullName", e.target.value)} disabled={isLoading} /></div>
            <div className="space-y-2"><Label htmlFor="phone">Phone Number</Label><Input id="phone" type="tel" placeholder="Phone number" value={formData.phone} onChange={(e) => { const value = e.target.value.replace(/\D/g, '').slice(0, 10); handleChange("phone", value); }} disabled={isLoading} maxLength={10} pattern="[0-9]*" inputMode="numeric" /></div>
            <div className="space-y-2"><Label htmlFor="email">Email *</Label><Input id="email" type="email" placeholder="Enter email address" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} disabled={isLoading} /></div>
            <div className="space-y-2"><Label htmlFor="password">Password *</Label><Input id="password" type="password" placeholder="Min 6 characters" value={formData.password} onChange={(e) => handleChange("password", e.target.value)} disabled={isLoading} /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating Admin...</>) : (<><UserPlus className="mr-2 h-4 w-4" />Create Admin</>)}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
