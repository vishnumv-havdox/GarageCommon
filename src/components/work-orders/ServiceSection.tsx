import { useState, useEffect } from "react";
import { ServiceType, serviceTypeConfig } from "@/config/serviceTypeConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskSelector, TaskItem, TaskTemplate } from "./TaskSelector";
import { SectionStaffPanel } from "./SectionStaffPanel";
import { Trash2, Wrench, FileText, IndianRupee } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface Employee {
    id: string;
    name: string;
    position_name?: string;
    department?: string;
}

export interface ServiceSectionData {
    serviceType: string;
    tasks: TaskItem[];
    selectedEmployeeIds: string[];
    notes: string;
    cost: number;
    serviceSpecificFields?: Record<string, any>;
}

interface ServiceSectionProps {
    serviceType: string;
    serviceId?: string; // ID from DB
    data: ServiceSectionData;
    availableEmployees: Employee[];
    availableTasks?: TaskTemplate[]; // Tasks from DB
    onChange: (data: ServiceSectionData) => void;
    onRemove: () => void;
    onCustomTaskAdd?: (name: string) => Promise<TaskTemplate | null>;
    onTaskUpdate?: (task: TaskTemplate, newName: string) => Promise<void>;
    onTaskDelete?: (taskId: string) => Promise<void>;
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
    onTaskDelete
}: ServiceSectionProps) {

    const handleFieldChange = (field: keyof ServiceSectionData, value: any) => {
        onChange({ ...data, [field]: value });
    };

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
                                Estimated Cost
                            </Label>
                            <Input
                                type="number"
                                min="0"
                                placeholder="0.00"
                                value={data.cost || ""}
                                onChange={(e) => handleFieldChange("cost", parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>

                    {/* Right Column: Staff Assignment */}
                    <div className="lg:col-span-1 border-l pl-0 lg:pl-6 border-transparent lg:border-border">
                        <SectionStaffPanel
                            serviceType={serviceType}
                            availableEmployees={availableEmployees}
                            selectedEmployeeIds={data.selectedEmployeeIds}
                            onSelectionChange={(ids) => handleFieldChange("selectedEmployeeIds", ids)}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
