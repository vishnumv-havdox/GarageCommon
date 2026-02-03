import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
    Package, Plus, Search, CheckCircle2, Clock, AlertCircle,
    Triangle, Trash2, QrCode, ClipboardList, ArrowLeftRight
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface PartRequest {
    id: string;
    item_id: string;
    inventory: { item_name: string; sku: string; unit_price: number } | null;
    requested_qty: number;
    approved_qty: number;
    issued_qty: number;
    status: string;
    requested_by: string;
    employee: { name: string } | null;
    created_at: string;
}

interface PartRequestListProps {
    workOrderId: string;
    isAdmin?: boolean;
    isReadOnly?: boolean;
}

export function PartRequestList({ workOrderId, isAdmin, isReadOnly = false }: PartRequestListProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [requests, setRequests] = useState<PartRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
    const [currentEmployeeId, setCurrentEmployeeId] = useState<string>("");
    const [isLinking, setIsLinking] = useState(false);
    const [returns, setReturns] = useState<any[]>([]);

    // New request form state
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [selectedItemId, setSelectedItemId] = useState("");
    const [qty, setQty] = useState(1);
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

    // Return request state
    const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
    const [selectedReqForReturn, setSelectedReqForReturn] = useState<PartRequest | null>(null);
    const [returnQty, setReturnQty] = useState(1);
    const [returnReason, setReturnReason] = useState("");
    const [returnCondition, setReturnCondition] = useState("unused");
    const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

    useEffect(() => {
        fetchRequests();
        if (user?.id) {
            fetchCurrentEmployee();
        }
        if (isRequestDialogOpen) {
            fetchInventoryAndEmployees();
        }
    }, [workOrderId, isRequestDialogOpen, user?.id]);

    const fetchCurrentEmployee = async () => {
        try {
            const { data, error } = await supabase
                .from("employees")
                .select("id")
                .eq("user_id", user?.id)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                const employee = data as any;
                setCurrentEmployeeId(employee.id);
                if (!isAdmin) setSelectedEmployeeId(employee.id);
            }
        } catch (error) {
            console.error("Error fetching employee ID:", error);
        }
    };

    const handleAutoLink = async () => {
        if (!user) return;
        setIsLinking(true);
        try {
            // First, make sure we have a position to assign
            const { data: posData } = await supabase.from("positions").select("id").limit(1).single();

            if (!posData) {
                throw new Error("No positions found in database. Please create a position in the Employees section first.");
            }

            // @ts-ignore - bypassing Postgrest typing issue for dynamic insert
            const { data, error } = await supabase.from("employees").insert([{
                user_id: user.id,
                name: user.full_name || user.email?.split('@')[0] || "Admin",
                email: user.email,
                access_level: "admin",
                position_id: posData.id,
                status: "active"
            }]).select().single();

            if (error) throw error;

            toast({ title: "Account Linked", description: "Your admin account is now linked for inventory actions." });
            const linkedEmployee = data as any;
            setCurrentEmployeeId(linkedEmployee.id);
            if (!isAdmin) setSelectedEmployeeId(linkedEmployee.id);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Linking Failed", description: error.message });
        } finally {
            setIsLinking(false);
        }
    };

    const fetchRequests = async () => {
        try {
            const { data, error } = await supabase
                .from("part_requests")
                .select(`
          *,
          inventory:inventory(item_name, sku, unit_price),
          employee:employees(name)
        `)
                .eq("work_order_id", workOrderId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setRequests(data || []);

            const { data: returnData, error: returnError } = await supabase
                .from("inventory_returns")
                .select(`
                    *,
                    inventory:inventory(item_name, sku, unit_price),
                    employee:employees!requested_by(name)
                `)
                .eq("work_order_id", workOrderId)
                .order("created_at", { ascending: false });

            if (returnError) throw returnError;
            setReturns(returnData || []);
        } catch (error: any) {
            console.error("Error fetching requests:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchInventoryAndEmployees = async () => {
        try {
            const { data: inv } = await supabase.from("inventory").select("id, item_name, sku, available_qty").gt("available_qty", 0);
            const { data: emp } = await supabase.from("employees").select("id, name").eq("status", "active");
            setInventoryItems(inv || []);
            setEmployees(emp || []);
        } catch (error) {
            console.error(error);
        }
    };

    const handleCreateRequest = async () => {
        const finalRequesterId = isAdmin ? selectedEmployeeId : currentEmployeeId;

        if (!selectedItemId || !finalRequesterId || qty <= 0) {
            toast({ variant: "destructive", title: "Error", description: "Please fill all fields" });
            return;
        }

        try {
            const { error } = await (supabase.from("part_requests") as any).insert([{
                work_order_id: workOrderId,
                item_id: selectedItemId,
                requested_by: finalRequesterId,
                requested_qty: qty,
                status: "pending"
            }]);

            if (error) throw error;
            toast({ title: "Success", description: "Part request submitted" });
            setIsRequestDialogOpen(false);
            fetchRequests();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    const handleReturnRequest = async () => {
        if (!selectedReqForReturn || !currentEmployeeId || returnQty <= 0) {
            toast({ variant: "destructive", title: "Error", description: "Invalid return request" });
            return;
        }

        if (returnQty > selectedReqForReturn.issued_qty) {
            toast({ variant: "destructive", title: "Error", description: "Cannot return more than issued quantity" });
            return;
        }

        setIsSubmittingReturn(true);
        try {
            const { data: returnId, error: rpcError } = await (supabase.rpc as any)("request_part_return", {
                _work_order_id: workOrderId,
                _inventory_id: selectedReqForReturn.item_id,
                _quantity: returnQty,
                _reason: returnReason,
                _condition: returnCondition,
                _employee_id: currentEmployeeId
            });

            if (rpcError) throw rpcError;

            toast({ title: "Return Requested", description: "Return request submitted for approval" });
            setIsReturnDialogOpen(false);
            setSelectedReqForReturn(null);
            setReturnReason("");
            setReturnQty(1);
            fetchRequests();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setIsSubmittingReturn(false);
        }
    };

    const handleApprove = async (requestId: string, approvedQty: number) => {
        if (!currentEmployeeId) {
            if (isAdmin) {
                toast({
                    variant: "destructive",
                    title: "Action Required",
                    description: "Admins must link their account to the Employee database before approving parts. Click the 'Link Admin Account' button above.",
                    duration: 5000
                });
            } else {
                toast({ variant: "destructive", title: "Wait", description: "Your employee record is still loading. Please try again in a moment." });
            }
            return;
        }
        try {
            const { error: rpcError } = await (supabase.rpc as any)("approve_part_request", {
                _request_id: requestId,
                _approved_qty: approvedQty,
                _admin_id: currentEmployeeId
            });

            if (rpcError) throw rpcError;
            toast({ title: "Approved", description: "Request approved and stock reserved" });
            fetchRequests();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    const handleReject = async (requestId: string) => {
        if (!currentEmployeeId) {
            toast({ variant: "destructive", title: "Error", description: "Employee ID not found" });
            return;
        }

        const notes = prompt("Reason for rejection/cancellation:", "Not required anymore");
        if (notes === null) return; // User cancelled prompt

        try {
            const { error: rpcError } = await (supabase.rpc as any)("reject_part_request", {
                _request_id: requestId,
                _admin_id: currentEmployeeId,
                _notes: notes || "Cancelled by Admin"
            });

            if (rpcError) throw rpcError;
            toast({ title: "Updated", description: "Part request has been rejected/cancelled and stock unreserved if applicable." });
            fetchRequests();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    const handleReleaseRemainder = async (requestId: string) => {
        if (!currentEmployeeId) {
            toast({ variant: "destructive", title: "Error", description: "Employee ID not found" });
            return;
        }

        if (!confirm("Are you sure you want to release the unissued portion of this reservation back to stock?")) return;

        try {
            const { error: rpcError } = await (supabase.rpc as any)("release_unissued_reservation", {
                _request_id: requestId,
                _admin_id: currentEmployeeId
            });

            if (rpcError) throw rpcError;
            toast({ title: "Stock Released", description: "Unissued reserved units have been returned to available stock." });
            fetchRequests();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "pending": return <Badge variant="outline" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
            case "approved": return <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Approved</Badge>;
            case "issued": return <Badge variant="default" className="bg-green-600 flex items-center gap-1"><Package className="h-3 w-3" /> Issued</Badge>;
            case "rejected": return <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Rejected</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getReturnStatusBadge = (status: string) => {
        switch (status) {
            case "pending": return <Badge variant="outline" className="flex items-center gap-1"><Clock className="h-3 w-3 text-orange-500" /> Return Pending</Badge>;
            case "approved": return <Badge variant="secondary" className="bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Return Approved</Badge>;
            case "rejected": return <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Return Rejected</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <Card className="border-primary/20 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <ClipboardList className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle>Parts Management</CardTitle>
                            <CardDescription>Requested and issued parts for this work order</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!currentEmployeeId && isAdmin && (
                            <Button
                                size="sm"
                                variant="destructive"
                                className="mr-2 animate-pulse"
                                onClick={handleAutoLink}
                                disabled={isLinking}
                            >
                                {isLinking ? "Linking..." : "Link Admin Account"}
                            </Button>
                        )}
                        {!isReadOnly && (
                            <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm" className="bg-primary hover:bg-primary/90">
                                        <Plus className="h-4 w-4 mr-1" /> Request Part
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Request New Part</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Select Part</label>
                                            <Select onValueChange={setSelectedItemId}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Choose a part..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {inventoryItems.map((item) => (
                                                        <SelectItem key={item.id} value={item.id}>
                                                            {item.item_name} ({item.sku}) - {item.available_qty} left
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Quantity</label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={qty}
                                                    onChange={(e) => setQty(parseInt(e.target.value))}
                                                />
                                            </div>
                                            {isAdmin && (
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Requested By</label>
                                                    <Select onValueChange={setSelectedEmployeeId}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select employee" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {employees.map((emp) => (
                                                                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsRequestDialogOpen(false)}>Cancel</Button>
                                        <Button onClick={handleCreateRequest}>Submit Request</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-muted/20">
                        <TableRow>
                            <TableHead>Part Info</TableHead>
                            <TableHead>Qty (Req/App/Iss)</TableHead>
                            <TableHead>Requested By</TableHead>
                            <TableHead>Status</TableHead>
                            {isAdmin && <TableHead className="text-right">Action</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-8">Loading...</TableCell></TableRow>
                        ) : requests.length === 0 ? (
                            <TableRow><TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-8 text-muted-foreground">No parts requested yet.</TableCell></TableRow>
                        ) : (
                            requests.map((req) => (
                                <TableRow key={req.id}>
                                    <TableCell>
                                        <div className="font-medium">{req.inventory?.item_name || 'Deleted Item'}</div>
                                        <div className="text-xs text-muted-foreground">{req.inventory?.sku || 'N/A'}</div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-bold">{req.requested_qty}</span>
                                        <span className="text-muted-foreground mx-1">/</span>
                                        <span className="text-blue-600 font-medium">{req.approved_qty}</span>
                                        <span className="text-muted-foreground mx-1">/</span>
                                        <span className="text-green-600 font-medium">{req.issued_qty}</span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">{req.employee?.name || 'N/A'}</div>
                                        <div className="text-[10px] text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</div>
                                    </TableCell>
                                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                                    {isAdmin && (
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                {req.status === 'pending' && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            onClick={() => handleApprove(req.id, req.requested_qty)}
                                                        >
                                                            Approve
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/5"
                                                            onClick={() => handleReject(req.id)}
                                                        >
                                                            Reject
                                                        </Button>
                                                    </>
                                                )}
                                                {req.status === 'approved' && (
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-xs italic text-muted-foreground">Awaiting Scan</div>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 h-7 px-2"
                                                            title="Unreserve Part"
                                                            onClick={() => handleReject(req.id)}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                )}
                                                {req.status === 'issued' && !isReadOnly && (
                                                    <div className="flex items-center gap-2">
                                                        {req.approved_qty > req.issued_qty && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-orange-600 border-orange-200 hover:bg-orange-50 h-7 px-2"
                                                                onClick={() => handleReleaseRemainder(req.id)}
                                                                title="Release unused reservation back to stock"
                                                            >
                                                                Release Remainder ({req.approved_qty - req.issued_qty})
                                                            </Button>
                                                        )}
                                                        {req.issued_qty > 0 && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="flex items-center gap-1"
                                                                onClick={() => {
                                                                    setSelectedReqForReturn(req);
                                                                    setReturnQty(req.issued_qty);
                                                                    setIsReturnDialogOpen(true);
                                                                }}
                                                            >
                                                                <ArrowLeftRight className="h-3 w-3" /> Return
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                {/* Return Request Dialog */}
                <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Return Part</DialogTitle>
                            <DialogDescription>
                                Return unused or damaged parts to inventory. This requires admin approval.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="p-3 bg-muted rounded-lg border text-sm">
                                <div className="font-bold">{selectedReqForReturn?.inventory?.item_name}</div>
                                <div className="text-muted-foreground">Issued Qty: {selectedReqForReturn?.issued_qty}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Return Quantity</label>
                                    <Input
                                        type="number"
                                        min="1"
                                        max={selectedReqForReturn?.issued_qty}
                                        value={returnQty}
                                        onChange={(e) => setReturnQty(parseInt(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Condition</label>
                                    <Select value={returnCondition} onValueChange={setReturnCondition}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Condition" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unused">Unused / Like New</SelectItem>
                                            <SelectItem value="opened">Opened / Fixed But Removed</SelectItem>
                                            <SelectItem value="damaged">Damaged / Defective</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Reason for Return</label>
                                <Input
                                    placeholder="e.g. Extra part, incorrect part, damaged..."
                                    value={returnReason}
                                    onChange={(e) => setReturnReason(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsReturnDialogOpen(false)}>Cancel</Button>
                            <Button
                                onClick={handleReturnRequest}
                                disabled={isSubmittingReturn || !returnReason || returnQty <= 0}
                            >
                                {isSubmittingReturn ? "Submitting..." : "Submit Return Request"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Return Requests History Section */}
                {returns.length > 0 && (
                    <div className="border-t bg-muted/10">
                        <div className="px-4 py-2 bg-muted/20 border-b flex items-center gap-2">
                            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Return History</span>
                        </div>
                        <Table>
                            <TableBody>
                                {returns.map((ret) => (
                                    <TableRow key={ret.id} className="bg-transparent hover:bg-muted/50 border-b border-muted/20">
                                        <TableCell className="py-2">
                                            <div className="text-sm font-medium">{ret.inventory?.item_name}</div>
                                            <div className="text-[10px] text-muted-foreground">Qty: {ret.quantity} • {ret.condition}</div>
                                        </TableCell>
                                        <TableCell className="py-2 text-xs italic text-muted-foreground max-w-[200px] truncate" title={ret.reason}>
                                            "{ret.reason}"
                                        </TableCell>
                                        <TableCell className="py-2 text-right">
                                            {getReturnStatusBadge(ret.status)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
