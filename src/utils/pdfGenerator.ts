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
        company_name?: string;
    };
}

interface DriverData {
    name: string;
    contact_number?: string;
}

interface EmployeeAssignment {
    id: string;
    service_id: string;
    employee: {
        name: string;
        position?: { name: string };
    };
    status: string;
}

interface WorkOrder {
    id: string;
    estimated_delivery_date?: string;
    vehicle: VehicleData;
    driver?: DriverData;
    service_type?: string;
    description: string;
    estimated_cost?: number;
    advisor?: {
        name: string;
        phone?: string;
    } | Array<{
        name: string;
        phone?: string;
    }>;
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
    id?: string;
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

export const generateWorkSlipPDF = async (workOrderId: string, copyType: 'customer' | 'workshop' = 'customer', action: 'save' | 'preview' = 'preview') => {
    return generateDocument(workOrderId, 'work_slip', action, copyType);
};

export const generateInvoicePDF = async (workOrderId: string, action: 'save' | 'preview' = 'preview', themeColor?: string) => {
    return generateDocument(workOrderId, 'invoice', action, 'customer', themeColor);
};

export const parseNotes = (notes: any): string => {
    if (!notes) return 'N/A';
    if (typeof notes === 'string') {
        try {
            // Check if it's JSON
            if (notes.startsWith('{') || notes.startsWith('[')) {
                const parsed = JSON.parse(notes);
                return parseNotes(parsed);
            }
            return notes;
        } catch (e) {
            return notes;
        }
    }
    if (typeof notes === 'object') {
        // Handle the specific structure reported by user
        let parts = [];
        if (notes.service_types) parts.push(`Services: ${notes.service_types.join(', ')}`);
        if (notes.reopened_at) parts.push(`Reopened: ${format(new Date(notes.reopened_at), 'PPp')}`);
        if (notes.original_reopen_reason) parts.push(`Reopen Reason: ${notes.original_reopen_reason}`);
        if (notes.total_sections) parts.push(`Sections: ${notes.total_sections}`);

        if (parts.length > 0) return parts.join(' | ');
        return JSON.stringify(notes);
    }
    return String(notes);
};

export const generateVehicleHistoryPDF = async (vehicleId: string, action: 'save' | 'preview' = 'preview') => {
    try {
        const [profileRes, vehicleRes, historyRes] = await Promise.all([
            supabase.from('company_profiles').select('*').limit(1).single(),
            supabase.from('vehicles').select(`
                *,
                customers(*)
            `).eq('id', vehicleId).single(),
            supabase.from('work_orders').select(`
                *,
                advisor:employees!assigned_to(name, phone),
                driver:drivers(name, contact_number),
                services:work_order_services(
                    id,
                    service_type,
                    tasks:work_order_tasks(id, task_name, price, completed)
                ),
                invoices(
                    id,
                    total,
                    total_deductions,
                    payment_links(amount_applied, payment:payments(id, amount, status))
                )
            `).eq('vehicle_id', vehicleId).order('created_at', { ascending: false })
        ]);

        const profile = profileRes.data;
        const vehicle = vehicleRes.data;
        const history = historyRes.data || [];

        if (!vehicle) throw new Error("Vehicle not found");

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        let currentY = 15;

        // Load and Add Logo if exists
        if ((profile as any)?.logo_url) {
            try {
                const logoBase64 = await fetch((profile as any).logo_url)
                    .then(r => r.blob())
                    .then(blob => new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    }));
                doc.addImage(logoBase64 as string, 'PNG', 15, currentY, 12, 12);
            } catch (e) {
                console.warn("Logo load failed for PDF", e);
            }
        }

        // Header - Company Name
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text((profile as any)?.company_name?.toUpperCase() || "SERVICE CENTER", (profile as any)?.logo_url ? 30 : 15, currentY + 5);

        // Company Details (Address, Phone)
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        let companyDetailY = currentY + 10;
        if ((profile as any)?.address) {
            doc.text((profile as any).address, (profile as any)?.logo_url ? 30 : 15, companyDetailY);
            companyDetailY += 4;
        }
        const contactInfo = `Ph: ${(profile as any)?.phone || 'N/A'} | Email: ${(profile as any)?.email || 'N/A'}`;
        doc.text(contactInfo, (profile as any)?.logo_url ? 30 : 15, companyDetailY);

        currentY = Math.max(currentY + 20, companyDetailY + 8);

