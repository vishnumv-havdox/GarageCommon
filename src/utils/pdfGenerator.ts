import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { ToWords } from 'to-words';
import { format } from "date-fns";

// Constants for consistent styling
const COLORS: Record<string, [number, number, number]> = {
    primary: [15, 23, 42],       // Slate-900 (Deep/Dark)
    secondary: [100, 116, 139],  // Slate-500 (Secondary text)
    accent: [148, 163, 184],     // Slate-400
    lightBg: [248, 250, 252],    // Slate-50
    darkText: [15, 23, 42],      // Slate-900
    lightText: [100, 116, 139],  // Slate-500
    white: [255, 255, 255],
    success: [15, 23, 42],       // Slate-900 (Totals)
    border: [226, 232, 240]      // Slate-200
};

const FONTS = {
    primary: 'helvetica',
    bold: 'helvetica',
    normal: 'helvetica'
} as const;

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
            symbol: 'Rs. ',
            fractionalUnit: {
                name: 'Paisa',
                plural: 'Paise',
                symbol: '',
            }
        }
    }
});

// Interfaces for better type safety
export interface CompanyProfile {
    company_name: string;
    address: string;
    phone: string;
    email: string;
    logo_url?: string;
    gst_number?: string;
    acc_name?: string;
    acc_number?: string;
    bank_name?: string;
    ifsc?: string;
    upi_id?: string;
    owner_name?: string;
    owner_phone?: string;
}

interface DocumentSettings {
    title: string;
    prefix: string;
    show_rates: boolean;
    show_taxes: boolean;
    terms_and_conditions?: string;
    footer_text?: string;
}

interface VehicleData {
    vehicle_number: string;
    model: string;
    kilometers_driven?: number;
    customers?: {
        name: string;
        phone: string;
        address: string;
        gst_number?: string;
    };
}

interface WorkOrder {
    id: string;
    estimated_delivery_date?: string;
    vehicle: VehicleData;
}

interface InvoiceData {
    id: string;
    type: 'invoice' | 'quotation';
    quotation_number?: string;
    bill_number?: string;
    subtotal: number;
    tax: number;
    total: number;
}

interface LineItem {
    description: string;
    taxable_value: number;
    total: number;
    type: 'service' | 'part';
    hsn_code: string;
    gst_rate?: number;
    cgst_amount?: number;
    sgst_amount?: number;
}

interface SectionTotals {
    taxable: number;
    cgst: number;
    sgst: number;
    total: number;
}

export const generateWorkSlipPDF = async (workOrderId: string, action: 'save' | 'preview' = 'preview') => {
    return generateDocument(workOrderId, 'work_slip', action);
};

export const generateInvoicePDF = async (workOrderId: string, action: 'save' | 'preview' = 'preview') => {
    return generateDocument(workOrderId, 'invoice', action);
};

class PDFGenerator {
    private doc: jsPDF;
    private pageWidth: number;
    private pageHeight: number;
    private currentY: number = 0;
    private isNewPage: boolean = false;
    private logoBase64: string = '';

    constructor() {
        this.doc = new jsPDF();
        this.pageWidth = this.doc.internal.pageSize.width;
        this.pageHeight = this.doc.internal.pageSize.height;
    }

    private setStyle(fontSize: number, isBold: boolean = false, color: number[] = COLORS.darkText) {
        this.doc.setFont(FONTS.primary, isBold ? 'bold' : 'normal');
        this.doc.setFontSize(fontSize);
        this.doc.setTextColor(color[0], color[1], color[2]);
    }

    private drawRoundedRect(x: number, y: number, w: number, h: number, r: number = 3, fill: boolean = false) {
        this.doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
        if (fill) {
            this.doc.setFillColor(COLORS.lightBg[0], COLORS.lightBg[1], COLORS.lightBg[2]);
        }
        this.doc.roundedRect(x, y, w, h, r, r, fill ? 'FD' : 'S');
    }

