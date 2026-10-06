
import React from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ToWords } from 'to-words';

const toWords = new ToWords({
    localeCode: 'en-IN',
    converterOptions: {
        currency: true,
        ignoreDecimal: false,
        ignoreZeroCurrency: false,
        doNotAddOnly: false,
        currencyOptions: {
            name: 'Rupee',
            plural: 'Rupees',
            symbol: '₹',
            fractionalUnit: {
                name: 'Paisa',
                plural: 'Paise',
                symbol: '',
            },
        },
    },
});interface InvoiceTemplateProps {
    invoice: any;
    items: any[];
    companyProfile?: any;
    settings?: any; // To pass terms & conditions
    themeColor?: 'slate' | 'blue' | 'emerald' | 'indigo' | 'rose';
    showLogo?: boolean;
    customTerms?: string;
    customFooter?: string;
    selectedSignatureUrl?: string;
    ref?: React.Ref<HTMLDivElement>;
}

export const InvoiceTemplate = React.forwardRef<HTMLDivElement, InvoiceTemplateProps>(
    ({ invoice, items, companyProfile, settings, themeColor = 'slate', showLogo = true, customTerms, customFooter, selectedSignatureUrl }, ref) => {
        if (!invoice) return <div ref={ref}></div>;

        const formatCurrency = (amount: number) => {
            return new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 2,
            }).format(amount || 0);
        };

        const isQuotation = invoice.type === 'quotation';

        // Normalize items to ensure all tax and total values are computed and mathematically consistent
        const normalizedItems = React.useMemo(() => {
            return (items || []).map(i => {
                const qty = i.quantity || 1;
                const price = i.unit_price || 0;
                const gst = i.gst_rate ?? 18;
                const cgstRate = i.cgst_rate ?? (gst / 2);
                const sgstRate = i.sgst_rate ?? (gst / 2);
                const taxable = i.taxable_value || (qty * price);
                const cgstAmt = i.cgst_amount ?? (taxable * (cgstRate / 100));
                const sgstAmt = i.sgst_amount ?? (taxable * (sgstRate / 100));
                const itemTotal = i.total || (taxable + cgstAmt + sgstAmt);

                return {
                    ...i,
                    quantity: qty,
                    unit_price: price,
                    gst_rate: gst,
                    cgst_rate: cgstRate,
                    sgst_rate: sgstRate,
                    taxable_value: taxable,
                    cgst_amount: cgstAmt,
                    sgst_amount: sgstAmt,
                    total: itemTotal
                };
            });
        }, [items]);

        // Find default signature if not explicitly selected
        const defaultSignature = React.useMemo(() => {
            const signatures = companyProfile?.bank_details?.signatures || [];
            const def = signatures.find((s: any) => s.is_default);
            return def?.signature_url || signatures[0]?.signature_url || null;
        }, [companyProfile]);

        const activeSignatureUrl = selectedSignatureUrl || defaultSignature;

        // Categorize items
        const serviceItems = normalizedItems.filter(i => i.type === 'service');
        const partItems = normalizedItems.filter(i => i.type === 'part');

        // Calculate totals
        const calculateTotal = (items: any[]) => items.reduce((sum, i) => sum + (i.total || 0), 0);
        const calculateTaxable = (items: any[]) => items.reduce((sum, i) => sum + (i.taxable_value || i.unit_price * i.quantity), 0);
        const calculateCGST = (items: any[]) => items.reduce((sum, i) => sum + (i.cgst_amount || 0), 0);
        const calculateSGST = (items: any[]) => items.reduce((sum, i) => sum + (i.sgst_amount || 0), 0);

        const serviceTotal = calculateTotal(serviceItems);
        const partsTotal = calculateTotal(partItems);

        // Tax Summary Calculations
        const totalTaxable = calculateTaxable(serviceItems) + calculateTaxable(partItems);
        const totalCGST = calculateCGST(serviceItems) + calculateCGST(partItems);
        const totalSGST = calculateSGST(serviceItems) + calculateSGST(partItems);
        const totalGST = totalCGST + totalSGST;
        const grandTotal = serviceTotal + partsTotal;
        const grandTotalRounded = Math.round(grandTotal);
        const estimatedCost = Number(invoice.work_order?.estimated_cost || 0);
        const savings = estimatedCost > grandTotalRounded ? (estimatedCost - grandTotalRounded) : 0;

        // Custom colors mapping
        const getThemeClasses = (color: string) => {
            switch (color) {
                case 'blue':
                    return {
                        primaryText: 'text-blue-950',
                        accentText: 'text-blue-600',
                        border: 'border-blue-100',
                        thickBorder: 'border-blue-800',
                        bgHighlight: 'bg-blue-900 text-white',
                        bgLight: 'bg-blue-50/50',
                        badge: 'border-blue-900 text-blue-900'
                    };
                case 'emerald':
                    return {
                        primaryText: 'text-emerald-950',
                        accentText: 'text-emerald-600',
                        border: 'border-emerald-100',
                        thickBorder: 'border-emerald-800',
                        bgHighlight: 'bg-emerald-900 text-white',
                        bgLight: 'bg-emerald-50/50',
                        badge: 'border-emerald-900 text-emerald-900'
                    };
                case 'indigo':
                    return {
                        primaryText: 'text-indigo-950',
                        accentText: 'text-indigo-600',
                        border: 'border-indigo-100',
                        thickBorder: 'border-indigo-800',
                        bgHighlight: 'bg-indigo-900 text-white',
                        bgLight: 'bg-indigo-50/50',
                        badge: 'border-indigo-900 text-indigo-900'
                    };
                case 'rose':
                    return {
                        primaryText: 'text-rose-950',
                        accentText: 'text-rose-600',
                        border: 'border-rose-100',
                        thickBorder: 'border-rose-800',
                        bgHighlight: 'bg-rose-900 text-white',
                        bgLight: 'bg-rose-50/50',
                        badge: 'border-rose-900 text-rose-900'
                    };
                case 'slate':
                default:
                    return {
                        primaryText: 'text-slate-900',
                        accentText: 'text-slate-600',
                        border: 'border-slate-200',
                        thickBorder: 'border-slate-800',
                        bgHighlight: 'bg-slate-900 text-white',
                        bgLight: 'bg-slate-50',
                        badge: 'border-slate-900 text-slate-900'
                    };
            }
        };

        const theme = getThemeClasses(themeColor);

        return (
            <div ref={ref} className="p-8 max-w-[210mm] mx-auto bg-white text-slate-900 print:p-10 print:max-w-none font-sans">

                {/* Header */}
                <div className={`border-b-2 ${theme.thickBorder} pb-6 mb-8 flex justify-between items-start`}>
                    <div className="flex gap-4 items-start">
                        {showLogo && companyProfile?.logo_url && (
                            <img 
                                src={companyProfile.logo_url} 
                                alt="Logo" 
                                className="h-16 w-16 object-contain rounded border bg-slate-50 p-1"
                            />
                        )}
                        <div>
                            <h1 className={`text-2xl font-extrabold tracking-tight ${theme.primaryText} uppercase`}>
                                {companyProfile?.company_name || 'Service Center'}
                            </h1>
                            <p className="text-xs font-semibold text-slate-500 mt-0.5">
                                {isQuotation ? 'Quotation / Estimate' : 'Tax Invoice'}
                            </p>
                            {companyProfile?.address && (
                                <p className="text-[11px] text-slate-400 mt-1 max-w-[300px] whitespace-pre-wrap leading-tight">
                                    {companyProfile.address}
                                </p>
                            )}
                            <div className="flex gap-3 mt-1.5 text-[9px] text-slate-400">
                                {companyProfile?.phone && <span>Ph: {companyProfile.phone}</span>}
                                {companyProfile?.email && <span>Email: {companyProfile.email}</span>}
                            </div>
                            {companyProfile?.tax_id && (
                                <p className="text-[10px] font-bold text-slate-600 mt-1">
                                    GSTIN: {companyProfile.tax_id}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">
                            {isQuotation ? 'Quotation No' : 'Invoice No'}
                        </div>
                        <div className={`text-base font-bold ${theme.primaryText} whitespace-nowrap`}>
                            {isQuotation ? invoice.quotation_number : (invoice.bill_number || invoice.invoice_number)}
                        </div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold mt-2">Date</div>
                        <div className={`text-xs font-bold ${theme.primaryText}`}>
                            {format(new Date(invoice.created_at), "d MMM yyyy")}
                        </div>
                        <div className="mt-2">
                            <Badge variant="outline" className={`text-[10px] uppercase ${theme.badge} rounded-sm px-1.5 py-0.5 font-bold`}>
                                {invoice.status}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Customer & Vehicle Details Grid */}
                <div className={`${theme.bgLight} p-5 rounded-lg mb-8 border ${theme.border}`}>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-12">
                        {/* Customer Info */}
                        <div>
                            <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Billed To</label>
                            <div className={`text-sm font-bold ${theme.primaryText}`}>{invoice.customer?.name}</div>
                            {invoice.customer?.company_name && (
                                <div className="text-xs font-medium text-slate-700 mt-0.5">{invoice.customer.company_name}</div>
                            )}
                            <div className="text-[11px] text-slate-500 mt-0.5">{invoice.customer?.phone}</div>
                            {invoice.customer?.address && (
                                <div className="text-[11px] text-slate-500 mt-0.5 max-w-[200px] leading-tight">{invoice.customer.address}</div>
                            )}
                            {invoice.customer?.gst_number && (
                                <div className="text-[10px] font-bold text-slate-700 mt-1">
                                    GSTIN: {invoice.customer.gst_number}
                                </div>
                            )}
                        </div>

                        {/* Vehicle Info */}
                        <div>
                            <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Vehicle Details</label>
                            <div className={`text-sm font-bold ${theme.primaryText}`}>{invoice.work_order?.vehicle?.vehicle_number}</div>
                            <div className="text-xs font-medium text-slate-700 mt-0.5">{invoice.work_order?.vehicle?.model}</div>
                            <div className="text-[11px] text-slate-500 mt-1 flex gap-4">
                                <span>KM: {invoice.work_order?.vehicle?.kilometers_driven || 'N/A'}</span>
                                {invoice.work_order?.vehicle?.next_service_km && (
                                    <span>Next Svc: {invoice.work_order.vehicle.next_service_km} km</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Line Items */}
                <div className="mb-8 space-y-6">
                    {/* Services */}
                    {serviceItems.length > 0 && (
                        <div>
                            <h3 className={`text-xs font-bold uppercase tracking-wider ${theme.primaryText} mb-2.5 border-b ${theme.border} pb-1`}>Service Charges</h3>
                            <table className="w-full text-xs text-left">
                                <thead className="text-[9px] uppercase text-slate-400 font-bold border-b border-slate-100">
                                    <tr>
                                        <th className="py-1.5 w-8">#</th>
                                        <th className="py-1.5">Description</th>
                                        <th className="py-1.5 w-20">HSN/SAC</th>
                                        <th className="py-1.5 text-right w-20">Price</th>
                                        <th className="py-1.5 w-16 text-center">GST %</th>
                                        <th className="py-1.5 text-right w-20">Tax Amt</th>
                                        <th className="py-1.5 text-right w-24">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 border-b border-slate-100">
                                    {serviceItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="py-1.5 text-slate-400">{idx + 1}</td>
                                            <td className="py-1.5 font-medium text-slate-800">{item.description}</td>
                                            <td className="py-1.5 text-slate-500 font-mono text-[10px]">{item.hsn_code || '-'}</td>
                                            <td className="py-1.5 text-right text-slate-600 font-mono">{formatCurrency(item.taxable_value || item.unit_price)}</td>
                                            <td className="py-1.5 text-center text-slate-500 text-[10px]">{item.gst_rate || 18}%</td>
                                            <td className="py-1.5 text-right text-slate-500 text-[10px] font-mono">{formatCurrency((item.cgst_amount || 0) + (item.sgst_amount || 0))}</td>
                                            <td className={`py-1.5 text-right font-bold ${theme.primaryText} font-mono`}>{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Parts */}
                    {partItems.length > 0 && (
                        <div>
                            <h3 className={`text-xs font-bold uppercase tracking-wider ${theme.primaryText} mb-2.5 border-b ${theme.border} pb-1`}>Parts & Inventory</h3>
                            <table className="w-full text-xs text-left">
                                <thead className="text-[9px] uppercase text-slate-400 font-bold border-b border-slate-100">
                                    <tr>
                                        <th className="py-1.5 w-8">#</th>
                                        <th className="py-1.5">Description</th>
                                        <th className="py-1.5 w-20">HSN</th>
                                        <th className="py-1.5 w-12 text-center">Qty</th>
                                        <th className="py-1.5 text-right w-24">Unit Price</th>
                                        <th className="py-1.5 w-16 text-center">GST %</th>
                                        <th className="py-1.5 text-right w-20">Tax Amt</th>
                                        <th className="py-1.5 text-right w-24">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 border-b border-slate-100">
                                    {partItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="py-1.5 text-slate-400">{idx + 1}</td>
                                            <td className="py-1.5 font-medium text-slate-800">{item.description}</td>
                                            <td className="py-1.5 text-slate-500 font-mono text-[10px]">{item.hsn_code || '-'}</td>
                                            <td className="py-1.5 text-center text-slate-600">{item.quantity}</td>
                                            <td className="py-1.5 text-right text-slate-600 font-mono">{formatCurrency(item.unit_price)}</td>
                                            <td className="py-1.5 text-center text-slate-500 text-[10px]">{item.gst_rate || 18}%</td>
                                            <td className="py-1.5 text-right text-slate-500 text-[10px] font-mono">{formatCurrency((item.cgst_amount || 0) + (item.sgst_amount || 0))}</td>
                                            <td className={`py-1.5 text-right font-bold ${theme.primaryText} font-mono`}>{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Summary & Final Settlement */}
                <div className="mb-8">
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${theme.primaryText} mb-4 border-b ${theme.border} pb-1`}>Summary & Final Settlement</h3>

                    <div className="flex justify-between items-start gap-8">
                        <div className="w-1/2">
                            {/* Tax Summary Table */}
                            {!isQuotation && (
                                <div className="mb-4">
                                    <h4 className="text-[9px] uppercase font-bold text-slate-400 mb-1.5">Tax Summary</h4>
                                    <table className={`w-full text-[10px] text-left border ${theme.border}`}>
                                        <thead className={`${theme.bgLight} text-slate-500 font-bold border-b ${theme.border}`}>
                                            <tr>
                                                <th className="py-1 px-2">Tax Component</th>
                                                <th className="py-1 px-2 text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            <tr>
                                                <td className="py-1 px-2 text-slate-600">Total Taxable Value</td>
                                                <td className="py-1 px-2 text-right font-mono">{formatCurrency(totalTaxable)}</td>
                                            </tr>
                                            <tr>
                                                <td className="py-1 px-2 text-slate-600">Total CGST</td>
                                                <td className="py-1 px-2 text-right font-mono">{formatCurrency(totalCGST)}</td>
                                            </tr>
                                            <tr>
                                                <td className="py-1 px-2 text-slate-600">Total SGST</td>
                                                <td className="py-1 px-2 text-right font-mono">{formatCurrency(totalSGST)}</td>
                                            </tr>
                                            <tr className={`${theme.bgLight} font-bold`}>
                                                <td className={`py-1 px-2 ${theme.primaryText}`}>Total GST</td>
                                                <td className={`py-1 px-2 text-right font-mono ${theme.primaryText}`}>{formatCurrency(totalGST)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Amount In Words */}
                            <div className={`text-xs text-slate-600 ${theme.bgLight} p-2.5 rounded border ${theme.border}`}>
                                <span className="font-bold text-slate-400 text-[9px] uppercase block mb-0.5">Amount in Words</span>
                                <span className="capitalize font-medium text-slate-700">{toWords.convert(grandTotalRounded)}</span>
                            </div>
                        </div>

                        <div className="w-1/3">
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Service Charges:</span>
                                    <span className="font-medium font-mono text-slate-800">{formatCurrency(serviceTotal)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Parts & Materials:</span>
                                    <span className="font-medium font-mono text-slate-800">{formatCurrency(partsTotal)}</span>
                                </div>
                                {savings > 0 && (
                                    <>
                                        <div className="flex justify-between text-xs text-slate-500">
                                            <span>Original Estimate:</span>
                                            <span className="font-medium font-mono text-slate-800">{formatCurrency(estimatedCost)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                                            <span>You Saved:</span>
                                            <span className="font-mono">{formatCurrency(savings)}</span>
                                        </div>
                                    </>
                                )}
                                <div className={`border-t ${theme.border} my-1.5`}></div>

                                {/* Net Payable Box */}
                                <div className={`${theme.bgHighlight} p-3.5 rounded-lg shadow-sm`}>
                                    <div className="flex justify-between items-center mb-0.5">
                                        <span className="text-[9px] uppercase tracking-widest text-slate-200/80 font-bold">Net Payable</span>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xl font-extrabold tracking-tight">₹{grandTotalRounded.toLocaleString('en-IN')}</span>
                                        <span className="text-[9px] text-slate-200/70 font-mono">(Rounded)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Additional Info Grid: Terms, Notes, Bank Details */}
                <div className={`grid grid-cols-2 gap-8 mb-6 pt-5 border-t ${theme.border}`}>
                    <div className="space-y-4">
                        {/* Terms */}
                        {(customTerms || settings?.terms_and_conditions) && (
                            <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Terms & Conditions</p>
                                <p className="text-[10px] text-slate-500 whitespace-pre-wrap leading-relaxed">
                                    {customTerms || settings.terms_and_conditions}
                                </p>
                            </div>
                        )}

                        {/* Notes */}
                        {invoice.notes && (
                            <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Notes</p>
                                <p className="text-[10px] text-slate-500 whitespace-pre-wrap leading-relaxed">{invoice.notes}</p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        {/* Bank Details */}
                        {companyProfile?.bank_name && !isQuotation && (
                            <div className={`p-3 bg-slate-50 rounded border ${theme.border}`}>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Banking Details</p>
                                <div className="space-y-1 text-[10px] text-slate-600">
                                    <div className="flex justify-between"><span className="text-slate-400">Bank:</span> <span className="font-semibold text-slate-700">{companyProfile.bank_name}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Account Name:</span> <span className="font-semibold text-slate-700">{companyProfile.acc_name}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Account No:</span> <span className="font-mono font-semibold text-slate-700">{companyProfile.acc_number}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">IFSC Code:</span> <span className="font-mono font-semibold text-slate-700">{companyProfile.ifsc}</span></div>
                                    {companyProfile.upi_id && (
                                        <div className="flex justify-between pt-1 mt-1 border-t border-slate-100">
                                            <span className="text-slate-400">UPI ID:</span>
                                            <span className="font-mono font-semibold text-slate-700">{companyProfile.upi_id}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className={`grid grid-cols-2 gap-12 mt-4 pt-6 border-t ${theme.border}`}>
                    <div>
                        <div className="h-12 mb-1.5"></div>
                        <div className="border-t border-slate-300 pt-1 text-[9px] font-bold uppercase text-slate-400">Customer Signature</div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <div className="h-12 mb-1.5 flex items-end justify-end">
                            {activeSignatureUrl ? (
                                <img 
                                    src={activeSignatureUrl} 
                                    alt="Authorized Signature" 
                                    className="max-h-12 object-contain print:mix-blend-multiply"
                                />
                            ) : (
                                <div className="h-12 w-24"></div>
                            )}
                        </div>
                        <div className="border-t border-slate-300 pt-1 text-[9px] font-bold uppercase text-slate-400 w-full">Authorized Signatory</div>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <p className="text-[9px] text-slate-400 uppercase tracking-widest">
                        {customFooter || settings?.footer_text || `Generated via Admin Portal • ${format(new Date(), "PP pp")}`}
                    </p>
                </div>

            </div>
        );
    }
);

InvoiceTemplate.displayName = "InvoiceTemplate";
