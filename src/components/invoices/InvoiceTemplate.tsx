
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
});

interface InvoiceTemplateProps {
    invoice: any;
    items: any[];
    companyProfile?: any;
    settings?: any; // To pass terms & conditions
    ref?: React.Ref<HTMLDivElement>;
}

export const InvoiceTemplate = React.forwardRef<HTMLDivElement, InvoiceTemplateProps>(
    ({ invoice, items, companyProfile, settings }, ref) => {
        if (!invoice) return <div ref={ref}></div>;

        const formatCurrency = (amount: number) => {
            return new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 2,
            }).format(amount || 0);
        };

        const isQuotation = invoice.type === 'quotation';

        // Categorize items
        const serviceItems = items.filter(i => i.type === 'service');
        const partItems = items.filter(i => i.type === 'part');

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

        return (
            <div ref={ref} className="p-8 max-w-[210mm] mx-auto bg-white text-slate-900 print:p-10 print:max-w-none font-sans">

                {/* Header */}
                <div className="border-b-2 border-slate-800 pb-6 mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 uppercase">
                            {companyProfile?.company_name || 'Amma Auto'}
                        </h1>
                        <p className="text-sm font-medium text-slate-500 mt-1">
                            {isQuotation ? 'Quotation / Estimate' : 'Tax Invoice'}
                        </p>
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
                        <div className="text-xs text-slate-500 uppercase font-semibold">
                            {isQuotation ? 'Quotation No' : 'Invoice No'}
                        </div>
                        <div className="text-lg font-bold text-slate-900 whitespace-nowrap">
                            {isQuotation ? invoice.quotation_number : (invoice.bill_number || invoice.invoice_number)}
                        </div>
                        <div className="text-xs text-slate-500 uppercase font-semibold mt-2">Date</div>
                        <div className="text-sm font-bold text-slate-900">
                            {format(new Date(invoice.created_at), "d MMM yyyy")}
                        </div>
                        <div className="mt-2">
                            <Badge variant="outline" className="text-xs uppercase border-slate-900 text-slate-900 rounded-sm px-2 py-0.5">
                                {invoice.status}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Customer & Vehicle Details Grid */}
                <div className="bg-slate-50 p-6 rounded-lg mb-8 border border-slate-100">
                    <div className="grid grid-cols-2 gap-y-6 gap-x-12">
                        {/* Customer Info */}
                        <div>
                            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Billed To</label>
                            <div className="text-lg font-bold text-slate-900">{invoice.customer?.name}</div>
                            {invoice.customer?.company_name && (
                                <div className="text-sm font-medium text-slate-700">{invoice.customer.company_name}</div>
                            )}
                            <div className="text-xs text-slate-500 mt-1">{invoice.customer?.phone}</div>
                            {invoice.customer?.address && (
                                <div className="text-xs text-slate-500 mt-1 max-w-[200px]">{invoice.customer.address}</div>
                            )}
                        </div>

                        {/* Vehicle Info */}
                        <div>
                            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Vehicle Details</label>
                            <div className="text-lg font-bold text-slate-900">{invoice.work_order?.vehicle?.vehicle_number}</div>
                            <div className="text-sm font-medium text-slate-700">{invoice.work_order?.vehicle?.model}</div>
                            <div className="text-xs text-slate-500 mt-1 flex gap-4">
                                <span>KM: {invoice.work_order?.vehicle?.kilometers_driven || 'N/A'}</span>
                                {invoice.work_order?.vehicle?.next_service_km && (
                                    <span>Next Svc: {invoice.work_order.vehicle.next_service_km} km</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Line Items */}
                <div className="mb-8">
                    {/* Services */}
                    {serviceItems.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-4 border-b border-slate-200 pb-2">Service Charges</h3>
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] uppercase text-slate-500 font-bold border-b border-slate-100">
                                    <tr>
                                        <th className="py-2 w-10">#</th>
                                        <th className="py-2">Description</th>
                                        <th className="py-2 w-20">HSN/SAC</th>
                                        <th className="py-2 text-right">Price</th>
                                        <th className="py-2 w-16 text-center">GST %</th>
                                        <th className="py-2 text-right">Tax Amt</th>
                                        <th className="py-2 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 border-b border-slate-100">
                                    {serviceItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="py-2 text-slate-400">{idx + 1}</td>
                                            <td className="py-2 font-medium text-slate-900">{item.description}</td>
                                            <td className="py-2 text-slate-500 font-mono text-xs">{item.hsn_code || '-'}</td>
                                            <td className="py-2 text-right text-slate-600 font-mono">{formatCurrency(item.taxable_value || item.unit_price)}</td>
                                            <td className="py-2 text-center text-slate-500 text-xs">{item.gst_rate || 18}%</td>
                                            <td className="py-2 text-right text-slate-500 text-xs font-mono">{formatCurrency((item.cgst_amount || 0) + (item.sgst_amount || 0))}</td>
                                            <td className="py-2 text-right font-bold text-slate-900 font-mono">{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Parts */}
                    {partItems.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-4 border-b border-slate-200 pb-2">Parts & Inventory</h3>
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] uppercase text-slate-500 font-bold border-b border-slate-100">
                                    <tr>
                                        <th className="py-2 w-10">#</th>
                                        <th className="py-2">Description</th>
                                        <th className="py-2 w-20">HSN</th>
                                        <th className="py-2 w-16 text-center">Qty</th>
                                        <th className="py-2 text-right">Unit Price</th>
                                        <th className="py-2 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 border-b border-slate-100">
                                    {partItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="py-2 text-slate-400">{idx + 1}</td>
                                            <td className="py-2 font-medium text-slate-900">{item.description}</td>
                                            <td className="py-2 text-slate-500 font-mono text-xs">{item.hsn_code || '-'}</td>
                                            <td className="py-2 text-center text-slate-600">{item.quantity}</td>
                                            <td className="py-2 text-right text-slate-600 font-mono">{formatCurrency(item.unit_price)}</td>
                                            <td className="py-2 text-right font-bold text-slate-900 font-mono">{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Summary & Final Settlement */}
                <div className="mb-8">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-4 border-b border-slate-200 pb-2">Summary & Final Settlement</h3>

                    <div className="flex justify-between items-start">
                        <div className="w-1/2 pr-8">
                            {/* Tax Summary Table */}
                            {!isQuotation && (
                                <div className="mb-6">
                                    <h4 className="text-[10px] uppercase font-bold text-slate-500 mb-2">Tax Summary</h4>
                                    <table className="w-full text-xs text-left border border-slate-100">
                                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                                            <tr>
                                                <th className="py-1.5 px-2">Tax Component</th>
                                                <th className="py-1.5 px-2 text-right">Amount (₹)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            <tr>
                                                <td className="py-1.5 px-2 text-slate-700">Total Taxable Value</td>
                                                <td className="py-1.5 px-2 text-right font-mono">{formatCurrency(totalTaxable)}</td>
                                            </tr>
                                            <tr>
                                                <td className="py-1.5 px-2 text-slate-700">Total CGST (9%)</td>
                                                <td className="py-1.5 px-2 text-right font-mono">{formatCurrency(totalCGST)}</td>
                                            </tr>
                                            <tr>
                                                <td className="py-1.5 px-2 text-slate-700">Total SGST (9%)</td>
                                                <td className="py-1.5 px-2 text-right font-mono">{formatCurrency(totalSGST)}</td>
                                            </tr>
                                            <tr className="bg-slate-50 font-medium">
                                                <td className="py-1.5 px-2 text-slate-900">Total GST (18%)</td>
                                                <td className="py-1.5 px-2 text-right font-mono text-slate-900">{formatCurrency(totalGST)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Amount In Words */}
                            <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded border border-slate-100">
                                <span className="font-bold text-slate-500 text-xs uppercase block mb-1">Amount in Words</span>
                                <span className="capitalize">{toWords.convert(invoice.total || 0)}</span>
                            </div>
                        </div>

                        <div className="w-1/3">
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Service Charges:</span>
                                    <span className="font-medium font-mono">{formatCurrency(serviceTotal)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Parts & Materials:</span>
                                    <span className="font-medium font-mono">{formatCurrency(partsTotal)}</span>
                                </div>
                                <div className="border-t border-slate-200 my-2"></div>

                                {/* Net Payable Box */}
                                <div className="bg-slate-900 text-white p-4 rounded-lg shadow-lg">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">Net Payable</span>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-2xl font-bold tracking-tight">₹{Math.round(invoice.total || 0).toLocaleString('en-IN')}</span>
                                        <span className="text-xs text-slate-400 font-mono">(Rounded)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Additional Info Grid: Terms, Notes, Bank Details */}
                <div className="grid grid-cols-2 gap-8 mb-8 pt-6 border-t border-slate-100">
                    <div className="space-y-6">
                        {/* Terms */}
                        {settings?.terms_and_conditions && (
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Terms & Conditions</p>
                                <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{settings.terms_and_conditions}</p>
                            </div>
                        )}

                        {/* Notes */}
                        {invoice.notes && (
                            <div className="mt-4">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Notes</p>
                                <p className="text-xs text-slate-600 whitespace-pre-wrap">{invoice.notes}</p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        {/* Bank Details */}
                        {companyProfile?.bank_name && !isQuotation && (
                            <div className="p-4 bg-slate-50 rounded border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Banking Details</p>
                                <div className="space-y-1.5 text-xs text-slate-700">
                                    <div className="flex justify-between"><span className="text-slate-500">Bank:</span> <span className="font-semibold">{companyProfile.bank_name}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Account Name:</span> <span className="font-semibold">{companyProfile.acc_name}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Account No:</span> <span className="font-mono font-semibold">{companyProfile.acc_number}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">IFSC Code:</span> <span className="font-mono font-semibold">{companyProfile.ifsc}</span></div>
                                    {companyProfile.upi_id && (
                                        <div className="flex justify-between pt-2 mt-2 border-t border-slate-200">
                                            <span className="text-slate-500">UPI ID:</span>
                                            <span className="font-mono font-semibold">{companyProfile.upi_id}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="grid grid-cols-2 gap-12 mt-4 pt-8 border-t border-slate-200">
                    <div>
                        <div className="h-16 mb-2"></div>
                        <div className="border-t border-slate-400 pt-2 text-xs font-bold uppercase text-slate-500">Customer Signature</div>
                    </div>
                    <div>
                        <div className="h-16 mb-2"></div>
                        <div className="border-t border-slate-400 pt-2 text-xs font-bold uppercase text-slate-500">Authorized Signatory</div>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                        Generated via Amma Auto Admin Portal • {format(new Date(), "PP pp")}
                    </p>
                </div>

            </div >
        );
    }
);

InvoiceTemplate.displayName = "InvoiceTemplate";
