import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskSelector, TaskItem, TaskTemplate } from "./TaskSelector";
import { SectionStaffPanel } from "./SectionStaffPanel";
import { Trash2, Wrench, FileText, IndianRupee } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface Employee {
    id: string;
    name: string;
    position_name?: string;
    department?: string;
}

export interface ServiceSectionData {
    serviceType: string;
    serviceTypeId?: string;
    dbId?: string;
    tasks: TaskItem[];
    selectedEmployees: { id: string; queue_position: number; status?: string }[];
    notes: string;
    cost: number;
    serviceSpecificFields?: Record<string, any>;
    calculatedPrice?: number;
    basePrice?: number;
    appliedRules?: Array<{
        name: string;
        modifier_type: string;
        modifier_value: number;
    }>;
    taskBreakdown?: Array<{
        taskId: string;
        name: string;
        basePrice: number;
        calculatedPrice: number;
        appliedRule?: string;
    }>;
}

interface ServiceSectionProps {
    serviceType: string;
    serviceId?: string; // ID from DB
    basePrice?: number; // Base price from master
    data: ServiceSectionData;
    availableEmployees: Employee[];
    availableTasks?: TaskTemplate[]; // Tasks from DB
    onChange: (data: ServiceSectionData) => void;
    onRemove: () => void;
    onCustomTaskAdd?: (name: string, price: number) => Promise<TaskTemplate | null>;
    onTaskUpdate?: (task: TaskTemplate, newName: string, newPrice?: number) => Promise<void>;
    onTaskDelete?: (taskId: string) => Promise<void>;
    workOrderId?: string;
}

export function ServiceSection({
    serviceType,
    serviceId,
    data,
    availableEmployees,
    availableTasks = [],
    onChange,
    onRemove,
    onCustomTaskAdd,
    onTaskUpdate,
    onTaskDelete,
    workOrderId
}: ServiceSectionProps) {

    const totalTasksCost = data.tasks.reduce((sum, task) => sum + (task.price || 0), 0);

    const handleFieldChange = (field: keyof ServiceSectionData, value: any) => {
        onChange({ ...data, [field]: value });
    };

    // Strictly sync cost with total tasks cost
    useEffect(() => {
        if (totalTasksCost > 0 && data.cost !== totalTasksCost) {
            handleFieldChange("cost", totalTasksCost);
        } else if (data.tasks.length === 0 && (data.cost === data.basePrice || data.cost === data.calculatedPrice)) {
            // Auto-reset to 0 if no tasks are added and cost matches base/calculated defaults
            // This prevents "Base Price" from being applied automatically if user wants empty state
            handleFieldChange("cost", 0);
        }
    }, [totalTasksCost, data.cost, data.tasks.length, data.basePrice, data.calculatedPrice]);

    return (
        <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between py-3 bg-muted/10">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    {serviceType}
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onRemove}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </CardHeader>

            <CardContent className="pt-4 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left Column: Tasks & Details */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Task Selector */}
                        <TaskSelector
                            serviceType={serviceType}
                            availableTasks={availableTasks}
                            tasks={data.tasks}
                            onTasksChange={(tasks) => handleFieldChange("tasks", tasks)}
                            onCustomTaskAdd={onCustomTaskAdd}
                            onTaskUpdate={onTaskUpdate}
                            onTaskDelete={onTaskDelete}
                        />

                        <Separator />

                        {/* Description / Notes */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Service Notes / Description
                            </Label>
                            <Textarea
                                placeholder="Specific instructions or observations for this service..."
                                value={data.notes}
                                onChange={(e) => handleFieldChange("notes", e.target.value)}
                                className="min-h-[80px]"
                            />
                        </div>

                        {/* Cost Estimation */}
                        <div className="space-y-2 max-w-xs">
                            <Label className="flex items-center gap-2">
                                <IndianRupee className="h-4 w-4" />
                                {data.calculatedPrice ? 'Billing Price' : 'Estimated Cost'}
                            </Label>
                            <Input
                                type="number"
                                min="0"
                                placeholder={"0.00"}
                                value={data.cost || ""}
                                onChange={(e) => handleFieldChange("cost", parseFloat(e.target.value) || 0)}
                                disabled={totalTasksCost > 0}
                                className={cn(
                                    totalTasksCost > 0 && "bg-muted",
                                    data.calculatedPrice && data.cost !== data.calculatedPrice && "border-amber-500 bg-amber-50/50"
                                )}
                            />
                            {totalTasksCost > 0 ? (
                                <p className="text-[10px] text-blue-600 font-medium px-1 italic">
                                    Locked to sum of tasks: ₹{totalTasksCost}
                                </p>
                            ) : (data.calculatedPrice && data.tasks.length > 0) ? (
                                <div className="space-y-1 px-1">
                                    <p className="text-[10px] text-gray-500 italic">
                                        Calculated: ₹{data.calculatedPrice} (Base: ₹{data.basePrice})
                                    </p>
                                    {data.cost !== data.calculatedPrice && (
                                        <div className="space-y-1.5">
                                            <p className="text-[10px] text-amber-600 font-medium italic">
                                                Manual override in effect
                                            </p>
                                            <Textarea
                                                placeholder="Reason for manual override..."
                                                value={data.notes}
                                                onChange={(e) => handleFieldChange("notes", e.target.value)}
                                                className="text-[10px] min-h-[40px] border-amber-200"
                                            />
                                        </div>
                                    )}
                                    {data.appliedRules && data.appliedRules.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {data.appliedRules.map((rule, idx) => (
                                                <span key={idx} className="text-[8px] bg-blue-100 text-blue-700 px-1 rounded">
                                                    {rule.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-[10px] text-muted-foreground px-1 italic">
                                    Enter manual cost or add tasks above
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Staff Assignment */}
                    <div className="lg:col-span-1 border-l pl-0 lg:pl-6 border-transparent lg:border-border">
                        <SectionStaffPanel
                            serviceType={serviceType}
                            availableEmployees={availableEmployees}
                            selectedEmployees={data.selectedEmployees}
                            onSelectionChange={(employees) => handleFieldChange("selectedEmployees", employees)}
                            workOrderId={workOrderId}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