        // Document Title
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text("VEHICLE SERVICE HISTORY REPORT", 15, currentY);
        doc.setLineWidth(0.5);
        doc.line(15, currentY + 1, 90, currentY + 1);
        currentY += 10;

        // Vehicle & Customer Info Box
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(15, currentY, pageWidth - 30, 35, 2, 2, 'FD');

        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text("VEHICLE DETAILS", 20, currentY + 6);
        doc.text("CUSTOMER DETAILS", (pageWidth / 2) + 5, currentY + 6);

        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        // Vehicle Col
        doc.setFont('helvetica', 'bold');
        doc.text(`REG: ${(vehicle as any).vehicle_number}`, 20, currentY + 12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Model: ${(vehicle as any).model || 'N/A'}`, 20, currentY + 17);
        doc.text(`KM Driven: ${(vehicle as any).kilometers_driven || 'N/A'}`, 20, currentY + 22);
        doc.text(`Next Service: ${(vehicle as any).next_service_km || 'N/A'} km`, 20, currentY + 27);

        // Customer Col
        doc.setFont('helvetica', 'bold');
        doc.text((vehicle as any).customers?.name || 'N/A', (pageWidth / 2) + 5, currentY + 12);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Ph: ${(vehicle as any).customers?.phone || 'N/A'}`, (pageWidth / 2) + 5, currentY + 17);
        if ((vehicle as any).customers?.address) {
            const addrLines = doc.splitTextToSize((vehicle as any).customers.address, (pageWidth / 2) - 15);
            doc.text(addrLines, (pageWidth / 2) + 5, currentY + 22);
        }

        doc.setFontSize(8);
        doc.text(`Date of Report: ${format(new Date(), 'PP')}`, pageWidth - 20, currentY + 6, { align: 'right' });
        doc.text(`Total Records: ${history.length}`, pageWidth - 20, currentY + 12, { align: 'right' });
        currentY += 45;

        // History Timeline
        for (const wo of history) {
            if (currentY > 250) {
                doc.addPage();
                currentY = 20;
            }

            // Work Order Card Header
            doc.setFillColor(241, 245, 249);
            doc.rect(15, currentY, pageWidth - 30, 10, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(`${format(new Date(wo.created_at), 'PPP')} - ${wo.service_type || 'General Service'}`, 20, currentY + 7);
            doc.text(wo.status.toUpperCase(), pageWidth - 20, currentY + 7, { align: 'right' });
            currentY += 15;

            // Details
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            const descriptionText = parseNotes(wo.description);
            const descriptionLines = doc.splitTextToSize(`Description: ${descriptionText}`, pageWidth - 40);
            doc.text(descriptionLines, 20, currentY);
            currentY += (descriptionLines.length * 4) + 1;

            const advisorName = wo.advisor?.name || 'N/A';
            const advisorPhone = wo.advisor?.phone ? `(${wo.advisor.phone})` : '';
            const driverName = wo.driver?.name || 'N/A';
            const driverPhone = wo.driver?.contact_number ? `(${wo.driver.contact_number})` : '';

            doc.text(`Advisor: ${advisorName} ${advisorPhone} | Driver: ${driverName} ${driverPhone}`, 20, currentY);
            currentY += 8;

            // Tasks Table
            const taskData = (wo.services || []).flatMap((s: any) =>
                (s.tasks || []).map((t: any) => [
                    s.service_type,
                    t.task_name,
                    t.completed ? 'Done' : 'Pending'
                ])
            );

            if (taskData.length > 0) {
                autoTable(doc, {
                    startY: currentY,
                    head: [['Category', 'Task', 'Status']],
                    body: taskData,
                    theme: 'grid',
                    styles: { fontSize: 7 },
                    headStyles: { fillColor: [15, 23, 42] },
                    margin: { left: 20, right: 20 },
                });
                currentY = (doc as any).lastAutoTable.finalY + 5;
            } else {
                doc.text("No detailed tasks recorded.", 20, currentY);
                currentY += 8;
            }

            // Financial Summary for Work Order
            let billedTotal = 0;
            let paidTotal = 0;
            (wo.invoices || []).forEach((inv: any) => {
                billedTotal += inv.total || 0;
                inv.payment_links?.forEach((link: any) => {
                    if (link.payment?.status === 'approved') {
                        paidTotal += link.amount_applied || link.payment.amount;
                    }
                });
            });

            if (billedTotal > 0) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.text(`BILLED TOTAL: Rs. ${billedTotal}`, 20, currentY);
                doc.text(`RECEIVED (PAID): Rs. ${paidTotal}`, 70, currentY);
                currentY += 10;
            } else {
                currentY += 5;
            }
        }

