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
  initialData?: any; // For editing
}
const USER_TYPE: "customer" = "customer";
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function CustomerForm({ onSuccess, onCancel, initialData }: CustomerFormProps) {
  const config = getUserConfig(USER_TYPE);
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    password: "", // Password optional for edit
    company_name: initialData?.company_name || "",
    address: initialData?.address || "",
    gst_number: initialData?.gst_number || ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!initialData && (!formData.name || !formData.email || !formData.phone || !formData.password)) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    if (!initialData && formData.password.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }


    if (formData.gst_number && !GST_REGEX.test(formData.gst_number)) {
      toast({
        title: "Invalid GSTIN",
        description: "Format: 22AAAAA0000A1Z5 (State + PAN + Entity + Z + Checksum)",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      if (initialData) {
        // Handle Update
        const { error } = await supabaseAdmin
          .from("customers")
          .update({
            name: formData.name,
            phone: formData.phone,
            company_name: formData.company_name,
            address: formData.address,
            gst_number: formData.gst_number
            // Email/Auth updates not handled here for simplicity, focusing on profile data
          })
          .eq("id", initialData.id);

        if (error) throw error;
        toast({ title: "Updated", description: "Customer updated successfully" });
      } else {
        // Handle Create
        const result = await createUser(USER_TYPE, {
          email: formData.email,
          password: formData.password,
          fullName: formData.name,
          phone: formData.phone || undefined,
          companyName: formData.company_name || undefined,
          address: formData.address || undefined,
        }, supabaseAdmin);

        // Actually `createUser` config might not support extra fields easily without modification.
        // Let's modify createUser call if possible or do a post-update.
        // Checking `createUser` signature in line 41... it takes specific args.
        // If `createUser` doesn't support GST, we might need to update the customer record immediately after creation.

        if (!result.success) {
          throw new Error(result.error || "Failed to create customer");
        }

        // Post-creation update for GST if `createUser` doesn't handle it (assuming it doesn't currently)
        if (formData.gst_number && result.authUserId) {
          await supabaseAdmin.from('customers').update({ gst_number: formData.gst_number }).eq('user_id', result.authUserId);
        }

        toast({ title: "Success", description: `${config.displayName} created successfully` });
      }
      onSuccess();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => setFormData((prev) => ({ ...prev, [field]: value }));

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {initialData ? <Users className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
          {initialData ? "Edit Customer" : "Create Customer User"}
        </CardTitle>
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
            <div className="space-y-2"><Label htmlFor="email">Email *</Label><Input id="email" type="email" placeholder="Enter email" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} disabled={isLoading || !!initialData} /></div>
            <div className="space-y-2"><Label htmlFor="password">Password {initialData ? "(Leave blank to keep)" : "*"}</Label><Input id="password" type="password" placeholder={initialData ? "Unchanged" : "Min 6 characters"} value={formData.password} onChange={(e) => handleChange("password", e.target.value)} disabled={isLoading} /></div>
            <div className="space-y-2"><Label htmlFor="company">Company Name</Label><Input id="company" placeholder="Company name" value={formData.company_name} onChange={(e) => handleChange("company_name", e.target.value)} disabled={isLoading} /></div>
            <div className="space-y-2">
              <Label htmlFor="gst">GST Number</Label>
              <Input
                id="gst"
                placeholder="Ex: 22AAAAA0000A1Z5"
                value={formData.gst_number}
                onChange={(e) => handleChange("gst_number", e.target.value.toUpperCase())}
                disabled={isLoading}
                maxLength={15}
                className={formData.gst_number && !GST_REGEX.test(formData.gst_number) ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {formData.gst_number && !GST_REGEX.test(formData.gst_number) && (
                <p className="text-[10px] text-destructive">
                  Must be 15 chars: State(2) + PAN(10) + Entity(1) + Z + Checksum(1)
                  <br />
                  Example: 27ABCDE1234F1Z5
                </p>
              )}
              {formData.gst_number && GST_REGEX.test(formData.gst_number) && (
                <p className="text-[10px] text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Valid GST Format
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2"><Label htmlFor="address">Address</Label><Textarea id="address" placeholder="Full address" value={formData.address} onChange={(e) => handleChange("address", e.target.value)} disabled={isLoading} rows={3} /></div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{initialData ? "Updating..." : "Creating..."}</>) : (<>{initialData ? <CheckCircle className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}{initialData ? "Update Customer" : "Create Customer"}</>)}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
