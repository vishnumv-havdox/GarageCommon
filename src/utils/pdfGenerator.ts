import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
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
            }
        }
    }
});

export const generateWorkSlipPDF = async (workOrderId: string, action: 'save' | 'preview' = 'preview') => {
    return generateDocument(workOrderId, 'work_slip', action);
};

export const generateInvoicePDF = async (workOrderId: string, action: 'save' | 'preview' = 'preview') => {
    return generateDocument(workOrderId, 'invoice', action);
};

const generateDocument = async (workOrderId: string, type: 'work_slip' | 'invoice', action: 'save' | 'preview' = 'preview') => {
    try {
        // 1. Fetch Configuration & Data
        const [
            { data: profile },
            { data: settingsData },
            { data: workOrder },
            { data: services },
            { data: invoiceData } // Fetch invoice if exists
        ]: any[] = await Promise.all([
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

        const tasks = tasksData || [];

        if (!workOrder) throw new Error("Work Order not found");

        // If generating invoice, check if we have specific invoice items
        let finalItems: any[] = services || [];
        let billNumberDisplay = `NO: ${type === 'invoice' ? 'INV-' : 'WS-'}${workOrder.id.slice(0, 6).toUpperCase()}`;
        let finalSubtotal = 0;
        let finalTax = 0;
        let finalTotal = 0;
        let isQuotation = false;

        if (type === 'invoice' && invoiceData) {
            isQuotation = invoiceData.type === 'quotation';
            // Fetch invoice items with new fields
            const { data: invItems } = await supabase
                .from('invoice_items')
                .select('*')
                .eq('invoice_id', invoiceData.id);

            finalItems = invItems || [];
            finalSubtotal = invoiceData.subtotal || 0;
            finalTax = invoiceData.tax || 0;
            finalTotal = invoiceData.total || 0;

            if (isQuotation && invoiceData.quotation_number) {
                billNumberDisplay = `QTN: ${invoiceData.quotation_number}`;
            } else if (invoiceData.bill_number) {
                billNumberDisplay = `BILL NO: ${invoiceData.bill_number}`;
            }
        } else {
            // For Work Slip or New Invoice, use tasks as line items
            if (tasks.length > 0) {
                finalItems = tasks.map(t => ({
                    description: t.task_name,
                    taxable_value: t.price || 0,
                    total: t.price || 0,
                    type: 'service',
                    hsn_code: '-'
                }));
            } else {
                finalItems = services || [];
            }
            finalSubtotal = finalItems.reduce((sum: number, i: any) => sum + (i.taxable_value || i.estimated_cost || 0), 0);
            finalTax = finalSubtotal * 0.18;
            finalTotal = finalSubtotal + finalTax;
        }

        const settings = settingsData || {
            title: isQuotation ? 'QUOTATION / ESTIMATE' : (type === 'invoice' ? 'TAX INVOICE' : 'WORK SLIP'),
            prefix: type === 'invoice' ? 'INV-' : 'WS-',
            show_rates: true,
            show_taxes: true
        };

        if (isQuotation) settings.title = 'QUOTATION / ESTIMATE';

        const company = profile || {
            company_name: 'Service Center',
            address: '',
            phone: ''
        };

        // 1.5 Pre-load Logo if exists
        let logoBase64 = "";
        if (company.logo_url) {
            try {
                logoBase64 = await fetch(company.logo_url).then(r => r.blob()).then(blob => {
                    return new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                });
            } catch (e) {
                console.error("Failed to pre-load logo:", e);
            }
        }

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;

        // Calculate Granular Totals
        const serviceItems = finalItems.filter(i => i.type === 'service');
        const partItems = finalItems.filter(i => i.type === 'part');

        const calcSection = (items: any[]) => {
            const taxable = items.reduce((sum, i) => sum + (i.taxable_value || 0), 0);
            const cgst = items.reduce((sum, i) => sum + (i.cgst_amount || 0), 0);
            const sgst = items.reduce((sum, i) => sum + (i.sgst_amount || 0), 0);
            const total = items.reduce((sum, i) => sum + (i.total || 0), 0);
            return { taxable, cgst, sgst, total };
        };

        const serviceTotals = calcSection(serviceItems);
        const partTotals = calcSection(partItems);

        // Helper: Draw Header
        const drawHeader = (d: jsPDF, isNewPage = false) => {
            d.setFillColor(41, 128, 185);
            if (type === 'invoice') d.setFillColor(39, 60, 117);
            d.rect(0, 0, pageWidth, isNewPage ? 30 : 40, 'F');

            let nameX = 15;
            if (logoBase64 && !isNewPage) {
                try {
                    d.addImage(logoBase64, 'PNG', 15, 6, 12, 12);
                    nameX = 32;
                } catch (e) {
                    console.error("Failed to add logo to PDF:", e);
                }
            }

            d.setTextColor(255, 255, 255);
            d.setFontSize(isNewPage ? 18 : 24);
            d.setFont('helvetica', 'bold');
            d.text(company.company_name.toUpperCase(), nameX, isNewPage ? 12 : 18);
            d.setFontSize(isNewPage ? 20 : 30);
            d.text(settings.title || (type === 'invoice' ? 'INVOICE' : 'WORK SLIP'), pageWidth - 15, isNewPage ? 20 : 28, { align: 'right' });

            if (!isNewPage) {
                d.setFontSize(9);
                d.setFont('helvetica', 'normal');
                d.setTextColor(240, 240, 240);
                d.text(company.address || '', 15, 26);
                d.text(`Phone: ${company.phone || ''} | Email: ${company.email || ''}`, 15, 31);
                d.setFillColor(245, 245, 245);
                d.rect(0, 40, pageWidth, 25, 'F');
                d.setTextColor(50, 50, 50);
                d.setFontSize(10);
                d.setFont('helvetica', 'bold');
                d.text(billNumberDisplay, 15, 52);
                d.setFont('helvetica', 'normal');
                d.text(`Date: ${new Date().toLocaleDateString()}`, 15, 58);
                if (workOrder.estimated_delivery_date) {
                    d.setFont('helvetica', 'bold');
                    d.text("Est. Delivery:", pageWidth / 2, 52, { align: 'center' });
                    d.setFont('helvetica', 'normal');
                    d.text(new Date(workOrder.estimated_delivery_date).toLocaleString(), pageWidth / 2, 58, { align: 'center' });
                }
            } else {
                d.setTextColor(50, 50, 50);
                d.setFontSize(10);
                d.setFont('helvetica', 'bold');
                d.text(`${billNumberDisplay} (Contd.)`, 15, 40);
            }
        };

        // Helper: Section Summary
        const drawSectionSummary = (d: jsPDF, y: number, totals: any, title: string) => {
            d.setFont('helvetica', 'bold');
            d.setFontSize(10);
            d.setTextColor(50, 50, 50);
            const startX = pageWidth - 80;
            d.text(`Total ${title}:`, startX, y);
            d.text(`Rs. ${totals.total.toFixed(2)}`, pageWidth - 15, y, { align: 'right' });

            d.setFontSize(8);
            d.setFont('helvetica', 'normal');
            d.setTextColor(100, 100, 100);
            d.text(`(Taxable: ${totals.taxable.toFixed(2)}, GST: ${(totals.cgst + totals.sgst).toFixed(2)})`, pageWidth - 15, y + 5, { align: 'right' });
            return y + 15;
        };

        const drawFooter = (d: jsPDF) => {
            const footerY = pageHeight - 50;
            if (settings.terms_and_conditions) {
                d.setFontSize(8);
                d.setTextColor(100, 100, 100);
                d.text("Terms & Conditions:", 15, footerY - 10);
                const terms = d.splitTextToSize(settings.terms_and_conditions, pageWidth - 30);
                d.text(terms, 15, footerY - 5);
            }
            d.setDrawColor(200, 200, 200);
            d.line(15, footerY + 25, 70, footerY + 25);
            d.setFontSize(9);
            d.setTextColor(50, 50, 50);
            d.text("Customer Signature", 15, footerY + 30);
            d.line(pageWidth - 70, footerY + 25, pageWidth - 15, footerY + 25);
            d.text("Authorized Signature", pageWidth - 15, footerY + 30, { align: 'right' });
            d.setFillColor(39, 60, 117);
            d.rect(0, pageHeight - 10, pageWidth, 10, 'F');
            if (settings.footer_text) {
                d.setTextColor(255, 255, 255);
                d.setFontSize(8);
                d.text(settings.footer_text, pageWidth / 2, pageHeight - 4, { align: 'center' });
            }
        };

        // --- PAGE 1: SERVICE BILL ---
        drawHeader(doc);
        let currentY = 75;
        // Customer/Vehicle Boxes (Same as before)
        doc.setDrawColor(220, 220, 220); doc.setFillColor(252, 252, 252);
        doc.roundedRect(15, currentY, (pageWidth / 2) - 20, 35, 3, 3, 'FD');
        doc.setFont('helvetica', 'bold'); doc.setTextColor(41, 128, 185);
        doc.text("CUSTOMER", 20, currentY + 8);
        doc.setTextColor(0, 0, 0); doc.setFontSize(10);
        doc.text(workOrder.vehicle?.customers?.name || 'Unknown', 20, currentY + 16);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
        doc.text(workOrder.vehicle?.customers?.phone || '', 20, currentY + 22);
        if (workOrder.vehicle?.customers?.address) doc.text(workOrder.vehicle.customers.address, 20, currentY + 28);

        doc.roundedRect((pageWidth / 2) + 5, currentY, (pageWidth / 2) - 20, 35, 3, 3, 'FD');
        doc.setFont('helvetica', 'bold'); doc.setTextColor(41, 128, 185);
        doc.text("VEHICLE DETAILS", (pageWidth / 2) + 10, currentY + 8);
        doc.setTextColor(0, 0, 0);
        doc.text(workOrder.vehicle?.vehicle_number || 'Unknown', (pageWidth / 2) + 10, currentY + 16);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
        doc.text(`${workOrder.vehicle?.model || ''}`, (pageWidth / 2) + 10, currentY + 22);

        currentY += 45;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(39, 60, 117);
        doc.text("I. SERVICE BILL", 15, currentY);
        currentY += 5;

        const serviceStartPage = doc.getNumberOfPages();
        autoTable(doc, {
            head: [['S.No', 'Particulars', 'HSN', 'Taxable', 'GST%', 'CGST', 'SGST', 'Total']],
            body: serviceItems.map((s, idx) => [idx + 1, s.description || 'Service', s.hsn_code || '-', (s.taxable_value || 0).toFixed(2), `${s.gst_rate || 18}%`, (s.cgst_amount || 0).toFixed(2), (s.sgst_amount || 0).toFixed(2), (s.total || 0).toFixed(2)]),
            startY: currentY,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255 },
            styles: { fontSize: 8 },
            margin: { top: 45 },
            didDrawPage: (data) => {
                if (data.pageNumber > serviceStartPage) {
                    drawHeader(doc, true);
                }
            },
            columnStyles: { 0: { cellWidth: 10 }, 3: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } }
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;
        drawSectionSummary(doc, currentY, serviceTotals, "Service Bill");

        // --- PAGE 2: INVENTORY BILL ---
        if (partItems.length > 0) {
            doc.addPage();
            drawHeader(doc, true);
            const partStartPage = doc.getNumberOfPages();
            currentY = 50;
            doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(39, 60, 117);
            doc.text("II. INVENTORY BILL", 15, currentY);
            currentY += 5;

            autoTable(doc, {
                head: [['S.No', 'Particulars', 'HSN', 'Taxable', 'GST%', 'CGST', 'SGST', 'Total']],
                body: partItems.map((p, idx) => [idx + 1, p.description || 'Part', p.hsn_code || '-', (p.taxable_value || 0).toFixed(2), `${p.gst_rate || 18}%`, (p.cgst_amount || 0).toFixed(2), (p.sgst_amount || 0).toFixed(2), (p.total || 0).toFixed(2)]),
                startY: currentY,
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185], textColor: 255 },
                styles: { fontSize: 8 },
                margin: { top: 45 },
                didDrawPage: (data) => {
                    if (data.pageNumber > partStartPage) {
                        drawHeader(doc, true);
                    }
                },
                columnStyles: { 0: { cellWidth: 10 }, 3: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } }
            });
            currentY = (doc as any).lastAutoTable.finalY + 10;
            drawSectionSummary(doc, currentY, partTotals, "Inventory Bill");
        }

        // --- PAGE 3: CONSOLIDATED SUMMARY ---
        doc.addPage();
        drawHeader(doc, true);
        currentY = 50;

        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(39, 60, 117);
        doc.text("SUMMARY & FINAL SETTLEMENT", 15, currentY);
        currentY += 15;

        // Simple breakdown
        doc.setFontSize(10); doc.setTextColor(50, 50, 50);
        doc.text("1. Total Service Amount:", 15, currentY);
        doc.text(`Rs. ${serviceTotals.total.toFixed(2)}`, pageWidth - 15, currentY, { align: 'right' });
        currentY += 8;
        doc.text("2. Total Inventory Amount:", 15, currentY);
        doc.text(`Rs. ${partTotals.total.toFixed(2)}`, pageWidth - 15, currentY, { align: 'right' });
        currentY += 15;

        // Grand Total Box
        doc.setFillColor(245, 245, 245);
        doc.rect(15, currentY, pageWidth - 30, 20, 'F');
        doc.setFontSize(14); doc.setTextColor(39, 60, 117);
        doc.text("GRAND TOTAL AMOUNT:", 20, currentY + 13);
        doc.text(`Rs. ${finalTotal.toFixed(2)}`, pageWidth - 20, currentY + 13, { align: 'right' });
        currentY += 30;

        if (type === 'invoice' && settings.show_taxes && !isQuotation) {
            // Bank Details
            doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text("BANK ACCOUNT DETAILS", 15, currentY);
            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
            doc.text(`A/C Name: ${company.acc_name || company.company_name}`, 15, currentY + 7);
            doc.text(`A/C No: ${company.acc_number || '-'}   Bank: ${company.bank_name || '-'}`, 15, currentY + 12);
            doc.text(`IFSC: ${company.ifsc || '-'}   UPI ID: ${company.upi_id || '-'}`, 15, currentY + 17);

            // Tax Summary Table
            const sumTaxable = finalItems.reduce((acc, i) => acc + (i.taxable_value || 0), 0);
            const sumCGST = finalItems.reduce((acc, i) => acc + (i.cgst_amount || 0), 0);
            const sumSGST = finalItems.reduce((acc, i) => acc + (i.sgst_amount || 0), 0);

            autoTable(doc, {
                head: [['Tax Details', 'Amount']],
                body: [['Total Taxable Value', sumTaxable.toFixed(2)], ['Total CGST Amount', sumCGST.toFixed(2)], ['Total SGST Amount', sumSGST.toFixed(2)]],
                startY: currentY, margin: { left: pageWidth - 80 }, tableWidth: 65, theme: 'grid',
                headStyles: { fillColor: [240, 240, 240], textColor: 50 }, styles: { fontSize: 8, halign: 'right' }, columnStyles: { 0: { halign: 'left' } }
            });
            currentY += 30;
        }

        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
        doc.text(`In Words: Rupees ${toWords.convert(finalTotal)}`, 15, currentY);

        drawFooter(doc);

        const fileName = `${settings.title}_${billNumberDisplay.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        if (action === 'preview') window.open(doc.output('bloburl'), '_blank');
        else doc.save(fileName);

    } catch (error) {
        console.error("PDF Generation failed:", error);
        throw error;
    }
};
