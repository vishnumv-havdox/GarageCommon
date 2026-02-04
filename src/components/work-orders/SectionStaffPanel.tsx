import { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { getEligiblePositions } from "@/config/serviceTypeConfig";
import { Users, Info, Search, TrendingUp, AlertTriangle, ListOrdered, CheckCircle2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock } from "lucide-react";

// Delivery countdown utilities
const getDeliveryStatus = (deliveryDate: string | null, currentTime: number) => {
    if (!deliveryDate) return { formatted: 'No date', color: 'text-muted-foreground' };
    const deliveryTime = new Date(deliveryDate).getTime();
    const timeRemaining = deliveryTime - currentTime;
    const hoursRemaining = timeRemaining / (1000 * 60 * 60);

    const formatCountdown = (ms: number, isOverdue: boolean) => {
        const totalSeconds = Math.floor(Math.abs(ms) / 1000);
        const days = Math.floor(totalSeconds / (24 * 60 * 60));
        const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
        const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
        const prefix = isOverdue ? 'Overdue by ' : '';
        if (days > 0) return `${prefix}${days}d ${hours}h`;
        if (hours > 0) return `${prefix}${hours}h ${minutes}m`;
        return `${prefix}${minutes}m`;
    };

    if (timeRemaining < 0) {
        return { formatted: formatCountdown(timeRemaining, true), color: 'text-red-600' };
    } else if (hoursRemaining < 6) {
        return { formatted: formatCountdown(timeRemaining, false), color: 'text-red-600' };
    } else if (hoursRemaining < 24) {
        return { formatted: formatCountdown(timeRemaining, false), color: 'text-orange-600' };
    }
    return { formatted: formatCountdown(timeRemaining, false), color: 'text-green-600' };
};

interface Employee {
    id: string;
    name: string;
    position_name?: string;
    department?: string;
}

interface SectionStaffPanelProps {
    serviceType: string;
    availableEmployees: Employee[];
    selectedEmployees: { id: string; queue_position: number }[];
    onSelectionChange: (employees: { id: string; queue_position: number }[]) => void;
}

export function SectionStaffPanel({
    serviceType,
    availableEmployees,
    selectedEmployees,
    onSelectionChange
}: SectionStaffPanelProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [loadingEmployeeData, setLoadingEmployeeData] = useState(false);
    const [employeeWorkload, setEmployeeWorkload] = useState<any[]>([]);
    const [employeeAttendance, setEmployeeAttendance] = useState<any>(null);
    const [lastCheckedId, setLastCheckedId] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [showWorkloadModal, setShowWorkloadModal] = useState(false);
    const [selectedEmployeeForModal, setSelectedEmployeeForModal] = useState<Employee | null>(null);

    // Update current time every minute for live countdown
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
        return () => clearInterval(interval);
    }, []);

    // Filter employees
    const relevantEmployees = availableEmployees.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (emp.position_name || "").toLowerCase().includes(searchTerm.toLowerCase());
        const isFromRelevantDept = emp.department === "Service" || emp.department === "Body Work" || emp.department === "Electrical";
        return matchesSearch && isFromRelevantDept;
    });

    // Fetch workload/attendance for a specific employee
    const fetchEmployeeAssessment = useCallback(async (employeeId: string) => {
        setLoadingEmployeeData(true);
        setLastCheckedId(employeeId);
        try {
            // Fetch Workload with detailed info
            // @ts-ignore
            const { data: workload } = await supabase.rpc('get_employee_active_workload', {
                p_employee_id: employeeId
            });

            // Fetch Attendance
            const today = new Date().toISOString().split('T')[0];
            const { data: attendance } = await supabase
                .from('attendance')
                .select('status')
                .eq('employee_id', employeeId)
                .eq('date', today)
                .maybeSingle();

            // Enrich workload with additional details from work_orders
            const enrichedWorkload = await Promise.all((workload || []).map(async (wl: any) => {
                const { data: woData } = await supabase
                    .from('work_orders')
                    .select(`
                        estimated_delivery_date,
                        vehicles!inner(
                            customers(
                                company_name
                            )
                        )
                    `)
                    .eq('id', wl.work_order_id)
                    .single();

                return {
                    ...wl,
                    estimated_delivery_date: woData?.estimated_delivery_date,
                    company_name: woData?.vehicles?.customers?.company_name
                };
            }));

            return { workload: enrichedWorkload || [], attendance };
        } catch (error) {
            console.error("Error fetching employee assessment:", error);
            return { workload: [], attendance: null };
        } finally {
            setLoadingEmployeeData(false);
        }
    }, []);

    // Fetch workload/attendance for first selected employee or when selection changes
    useEffect(() => {
        const firstSelected = selectedEmployees[0];
        if (firstSelected && firstSelected.id !== lastCheckedId) {
            fetchEmployeeAssessment(firstSelected.id).then(res => {
                setEmployeeWorkload(res.workload);
                setEmployeeAttendance(res.attendance);
            });
        } else if (!firstSelected) {
            setEmployeeWorkload([]);
            setEmployeeAttendance(null);
            setLastCheckedId(null);
        }
    }, [selectedEmployees, lastCheckedId, fetchEmployeeAssessment]);

    const handleToggle = async (id: string) => {
        const isAlreadySelected = selectedEmployees.some(e => e.id === id);
        if (isAlreadySelected) {
            onSelectionChange(selectedEmployees.filter(e => e.id !== id));
        } else {
            // Fetch current workload to determine default position
            const res = await fetchEmployeeAssessment(id);
            setEmployeeWorkload(res.workload);
            setEmployeeAttendance(res.attendance);
            const defaultPosition = res.workload.length + 1;
            onSelectionChange([...selectedEmployees, { id, queue_position: defaultPosition }]);
        }
    };

    const handleShowWorkloadDetails = async (emp: Employee) => {
        setSelectedEmployeeForModal(emp);
        setShowWorkloadModal(true);
        if (emp.id !== lastCheckedId) {
            const res = await fetchEmployeeAssessment(emp.id);
            setEmployeeWorkload(res.workload);
            setEmployeeAttendance(res.attendance);
        }
    };

    const updatePosition = (id: string, queue_position: number) => {
        onSelectionChange(selectedEmployees.map(e =>
            e.id === id ? { ...e, queue_position } : e
        ));
    };

    return (
        <div className="bg-muted/30 rounded-xl p-4 h-full border space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Staff Selection
                </h4>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6">
                                <Info className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="max-w-xs text-xs">Search and select specialists for this service. View real-time availability and workload before assigning.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by name or position..."
                    className="pl-9 h-9 text-xs bg-background shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Employee List */}
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {relevantEmployees.length === 0 ? (
                    <div className="py-8 text-center border-2 border-dashed rounded-lg bg-background/50">
                        <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">No matching staff members found.</p>
                    </div>
                ) : (
                    relevantEmployees.map((emp) => {
                        const selection = selectedEmployees.find(e => e.id === emp.id);
                        const isSelected = !!selection;
                        return (
                            <div
                                key={emp.id}
                                onClick={() => handleToggle(emp.id)}
                                className={cn(
                                    "relative flex flex-col gap-2 p-3 rounded-lg border cursor-pointer transition-all duration-200 group",
                                    isSelected
                                        ? "bg-primary/10 border-primary ring-1 ring-primary/20 shadow-sm"
                                        : "bg-background border-border hover:border-primary/50 hover:bg-muted/30"
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col gap-0.5">
                                        <span className={cn("text-xs font-bold leading-none", isSelected ? "text-primary" : "text-foreground")}>
                                            {emp.name}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground font-medium">
                                            {emp.position_name || "Specialist"}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1">
                                            {loadingEmployeeData && lastCheckedId === emp.id ? (
                                                <div className="h-4 w-12 bg-muted animate-pulse rounded" />
                                            ) : (lastCheckedId === emp.id || isSelected) && (
                                                <Badge className={cn(
                                                    "h-4 text-[8px] font-bold uppercase py-0",
                                                    (lastCheckedId === emp.id ? employeeAttendance?.status : 'present' /* fallback */) === 'present' ? "bg-green-500" : "bg-red-500"
                                                )}>
                                                    {lastCheckedId === emp.id ? (employeeAttendance?.status || 'Not Marked') : 'Selected'}
                                                </Badge>
                                            )}
                                        </div>
                                        {isSelected && (
                                            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground scale-110 animate-in zoom-in duration-200">
                                                <CheckCircle2 className="h-3 w-3" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {isSelected && (
                                    <div className="space-y-2 mt-2 pt-2 border-t border-primary/20 animate-in fade-in slide-in-from-top-1 duration-200" onClick={(e) => e.stopPropagation()}>
                                        {/* Inline Assessment Stats */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-background/50 p-1.5 rounded border border-primary/10">
                                                <p className="text-[8px] font-bold text-muted-foreground uppercase">Active Jobs</p>
                                                <p className="text-xs font-black text-blue-600">
                                                    {lastCheckedId === emp.id ? employeeWorkload.length : '...'}
                                                </p>
                                            </div>
                                            <div className="bg-background/50 p-1.5 rounded border border-primary/10">
                                                <p className="text-[8px] font-bold text-muted-foreground uppercase">Next Queue</p>
                                                <div className="flex items-center gap-1">
                                                    <ListOrdered className="h-2 w-2 text-primary/60" />
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        className="h-5 w-12 text-[10px] font-black px-1 bg-background border-primary/20 p-0 text-center"
                                                        value={selection.queue_position}
                                                        onChange={(e) => updatePosition(emp.id, parseInt(e.target.value) || 1)}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Workload Summary with View Details Button */}
                                        {lastCheckedId === emp.id && (
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between px-1">
                                                    <p className="text-[8px] font-bold text-muted-foreground uppercase">Current Tasks ({employeeWorkload.length})</p>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-5 text-[8px] text-blue-600 hover:text-blue-700 p-0 px-1"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleShowWorkloadDetails(emp);
                                                        }}
                                                    >
                                                        View Details
                                                    </Button>
                                                </div>
                                                {employeeWorkload.length > 0 && (
                                                    <div className="space-y-1">
                                                        {employeeWorkload.slice(0, 2).map((wl, idx) => (
                                                            <div key={idx} className="flex justify-between items-center bg-muted/30 p-1 rounded text-[9px]">
                                                                <span className="truncate max-w-[120px] font-medium opacity-70">{wl.vehicle_number}</span>
                                                                <span className="text-primary font-bold">{wl.progress_percentage}%</span>
                                                            </div>
                                                        ))}
                                                        {employeeWorkload.length > 2 && (
                                                            <p className="text-[8px] text-center text-muted-foreground">+{employeeWorkload.length - 2} more</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>


            {/* Selection Counter */}
            <div className="pt-2">
                <p className="text-[10px] text-muted-foreground font-medium italic">
                    {selectedEmployees.length === 0
                        ? "Click an employee card to start assignment."
                        : `${selectedEmployees.length} staff member${selectedEmployees.length !== 1 ? 's' : ''} assigned to this section.`}
                </p>
            </div>

            {/* Detailed Workload Modal */}
            <Dialog open={showWorkloadModal} onOpenChange={setShowWorkloadModal}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            {selectedEmployeeForModal?.name} - Current Workload
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Employee Info */}
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                            <div>
                                <p className="text-sm font-semibold">{selectedEmployeeForModal?.position_name || 'Specialist'}</p>
                                <p className="text-xs text-muted-foreground">{selectedEmployeeForModal?.department || 'Service'} Department</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground">Active Jobs</p>
                                <p className="text-2xl font-bold text-primary">{employeeWorkload.length}</p>
                            </div>
                        </div>

                        {/* Attendance Status */}
                        {employeeAttendance && (
                            <div className="flex items-center gap-2 p-2 bg-muted/20 rounded">
                                <span className="text-xs font-semibold text-muted-foreground">Today's Status:</span>
                                <Badge className={employeeAttendance.status === 'present' ? 'bg-green-500' : 'bg-red-500'}>
                                    {employeeAttendance.status || 'Not Marked'}
                                </Badge>
                            </div>
                        )}

                        {/* Workload List */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase">Assigned Work Orders</h4>
                            {loadingEmployeeData ? (
                                <div className="space-y-2">
                                    <div className="h-20 bg-muted animate-pulse rounded" />
                                    <div className="h-20 bg-muted animate-pulse rounded" />
                                </div>
                            ) : employeeWorkload.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                    <p className="text-sm">No active work orders</p>
                                    <p className="text-xs">This employee is available for assignment</p>
                                </div>
                            ) : (
                                employeeWorkload.map((wl, idx) => {
                                    const deliveryInfo = getDeliveryStatus(wl.estimated_delivery_date, currentTime);
                                    return (
                                        <div key={idx} className="border rounded-lg p-3 space-y-2 hover:bg-muted/30 transition-colors">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge variant="outline" className="text-xs">Position #{idx + 1}</Badge>
                                                        <h5 className="font-semibold">{wl.vehicle_number}</h5>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">{wl.service_type}</p>
                                                    {wl.company_name && (
                                                        <p className="text-xs text-muted-foreground">Company: {wl.company_name}</p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-bold text-primary">{wl.progress_percentage}%</div>
                                                    <p className="text-[10px] text-muted-foreground">Complete</p>
                                                </div>
                                            </div>

                                            {/* Delivery Countdown */}
                                            {wl.estimated_delivery_date && (
                                                <div className={`flex items-center gap-1 text-xs font-semibold ${deliveryInfo.color}`}>
                                                    <Clock className="h-3 w-3" />
                                                    <span>Delivery: {deliveryInfo.formatted}</span>
                                                </div>
                                            )}

                                            {/* Progress Bar */}
                                            <div className="space-y-1">
                                                <Progress value={wl.progress_percentage} className="h-1.5" />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
