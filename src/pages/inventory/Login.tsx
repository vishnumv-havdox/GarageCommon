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

    useEffect(() => {
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
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
            <Card className="w-full max-w-md bg-slate-800 border-slate-700 text-white shadow-2xl">
                <CardHeader className="space-y-2 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="p-4 bg-primary rounded-2xl shadow-lg shadow-primary/20">
                            <QrCode className="h-10 w-10 text-white" />
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-bold tracking-tight">Inventory Room</CardTitle>
                    <CardDescription className="text-slate-400">Authorized Personnel Only</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-slate-300">Staff Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="staff@ammaauto.com"
                                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 h-12"
                                value={loginData.email}
                                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-slate-300">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 h-12"
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
                            <p className="text-xs text-slate-500 uppercase tracking-widest">Amma Auto Inventory Management</p>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