        if (action === 'preview') {
            window.open(doc.output('bloburl'), '_blank');
        } else {
            doc.save(`${(vehicle as any).vehicle_number}_History.pdf`);
        }
        return true;
    } catch (error) {
        console.error("PDF Generation failed:", error);
        throw error;
    }
};

class PDFGenerator {
    private doc: jsPDF;
    private pageWidth: number;
    private pageHeight: number;
    private currentY: number = 0;
    private isNewPage: boolean = false;
    private logoBase64: string = '';
    private copyType: 'customer' | 'workshop' = 'customer';
    private docType: 'work_slip' | 'invoice' = 'invoice';

    constructor(copyType: 'customer' | 'workshop' = 'customer', docType: 'work_slip' | 'invoice' = 'invoice') {
        this.doc = new jsPDF();
        this.pageWidth = this.doc.internal.pageSize.width;
        this.pageHeight = this.doc.internal.pageSize.height;
        this.copyType = copyType;
        this.docType = docType;
    }

    private setStyle(fontSize: number, isBold: boolean = false, color: number[] = COLORS.darkText) {
        this.doc.setFont(FONTS.primary, isBold ? 'bold' : 'normal');
        this.doc.setFontSize(fontSize);
        this.doc.setTextColor(color[0], color[1], color[2]);
    }

    public getCurrentY(): number {
        return this.currentY;
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

        const headerY = this.isNewPage ? 10 : 15;

        // Add logo if available and not continuation page
        let nameX = 15;
        if (this.logoBase64 && !this.isNewPage) {
            try {
                this.doc.addImage(this.logoBase64, 'PNG', 15, headerY - 5, 12, 12);
                nameX = 32;
            } catch (error) {
                console.error('Failed to add logo:', error);
            }
        }

        // Company name (Left)
        this.setStyle(this.isNewPage ? 14 : 18, true, COLORS.primary);
        this.doc.text(company.company_name.toUpperCase(), nameX, headerY + 2);

        // Document title (Left, below name, smaller)
        this.setStyle(9, false, COLORS.secondary);
        const docTitle = settings.title || (isQuotation ? 'Quotation / Estimate' : (type === 'invoice' ? 'Tax Invoice' : 'Work Slip'));
        this.doc.text(docTitle, nameX, headerY + 7);

        // Company details (Left)
        if (!this.isNewPage) {
            this.setStyle(8, false, COLORS.accent);
            let detailY = headerY + 12;
            if (company.address) {
                this.doc.text(company.address, nameX, detailY);
                detailY += 4;
            }

            const mainPhone = company.phone || '';
            const ownerPhone = (company as any).owner_phone;
            const ownerName = (company as any).owner_name;

            let contactLine = `Ph: ${mainPhone}`;
            if (ownerPhone) contactLine += ` | Owner: ${ownerPhone}`;
            if (company.email) contactLine += ` • Email: ${company.email}`;

            this.doc.text(contactLine, nameX, detailY);

            if (ownerName) {
                detailY += 4;
                this.doc.text(`Proprietor: ${ownerName}`, nameX, detailY);
            }
        }

        // Right Side Info (Invoice No, Date)
        const rightX = this.pageWidth - 15;
        let rightY = headerY + 2;

        // Number Label
        this.setStyle(7, true, COLORS.secondary);
        this.doc.text(isQuotation ? 'QUOTATION NO' : (type === 'invoice' ? 'INVOICE NO' : 'SLIP NO'), rightX, rightY, { align: 'right' });

        // Number Value
        this.setStyle(12, true, COLORS.primary);
        this.doc.text(billNumberDisplay, rightX, rightY + 5, { align: 'right' });

        rightY += 12;

        // Date Label
        this.setStyle(7, true, COLORS.secondary);
        this.doc.text('DATE', rightX, rightY, { align: 'right' });

        // Date Value
        this.setStyle(9, true, COLORS.primary);
        this.doc.text(format(new Date(), "d MMM yyyy"), rightX, rightY + 4, { align: 'right' });

        // Bottom Border for Header
        const lineY = headerY + (this.isNewPage ? 10 : 25);
        this.doc.setDrawColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
        this.doc.setLineWidth(0.3);
        this.doc.line(15, lineY, this.pageWidth - 15, lineY);

        this.currentY = lineY + 8;
    }

