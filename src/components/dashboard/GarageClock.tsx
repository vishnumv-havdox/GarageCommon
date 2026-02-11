import React, { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Zap } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

export const GarageClock: React.FC = () => {
    const [time, setTime] = useState(new Date());
    const [gear, setGear] = useState(1);
    const [shifterPos, setShifterPos] = useState({ x: -12, y: -12 });
    const [isShifting, setIsShifting] = useState(false);
    const [rpmRotate, setRpmRotate] = useState(-90);
    const [secondPercentage, setSecondPercentage] = useState(0);
    const prevGearRef = useRef(1);
    const requestRef = useRef<number>();

    // Gauge numbers 1 to 6
    const gaugeNumbers = [1, 2, 3, 4, 5, 6];
    const getAngleForNumber = (num: number) => ((num - 1) * (180 / 5)) - 90;

    // H-Pattern Coordinates for 1-6 gears
    const gearPositions: Record<number, { x: number, y: number }> = {
        1: { x: -12, y: -12 },
        2: { x: -12, y: 12 },
        3: { x: 0, y: -12 },
        4: { x: 0, y: 12 },
        5: { x: 12, y: -12 },
        6: { x: 12, y: 12 }
    };

    const animate = () => {
        const now = new Date();
        const ms = now.getMilliseconds();
        const s = now.getSeconds();

        if (now.getSeconds() !== time.getSeconds()) {
            setTime(now);
        }

        const gearDuration = 10;
        const progressInSeconds = (s % gearDuration) + ms / 1000;
        const progressFactor = progressInSeconds / gearDuration;

        setRpmRotate(progressFactor * 180 - 90);

        const currentGear = Math.floor(s / gearDuration) + 1;
        if (currentGear !== prevGearRef.current) {
            handleGearShift(prevGearRef.current, currentGear);
            prevGearRef.current = currentGear;
        }

        setSecondPercentage(((s + ms / 1000) / 60) * 100);
        requestRef.current = requestAnimationFrame(animate);
    };

    const handleGearShift = async (oldGear: number, newGear: number) => {
        setGear(newGear);
        setIsShifting(true);

        const start = gearPositions[oldGear] || gearPositions[1];
        const end = gearPositions[newGear] || gearPositions[1];

        // If gears are in different columns, move through neutral center
        if (start.x !== end.x) {
            // 1. Move to Neutral of current column
            setShifterPos({ x: start.x, y: 0 });
            await new Promise(r => setTimeout(r, 150));
            // 2. Move along Neutral bar to new column
            setShifterPos({ x: end.x, y: 0 });
            await new Promise(r => setTimeout(r, 150));
            // 3. Move to target gear position
            setShifterPos({ x: end.x, y: end.y });
        } else {
            // Straight vertical shift (1->2, 3->4, etc)
            // Still pass through neutral for effect
            setShifterPos({ x: start.x, y: 0 });
            await new Promise(r => setTimeout(r, 100));
            setShifterPos({ x: end.x, y: end.y });
        }

        setTimeout(() => setIsShifting(false), 400);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    const renderOdometerDigit = (digit: string, key: string) => (
        <div key={key} className="relative h-6 w-4 bg-black overflow-hidden border-x border-white/5 rounded-sm shadow-inner flex flex-col items-center">
            <div
                className="transition-transform duration-500 ease-in-out flex flex-col"
                style={{ transform: `translateY(-${parseInt(digit) * 10}%)` }}
            >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                    <div key={n} className="h-6 flex items-center justify-center text-sm font-black text-white font-mono leading-none">
                        {n}
                    </div>
                ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60 pointer-events-none" />
        </div>
    );

    const hours = format(time, "hh");
    const mins = format(time, "mm");
    const secs = format(time, "ss");

    return (
        <div className="flex flex-row items-center gap-3 p-1.5 px-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm select-none transition-all hover:shadow-md group">

            {/* FLUID RPM GAUGE PANEL */}
            <div className="relative w-28 h-14 flex items-center justify-center bg-slate-950 rounded-xl overflow-hidden shadow-lg border border-white/10 px-2 mt-1">
                <div className="absolute inset-0 pointer-events-none">
                    {gaugeNumbers.map((num) => {
                        const angle = getAngleForNumber(num);
                        const distance = Math.abs(rpmRotate - angle);
                        const scale = Math.max(1, 1.8 - (distance / 40));
                        const opacity = Math.max(0.3, 1 - (distance / 60));

                        return (
                            <div
                                key={num}
                                className="absolute transition-all duration-100 flex items-center justify-center"
                                style={{
                                    left: '50%',
                                    bottom: '10%',
                                    transform: `rotate(${angle}deg) translateY(-38px) rotate(${-angle}deg) scale(${scale})`,
                                    opacity: opacity,
                                    color: num > 4 ? '#ef4444' : num > 3 ? '#f59e0b' : '#10b981',
                                    fontSize: '8px',
                                    fontWeight: '900'
                                }}
                            >
                                {num}
                            </div>
                        );
                    })}
                </div>

                <div className="absolute inset-0 opacity-20">
                    <svg viewBox="0 0 100 50" className="w-full h-full">
                        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#334155" strokeWidth="8" strokeDasharray="1,2" />
                        <path
                            d="M 10 50 A 40 40 0 0 1 90 50"
                            fill="none"
                            stroke="url(#rpmGradientFinal)"
                            strokeWidth="8"
                            strokeDasharray={(secondPercentage * 1.25) + ", 1000"}
                            className="transition-all duration-300 ease-linear"
                        />
                        <defs>
                            <linearGradient id="rpmGradientFinal" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#10b981" />
                                <stop offset="60%" stopColor="#f59e0b" />
                                <stop offset="100%" stopColor="#ef4444" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>

                <div
                    className="absolute bottom-1 h-10 w-0.5 bg-red-500 origin-bottom shadow-[0_0_8px_rgba(239,68,68,0.8)] z-10"
                    style={{
                        transform: `rotate(${rpmRotate}deg)`,
                        transition: rpmRotate < -80 ? 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'transform 16ms linear'
                    }}
                >
                    <div className="absolute top-0 -left-0.5 w-1.5 h-1.5 rounded-full bg-red-400 blur-[1px]" />
                </div>
            </div>

            {/* MANUAL GEAR SHIFTER & DISPLAY */}
            <div className="flex flex-row items-center gap-2 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                <div className="relative w-10 h-10 bg-slate-950 rounded-lg border border-white/5 overflow-hidden flex items-center justify-center p-1">
                    <div className="absolute inset-0 opacity-20 flex flex-col justify-between p-1.5">
                        <div className="flex justify-between text-[5px] font-bold text-white"><span>1</span><span>3</span><span>5</span></div>
                        <div className="flex justify-between text-[5px] font-bold text-white"><span>2</span><span>4</span><span>6</span></div>
                    </div>
                    <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 40 40">
                        <line x1="8" y1="8" x2="8" y2="32" stroke="white" strokeWidth="1" />
                        <line x1="20" y1="8" x2="20" y2="32" stroke="white" strokeWidth="1" />
                        <line x1="32" y1="8" x2="32" y2="32" stroke="white" strokeWidth="1" />
                        <line x1="8" y1="20" x2="32" y2="20" stroke="white" strokeWidth="1" />
                    </svg>
                    <div
                        className="absolute w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_12px_rgba(var(--primary-rgb),1)] border border-white/20 transition-all duration-200 ease-out z-10"
                        style={{
                            transform: `translate(${shifterPos.x}px, ${shifterPos.y}px)`
                        }}
                    >
                        <div className="absolute inset-0 bg-white/20 rounded-full animate-ping" />
                        <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-full" />
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center min-w-[35px]">
                    <div className={`relative w-8 h-8 ${isShifting ? 'bg-red-500 scale-110 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'bg-primary'} rounded-lg flex items-center justify-center shadow-lg border border-white/20 transition-all duration-150`}>
                        <span className="relative text-lg font-black text-white italic drop-shadow-md">{gear}</span>
                    </div>
                    <div className="text-[5px] font-black text-slate-500 uppercase tracking-tighter text-center mt-0.5">GEAR</div>
                </div>
            </div>

            {/* DARK ODOMETER CLOCK PANEL */}
            <div className="flex items-center gap-1 p-1 bg-black rounded-xl border border-white/10 shadow-xl ml-1">
                <div className="flex gap-px">
                    {renderOdometerDigit(hours[0], "h1")}
                    {renderOdometerDigit(hours[1], "h2")}
                </div>
                <span className="text-primary font-bold text-xs animate-pulse mx-0.5">:</span>
                <div className="flex gap-px">
                    {renderOdometerDigit(mins[0], "m1")}
                    {renderOdometerDigit(mins[1], "m2")}
                </div>
                <span className="text-red-500/80 font-bold text-[8px] mx-0.5 animate-pulse">:</span>
                <div className="flex gap-px">
                    {renderOdometerDigit(secs[0], "s1")}
                    {renderOdometerDigit(secs[1], "s2")}
                </div>
            </div>

            {/* INTEGRATED CALENDAR */}
            <div className="border-l border-slate-200 dark:border-slate-800 pl-3 flex items-center gap-3 h-10">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent flex flex-col items-end leading-none group/cal">
                            <span className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">{format(time, "EEE")}</span>
                            <span className="text-sm font-black text-slate-800 dark:text-slate-100 group-hover/cal:text-primary transition-colors">{format(time, "dd MMM")}</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden z-[200]" align="end">
                        <div className="bg-primary p-3 text-white">
                            <h4 className="font-bold flex items-center gap-2 text-xs uppercase tracking-widest">
                                <CalendarIcon className="h-3 w-3" /> Workshop Hub
                            </h4>
                        </div>
                        <Calendar mode="single" selected={time} className="rounded-b-2xl border-none" />
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
};
