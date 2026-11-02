
import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxItem {
    value: string
    label: string
    description?: string
    image?: string | null
}

interface ComboboxProps {
    items: ComboboxItem[]
    value?: string
    onSelect: (value: string) => void
    placeholder?: string
    searchPlaceholder?: string
    emptyText?: string
    className?: string
    disabled?: boolean
    onCreate?: (value: string) => void
}

export function Combobox({
    items,
    value,
    onSelect,
    placeholder = "Select...",
    searchPlaceholder = "Search...",
    emptyText = "No item found.",
    className,
    disabled = false,
    onCreate
}: ComboboxProps) {
    const [open, setOpen] = React.useState(false)
    const [searchValue, setSearchValue] = React.useState("")

    const selectedItem = items.find((item) => item.value === value)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between h-auto py-2", className)}
                    disabled={disabled}
                >
                    <div className="flex items-center gap-2 truncate">
                        {selectedItem?.image && (
                            <img
                                src={selectedItem.image}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="w-5 h-5 rounded object-cover shrink-0 border border-border/50"
                            />
                        )}
                        <span className="truncate">{selectedItem?.label || placeholder}</span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0 shadow-lg border border-border/80 rounded-xl overflow-hidden" align="start">
                <Command>
                    <CommandInput
                        placeholder={searchPlaceholder}
                        value={searchValue}
                        onValueChange={setSearchValue}
                    />
                    <CommandList className="max-h-[260px] overflow-y-auto">
                        <CommandEmpty>
                            <div className="flex flex-col items-center justify-center py-2 gap-2">
                                <p className="text-sm text-muted-foreground">{emptyText}</p>
                                {onCreate && searchValue && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full h-8 px-2"
                                        onClick={() => {
                                            onCreate(searchValue)
                                            setOpen(false)
                                            setSearchValue("")
                                        }}
                                    >
                                        <Plus className="mr-2 h-3 w-3" />
                                        Create "{searchValue}"
                                    </Button>
                                )}
                            </div>
                        </CommandEmpty>
                        <CommandGroup>
                            {items.map((item) => (
                                <CommandItem
                                    key={item.value}
                                    value={`${item.label} ${item.description || ''}`}
                                    onSelect={() => {
                                        onSelect(item.value)
                                        setOpen(false)
                                    }}
                                    className="flex items-center gap-2.5 py-2 cursor-pointer"
                                >
                                    <Check
                                        className={cn(
                                            "h-4 w-4 shrink-0",
                                            value === item.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {item.image ? (
                                        <img
                                            src={item.image}
                                            alt=""
                                            referrerPolicy="no-referrer"
                                            className="h-7 w-7 rounded-md object-cover shrink-0 border border-border/50 bg-muted"
                                        />
                                    ) : null}
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-xs font-semibold text-foreground truncate">{item.label}</span>
                                        {item.description && (
                                            <span className="text-[10px] text-muted-foreground truncate">{item.description}</span>
                                        )}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
