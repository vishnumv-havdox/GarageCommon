import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { serviceTypeConfig, ServiceType } from "@/config/serviceTypeConfig";
import { Plus, X, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface TaskItem {
    id: string;
    name: string;
    isPredefined: boolean;
}

interface TaskSelectorProps {
    serviceType: ServiceType;
    tasks: TaskItem[];
    onTasksChange: (tasks: TaskItem[]) => void;
}

export function TaskSelector({ serviceType, tasks, onTasksChange }: TaskSelectorProps) {
    const [selectedPredefined, setSelectedPredefined] = useState<string>("");
    const [customTaskName, setCustomTaskName] = useState("");

    const config = serviceTypeConfig[serviceType];
    const predefinedTasks = config?.tasks || [];

    const handleAddPredefined = (taskName: string) => {
        if (!taskName) return;

        // Check if already added
        if (tasks.some(t => t.name === taskName)) {
            return;
        }

        const newTask: TaskItem = {
            id: crypto.randomUUID(),
            name: taskName,
            isPredefined: true
        };

        onTasksChange([...tasks, newTask]);
        setSelectedPredefined("");
    };

    const handleAddCustom = () => {
        const trimmed = customTaskName.trim();
        if (!trimmed) return;

        const newTask: TaskItem = {
            id: crypto.randomUUID(),
            name: trimmed,
            isPredefined: false
        };

        onTasksChange([...tasks, newTask]);
        setCustomTaskName("");
    };

    const handleRemove = (taskId: string) => {
        onTasksChange(tasks.filter(t => t.id !== taskId));
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Predefined Seletor */}
                <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Add Predefined Task</Label>
                    <Select value={selectedPredefined} onValueChange={handleAddPredefined}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select task..." />
                        </SelectTrigger>
                        <SelectContent>
                            {predefinedTasks.map((task) => (
                                <SelectItem
                                    key={task}
                                    value={task}
                                    disabled={tasks.some(t => t.name === task)}
                                >
                                    {task}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Custom Input */}
                <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Add Custom Task</Label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="e.g. Inspect Radiator"
                            value={customTaskName}
                            onChange={(e) => setCustomTaskName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustom())}
                        />
                        <Button size="icon" variant="ghost" onClick={handleAddCustom} type="button">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Task List */}
            <div className="bg-muted/30 rounded-md p-3 min-h-[100px] space-y-2">
                <div className="flex items-center gap-2 mb-2">
                    <ListTodo className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Task List</span>
                </div>

                {tasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic pl-6">No tasks added yet.</p>
                ) : (
                    <div className="space-y-2">
                        {tasks.map((task) => (
                            <div key={task.id} className="flex items-center justify-between bg-white dark:bg-zinc-900 border px-3 py-2 rounded-sm text-sm shadow-sm group">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{task.name}</span>
                                    {task.isPredefined && <Badge variant="secondary" className="text-[10px] h-4 px-1">Predefined</Badge>}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleRemove(task.id)}
                                >
                                    <X className="h-3 w-3 text-destructive" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