    drawCustomerVehicleInfo(workOrder: WorkOrder) {
        const hasIntake = !!((workOrder as any).advisor || (workOrder as any).assigned_employee || (workOrder as any).intake_person);
        const boxHeight = hasIntake ? 32 : 28;

        // Draw Container Box (Light BG like Payslip)
        this.doc.setFillColor(COLORS.lightBg[0], COLORS.lightBg[1], COLORS.lightBg[2]);
        this.doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
        this.doc.roundedRect(15, this.currentY, this.pageWidth - 30, boxHeight, 2, 2, 'FD');

        // Column Widths (3-Column Layout)
        const colWidth = (this.pageWidth - 40) / 3;
        let contentY = this.currentY + 6;

        // Column 1: Customer Info
        this.setStyle(7, true, COLORS.accent);
        this.doc.text("BILLED TO", 20, contentY);
        this.setStyle(9, true, COLORS.primary);
        this.doc.text(workOrder.vehicle?.customers?.name || 'N/A', 20, contentY + 5);
        this.setStyle(8, false, COLORS.secondary);
        let currentRY = contentY + 9;
        if (workOrder.vehicle?.customers?.company_name) {
            this.doc.text(workOrder.vehicle.customers.company_name, 20, currentRY);
            currentRY += 4;
        }
        if (workOrder.vehicle?.customers?.phone) {
            this.doc.text(`Ph: ${workOrder.vehicle.customers.phone}`, 20, currentRY);
        }

        // Column 2: Vehicle Details
        const vX = 20 + colWidth;
        this.setStyle(7, true, COLORS.accent);
        this.doc.text("VEHICLE DETAILS", vX, contentY);
        this.setStyle(9, true, COLORS.primary);
        this.doc.text(workOrder.vehicle?.vehicle_number || 'N/A', vX, contentY + 5);
        this.setStyle(8, false, COLORS.secondary);
        this.doc.text(`${workOrder.vehicle?.model || ''}`, vX, contentY + 9);
        this.doc.text(`KM: ${workOrder.vehicle?.kilometers_driven || 'N/A'}`, vX, contentY + 13);

        // Column 3: Order Info (Intake & Delivery)
        const oX = 20 + (colWidth * 2);
        this.setStyle(7, true, COLORS.accent);
        this.doc.text("ORDER INFO", oX, contentY);

        this.setStyle(8, true, COLORS.primary);
        let currentOY = contentY + 5;
        const intakeData = (workOrder as any).advisor || (workOrder as any).assigned_employee || (workOrder as any).intake_person;
        const intake = Array.isArray(intakeData) ? intakeData[0] : intakeData;

        if (intake && intake.name) {
            let assignedText = `Assigned By: ${intake.name}`;
            if (intake.phone) {
                assignedText += ` (${intake.phone})`;
            }
            this.doc.text(assignedText, oX, currentOY);
            currentOY += 4;
        } else if ((workOrder as any).assigned_to) {
            // Fallback: If we have ID but no joined record, try to show the ID or just a placeholder
            // This suggests a join/RLS issue
            this.doc.text(`Assigned By ID: ${(workOrder as any).assigned_to.slice(0, 8)}`, oX, currentOY);
            currentOY += 4;
        }

        this.setStyle(7, false, COLORS.secondary);
        if (workOrder.estimated_delivery_date) {
            this.doc.text(`Delivery: ${format(new Date(workOrder.estimated_delivery_date), "PPp")}`, oX, currentOY);
            currentOY += 4;
        }

        if (workOrder.driver?.name) {
            let driverText = `Driver: ${workOrder.driver.name}`;
            if (workOrder.driver.contact_number) {
                driverText += ` (${workOrder.driver.contact_number})`;
            }
            this.doc.text(driverText, oX, currentOY);
        }

        this.currentY += boxHeight + 8;
    }

    drawMainWorkTable(workOrder: WorkOrder) {
        const isWorkshop = this.copyType === 'workshop';
        const headers = [isWorkshop ? ['GENERAL WORK DESCRIPTION'] : ['GENERAL WORK DESCRIPTION', 'ESTIMATED TOTAL COST']];
        const data = [isWorkshop ? [workOrder.description || 'General Service'] : [
            workOrder.description || 'General Service',
            `Rs. ${(workOrder.estimated_cost || 0).toLocaleString()}`
        ]];

        autoTable(this.doc, {
            startY: this.currentY,
            head: headers,
            body: data,
            theme: 'grid',
            headStyles: {
                fillColor: COLORS.primary,
                textColor: COLORS.accent,
                fontSize: 8,
                fontStyle: 'bold',
                halign: 'left'
            },
            bodyStyles: {
                fontSize: 9,
                textColor: COLORS.darkText,
                cellPadding: 3
            },
            columnStyles: isWorkshop ? {
                0: { cellWidth: 'auto' }
            } : {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 50, halign: 'right', fontStyle: 'bold' }
            },
            margin: { left: 15, right: 15 }
        });

