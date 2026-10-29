import React, { useState, useEffect } from "react";
import { Check, Sparkles, Palette, RefreshCw, Eye, Sliders, CheckCircle2, Sun, Moon, Laptop } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  THEME_PRESETS,
  ThemeConfig,
  getActiveTheme,
  applyTheme,
  getContrastForeground,
  useColorMode,
  ColorMode,
} from "@/utils/themeManager";

interface AppearanceSettingsTabProps {
  profile: any;
  onProfileUpdated?: (updatedProfile: any) => void;
}

export const AppearanceSettingsTab: React.FC<AppearanceSettingsTabProps> = ({
  profile,
  onProfileUpdated,
}) => {
  const { toast } = useToast();
  const { mode, isDark, setMode } = useColorMode();
  const [selectedPresetId, setSelectedPresetId] = useState<string>("havdox-onyx");
  const [primaryHex, setPrimaryHex] = useState<string>("#000000");
  const [ringHex, setRingHex] = useState<string>("#4d8dff");
  const [accentHex, setAccentHex] = useState<string>("#6366f1");
  const [themeName, setThemeName] = useState<string>("HavDox Signature Onyx");
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const isInitializedRef = React.useRef<boolean>(false);

  // Synchronize on mount from database or localStorage
  useEffect(() => {
    const dbTheme = profile?.theme_settings || profile?.bank_details?.theme_settings;
    if (dbTheme && !isInitializedRef.current) {
      isInitializedRef.current = true;
      if (dbTheme.primaryHex) {
        const matchingPreset = THEME_PRESETS.find(
          (p) =>
            p.id === (dbTheme.id || "") ||
            p.primaryHex.toLowerCase() === (dbTheme.primaryHex || "").toLowerCase()
        );
        setSelectedPresetId(matchingPreset ? matchingPreset.id : (dbTheme.id || "custom"));
        setPrimaryHex(dbTheme.primaryHex);
        setRingHex(dbTheme.ringHex || dbTheme.primaryHex);
        setAccentHex(dbTheme.accentHex || dbTheme.primaryHex);
        setThemeName(matchingPreset ? matchingPreset.name : (dbTheme.name || "Custom Palette"));
      }
      if (dbTheme.mode) {
        setMode(dbTheme.mode as ColorMode);
      }
      applyTheme(dbTheme, true, false);
    } else if (!isInitializedRef.current) {
      const active = getActiveTheme();
      const matchingPreset = THEME_PRESETS.find(
        (p) =>
          p.id === (active.id || "") ||
          p.primaryHex.toLowerCase() === (active.primaryHex || "").toLowerCase()
      );
      setSelectedPresetId(matchingPreset ? matchingPreset.id : (active.id || "custom"));
      setPrimaryHex(active.primaryHex);
      setRingHex(active.ringHex || active.primaryHex);
      setAccentHex(active.accentHex || active.primaryHex);
      setThemeName(matchingPreset ? matchingPreset.name : active.name);
      applyTheme(active, false, false);
    }
  }, [profile?.theme_settings, profile?.bank_details?.theme_settings]);

  // Handle preset selection with animated GPU crossfade
  const handleSelectPreset = (preset: ThemeConfig) => {
    isInitializedRef.current = true;
    setSelectedPresetId(preset.id);
    setPrimaryHex(preset.primaryHex);
    setRingHex(preset.ringHex || preset.primaryHex);
    setAccentHex(preset.accentHex || preset.primaryHex);
    setThemeName(preset.name);

    // Apply live immediately with smooth GPU crossfade
    applyTheme(preset, true, true);
  };

  // Handle custom primary color modification (instant 60fps live update without animation overhead)
  const handlePrimaryChange = (newHex: string) => {
    isInitializedRef.current = true;
    setSelectedPresetId("custom");
    setPrimaryHex(newHex);

    const clean = newHex.replace("#", "").trim();
    if (clean.length === 3 || clean.length === 6) {
      const fg = getContrastForeground(newHex);
      const customConfig: ThemeConfig = {
        id: "custom",
        name: "Custom Palette",
        primaryHex: newHex,
        primaryForegroundHex: fg.hex,
        ringHex,
        accentHex,
        mode,
        description: "User customized garage color theme",
      };
      applyTheme(customConfig, false, false);
    }
  };

  // Handle focus ring & accent color change (instant 60fps live update without animation overhead)
  const handleRingChange = (newHex: string) => {
    isInitializedRef.current = true;
    setSelectedPresetId("custom");
    setRingHex(newHex);

    const clean = newHex.replace("#", "").trim();
    if (clean.length === 3 || clean.length === 6) {
      const fg = getContrastForeground(primaryHex);
      const customConfig: ThemeConfig = {
        id: "custom",
        name: "Custom Palette",
        primaryHex,
        primaryForegroundHex: fg.hex,
        ringHex: newHex,
        accentHex: newHex,
        mode,
        description: "User customized garage color theme",
      };
      applyTheme(customConfig, false, false);
    }
  };

  // Persist chosen colors to database (company_profiles)
  const handleSaveTheme = async () => {
    setSaving(true);
    try {
      const fg = getContrastForeground(primaryHex);
      const activePreset = THEME_PRESETS.find((p) => p.id === selectedPresetId);
      const themePayload: ThemeConfig = {
        id: selectedPresetId,
        name: activePreset ? activePreset.name : "Custom Palette",
        primaryHex,
        primaryForegroundHex: fg.hex,
        ringHex,
        accentHex,
        mode,
        description: activePreset ? activePreset.description : "Custom workshop UI theme",
      };

      // Save to localStorage immediately (no animation overhead during saving)
      applyTheme(themePayload, true, false);

      // Save to company_profiles
      const profileId = profile?.id;
      const updatedThemeSettings = {
        ...(profile?.theme_settings || {}),
        ...themePayload,
      };

      const updatedBankDetails = {
        ...(profile?.bank_details || {}),
        theme_settings: themePayload,
      };

      const updateData = {
        theme_settings: updatedThemeSettings,
        bank_details: updatedBankDetails,
      };

      if (profileId) {
        const { error } = await supabase
          .from("company_profiles")
          .update(updateData)
          .eq("id", profileId);

        if (error) throw error;
      } else {
        // Query existing profile if id not yet populated
        const { data: existing } = await supabase
          .from("company_profiles")
          .select("id")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from("company_profiles")
            .update(updateData)
            .eq("id", existing.id);
        }
      }

      if (onProfileUpdated) {
        onProfileUpdated({
          ...profile,
          theme_settings: updatedThemeSettings,
          bank_details: updatedBankDetails,
        });
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);

      toast({
        title: "Appearance & Theme Saved",
        description: "Your custom workshop appearance and colors have been saved across all devices.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Could not save theme",
        description: err.message || "An unexpected error occurred while saving theme settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset to default HavDox Onyx & Light Mode
  const handleResetToDefault = () => {
    const defaultPreset = THEME_PRESETS[0];
    handleSelectPreset(defaultPreset);
    setMode("light");
    toast({
      title: "Reset to Default",
      description: "Reset to official HavDox Obsidian Onyx theme and Light Mode.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="border border-border shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-xl font-display font-bold">
                <Palette className="h-5 w-5 text-primary" />
                Appearance & Brand Colors
              </CardTitle>
              <CardDescription>
                Customize Drive Flow’s interface mode (Dark / Light) and brand palette (buttons, badges, indicators, and focus rings).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetToDefault}
                className="h-9 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Reset Default
              </Button>
              <Button
                size="sm"
                onClick={handleSaveTheme}
                disabled={saving}
                className="h-9 px-4 text-xs font-semibold shadow-sm"
              >
                {savedSuccess ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-300" />
                    Saved!
                  </>
                ) : saving ? (
                  "Saving..."
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1.5" />
                    Save Appearance
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Section 0: Interface Appearance Mode (Light / Dark / System) */}
          <div className="space-y-3 pb-6 border-b border-border">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sun className="h-4 w-4 text-primary" />
                Interface Appearance Mode
              </Label>
              <Badge variant="outline" className="text-xs font-semibold">
                Current: {mode === "system" ? `System (${isDark ? "Dark" : "Light"})` : mode === "dark" ? "Dark Mode" : "Light Mode"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Light Mode Option */}
              <div
                onClick={() => setMode("light")}
                className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                  mode === "light"
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5 shadow-xs"
                    : "border-border/80 bg-card hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                    <Sun className="h-5 w-5" />
                  </div>
                  {mode === "light" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                      <Check className="h-3 w-3" />
                      Active
                    </span>
                  )}
                </div>
                <p className="font-display font-bold text-sm text-foreground">Light Mode</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Crisp, clean daylight surface with bright cards and high visual contrast.
                </p>
              </div>

              {/* Dark Mode Option */}
              <div
                onClick={() => setMode("dark")}
                className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                  mode === "dark"
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5 shadow-xs"
                    : "border-border/80 bg-card hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                    <Moon className="h-5 w-5" />
                  </div>
                  {mode === "dark" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                      <Check className="h-3 w-3" />
                      Active
                    </span>
                  )}
                </div>
                <p className="font-display font-bold text-sm text-foreground">Dark Mode</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  HavDox Obsidian midnight palette designed for reduced eye strain and sleek aesthetics.
                </p>
              </div>

              {/* System Preference Option */}
              <div
                onClick={() => setMode("system")}
                className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                  mode === "system"
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5 shadow-xs"
                    : "border-border/80 bg-card hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center border border-border">
                    <Laptop className="h-5 w-5" />
                  </div>
                  {mode === "system" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                      <Check className="h-3 w-3" />
                      Active
                    </span>
                  )}
                </div>
                <p className="font-display font-bold text-sm text-foreground">System Default</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Synchronizes seamlessly with your device or operating system preference.
                </p>
              </div>
            </div>
          </div>

          {/* Section 1: Curated Palette Presets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                Curated Garage Themes
              </Label>
              <span className="text-xs text-muted-foreground">Click any preset to preview live</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {THEME_PRESETS.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    style={{
                      borderColor: isSelected ? preset.primaryHex : undefined,
                      boxShadow: isSelected ? `0 0 0 2px ${preset.primaryHex}33` : undefined,
                    }}
                    className={`relative p-3.5 rounded-xl border text-left cursor-pointer transition-all hover:border-primary/50 group ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/20 bg-primary/5 shadow-xs"
                        : "border-border/80 bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      {/* Color swatch circles */}
                      <div className="flex items-center -space-x-1.5">
                        <div
                          className="w-6 h-6 rounded-full border-2 border-background shadow-xs ring-1 ring-black/10"
                          style={{ backgroundColor: preset.primaryHex }}
                          title={`Primary: ${preset.primaryHex}`}
                        />
                        <div
                          className="w-5 h-5 rounded-full border-2 border-background shadow-xs ring-1 ring-black/10"
                          style={{ backgroundColor: preset.ringHex || preset.primaryHex }}
                          title={`Ring/Glow: ${preset.ringHex}`}
                        />
                        <div
                          className="w-4 h-4 rounded-full border-2 border-background shadow-xs ring-1 ring-black/10"
                          style={{ backgroundColor: preset.accentHex || preset.primaryHex }}
                          title={`Accent: ${preset.accentHex}`}
                        />
                      </div>

                      {/* Selected badge or preset category */}
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                          <Check className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        preset.badge && (
                          <span className="text-[10px] text-muted-foreground font-medium px-1.5 py-0.5 rounded bg-muted">
                            {preset.badge}
                          </span>
                        )
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="font-display font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                        {preset.name}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Custom Color Chooser */}
          <div className="space-y-4 pt-4 border-t border-border">
            <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sliders className="h-4 w-4 text-primary" />
              Custom Color Palette Builder
            </Label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 rounded-xl bg-muted/30 border border-border">
              {/* Primary Color Picker */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="primaryColor" className="text-xs font-bold text-foreground">
                    Primary Brand Color (Buttons, Active States)
                  </Label>
                  <span className="text-xs font-mono font-bold uppercase text-muted-foreground">
                    {primaryHex}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      id="primaryColor"
                      type="color"
                      value={primaryHex}
                      onChange={(e) => handlePrimaryChange(e.target.value)}
                      className="w-12 h-11 rounded-lg border border-border cursor-pointer bg-transparent p-1 shadow-xs"
                      title="Choose primary brand color"
                    />
                  </div>
                  <Input
                    type="text"
                    value={primaryHex}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.startsWith("#") && val.length <= 7) {
                        handlePrimaryChange(val);
                      }
                    }}
                    placeholder="#f59e0b"
                    className="font-mono text-sm uppercase h-11 rounded-lg"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Controls buttons, header accents, active tabs, and priority highlights.
                </p>
              </div>

              {/* Accent & Focus Ring Color Picker */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ringColor" className="text-xs font-bold text-foreground">
                    Focus Ring & Accent Highlight
                  </Label>
                  <span className="text-xs font-mono font-bold uppercase text-muted-foreground">
                    {ringHex}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      id="ringColor"
                      type="color"
                      value={ringHex}
                      onChange={(e) => handleRingChange(e.target.value)}
                      className="w-12 h-11 rounded-lg border border-border cursor-pointer bg-transparent p-1 shadow-xs"
                      title="Choose focus ring & glow color"
                    />
                  </div>
                  <Input
                    type="text"
                    value={ringHex}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.startsWith("#") && val.length <= 7) {
                        handleRingChange(val);
                      }
                    }}
                    placeholder="#3b82f6"
                    className="font-mono text-sm uppercase h-11 rounded-lg"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Controls input focus glow, metric badge highlights, and subtle borders.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Live Component Preview Sandbox */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-primary" />
                Live Component Preview
              </Label>
              <Badge variant="outline" className="text-xs font-normal">
                Updates in real-time
              </Badge>
            </div>

            {/* Sandbox Card */}
            <div className="p-5 rounded-2xl border border-border/80 bg-background shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
                <div>
                  <h4 className="font-display font-bold text-sm text-foreground">
                    Active Theme: {themeName}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Preview how buttons, cards, and input fields will look across your workshop dashboard.
                  </p>
                </div>
                <Badge className="bg-primary text-primary-foreground font-semibold px-2.5 py-0.5">
                  Brand Theme
                </Badge>
              </div>

              {/* Sample Buttons & Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                {/* Button samples */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Primary & Secondary Buttons</Label>
                  <div className="flex flex-col gap-2">
                    <Button className="w-full font-semibold shadow-xs">
                      Primary Action
                    </Button>
                    <Button variant="outline" className="w-full">
                      Secondary Action
                    </Button>
                  </div>
                </div>

                {/* Badges & Status */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Badges & Indicators</Label>
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge className="bg-primary text-primary-foreground">Active Work Order</Badge>
                      <Badge variant="secondary">In Progress</Badge>
                      <Badge variant="outline">Pending</Badge>
                    </div>
                    {/* Simulated Focus Input */}
                    <Input
                      defaultValue="Vehicle KA-05-MB-1234"
                      className="h-9 text-xs ring-2 ring-ring/40 border-primary"
                    />
                  </div>
                </div>

                {/* Sample Metric Widget */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Metric Card Highlight</Label>
                  <div className="p-3 rounded-xl border border-border bg-card relative overflow-hidden shadow-xs">
                    <div
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{ backgroundColor: primaryHex }}
                    />
                    <div className="text-[11px] font-medium text-muted-foreground">Workshop Revenue Today</div>
                    <div className="text-xl font-bold font-display text-foreground mt-0.5">
                      ₹ 48,250
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                      <span>+14.2%</span> from last week
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
