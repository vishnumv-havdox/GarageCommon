
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

interface ComboboxProps {
    items: { value: string; label: string }[]
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

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between", className)}
                    disabled={disabled}
                >
                    {value
                        ? items.find((item) => item.value === value)?.label || placeholder
                        : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
                <Command>
                    <CommandInput
                        placeholder={searchPlaceholder}
                        value={searchValue}
                        onValueChange={setSearchValue}
                    />
                    <CommandList>
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
                                    value={item.label} // Search by label
                                    onSelect={(currentValue) => {
                                        // We match by label for display, but return the value (ID)
                                        const matched = items.find(i => i.label.toLowerCase() === currentValue.toLowerCase())
                                        if (matched) {
                                            onSelect(matched.value)
                                        }
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === item.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {item.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
