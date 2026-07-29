import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/adminClient";
import { updateUser } from "@/config/userCreation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Building2, FileText, Settings as SettingsIcon, QrCode, Trash2, Clock, Shield, Users, User, Key, Upload, Plus, Edit, Check } from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

export default function Settings() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState("profile");

    // Data States
    const [profile, setProfile] = useState<any>({});
    const [workSlipSettings, setWorkSlipSettings] = useState<any>({});
    const [invoiceSettings, setInvoiceSettings] = useState<any>({});
    const [workforceSettings, setWorkforceSettings] = useState<any>({});

    // Digital Signatures states
    const [sigUsername, setSigUsername] = useState("");
    const [sigRole, setSigRole] = useState("Owner");
    const [sigIsDefault, setSigIsDefault] = useState(false);
    const [sigUploadFile, setSigUploadFile] = useState<File | null>(null);

    // User management states
    const [usersList, setUsersList] = useState<any[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [isEditUserOpen, setIsEditUserOpen] = useState(false);

    // Editing user form states
    const [editFullName, setEditFullName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editRole, setEditRole] = useState("");
    const [editPassword, setEditPassword] = useState("");

    useEffect(() => {
        if (activeTab === "users") {
            fetchUsers();
        }
    }, [activeTab]);
    
    const [tallyLedgers, setTallyLedgers] = useState({
        salesLedger: localStorage.getItem("tally_sales_ledger") || "Sales Account",
        cgstLedger: localStorage.getItem("tally_cgst_ledger") || "CGST",
        sgstLedger: localStorage.getItem("tally_sgst_ledger") || "SGST",
        igstLedger: localStorage.getItem("tally_igst_ledger") || "IGST",
        roundOffLedger: localStorage.getItem("tally_round_off_ledger") || "Round Off",
        bankLedger: localStorage.getItem("tally_bank_ledger") || "Bank A/c",
    });



    useEffect(() => {
        fetchSettings();
        fetchUsers();
        const params = new URLSearchParams(window.location.search);
        const tab = params.get("tab");
        if (tab) {
            setActiveTab(tab);
        }
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            // Fetch Company Profile
            const { data: profileData, error: profileError } = await supabase
                .from('company_profiles')
                .select('*')
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle(); // Use maybeSingle to avoid error if empty

            if (profileError && profileError.code !== 'PGRST116') throw profileError;

            // Fetch Document Settings
            const { data: settingsData, error: settingsError } = await supabase
                .from('document_settings')
                .select('*');

            if (settingsError) throw settingsError;

            if (profileData) setProfile(profileData);

            if (settingsData) {
                setWorkSlipSettings(settingsData.find((s: any) => s.doc_type === 'work_slip') || { doc_type: 'work_slip' });
                setInvoiceSettings(settingsData.find((s: any) => s.doc_type === 'invoice') || { doc_type: 'invoice' });
            }

            // Fetch Workforce Settings
            const { data: workforceData, error: workforceError } = await supabase
                .from('workforce_settings')
                .select('*')
                .eq('is_active', true)
                .maybeSingle();

            if (workforceError) throw workforceError;
            if (workforceData) setWorkforceSettings(workforceData);
            else setWorkforceSettings({
                standard_start_time: '09:00:00',
                standard_end_time: '18:00:00',
                late_threshold_mins: 15,
                standard_daily_hours: 8
            });
        } catch (error: any) {
            console.error("Error fetching settings:", error);
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            const payload = { ...profile };
            delete payload.id; // Let DB handle ID or don't update key
            delete payload.created_at;
            delete payload.updated_at;

            // Upsert
            // Singleton Pattern: Check if ANY profile exists
            const { data: existing } = await supabase
                .from('company_profiles')
                .select('id')
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (existing && (existing as any).id) {
                // Update existing
                await supabase.from('company_profiles').update(payload).eq('id', (existing as any).id);
            } else {
                // Insert new
                await supabase.from('company_profiles').insert(payload);
            }

            toast({ title: "Saved", description: "Company profile updated." });
            fetchSettings(); // Refresh
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const saveProfileDirect = async (updatedProfile: any) => {
        setSaving(true);
        try {
            const payload = { ...updatedProfile };
            const profileId = payload.id;
            delete payload.id;
            delete payload.created_at;
            delete payload.updated_at;

            if (profileId) {
                const { error } = await supabase.from('company_profiles').update(payload).eq('id', profileId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('company_profiles').insert(payload).select().single();
                if (error) throw error;
                if (data) updatedProfile = data;
            }
            setProfile(updatedProfile);
            toast({ title: "Signatures Updated", description: "Digital signature settings have been saved successfully." });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error saving signatures", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleAddSignature = async () => {
        if (!sigUsername.trim()) {
            toast({ variant: "destructive", title: "Validation Error", description: "Username is required." });
            return;
        }
        if (!sigUploadFile) {
            toast({ variant: "destructive", title: "Validation Error", description: "Please upload a signature image file." });
            return;
        }

        setSaving(true);
        try {
            const file = sigUploadFile;
            const fileExt = file.name.split('.').pop();
            const fileName = `sig-${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('public-assets')
                .upload(fileName, file);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('public-assets')
                .getPublicUrl(fileName);

            const currentSignatures = profile.bank_details?.signatures || [];
            const newSig = {
                id: `sig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                username: sigUsername,
                role: sigRole,
                signature_url: publicUrl,
                is_default: sigIsDefault
            };

            let updatedSignatures = [...currentSignatures];
            if (sigIsDefault) {
                updatedSignatures = updatedSignatures.map((s: any) => ({ ...s, is_default: false }));
            }
            updatedSignatures.push(newSig);

            const updatedProfile = {
                ...profile,
                bank_details: {
                    ...(profile.bank_details || {}),
                    signatures: updatedSignatures
                }
            };

            await saveProfileDirect(updatedProfile);
            
            // Clear inputs
            setSigUsername("");
            setSigRole("Owner");
            setSigIsDefault(false);
            setSigUploadFile(null);
            
            // Reset the file input element manually
            const fileInput = document.getElementById('signature-file-input') as HTMLInputElement;
            if (fileInput) fileInput.value = "";
        } catch (error: any) {
            toast({ variant: "destructive", title: "Upload Failed", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSignature = async (id: string) => {
        const currentSignatures = profile.bank_details?.signatures || [];
        const updatedSignatures = currentSignatures.filter((s: any) => s.id !== id);

        const updatedProfile = {
            ...profile,
            bank_details: {
                ...(profile.bank_details || {}),
                signatures: updatedSignatures
            }
        };

        await saveProfileDirect(updatedProfile);
    };

    const handleSetDefaultSignature = async (id: string) => {
        const currentSignatures = profile.bank_details?.signatures || [];
        const updatedSignatures = currentSignatures.map((s: any) => ({
            ...s,
            is_default: s.id === id
        }));

        const updatedProfile = {
            ...profile,
            bank_details: {
                ...(profile.bank_details || {}),
                signatures: updatedSignatures
            }
        };

        await saveProfileDirect(updatedProfile);
    };

    const fetchUsers = async () => {
        setUsersLoading(true);
        try {
            const { data: rolesData, error: rolesError } = await (supabase.from("user_roles").select("user_id, role") as any);
            if (rolesError) throw rolesError;

            const { data: profilesData, error: profilesError } = await (supabase.from("profiles").select("*") as any);
            if (profilesError) throw profilesError;

            const mappedUsers = (profilesData || []).map((p: any) => {
                const roleObj = rolesData?.find((r: any) => r.user_id === p.id);
                return {
                    id: p.id,
                    email: p.email,
                    fullName: p.full_name,
                    phone: p.phone || "",
                    role: roleObj?.role || 'staff'
                };
            });
            setUsersList(mappedUsers);
        } catch (error: any) {
            console.error("Error fetching users:", error);
            toast({ variant: "destructive", title: "Fetch Failed", description: error.message });
        } finally {
            setUsersLoading(false);
        }
    };

    const handleOpenEditUser = (usr: any) => {
        setEditingUser(usr);
        setEditFullName(usr.fullName || "");
        setEditEmail(usr.email || "");
        setEditPhone(usr.phone || "");
        setEditRole(usr.role || "staff");
        setEditPassword("");
        setIsEditUserOpen(true);
    };

    const handleUpdateUser = async () => {
        if (!editFullName.trim() || !editEmail.trim()) {
            toast({ variant: "destructive", title: "Validation Error", description: "Name and Email are required." });
            return;
        }

        setSaving(true);
        try {
            let userType: any = "employee";
            if (editRole === "admin") userType = "admin";
            else if (editRole === "customer") userType = "customer";

            const res = await updateUser(
                userType,
                editingUser.id,
                {
                    email: editEmail,
                    fullName: editFullName,
                    phone: editPhone || undefined,
                    password: editPassword.trim() ? editPassword : undefined
                },
                supabaseAdmin
            );

            if (!res.success) throw new Error(res.error);

            // Update role in user_roles table
            const { error: roleError } = await (supabase.from("user_roles") as any)
                .upsert({ user_id: editingUser.id, role: editRole }, { onConflict: 'user_id' });
            if (roleError) throw roleError;

            toast({ title: "User Updated", description: "User credentials and details have been successfully updated." });
            setIsEditUserOpen(false);
            fetchUsers();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Update Failed", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveDocSettings = async (type: 'work_slip' | 'invoice') => {
        setSaving(true);
        try {
            const settings = type === 'work_slip' ? workSlipSettings : invoiceSettings;
            const payload = { ...settings, doc_type: type };
            delete payload.id;
            delete payload.created_at;
            delete payload.updated_at;

            if (settings.id) {
                await supabase.from('document_settings').update(payload as any).eq('id', settings.id);
            } else {
                await supabase.from('document_settings').insert(payload as any);
            }

            toast({ title: "Saved", description: `${type === 'work_slip' ? 'Work Slip' : 'Invoice'} settings updated.` });
            fetchSettings();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveWorkforce = async () => {
        setSaving(true);
        try {
            const payload = { ...workforceSettings, is_active: true };
            const id = payload.id;
            delete payload.id;
            delete payload.created_at;
            delete payload.updated_at;

            if (id) {
                const { error } = await supabase.from('workforce_settings').update(payload as any).eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('workforce_settings').insert(payload as any);
                if (error) throw error;
            }

            toast({ title: "Saved", description: "Workforce settings updated." });
            fetchSettings();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveTallySettings = () => {
        localStorage.setItem("tally_sales_ledger", tallyLedgers.salesLedger);
        localStorage.setItem("tally_cgst_ledger", tallyLedgers.cgstLedger);
        localStorage.setItem("tally_sgst_ledger", tallyLedgers.sgstLedger);
        localStorage.setItem("tally_igst_ledger", tallyLedgers.igstLedger);
        localStorage.setItem("tally_round_off_ledger", tallyLedgers.roundOffLedger);
        localStorage.setItem("tally_bank_ledger", tallyLedgers.bankLedger);
        toast({
            title: "Saved",
            description: "Tally ledger settings updated successfully."
        });
    };

    if (loading) return <div className="flex h-screen items-center justify-center">Loading settings...</div>;

    return (
        <div className="min-h-screen bg-background">
            <div className="flex flex-col lg:flex-row">
                <AdminSidebar />
                <main className="flex-1 p-4 lg:p-8 space-y-8">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <SettingsIcon className="h-8 w-8 text-primary" />
                            Configuration
                        </h1>
                        <p className="text-muted-foreground">Manage company details and document templates</p>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="profile">Company Profile</TabsTrigger>
                            <TabsTrigger value="users">User Management</TabsTrigger>
                            <TabsTrigger value="signatures">Digital Signatures</TabsTrigger>
                            <TabsTrigger value="workforce">Workforce</TabsTrigger>
                            <TabsTrigger value="workslip">Work Slip Config</TabsTrigger>
                            <TabsTrigger value="invoice">Invoice Config</TabsTrigger>
                            <TabsTrigger value="payment">Payment Config</TabsTrigger>
                            <TabsTrigger value="tally">Tally Config</TabsTrigger>
                        </TabsList>

                        {/* Company Profile Tab */}
                        <TabsContent value="profile">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Building2 className="h-5 w-5" /> Company Details
                                    </CardTitle>
                                    <CardDescription>This information will appear on all generated documents.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Company Name</Label>
                                            <Input
                                                value={profile.company_name || ''}
                                                onChange={e => setProfile({ ...profile, company_name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Phone</Label>
                                            <Input
                                                value={profile.phone || ''}
                                                onChange={e => setProfile({ ...profile, phone: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Owner Name</Label>
                                            <Input
                                                value={profile.owner_name || ''}
                                                onChange={e => setProfile({ ...profile, owner_name: e.target.value })}
                                                placeholder="e.g. John Doe"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Owner Phone</Label>
                                            <Input
                                                value={profile.owner_phone || ''}
                                                onChange={e => setProfile({ ...profile, owner_phone: e.target.value })}
                                                placeholder="e.g. +91 98765 43210"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Email</Label>
                                            <Input
                                                value={profile.email || ''}
                                                onChange={e => setProfile({ ...profile, email: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Website</Label>
                                            <Input
                                                value={profile.website || ''}
                                                onChange={e => setProfile({ ...profile, website: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <Label>Address</Label>
                                            <Textarea
                                                value={profile.address || ''}
                                                onChange={e => setProfile({ ...profile, address: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Tax ID (GSTIN)</Label>
                                            <Input
                                                value={profile.tax_id || ''}
                                                onChange={e => setProfile({ ...profile, tax_id: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-4 md:col-span-2">
                                        <Label>Company Logo</Label>
                                        <div className="flex items-center gap-6 p-4 border rounded-lg bg-muted/50">
                                            {profile.logo_url ? (
                                                <img
                                                    src={profile.logo_url}
                                                    alt="Logo Preview"
                                                    className="h-20 w-20 object-contain rounded border bg-white"
                                                />
                                            ) : (
                                                <div className="h-20 w-20 flex items-center justify-center border-2 border-dashed rounded bg-muted">
                                                    <Building2 className="h-8 w-8 text-muted-foreground/50" />
                                                </div>
                                            )}
                                            <div className="flex-1 space-y-2">
                                                <Input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        setSaving(true);
                                                        try {
                                                            const fileExt = file.name.split('.').pop();
                                                            const fileName = `logo-${Date.now()}.${fileExt}`;
                                                            const { error: uploadError } = await supabase.storage
                                                                .from('public-assets')
                                                                .upload(fileName, file);
                                                            if (uploadError) throw uploadError;
                                                            const { data: { publicUrl } } = supabase.storage
                                                                .from('public-assets')
                                                                .getPublicUrl(fileName);
                                                            setProfile({ ...profile, logo_url: publicUrl });
                                                            toast({ title: "Logo Uploaded", description: "Remember to save your profile." });
                                                        } catch (error: any) {
                                                            toast({ variant: "destructive", title: "Upload Failed", description: error.message });
                                                        } finally {
                                                            setSaving(false);
                                                        }
                                                    }}
                                                />
                                                <p className="text-[10px] text-muted-foreground">Recommended: Square PNG with transparent background.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <Button onClick={handleSaveProfile} disabled={saving} className="mt-4">
                                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Profile
                                    </Button>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Digital Signatures Tab */}
                        <TabsContent value="signatures">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Upload Signature Form */}
                                <Card className="lg:col-span-1 border bg-card/60 backdrop-blur shadow-sm">
                                    <CardHeader>
                                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                                            <Upload className="h-5 w-5 text-primary animate-pulse" />
                                            Add Signature
                                        </CardTitle>
                                        <CardDescription>Upload a digital signature to associate with a user and role.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="sig-username">Select User (Employee / Owner)</Label>
                                            <Select
                                                value={sigUsername}
                                                onValueChange={(val) => {
                                                    setSigUsername(val);
                                                    const matchedUser = usersList.find(u => (u.fullName || u.email) === val);
                                                    if (matchedUser) {
                                                        const r = matchedUser.role;
                                                        if (r === 'admin') setSigRole('Owner');
                                                        else if (r === 'staff') setSigRole('Staff');
                                                        else setSigRole(r.charAt(0).toUpperCase() + r.slice(1));
                                                    }
                                                }}
                                            >
                                                <SelectTrigger id="sig-username" className="bg-background/50 text-xs">
                                                    <SelectValue placeholder="Select Organization Member" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {usersList.filter(u => u.role !== 'customer').map((usr) => {
                                                        const displayName = usr.fullName || usr.email;
                                                        return (
                                                            <SelectItem key={usr.id} value={displayName}>
                                                                {displayName} ({usr.role === 'admin' ? 'Owner / Admin' : usr.role})
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="sig-role">Role</Label>
                                            <Select value={sigRole} onValueChange={setSigRole}>
                                                <SelectTrigger id="sig-role" className="bg-background/50">
                                                    <SelectValue placeholder="Select Role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Owner">Owner</SelectItem>
                                                    <SelectItem value="Manager">Manager</SelectItem>
                                                    <SelectItem value="Accountant">Accountant</SelectItem>
                                                    <SelectItem value="Billing">Billing Clerk</SelectItem>
                                                    <SelectItem value="Staff">Staff</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-3">
                                            <Label>Signature File</Label>
                                            <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 transition-colors border-slate-200">
                                                <input
                                                    type="file"
                                                    id="signature-file-input"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) setSigUploadFile(file);
                                                    }}
                                                />
                                                <label
                                                    htmlFor="signature-file-input"
                                                    className="cursor-pointer flex flex-col items-center gap-2 text-center"
                                                >
                                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:scale-105 transition-transform">
                                                        <Upload className="h-5 w-5" />
                                                    </div>
                                                    <span className="text-xs font-semibold text-slate-700">
                                                        {sigUploadFile ? sigUploadFile.name : "Choose signature image"}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">PNG, JPG or SVG up to 2MB</span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50/50">
                                            <div className="space-y-0.5">
                                                <Label htmlFor="sig-default" className="text-xs font-bold">Set as Default</Label>
                                                <p className="text-[10px] text-slate-400">Apply to bills & receipts by default</p>
                                            </div>
                                            <Switch
                                                id="sig-default"
                                                checked={sigIsDefault}
                                                onCheckedChange={setSigIsDefault}
                                            />
                                        </div>

                                        <Button 
                                            className="w-full shadow-sm hover:shadow transition-all duration-300"
                                            disabled={saving}
                                            onClick={handleAddSignature}
                                        >
                                            {saving ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...
                                                </>
                                            ) : (
                                                <>
                                                    <Plus className="mr-2 h-4 w-4" /> Save Signature
                                                </>
                                            )}
                                        </Button>
                                    </CardContent>
                                </Card>

                                {/* Signature Directory */}
                                <Card className="lg:col-span-2 border bg-card/60 backdrop-blur shadow-sm">
                                    <CardHeader>
                                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                                            <Shield className="h-5 w-5 text-primary" />
                                            Active Signatures
                                        </CardTitle>
                                        <CardDescription>Managed lists of digital signatures authorized for billing.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {!(profile?.bank_details?.signatures?.length) ? (
                                            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-slate-50/50">
                                                <Shield className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                                                <p className="text-xs font-semibold text-slate-500">No signatures uploaded yet</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">Upload owner or staff signatures on the left panel.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {(profile.bank_details.signatures).map((sig: any) => (
                                                    <div 
                                                        key={sig.id} 
                                                        className={`border rounded-lg p-4 flex flex-col justify-between bg-white relative transition-all duration-300 hover:shadow-md ${
                                                            sig.is_default ? 'ring-2 ring-primary/20 border-primary' : 'border-slate-100'
                                                        }`}
                                                    >
                                                        {sig.is_default && (
                                                            <span className="absolute top-3 right-3 bg-primary/10 text-primary text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full tracking-wider flex items-center gap-1">
                                                                <Check className="h-2 w-2" /> Default
                                                            </span>
                                                        )}
                                                        <div className="space-y-1">
                                                            <h4 className="text-xs font-bold text-slate-800">{sig.username}</h4>
                                                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{sig.role}</p>
                                                        </div>
                                                        
                                                        <div className="my-4 h-16 w-full flex items-center justify-center border border-slate-50 bg-slate-50/20 p-2 rounded">
                                                            <img 
                                                                src={sig.signature_url} 
                                                                alt={`${sig.username} Signature`} 
                                                                className="max-h-full object-contain"
                                                            />
                                                        </div>

                                                        <div className="flex gap-2 justify-between items-center mt-2 border-t pt-2.5">
                                                            {!sig.is_default ? (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    className="h-7 text-[10px] px-2 text-slate-500 hover:text-slate-800"
                                                                    onClick={() => handleSetDefaultSignature(sig.id)}
                                                                >
                                                                    Make Default
                                                                </Button>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 font-medium">Default Signature</span>
                                                            )}
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                                                onClick={() => handleDeleteSignature(sig.id)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* User Management Tab */}
                        <TabsContent value="users">
                            <Card className="border bg-card/60 backdrop-blur shadow-sm">
                                <CardHeader className="flex flex-row items-center justify-between pb-4">
                                    <div>
                                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                                            <Users className="h-5 w-5 text-primary" />
                                            User Accounts
                                        </CardTitle>
                                        <CardDescription>Manage user logins, secure roles, and reset credentials.</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {usersLoading ? (
                                        <div className="flex justify-center py-12">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        </div>
                                    ) : (
                                        <div className="border rounded-md overflow-hidden bg-white">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b">
                                                    <tr>
                                                        <th className="p-3">Name</th>
                                                        <th className="p-3">Email</th>
                                                        <th className="p-3">Phone</th>
                                                        <th className="p-3">Role</th>
                                                        <th className="p-3 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {usersList.map((usr) => (
                                                        <tr key={usr.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="p-3 font-semibold text-slate-800">{usr.fullName || "N/A"}</td>
                                                            <td className="p-3 text-slate-600 font-mono">{usr.email}</td>
                                                            <td className="p-3 text-slate-500 font-mono">{usr.phone || "-"}</td>
                                                            <td className="p-3">
                                                                <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                                                    usr.role === "admin" 
                                                                        ? "bg-rose-50 text-rose-600 border border-rose-100" 
                                                                        : usr.role === "customer"
                                                                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                                                        : "bg-blue-50 text-blue-600 border border-blue-100"
                                                                }`}>
                                                                    {usr.role}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-right">
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    className="h-7 text-[10px] gap-1 px-2.5 text-slate-600 hover:text-slate-800"
                                                                    onClick={() => handleOpenEditUser(usr)}
                                                                >
                                                                    <Edit className="h-3 w-3" /> Edit
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Edit User Dialog */}
                            <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
                                <DialogContent className="sm:max-w-[450px]">
                                    <DialogHeader>
                                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                                            <Edit className="h-4.5 w-4.5 text-primary" />
                                            Edit User Profile
                                        </DialogTitle>
                                        <DialogDescription className="text-xs">
                                            Modify settings or assign access level. Reset password if required.
                                        </DialogDescription>
                                    </DialogHeader>
                                    
                                    <div className="space-y-4 py-2 text-xs">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="edit-name">Full Name</Label>
                                                <Input 
                                                    id="edit-name" 
                                                    value={editFullName} 
                                                    onChange={e => setEditFullName(e.target.value)}
                                                    className="h-9 text-xs"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="edit-email">Email Address</Label>
                                                <Input 
                                                    id="edit-email" 
                                                    type="email"
                                                    value={editEmail} 
                                                    onChange={e => setEditEmail(e.target.value)}
                                                    className="h-9 text-xs"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="edit-phone">Phone Number</Label>
                                                <Input 
                                                    id="edit-phone" 
                                                    value={editPhone} 
                                                    onChange={e => setEditPhone(e.target.value)}
                                                    className="h-9 text-xs"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="edit-role">Access Role</Label>
                                                <Select value={editRole} onValueChange={setEditRole}>
                                                    <SelectTrigger id="edit-role" className="h-9 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="text-xs">
                                                        <SelectItem value="admin">Admin</SelectItem>
                                                        <SelectItem value="staff">Staff / Employee</SelectItem>
                                                        <SelectItem value="customer">Customer</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 border-t pt-3.5">
                                            <div className="flex justify-between items-center">
                                                <Label htmlFor="edit-password">Reset Password</Label>
                                                <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-0.5">
                                                    <Key className="h-3 w-3" /> Secure Reset
                                                </span>
                                            </div>
                                            <Input 
                                                id="edit-password" 
                                                type="password"
                                                placeholder="Leave blank to keep current password..."
                                                value={editPassword} 
                                                onChange={e => setEditPassword(e.target.value)}
                                                className="h-9 text-xs"
                                            />
                                        </div>
                                    </div>

                                    <DialogFooter className="border-t pt-4 flex gap-2 justify-end">
                                        <Button variant="outline" size="sm" onClick={() => setIsEditUserOpen(false)} disabled={saving} className="text-xs">
                                            Cancel
                                        </Button>
                                        <Button size="sm" onClick={handleUpdateUser} disabled={saving} className="text-xs">
                                            {saving ? "Saving..." : "Save Changes"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </TabsContent>

                        {/* Work Slip Config Tab */}
                        <TabsContent value="workslip">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5" /> Work Slip Template
                                    </CardTitle>
                                    <CardDescription>Configure how the Work Slip PDF looks.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Format Settings */}
                                        <div className="space-y-4">
                                            <h3 className="font-semibold border-b pb-2">Numbering & Format</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Document Prefix</Label>
                                                    <Input
                                                        value={workSlipSettings.prefix || ''}
                                                        onChange={e => setWorkSlipSettings({ ...workSlipSettings, prefix: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Document Title</Label>
                                                    <Input
                                                        value={workSlipSettings.title || ''}
                                                        onChange={e => setWorkSlipSettings({ ...workSlipSettings, title: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Toggles */}
                                        <div className="space-y-4">
                                            <h3 className="font-semibold border-b pb-2">Visibility</h3>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between border p-2 rounded">
                                                    <Label>Show Rates/Prices</Label>
                                                    <Switch
                                                        checked={workSlipSettings.show_rates}
                                                        onCheckedChange={c => setWorkSlipSettings({ ...workSlipSettings, show_rates: c })}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between border p-2 rounded">
                                                    <Label>Show Taxes</Label>
                                                    <Switch
                                                        checked={workSlipSettings.show_taxes}
                                                        onCheckedChange={c => setWorkSlipSettings({ ...workSlipSettings, show_taxes: c })}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between border p-2 rounded">
                                                    <Label>Show FC Details</Label>
                                                    <Switch
                                                        checked={workSlipSettings.show_fc_details}
                                                        onCheckedChange={c => setWorkSlipSettings({ ...workSlipSettings, show_fc_details: c })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="font-semibold border-b pb-2">Content</h3>
                                        <div className="space-y-2">
                                            <Label>Terms & Conditions</Label>
                                            <Textarea
                                                className="h-32"
                                                value={workSlipSettings.terms_and_conditions || ''}
                                                onChange={e => setWorkSlipSettings({ ...workSlipSettings, terms_and_conditions: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Footer Text</Label>
                                            <Input
                                                value={workSlipSettings.footer_text || ''}
                                                onChange={e => setWorkSlipSettings({ ...workSlipSettings, footer_text: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <Button onClick={() => handleSaveDocSettings('work_slip')} disabled={saving}>
                                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Settings
                                    </Button>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Invoice Config Tab - Clone of Work Slip for now */}
                        <TabsContent value="invoice">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5" /> Invoice Template
                                    </CardTitle>
                                    <CardDescription>Configure how the Tax Invoice PDF looks.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Format Settings */}
                                        <div className="space-y-4">
                                            <h3 className="font-semibold border-b pb-2">Numbering & Format</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Document Prefix</Label>
                                                    <Input
                                                        value={invoiceSettings.prefix || ''}
                                                        onChange={e => setInvoiceSettings({ ...invoiceSettings, prefix: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Document Title</Label>
                                                    <Input
                                                        value={invoiceSettings.title || ''}
                                                        onChange={e => setInvoiceSettings({ ...invoiceSettings, title: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Toggles */}
                                        <div className="space-y-4">
                                            <h3 className="font-semibold border-b pb-2">Visibility</h3>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between border p-2 rounded">
                                                    <Label>Show Rates/Prices</Label>
                                                    <Switch
                                                        checked={invoiceSettings.show_rates}
                                                        onCheckedChange={c => setInvoiceSettings({ ...invoiceSettings, show_rates: c })}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between border p-2 rounded">
                                                    <Label>Show Taxes</Label>
                                                    <Switch
                                                        checked={invoiceSettings.show_taxes}
                                                        onCheckedChange={c => setInvoiceSettings({ ...invoiceSettings, show_taxes: c })}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between border p-2 rounded">
                                                    <Label>Show Discounts</Label>
                                                    <Switch
                                                        checked={invoiceSettings.show_discounts}
                                                        onCheckedChange={c => setInvoiceSettings({ ...invoiceSettings, show_discounts: c })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="font-semibold border-b pb-2">Content</h3>
                                        <div className="space-y-2">
                                            <Label>Terms & Conditions</Label>
                                            <Textarea
                                                className="h-32"
                                                value={invoiceSettings.terms_and_conditions || ''}
                                                onChange={e => setInvoiceSettings({ ...invoiceSettings, terms_and_conditions: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Footer Text</Label>
                                            <Input
                                                value={invoiceSettings.footer_text || ''}
                                                onChange={e => setInvoiceSettings({ ...invoiceSettings, footer_text: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <Button onClick={() => handleSaveDocSettings('invoice')} disabled={saving}>
                                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Settings
                                    </Button>
                                </CardContent>
                            </Card>
                        </TabsContent>


                        {/* Payment Config Tab */}
                        <TabsContent value="payment">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <QrCode className="h-5 w-5" /> Payment Configuration
                                    </CardTitle>
                                    <CardDescription>Upload the QR Code for customer payments (UPI).</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-4">
                                        <Label>Payment QR Code</Label>
                                        <div className="flex flex-col items-center gap-4 p-4 border-2 border-dashed rounded-lg">
                                            {profile.payment_qr_code_url ? (
                                                <div className="relative group">
                                                    <img
                                                        src={profile.payment_qr_code_url}
                                                        alt="Payment QR"
                                                        className="h-48 w-48 object-contain rounded-lg border bg-white"
                                                    />
                                                    <Button
                                                        variant="destructive"
                                                        size="icon"
                                                        className="absolute -top-2 -right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => setProfile({ ...profile, payment_qr_code_url: null })}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-48 w-48 bg-muted/50 rounded-lg">
                                                    <QrCode className="h-10 w-10 text-muted-foreground mb-2" />
                                                    <span className="text-xs text-muted-foreground">No QR Uploaded</span>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-4 w-full max-w-sm">
                                                <Input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;

                                                        setSaving(true);
                                                        try {
                                                            const fileExt = file.name.split('.').pop();
                                                            const fileName = `qr-code-${Date.now()}.${fileExt}`;
                                                            const filePath = `${fileName}`;

                                                            const { error: uploadError } = await supabase.storage
                                                                .from('qr-codes')
                                                                .upload(filePath, file);

                                                            if (uploadError) throw uploadError;

                                                            const { data: { publicUrl } } = supabase.storage
                                                                .from('qr-codes')
                                                                .getPublicUrl(filePath);

                                                            setProfile({ ...profile, payment_qr_code_url: publicUrl });
                                                            toast({ title: "Image Uploaded", description: "Remember to save changes." });
                                                        } catch (error: any) {
                                                            toast({ variant: "destructive", title: "Upload Failed", description: error.message });
                                                        } finally {
                                                            setSaving(false);
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <Label className="text-base font-semibold">Bank Account Details (For Bank Transfer)</Label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="bankName">Bank Name</Label>
                                                <Input
                                                    id="bankName"
                                                    value={profile.bank_name || ''}
                                                    onChange={(e) => setProfile({ ...profile, bank_name: e.target.value })}
                                                    placeholder="e.g. HDFC Bank"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="accountName">Account Holder Name</Label>
                                                <Input
                                                    id="accountName"
                                                    value={profile.acc_name || ''}
                                                    onChange={(e) => setProfile({ ...profile, acc_name: e.target.value })}
                                                    placeholder="e.g. Amma Auto Service"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="accountNumber">Account Number</Label>
                                                <Input
                                                    id="accountNumber"
                                                    value={profile.acc_number || ''}
                                                    onChange={(e) => setProfile({ ...profile, acc_number: e.target.value })}
                                                    placeholder="xxxxxxxxxxxx"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="ifscCode">IFSC Code</Label>
                                                <Input
                                                    id="ifscCode"
                                                    value={profile.ifsc || ''}
                                                    onChange={(e) => setProfile({ ...profile, ifsc: e.target.value })}
                                                    placeholder="HDFC0001234"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="upiId">UPI ID</Label>
                                                <Input
                                                    id="upiId"
                                                    value={profile.upi_id || ''}
                                                    onChange={(e) => setProfile({ ...profile, upi_id: e.target.value })}
                                                    placeholder="example@okaxis"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <Button onClick={handleSaveProfile} disabled={saving}>
                                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Settings
                                    </Button>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        {/* Workforce Settings Tab */}
                        <TabsContent value="workforce">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Clock className="h-5 w-5" /> Workforce & Attendance Rules
                                    </CardTitle>
                                    <CardDescription>Configure standard working hours and attendance policies.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <h3 className="font-semibold border-b pb-2">Working Hours</h3>
                                            <div className="grid grid-cols-2 gap-6">
                                                {/* Session 1 */}
                                                <div className="space-y-4 bg-muted/20 p-4 rounded-lg">
                                                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Session 1 (Morning)</span>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px]">Start</Label>
                                                            <Input
                                                                type="time"
                                                                className="h-8"
                                                                value={workforceSettings.session_1_start_time || '09:00'}
                                                                onChange={e => setWorkforceSettings({ ...workforceSettings, session_1_start_time: e.target.value })}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px]">End</Label>
                                                            <Input
                                                                type="time"
                                                                className="h-8"
                                                                value={workforceSettings.session_1_end_time || '13:00'}
                                                                onChange={e => setWorkforceSettings({ ...workforceSettings, session_1_end_time: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Session 2 */}
                                                <div className="space-y-4 bg-muted/20 p-4 rounded-lg">
                                                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Session 2 (Afternoon)</span>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px]">Start</Label>
                                                            <Input
                                                                type="time"
                                                                className="h-8"
                                                                value={workforceSettings.session_2_start_time || '14:00'}
                                                                onChange={e => setWorkforceSettings({ ...workforceSettings, session_2_start_time: e.target.value })}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px]">End</Label>
                                                            <Input
                                                                type="time"
                                                                className="h-8"
                                                                value={workforceSettings.session_2_end_time || '18:00'}
                                                                onChange={e => setWorkforceSettings({ ...workforceSettings, session_2_end_time: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-2 pt-2">
                                                <Label>Standard Daily Hours (for Overtime calculation)</Label>
                                                <Input
                                                    type="number"
                                                    step="0.5"
                                                    value={workforceSettings.standard_daily_hours || 8}
                                                    onChange={e => setWorkforceSettings({ ...workforceSettings, standard_daily_hours: parseFloat(e.target.value) })}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h3 className="font-semibold border-b pb-2">Attendance Policies</h3>
                                            <div className="space-y-2">
                                                <Label>Late Threshold (Minutes)</Label>
                                                <Input
                                                    type="number"
                                                    value={workforceSettings.late_threshold_mins || 15}
                                                    onChange={e => setWorkforceSettings({ ...workforceSettings, late_threshold_mins: parseInt(e.target.value) })}
                                                />
                                                <p className="text-[10px] text-muted-foreground">Clock-ins after this many minutes from start time will be marked as 'Late'.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <Button onClick={handleSaveWorkforce} disabled={saving}>
                                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Workforce Rules
                                    </Button>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Tally Settings Tab */}
                        <TabsContent value="tally">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        Ledger Mapping Configuration
                                    </CardTitle>
                                    <CardDescription>
                                        Configure default ledger names to match your Tally Prime company ledger accounts.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <h3 className="font-semibold border-b pb-2">Revenue & Tax Ledgers</h3>
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="salesLedger">Sales/Revenue Ledger</Label>
                                                    <Input
                                                        id="salesLedger"
                                                        value={tallyLedgers.salesLedger}
                                                        onChange={e => setTallyLedgers({ ...tallyLedgers, salesLedger: e.target.value })}
                                                        placeholder="e.g. Sales Account"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="cgstLedger">CGST Ledger</Label>
                                                    <Input
                                                        id="cgstLedger"
                                                        value={tallyLedgers.cgstLedger}
                                                        onChange={e => setTallyLedgers({ ...tallyLedgers, cgstLedger: e.target.value })}
                                                        placeholder="e.g. CGST"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="sgstLedger">SGST Ledger</Label>
                                                    <Input
                                                        id="sgstLedger"
                                                        value={tallyLedgers.sgstLedger}
                                                        onChange={e => setTallyLedgers({ ...tallyLedgers, sgstLedger: e.target.value })}
                                                        placeholder="e.g. SGST"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="igstLedger">IGST Ledger</Label>
                                                    <Input
                                                        id="igstLedger"
                                                        value={tallyLedgers.igstLedger}
                                                        onChange={e => setTallyLedgers({ ...tallyLedgers, igstLedger: e.target.value })}
                                                        placeholder="e.g. IGST"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h3 className="font-semibold border-b pb-2">Cash/Bank & Reconciliation</h3>
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="bankLedger">Bank / Cash Ledger</Label>
                                                    <Input
                                                        id="bankLedger"
                                                        value={tallyLedgers.bankLedger}
                                                        onChange={e => setTallyLedgers({ ...tallyLedgers, bankLedger: e.target.value })}
                                                        placeholder="e.g. Bank A/c or Cash A/c"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="roundOffLedger">Round Off Ledger</Label>
                                                    <Input
                                                        id="roundOffLedger"
                                                        value={tallyLedgers.roundOffLedger}
                                                        onChange={e => setTallyLedgers({ ...tallyLedgers, roundOffLedger: e.target.value })}
                                                        placeholder="e.g. Round Off"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <Button onClick={handleSaveTallySettings}>
                                        Save Tally Ledgers
                                    </Button>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </main>
            </div>
        </div >
    );
}
