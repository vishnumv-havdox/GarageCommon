import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
    QrCode, ScanLine, LogOut, Package, ClipboardList,
    Search, CheckCircle2, AlertTriangle, ArrowLeft, Loader2,
    Droplet, Zap, Wrench, Car, Settings, Activity, ShieldCheck,
    Sparkles, Check, X, Keyboard, ChevronRight
} from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function InventoryRoom() {
    const { user, signOut } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [selectedWO, setSelectedWO] = useState<any | null>(null);
    const [approvedParts, setApprovedParts] = useState<any[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [scannedSessionItems, setScannedSessionItems] = useState<any[]>([]);
    const [isProcessingScan, setIsProcessingScan] = useState(false);
    const [manualCode, setManualCode] = useState("");
    const [scanFeedback, setScanFeedback] = useState<'success' | 'error' | null>(null);

    const scannerRef = useRef<Html5QrcodeScanner | null>(null);
    const lastScannedTimeRef = useRef<Record<string, number>>({});

    useEffect(() => {
        fetchApprovedWorkOrders();
        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear();
            }
        };
    }, []);

    const fetchApprovedWorkOrders = async () => {
        setLoading(true);
        try {
            // Get WOs that have approved part requests which are not yet fully issued
            const { data, error } = await supabase
                .from("work_orders")
                .select(`
          id, 
          service_type, 
          status,
          vehicle:vehicles(vehicle_number),
          part_requests!inner(*)
        `)
                .eq("part_requests.status", "approved")
                .order("created_at", { ascending: false });

            if (error) throw error;

            // Filter out those where all approved are already issued (though inner join handle some, let's be explicit)
            const filtered = data?.filter(wo =>
                wo.part_requests.some((pr: any) => pr.status === 'approved')
            );

            setWorkOrders(filtered || []);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const selectWorkOrder = async (wo: any) => {
        setSelectedWO(wo);
        fetchApprovedParts(wo.id);
    };

    const fetchApprovedParts = async (woId: string) => {
        try {
            const { data, error } = await supabase
                .from("part_requests")
                .select(`
          *,
          inventory:inventory(item_name, brand_name, sku, qr_code)
        `)
                .eq("work_order_id", woId)
                .eq("status", "approved");

            if (error) throw error;
            setApprovedParts(data || []);
        } catch (error: any) {
            console.error(error);
        }
    };

    const onScanFailure = (error: any) => {
        // Many failures are just "No QR code detected" - we don't need to alert the user for every frame
        // console.warn(`QR scan error: ${error}`);
    };

    const startScanner = () => {
        setIsScanning(true);
        // Slightly longer delay to ensure the "reader" div is in the DOM
        setTimeout(() => {
            try {
                const scanner = new Html5QrcodeScanner(
                    "reader",
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0
                    },
                    /* verbose= */ false
                );

                scanner.render(onScanSuccess, onScanFailure);
                scannerRef.current = scanner;
            } catch (error: any) {
                console.error("Scanner init failed:", error);
                toast({
                    variant: "destructive",
                    title: "Scanner Error",
                    description: "Could not start camera. Please check permissions."
                });
                setIsScanning(false);
            }
        }, 300);
    };

    const stopScanner = () => {
        if (scannerRef.current) {
            scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
            scannerRef.current = null;
        }
        setIsScanning(false);
        setIsProcessingScan(false);
    };

    const playBeep = () => {
        try {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = context.createOscillator();
            const gain = context.createGain();

            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(880, context.currentTime); // A5 note
            gain.gain.setValueAtTime(0.1, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.2);

            oscillator.connect(gain);
            gain.connect(context.destination);

            oscillator.start();
            oscillator.stop(context.currentTime + 0.2);
        } catch (e) {
            console.warn("Audio beep failed", e);
        }
    };

    const onScanSuccess = async (decodedText: string) => {
        if (isProcessingScan) return;

        // Cooldown check to prevent rapid duplicate scans of the same code
        const now = Date.now();
        const lastTime = lastScannedTimeRef.current[decodedText] || 0;
        if (now - lastTime < 3000) return; // 3 second cooldown per specific QR

        setIsProcessingScan(true);
        playBeep();

        try {
            // 1. Try Unit-Level Scan first
            const { data: emp } = await supabase.from("employees").select("id").eq("user_id", user?.id).single();
            if (!emp) throw new Error("Employee record not found");

            const { data: unitResult, error: unitError } = await supabase.rpc("scan_and_issue_unit", {
                _qr_code: decodedText,
                _work_order_id: selectedWO.id,
                _employee_id: emp.id
            });

            if (unitError) throw unitError;
            if (!unitResult) throw new Error("No response from server");

            if (unitResult.success) {
                setScanFeedback('success');
                setTimeout(() => setScanFeedback(null), 1000);
                toast({
                    title: "Unit Issued ✅",
                    description: `${unitResult.item_name} confirmed.`
                });

                // Add to session history
                setScannedSessionItems(prev => [{
                    id: Math.random().toString(),
                    item_name: unitResult.item_name,
                    brand: unitResult.brand_name, // Assuming the RPC might return this eventually, or it will be undefined for now
                    sku: decodedText.split('-')[0], // Extract SKU if possible
                    qr: decodedText,
                    time: new Date().toLocaleTimeString()
                }, ...prev]);

                lastScannedTimeRef.current[decodedText] = Date.now();
                fetchApprovedParts(selectedWO.id);
                return;
            }

            // 2. Fallback to Legacy SKU Match
            if (unitResult.code === 'NOT_FOUND') {
                const part = approvedParts.find(p =>
                    p.inventory?.sku === decodedText || p.inventory?.qr_code === decodedText
                );

                if (part) {
                    setScanFeedback('success');
                    setTimeout(() => setScanFeedback(null), 1000);
                    await handleIssuePart(part);
                    lastScannedTimeRef.current[decodedText] = Date.now();

                    setScannedSessionItems(prev => [{
                        id: Math.random().toString(),
                        item_name: part.inventory?.item_name || "Unknown Item",
                        brand: part.inventory?.brand_name,
                        sku: decodedText,
                        qr: decodedText,
                        time: new Date().toLocaleTimeString()
                    }, ...prev]);
                } else {
                    setScanFeedback('error');
                    setTimeout(() => setScanFeedback(null), 1000);
                    toast({
                        variant: "destructive",
                        title: "Invalid Part",
                        description: "No match for this code."
                    });
                }
            } else {
                setScanFeedback('error');
                setTimeout(() => setScanFeedback(null), 1000);
                toast({
                    variant: "destructive",
                    title: "Issue Failed",
                    description: unitResult.message
                });
            }

        } catch (error: any) {
            setScanFeedback('error');
            setTimeout(() => setScanFeedback(null), 1000);
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setIsProcessingScan(false);
        }
    };

    const handleIssuePart = async (request: any) => {
        // Legacy Issue Flow (SKU Match)
        try {
            const { data: emp } = await supabase.from("employees").select("id").eq("user_id", user?.id).single();
            if (!emp) throw new Error("Employee record not found");

            const { error } = await supabase.rpc("issue_part_request", {
                _request_id: request.id,
                _issued_qty: 1,
                _employee_id: emp.id
            });

            if (error) throw error;

            toast({
                title: "Part Issued ✅",
                description: `${request.inventory.item_name} has been added to the Work Order.`
            });

            fetchApprovedParts(selectedWO.id);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualCode.trim()) return;
        const code = manualCode.trim();
        setManualCode("");
        await onScanSuccess(code);
    };

    const getServiceIcon = (type: string) => {
        const lower = type.toLowerCase();
        if (lower.includes("oil") || lower.includes("fluid") || lower.includes("lubricant") || lower.includes("brake")) return Droplet;
        if (lower.includes("electric") || lower.includes("battery") || lower.includes("wiring") || lower.includes("light")) return Zap;
        if (lower.includes("engine") || lower.includes("spark") || lower.includes("filter") || lower.includes("tune")) return Wrench;
        if (lower.includes("wheel") || lower.includes("tyre") || lower.includes("suspension")) return Settings;
        return Car;
    };

    if (!selectedWO) {
        return (
            <div className="min-h-screen bg-background p-4 md:p-8 relative overflow-hidden">
                {/* Visual ambient backgrounds */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

                <div className="max-w-5xl mx-auto space-y-8">
                    {/* Header */}
                    <div className="flex items-center justify-between bg-card/40 backdrop-blur-md p-6 rounded-2xl border border-border/50 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3.5 bg-gradient-to-tr from-primary to-blue-600 rounded-xl text-primary-foreground shadow-lg shadow-primary/20">
                                <Package className="h-6 w-6 animate-pulse" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
                                    Inventory Room Kiosk
                                </h1>
                                <p className="text-muted-foreground text-sm">Select an active vehicle work order to scan and issue parts</p>
                            </div>
                        </div>

                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="rounded-xl border-border/60 hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all duration-200"
                            onClick={() => {
                                if (user?.role === 'admin') {
                                    navigate("/admin/inventory");
                                } else {
                                    signOut().then(() => window.location.href = "/inventory/login");
                                }
                            }}
                            title={user?.role === 'admin' ? "Return to Inventory Dashboard" : "Sign Out"}
                        >
                            {user?.role === 'admin' ? <LogOut className="h-5 w-5 rotate-180" /> : <LogOut className="h-5 w-5" />}
                        </Button>
                    </div>

                    {/* Search & Filter bar */}
                    <Card className="border-border/50 shadow-md bg-card/60 backdrop-blur-md overflow-hidden">
                        <CardHeader className="p-4 md:p-6 pb-2">
                            <div className="relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/70" />
                                <Input
                                    placeholder="Search by Vehicle Number plate or Service Type..."
                                    className="pl-11 h-12 bg-muted/40 border-border/50 focus-visible:ring-primary rounded-xl text-md"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="p-16 text-center flex flex-col items-center gap-3">
                                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                    <p className="text-muted-foreground font-medium">Loading active work orders...</p>
                                </div>
                            ) : (
                                <div className="p-4 md:p-6">
                                    {workOrders.filter(wo =>
                                        wo.vehicle?.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        wo.service_type.toLowerCase().includes(searchTerm.toLowerCase())
                                    ).length === 0 ? (
                                        <div className="py-16 text-center border-2 border-dashed border-border/60 rounded-xl bg-muted/10">
                                            <ClipboardList className="h-14 w-14 text-muted-foreground/60 mx-auto mb-4" />
                                            <h3 className="text-lg font-bold text-foreground mb-1">No Active Orders Found</h3>
                                            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                                                There are currently no active work orders with approved and unissued parts.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                            {workOrders.filter(wo =>
                                                wo.vehicle?.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                wo.service_type.toLowerCase().includes(searchTerm.toLowerCase())
                                            ).map((wo) => {
                                                const ServiceIcon = getServiceIcon(wo.service_type);
                                                const approvedCount = wo.part_requests.filter((p: any) => p.status === 'approved').length;
                                                
                                                // Icon color based on service type
                                                let iconBg = "bg-blue-500/10 text-blue-500 border-blue-500/20";
                                                if (wo.service_type.toLowerCase().includes("electric") || wo.service_type.toLowerCase().includes("wire")) {
                                                    iconBg = "bg-amber-500/10 text-amber-500 border-amber-500/20";
                                                } else if (wo.service_type.toLowerCase().includes("engine") || wo.service_type.toLowerCase().includes("spark")) {
                                                    iconBg = "bg-red-500/10 text-red-500 border-red-500/20";
                                                } else if (wo.service_type.toLowerCase().includes("oil") || wo.service_type.toLowerCase().includes("fluid")) {
                                                    iconBg = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
                                                }

                                                return (
                                                    <button
                                                        key={wo.id}
                                                        onClick={() => selectWorkOrder(wo)}
                                                        className="group relative flex flex-col justify-between p-5 bg-card/40 border border-border/60 hover:border-primary/50 hover:bg-card rounded-2xl transition-all duration-300 hover:shadow-lg text-left h-44 cursor-pointer overflow-hidden"
                                                    >
                                                        {/* Top row */}
                                                        <div className="flex items-start justify-between w-full gap-3">
                                                            <div className={cn("p-3 rounded-xl border", iconBg)}>
                                                                <ServiceIcon className="h-5 w-5" />
                                                            </div>
                                                            {/* Vehicle License Plate Visual */}
                                                            <div className="px-3 py-1 bg-secondary border border-border/80 text-foreground font-mono text-xs font-bold rounded shadow-sm uppercase tracking-wider relative flex items-center gap-1.5">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                                {wo.vehicle?.vehicle_number}
                                                            </div>
                                                        </div>

                                                        {/* Middle detail */}
                                                        <div className="space-y-1">
                                                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Service Type</p>
                                                            <p className="text-sm font-semibold truncate text-foreground/90 uppercase">{wo.service_type}</p>
                                                        </div>

                                                        {/* Bottom status */}
                                                        <div className="flex items-center justify-between w-full border-t border-border/40 pt-3 mt-1">
                                                            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 py-0.5 px-2">
                                                                {approvedCount} Parts Approved
                                                            </Badge>
                                                            <span className="text-xs text-primary font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                                                Scan Now 
                                                                <ChevronRight className="h-3.5 w-3.5" />
                                                            </span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    const totalApproved = approvedParts.reduce((acc, p) => acc + (p.approved_qty || 0), 0);
    const totalIssued = approvedParts.reduce((acc, p) => acc + (p.issued_qty || 0), 0);
    const totalRemaining = Math.max(0, totalApproved - totalIssued);
    const completionPercent = totalApproved > 0 ? Math.round((totalIssued / totalApproved) * 100) : 0;

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 relative overflow-hidden">
            {/* Inline CSS animation styles for the laser scanner and feedback flashes */}
            <style>{`
                @keyframes scan-laser {
                    0%, 100% { top: 0%; opacity: 0.3; }
                    50% { top: 100%; opacity: 1; }
                }
                .laser-line {
                    position: absolute;
                    left: 0;
                    width: 100%;
                    height: 3px;
                    background: linear-gradient(90deg, transparent, #22c55e, transparent);
                    box-shadow: 0 0 10px #22c55e;
                    animation: scan-laser 2.5s ease-in-out infinite;
                    pointer-events: none;
                    z-index: 10;
                }
                @keyframes pulse-ring {
                    0% { transform: scale(0.98); opacity: 0.5; }
                    50% { transform: scale(1.02); opacity: 0.9; }
                    100% { transform: scale(0.98); opacity: 0.5; }
                }
                .pulse-scanner {
                    animation: pulse-ring 2s infinite;
                }
                .flash-success {
                    background-color: rgba(34, 197, 94, 0.2);
                    border: 2px solid #22c55e;
                }
                .flash-error {
                    background-color: rgba(239, 68, 68, 0.2);
                    border: 2px solid #ef4444;
                }
            `}</style>
            
            {/* Visual ambient backgrounds */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

            <div className="max-w-6xl mx-auto space-y-6">
                {/* Back button and title */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/40 backdrop-blur-md p-5 rounded-2xl border border-border/50 shadow-sm animate-in fade-in duration-200">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl text-muted-foreground hover:text-foreground transition-all"
                            onClick={() => {
                                stopScanner();
                                setSelectedWO(null);
                            }}
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" /> Back
                        </Button>
                        <div className="h-6 w-px bg-border hidden sm:block" />
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-extrabold tracking-tight uppercase">{selectedWO.vehicle?.vehicle_number}</h2>
                                <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">Active Console</Badge>
                            </div>
                            <p className="text-muted-foreground text-xs uppercase font-semibold tracking-wider">{selectedWO.service_type}</p>
                        </div>
                    </div>
                    
                    {/* Compact progress indicator */}
                    <div className="flex items-center gap-3 bg-background/50 border border-border/60 py-1.5 px-3.5 rounded-xl text-sm self-start sm:self-auto">
                        <Activity className="h-4 w-4 text-primary animate-pulse" />
                        <span className="font-bold text-foreground">{completionPercent}%</span>
                        <span className="text-muted-foreground text-xs">Issued ({totalIssued}/{totalApproved})</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Info & Parts List */}
                    <div className="lg:col-span-5 space-y-6">
                        {/* Progress Panel */}
                        <Card className="border-border/50 shadow-md bg-card/60 backdrop-blur-md">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-md font-bold uppercase tracking-wider text-muted-foreground">Console Progress</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div className="bg-background/40 border p-2.5 rounded-xl">
                                        <p className="text-2xl font-black text-foreground">{totalApproved}</p>
                                        <p className="text-[10px] text-muted-foreground font-semibold uppercase">Approved</p>
                                    </div>
                                    <div className="bg-emerald-500/5 border border-emerald-500/20 p-2.5 rounded-xl">
                                        <p className="text-2xl font-black text-emerald-500">{totalIssued}</p>
                                        <p className="text-[10px] text-emerald-600 font-semibold uppercase">Issued</p>
                                    </div>
                                    <div className="bg-primary/5 border border-primary/20 p-2.5 rounded-xl">
                                        <p className="text-2xl font-black text-primary">{totalRemaining}</p>
                                        <p className="text-[10px] text-primary-foreground/75 font-semibold uppercase">Remaining</p>
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-muted-foreground font-medium">
                                        <span>Status Check</span>
                                        <span>{completionPercent}% Complete</span>
                                    </div>
                                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-blue-500 to-primary rounded-full transition-all duration-500" 
                                            style={{ width: `${completionPercent}%` }}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Approved Parts List */}
                        <Card className="border-border/50 shadow-md bg-card/60 backdrop-blur-md">
                            <CardHeader className="pb-3 border-b border-border/40">
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <ClipboardList className="h-5 w-5 text-primary" />
                                    Approved Parts to Issue
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-border/60 max-h-[380px] overflow-y-auto px-4">
                                    {approvedParts.length === 0 ? (
                                        <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                                            <ShieldCheck className="h-10 w-10 text-emerald-500/80" />
                                            <p className="font-semibold text-foreground">All parts successfully issued!</p>
                                            <p className="text-xs">No pending parts remain for this work order.</p>
                                        </div>
                                    ) : (
                                        approvedParts.map((part) => {
                                            const remaining = (part.approved_qty || 1) - (part.issued_qty || 0);
                                            const isDone = remaining <= 0;
                                            return (
                                                <div 
                                                    key={part.id} 
                                                    className={cn(
                                                        "py-4 flex items-center justify-between transition-colors",
                                                        isDone && "opacity-60 bg-muted/5"
                                                    )}
                                                >
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold text-sm text-foreground/90">{part.inventory?.item_name}</p>
                                                            {isDone && <Check className="h-4 w-4 text-emerald-500" />}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                                                            {part.inventory?.brand_name && (
                                                                <span className="text-blue-500 font-semibold">{part.inventory.brand_name}</span>
                                                            )}
                                                            <span>SKU: {part.inventory?.sku || "N/A"}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="text-right flex flex-col items-end gap-1.5">
                                                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Remaining</span>
                                                        <div className="flex items-center gap-2">
                                                            <Badge 
                                                                variant="outline" 
                                                                className={cn(
                                                                    "font-bold font-mono py-1 px-2 h-7 flex items-center justify-center",
                                                                    isDone 
                                                                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                                                                        : "bg-secondary text-foreground border-border/80"
                                                                )}
                                                            >
                                                                {remaining} Unit{remaining !== 1 ? 's' : ''}
                                                            </Badge>
                                                            {!isDone && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-7 px-2.5 text-xs border-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                                                                    onClick={async () => {
                                                                        setLoading(true);
                                                                        await handleIssuePart(part);
                                                                        setScannedSessionItems(prev => [{
                                                                            id: Math.random().toString(),
                                                                            item_name: part.inventory?.item_name || "Unknown Item",
                                                                            brand: part.inventory?.brand_name,
                                                                            sku: part.inventory?.sku || part.inventory?.qr_code || "Manual",
                                                                            qr: part.inventory?.qr_code || "Manual",
                                                                            time: new Date().toLocaleTimeString()
                                                                        }, ...prev]);
                                                                    }}
                                                                >
                                                                    Issue 1
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Camera Scan & Manual input & Session History */}
                    <div className="lg:col-span-7 space-y-6">
                        {/* Scanner card */}
                        <Card className="border-border/50 shadow-md bg-card/60 backdrop-blur-md overflow-hidden">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg font-bold flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <ScanLine className="h-5 w-5 text-primary" />
                                        Optical Scanner
                                    </span>
                                    {isScanning && (
                                        <Badge className="bg-emerald-500 text-white animate-pulse flex items-center gap-1.5 rounded-full py-0.5 px-2.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                            Live feed active
                                        </Badge>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {isScanning ? (
                                    <div className="space-y-4">
                                        {/* Scanner View Container */}
                                        <div className="relative overflow-hidden rounded-2xl border-2 border-primary bg-black max-w-sm mx-auto aspect-square pulse-scanner shadow-xl">
                                            <div id="reader" className="w-full h-full object-cover"></div>
                                            
                                            {/* Laser scanning visual line */}
                                            <div className="laser-line" />

                                            {/* Glowing Corners */}
                                            <div className="absolute top-3 left-3 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl pointer-events-none" />
                                            <div className="absolute top-3 right-3 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr pointer-events-none" />
                                            <div className="absolute bottom-3 left-3 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl pointer-events-none" />
                                            <div className="absolute bottom-3 right-3 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br pointer-events-none" />

                                            {/* Flash Overlay for scan feedback */}
                                            {scanFeedback && (
                                                <div 
                                                    className={cn(
                                                        "absolute inset-0 flex items-center justify-center transition-all duration-300 z-20",
                                                        scanFeedback === 'success' ? "flash-success text-emerald-400" : "flash-error text-red-500"
                                                    )}
                                                >
                                                    <div className="p-4 bg-black/60 rounded-full backdrop-blur-md border border-white/10 scale-110 animate-in zoom-in-75 duration-200">
                                                        {scanFeedback === 'success' ? (
                                                            <Check className="h-10 w-10 stroke-[3]" />
                                                        ) : (
                                                            <X className="h-10 w-10 stroke-[3]" />
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {isProcessingScan && (
                                            <div className="flex items-center justify-center gap-2 text-primary animate-pulse py-2 bg-primary/5 rounded-xl border border-primary/20 max-w-xs mx-auto">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span className="text-xs font-semibold">Processing QR/SKU data...</span>
                                            </div>
                                        )}

                                        <Button
                                            variant="destructive"
                                            className="w-full h-12 rounded-xl text-md font-bold shadow-lg shadow-destructive/10 animate-in slide-in-from-bottom duration-200"
                                            onClick={stopScanner}
                                        >
                                            Stop Camera Scan
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        className="w-full h-32 rounded-2xl text-lg font-bold flex flex-col gap-2.5 shadow-xl shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all bg-gradient-to-tr from-primary to-blue-600 hover:from-primary/95 hover:to-blue-600/95"
                                        onClick={startScanner}
                                        disabled={approvedParts.length === 0}
                                    >
                                        <div className="p-3 bg-white/10 rounded-full border border-white/10">
                                            <ScanLine className="h-7 w-7 text-white" />
                                        </div>
                                        <span>Start Continuous Scan</span>
                                    </Button>
                                )}
                            </CardContent>
                        </Card>

                        {/* Manual entry backup */}
                        <Card className="border-border/50 shadow-md bg-card/60 backdrop-blur-md">
                            <CardHeader className="py-3 pb-2">
                                <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                                    <Keyboard className="h-4 w-4" />
                                    Manual Code Backup Entry
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <form onSubmit={handleManualSubmit} className="flex gap-2">
                                    <Input
                                        placeholder="Type Item QR Code or SKU..."
                                        className="bg-background/40 border-border/50 text-sm h-10 rounded-xl"
                                        value={manualCode}
                                        onChange={(e) => setManualCode(e.target.value)}
                                        disabled={approvedParts.length === 0}
                                    />
                                    <Button 
                                        type="submit" 
                                        variant="secondary"
                                        className="h-10 rounded-xl px-4 border"
                                        disabled={approvedParts.length === 0 || !manualCode.trim() || isProcessingScan}
                                    >
                                        Issue
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        {/* Just Scanned History */}
                        {scannedSessionItems.length > 0 && (
                            <Card className="border-border/50 shadow-md bg-card/60 backdrop-blur-md">
                                <CardHeader className="pb-2 border-b border-border/40">
                                    <CardTitle className="text-foreground text-md flex items-center justify-between">
                                        <span className="flex items-center gap-2 font-bold">
                                            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                                            Session Scan Logs
                                        </span>
                                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-bold font-mono">
                                            {scannedSessionItems.length} Issued
                                        </Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="max-h-[220px] overflow-y-auto divide-y divide-border/60">
                                        {scannedSessionItems.map((item) => (
                                            <div 
                                                key={item.id} 
                                                className="p-3.5 flex items-center justify-between hover:bg-muted/10 transition-colors animate-in slide-in-from-left duration-200"
                                            >
                                                <div className="space-y-0.5">
                                                    <p className="font-bold text-sm text-foreground/90">
                                                        {item.brand && (
                                                            <span className="text-blue-500 mr-1.5">[{item.brand}]</span>
                                                        )}
                                                        {item.item_name}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground font-mono">{item.qr}</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] text-muted-foreground font-semibold px-2 py-0.5 bg-secondary rounded border">{item.time}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Fullscreen loading overlay */}
            {loading && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-card p-8 rounded-2xl flex flex-col items-center gap-4 border border-border/80 shadow-2xl max-w-xs text-center">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <div>
                            <p className="font-extrabold text-foreground text-md">Updating Kiosk Data</p>
                            <p className="text-xs text-muted-foreground mt-1">Deducting inventory and updating billing...</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