        this.currentY = (this.doc as any).lastAutoTable.finalY + 8;
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

    drawItemsTable(items: LineItem[], sectionTitle: string, sectionNumber: string = 'I', assignments: EmployeeAssignment[] = []) {
        this.drawSectionHeader(sectionTitle, sectionNumber);

        const isWorkshop = this.copyType === 'workshop';
        const isCustomerSlip = this.copyType === 'customer' && this.docType === 'work_slip';

        let head: string[][];
        if (isWorkshop) {
            head = [['#', 'Service', 'Work Description', 'Assigned Staff', 'Status']];
        } else if (isCustomerSlip) {
            head = [['#', 'Description', 'Amount']];
        } else {
            head = [['#', 'Description', 'HSN', 'Taxable Value', 'GST%', 'CGST', 'SGST', 'Total']];
        }

        const body = items.map((item, index) => {
            if (isWorkshop) {
                const assignedStaff = assignments && assignments.length > 0
                    ? assignments.map(a => (a.employee?.name || 'Staff').split(' ')[0]).join(", ")
                    : 'General';

                return [
                    (index + 1).toString(),
                    sectionTitle,
                    item.description || 'Task',
                    assignedStaff,
                    "[ ] Done  [ ] Pending"
                ];
            } else if (isCustomerSlip) {
                return [
                    (index + 1).toString(),
                    item.description || 'Item',
                    `Rs. ${(item.total || 0).toFixed(2)}`
                ];
            } else {
                return [
                    (index + 1).toString(),
                    item.description || 'Item',
                    item.hsn_code || '-',
                    `Rs. ${(item.taxable_value || 0).toFixed(2)}`,
                    `${item.gst_rate || 18}%`,
                    `Rs. ${(item.cgst_amount || 0).toFixed(2)}`,
                    `Rs. ${(item.sgst_amount || 0).toFixed(2)}`,
                    `Rs. ${(item.total || 0).toFixed(2)}`
                ];
            }
        });

        autoTable(this.doc, {
            startY: this.currentY,
            head: head,
            body: body,
            theme: 'grid',
            headStyles: {
                fillColor: COLORS.primary,
                textColor: COLORS.accent,
                fontSize: isWorkshop ? 7.5 : 8,
                fontStyle: 'bold'
            },
            bodyStyles: {
                fontSize: isWorkshop ? 7.5 : 8.5,
                textColor: COLORS.darkText,
                cellPadding: isWorkshop ? 1.5 : 2.5
            },
            columnStyles: isWorkshop ? {
                0: { cellWidth: 10 },
                1: { cellWidth: 30 },
                2: { cellWidth: 'auto' },
                3: { cellWidth: 30 },
                4: { cellWidth: 35 }
            } : isCustomerSlip ? {
                0: { cellWidth: 15 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 40, halign: 'right' }
            } : {
                0: { cellWidth: 10 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 20 },
                3: { cellWidth: 25 },
                4: { cellWidth: 15 },
                5: { cellWidth: 20 },
                6: { cellWidth: 20 },
                7: { cellWidth: 25 }
            },
            margin: { left: 15, right: 15 },
            didDrawPage: (data) => {
                this.currentY = data.cursor?.y || this.currentY;
            }
        });

        this.currentY = (this.doc as any).lastAutoTable.finalY + 5;
    }

