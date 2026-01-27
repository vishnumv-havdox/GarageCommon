import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ServiceType, getEligiblePositions } from "@/config/serviceTypeConfig";
import { Users, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface Employee {
    id: string;
    name: string;
    position_name?: string;
    department?: string;
}

interface SectionStaffPanelProps {
    serviceType: string;
    availableEmployees: Employee[];
    selectedEmployeeIds: string[];
    onSelectionChange: (ids: string[]) => void;
}

export function SectionStaffPanel({
    serviceType,
    availableEmployees,
    selectedEmployeeIds,
    onSelectionChange
}: SectionStaffPanelProps) {

    // Filter employees suitable for this service type
    const eligiblePositions = getEligiblePositions(serviceType as any);

    // Filter logic: 
    // 1. If eligiblePositions has entries, match position_name
    // 2. OR fall back to generic "Service" department check if strict position mapping is missing?
    // For now, let's use the department logic primarily as enforced in getEligiblePositions documentation logic
    // "Service" department employees are usually eligible for most mechanical stuff.
    // We can also just show ALL Service department employees but highlight recommended ones.

    const relevantEmployees = availableEmployees.filter(emp => {
        // Basic filter: Must be from relevant department (Service for most technical roles)
        // We can check serviceTypeConfig if we had access to department there, but for now lets assume "Service" department
        return emp.department === "Service" || emp.department === "Body Work" || emp.department === "Electrical";
    });

    const handleToggle = (id: string, checked: boolean) => {
        if (checked) {
            onSelectionChange([...selectedEmployeeIds, id]);
        } else {
            onSelectionChange(selectedEmployeeIds.filter(eid => eid !== id));
        }
    };

    return (
        <div className="bg-muted/30 rounded-md p-4 h-full border">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Assign Staff
                </h4>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>
                            <Info className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="max-w-xs">Select employees responsible for this specific service section.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {relevantEmployees.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No eligible staff found.</p>
                ) : (
                    relevantEmployees.map((emp) => {
                        const isSelected = selectedEmployeeIds.includes(emp.id);
                        return (
                            <div
                                key={emp.id}
                                className={`flex items-start gap-2 p-2 rounded-md border transition-colors ${isSelected ? "bg-primary/5 border-primary/20" : "bg-white dark:bg-zinc-900 border-transparent"
                                    }`}
                            >
                                <Checkbox
                                    id={`${serviceType}-${emp.id}`}
                                    checked={isSelected}
                                    onCheckedChange={(checked) => handleToggle(emp.id, checked as boolean)}
                                    className="mt-1"
                                />
                                <div className="grid gap-0.5">
                                    <Label
                                        htmlFor={`${serviceType}-${emp.id}`}
                                        className="text-sm font-medium leading-none cursor-pointer"
                                    >
                                        {emp.name}
                                    </Label>
                                    <span className="text-xs text-muted-foreground">
                                        {emp.position_name || "Staff"}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                    {selectedEmployeeIds.length} employee{selectedEmployeeIds.length !== 1 ? 's' : ''} selected
                </p>
            </div>
        </div>
    );
}
