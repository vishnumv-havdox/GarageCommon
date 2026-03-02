import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, QrCode } from "lucide-react";

export default function InventoryLogin() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [loginData, setLoginData] = useState({ email: "", password: "" });

    const [profile, setProfile] = useState<any>(null);
    const [isBackendDown, setIsBackendDown] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const { data, error } = await supabase.from('company_profiles').select('company_name, logo_url').limit(1).maybeSingle();
                if (error && error.message === 'Failed to fetch') {
                    setIsBackendDown(true);
                } else if (data) {
                    setProfile(data);
                }
            } catch (error: any) {
                if (error.message === 'Failed to fetch' || (error instanceof TypeError && error.message === 'Failed to fetch')) {
                    setIsBackendDown(true);
                }
                console.error("Backend check failed:", error);
            }
        };
        fetchProfile();

        // Check if user is already logged in
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                navigate("/inventory/room");
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                navigate("/inventory/room");
            }
        });

        return () => subscription.unsubscribe();
    }, [navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { error } = await supabase.auth.signInWithPassword({
            email: loginData.email,
            password: loginData.password,
        });

        if (error) {
            toast({
                variant: "destructive",
                title: "Login failed",
                description: error.message,
            });
        } else {
            toast({
                title: "Inventory Access Granted",
                description: "Redirecting to Scanning Room...",
            });
            navigate("/inventory/room");
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-grid-white/[0.02] -z-10" />
            <Card className="w-full max-w-md bg-card border-border text-foreground shadow-2xl relative z-10">
                <CardHeader className="space-y-2 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="p-4 bg-primary rounded-2xl shadow-lg shadow-primary/20">
                            {profile?.logo_url ? (
                                <img src={profile.logo_url} alt="Logo" className="h-10 w-10 object-contain" />
                            ) : (
                                <QrCode className="h-10 w-10 text-white" />
                            )}
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-bold tracking-tight uppercase">{profile?.company_name || 'Inventory Room'}</CardTitle>
                    <CardDescription className="text-muted-foreground">Authorized Personnel Only</CardDescription>
                    {isBackendDown && (
                        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm font-medium animate-pulse">
                            Backend Unreachable. The Supabase project might be paused.
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-foreground">Staff Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="staff@example.com"
                                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground h-12"
                                value={loginData.email}
                                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-foreground">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground h-12"
                                value={loginData.password}
                                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full h-12 text-lg font-bold bg-primary hover:bg-primary/90" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Authenticating...
                                </>
                            ) : (
                                "Enter Storage Room"
                            )}
                        </Button>
                        <div className="pt-4 text-center">
                            <p className="text-xs text-muted-foreground uppercase tracking-widest">{profile?.company_name || 'Service Center'} Inventory Management</p>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