    drawSectionSummary(totals: SectionTotals, title: string) {
        if (this.copyType === 'workshop' || (this.copyType === 'customer' && this.docType === 'work_slip')) return;

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
        isQuotation: boolean,
        workOrder?: any
    ) {
        const isWorkshop = this.copyType === 'workshop';
        const isCustomerSlip = this.copyType === 'customer' && this.docType === 'work_slip';
        const hasSavings = !isWorkshop && !isCustomerSlip && workOrder && Number(workOrder.estimated_cost || 0) > finalTotal;

        // Minimum space needed from bottom
        const footerSpace = 45; // Terms and Signatures
        const summarySpace = (isWorkshop || isCustomerSlip) ? 25 : (hasSavings ? 75 : 65);
        const taxBankSpace = (showTaxes && !isQuotation && !isWorkshop && !isCustomerSlip) ? 35 : 0;

        const totalNeeded = footerSpace + summarySpace + taxBankSpace;
        const targetStartY = this.pageHeight - totalNeeded;

        // Push to bottom if there's room, otherwise draw where we are
        if (this.currentY < targetStartY) {
            this.currentY = targetStartY;
        }

        // --- Summary Line ---
        this.setStyle(12, true, COLORS.primary);
        this.doc.text(isWorkshop ? "WORK ORDER SUMMARY" : "SUMMARY & FINAL SETTLEMENT", 15, this.currentY);
        this.currentY += 6;

        if (!isWorkshop && !isCustomerSlip) {
            // Horizontal Breakdown for Invoice
            this.setStyle(9, false, COLORS.darkText);
            const breakdownText = `Service: Rs. ${serviceTotals.total.toFixed(2)} | Parts: Rs. ${partTotals.total.toFixed(2)}`;
            this.doc.text(breakdownText, 15, this.currentY);

            // Grand total box (Right aligned)
            this.doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
            this.doc.roundedRect(this.pageWidth - 75, this.currentY - 5, 60, 12, 2, 2, 'F');

            this.setStyle(9, true, COLORS.accent);
            this.doc.text("NET PAYABLE", this.pageWidth - 70, this.currentY + 1.5);

            this.setStyle(11, true, COLORS.white);
            this.doc.text(`Rs. ${finalTotal.toFixed(0)}`, this.pageWidth - 20, this.currentY + 1.5, { align: 'right' });

            this.currentY += 10;

            if (hasSavings) {
                const estimatedCost = Number(workOrder.estimated_cost);
                const savingsAmount = estimatedCost - finalTotal;
                
                this.setStyle(8, false, COLORS.lightText);
                this.doc.text(`Original Estimate: Rs. ${estimatedCost.toFixed(2)}`, 15, this.currentY);
                
                this.setStyle(8, true, [22, 163, 74]); // Emerald Green
                this.doc.text(`You Saved: Rs. ${savingsAmount.toFixed(2)}`, 15, this.currentY + 4);
                this.currentY += 10;
            }

            // Amount in words (Smaller)
            this.setStyle(8, true, COLORS.darkText);
            const amountInWords = toWords.convert(finalTotal);
            const wordsLines = this.doc.splitTextToSize(`Rupees ${amountInWords} Only`, this.pageWidth - 90);
            this.doc.text(wordsLines, 15, this.currentY);
            this.currentY += (wordsLines.length * 4) + 4;

            if (showTaxes && !isQuotation) {
                this.drawSplitTaxAndBank(serviceTotals, partTotals, company);
            }
        } else if (isCustomerSlip) {
            // Simplified total ONLY - Professional Centered Alignment
            this.doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
            this.doc.roundedRect(this.pageWidth - 75, this.currentY - 5, 60, 10, 1, 1, 'F');

            this.setStyle(9, true, COLORS.accent);
            this.doc.text("FINAL TOTAL", this.pageWidth - 70, this.currentY + 1.5);

            this.setStyle(11, true, COLORS.white);
            this.doc.text(`Rs. ${finalTotal.toFixed(0)}`, this.pageWidth - 20, this.currentY + 1.5, { align: 'right' });

            this.currentY += 12;
        } else if (isWorkshop) {
            this.setStyle(9, false, COLORS.secondary);
            this.doc.text("Note: Pricing is hidden for workshop copy.", 15, this.currentY);
            this.currentY += 10;
        }
    }

    private drawSplitTaxAndBank(serviceTotals: SectionTotals, partTotals: SectionTotals, company: CompanyProfile) {
        const boxY = this.currentY;

        // Left Column: Bank Details
        this.setStyle(8, true, COLORS.primary);
        this.doc.text("BANKING DETAILS", 15, boxY);
        this.setStyle(7.5, false, COLORS.darkText);
        let bY = boxY + 5;
        if (company.acc_number) {
            this.doc.text(`A/C: ${company.acc_number} | IFSC: ${company.ifsc}`, 15, bY);
            bY += 4;
            this.doc.text(`Bank: ${company.bank_name} | UPI: ${company.upi_id || 'N/A'}`, 15, bY);
        }

        // Right Column: Tax Summary (Mini Table)
        const totalTaxable = serviceTotals.taxable + partTotals.taxable;
        const totalGST = serviceTotals.cgst + partTotals.cgst + serviceTotals.sgst + partTotals.sgst;

        this.setStyle(8, true, COLORS.primary);
        this.doc.text("TAX SUMMARY", this.pageWidth / 2 + 10, boxY);
        this.setStyle(7.5, false, COLORS.darkText);
        this.doc.text(`Taxable Value: Rs. ${totalTaxable.toFixed(2)}`, this.pageWidth / 2 + 10, boxY + 5);
        this.doc.text(`Total GST (18%): Rs. ${totalGST.toFixed(2)}`, this.pageWidth / 2 + 10, boxY + 9);

        this.currentY += 15;
    }

