import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { BrandFooter } from "@/components/brand/BrandFooter";
import { LoginIntroTransition } from "@/components/brand/LoginIntroTransition";

export default function InventoryLogin() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { companyName } = useCompanyProfile();
    const [loading, setLoading] = useState(false);
    const [loginData, setLoginData] = useState({ email: "", password: "" });
    const [showPostLoginIntro, setShowPostLoginIntro] = useState(false);
    const [userNameForIntro, setUserNameForIntro] = useState<string>("");
    const isLoggingInRef = useRef(false);

    useEffect(() => {
        // Check if user is already logged in
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session && !showPostLoginIntro && !isLoggingInRef.current) {
                navigate("/inventory/room");
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session && !showPostLoginIntro && !isLoggingInRef.current) {
                navigate("/inventory/room");
            }
        });

        return () => subscription.unsubscribe();
    }, [navigate, showPostLoginIntro]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        isLoggingInRef.current = true;

        const { data, error } = await supabase.auth.signInWithPassword({
            email: loginData.email,
            password: loginData.password,
        });

        if (error) {
            isLoggingInRef.current = false;
            toast({
                variant: "destructive",
                title: "Authentication Failed",
                description: error.message,
            });
            setLoading(false);
        } else {
            let staffName = data?.user?.user_metadata?.full_name || data?.user?.email?.split('@')[0] || "Inventory Staff";
            if (data?.user?.id) {
                try {
                    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", data.user.id).maybeSingle();
                    if (prof?.full_name?.trim()) staffName = prof.full_name.trim();
                } catch {
                    // ignore
                }
            }
            setUserNameForIntro(staffName);
            // Trigger HavDox intro transition animation automatically as post-login experience
            setShowPostLoginIntro(true);
        }
    };

    if (showPostLoginIntro) {
        return (
            <LoginIntroTransition
                userName={userNameForIntro}
                garageName={companyName}
                onComplete={() => {
                    navigate("/inventory/room", { replace: true });
                }}
            />
        );
    }

    return (
        <div className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-background via-muted/20 to-background text-foreground relative overflow-hidden">
            {/* Center Auth Card */}
            <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
                <Card className="w-full max-w-md bg-card/90 backdrop-blur-md border border-border shadow-[0_24px_60px_rgba(0,0,0,0.08)] rounded-2xl overflow-hidden">
                    <CardHeader className="space-y-3 text-center pb-6 pt-8 px-6 sm:px-8">
                        <div className="flex justify-center">
                            <div className="h-14 w-14 rounded-2xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-md">
                                <img src="/logo-x.png" alt="Drive Flow" className="h-8 w-auto object-contain invert dark:invert-0" />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <CardTitle className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight uppercase">
                                Inventory Kiosk
                            </CardTitle>
                            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-medium">
                                <span>Drive Flow</span>
                                <span>•</span>
                                <span>Powered by HavDox</span>
                            </div>
                        </div>

                        <CardDescription className="text-xs text-muted-foreground pt-1">
                            {companyName && companyName !== "Garage"
                                ? `${companyName} · Parts & Storage Dispatch`
                                : "Authorized Warehouse & Parts Personnel Only"}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="px-6 sm:px-8 pb-8">
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Staff Email
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="staff@example.com"
                                    className="h-11 rounded-xl"
                                    value={loginData.email}
                                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                                    required
                                    autoComplete="email"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Password
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    className="h-11 rounded-xl"
                                    value={loginData.password}
                                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                                    required
                                    autoComplete="current-password"
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-11 rounded-full text-sm font-display font-medium shadow-sm mt-2"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Authenticating...
                                    </>
                                ) : (
                                    "Enter Storage Room"
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </main>

            {/* Official HavDox Brand Footer */}
            <BrandFooter />
        </div>
    );
}
