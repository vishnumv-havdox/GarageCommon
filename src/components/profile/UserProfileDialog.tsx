import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
    User, Shield, Fingerprint, LogOut,
    Mail, Building2, CheckCircle2, AlertTriangle, Loader2, Trash2
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


interface UserProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function UserProfileDialog({ open, onOpenChange }: UserProfileDialogProps) {
    const { user, signOut } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [factors, setFactors] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
            fetchFactors();
        }
    }, [open]);

    const fetchFactors = async () => {
        try {
            const { data, error } = await supabase.auth.mfa.listFactors();
            if (error) throw error;
            setFactors(data.all || []);
        } catch (error) {
            console.error("Error fetching MFA factors:", error);
        }
    };



    const handleUnenroll = async (factorId: string) => {
        try {
            const { error } = await supabase.auth.mfa.unenroll({ factorId });
            if (error) throw error;
            toast({ title: "Removed", description: "Security method removed." });
            fetchFactors();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    // Helper to get initials
    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Account Profile</DialogTitle>
                    <DialogDescription>
                        Manage your account settings and security preferences.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center justify-center p-4 gap-3">
                    <Avatar className="h-20 w-20 border-2 border-primary/10">
                        <AvatarImage src="" />
                        <AvatarFallback className="text-2xl font-bold bg-primary/5 text-primary">
                            {user?.full_name ? getInitials(user.full_name) : <User className="h-10 w-10" />}
                        </AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                        <h2 className="text-xl font-bold">{user?.full_name || "User"}</h2>
                        <Badge variant="secondary" className="mt-1 capitalize">
                            {user?.role || "Staff"}
                        </Badge>
                    </div>
                </div>

                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="security">Security</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4 py-4">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                                <Mail className="h-5 w-5 text-muted-foreground" />
                                <div className="overflow-hidden">
                                    <p className="text-xs text-muted-foreground font-medium uppercase">Email Address</p>
                                    <p className="text-sm font-medium truncate" title={user?.email}>{user?.email}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                                <Building2 className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium uppercase">Company</p>
                                    <p className="text-sm font-medium">Amma Auto Garage</p>
                                </div>
                            </div>
                        </div>

                        <Button variant="destructive" className="w-full mt-2" onClick={signOut}>
                            <LogOut className="h-4 w-4 mr-2" />
                            Sign Out
                        </Button>
                    </TabsContent>

                    <TabsContent value="security" className="space-y-4 py-4">
                        <div className="bg-muted border rounded-lg p-4 text-center">
                            <Shield className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm font-medium">Security Settings</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Secure your account with multifactor authentication.
                            </p>
                        </div>

                        {factors.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-muted-foreground">Registered Methods</h4>
                                {factors.map((factor) => (
                                    <div key={factor.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                                        <div className="flex items-center gap-2">
                                            <Shield className="h-4 w-4 text-emerald-500" />
                                            <div>
                                                <span className="text-sm font-medium block">{factor.friendly_name || "Device"}</span>
                                                <span className="text-[10px] text-muted-foreground uppercase">{factor.factor_type}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">
                                                {new Date(factor.created_at).toLocaleDateString()}
                                            </Badge>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                onClick={() => handleUnenroll(factor.id)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!window.isSecureContext && (
                            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                                <AlertTriangle className="h-4 w-4" />
                                Biometrics requires HTTPS or Localhost
                            </div>
                        )}
                    </TabsContent>


                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
