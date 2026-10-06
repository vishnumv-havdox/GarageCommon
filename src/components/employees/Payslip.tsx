
import React from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface PayslipProps {
    data: any;
    companyProfile?: any;
    ref?: React.Ref<HTMLDivElement>;
}

export const Payslip = React.forwardRef<HTMLDivElement, PayslipProps>(
    ({ data, companyProfile }, ref) => {
        if (!data) return null;

        const formatCurrency = (amount: number) => {
            return new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
            }).format(amount || 0);
        };

        return (
            <div ref={ref} className="p-8 max-w-[210mm] mx-auto bg-white text-slate-900 print:p-10 print:max-w-none">

                {/* Header */}
                <div className="border-b-2 border-slate-800 pb-6 mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 uppercase">
                            {companyProfile?.company_name || 'Service Center'}
                        </h1>
                        <p className="text-sm font-medium text-slate-500 mt-1">Payslip & Salary Statement</p>
                        {companyProfile?.address && (
                            <p className="text-xs text-slate-400 mt-1 max-w-[300px] whitespace-pre-wrap">
                                {companyProfile.address}
                            </p>
                        )}
                        <div className="flex gap-3 mt-1 text-[10px] text-slate-400">
                            {companyProfile?.phone && <span>Ph: {companyProfile.phone}</span>}
                            {companyProfile?.email && <span>Email: {companyProfile.email}</span>}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-slate-500 uppercase font-semibold">Pay Period</div>
                        <div className="text-lg font-bold text-slate-900 whitespace-nowrap">
                            {format(new Date(data.period_start), "d MMM yyyy")} <span className="text-slate-400 mx-1">to</span> {format(new Date(data.period_end), "d MMM yyyy")}
                        </div>
                        <div className="mt-2">
                            <Badge variant="outline" className="text-xs uppercase border-slate-900 text-slate-900 rounded-sm px-2 py-0.5">
                                {data.status}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Employee Details Grid */}
                <div className="bg-slate-50 p-6 rounded-lg mb-8 border border-slate-100">
                    <div className="grid grid-cols-2 gap-y-6 gap-x-12">
                        <div>
                            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Employee Name</label>
                            <div className="text-xl font-bold text-slate-900">{data.employees?.name}</div>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Payslip ID</label>
                            <div className="text-sm font-medium font-mono text-slate-700">{data.id.slice(0, 8).toUpperCase()}</div>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Payment Date</label>
                            <div className="text-sm font-medium text-slate-700">
                                {data.payment_date ? format(new Date(data.payment_date), "PPP") : "Pending"}
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Days Present</label>
                            <div className="text-sm font-medium text-slate-700">{data.days_present} Days</div>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Payment Method</label>
                            <div className="text-sm font-medium text-slate-700 uppercase">
                                {data.payment_method?.replace('_', ' ') || 'Cash'}
                            </div>
                        </div>
                        <div>
                            {data.payment_method === 'bank_transfer' && data.account_number && (
                                <>
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Bank Account</label>
                                    <div className="text-sm font-medium text-slate-700">
                                        {data.bank_name || 'Bank'} ({data.account_number.slice(-4).padStart(data.account_number.length, '*')})
                                    </div>
                                </>
                            )}
                            {data.payment_method === 'upi' && data.upi_id && (
                                <>
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">UPI ID</label>
                                    <div className="text-sm font-medium text-slate-700">
                                        {data.upi_id}
                                    </div>
                                </>
                            )}
                            {(!data.payment_method || data.payment_method === 'cash') && (
                                <>
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Payment Detail</label>
                                    <div className="text-sm font-medium text-slate-700 italic">
                                        Handed over in Cash
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Earnings Table */}
                <div className="mb-8">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-4 border-b border-slate-200 pb-2">Earnings & Adjustments</h3>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center py-3 border-b border-slate-100 border-dashed">
                            <span className="text-sm font-medium text-slate-600">Base Salary Calculation</span>
                            <span className="text-sm font-bold text-slate-900">{formatCurrency(data.base_calc)}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-slate-100 border-dashed">
                            <span className="text-sm font-medium text-slate-600">Overtime Pay</span>
                            <span className="text-sm font-medium text-slate-900">{formatCurrency(data.overtime_pay)}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-slate-100 border-dashed">
                            <span className="text-sm font-medium text-slate-600">Job Incentives / Bonuses</span>
                            <span className="text-sm font-medium text-slate-900">{formatCurrency(data.job_incentives)}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-slate-100 border-dashed">
                            <span className="text-sm font-medium text-slate-600">Arrears / Other Adjustments</span>
                            <span className={`text-sm font-medium ${data.arrears_adj < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                                {data.arrears_adj > 0 ? '+' : ''}{formatCurrency(data.arrears_adj)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-slate-100 border-dashed">
                            <span className="text-sm font-medium text-slate-600">Attendance Deductions</span>
                            <span className="text-sm font-medium text-red-600">
                                {data.attendance_adj < 0 ? '-' : ''}{formatCurrency(Math.abs(data.attendance_adj))}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Total */}
                <div className="bg-slate-900 text-white p-6 rounded-lg mb-8 flex justify-between items-center shadow-lg">
                    <div>
                        <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">Net Payable Amount</span>
                    </div>
                    <div className="text-3xl font-bold tracking-tight">
                        {formatCurrency(data.total_amount)}
                    </div>
                </div>

                {/* Footer */}
                <div className="grid grid-cols-2 gap-12 mt-12 pt-8 border-t border-slate-200">
                    <div>
                        <div className="h-16 mb-2"></div>
                        <div className="border-t border-slate-400 pt-2 text-xs font-bold uppercase text-slate-500">Employer Signature</div>
                    </div>
                    <div>
                        <div className="h-16 mb-2"></div>
                        <div className="border-t border-slate-400 pt-2 text-xs font-bold uppercase text-slate-500">Employee Signature</div>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">Generated via Admin Portal • {format(new Date(), "PP pp")}</p>
                </div>

            </div>
        );
    }
);

Payslip.displayName = "Payslip";