    async loadLogo(logoUrl?: string): Promise<void> {
        if (!logoUrl) return;

        try {
            this.logoBase64 = await fetch(logoUrl)
                .then(r => r.blob())
                .then(blob => new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                }));
        } catch (error) {
            console.warn('Failed to load logo:', error);
        }
    }

    drawHeader(
        company: CompanyProfile,
        settings: DocumentSettings,
        workOrder: WorkOrder,
        isQuotation: boolean,
        billNumberDisplay: string,
        type: 'work_slip' | 'invoice'
    ) {
        // Remove filled background
        // Draw header background (Now just white/transparent)
        // this.doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
        // this.doc.rect(0, 0, this.pageWidth, headerHeight, 'F');

        const headerY = this.isNewPage ? 10 : 20;

        // Add logo if available and not continuation page
        let nameX = 15;
        if (this.logoBase64 && !this.isNewPage) {
            try {
                this.doc.addImage(this.logoBase64, 'PNG', 15, headerY - 5, 15, 15);
                nameX = 35;
            } catch (error) {
                console.error('Failed to add logo:', error);
            }
        }

        // Company name (Left)
        this.setStyle(this.isNewPage ? 16 : 22, true, COLORS.primary);
        this.doc.text(company.company_name.toUpperCase(), nameX, headerY + 5);

        // Document title (Left, below name, smaller)
        this.setStyle(10, false, COLORS.secondary);
        this.doc.text(isQuotation ? 'Quotation / Estimate' : 'Tax Invoice', nameX, headerY + 11);

        // Company details (Left)
        if (!this.isNewPage) {
            this.setStyle(9, false, COLORS.accent);
            let detailY = headerY + 17;
            if (company.address) {
                this.doc.text(company.address, nameX, detailY);
                detailY += 5;
            }

            const mainPhone = company.phone || '';
            const ownerPhone = (company as any).owner_phone;
            const ownerName = (company as any).owner_name;

            let contactLine = `Ph: ${mainPhone}`;
            if (ownerPhone) contactLine += ` | Owner: ${ownerPhone}`;
            if (company.email) contactLine += ` • Email: ${company.email}`;

            this.doc.text(contactLine, nameX, detailY);

            if (ownerName) {
                detailY += 5;
                this.doc.text(`Owner: ${ownerName}`, nameX, detailY);
            }
        }

        // Right Side Info (Invoice No, Date)
        const rightX = this.pageWidth - 15;
        let rightY = headerY + 5;

        // Number Label
        this.setStyle(8, true, COLORS.secondary);
        this.doc.text(isQuotation ? 'QUOTATION NO' : 'INVOICE NO', rightX, rightY, { align: 'right' });

        // Number Value
        this.setStyle(14, true, COLORS.primary);
        this.doc.text(billNumberDisplay, rightX, rightY + 6, { align: 'right' });

        rightY += 15;

        // Date Label
        this.setStyle(8, true, COLORS.secondary);
        this.doc.text('DATE', rightX, rightY, { align: 'right' });

        // Date Value
        this.setStyle(10, true, COLORS.primary);
        this.doc.text(format(new Date(), "d MMM yyyy"), rightX, rightY + 5, { align: 'right' });

        // Bottom Border for Header
        const lineY = headerY + 35;
        this.doc.setDrawColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
        this.doc.setLineWidth(0.5);
        this.doc.line(15, lineY, this.pageWidth - 15, lineY);

        if (this.isNewPage) {
            this.currentY = lineY + 10;
        } else {
            this.currentY = lineY + 10;
        }
    }

    drawCustomerVehicleInfo(workOrder: WorkOrder) {
        const boxWidth = (this.pageWidth / 2) - 20;
        const boxHeight = 40;

        // Draw Container Box (Light BG like Payslip)
        this.doc.setFillColor(COLORS.lightBg[0], COLORS.lightBg[1], COLORS.lightBg[2]);
        this.doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
        this.doc.roundedRect(15, this.currentY, this.pageWidth - 30, boxHeight + 10, 3, 3, 'FD');

        // Customer Info (Left)
        let contentY = this.currentY + 8;
        this.setStyle(9, true, COLORS.accent);
        this.doc.text("BILLED TO", 25, contentY);

        this.setStyle(12, true, COLORS.primary);
        this.doc.text(workOrder.vehicle?.customers?.name || 'N/A', 25, contentY + 6);

        this.setStyle(9, false, COLORS.secondary);
        if (workOrder.vehicle?.customers?.address) {
            const lines = this.doc.splitTextToSize(workOrder.vehicle.customers.address, boxWidth);
            this.doc.text(lines, 25, contentY + 11);
        }

        // Vehicle Info (Right)
        const vX = (this.pageWidth / 2) + 20;

        this.setStyle(9, true, COLORS.accent);
        this.doc.text("VEHICLE DETAILS", vX, contentY);

        this.setStyle(12, true, COLORS.primary);
        this.doc.text(workOrder.vehicle?.vehicle_number || 'N/A', vX, contentY + 6);

        this.setStyle(9, false, COLORS.secondary);
        this.doc.text(workOrder.vehicle?.model || '', vX, contentY + 11);
        this.doc.text(`KM: ${workOrder.vehicle?.kilometers_driven || 'N/A'}`, vX, contentY + 16);

        this.currentY += boxHeight + 20;
    }

    drawSectionHeader(title: string, sectionNumber: string = '') {
        this.setStyle(14, true, COLORS.primary);
        this.doc.text(`${sectionNumber} ${title.toUpperCase()}`, 15, this.currentY);

        // Underline
        this.doc.setDrawColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
        this.doc.setLineWidth(0.5);
        this.doc.line(15, this.currentY + 1, 50, this.currentY + 1);

        this.currentY += 8;
    }

    drawItemsTable(items: LineItem[], sectionTitle: string, sectionNumber: string = 'I') {
        this.drawSectionHeader(sectionTitle, sectionNumber);

        const startPage = this.doc.getNumberOfPages();

        autoTable(this.doc, {
            head: [['#', 'Description', 'HSN', 'Taxable Value', 'GST%', 'CGST', 'SGST', 'Total']],
            body: items.map((item, index) => [
                (index + 1).toString(),
                item.description || 'Item',
                item.hsn_code || '-',
                `Rs. ${(item.taxable_value || 0).toFixed(2)}`,
                `${item.gst_rate || 18}%`,
                `Rs. ${(item.cgst_amount || 0).toFixed(2)}`,
                `Rs. ${(item.sgst_amount || 0).toFixed(2)}`,
                `Rs. ${(item.total || 0).toFixed(2)}`
            ]),
            startY: this.currentY,
            theme: 'grid',
            headStyles: {
                fillColor: COLORS.white,
                textColor: COLORS.secondary,
                fontStyle: 'bold',
                fontSize: 8,
                lineWidth: 0,
            },
            bodyStyles: {
                fontSize: 9,
                textColor: COLORS.darkText,
                cellPadding: 4,
                lineWidth: 0
            },
            alternateRowStyles: {
                fillColor: COLORS.white
            },
            margin: { top: 45 },
            didDrawPage: (data) => {
                if (data.pageNumber > startPage) {
                    this.isNewPage = true;
                    // You might want to redraw header here if needed
                }
            },
            columnStyles: {
                0: { cellWidth: 12, halign: 'center' },
                3: { halign: 'right' },
                5: { halign: 'right' },
                6: { halign: 'right' },
                7: { halign: 'right' }
            },
            styles: {
                overflow: 'linebreak',
                cellWidth: 'wrap'
            }
        });

        this.currentY = (this.doc as any).lastAutoTable.finalY + 12;
    }

    drawSectionSummary(totals: SectionTotals, title: string) {
        const startX = this.pageWidth - 100;

        // Summary box
        this.drawRoundedRect(startX - 5, this.currentY - 5, 95, 25, 3, true);

        this.setStyle(10, true, COLORS.darkText);
        this.doc.text(`${title} Total:`, startX, this.currentY + 5);

        this.setStyle(11, true, COLORS.success);
        this.doc.text(`Rs. ${totals.total.toFixed(2)}`, this.pageWidth - 15, this.currentY + 5, { align: 'right' });

        this.setStyle(8, false, COLORS.lightText);
        this.doc.text(
            `Taxable: Rs. ${totals.taxable.toFixed(2)} | GST: Rs. ${(totals.cgst + totals.sgst).toFixed(2)}`,
            this.pageWidth - 15,
            this.currentY + 10,
            { align: 'right' }
        );

        this.currentY += 20;
    }

    drawFinalSummary(
        serviceTotals: SectionTotals,
        partTotals: SectionTotals,
        finalTotal: number,
        company: CompanyProfile,
        showTaxes: boolean,
        isQuotation: boolean
    ) {
        // Section title
        this.setStyle(16, true, COLORS.primary);
        this.doc.text("SUMMARY & FINAL SETTLEMENT", 15, this.currentY);
        this.currentY += 20;

        // Breakdown
        this.setStyle(10, false, COLORS.darkText);
        this.doc.text("Service Charges:", 15, this.currentY);
        this.doc.text(`Rs. ${serviceTotals.total.toFixed(2)}`, this.pageWidth - 15, this.currentY, { align: 'right' });
        this.currentY += 8;

        this.doc.text("Parts & Materials:", 15, this.currentY);
        this.doc.text(`Rs. ${partTotals.total.toFixed(2)}`, this.pageWidth - 15, this.currentY, { align: 'right' });
        this.currentY += 12;

        // Divider
        this.doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
        this.doc.line(15, this.currentY, this.pageWidth - 15, this.currentY);
        this.currentY += 12;

        // Grand total box
        this.doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
        this.doc.roundedRect(this.pageWidth - 85, this.currentY, 70, 20, 2, 2, 'F');

        this.setStyle(10, true, COLORS.accent); // Slate-400 equivalent
        this.doc.text("NET PAYABLE", this.pageWidth - 80, this.currentY + 8);

        this.setStyle(16, true, COLORS.white);
        this.doc.text(`Rs. ${finalTotal.toFixed(0)}`, this.pageWidth - 20, this.currentY + 14, { align: 'right' });

        this.currentY += 35;

        // Amount in words
        this.setStyle(9, true, COLORS.darkText);
        const amountInWords = toWords.convert(finalTotal);
        const wordsLines = this.doc.splitTextToSize(
            `Amount in Words: Rupees ${amountInWords}`,
            this.pageWidth - 30
        );
        this.doc.text(wordsLines, 15, this.currentY);
        this.currentY += (wordsLines.length * 5) + 15;

        if (showTaxes && !isQuotation) {
            this.drawTaxSummary(serviceTotals, partTotals);
            this.drawBankDetails(company);
        }
    }

    private drawTaxSummary(serviceTotals: SectionTotals, partTotals: SectionTotals) {
        this.setStyle(10, true, COLORS.darkText);
        this.doc.text("TAX SUMMARY", 15, this.currentY);
        this.currentY += 8;

        const totalTaxable = serviceTotals.taxable + partTotals.taxable;
        const totalCGST = serviceTotals.cgst + partTotals.cgst;
        const totalSGST = serviceTotals.sgst + partTotals.sgst;

        autoTable(this.doc, {
            head: [['Tax Component', 'Amount (Rs. )']],
            body: [
                ['Total Taxable Value', totalTaxable.toFixed(2)],
                ['Total CGST (9%)', totalCGST.toFixed(2)],
                ['Total SGST (9%)', totalSGST.toFixed(2)],
                ['Total GST (18%)', (totalCGST + totalSGST).toFixed(2)]
            ],
            startY: this.currentY,
            theme: 'grid',
            headStyles: {
                fillColor: [COLORS.lightBg[0], COLORS.lightBg[1], COLORS.lightBg[2]],
                textColor: COLORS.darkText,
                fontStyle: 'bold'
            },
            bodyStyles: {
                fontSize: 9
            },
            columnStyles: {
                0: { cellWidth: 60, fontStyle: 'bold' },
                1: { halign: 'right' }
            },
            margin: { left: this.pageWidth - 100 },
            tableWidth: 85
        });

        this.currentY = (this.doc as any).lastAutoTable.finalY + 20;
    }

    private drawBankDetails(company: CompanyProfile) {
        this.setStyle(10, true, COLORS.darkText);
        this.doc.text("BANKING DETAILS", 15, this.currentY);
        this.currentY += 8;

        this.setStyle(9, false, COLORS.darkText);
        if (company.acc_name) {
            this.doc.text(`Account Name: ${company.acc_name}`, 15, this.currentY);
            this.currentY += 6;
        }
        if (company.acc_number) {
            this.doc.text(`Account Number: ${company.acc_number}`, 15, this.currentY);
            this.currentY += 6;
        }
        if (company.bank_name) {
            this.doc.text(`Bank: ${company.bank_name}`, 15, this.currentY);
            this.currentY += 6;
        }
        if (company.ifsc) {
            this.doc.text(`IFSC: ${company.ifsc}`, 15, this.currentY);
            this.currentY += 6;
        }
        if (company.upi_id) {
            this.doc.text(`UPI ID: ${company.upi_id}`, 15, this.currentY);
            this.currentY += 6;
        }

        this.currentY += 10;
    }

    drawFooter(settings: DocumentSettings, type: 'work_slip' | 'invoice') {
        const footerY = this.pageHeight - 60;

        // Terms and Conditions
        if (settings.terms_and_conditions) {
            this.setStyle(8, true, COLORS.lightText);
            this.doc.text("Terms & Conditions:", 15, footerY - 15);

            this.setStyle(7, false, COLORS.lightText);
            const termsLines = this.doc.splitTextToSize(settings.terms_and_conditions, this.pageWidth - 30);
            this.doc.text(termsLines, 15, footerY - 10);
        }

        // Signatures
        const signatureY = footerY + 10;

        // Customer signature
        this.doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
        this.doc.line(15, signatureY, 70, signatureY);
        this.setStyle(8, false, COLORS.lightText);
        this.doc.text("Customer Signature", 15, signatureY + 5);

        // Company signature
        this.doc.line(this.pageWidth - 70, signatureY, this.pageWidth - 15, signatureY);
        this.doc.text("Authorized Signature", this.pageWidth - 15, signatureY + 5, { align: 'right' });

        // Footer bar (Simple line instead of filled rect)
        this.doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
        this.doc.line(15, this.pageHeight - 15, this.pageWidth - 15, this.pageHeight - 15);

        // Footer text
        if (settings.footer_text) {
            this.setStyle(8, false, COLORS.white);
            this.doc.text(
                settings.footer_text,
                this.pageWidth / 2,
                this.pageHeight - 4,
                { align: 'center' }
            );
        }

        // Page number
        this.setStyle(8, false, COLORS.lightText);
        this.doc.text(
            `Page ${this.doc.getNumberOfPages()} of ${this.doc.getNumberOfPages()}`,
            this.pageWidth - 15,
            this.pageHeight - 4,
            { align: 'right' }
        );
    }

    getDocument() {
        return this.doc;
    }

    setCurrentY(y: number) {
        this.currentY = y;
    }

    setIsNewPage(isNew: boolean) {
        this.isNewPage = isNew;
    }

    addPage() {
        this.doc.addPage();
        this.currentY = 45;
        this.isNewPage = true;
    }
}

