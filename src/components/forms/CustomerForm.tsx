/**
 * Customer User Creation Form
 * Creates customer users with centralized user creation logic.
 * Role is AUTO-ASSIGNED to "customer" - no manual selection.
 * Creates: Auth user → Role → Profile → Customer record
 */
import { useState, useEffect } from "react";
import { supabaseAdmin } from "@/integrations/supabase/adminClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Users, CheckCircle, Plus, Trash2, Star, Phone, Mail, ShieldAlert } from "lucide-react";
import { createUser, getUserConfig } from "@/config/userCreation";
import { validateIndianPhoneNumber } from "@/lib/phoneValidation";

export interface ContactPerson {
  id?: string;
  name: string;
  designation: string;
  phone: string;
  alternate_phone?: string;
  email?: string;
  notes?: string;
  preferred_contact_method: "phone" | "whatsapp" | "email";
  is_primary: boolean;
}

interface CustomerFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: any; // For editing
}
const USER_TYPE: "customer" = "customer";
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const COMMON_DESIGNATIONS = ["Owner", "Manager", "Service Coordinator", "Accounts", "Fleet Supervisor", "Driver In-Charge"];

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

  const [contacts, setContacts] = useState<ContactPerson[]>([]);
  const [deletedContactIds, setDeletedContactIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (initialData?.id) {
      supabaseAdmin
        .from("customer_contacts")
        .select("*")
        .eq("customer_id", initialData.id)
        .order("is_primary", { ascending: false })
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            setContacts(data as ContactPerson[]);
          } else {
            // Default to 1 primary contact based on customer details
            setContacts([
              {
                name: initialData.name || "",
                designation: "Owner",
                phone: initialData.phone || "",
                alternate_phone: "",
                email: initialData.email || "",
                notes: "",
                preferred_contact_method: "phone",
                is_primary: true
              }
            ]);
          }
        });
    } else {
      // New customer: start with 1 primary contact row
      setContacts([
        {
          name: "",
          designation: "Owner",
          phone: "",
          alternate_phone: "",
          email: "",
          notes: "",
          preferred_contact_method: "phone",
          is_primary: true
        }
      ]);
    }
  }, [initialData]);

  const handleAddContact = () => {
    setContacts(prev => [
      ...prev,
      {
        name: "",
        designation: "Manager",
        phone: "",
        alternate_phone: "",
        email: "",
        notes: "",
        preferred_contact_method: "phone",
        is_primary: prev.length === 0
      }
    ]);
  };

  const handleRemoveContact = (index: number) => {
    const contact = contacts[index];
    if (contact.id) {
      setDeletedContactIds(prev => [...prev, contact.id!]);
    }
    const updated = contacts.filter((_, idx) => idx !== index);
    if (contact.is_primary && updated.length > 0) {
      updated[0].is_primary = true;
    }
    setContacts(updated);
  };

  const handleContactChange = (index: number, field: keyof ContactPerson, value: any) => {
    setContacts(prev => {
      const updated = [...prev];
      if (field === "is_primary" && value === true) {
        // Only one contact can be primary
        updated.forEach((c, idx) => {
          c.is_primary = idx === index;
        });
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!initialData && (!formData.name || !formData.email || !formData.phone || !formData.password)) {
      toast({ title: "Error", description: "Please fill in all required customer fields", variant: "destructive" });
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

    // Validate phone number format
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

    // Validate contacts
    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      if (c.name.trim() && c.phone.trim()) {
        const cPhoneVal = validateIndianPhoneNumber(c.phone);
        if (!cPhoneVal.isValid) {
          toast({
            title: `Contact #${i + 1} Invalid Phone`,
            description: `${c.name}: ${cPhoneVal.error || "Invalid 10-digit phone number"}`,
            variant: "destructive"
          });
          return;
        }
      }
    }

    setIsLoading(true);

    try {
      let customerId = initialData?.id;

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
          })
          .eq("id", initialData.id);

        if (error) throw error;
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

        if (!result.success) {
          throw new Error(result.error || "Failed to create customer");
        }

        // Fetch newly created customer id
        if (result.authUserId) {
          const { data: custRec } = await supabaseAdmin
            .from("customers")
            .select("id")
            .eq("user_id", result.authUserId)
            .single();

          if (custRec) {
            customerId = custRec.id;
          }

          if (formData.gst_number) {
            await supabaseAdmin.from("customers").update({ gst_number: formData.gst_number }).eq("user_id", result.authUserId);
          }
        }
      }

      // Handle Contacts Persistence
      if (customerId) {
        // Delete removed contacts
        if (deletedContactIds.length > 0) {
          await supabaseAdmin
            .from("customer_contacts")
            .delete()
            .in("id", deletedContactIds);
        }

        // Upsert contacts
        const validContacts = contacts.filter(c => c.name.trim() && c.phone.trim());
        for (const contact of validContacts) {
          const contactPayload = {
            customer_id: customerId,
            name: contact.name.trim(),
            designation: contact.designation?.trim() || "Contact",
            phone: contact.phone.trim(),
            alternate_phone: contact.alternate_phone?.trim() || null,
            email: contact.email?.trim() || null,
            notes: contact.notes?.trim() || null,
            preferred_contact_method: contact.preferred_contact_method || "phone",
            is_primary: contact.is_primary || false
          };

          if (contact.id) {
            await supabaseAdmin
              .from("customer_contacts")
              .update(contactPayload)
              .eq("id", contact.id);
          } else {
            await supabaseAdmin
              .from("customer_contacts")
              .insert([contactPayload]);
          }
        }
      }

      toast({
        title: "Success",
        description: initialData ? "Customer and contacts updated successfully" : "Customer and contacts created successfully"
      });

      onSuccess();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Keep primary contact in sync if it's new
      if (contacts.length === 1 && !initialData) {
        if (field === "name") setContacts(c => [{ ...c[0], name: value }]);
        if (field === "phone") setContacts(c => [{ ...c[0], phone: value }]);
        if (field === "email") setContacts(c => [{ ...c[0], email: value }]);
      }
      return updated;
    });
  };

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {initialData ? <Users className="w-5 h-5 text-primary" /> : <UserPlus className="w-5 h-5 text-primary" />}
          {initialData ? "Edit Customer / Company Profile" : "Register New Customer & Contacts"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-muted/50 p-3.5 rounded-xl">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="font-medium">Role is automatically assigned:</span>
              <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded font-bold">{config.role.toUpperCase()}</span>
            </div>
          </div>

          {/* Company / Customer Details */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Company & Account Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="company">Company / Enterprise Name</Label>
                <Input id="company" placeholder="e.g. SRM Logistics Pvt Ltd" value={formData.company_name} onChange={(e) => handleChange("company_name", e.target.value)} disabled={isLoading} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Primary Representative Name *</Label>
                <Input id="name" placeholder="Contact person name" value={formData.name} onChange={(e) => handleChange("name", e.target.value)} disabled={isLoading} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Primary Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={formData.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                    handleChange("phone", value);
                  }}
                  disabled={isLoading}
                  maxLength={10}
                  pattern="[0-9]*"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address *</Label>
                <Input id="email" type="email" placeholder="contact@example.com" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} disabled={isLoading || !!initialData} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Login Password {initialData ? "(Leave blank to keep current)" : "*"}</Label>
                <Input id="password" type="password" placeholder={initialData ? "Unchanged" : "Min 6 characters"} value={formData.password} onChange={(e) => handleChange("password", e.target.value)} disabled={isLoading} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gst">GST Number (Optional)</Label>
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
                  </p>
                )}
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" placeholder="Registered office / garage address" value={formData.address} onChange={(e) => handleChange("address", e.target.value)} disabled={isLoading} rows={2} />
              </div>
            </div>
          </div>

          {/* Multiple Company Contacts Section */}
          <div className="border-t pt-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Multiple Company Contact Persons ({contacts.length})
                </h4>
                <p className="text-xs text-muted-foreground">
                  Add designated contacts for Service Coordination, Billing/Accounts, Management, etc.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddContact} className="gap-1 text-xs font-semibold">
                <Plus className="h-3.5 w-3.5" />
                Add Contact Person
              </Button>
            </div>

            {contacts.length === 0 ? (
              <div className="border border-dashed rounded-lg p-6 text-center bg-muted/20">
                <p className="text-xs text-muted-foreground mb-2">No contact persons added yet.</p>
                <Button type="button" variant="outline" size="sm" onClick={handleAddContact}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Primary Contact
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-xl border transition-all ${
                      contact.is_primary ? "border-primary/50 bg-primary/[0.02] shadow-sm" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3 pb-2 border-b">
                      <div className="flex items-center gap-2">
                        <Badge variant={contact.is_primary ? "default" : "secondary"} className="text-[11px] gap-1">
                          {contact.is_primary && <Star className="h-3 w-3 fill-current" />}
                          {contact.is_primary ? "Primary Contact" : `Contact Person #${index + 1}`}
                        </Badge>
                        <span className="text-xs font-bold text-foreground">
                          {contact.designation || "Designation"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!contact.is_primary && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-primary"
                            onClick={() => handleContactChange(index, "is_primary", true)}
                          >
                            Set as Primary
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveContact(index)}
                          title="Remove contact"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Full Name *</Label>
                        <Input
                          placeholder="e.g. Ramesh Kumar"
                          value={contact.name}
                          onChange={(e) => handleContactChange(index, "name", e.target.value)}
                          className="h-9 text-xs"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Role / Designation *</Label>
                        <Input
                          placeholder="Owner, Manager, etc."
                          value={contact.designation}
                          onChange={(e) => handleContactChange(index, "designation", e.target.value)}
                          className="h-9 text-xs"
                          list={`designations-${index}`}
                        />
                        <datalist id={`designations-${index}`}>
                          {COMMON_DESIGNATIONS.map((d) => (
                            <option key={d} value={d} />
                          ))}
                        </datalist>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Phone Number *</Label>
                        <Input
                          type="tel"
                          placeholder="10-digit number"
                          value={contact.phone}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                            handleContactChange(index, "phone", val);
                          }}
                          className="h-9 text-xs"
                          maxLength={10}
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Preferred Method</Label>
                        <Select
                          value={contact.preferred_contact_method || "phone"}
                          onValueChange={(val: any) => handleContactChange(index, "preferred_contact_method", val)}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="phone">Phone Call</SelectItem>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Alternate Phone</Label>
                        <Input
                          type="tel"
                          placeholder="Landline / Alt"
                          value={contact.alternate_phone || ""}
                          onChange={(e) => handleContactChange(index, "alternate_phone", e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">Email Address</Label>
                        <Input
                          type="email"
                          placeholder="person@company.com"
                          value={contact.email || ""}
                          onChange={(e) => handleContactChange(index, "email", e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Notes / Availability</Label>
                        <Input
                          placeholder="e.g. Call after 2 PM"
                          value={contact.notes || ""}
                          onChange={(e) => handleContactChange(index, "notes", e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {initialData ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>
                  {initialData ? <CheckCircle className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  {initialData ? "Update Customer & Contacts" : "Create Customer & Contacts"}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

