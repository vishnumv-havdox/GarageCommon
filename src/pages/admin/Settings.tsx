import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Building2, FileText, Settings as SettingsIcon, QrCode, Trash2 } from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

export default function Settings() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Data States
    const [profile, setProfile] = useState<any>({});
    const [workSlipSettings, setWorkSlipSettings] = useState<any>({});
    const [invoiceSettings, setInvoiceSettings] = useState<any>({});

    useEffect(() => {
        fetchSettings();
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
        } catch (error: any) {
            console.error("Error fetching settings:", error);
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handeSaveProfile = async () => {
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

            if (existing?.id) {
                // Update existing
                await supabase.from('company_profiles').update(payload).eq('id', existing.id);
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

    const handleSaveDocSettings = async (type: 'work_slip' | 'invoice') => {
        setSaving(true);
        try {
            const settings = type === 'work_slip' ? workSlipSettings : invoiceSettings;
            const payload = { ...settings, doc_type: type };
            delete payload.id;
            delete payload.created_at;
            delete payload.updated_at;

            if (settings.id) {
                await supabase.from('document_settings').update(payload).eq('id', settings.id);
            } else {
                await supabase.from('document_settings').insert(payload);
            }

            toast({ title: "Saved", description: `${type === 'work_slip' ? 'Work Slip' : 'Invoice'} settings updated.` });
            fetchSettings();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setSaving(false);
        }
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

                    <Tabs defaultValue="profile" className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="profile">Company Profile</TabsTrigger>
                            <TabsTrigger value="workslip">Work Slip Config</TabsTrigger>
                            <TabsTrigger value="invoice">Invoice Config</TabsTrigger>
                            <TabsTrigger value="payment">Payment Config</TabsTrigger>
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
                                        <div className="space-y-2">
                                            <Label>Logo URL</Label>
                                            <Input
                                                value={profile.logo_url || ''}
                                                onChange={e => setProfile({ ...profile, logo_url: e.target.value })}
                                                placeholder="https://..."
                                            />
                                        </div>
                                    </div>
                                    <Button onClick={handeSaveProfile} disabled={saving} className="mt-4">
                                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Profile
                                    </Button>
                                </CardContent>
                            </Card>
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
                                                    value={profile.bank_details?.bankName || ''}
                                                    onChange={(e) => setProfile({ ...profile, bank_details: { ...profile.bank_details, bankName: e.target.value } })}
                                                    placeholder="e.g. HDFC Bank"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="accountName">Account Holder Name</Label>
                                                <Input
                                                    id="accountName"
                                                    value={profile.bank_details?.accountName || ''}
                                                    onChange={(e) => setProfile({ ...profile, bank_details: { ...profile.bank_details, accountName: e.target.value } })}
                                                    placeholder="e.g. Amma Auto Service"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="accountNumber">Account Number</Label>
                                                <Input
                                                    id="accountNumber"
                                                    value={profile.bank_details?.accountNumber || ''}
                                                    onChange={(e) => setProfile({ ...profile, bank_details: { ...profile.bank_details, accountNumber: e.target.value } })}
                                                    placeholder="xxxxxxxxxxxx"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="ifscCode">IFSC Code</Label>
                                                <Input
                                                    id="ifscCode"
                                                    value={profile.bank_details?.ifscCode || ''}
                                                    onChange={(e) => setProfile({ ...profile, bank_details: { ...profile.bank_details, ifscCode: e.target.value } })}
                                                    placeholder="HDFC0001234"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <Button onClick={handeSaveProfile} disabled={saving}>
                                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Settings
                                    </Button>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </main>
            </div>
        </div>
    );
}
