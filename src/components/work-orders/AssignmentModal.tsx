/**
 * AssignmentModal Component
 * Modal for selecting employees to assign to work orders
 */

import { useState, useEffect } from "react"
import { Search, Users, Check, X, UserPlus, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface Employee {
  id: string
  name: string
  email: string
  position_name: string
  department: string
  current_tasks?: number
  status: string
}

interface AssignmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: Employee[]
  selectedIds: string[]
  onSelect: (ids: string[]) => void
  serviceType?: string
  title?: string
  multiSelect?: boolean
}

export function AssignmentModal({
  open,
  onOpenChange,
  employees,
  selectedIds,
  onSelect,
  serviceType,
  title = "Assign Employees",
  multiSelect = true
}: AssignmentModalProps) {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<string[]>(selectedIds)
  const [positionFilter, setPositionFilter] = useState<string>("all")

  useEffect(() => {
    setSelected(selectedIds)
  }, [selectedIds])

  const handleToggle = (id: string) => {
    if (multiSelect) {
      const newSelected = selected.includes(id)
        ? selected.filter(s => s !== id)
        : [...selected, id]
      setSelected(newSelected)
    } else {
      setSelected([id])
    }
  }

  const handleConfirm = () => {
    onSelect(selected)
    onOpenChange(false)
  }

  const handleCancel = () => {
    setSelected(selectedIds)
    onOpenChange(false)
  }

  // Get unique positions
  const positions = [...new Set(employees.map(e => e.position_name).filter(Boolean))]

  // Filter employees
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase())
    const matchesPosition = positionFilter === "all" || emp.position_name === positionFilter
    return matchesSearch && matchesPosition
  })

  // Group by position
  const groupedEmployees = filteredEmployees.reduce((acc, emp) => {
    const pos = emp.position_name || "Other"
    if (!acc[pos]) acc[pos] = []
    acc[pos].push(emp)
    return acc
  }, {} as Record<string, Employee[]>)

  // Sort groups by employee count (busy first)
  const sortedGroups = Object.entries(groupedEmployees).sort((a, b) => {
    const aTasks = a[1].reduce((sum, e) => sum + (e.current_tasks || 0), 0)
    const bTasks = b[1].reduce((sum, e) => sum + (e.current_tasks || 0), 0)
    return bTasks - aTasks
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {title}
          </DialogTitle>
          {serviceType && (
            <p className="text-sm text-muted-foreground">
              Suggested for: {serviceType}
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Search and Filter */}
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  {positionFilter === "all" ? "All Positions" : positionFilter}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="p-2">
                <Button
                  variant={positionFilter === "all" ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setPositionFilter("all")}
                >
                  All Positions
                </Button>
                {positions.map(pos => (
                  <Button
                    key={pos}
                    variant={positionFilter === pos ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setPositionFilter(pos)}
                  >
                    {pos}
                  </Button>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          {/* Selected Count */}
          {multiSelect && selected.length > 0 && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-primary/10 rounded-lg">
              <Badge variant="secondary" className="gap-1">
                <Check className="h-3 w-3" />
                {selected.length} selected
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected([])}
                className="ml-auto text-xs"
              >
                Clear All
              </Button>
            </div>
          )}

          {/* Employee List */}
          <div className="border rounded-lg max-h-[400px] overflow-y-auto">
            {filteredEmployees.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2" />
                <p>No employees found</p>
              </div>
            ) : (
              <div className="divide-y">
                {sortedGroups.map(([position, emps]) => (
                  <div key={position}>
                    <div className="px-4 py-2 bg-muted/50 text-sm font-medium text-muted-foreground sticky top-0">
                      {position}
                    </div>
                    {emps.map(emp => {
                      const isSelected = selected.includes(emp.id)
                      return (
                        <div
                          key={emp.id}
                          className={cn(
                            "flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors",
                            isSelected && "bg-primary/10"
                          )}
                          onClick={() => handleToggle(emp.id)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggle(emp.id)}
                            className="shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{emp.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {emp.department}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {emp.email}
                            </p>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            <div>{emp.current_tasks || 0} active tasks</div>
                            <Badge 
                              variant={emp.status === 'active' ? 'default' : 'secondary'}
                              className="mt-1"
                            >
                              {emp.status}
                            </Badge>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selected.length === 0}>
            {multiSelect ? `Assign ${selected.length} Employee${selected.length !== 1 ? 's' : ''}` : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Simple employee selector for inline use
interface EmployeeSelectorProps {
  employees: Employee[]
  selectedId: string | null
  onSelect: (id: string) => void
  className?: string
}

export function EmployeeSelector({
  employees,
  selectedId,
  onSelect,
  className
}: EmployeeSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  
  const selectedEmployee = employees.find(e => e.id === selectedId)
  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-between", className)}
        >
          {selectedEmployee ? (
            <span>{selectedEmployee.name}</span>
          ) : (
            <span className="text-muted-foreground">Select employee...</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search employee..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No employee found.</CommandEmpty>
            <CommandGroup>
              {filteredEmployees.map(emp => (
                <CommandItem
                  key={emp.id}
                  value={`${emp.name} ${emp.email}`}
                  onSelect={() => {
                    onSelect(emp.id)
                    setOpen(false)
                  }}
                >
                  <div className="flex-1">
                    <div className="font-medium">{emp.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {emp.position_name} • {emp.department}
                    </div>
                  </div>
                  {emp.id === selectedId && (
                    <Check className="h-4 w-4" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

