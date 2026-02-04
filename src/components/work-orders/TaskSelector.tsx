import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X, ListTodo, Check, ChevronsUpDown, Edit, Trash2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// ... (previous imports)

// Export interfaces
export interface TaskTemplate {
    id: string;
    name: string;
    service_type_id: string;
    price: number;
    is_active: boolean;
}

export interface TaskItem {
    id: string;
    name: string;
    price: number;
    isPredefined: boolean;
    appliedRuleName?: string;
}


interface TaskSelectorProps {
    serviceType: string;
    availableTasks: TaskTemplate[];
    tasks: TaskItem[];
    tasks: TaskItem[];
    onTasksChange: (tasks: TaskItem[]) => void;
    onCustomTaskAdd?: (name: string, price: number) => Promise<TaskTemplate | null>;
    onTaskUpdate?: (task: TaskTemplate, newName: string, newPrice?: number) => Promise<void>;
    onTaskDelete?: (taskId: string) => Promise<void>;
}

export function TaskSelector({
    serviceType,
    availableTasks = [],
    tasks,
    onTasksChange,
    onCustomTaskAdd,
    onTaskUpdate,
    onTaskDelete
}: TaskSelectorProps) {
    const [open, setOpen] = useState(false);
    const [customTaskName, setCustomTaskName] = useState("");
    const [customTaskPrice, setCustomTaskPrice] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    // Edit State
    const [editingTask, setEditingTask] = useState<TaskTemplate | null>(null);
    const [editTaskName, setEditTaskName] = useState("");
    const [editTaskPrice, setEditTaskPrice] = useState<string>("");
    const [isUpdating, setIsUpdating] = useState(false);

    // Delete State
    const [deletingTask, setDeletingTask] = useState<TaskTemplate | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleAddPredefined = (templateId: string) => {
        // ... (existing logic)
        if (!templateId) return;
        const template = availableTasks.find(t => t.id === templateId);
        if (!template) return;

        // Check if already added
        if (tasks.some(t => t.name === template.name)) {
            return;
        }

        const newTask: TaskItem = {
            id: crypto.randomUUID(),
            name: template.name,
            price: template.price || 0,
            isPredefined: true
        };

        onTasksChange([...tasks, newTask]);
        setOpen(false);
    };

    const handleAddCustom = async () => {
        // ... (existing logic)
        const trimmed = customTaskName.trim();
        if (!trimmed) return;

        // Check if it matches an existing template first
        const existingTemplate = availableTasks.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
        if (existingTemplate) {
            handleAddPredefined(existingTemplate.id);
            setCustomTaskName("");
            return;
        }

        // If generic custom adding (no persistence required/supported by parent)
        if (!onCustomTaskAdd) {
            const newTask: TaskItem = {
                id: crypto.randomUUID(),
                name: trimmed,
                price: 0, // Custom tasks start with 0
                isPredefined: false
            };
            onTasksChange([...tasks, newTask]);
            setCustomTaskName("");
            return;
        }

        // Persist to DB
        setIsCreating(true);
        try {
            const price = parseFloat(customTaskPrice) || 0;
            const newTemplate = await onCustomTaskAdd(trimmed, price);
            if (newTemplate) {
                const newTask: TaskItem = {
                    id: crypto.randomUUID(),
                    name: newTemplate.name,
                    price: price, // Use the price we just set
                    isPredefined: true // Now it's a template, so it's predefined!
                };
                onTasksChange([...tasks, newTask]);
                setCustomTaskName("");
                setCustomTaskPrice("");
            }
        } catch (error) {
            console.error("Failed to add custom task:", error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleRemove = (taskId: string) => {
        onTasksChange(tasks.filter(t => t.id !== taskId));
    };

    const handleUpdateConfirm = async () => {
        if (!editingTask || !onTaskUpdate || !editTaskName.trim()) return;
        setIsUpdating(true);
        try {
            const price = editTaskPrice ? parseFloat(editTaskPrice) : undefined;
            await onTaskUpdate(editingTask, editTaskName.trim(), price);
            setEditingTask(null);
        } catch (error) {
            console.error("Failed to update task:", error);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent, task: TaskTemplate) => {
        e.stopPropagation();
        setDeletingTask(task);
    }

    const handleDeleteConfirm = async () => {
        if (!deletingTask || !onTaskDelete) return;
        setIsDeleting(true);
        try {
            await onTaskDelete(deletingTask.id);
            setDeletingTask(null);
        } catch (error) {
            console.error("Failed to delete task:", error);
        } finally {
            setIsDeleting(false);
        }
    }

    // Derived list of selectable tasks (excluding already selected)
    const selectableTasks = availableTasks.filter(t => !tasks.some(selected => selected.name === t.name));

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Predefined Seletor */}
                <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Add Predefined Task</Label>
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={open}
                                className="w-full justify-between"
                            >
                                {selectableTasks.length > 0 ? "Select task..." : "No new tasks"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Search tasks..." />
                                <CommandList>
                                    <CommandEmpty>No tasks found.</CommandEmpty>
                                    <CommandGroup>
                                        {selectableTasks.map((task) => (
                                            <CommandItem
                                                key={task.id}
                                                value={task.name}
                                                onSelect={() => handleAddPredefined(task.id)}
                                                className="group flex items-center justify-between py-3"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span>{task.name}</span>
                                                    <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">₹{task.price || 0}</Badge>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                    {onTaskUpdate && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 hover:text-blue-500"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingTask(task);
                                                                setEditTaskName(task.name);
                                                                setEditTaskPrice(task.price?.toString() || "");
                                                            }}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {onTaskDelete && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 hover:text-destructive"
                                                            onClick={(e) => handleDeleteClick(e, task)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                    {selectableTasks.length === 0 && (
                                        <div className="p-2 text-xs text-muted-foreground text-center">
                                            All tasks added or none available.
                                        </div>
                                    )}
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
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
                            disabled={isCreating}
                        />
                        <Input
                            type="number"
                            placeholder="Price"
                            className="w-24"
                            value={customTaskPrice}
                            onChange={(e) => setCustomTaskPrice(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustom())}
                            disabled={isCreating}
                        />
                        <Button size="icon" variant="ghost" onClick={handleAddCustom} type="button" disabled={isCreating}>
                            {isCreating ? <Plus className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
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
                            <div key={task.id} className="flex items-center justify-between bg-white dark:bg-zinc-900 border px-3 py-2.5 rounded-sm text-sm shadow-sm group">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{task.name}</span>
                                    <Badge variant="outline" className="text-[10px] h-4 px-1">₹{task.price || 0}</Badge>
                                    {task.appliedRuleName && (
                                        <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-amber-50 text-amber-700 hover:bg-amber-100">
                                            {task.appliedRuleName}
                                        </Badge>
                                    )}
                                    {task.isPredefined && !task.appliedRuleName && <Badge variant="secondary" className="text-[10px] h-4 px-1">Predefined</Badge>}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                                    onClick={() => handleRemove(task.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Edit Task Dialog */}
            <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
                <DialogContent className="w-[95vw] max-w-sm rounded-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Task Template</DialogTitle>
                        <DialogDescription>
                            Enable consistency by renaming this task for all future uses.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-task-name">Task Name</Label>
                            <Input
                                id="edit-task-name"
                                value={editTaskName}
                                onChange={(e) => setEditTaskName(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-task-price">Price (Update for this Category)</Label>
                            <Input
                                id="edit-task-price"
                                type="number"
                                value={editTaskPrice}
                                onChange={(e) => setEditTaskPrice(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingTask(null)}>Cancel</Button>
                        <Button onClick={handleUpdateConfirm} disabled={!editTaskName.trim() || isUpdating}>
                            {isUpdating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Update
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Alert Dialog */}
            <AlertDialog open={!!deletingTask} onOpenChange={(open) => !open && setDeletingTask(null)}>
                <AlertDialogContent className="w-[95vw] max-w-md rounded-lg mx-auto">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the task template "{deletingTask?.name}".
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                        <AlertDialogCancel disabled={isDeleting} className="mt-0">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDeleteConfirm(); }} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
