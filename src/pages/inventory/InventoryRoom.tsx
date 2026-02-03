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
    Search, CheckCircle2, AlertTriangle, ArrowLeft, Loader2
} from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function InventoryRoom() {
    const { user, signOut } = useAuth();
    const { toast } = useToast();

    const [loading, setLoading] = useState(false);
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [selectedWO, setSelectedWO] = useState<any | null>(null);
    const [approvedParts, setApprovedParts] = useState<any[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [scannedSessionItems, setScannedSessionItems] = useState<any[]>([]);
    const [isProcessingScan, setIsProcessingScan] = useState(false);

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
          inventory:inventory(item_name, sku, qr_code)
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
                toast({
                    title: "Unit Issued ✅",
                    description: `${unitResult.item_name} confirmed.`
                });

                // Add to session history
                setScannedSessionItems(prev => [{
                    id: Math.random().toString(),
                    item_name: unitResult.item_name,
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
                    await handleIssuePart(part);
                    lastScannedTimeRef.current[decodedText] = Date.now();

                    setScannedSessionItems(prev => [{
                        id: Math.random().toString(),
                        item_name: part.inventory?.item_name || "Unknown Item",
                        sku: decodedText,
                        qr: decodedText,
                        time: new Date().toLocaleTimeString()
                    }, ...prev]);
                } else {
                    toast({
                        variant: "destructive",
                        title: "Invalid Part",
                        description: "No match for this code."
                    });
                }
            } else {
                toast({
                    variant: "destructive",
                    title: "Issue Failed",
                    description: unitResult.message
                });
            }

        } catch (error: any) {
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

    if (!selectedWO) {
        return (
            <div className="min-h-screen bg-slate-50 p-4 md:p-8">
                <div className="max-w-4xl mx-auto space-y-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary rounded-xl text-white">
                                <Package className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">Inventory Room</h1>
                                <p className="text-slate-500 text-sm">Select a Work Order to begin scanning parts</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => signOut().then(() => window.location.href = "/inventory/login")}>
                            <LogOut className="h-5 w-5" />
                        </Button>
                    </div>

                    <Card className="border-none shadow-lg">
                        <CardHeader className="bg-white rounded-t-lg pb-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search Vehicle or Service..."
                                    className="pl-10 h-11 bg-slate-50 border-none"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y border-t">
                                {loading ? (
                                    <div className="p-12 text-center flex flex-col items-center gap-3">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <p className="text-slate-500">Loading work orders...</p>
                                    </div>
                                ) : workOrders.filter(wo =>
                                    wo.vehicle?.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    wo.service_type.toLowerCase().includes(searchTerm.toLowerCase())
                                ).length === 0 ? (
                                    <div className="p-12 text-center bg-white rounded-b-lg">
                                        <ClipboardList className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                                        <p className="text-slate-400">No active work orders with approved parts found.</p>
                                    </div>
                                ) : (
                                    workOrders.map((wo) => (
                                        <button
                                            key={wo.id}
                                            onClick={() => selectWorkOrder(wo)}
                                            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left bg-white"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                                                    {wo.vehicle?.vehicle_number.substring(0, 2)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900">{wo.vehicle?.vehicle_number}</p>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wide">{wo.service_type}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2 text-right">
                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                                    {wo.part_requests.filter((p: any) => p.status === 'approved').length} Parts Approved
                                                </Badge>
                                                <ChevronRight className="h-4 w-4 text-slate-300" />
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4">
            <div className="max-w-md mx-auto space-y-6">
                <Button
                    variant="ghost"
                    className="text-slate-400 hover:text-white -ml-4"
                    onClick={() => {
                        stopScanner();
                        setSelectedWO(null);
                    }}
                >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to List
                </Button>

                <div className="flex items-center gap-4 mb-4">
                    <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-white">
                        <QrCode className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">{selectedWO.vehicle?.vehicle_number}</h2>
                        <p className="text-slate-400 text-sm">{selectedWO.service_type}</p>
                    </div>
                </div>

                <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white text-lg flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-blue-400" />
                            Approved Parts
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-700 px-4 pb-4">
                            {approvedParts.length === 0 ? (
                                <div className="py-8 text-center text-slate-500 italic">
                                    All approved parts have been issued.
                                </div>
                            ) : (
                                approvedParts.map((part) => (
                                    <div key={part.id} className="py-3 flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-slate-200">{part.inventory?.item_name}</p>
                                            <p className="text-xs text-slate-500 font-mono">SKU: {part.inventory?.sku}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs text-slate-500 block mb-1">Approved Qty</span>
                                            <Badge className="bg-slate-700 text-blue-400 border-slate-600">
                                                {part.approved_qty - part.issued_qty} Remaining
                                            </Badge>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {isScanning ? (
                    <div className="space-y-4">
                        <div id="reader" className="overflow-hidden rounded-2xl border-2 border-primary bg-black aspect-square"></div>

                        {isProcessingScan && (
                            <div className="flex items-center justify-center gap-2 text-primary animate-pulse py-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-sm font-medium">Processing Scan...</span>
                            </div>
                        )}

                        <Button
                            variant="destructive"
                            className="w-full h-12 rounded-xl text-lg font-bold"
                            onClick={stopScanner}
                        >
                            Stop Scanning
                        </Button>
                    </div>
                ) : (
                    <Button
                        className="w-full h-24 rounded-2xl text-xl font-bold flex flex-col gap-2 shadow-2xl shadow-primary/20"
                        onClick={startScanner}
                        disabled={approvedParts.length === 0}
                    >
                        <ScanLine className="h-8 w-8 animate-pulse" />
                        Start Continuous Scan
                    </Button>
                )}

                {/* Session History Table */}
                {scannedSessionItems.length > 0 && (
                    <Card className="bg-slate-800 border-slate-700 mt-6">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-white text-md flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                                    Just Scanned
                                </span>
                                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                                    {scannedSessionItems.length} Items
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-700">
                                {scannedSessionItems.map((item) => (
                                    <div key={item.id} className="p-3 flex items-center justify-between animate-in slide-in-from-left duration-300">
                                        <div>
                                            <p className="font-medium text-slate-200 text-sm">{item.item_name}</p>
                                            <p className="text-[10px] text-slate-500 font-mono italic">{item.qr}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-500">{item.time}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {loading && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-slate-800 p-8 rounded-2xl flex flex-col items-center gap-4 border border-slate-700">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="font-bold">Loading Data...</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const ChevronRight = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
);
