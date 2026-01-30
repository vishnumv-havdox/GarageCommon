import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface SearchInputProps {
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
    suggestions?: string[];
    className?: string;
}

export function SearchInput({
    placeholder = "Search...",
    value,
    onChange,
    suggestions = [],
    className,
}: SearchInputProps) {
    const [open, setOpen] = React.useState(false);
    const [inputValue, setInputValue] = React.useState(value);

    // Sync internal state with external value
    React.useEffect(() => {
        setInputValue(value);
    }, [value]);

    const uniqueSuggestions = Array.from(new Set(suggestions)).filter(Boolean);

    const handleSelect = (selectedValue: string) => {
        onChange(selectedValue);
        setOpen(false);
    };

    const handleClear = () => {
        onChange("");
        setInputValue("");
        setOpen(false);
    };

    const filteredSuggestions = React.useMemo(() => {
        if (!inputValue) return uniqueSuggestions.slice(0, 10);
        return uniqueSuggestions
            .filter(s => s.toLowerCase().includes(inputValue.toLowerCase()))
            .slice(0, 10);
    }, [uniqueSuggestions, inputValue]);

    return (
        <div className={cn("relative w-full", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <div className="relative w-full group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder={placeholder}
                            value={inputValue}
                            onChange={(e) => {
                                setInputValue(e.target.value);
                                onChange(e.target.value);
                                if (!open && e.target.value.length > 0) setOpen(true);
                            }}
                            onFocus={() => {
                                if (uniqueSuggestions.length > 0) setOpen(true);
                            }}
                            className="pl-10 pr-10"
                        />
                        {inputValue && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full w-10 hover:bg-transparent text-muted-foreground hover:text-foreground"
                                onClick={handleClear}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        ) || uniqueSuggestions.length > 0 && (
                            <ChevronsUpDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50 pointer-events-none" />
                        )}
                    </div>
                </PopoverTrigger>
                {filteredSuggestions.length > 0 && (
                    <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] p-0"
                        align="start"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                        <Command className="w-full" shouldFilter={false}>
                            <CommandList>
                                <CommandEmpty>No suggestions found.</CommandEmpty>
                                <CommandGroup heading="Suggestions">
                                    {filteredSuggestions.map((suggestion) => (
                                        <CommandItem
                                            key={suggestion}
                                            value={suggestion}
                                            onSelect={() => handleSelect(suggestion)}
                                            className="cursor-pointer"
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    value === suggestion ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {suggestion}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                )}
            </Popover>
        </div>
    );
}
