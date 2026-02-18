import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Gauge, Clock, ChevronUp, AlertTriangle, AlertCircle, Calendar, Package, FileText, ArrowRight, X } from "lucide-react";
import { GarageClock } from "./GarageClock";
import { useRequests } from "@/contexts/RequestsContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

interface GlobalHUDProps {
    children: React.ReactNode;
}

interface AppNotification {
    id: string;
    type: 'appointment' | 'urgent' | 'part' | 'approval';
    title: string;
    description: string;
    time: string;
    link: string;
}

export const GlobalHUD: React.FC<GlobalHUDProps> = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const { urgentAppointments, pendingAppointments, pendingPartRequests, pendingWorkApprovals } = useRequests();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [dismissedIds, setDismissedIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchNotificationDetails = async () => {
        if (isLoading) return;
        setIsLoading(true);
        try {
            const allNotifications: any[] = [];

            // 1. Fetch some pending appointments
            if (pendingAppointments > 0) {
                const { data } = await supabase
                    .from('appointments')
                    .select('id, created_at, customer:customers(name)')
                    .eq('status', 'pending')
                    .limit(3);

                (data as any[])?.forEach(app => {
                    allNotifications.push({
                        id: app.id,
                        type: 'appointment',
                        title: 'New Appointment',
                        description: `Request from ${app.customer?.name || 'Customer'}`,
                        time: app.created_at,
                        link: '/admin/requests?tab=appointments'
                    });
                });
            }

            // 2. Fetch some urgent confirmed appointments
            if (urgentAppointments > 0) {
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                const { data } = await supabase
                    .from('appointments')
                    .select('id, scheduled_at, vehicle:vehicles(vehicle_number)')
                    .eq('status', 'confirmed')
                    .lte('scheduled_at', today.toISOString())
                    .limit(3);

                (data as any[])?.forEach(app => {
                    allNotifications.push({
                        id: app.id,
                        type: 'urgent',
                        title: 'Appointment Arrived',
                        description: `Open Job Card for ${app.vehicle?.vehicle_number || 'Vehicle'}`,
                        time: app.scheduled_at,
                        link: '/admin/work-orders'
                    });
                });
            }

            // 3. Fetch some pending part requests
            if (pendingPartRequests > 0) {
                const { data } = await supabase
                    .from('part_requests')
                    .select('id, created_at, part:inventory(item_name)')
                    .eq('status', 'pending')
                    .limit(3);

                (data as any[])?.forEach(req => {
                    allNotifications.push({
                        id: req.id,
                        type: 'part',
                        title: 'Part Request',
                        description: `Items needed: ${req.part?.item_name || 'Inventory'}`,
                        time: req.created_at,
                        link: '/admin/requests?tab=part-requests'
                    });
                });
            }

            // 4. Fetch some pending work approvals
            if (pendingWorkApprovals > 0) {
                const { data } = await supabase
                    .from('work_orders')
                    .select('id, created_at, vehicle:vehicles(vehicle_number)')
                    .eq('status', 'Pending Approval')
                    .limit(3);

                (data as any[])?.forEach(wo => {
                    allNotifications.push({
                        id: wo.id,
                        type: 'approval',
                        title: 'Work Approval Needed',
                        description: `Verify Job Card for ${wo.vehicle?.vehicle_number || 'Vehicle'}`,
                        time: wo.created_at,
                        link: '/admin/requests?tab=work-approvals'
                    });
                });
            }

            setNotifications(allNotifications.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
        } catch (error) {
            console.error('Error fetching HUD notifications:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchNotificationDetails();
        }
    }, [isOpen]);

    const handleDismiss = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDismissedIds(prev => [...prev, id]);
    };

    const activeNotifications = notifications.filter(n => !dismissedIds.includes(n.id));

    const getIcon = (type: string) => {
        switch (type) {
            case 'appointment': return <Calendar className="w-4 h-4 text-blue-500" />;
            case 'urgent': return <AlertCircle className="w-4 h-4 text-red-500" />;
            case 'part': return <Package className="w-4 h-4 text-orange-500" />;
            case 'approval': return <FileText className="w-4 h-4 text-emerald-500" />;
            default: return <AlertTriangle className="w-4 h-4 text-primary" />;
        }
    };

    // Don't show the floating HUD on the dashboard, as it has its own fixed clock
    const isDashboard = location.pathname === "/admin";
    const isAdmin = location.pathname.startsWith("/admin");

    if (!isAdmin) return <>{children}</>;

    return (
        <div className="relative min-h-screen">
            {/* Floating Trigger - Top Center */}
            {!isDashboard && (
                <div className="fixed top-0 left-1/2 -translate-x-1/2 z-[200] transition-all duration-500 ease-in-out pointer-events-none">
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className={`flex items-center justify-center gap-2 px-6 py-2 bg-slate-950 text-white rounded-b-2xl border-x border-b border-primary/20 shadow-2xl transition-all duration-300 hover:py-3 hover:bg-black pointer-events-auto group`}
                    >
                        {isOpen ? (
                            <ChevronUp className="w-5 h-5 text-primary animate-bounce" />
                        ) : (
                            <>
                                <Gauge className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                                <Clock className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                                {urgentAppointments > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 items-center justify-center text-[8px] font-bold">
                                            !
                                        </span>
                                    </span>
                                )}
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Expanded HUD - Full Screen Tray Style */}
            {!isDashboard && (
                <div
                    className={`fixed inset-0 z-[190] transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1) ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                    {/* Dark Backdrop */}
                    <div
                        className={`absolute inset-0 bg-slate-950/40 backdrop-blur-md transition-opacity duration-700 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Content Container */}
                    <div
                        className={`absolute inset-x-0 top-0 transition-transform duration-700 cubic-bezier(0.16, 1, 0.3, 1) transform ${isOpen ? 'translate-y-0' : '-translate-y-full'}`}
                    >
                        <div className="bg-slate-900 shadow-[0_32px_64px_rgba(0,0,0,0.5)] border-b border-white/10 rounded-b-[3rem] pb-12 pt-20 px-6 flex flex-col items-center">

                            {/* The Clock Section */}
                            <div className="scale-110 md:scale-125 transform transition-all duration-700 mb-12 pointer-events-auto">
                                <GarageClock />
                            </div>

                            {/* Notifications Drawer Section */}
                            <div className="w-full max-w-2xl pointer-events-auto">
                                <div className="flex items-center justify-between mb-4 px-2">
                                    <h3 className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                        Recent Notifications
                                    </h3>
                                    {activeNotifications.length > 0 && (
                                        <Badge variant="outline" className="border-white/10 text-white/40 text-[9px] font-bold">
                                            {activeNotifications.length} TOTAL
                                        </Badge>
                                    )}
                                </div>

                                <ScrollArea className="h-[300px] w-full pr-4">
                                    <div className="space-y-3">
                                        {activeNotifications.length === 0 ? (
                                            <div className="py-12 flex flex-col items-center justify-center text-center opacity-30 grayscale">
                                                <Package className="w-12 h-12 text-white mb-3" />
                                                <p className="text-white text-xs font-bold uppercase tracking-widest">Inbox Zero</p>
                                                <p className="text-white/60 text-[10px] mt-1">No pending actions at the moment</p>
                                            </div>
                                        ) : (
                                            activeNotifications.map((notif) => (
                                                <div
                                                    key={notif.id}
                                                    onClick={() => {
                                                        navigate(notif.link);
                                                        setIsOpen(false);
                                                    }}
                                                    className="group relative bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/10 p-4 rounded-3xl transition-all duration-300 cursor-pointer overflow-hidden shadow-2xl"
                                                >
                                                    <div className="flex items-center gap-4 relative z-10">
                                                        <div className="p-3 bg-slate-100 dark:bg-white/5 rounded-2xl group-hover:bg-primary/10 transition-colors">
                                                            {getIcon(notif.type)}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between gap-2 mb-0.5">
                                                                <p className="text-white font-bold text-sm tracking-tight">{notif.title}</p>
                                                                <span className="text-white/30 text-[9px] font-medium uppercase font-mono tracking-wider">
                                                                    {formatDistanceToNow(new Date(notif.time), { addSuffix: true })}
                                                                </span>
                                                            </div>
                                                            <p className="text-white/50 text-xs font-medium line-clamp-1">
                                                                {notif.description}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={(e) => handleDismiss(e, notif.id)}
                                                            className="p-2 text-white/20 hover:text-white/60 hover:bg-white/5 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                        <ArrowRight className="w-4 h-4 text-white/10 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                                    </div>

                                                    {/* Swipe/Glow Effect */}
                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>

                                {activeNotifications.length > 5 && (
                                    <div className="mt-4 pt-4 border-t border-white/10">
                                        <button
                                            onClick={() => { navigate('/admin/requests'); setIsOpen(false); }}
                                            className="w-full text-center text-white/40 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] transition-colors"
                                        >
                                            View All Actions in Inbox
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Page Content Wrapper */}
            <div className="relative z-0">
                {children}
            </div>
        </div>
    );
};
