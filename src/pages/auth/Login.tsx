import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { BrandFooter } from "@/components/brand/BrandFooter";
import { LoginIntroTransition } from "@/components/brand/LoginIntroTransition";

import { HavDoxLoader } from "@/components/brand/HavDoxLoader";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { companyName } = useCompanyProfile();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [showPostLoginIntro, setShowPostLoginIntro] = useState(false);
  const [userNameForIntro, setUserNameForIntro] = useState<string>("");
  const [resolvedDestination, setResolvedDestination] = useState<string>("/admin");
  const isLoggingInRef = useRef(false);

  const targetPath = (location.state as any)?.from?.pathname || "/dashboard";

  useEffect(() => {
    // If user is already logged in and NOT actively performing a new login, redirect to workspace
    if (user && !authLoading && !showPostLoginIntro && !isLoggingInRef.current) {
      const dest =
        targetPath && targetPath !== "/dashboard" && targetPath !== "/auth"
          ? targetPath
          : user.role === "staff"
          ? "/staff"
          : user.role === "customer"
          ? "/customer"
          : "/admin";
      navigate(dest, { replace: true });
    }
  }, [user, authLoading, navigate, targetPath, showPostLoginIntro]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    isLoggingInRef.current = true;

    try {
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
        return;
      }

      // Determine the best target destination and resolve user display name
      let nextDest = "/admin";
      let resolvedName = data?.user?.user_metadata?.full_name || data?.user?.email?.split("@")[0] || "User";

      if (targetPath && targetPath !== "/dashboard" && targetPath !== "/auth") {
        nextDest = targetPath;
      }

      if (data?.user?.id) {
        try {
          const [roleRes, profRes] = await Promise.all([
            supabase.from("user_roles").select("role").eq("user_id", data.user.id).maybeSingle(),
            supabase.from("profiles").select("full_name").eq("id", data.user.id).maybeSingle(),
          ]);

          if (profRes.data?.full_name?.trim()) {
            resolvedName = profRes.data.full_name.trim();
          }

          if (roleRes.data?.role === "staff") {
            nextDest = "/staff";
          } else if (roleRes.data?.role === "customer") {
            nextDest = "/customer";
          } else {
            nextDest = "/admin";
          }
        } catch {
          // fallback to defaults
        }
      }

      setUserNameForIntro(resolvedName);
      setResolvedDestination(nextDest);
      // Mount the full-screen HavDox vector breakthrough welcome intro animation
      setShowPostLoginIntro(true);
    } catch (err: any) {
      isLoggingInRef.current = false;
      toast({
        variant: "destructive",
        title: "Login Error",
        description: err.message || "An unexpected error occurred during sign in",
      });
      setLoading(false);
    }
  };

  // If successfully authenticated and transition is active, show the HavDox intro animation with welcome details
  if (showPostLoginIntro) {
    return (
      <LoginIntroTransition
        userName={userNameForIntro || user?.full_name || user?.email?.split("@")[0] || "User"}
        garageName={companyName}
        onComplete={() => {
          navigate(resolvedDestination || "/admin", { replace: true });
        }}
      />
    );
  }

  // Official HavDox initial auth checking state
  if (authLoading) {
    return (
      <HavDoxLoader
        variant="fullscreen"
        message="Verifying session..."
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-background via-muted/30 to-background text-foreground relative overflow-hidden">
      {/* Ambient background lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-80 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none blur-3xl -z-10" />

      {/* Center Auth Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
        <Card className="w-full max-w-md bg-card/90 backdrop-blur-md border border-border shadow-[0_24px_60px_rgba(0,0,0,0.08)] rounded-2xl overflow-hidden">
          <CardHeader className="space-y-3 text-center pb-6 pt-8 px-6 sm:px-8">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-2xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-md">
                <img
                  src="/logo-x.png"
                  alt="Drive Flow"
                  className="h-8 w-auto object-contain invert dark:invert-0"
                />
              </div>
            </div>

            <div className="space-y-1">
              <CardTitle className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Drive Flow
              </CardTitle>
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-medium">
                <span>Powered by HavDox</span>
              </div>
            </div>

            <CardDescription className="text-xs text-muted-foreground pt-1">
              {companyName && companyName !== "Garage"
                ? `${companyName} · Workshop Management System`
                : "Professional Vehicle Service Operations Suite"}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 sm:px-8 pb-8">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  required
                  className="h-11 rounded-xl"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Password
                  </Label>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pr-10 h-11 rounded-xl"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
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
                  "Sign In to Drive Flow"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>

      {/* Official Clean Brand Footer */}
      <BrandFooter />
    </div>
  );
}
