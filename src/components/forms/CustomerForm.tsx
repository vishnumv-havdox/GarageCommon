/**
 * Customer User Creation Form
 * Creates customer users with centralized user creation logic.
 * Role is AUTO-ASSIGNED to "customer" - no manual selection.
 * Creates: Auth user -> Role -> Profile -> Customer record
 */
import { useState, useEffect } from "react";
import { supabaseAdmin } from "@/integrations/supabase/adminClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  UserPlus,
  Users,
  CheckCircle2,
  Plus,
  Trash2,
  Star,
  Phone,
  Mail,
  Building2,
  MapPin,
  Lock,
  FileCheck,
  ShieldCheck,
  User,
  X
} from "lucide-react";
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
const COMMON_DESIGNATIONS = [
  "Owner",
  "Managing Director",
  "Manager",
  "Service Coordinator",
  "Accounts / Billing",
  "Fleet Supervisor",
  "Driver In-Charge"
];

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
      toast({ title: "Required Fields Missing", description: "Please complete all mandatory customer fields.", variant: "destructive" });
      return;
    }

    if (!initialData && formData.password.length < 6) {
      toast({ title: "Weak Password", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }

    if (formData.gst_number && !GST_REGEX.test(formData.gst_number)) {
      toast({
        title: "Invalid GSTIN Format",
        description: "Standard 15-character GST format: 22AAAAA0000A1Z5",
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
          description: phoneValidation.error || "Please enter a valid 10-digit Indian phone number.",
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
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            company_name: formData.company_name.trim() || null,
            address: formData.address.trim() || null,
            gst_number: formData.gst_number.trim() || null
          })
          .eq("id", initialData.id);

        if (error) throw error;
      } else {
        // Handle Create
        const result = await createUser(USER_TYPE, {
          email: formData.email.trim(),
          password: formData.password,
          fullName: formData.name.trim(),
          phone: formData.phone.trim() || undefined,
          companyName: formData.company_name.trim() || undefined,
          address: formData.address.trim() || undefined,
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
            await supabaseAdmin.from("customers").update({ gst_number: formData.gst_number.trim() }).eq("user_id", result.authUserId);
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
        description: initialData ? "Customer and contacts updated successfully" : "Customer and contacts registered successfully"
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

  const displayName = formData.company_name || formData.name;
  const initials = displayName
    ? displayName
        .split(" ")
        .map(n => n[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "CU";

  return (
    <div className="w-full bg-background rounded-2xl overflow-hidden border border-border shadow-xl">
      {/* Premium Header */}
      <div className="p-6 bg-gradient-to-r from-card via-card to-muted/40 border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-base shadow-sm">
            {displayName ? initials : <Building2 className="w-6 h-6 text-primary" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                {initialData ? "Edit Customer Profile" : "Register New Customer"}
              </h2>
              <Badge variant="secondary" className="text-[11px] font-semibold bg-primary/10 text-primary border-primary/20">
                <ShieldCheck className="w-3 h-3 mr-1" />
                {config.role.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {initialData
                ? "Update enterprise records, login credentials, and contact persons"
                : "Create customer profile, portal credentials, and designated fleet coordinators"}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCancel}
          disabled={isLoading}
          className="self-end sm:self-center h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Section 1: Company & Account Identity */}
        <div className="rounded-xl border border-border/80 bg-card/60 p-4 sm:p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-2 border-b border-border/60">
            <Building2 className="w-4 h-4 text-primary" />
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
              Company & Account Identity
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="company" className="text-xs font-semibold text-foreground/90">
                Company / Enterprise Name
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="company"
                  placeholder="e.g. SRM Logistics Pvt Ltd"
                  value={formData.company_name}
                  onChange={(e) => handleChange("company_name", e.target.value)}
                  disabled={isLoading}
                  className="pl-9 text-sm"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Leave blank if individual customer</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                <span>Primary Representative Name</span>
                <span className="text-[10px] text-destructive font-bold">Required</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="name"
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  disabled={isLoading}
                  className="pl-9 text-sm"
                  required
                />
              </div>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="address" className="text-xs font-semibold text-foreground/90">
                Registered Address / Garage Location
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <Textarea
                  id="address"
                  placeholder="Street address, industrial area, city, pincode..."
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  disabled={isLoading}
                  rows={2}
                  className="pl-9 text-sm resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Portal Login & Compliance */}
        <div className="rounded-xl border border-border/80 bg-card/60 p-4 sm:p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-2 border-b border-border/60">
            <Lock className="w-4 h-4 text-primary" />
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
              Portal Access & GST Compliance
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                <span>Primary Mobile Number</span>
                <span className="text-[10px] text-destructive font-bold">Required</span>
              </Label>
              <div className="flex rounded-md shadow-sm">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-xs font-semibold text-muted-foreground">
                  +91
                </span>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="10-digit mobile"
                  value={formData.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                    handleChange("phone", value);
                  }}
                  disabled={isLoading}
                  maxLength={10}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  className="rounded-l-none text-sm font-mono"
                  required
                />
              </div>
              {formData.phone && (
                <p className={`text-[11px] ${formData.phone.length === 10 && /^[6-9]/.test(formData.phone) ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
                  {formData.phone.length === 10 && /^[6-9]/.test(formData.phone)
                    ? "Valid 10-digit mobile format"
                    : `${formData.phone.length}/10 digits (must start with 6, 7, 8, or 9)`}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                <span>Email Address (Login Username)</span>
                <span className="text-[10px] text-destructive font-bold">Required</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="email"
                  type="email"
                  placeholder="contact@company.com"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  disabled={isLoading || !!initialData}
                  className="pl-9 text-sm"
                  required
                />
              </div>
              {initialData && (
                <p className="text-[10px] text-muted-foreground">Email login username cannot be altered after creation.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                <span>Login Password</span>
                <span className="text-[10px] font-medium text-muted-foreground">
                  {initialData ? "Leave blank to keep unchanged" : "Min 6 characters"}
                </span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="password"
                  type="password"
                  placeholder={initialData ? "••••••••" : "Enter secure password"}
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  disabled={isLoading}
                  className="pl-9 text-sm font-mono"
                  required={!initialData}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gst" className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                <span>GSTIN / Tax Number</span>
                <span className="text-[10px] text-muted-foreground">Optional</span>
              </Label>
              <div className="relative">
                <FileCheck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="gst"
                  placeholder="e.g. 22AAAAA0000A1Z5"
                  value={formData.gst_number}
                  onChange={(e) => handleChange("gst_number", e.target.value.toUpperCase())}
                  disabled={isLoading}
                  maxLength={15}
                  className={`pl-9 text-sm font-mono tracking-wider ${
                    formData.gst_number && !GST_REGEX.test(formData.gst_number)
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }`}
                />
              </div>
              {formData.gst_number && !GST_REGEX.test(formData.gst_number) ? (
                <p className="text-[11px] text-destructive font-medium">
                  Invalid GST format: Must be 15 chars (e.g. 22AAAAA0000A1Z5)
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">Enables automated GST tax invoices</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Multiple Contact Persons */}
        <div className="rounded-xl border border-border/80 bg-card/60 p-4 sm:p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
                  Designated Contact Persons
                </h3>
                <Badge variant="outline" className="text-[11px] font-semibold h-5">
                  {contacts.length}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Assign specific personnel for Service Updates, Billing, Workshop Coordination, or Driver In-Charge
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddContact}
              className="gap-1.5 text-xs font-semibold self-start sm:self-center border-primary/30 text-primary hover:bg-primary/10"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Contact Person
            </Button>
          </div>

          {contacts.length === 0 ? (
            <div className="border border-dashed rounded-xl p-6 text-center bg-muted/20">
              <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground mb-3">No contact persons registered yet.</p>
              <Button type="button" variant="outline" size="sm" onClick={handleAddContact}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Primary Contact
              </Button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {contacts.map((contact, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl border transition-all ${
                    contact.is_primary
                      ? "border-amber-400/60 bg-amber-50/20 dark:bg-amber-950/10 shadow-sm"
                      : "border-border/80 bg-background/80"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={contact.is_primary ? "default" : "secondary"}
                        className={`text-[11px] font-bold gap-1 ${
                          contact.is_primary
                            ? "bg-amber-500 hover:bg-amber-600 text-amber-950 border-amber-600/30"
                            : ""
                        }`}
                      >
                        {contact.is_primary && <Star className="h-3 w-3 fill-current" />}
                        {contact.is_primary ? "Primary Contact" : `Contact Person #${index + 1}`}
                      </Badge>
                      <Badge variant="outline" className="text-[11px] font-semibold text-foreground">
                        {contact.designation || "Contact"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      {!contact.is_primary && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-amber-600"
                          onClick={() => handleContactChange(index, "is_primary", true)}
                        >
                          <Star className="h-3 w-3 mr-1" />
                          Set Primary
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
                      <Label className="text-xs font-semibold">Full Name *</Label>
                      <Input
                        placeholder="e.g. Ramesh Kumar"
                        value={contact.name}
                        onChange={(e) => handleContactChange(index, "name", e.target.value)}
                        className="h-9 text-xs"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Role / Designation *</Label>
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
                      <Label className="text-xs font-semibold">Phone Number *</Label>
                      <Input
                        type="tel"
                        placeholder="10-digit number"
                        value={contact.phone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                          handleContactChange(index, "phone", val);
                        }}
                        className="h-9 text-xs font-mono"
                        maxLength={10}
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Preferred Channel</Label>
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
                      <Label className="text-xs font-semibold">Alternate Phone</Label>
                      <Input
                        type="tel"
                        placeholder="Secondary / Landline"
                        value={contact.alternate_phone || ""}
                        onChange={(e) => handleContactChange(index, "alternate_phone", e.target.value)}
                        className="h-9 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs font-semibold">Email Address</Label>
                      <Input
                        type="email"
                        placeholder="contact@company.com"
                        value={contact.email || ""}
                        onChange={(e) => handleContactChange(index, "email", e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Notes / Shift</Label>
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

        {/* Action Controls */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="w-full sm:w-auto text-xs font-semibold"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full sm:w-auto text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {initialData ? "Updating Customer..." : "Registering Customer..."}
              </>
            ) : (
              <>
                {initialData ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
                {initialData ? "Update Customer Profile" : "Register Customer & Contacts"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