const generateDocument = async (
    workOrderId: string,
    type: 'work_slip' | 'invoice',
    action: 'save' | 'preview' = 'preview'
) => {
    try {
        // Fetch all required data
        const [
            { data: profile },
            { data: settingsData },
            { data: workOrder },
            { data: services },
            { data: invoiceData },
            { data: tasksData }
        ] = await Promise.all([
            supabase.from('company_profiles').select('*').limit(1).single(),
            supabase.from('document_settings').select('*').eq('doc_type', type).single(),
            supabase.from('work_orders').select(`
        *,
        vehicle:vehicles!vehicle_id(
          vehicle_number, model, kilometers_driven, next_service_km, fc_expiry_date,
          customers(name, phone, address, gst_number)
        )
      `).eq('id', workOrderId).single(),
            supabase.from('work_order_services').select('*').eq('work_order_id', workOrderId),
            supabase.from('invoices').select('*').eq('work_order_id', workOrderId).single(),
            supabase.from('invoices').select('*').eq('work_order_id', workOrderId).single(),
            supabase.from('work_order_tasks').select('*').eq('work_order_id', workOrderId)
        ]);

        if (!workOrder) {
            throw new Error("Work Order not found");
        }

        // Initialize PDF generator
        const pdfGen = new PDFGenerator();
        if (profile?.logo_url) {
            await pdfGen.loadLogo(profile.logo_url);
        }

        // Process data
        const tasks: any[] = tasksData || [];
        const invoice: any = invoiceData; // Cast to avoid 'never' type inference on invoiceData properties

        const settings: DocumentSettings = settingsData || {
            title: type === 'invoice' ? 'TAX INVOICE' : 'WORK SLIP',
            prefix: type === 'invoice' ? 'INV-' : 'WS-',
            show_rates: true,
            show_taxes: true
        };

        const company: CompanyProfile = profile || {
            company_name: 'Service Center',
            address: '',
            phone: '',
            email: ''
        };

        let finalItems: LineItem[] = [];
        let billNumberDisplay = `${type === 'invoice' ? 'INV' : 'WS'}-${workOrder.id.slice(0, 8).toUpperCase()}`;
        let isQuotation = false;
        let finalTotal = 0;

        // Determine items and totals based on document type
        // Determine items and totals based on document type
        if (type === 'invoice' && invoice) {
            isQuotation = invoice.type === 'quotation';
            const { data: invItems } = await supabase
                .from('invoice_items')
                .select('*')
                .eq('invoice_id', invoice.id);

            finalItems = (invItems || []) as LineItem[];
            finalItems = (invItems || []) as LineItem[];
            finalTotal = invoice.total || 0;

            if (isQuotation && invoice.quotation_number) {
                billNumberDisplay = `QTN-${invoice.quotation_number}`;
            } else if (invoice.bill_number) {
                billNumberDisplay = `BILL-${invoice.bill_number}`;
            }
        } else {
            // For work slip or new invoice
            if (tasks.length > 0) {
                finalItems = tasks.map((t: any) => ({
                    description: t.task_name || 'Task',
                    taxable_value: t.price || 0,
                    total: t.price || 0,
                    type: 'service' as const,
                    hsn_code: '-',
                    gst_rate: 18,
                    cgst_amount: (t.price || 0) * 0.09,
                    sgst_amount: (t.price || 0) * 0.09
                }));
            } else {
                finalItems = (services || []).map((s: any) => ({
                    ...s,
                    type: 'service' as const
                }));
            }
            finalTotal = finalItems.reduce((sum, item) => sum + item.total, 0);
        }

        // Update title for quotations
        if (isQuotation) {
            settings.title = 'QUOTATION / ESTIMATE';
        }

        // Categorize items
        const serviceItems = finalItems.filter(item => item.type === 'service');
        const partItems = finalItems.filter(item => item.type === 'part');

        // Calculate section totals
        const calculateSectionTotals = (items: LineItem[]): SectionTotals => ({
            taxable: items.reduce((sum, item) => sum + (item.taxable_value || 0), 0),
            cgst: items.reduce((sum, item) => sum + (item.cgst_amount || 0), 0),
            sgst: items.reduce((sum, item) => sum + (item.sgst_amount || 0), 0),
            total: items.reduce((sum, item) => sum + (item.total || 0), 0)
        });

        const serviceTotals = calculateSectionTotals(serviceItems);
        const partTotals = calculateSectionTotals(partItems);

        // --- PAGE 1: SERVICE BILL ---
        pdfGen.setIsNewPage(false);
        pdfGen.setCurrentY(75);

        pdfGen.drawHeader(company, settings, workOrder, isQuotation, billNumberDisplay, type);
        pdfGen.drawCustomerVehicleInfo(workOrder);

        if (serviceItems.length > 0) {
            pdfGen.drawItemsTable(serviceItems, 'Service Bill', 'I');
            pdfGen.drawSectionSummary(serviceTotals, 'Service');
        }

        // --- PAGE 2: INVENTORY BILL ---
        if (partItems.length > 0) {
            pdfGen.addPage();
            pdfGen.drawHeader(company, settings, workOrder, isQuotation, billNumberDisplay, type);
            pdfGen.drawItemsTable(partItems, 'Inventory Bill', 'II');
            pdfGen.drawSectionSummary(partTotals, 'Parts');
        }

        // --- PAGE 3: FINAL SUMMARY ---
        pdfGen.addPage();
        pdfGen.drawHeader(company, settings, workOrder, isQuotation, billNumberDisplay, type);
        pdfGen.drawFinalSummary(
            serviceTotals,
            partTotals,
            finalTotal,
            company,
            settings.show_taxes && type === 'invoice',
            isQuotation
        );

        // Draw footer on all pages
        const totalPages = pdfGen.getDocument().getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            pdfGen.getDocument().setPage(i);
            pdfGen.setIsNewPage(i > 1);
            pdfGen.setCurrentY(pdfGen.getDocument().internal.pageSize.height - 60);
            pdfGen.drawFooter(settings, type);
        }

        // Output the document
        const doc = pdfGen.getDocument();
        const fileName = `${settings.title.replace(/\s+/g, '_')}_${billNumberDisplay}.pdf`;

        if (action === 'preview') {
            window.open(doc.output('bloburl'), '_blank');
        } else {
            doc.save(fileName);
        }

        return { success: true, fileName };

    } catch (error) {
        console.error("PDF Generation failed:", error);
        throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

export const generateLedgerPDF = async (
    customer: any,
    transactions: any[],
    companyProfile: CompanyProfile,
    dateRange: { from?: Date; to?: Date }
) => {
    try {
        const pdfGen = new PDFGenerator();
        if (companyProfile?.logo_url) {
            await pdfGen.loadLogo(companyProfile.logo_url);
        }

        const doc = pdfGen.getDocument();
        const pageWidth = doc.internal.pageSize.width;

        // Helper to draw footer
        const drawFooter = (pageNo: number, totalPages: number) => {
            const footerY = doc.internal.pageSize.height - 10;
            doc.setFontSize(8);
            doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
            doc.text(`${companyProfile.company_name} | Generated by Amma Auto Service`, 15, footerY);
            doc.text(`Page ${pageNo} of ${totalPages}`, pageWidth - 15, footerY, { align: 'right' });
        };

        // Custom Header for Ledger
        pdfGen.setCurrentY(15);

        // Logo
        if ((pdfGen as any).logoBase64) {
            try {
                doc.addImage((pdfGen as any).logoBase64, 'PNG', 15, 10, 20, 20);
            } catch (e) {
                console.warn("Logo add failed", e);
            }
        }

        // Company Details
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
        doc.text(companyProfile.company_name.toUpperCase(), 40, 18);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
        doc.text(`Ph: ${companyProfile.phone || ''} ${companyProfile.owner_phone ? `| Owner: ${companyProfile.owner_phone}` : ''}`, 40, 24);
        if (companyProfile.owner_name) {
            doc.text(`Owner: ${companyProfile.owner_name}`, 40, 29);
        }

        // Right Side: Report Title
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
        doc.text("Billing Detail", pageWidth - 15, 20, { align: 'right' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
        doc.text("All work orders and invoices associated with this customer.", pageWidth - 15, 25, { align: 'right' });

        const dateStr = dateRange.from && dateRange.to
            ? `${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`
            : `As on ${format(new Date(), 'dd MMM yyyy')}`;
        doc.text(dateStr, pageWidth - 15, 30, { align: 'right' });

        // Divider
        doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
        doc.line(15, 35, pageWidth - 15, 35);

        // Customer Details Section
        pdfGen.setCurrentY(45);
        doc.setFillColor(COLORS.lightBg[0], COLORS.lightBg[1], COLORS.lightBg[2]);
        doc.roundedRect(15, 40, pageWidth - 30, 25, 3, 3, 'F');

        doc.setFontSize(10);
        doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
        doc.text("CUSTOMER DETAILS", 20, 48);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
        doc.text(customer.name.toUpperCase(), 20, 55);
        if (customer.company_name) {
            doc.setFontSize(9);
            doc.text(customer.company_name, 20, 60);
        }

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(COLORS.darkText[0], COLORS.darkText[1], COLORS.darkText[2]);
        doc.text(`Phone: ${customer.phone || 'N/A'}`, pageWidth - 20, 55, { align: 'right' });

        // Summary Metrics in Box
        const summaryX = pageWidth / 2 - 20;
        doc.text(`Total Invoiced: Rs. ${transactions.reduce((acc, t) => acc + (t.total || 0), 0).toLocaleString()}`, summaryX, 55);
        doc.text(`Total Paid: Rs. ${transactions.reduce((acc, t) => acc + (t.paid_amount || 0), 0).toLocaleString()}`, summaryX, 61);

        // Table
        const tableBody = transactions.map(t => {
            const woId = t.work_order?.id ? t.work_order.id.slice(0, 8) : '-';
            const serviceVehicle = `${t.work_order?.service_type || '-'}\n${t.work_order?.vehicle?.vehicle_number || '-'}`;

            return [
                format(new Date(t.created_at), 'dd MMM yyyy'),
                t.bill_number ? `${t.type === 'quotation' ? 'QTN' : 'INV'}-${t.bill_number}` : 'Draft',
                woId,
                serviceVehicle,
                `Rs. ${t.total.toLocaleString()}`,
                `Rs. ${t.paid_amount.toLocaleString()}`,
                `Rs. ${t.total_deductions?.toLocaleString() || '0'}`,
                `Rs. ${t.balance?.toLocaleString() || '0'}`,
                t.status || '-',
                '-' // Action
            ];
        });

        autoTable(doc, {
            startY: 70,
            head: [['Date', 'Bill #', 'Work Order ID', 'Service / Vehicle', 'Total', 'Paid', 'Deducted', 'Balance', 'Status', 'Action']],
            body: tableBody,
            theme: 'grid',
            headStyles: {
                fillColor: COLORS.primary,
                textColor: COLORS.white,
                fontStyle: 'bold',
                fontSize: 7,
                halign: 'center'
            },
            bodyStyles: {
                fontSize: 7,
                textColor: COLORS.darkText,
                cellPadding: 2
            },
            columnStyles: {
                4: { halign: 'right' },
                5: { halign: 'right' },
                6: { halign: 'right' },
                7: { halign: 'right', fontStyle: 'bold' }
            },
            alternateRowStyles: {
                fillColor: COLORS.lightBg
            }
        });

        // Footer
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            drawFooter(i, totalPages);
        }

        doc.save(`${customer.name.replace(/\s+/g, '_')}_Ledger_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        return true;

    } catch (error) {
        console.error("Ledger Generation Failed:", error);
        throw error;
    }
};
/**
 * Generates a professional summary report for the Ledger Overview page
 */
export const generateLedgerSummaryPDF = async (
    data: any[],
    companyProfile: CompanyProfile,
    filters: {
        dateRange?: { from?: Date; to?: Date };
        status?: string;
        companyType?: string;
    },
    transactions?: any[]
) => {
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Helper to draw footer
        const drawFooter = (page: number, total: number) => {
            const footerY = doc.internal.pageSize.height - 10;
            doc.setFontSize(8);
            doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
            doc.text(`${companyProfile.company_name} | Ledger Summary Report`, 15, footerY);
            doc.text(`Page ${page} of ${total}`, pageWidth - 15, footerY, { align: 'right' });
        };

        // Header Section
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
        doc.text(companyProfile.company_name.toUpperCase(), 15, 20);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
        let detailY = 26;
        if (companyProfile.address) {
            doc.text(companyProfile.address, 15, detailY);
            detailY += 5;
        }
        doc.text(`Ph: ${companyProfile.phone || ''} ${companyProfile.owner_phone ? `| Owner: ${companyProfile.owner_phone}` : ''}`, 15, detailY);

        // Right Side: Report Title
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
        doc.text("LEDGER TRANSACTIONS", pageWidth - 15, 20, { align: 'right' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
        const dateStr = filters.dateRange?.from && filters.dateRange?.to
            ? `${format(filters.dateRange.from, 'dd MMM yyyy')} - ${format(filters.dateRange.to, 'dd MMM yyyy')}`
            : `As on ${format(new Date(), 'dd MMM yyyy')}`;
        doc.text(dateStr, pageWidth - 15, 26, { align: 'right' });

        const filterStr = `Status: ${filters.status || 'All'} | Company: ${filters.companyType || 'All'}`;
        doc.text(filterStr, pageWidth - 15, 31, { align: 'right' });

        // Divider
        doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
        doc.line(15, 40, pageWidth - 15, 40);

        // Transactions Table
        if (transactions && transactions.length > 0) {
            const lastY = 50;

            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
            doc.text("TRANSACTION HISTORY", 15, lastY);

            const transStartedY = lastY + 5;

            const transBody = transactions.map(t => [
                t.date ? format(new Date(t.date), "dd MMM yy") : "-",
                t.customer || "-",
                t.vehicle || "-",
                t.ref || "-",
                t.amount ? `Rs. ${t.amount.toLocaleString()}` : "-",
                t.paid ? `Rs. ${t.paid.toLocaleString()}` : "-",
                t.deductions ? `Rs. ${t.deductions.toLocaleString()}` : "-",
                t.balance !== undefined ? `Rs. ${t.balance.toLocaleString()}` : "-",
                t.paymentMode || "-",
                t.status || "-"
            ]);

            autoTable(doc, {
                startY: transStartedY,
                head: [["Date", "Customer", "Vehicle", "Ref #", "Billed", "Paid", "Deductions", "Balance", "Mode", "Status"]],
                body: transBody,
                theme: "grid",
                headStyles: {
                    fillColor: COLORS.primary,
                    textColor: COLORS.white,
                    fontStyle: "bold",
                    fontSize: 7,
                    halign: "center"
                },
                bodyStyles: {
                    fontSize: 6.5,
                    textColor: COLORS.darkText,
                    cellPadding: 2
                },
                columnStyles: {
                    4: { halign: "right" },
                    5: { halign: "right" },
                    6: { halign: "right" },
                    7: { halign: "right", fontStyle: "bold" }
                },
                alternateRowStyles: {
                    fillColor: COLORS.lightBg
                }
            });
        }

        // Footer
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            drawFooter(i, totalPages);
        }

        doc.save(`Ledger_Summary_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        return true;
    } catch (error) {
        console.error("Ledger Summary Generation Failed:", error);
        throw error;
    }
};
