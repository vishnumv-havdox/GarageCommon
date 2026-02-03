import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { ToWords } from 'to-words';

// Constants for consistent styling
const COLORS = {
    primary: [39, 60, 117],      // Deep blue for invoice
    secondary: [41, 128, 185],   // Lighter blue for work slip
    accent: [26, 188, 156],      // Teal for highlights
    lightBg: [248, 249, 250],    // Light background
    darkText: [33, 37, 41],      // Dark text
    lightText: [108, 117, 125],  // Light text
    white: [255, 255, 255],      // White
    success: [40, 167, 69],      // Green for totals
    border: [222, 226, 230]      // Border color
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
            symbol: '₹',
            fractionalUnit: {
                name: 'Paisa',
                plural: 'Paise',
                symbol: '',
            }
        }
    }
});

// Interfaces for better type safety
interface CompanyProfile {
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
        // Set header color based on document type
        const headerColor = type === 'invoice' ? COLORS.primary : COLORS.secondary;
        this.doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);

        // Draw header background
        const headerHeight = this.isNewPage ? 30 : 40;
        this.doc.rect(0, 0, this.pageWidth, headerHeight, 'F');

        // Add logo if available and not continuation page
        let nameX = 15;
        if (this.logoBase64 && !this.isNewPage) {
            try {
                this.doc.addImage(this.logoBase64, 'PNG', 15, 8, 15, 15);
                nameX = 35;
            } catch (error) {
                console.error('Failed to add logo:', error);
            }
        }

        // Company name
        this.setStyle(this.isNewPage ? 16 : 20, true, COLORS.white);
        this.doc.text(company.company_name.toUpperCase(), nameX, this.isNewPage ? 12 : 18);

        // Document title
        this.setStyle(this.isNewPage ? 18 : 24, true, COLORS.white);
        const title = isQuotation ? 'QUOTATION' : settings.title;
        this.doc.text(title, this.pageWidth - 15, this.isNewPage ? 20 : 28, { align: 'right' });

        if (!this.isNewPage) {
            // Company details
            this.setStyle(9, false, [240, 240, 240]);
            this.doc.text(company.address || '', 15, 28);
            this.doc.text(`Phone: ${company.phone || ''} • Email: ${company.email || ''}`, 15, 33);

            // Document info background
            this.doc.setFillColor(COLORS.lightBg[0], COLORS.lightBg[1], COLORS.lightBg[2]);
            this.doc.rect(0, 40, this.pageWidth, 25, 'F');

            // Bill number and dates
            this.setStyle(10, true, COLORS.darkText);
            this.doc.text(billNumberDisplay, 15, 52);

            this.setStyle(9, false, COLORS.darkText);
            this.doc.text(`Date: ${new Date().toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            })}`, 15, 58);

            if (workOrder.estimated_delivery_date) {
                this.setStyle(9, true, COLORS.darkText);
                this.doc.text("Est. Delivery:", this.pageWidth / 2, 52, { align: 'center' });
                this.setStyle(9, false, COLORS.darkText);
                this.doc.text(
                    new Date(workOrder.estimated_delivery_date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    this.pageWidth / 2,
                    58,
                    { align: 'center' }
                );
            }
        } else {
            // Continuation header
            this.setStyle(10, true, COLORS.darkText);
            this.doc.text(`${billNumberDisplay} (Continued)`, 15, 40);
        }
    }

    drawCustomerVehicleInfo(workOrder: WorkOrder) {
        const boxWidth = (this.pageWidth / 2) - 20;
        const boxHeight = 40;

        // Customer box
        this.drawRoundedRect(15, this.currentY, boxWidth, boxHeight, 4, true);
        this.setStyle(10, true, COLORS.secondary);
        this.doc.text("CUSTOMER INFORMATION", 20, this.currentY + 10);

        this.setStyle(10, true, COLORS.darkText);
        this.doc.text(workOrder.vehicle?.customers?.name || 'N/A', 20, this.currentY + 18);

        this.setStyle(9, false, COLORS.lightText);
        this.doc.text(`📞 ${workOrder.vehicle?.customers?.phone || ''}`, 20, this.currentY + 24);

        if (workOrder.vehicle?.customers?.address) {
            const addressLines = this.doc.splitTextToSize(
                workOrder.vehicle.customers.address,
                boxWidth - 10
            );
            this.doc.text(addressLines, 20, this.currentY + 30);
        }

        // Vehicle box
        this.drawRoundedRect((this.pageWidth / 2) + 5, this.currentY, boxWidth, boxHeight, 4, true);
        this.setStyle(10, true, COLORS.secondary);
        this.doc.text("VEHICLE DETAILS", (this.pageWidth / 2) + 10, this.currentY + 10);

        this.setStyle(12, true, COLORS.darkText);
        this.doc.text(workOrder.vehicle?.vehicle_number || 'N/A', (this.pageWidth / 2) + 10, this.currentY + 18);

        this.setStyle(9, false, COLORS.lightText);
        this.doc.text(`🚗 ${workOrder.vehicle?.model || ''}`, (this.pageWidth / 2) + 10, this.currentY + 24);

        this.currentY += boxHeight + 15;
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
                `₹${(item.taxable_value || 0).toFixed(2)}`,
                `${item.gst_rate || 18}%`,
                `₹${(item.cgst_amount || 0).toFixed(2)}`,
                `₹${(item.sgst_amount || 0).toFixed(2)}`,
                `₹${(item.total || 0).toFixed(2)}`
            ]),
            startY: this.currentY,
            theme: 'grid',
            headStyles: {
                fillColor: [COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]],
                textColor: COLORS.white,
                fontStyle: 'bold',
                fontSize: 9
            },
            bodyStyles: {
                fontSize: 8,
                textColor: COLORS.darkText,
                cellPadding: 4
            },
            alternateRowStyles: {
                fillColor: [250, 250, 250]
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
        this.doc.text(`₹${totals.total.toFixed(2)}`, this.pageWidth - 15, this.currentY + 5, { align: 'right' });

        this.setStyle(8, false, COLORS.lightText);
        this.doc.text(
            `Taxable: ₹${totals.taxable.toFixed(2)} | GST: ₹${(totals.cgst + totals.sgst).toFixed(2)}`,
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
        this.doc.text(`₹${serviceTotals.total.toFixed(2)}`, this.pageWidth - 15, this.currentY, { align: 'right' });
        this.currentY += 8;

        this.doc.text("Parts & Materials:", 15, this.currentY);
        this.doc.text(`₹${partTotals.total.toFixed(2)}`, this.pageWidth - 15, this.currentY, { align: 'right' });
        this.currentY += 12;

        // Divider
        this.doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
        this.doc.line(15, this.currentY, this.pageWidth - 15, this.currentY);
        this.currentY += 12;

        // Grand total box
        this.doc.setFillColor(COLORS.lightBg[0], COLORS.lightBg[1], COLORS.lightBg[2]);
        this.doc.rect(15, this.currentY, this.pageWidth - 30, 25, 'F');
        this.doc.setDrawColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
        this.doc.setLineWidth(1);
        this.doc.rect(15, this.currentY, this.pageWidth - 30, 25);

        this.setStyle(14, true, COLORS.primary);
        this.doc.text("GRAND TOTAL:", 25, this.currentY + 10);

        this.setStyle(18, true, COLORS.success);
        this.doc.text(`₹${finalTotal.toFixed(2)}`, this.pageWidth - 25, this.currentY + 12, { align: 'right' });

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
            head: [['Tax Component', 'Amount (₹)']],
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

        // Footer bar
        const footerColor = type === 'invoice' ? COLORS.primary : COLORS.secondary;
        this.doc.setFillColor(footerColor[0], footerColor[1], footerColor[2]);
        this.doc.rect(0, this.pageHeight - 10, this.pageWidth, 10, 'F');

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
            supabase.from('work_order_tasks').select('*').eq('work_order_id', workOrderId)
        ]);

        if (!workOrder) {
            throw new Error("Work Order not found");
        }

        // Initialize PDF generator
        const pdfGen = new PDFGenerator();
        await pdfGen.loadLogo(profile?.logo_url);

        // Process data
        const tasks = tasksData || [];
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
        if (type === 'invoice' && invoiceData) {
            isQuotation = invoiceData.type === 'quotation';
            const { data: invItems } = await supabase
                .from('invoice_items')
                .select('*')
                .eq('invoice_id', invoiceData.id);

            finalItems = (invItems || []) as LineItem[];
            finalTotal = invoiceData.total || 0;

            if (isQuotation && invoiceData.quotation_number) {
                billNumberDisplay = `QTN-${invoiceData.quotation_number}`;
            } else if (invoiceData.bill_number) {
                billNumberDisplay = `BILL-${invoiceData.bill_number}`;
            }
        } else {
            // For work slip or new invoice
            if (tasks.length > 0) {
                finalItems = tasks.map(t => ({
                    description: t.task_name,
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