    drawFooter(settings: DocumentSettings, type: 'work_slip' | 'invoice') {
        const footerY = this.pageHeight - 35;

        // Terms and Conditions (Very small, one line if short)
        if (settings.terms_and_conditions) {
            this.setStyle(7, true, COLORS.lightText);
            const termsLines = this.doc.splitTextToSize(`Terms: ${settings.terms_and_conditions}`, this.pageWidth - 30);
            this.doc.text(termsLines, 15, footerY - 10);
        }

        // Signatures
        const signatureY = footerY + 8;

        // Customer signature
        this.doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
        this.doc.line(15, signatureY, 60, signatureY);
        this.setStyle(7, false, COLORS.lightText);
        this.doc.text("Customer Signature", 15, signatureY + 4);

        // Company signature
        this.doc.line(this.pageWidth - 60, signatureY, this.pageWidth - 15, signatureY);
        this.doc.text("Authorized Signature", this.pageWidth - 15, signatureY + 4, { align: 'right' });

        // Footer text
        if (settings.footer_text) {
            this.setStyle(7, false, COLORS.lightText);
            this.doc.text(
                settings.footer_text,
                this.pageWidth / 2,
                this.pageHeight - 4,
                { align: 'center' }
            );
        }

        // Page number
        this.setStyle(7, false, COLORS.lightText);
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
    action: 'save' | 'preview' = 'preview',
    copyType: 'customer' | 'workshop' = 'customer',
    themeColor?: string
) => {
    try {
        // Apply theme color to global COLORS object dynamically
        if (themeColor === 'blue') {
            COLORS.primary = [30, 64, 175];
            COLORS.success = [29, 78, 216];
            COLORS.lightBg = [239, 246, 255];
            COLORS.darkText = [30, 64, 175];
        } else if (themeColor === 'emerald') {
            COLORS.primary = [6, 95, 70];
            COLORS.success = [4, 120, 87];
            COLORS.lightBg = [236, 253, 245];
            COLORS.darkText = [6, 95, 70];
        } else if (themeColor === 'indigo') {
            COLORS.primary = [55, 48, 163];
            COLORS.success = [67, 56, 202];
            COLORS.lightBg = [245, 243, 255];
            COLORS.darkText = [55, 48, 163];
        } else if (themeColor === 'rose') {
            COLORS.primary = [159, 18, 57];
            COLORS.success = [190, 24, 74];
            COLORS.lightBg = [255, 241, 242];
            COLORS.darkText = [159, 18, 57];
        } else {
            // Restore default Slate theme
            COLORS.primary = [15, 23, 42];
            COLORS.success = [15, 23, 42];
            COLORS.lightBg = [248, 250, 252];
            COLORS.darkText = [15, 23, 42];
        }
        // Fetch all required data
        const [
            profileRes,
            settingsRes,
            workOrderRes,
            servicesRes,
            invoiceRes,
            tasksRes
        ] = await Promise.all([
            supabase.from('company_profiles').select('*').limit(1).single(),
            supabase.from('document_settings').select('*').eq('doc_type', type).single(),
            supabase.from('work_orders').select(`
                *,
                driver:drivers(name, contact_number),
                advisor:employees!assigned_to(name, phone),
                vehicle:vehicles!vehicle_id(
                  vehicle_number, model, kilometers_driven, next_service_km, fc_expiry_date,
                  customers(id, name, phone, address, company_name)
                )
            `).eq('id', workOrderId).single(),
            supabase.from('work_order_services').select(`
                *,
                employees:work_order_service_employees(
                    id, 
                    employee_id, 
                    status,
                    employee:employees(name, position:positions(name))
                )
            `).eq('work_order_id', workOrderId),
            supabase.from('invoices').select('*').eq('work_order_id', workOrderId).maybeSingle(),
            supabase.from('work_order_tasks').select('*').eq('work_order_id', workOrderId)
        ]);

        const profile = profileRes.data as any;
        const settingsData = settingsRes.data as any;
        const workOrderData = workOrderRes.data;
        const services = servicesRes.data;
        const invoiceData = invoiceRes.data;
        const tasksData = tasksRes.data;

        if (!workOrderData) {
            throw new Error("Work Order not found");
        }

        const workOrder = workOrderData as any;

        // Flatten assignments from services
        const assignments: EmployeeAssignment[] = [];
        (services || []).forEach((s: any) => {
            if (s.employees) {
                s.employees.forEach((ae: any) => {
                    assignments.push({
                        id: ae.id,
                        service_id: s.id,
                        employee: ae.employee,
                        status: ae.status
                    });
                });
            }
        });

        // Initialize PDF generator
        const pdfGen = new PDFGenerator(copyType, type);
        if (profile?.logo_url) {
            await pdfGen.loadLogo(profile.logo_url);
        }

        // Process data
        const tasks: any[] = tasksData || [];
        const invoice: any = invoiceData; // Cast to avoid 'never' type inference on invoiceData properties

        const settings: DocumentSettings = settingsData || {
            title: copyType === 'workshop' ? 'WORK SLIP (Workshop Copy)' : (type === 'invoice' ? 'TAX INVOICE' : 'WORK SLIP'),
            prefix: type === 'invoice' ? 'INV-' : 'WS-',
            show_rates: copyType !== 'workshop',
            show_taxes: copyType !== 'workshop'
        };

        if (copyType === 'workshop') {
            settings.title = 'WORK SLIP (Workshop Copy)';
        } else if (type === 'work_slip') {
            settings.title = 'WORK SLIP (Customer Copy)';
        }

        const company: CompanyProfile = profile || {
            company_name: 'Service Center',
            address: '',
            phone: '',
            email: ''
        };

        let finalItems: LineItem[] = [];
        let billNumberDisplay = `${type === 'invoice' ? 'INV' : 'WS'}-${workOrder.id?.slice(0, 8).toUpperCase() || 'UNKNOWN'}`;
        let isQuotation = false;
        let finalTotal = 0;

        // Determine items and totals based on document type
        // Determine items and totals based on document type
        if (type === 'invoice' && invoice) {
            const inv = invoice as any;
            isQuotation = inv.type === 'quotation';
            const { data: invItems } = await supabase
                .from('invoice_items')
                .select('*')
                .eq('invoice_id', inv.id);

            finalItems = (invItems || []) as LineItem[];
            finalTotal = inv.total || 0;

            if (isQuotation && inv.quotation_number) {
                billNumberDisplay = `QTN-${inv.quotation_number}`;
            } else if (inv.bill_number) {
                billNumberDisplay = `BILL-${inv.bill_number}`;
            }
        } else {
            // For work slip or new invoice
            if (tasks.length > 0) {
                finalItems = tasks.map((t: any) => ({
                    id: t.id,
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
            const serviceAssignments = assignments.filter(a => services?.some((s: any) => s.id === a.service_id));
            pdfGen.drawItemsTable(serviceItems, 'Service Bill', 'I', serviceAssignments);
            pdfGen.drawSectionSummary(serviceTotals, 'Service');
        }

        // --- INVENTORY BILL (No forced page break) ---
        if (partItems.length > 0) {
            // Only add page if less than 60 units of space left
            if (pdfGen.getCurrentY() > 240) {
                pdfGen.addPage();
                pdfGen.drawHeader(company, settings, workOrder, isQuotation, billNumberDisplay, type);
            } else {
                pdfGen.setCurrentY(pdfGen.getCurrentY() + 5);
            }
            pdfGen.drawItemsTable(partItems, 'Inventory Bill', 'II');
            pdfGen.drawSectionSummary(partTotals, 'Parts');
        }

        // --- FINAL SUMMARY (No forced page break) ---
        // Only add page if less than 80 units of space left for summary
        if (pdfGen.getCurrentY() > 220) {
            pdfGen.addPage();
            pdfGen.drawHeader(company, settings, workOrder, isQuotation, billNumberDisplay, type);
        } else {
            pdfGen.setCurrentY(pdfGen.getCurrentY() + 5);
        }
        pdfGen.drawFinalSummary(
            serviceTotals,
            partTotals,
            finalTotal,
            company,
            settings.show_taxes && type === 'invoice',
            isQuotation,
            workOrder
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
            doc.text(`${companyProfile.company_name} | Generated by Service Portal`, 15, footerY);
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
