import React, { useState, useEffect, useRef } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Calendar as CalendarIcon, Activity, User, Building2, Car, Clock, ArrowRight, CalendarDays } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const GarageClock: React.FC = () => {
    const [time, setTime] = useState(new Date());
    const [appointments, setAppointments] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
    const [gear, setGear] = useState(1);
    const [shifterPos, setShifterPos] = useState({ x: -14, y: -14 });
    const [isShifting, setIsShifting] = useState(false);

    // For smooth needle animation
    const requestRef = useRef<number>();
    const [smoothSeconds, setSmoothSeconds] = useState(0);
    const prevGearRef = useRef(1);

    // Track "Reset" state for custom return animation
    const [isResetting, setIsResetting] = useState(false);

    const gearPositions: Record<number, { x: number, y: number }> = {
        1: { x: -14, y: -14 },
        2: { x: -14, y: 14 },
        3: { x: 0, y: -14 },
        4: { x: 0, y: 14 },
        5: { x: 14, y: -14 },
        6: { x: 14, y: 14 }
    };

    const animate = () => {
        const now = new Date();
        const s = now.getSeconds();
        const ms = now.getMilliseconds();

        const exactSeconds = s + ms / 1000;
        setSmoothSeconds(exactSeconds);

        if (s !== time.getSeconds()) {
            setTime(now);
        }

        // --- GEAR LOGIC ---
        const blockIndex = Math.floor(exactSeconds / 10);
        const currentGear = Math.min(6, blockIndex + 1);

        // Detect Gear Change (Reset Point)
        if (currentGear !== prevGearRef.current) {
            handleGearShift(prevGearRef.current, currentGear);
            setIsResetting(true);
            setTimeout(() => setIsResetting(false), 300);
            prevGearRef.current = currentGear;
        } else if (currentGear !== gear && !isShifting) {
            setGear(currentGear);
        }

        requestRef.current = requestAnimationFrame(animate);
    };

    const handleGearShift = async (oldGear: number, newGear: number) => {
        setIsShifting(true);
        const start = gearPositions[oldGear] || gearPositions[1];
        const end = gearPositions[newGear] || gearPositions[1];

        if (start.x !== end.x) {
            setShifterPos({ x: start.x, y: 0 });
            await new Promise(r => setTimeout(r, 80));
            setShifterPos({ x: end.x, y: 0 });
            await new Promise(r => setTimeout(r, 80));
            setShifterPos({ x: end.x, y: end.y });
        } else {
            setShifterPos({ x: start.x, y: 0 });
            await new Promise(r => setTimeout(r, 50));
            setShifterPos({ x: end.x, y: end.y });
        }
        setGear(newGear);
        setTimeout(() => setIsShifting(false), 200);
    };

    useEffect(() => {
        const fetchAppointments = async () => {
            const { data } = await supabase
                .from('appointments')
                .select(`
                    id, 
                    scheduled_at, 
                    status, 
                    customer:customers(name, company_name), 
                    vehicle:vehicles(vehicle_number)
                `)
                .not('status', 'in', '("cancelled","rejected")');
            if (data) setAppointments(data);
        };
        fetchAppointments();
    }, []);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [gear, isShifting]);

    // --- SVG GAUGE CONFIG ---
    const startAngle = -120;
    const endAngle = 120;
    const totalSweep = endAngle - startAngle;
    const radius = 42;

    // Progress within block (0.0 to 1.0)
    const blockProgress = (smoothSeconds % 10) / 10;
    const currentAngle = startAngle + (blockProgress * totalSweep);
    const visualTickIndex = Math.min(10, Math.round(blockProgress * 10));

    // Labels
    const gearStart = (gear - 1) * 10;
    const labels = [];
    for (let i = 0; i <= 10; i++) labels.push(gearStart + i);

    // Shift Lights
    const renderShiftLights = () => {
        const leds = 8;
        return (
            <div className="flex gap-1 mb-1 justify-center absolute -top-3">
                {Array.from({ length: leds }).map((_, i) => {
                    const threshold = 0.5 + (i * 0.07);
                    const isActive = blockProgress > threshold;
                    let color = "bg-green-600";
                    if (i > 4) color = "bg-yellow-500";
                    if (i > 6) color = "bg-red-600";

                    return (
                        <div
                            key={i}
                            className={cn(
                                "w-3 h-1.5 rounded-sm transition-all duration-75",
                                isActive ? `${color} shadow-sm scale-110` : "bg-slate-300 opacity-60"
                            )}
                        />
                    );
                })}
            </div>
        );
    }

    // Helper to render Gear Number on H-Pattern
    const renderGearNum = (num: number, x: number, y: number) => {
        const isActive = gear === num;
        return (
            <div
                className={cn(
                    "absolute w-4 h-4 flex items-center justify-center text-[8px] font-black transition-all duration-200 z-10 rounded-full",
                    isActive
                        ? "text-primary-foreground bg-primary scale-125 shadow-md ring-2 ring-primary/30"
                        : "text-muted-foreground/70 bg-transparent"
                )}
                style={{
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                    transform: 'translate(-50%, -50%)'
                }}
            >
                {num}
            </div>
        );
    }

    return (
        <div className="relative p-1 rounded-3xl bg-card shadow-md border border-border select-none group inline-block transition-colors">
            <div className="relative bg-card/80 backdrop-blur-md rounded-[1.3rem] p-3 flex items-center gap-4 h-32 border border-border/60">

                {/* Visual Shifter (Left) */}
                <div className="flex flex-col items-center justify-center z-10 w-24 scale-100">
                    <div className="relative w-20 h-20 bg-muted/40 rounded-xl border border-border shadow-inner flex items-center justify-center overflow-visible">

                        {/* Gear Numbers */}
                        {renderGearNum(1, -16, -32)}
                        {renderGearNum(2, -16, 32)}
                        {renderGearNum(3, 0, -32)}
                        {renderGearNum(4, 0, 32)}
                        {renderGearNum(5, 16, -32)}
                        {renderGearNum(6, 16, 32)}

                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="absolute h-12 w-px bg-muted-foreground/30 left-[calc(50%-16px)]" />
                            <div className="absolute h-12 w-px bg-muted-foreground/30 left-1/2" />
                            <div className="absolute h-12 w-px bg-muted-foreground/30 left-[calc(50%+16px)]" />
                            <div className="absolute w-[32px] h-px bg-muted-foreground/30 top-1/2" />
                        </div>
                        <div
                            className="absolute w-4 h-4 bg-foreground rounded-full shadow-lg border border-border transition-all duration-100 ease-out z-20"
                            style={{
                                transform: `translate(${shifterPos.x * 1.15}px, ${shifterPos.y * 1.15}px)`
                            }}
                        />
                    </div>
                </div>

                {/* Main Gauge (Center) - SVG Based */}
                <div className="flex flex-col items-center z-20 relative pt-2">
                    {renderShiftLights()}

                    <div className="relative w-28 h-28 flex items-center justify-center">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100">
                            {/* Gauge Ring Background */}
                            <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" className="text-border" strokeWidth="1" />

                            {/* Major Ticks & Numbers */}
                            {Array.from({ length: 11 }).map((_, i) => {
                                const tickAngle = startAngle + (i * (totalSweep / 10));
                                const isClose = i === visualTickIndex;
                                const num = labels[i];

                                const rad = (tickAngle - 90) * (Math.PI / 180);
                                const textR = radius - 8;
                                const tx = 50 + textR * Math.cos(rad);
                                const ty = 50 + textR * Math.sin(rad);

                                return (
                                    <g key={`major-${i}`}>
                                        {/* Major Tick */}
                                        <line
                                            x1="50" y1={50 - radius}
                                            x2="50" y2={50 - radius + 4}
                                            stroke={i === visualTickIndex ? "hsl(var(--primary))" : "currentColor"}
                                            className={i === visualTickIndex ? "" : "text-muted-foreground/40"}
                                            strokeWidth={i === visualTickIndex ? 2.5 : 1.5}
                                            transform={`rotate(${tickAngle} 50 50)`}
                                        />
                                        {/* Text Label */}
                                        <text
                                            x={tx} y={ty}
                                            fill={isClose ? "hsl(var(--primary))" : "currentColor"}
                                            className={cn(
                                                "font-mono transition-all duration-100",
                                                isClose ? "font-bold" : "text-muted-foreground/70"
                                            )}
                                            fontSize={isClose ? "9" : "7"}
                                            fontWeight={isClose ? "bold" : "normal"}
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                        >
                                            {num}
                                        </text>
                                    </g>
                                );
                            })}
                        </svg>

                        {/* Animated Needle */}
                        <div
                            className="absolute inset-0 flex items-center justify-center will-change-transform"
                            style={{
                                transform: `rotate(${currentAngle}deg)`,
                                transition: isResetting ? 'transform 300ms cubic-bezier(0.2, 0, 0, 1)' : 'transform 75ms linear'
                            }}
                        >
                            <div className="w-0.5 bg-primary rounded-full shadow-sm origin-bottom" style={{ height: '42%', marginBottom: '42%' }} />
                        </div>

                        {/* Center Cap & Gear */}
                        <div className="absolute w-16 h-16 bg-card rounded-full border border-border flex items-center justify-center shadow-md z-20">
                            <div className="flex flex-col items-center">
                                <div className="text-[6px] text-muted-foreground font-bold uppercase tracking-widest -mb-0.5">Gear</div>
                                <div className={cn(
                                    "text-4xl font-black italic tabular-nums leading-none tracking-tighter transition-all duration-75",
                                    isShifting ? "scale-90 text-primary blur-[0.5px]" : "text-foreground"
                                )}>
                                    {gear}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Clock */}
                <div className="flex flex-col items-end justify-center z-10 w-20 gap-2">
                    <div className="flex flex-col items-end">
                        <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Time</div>
                        <div className="text-3xl font-mono font-black text-foreground tabular-nums leading-none tracking-tighter">
                            {format(time, "hh:mm")}
                        </div>
                        <div className="text-xs font-mono font-bold text-muted-foreground">
                            {format(time, "ss")}s <span className="text-[10px] ml-1 text-muted-foreground/60">{format(time, "a")}</span>
                        </div>
                    </div>

                    <div className="w-12 h-px bg-border" />

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" className="h-auto p-0 hover:bg-transparent flex flex-col items-end group/cal">
                                <span className="text-lg font-bold text-foreground hover:text-primary transition-colors uppercase leading-none">
                                    {format(time, "MMM dd")}
                                </span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 border border-border shadow-2xl rounded-3xl overflow-hidden mr-10 z-[300] bg-popover text-popover-foreground" align="center" side="left">
                            <div className="flex bg-popover border-none overflow-hidden min-h-[350px]">
                                {/* Left Side: Calendar */}
                                <div className="p-4 border-r border-border bg-muted/20">
                                    <Calendar
                                        mode="single"
                                        selected={selectedDate}
                                        onSelect={setSelectedDate}
                                        className="rounded-xl bg-transparent text-foreground"
                                        modifiers={{
                                            hasAppointment: (date) =>
                                                appointments.some(app =>
                                                    format(new Date(app.scheduled_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') &&
                                                    !['cancelled', 'rejected', 'completed'].includes(app.status)
                                                )
                                        }}
                                        modifiersStyles={{
                                            hasAppointment: {
                                                fontWeight: 'bold',
                                                backgroundColor: 'hsl(var(--primary) / 0.15)',
                                                color: 'hsl(var(--primary))',
                                                border: '1px solid hsl(var(--primary) / 0.3)'
                                            }
                                        }}
                                    />
                                </div>

                                {/* Right Side: Appointment Details */}
                                <div className="w-80 p-6 flex flex-col h-full bg-card text-card-foreground">
                                    <div className="flex items-center gap-2 mb-6">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                                            <CalendarDays className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-foreground leading-none">
                                                {selectedDate ? format(selectedDate, "MMMM dd") : "Select Date"}
                                            </h4>
                                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Appointments</p>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] pr-2 scrollbar-hide">
                                        {selectedDate && appointments.filter(app =>
                                            format(new Date(app.scheduled_at), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd') &&
                                            !['cancelled', 'rejected', 'completed'].includes(app.status)
                                        ).length > 0 ? (
                                            appointments
                                                .filter(app =>
                                                    format(new Date(app.scheduled_at), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd') &&
                                                    !['cancelled', 'rejected', 'completed'].includes(app.status)
                                                )
                                                .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                                                .map((app) => (
                                                    <div key={app.id} className="p-3.5 rounded-2xl bg-muted/40 border border-border flex flex-col gap-2.5 group hover:border-primary/40 hover:bg-primary/5 transition-all duration-200">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex items-center gap-1.5 text-foreground font-bold text-xs uppercase tracking-tight">
                                                                <Clock className="h-3 w-3 text-primary" />
                                                                {format(new Date(app.scheduled_at), "h:mm a")}
                                                            </div>
                                                            <div className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                                {formatDistanceToNow(new Date(app.scheduled_at), { addSuffix: true })}
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1 pt-0.5">
                                                            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                                                                <User className="h-3 w-3 text-muted-foreground" />
                                                                <div className="flex flex-col">
                                                                    <span>{app.customer?.name || 'Unknown Customer'}</span>
                                                                    {app.customer?.company_name && (
                                                                        <span className="text-[10px] text-primary font-semibold">
                                                                            {app.customer.company_name}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
                                                                <Car className="h-3 w-3 text-muted-foreground/70" />
                                                                {app.vehicle?.vehicle_number || 'No Vehicle'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-40 text-center space-y-3 opacity-60">
                                                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                                    <Activity className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                                <p className="text-xs font-medium text-muted-foreground">No appointments scheduled for this date</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-border">
                                        <Button variant="ghost" className="w-full justify-between h-9 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/5 rounded-xl group" asChild>
                                            <a href="/admin/appointments">
                                                View Schedule
                                                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                                            </a>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

            </div>
        </div>
    );
};
