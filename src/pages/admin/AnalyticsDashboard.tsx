import { useState } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Building2, Car, RefreshCw, Printer, Download, Check, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

import CompanyAnalyticsView from "./analytics/CompanyAnalyticsView";
import VehicleAnalyticsView from "./analytics/VehicleAnalyticsView";

// Types
interface SearchResult {
    id: string;
    label: string;
    subLabel?: string;
}

export default function AnalyticsDashboard() {
    const [viewMode, setViewMode] = useState<'company' | 'vehicle'>('company');
    const [open, setOpen] = useState(false);

    // Separate state for persistence
    const [selectedCompany, setSelectedCompany] = useState<{ id: string; label: string } | null>(null);
    const [selectedVehicle, setSelectedVehicle] = useState<{ id: string; label: string } | null>(null);

    // Derived state for current view
    const selectedId = viewMode === 'company' ? selectedCompany?.id : selectedVehicle?.id;
    const selectedLabel = viewMode === 'company' ? selectedCompany?.label : selectedVehicle?.label;

    // Fetch Companies
    const { data: companies = [] } = useQuery({
        queryKey: ['analytics-companies'],
        queryFn: async () => {
            const { data } = await supabase
                .from('customers')
                .select('id, company_name, name')
                .order('company_name', { ascending: true });
            return (data || []).map(c => ({
                id: c.id,
                label: c.company_name || c.name, // Fallback to name if company is empty
                subLabel: c.company_name ? c.name : 'Individual'
            }));
        },
        enabled: viewMode === 'company'
    });

    // Fetch Vehicles
    const { data: vehicles = [] } = useQuery({
        queryKey: ['analytics-vehicles'],
        queryFn: async () => {
            const { data } = await supabase
                .from('vehicles')
                .select('id, vehicle_number, model, customers(name, company_name)')
                .order('vehicle_number', { ascending: true });
            return (data || []).map(v => {
                const customerName = v.customers?.company_name || v.customers?.name || "Unknown Owner";
                return {
                    id: v.id,
                    label: `${v.vehicle_number} (${customerName})`,
                    subLabel: v.model
                };
            });
        },
        enabled: viewMode === 'vehicle'
    });

    const items = viewMode === 'company' ? companies : vehicles;

    const handleSelect = (item: SearchResult) => {
        if (viewMode === 'company') {
            setSelectedCompany({ id: item.id, label: item.label });
        } else {
            setSelectedVehicle({ id: item.id, label: item.label });
        }
        setOpen(false);
    };

    const handleReset = () => {
        if (viewMode === 'company') {
            setSelectedCompany(null);
        } else {
            setSelectedVehicle(null);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="flex flex-col lg:flex-row">
                <AdminSidebar />
                <main className="flex-1 p-4 lg:p-8 space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
                            <p className="text-muted-foreground">
                                360° View of Fleet Performance & Vehicle History
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => window.print()}>
                                <Printer className="h-4 w-4 mr-2" /> Print PDF
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleReset}>
                                <RefreshCw className="h-4 w-4 mr-2" /> Reset
                            </Button>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <Card>
                        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center">
                            <Tabs
                                value={viewMode}
                                onValueChange={(v) => {
                                    setViewMode(v as any);
                                    // Removed reset logic to persist state
                                }}
                                className="w-full sm:w-auto"
                            >
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="company">
                                        <Building2 className="h-4 w-4 mr-2" /> Company
                                    </TabsTrigger>
                                    <TabsTrigger value="vehicle">
                                        <Car className="h-4 w-4 mr-2" /> Vehicle
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>

                            <div className="relative flex-1 w-full">
                                <Popover open={open} onOpenChange={setOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={open}
                                            className="w-full justify-between"
                                        >
                                            {selectedLabel || (viewMode === 'company' ? "Select Company..." : "Select Vehicle...")}
                                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder={`Search ${viewMode}...`} />
                                            <CommandList>
                                                <CommandEmpty>No results found.</CommandEmpty>
                                                <CommandGroup>
                                                    {items.map((item: any) => (
                                                        <CommandItem
                                                            key={item.id}
                                                            value={item.label}
                                                            onSelect={() => handleSelect(item)}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedId === item.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span>{item.label}</span>
                                                                {item.subLabel && <span className="text-xs text-muted-foreground">{item.subLabel}</span>}
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Content Area */}
                    <div className="space-y-6">
                        {!selectedId ? (
                            <div className="p-12 text-center text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
                                {viewMode === 'company' ? <Building2 className="h-16 w-16 mx-auto mb-4 opacity-20" /> : <Car className="h-16 w-16 mx-auto mb-4 opacity-20" />}
                                <h3 className="text-xl font-semibold opacity-70">
                                    {viewMode === 'company' ? "Select a Company" : "Select a Vehicle"}
                                </h3>
                                <p className="mt-2">Use the search bar above to generate a 360° analytics report.</p>
                            </div>
                        ) : (
                            viewMode === 'company'
                                ? <CompanyAnalyticsView
                                    companyId={selectedId}
                                    onVehicleClick={(id, label) => {
                                        setViewMode('vehicle');
                                        setSelectedVehicle({ id, label });
                                    }}
                                />
                                : <VehicleAnalyticsView vehicleId={selectedId} />
                        )}
                    </div>

                </main>
            </div>
        </div>
    );
}
