import React from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ToWords } from 'to-words';
import { BillingTaxSettings, getBillingSettings, getItemGstRate } from '@/utils/billingSettings';

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
});

interface InvoiceTemplateProps {
    invoice: any;
    items: any[];
    companyProfile?: any;
    settings?: any; // To pass terms & conditions
    billingSettings?: BillingTaxSettings;
    themeColor?: 'slate' | 'blue' | 'emerald' | 'indigo' | 'rose';
    showLogo?: boolean;
    customTerms?: string;
    customFooter?: string;
    selectedSignatureUrl?: string;
    viewMode?: 'both' | 'service' | 'spare' | 'combined';
    ref?: React.Ref<HTMLDivElement>;
}

// Clean terms string: remove escaped \n and format into clean lines
const parseTermsList = (rawTerms?: string): string[] => {
    if (!rawTerms) return [];
    const normalized = rawTerms.replace(/\\n/g, '\n').replace(/\\r/g, '');
    return normalized
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => line.replace(/^\d+[\.\)]\s*/, '')); // Strip redundant "1. " if rendering in ordered list
};

export const InvoiceTemplate = React.forwardRef<HTMLDivElement, InvoiceTemplateProps>(
    (
        {
            invoice,
            items,
            companyProfile,
            settings,
            billingSettings,
            themeColor = 'slate',
            showLogo = true,
            customTerms,
            customFooter,
            selectedSignatureUrl,
            viewMode
        },
        ref
    ) => {
        if (!invoice) return <div ref={ref}></div>;

        const formatCurrency = (amount: number) => {
            return new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 2,
            }).format(amount || 0);
        };

        const isQuotation = invoice.type === 'quotation';
        const activeBilling = billingSettings || getBillingSettings(companyProfile);

        // Normalize items to ensure all tax and total values are 100% mathematically exact
        const normalizedItems = React.useMemo(() => {
            return (items || []).map((i) => {
                const qty = Number(i.quantity) || 1;
                const price = Number(i.unit_price) || 0;
                const taxable = Number(i.taxable_value ?? (qty * price));
                const defaultRate = getItemGstRate(i.type || 'service', activeBilling);
                const gst = Number(i.gst_rate ?? defaultRate);
                const cgstRate = Number(i.cgst_rate ?? (gst / 2));
                const sgstRate = Number(i.sgst_rate ?? (gst / 2));
                const cgstAmt = Number((taxable * (cgstRate / 100)).toFixed(2));
                const sgstAmt = Number((taxable * (sgstRate / 100)).toFixed(2));
                const taxAmt = Number((cgstAmt + sgstAmt).toFixed(2));
                const itemTotal = Number((taxable + taxAmt).toFixed(2));

                return {
                    ...i,
                    quantity: qty,
                    unit_price: price,
                    taxable_value: taxable,
                    gst_rate: gst,
                    cgst_rate: cgstRate,
                    sgst_rate: sgstRate,
                    cgst_amount: cgstAmt,
                    sgst_amount: sgstAmt,
                    tax_amount: taxAmt,
                    total: itemTotal
                };
            });
        }, [items, activeBilling]);

        // Find default signature if not explicitly selected
        const defaultSignature = React.useMemo(() => {
            const signatures = companyProfile?.bank_details?.signatures || [];
            const def = signatures.find((s: any) => s.is_default);
            return def?.signature_url || signatures[0]?.signature_url || null;
        }, [companyProfile]);

        const activeSignatureUrl = selectedSignatureUrl || defaultSignature;

        // Categorize items
        const serviceItems = React.useMemo(() => normalizedItems.filter(i => i.type === 'service'), [normalizedItems]);
        const partItems = React.useMemo(() => normalizedItems.filter(i => i.type === 'part'), [normalizedItems]);

        // Clean terms
        const rawTermsText = customTerms || settings?.terms_and_conditions || '';
        const termsList = React.useMemo(() => parseTermsList(rawTermsText), [rawTermsText]);

        // Color theme mapping
        const getThemeClasses = (color: string) => {
            switch (color) {
                case 'blue':
                    return {
                        primaryText: 'text-blue-950',
                        accentText: 'text-blue-700',
                        border: 'border-blue-100',
                        thickBorder: 'border-blue-800',
                        bgHighlight: 'bg-blue-900 text-white',
                        bgLight: 'bg-blue-50/60',
                        badge: 'border-blue-800 text-blue-900 bg-blue-50'
                    };
                case 'emerald':
                    return {
                        primaryText: 'text-emerald-950',
                        accentText: 'text-emerald-700',
                        border: 'border-emerald-100',
                        thickBorder: 'border-emerald-800',
                        bgHighlight: 'bg-emerald-900 text-white',
                        bgLight: 'bg-emerald-50/60',
                        badge: 'border-emerald-800 text-emerald-900 bg-emerald-50'
                    };
                case 'indigo':
                    return {
                        primaryText: 'text-indigo-950',
                        accentText: 'text-indigo-700',
                        border: 'border-indigo-100',
                        thickBorder: 'border-indigo-800',
                        bgHighlight: 'bg-indigo-900 text-white',
                        bgLight: 'bg-indigo-50/60',
                        badge: 'border-indigo-800 text-indigo-900 bg-indigo-50'
                    };
                case 'rose':
                    return {
                        primaryText: 'text-rose-950',
                        accentText: 'text-rose-700',
                        border: 'border-rose-100',
                        thickBorder: 'border-rose-800',
                        bgHighlight: 'bg-rose-900 text-white',
                        bgLight: 'bg-rose-50/60',
                        badge: 'border-rose-800 text-rose-900 bg-rose-50'
                    };
                case 'slate':
                default:
                    return {
                        primaryText: 'text-slate-900',
                        accentText: 'text-slate-700',
                        border: 'border-slate-200',
                        thickBorder: 'border-slate-900',
                        bgHighlight: 'bg-slate-900 text-white',
                        bgLight: 'bg-slate-50',
                        badge: 'border-slate-900 text-slate-900 bg-slate-50'
                    };
            }
        };

        const theme = getThemeClasses(themeColor);

        // Determine effective view mode
        // If 2 GST is disabled in settings, always render single combined bill
        const effectiveViewMode: 'both' | 'service' | 'spare' | 'combined' = React.useMemo(() => {
            if (!activeBilling.enable_dual_gst) return 'combined';
            if (viewMode && ['both', 'service', 'spare', 'combined'].includes(viewMode)) return viewMode;
            if (serviceItems.length > 0 && partItems.length > 0) return 'both';
            if (serviceItems.length > 0) return 'service';
            if (partItems.length > 0) return 'spare';
            return 'combined';
        }, [viewMode, activeBilling.enable_dual_gst, serviceItems.length, partItems.length]);

        const baseBillNumber = isQuotation
            ? (invoice.quotation_number || invoice.bill_number || invoice.invoice_number || 'QTN')
            : (invoice.bill_number || invoice.invoice_number || 'INV');

        /**
         * Reusable Single Bill Document Subcomponent
         */
        const renderSingleBill = (billType: 'service' | 'spare' | 'combined', billIndex?: number, totalBills?: number) => {
            const billItems = billType === 'service'
                ? serviceItems
                : billType === 'spare'
                ? partItems
                : normalizedItems;

            const taxableSum = billItems.reduce((acc, i) => acc + (i.taxable_value || 0), 0);
            const cgstSum = billItems.reduce((acc, i) => acc + (i.cgst_amount || 0), 0);
            const sgstSum = billItems.reduce((acc, i) => acc + (i.sgst_amount || 0), 0);
            const totalTax = cgstSum + sgstSum;
            const totalPayable = taxableSum + totalTax;
            const totalPayableRounded = Math.round(totalPayable);

            // Document title & tags
            let title = isQuotation ? 'Quotation / Estimate' : 'Tax Invoice';
            let billTag = '';
            let billGstin = '';

            if (billType === 'service') {
                title = isQuotation ? 'Quotation / Estimate (Services & Labor)' : 'Tax Invoice (Services & Labor)';
                billTag = totalBills && totalBills > 1 ? `Bill ${billIndex} of ${totalBills}: Service Bill` : 'Service Bill';
                billGstin = activeBilling.service_gst_number || companyProfile?.tax_id || '';
            } else if (billType === 'spare') {
                title = isQuotation ? 'Quotation / Estimate (Spare Parts & Materials)' : 'Tax Invoice (Spare Parts & Materials)';
                billTag = totalBills && totalBills > 1 ? `Bill ${billIndex} of ${totalBills}: Spare Parts Bill` : 'Spare Parts Bill';
                billGstin = activeBilling.spare_gst_number || companyProfile?.tax_id || '';
            } else {
                title = isQuotation ? 'Quotation / Estimate' : 'Tax Invoice';
                billTag = activeBilling.enable_dual_gst ? 'Combined Bill' : '';
                billGstin = activeBilling.service_gst_number || companyProfile?.tax_id || '';
            }

            const docNumber = billType === 'service' && totalBills && totalBills > 1
                ? `${baseBillNumber}-S`
                : billType === 'spare' && totalBills && totalBills > 1
                ? `${baseBillNumber}-P`
                : baseBillNumber;

            // Group tax rates in items to display accurate rates
            const ratesUsed = Array.from(new Set(billItems.map(i => i.gst_rate || 18)));
            const ratesLabel = ratesUsed.map(r => `${r}%`).join(', ');

            return (
                <div key={billType} className="single-bill-page p-6 sm:p-8 max-w-[210mm] mx-auto bg-white text-slate-900 font-sans leading-normal">
                    {/* Header */}
                    <div className={`border-b-2 ${theme.thickBorder} pb-4 mb-5 flex justify-between items-start`}>
                        <div className="flex gap-4 items-start">
                            {showLogo && companyProfile?.logo_url && (
                                <img
                                    src={companyProfile.logo_url}
                                    alt="Logo"
                                    className="h-16 w-16 object-contain rounded border border-slate-200 bg-white p-1 shrink-0"
                                />
                            )}
                            <div>
                                <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${theme.primaryText} uppercase`}>
                                    {companyProfile?.company_name || 'Amma Auto Garage'}
                                </h1>
                                <p className="text-xs font-semibold text-slate-600 mt-0.5">
                                    {title}
                                </p>
                                {companyProfile?.address && (
                                    <p className="text-xs text-slate-600 mt-1 max-w-[340px] whitespace-pre-wrap leading-tight">
                                        {companyProfile.address}
                                    </p>
                                )}
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-600">
                                    {companyProfile?.phone && <span>Ph: <strong>{companyProfile.phone}</strong></span>}
                                    {companyProfile?.email && <span>Email: {companyProfile.email}</span>}
                                </div>

                                {/* GSTIN specific to this bill */}
                                <div className="mt-2">
                                    {billType === 'service' ? (
                                        <div className="inline-block bg-slate-100/90 border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800">
                                            Service GSTIN: <strong className="font-semibold text-slate-900">{billGstin || 'Not Registered'}</strong>
                                        </div>
                                    ) : billType === 'spare' ? (
                                        <div className="inline-block bg-slate-100/90 border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800">
                                            Spare Parts GSTIN: <strong className="font-semibold text-slate-900">{billGstin || 'Not Registered'}</strong>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {activeBilling.enable_dual_gst ? (
                                                <div className="flex flex-wrap gap-2 text-xs">
                                                    {activeBilling.service_gst_number && (
                                                        <span className="bg-slate-100 border border-slate-300 rounded px-2 py-0.5 text-slate-800">
                                                            Service GSTIN: <strong>{activeBilling.service_gst_number}</strong>
                                                        </span>
                                                    )}
                                                    {activeBilling.spare_gst_number && (
                                                        <span className="bg-slate-100 border border-slate-300 rounded px-2 py-0.5 text-slate-800">
                                                            Spare Parts GSTIN: <strong>{activeBilling.spare_gst_number}</strong>
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                (companyProfile?.tax_id || activeBilling.service_gst_number) && (
                                                    <span className="inline-block bg-slate-100 border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800">
                                                        GSTIN: <strong>{activeBilling.service_gst_number || companyProfile?.tax_id}</strong>
                                                    </span>
                                                )
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Bill Metadata */}
                        <div className="text-right shrink-0">
                            {billTag && (
                                <div className="mb-1.5">
                                    <Badge variant="outline" className={`text-[10px] font-semibold ${theme.badge} rounded px-2 py-0.5`}>
                                        {billTag}
                                    </Badge>
                                </div>
                            )}
                            <div className="text-[10px] text-slate-500 uppercase font-semibold">
                                {isQuotation ? 'Quotation No' : 'Invoice No'}
                            </div>
                            <div className={`text-base font-bold ${theme.primaryText}`}>
                                {docNumber}
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase font-semibold mt-1.5">Date</div>
                            <div className={`text-xs font-semibold ${theme.primaryText}`}>
                                {format(new Date(invoice.created_at || new Date()), "d MMM yyyy")}
                            </div>
                            <div className="mt-1.5">
                                <Badge variant="outline" className="text-[10px] uppercase border-slate-300 text-slate-700 rounded px-1.5 py-0.5">
                                    {invoice.status || 'Draft'}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Customer & Vehicle Details Card */}
                    <div className={`${theme.bgLight} p-4 rounded-lg mb-5 border ${theme.border}`}>
                        <div className="grid grid-cols-2 gap-6">
                            {/* Billed To */}
                            <div>
                                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1 tracking-wide">Billed To</span>
                                <div className={`text-sm font-bold ${theme.primaryText}`}>{invoice.customer?.name || 'Customer'}</div>
                                {invoice.customer?.company_name && (
                                    <div className="text-xs font-medium text-slate-700 mt-0.5">{invoice.customer.company_name}</div>
                                )}
                                <div className="text-xs text-slate-600 mt-0.5">{invoice.customer?.phone}</div>
                                {invoice.customer?.address && (
                                    <div className="text-xs text-slate-600 mt-0.5 max-w-[280px] leading-snug">{invoice.customer.address}</div>
                                )}
                                {invoice.customer?.gst_number && (
                                    <div className="text-xs font-semibold text-slate-800 mt-1">
                                        Customer GSTIN: {invoice.customer.gst_number}
                                    </div>
                                )}
                            </div>

                            {/* Vehicle Details */}
                            <div>
                                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1 tracking-wide">Vehicle Details</span>
                                <div className={`text-sm font-bold ${theme.primaryText}`}>{invoice.work_order?.vehicle?.vehicle_number || 'Vehicle'}</div>
                                <div className="text-xs font-medium text-slate-700 mt-0.5">{invoice.work_order?.vehicle?.model || ''}</div>
                                <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-4">
                                    <span>KM: <strong>{invoice.work_order?.vehicle?.kilometers_driven || 'N/A'}</strong></span>
                                    {invoice.work_order?.vehicle?.next_service_km && (
                                        <span>Next Service: <strong>{invoice.work_order.vehicle.next_service_km} km</strong></span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Line Items Table */}
                    <div className="mb-5">
                        <div className="flex items-center justify-between mb-2 border-b border-slate-200 pb-1">
                            <h3 className={`text-xs font-bold uppercase tracking-wider ${theme.primaryText}`}>
                                {billType === 'service'
                                    ? 'Service Charges & Labor'
                                    : billType === 'spare'
                                    ? 'Spare Parts & Materials'
                                    : 'Items & Charges'}
                            </h3>
                            <span className="text-[11px] text-slate-500">
                                {billItems.length} {billItems.length === 1 ? 'item' : 'items'}
                            </span>
                        </div>

                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="text-[10px] uppercase text-slate-600 font-bold border-b border-slate-200 bg-slate-50">
                                <tr>
                                    <th className="py-2 px-2 w-8 text-center">#</th>
                                    <th className="py-2 px-2">Description</th>
                                    <th className="py-2 px-2 w-20 text-center">{billType === 'service' ? 'SAC Code' : billType === 'spare' ? 'HSN Code' : 'HSN/SAC'}</th>
                                    {billType !== 'service' && <th className="py-2 px-2 w-12 text-center">Qty</th>}
                                    <th className="py-2 px-2 text-right w-24">Price</th>
                                    <th className="py-2 px-2 w-14 text-center">GST %</th>
                                    <th className="py-2 px-2 text-right w-20">Tax Amt</th>
                                    <th className="py-2 px-2 text-right w-24">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 border-b border-slate-200">
                                {billItems.map((item, idx) => (
                                    <tr key={item.id || idx} className="hover:bg-slate-50/50">
                                        <td className="py-2 px-2 text-center text-slate-400 text-xs">{idx + 1}</td>
                                        <td className="py-2 px-2 font-medium text-slate-800">
                                            {item.description}
                                            {item.category && item.category !== 'Spare' && (
                                                <span className="text-[10px] text-slate-400 block font-normal">{item.category}</span>
                                            )}
                                        </td>
                                        <td className="py-2 px-2 text-center text-slate-600 font-medium text-xs">
                                            {item.hsn_code || '-'}
                                        </td>
                                        {billType !== 'service' && (
                                            <td className="py-2 px-2 text-center font-medium text-slate-700">
                                                {item.quantity}
                                            </td>
                                        )}
                                        <td className="py-2 px-2 text-right text-slate-700 font-medium">
                                            {formatCurrency(item.taxable_value || (item.unit_price * item.quantity))}
                                        </td>
                                        <td className="py-2 px-2 text-center text-slate-600 text-xs font-medium">
                                            {item.gst_rate || 18}%
                                        </td>
                                        <td className="py-2 px-2 text-right text-slate-600 text-xs font-medium">
                                            {formatCurrency((item.cgst_amount || 0) + (item.sgst_amount || 0))}
                                        </td>
                                        <td className={`py-2 px-2 text-right font-bold ${theme.primaryText}`}>
                                            {formatCurrency(item.total)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary & Final Settlement Block */}
                    <div className="mb-5">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
                            {/* Left: Tax Summary & Words */}
                            <div className="w-full sm:w-1/2 space-y-3">
                                {/* Tax Summary */}
                                <div>
                                    <h4 className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center justify-between">
                                        <span>Tax Summary</span>
                                        <span className="text-[10px] font-semibold text-slate-600">
                                            GST Rate: {ratesLabel}
                                        </span>
                                    </h4>
                                    <table className={`w-full text-xs text-left border ${theme.border} bg-white rounded overflow-hidden`}>
                                        <thead className={`${theme.bgLight} text-slate-600 font-bold border-b ${theme.border}`}>
                                            <tr>
                                                <th className="py-1 px-2.5">Tax Component</th>
                                                <th className="py-1 px-2.5 text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700">
                                            <tr>
                                                <td className="py-1 px-2.5">Taxable Value</td>
                                                <td className="py-1 px-2.5 text-right font-medium">{formatCurrency(taxableSum)}</td>
                                            </tr>
                                            <tr>
                                                <td className="py-1 px-2.5">CGST</td>
                                                <td className="py-1 px-2.5 text-right font-medium">{formatCurrency(cgstSum)}</td>
                                            </tr>
                                            <tr>
                                                <td className="py-1 px-2.5">SGST</td>
                                                <td className="py-1 px-2.5 text-right font-medium">{formatCurrency(sgstSum)}</td>
                                            </tr>
                                            <tr className={`${theme.bgLight} font-bold`}>
                                                <td className={`py-1 px-2.5 ${theme.primaryText}`}>Total GST</td>
                                                <td className={`py-1 px-2.5 text-right ${theme.primaryText}`}>{formatCurrency(totalTax)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Amount in Words */}
                                <div className={`text-xs text-slate-700 ${theme.bgLight} p-2.5 rounded border ${theme.border}`}>
                                    <span className="font-bold text-slate-500 text-[9px] uppercase block mb-0.5 tracking-wide">Amount in Words</span>
                                    <span className="font-medium text-slate-800 capitalize leading-tight block">
                                        {toWords.convert(totalPayableRounded)}
                                    </span>
                                </div>
                            </div>

                            {/* Right: Net Payable Box */}
                            <div className="w-full sm:w-5/12 space-y-2">
                                <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between text-slate-600">
                                        <span>Taxable Amount:</span>
                                        <span className="font-semibold text-slate-800">{formatCurrency(taxableSum)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600">
                                        <span>Total GST:</span>
                                        <span className="font-semibold text-slate-800">{formatCurrency(totalTax)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600">
                                        <span>Gross Total:</span>
                                        <span className="font-semibold text-slate-800">{formatCurrency(totalPayable)}</span>
                                    </div>
                                </div>

                                <div className={`border-t ${theme.border} my-1`}></div>

                                {/* Highlight Net Payable */}
                                <div className={`${theme.bgHighlight} p-3 rounded-lg shadow-sm`}>
                                    <div className="flex justify-between items-center mb-0.5">
                                        <span className="text-[10px] uppercase tracking-wider text-slate-200 font-bold">
                                            {isQuotation ? 'Estimated Payable' : 'Net Payable'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xl sm:text-2xl font-bold tracking-tight">
                                            ₹{totalPayableRounded.toLocaleString('en-IN')}
                                        </span>
                                        <span className="text-[10px] text-slate-200 font-medium">(Rounded)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Terms, Notes & Bank Details */}
                    <div className={`grid grid-cols-2 gap-6 pt-3 border-t ${theme.border} mb-4`}>
                        <div className="space-y-2">
                            {termsList.length > 0 && (
                                <div>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase mb-1 tracking-wider">Terms & Conditions</p>
                                    <ol className="list-decimal list-inside space-y-0.5 text-[10px] text-slate-600 leading-snug">
                                        {termsList.map((term, tIdx) => (
                                            <li key={tIdx}>{term}</li>
                                        ))}
                                    </ol>
                                </div>
                            )}
                            {invoice.notes && (
                                <div>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase mb-0.5 tracking-wider">Notes</p>
                                    <p className="text-[10px] text-slate-600 leading-snug whitespace-pre-wrap">{invoice.notes}</p>
                                </div>
                            )}
                        </div>

                        <div>
                            {companyProfile?.bank_name && !isQuotation && (
                                <div className={`p-2.5 bg-slate-50 rounded border ${theme.border} text-[10px] text-slate-700 space-y-1`}>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Banking Details</p>
                                    <div className="flex justify-between"><span className="text-slate-500">Bank:</span> <span className="font-semibold">{companyProfile.bank_name}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Account:</span> <span className="font-semibold">{companyProfile.acc_name}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">A/C No:</span> <span className="font-semibold">{companyProfile.acc_number}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">IFSC:</span> <span className="font-semibold">{companyProfile.ifsc}</span></div>
                                    {companyProfile.upi_id && (
                                        <div className="flex justify-between pt-0.5 border-t border-slate-200"><span className="text-slate-500">UPI:</span> <span className="font-semibold">{companyProfile.upi_id}</span></div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Signatures */}
                    <div className={`grid grid-cols-2 gap-10 pt-4 border-t ${theme.border}`}>
                        <div>
                            <div className="h-10 mb-1"></div>
                            <div className="border-t border-slate-300 pt-1 text-[9px] font-bold uppercase text-slate-500">Customer Signature</div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                            <div className="h-10 mb-1 flex items-end justify-end">
                                {activeSignatureUrl ? (
                                    <img
                                        src={activeSignatureUrl}
                                        alt="Authorized Signatory"
                                        className="max-h-10 object-contain print:mix-blend-multiply"
                                    />
                                ) : (
                                    <div className="h-10 w-24"></div>
                                )}
                            </div>
                            <div className="border-t border-slate-300 pt-1 text-[9px] font-bold uppercase text-slate-500 w-full">Authorized Signatory</div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-4 text-center">
                        <p className="text-[9px] text-slate-400 uppercase tracking-wider">
                            {customFooter || settings?.footer_text || `Generated via Admin Portal • ${format(new Date(), "PP pp")}`}
                        </p>
                    </div>
                </div>
            );
        };

        return (
            <div ref={ref} className="invoice-print-container font-sans bg-slate-100 print:bg-white text-slate-900">
                {effectiveViewMode === 'both' ? (
                    <div className="space-y-6 print:space-y-0">
                        {/* Bill 1: Service Bill */}
                        {serviceItems.length > 0 && renderSingleBill('service', 1, partItems.length > 0 ? 2 : 1)}

                        {/* Visual divider in screen view & strict Page Break in print */}
                        {serviceItems.length > 0 && partItems.length > 0 && (
                            <div
                                className="page-break-after-always print:break-after-page my-6 print:my-0 py-2 border-b-2 border-dashed border-slate-300 print:border-none text-center relative"
                                style={{ pageBreakAfter: 'always', breakAfter: 'page' }}
                            >
                                <span className="print:hidden bg-slate-200 text-slate-700 text-[11px] font-semibold px-3 py-1 rounded-full border border-slate-300 shadow-2xs">
                                    Page 2: Spare Parts Bill (Separate Bill)
                                </span>
                            </div>
                        )}

                        {/* Bill 2: Spare Parts Bill */}
                        {partItems.length > 0 && renderSingleBill('spare', 2, 2)}
                    </div>
                ) : effectiveViewMode === 'service' ? (
                    renderSingleBill('service', 1, 1)
                ) : effectiveViewMode === 'spare' ? (
                    renderSingleBill('spare', 1, 1)
                ) : (
                    renderSingleBill('combined', 1, 1)
                )}
            </div>
        );
    }
);

InvoiceTemplate.displayName = "InvoiceTemplate";
