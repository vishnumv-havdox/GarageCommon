import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';

export const generateWorkSlipPDF = async (workOrderId: string) => {
    // ... (existing logic - using the one we already wrote)
    return generateDocument(workOrderId, 'work_slip');
};

export const generateInvoicePDF = async (workOrderId: string) => {
    return generateDocument(workOrderId, 'invoice');
};

const generateDocument = async (workOrderId: string, type: 'work_slip' | 'invoice') => {
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
        vehicle:vehicles(
          vehicle_number, model, kilometers_driven, next_service_km, fc_expiry_date,
          customers(name, phone, address)
        )
      `).eq('id', workOrderId).single(),
            supabase.from('work_order_services').select('*').eq('work_order_id', workOrderId),
            supabase.from('invoices').select('*').eq('work_order_id', workOrderId).single()
        ]);

        if (!workOrder) throw new Error("Work Order not found");

        // If generating invoice, check if we have specific invoice items
        // If generating invoice, check if we have specific invoice items
        let finalItems: any[] = services || [];
        let billNumberDisplay = `NO: ${type === 'invoice' ? 'INV-' : 'WS-'}${workOrder.id.slice(0, 6).toUpperCase()}`;
        let finalSubtotal = 0;
        let finalTax = 0;
        let finalTotal = 0;

        if (type === 'invoice' && invoiceData) {
            // Fetch invoice items
            const { data: invItems } = await supabase
                .from('invoice_items')
                .select('*')
                .eq('invoice_id', invoiceData.id);

            if (invItems && invItems.length > 0) {
                // Map invoice items to the structure we need for table
                finalItems = invItems.map(item => ({
                    service_type: item.description,
                    estimated_cost: item.total // Use total as cost for display
                }));

                // Use invoice totals
                finalSubtotal = invoiceData.subtotal;
                finalTax = invoiceData.tax;
                finalTotal = invoiceData.total;

                // Use Bill Number or Quotation Number if available
                if (invoiceData.type === 'quotation' && invoiceData.quotation_number) {
                    billNumberDisplay = `QTN: ${invoiceData.quotation_number}`;
                } else if (invoiceData.bill_number) {
                    billNumberDisplay = `BILL NO: ${invoiceData.bill_number}`;
                }
            } else {
                // Fallback to services if invoice exists but has no items (rare)
                // Calculate defaults from services
                finalSubtotal = (services || []).reduce((sum: number, s: any) => sum + (s.estimated_cost || 0), 0);
                finalTax = finalSubtotal * 0.18; // Default fallback
                finalTotal = finalSubtotal + finalTax;
            }
        } else {
            // Work Slip or No Invoice Record - use Work Order Data
            finalSubtotal = (services || []).reduce((sum: number, s: any) => sum + (s.estimated_cost || 0), 0);
            finalTax = finalSubtotal * 0.18;
            finalTotal = finalSubtotal + finalTax;
        }


        const settings = settingsData || {
            title: type === 'invoice' ? 'TAX INVOICE' : 'WORK SLIP',
            prefix: type === 'invoice' ? 'INV-' : 'WS-',
            show_rates: true,
            show_taxes: true
        };

        const company = profile || {
            company_name: 'Amma Auto Service',
            address: '',
            phone: ''
        };

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;

        // --- Premium Header Design ---
        // Top Bar
        doc.setFillColor(41, 128, 185); // Amma Auto Blue (adjust as needed)
        if (type === 'invoice') doc.setFillColor(39, 60, 117); // Darker for Invoice

        doc.rect(0, 0, pageWidth, 40, 'F');

        // Company Name (White)
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(company.company_name.toUpperCase(), 15, 18);

        // Document Title (Right aligned in header)
        doc.setFontSize(30);
        doc.setTextColor(255, 255, 255);
        doc.text(settings.title || (type === 'invoice' ? 'INVOICE' : 'WORK SLIP'), pageWidth - 15, 28, { align: 'right' });

        // Header Details (Address below name)
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(240, 240, 240);
        doc.text(company.address || '', 15, 26);
        doc.text(`Phone: ${company.phone || ''}`, 15, 31);
        // if (company.email) doc.text(company.email, 15, 36);

        // --- Meta Info Bar (Gray) ---
        doc.setFillColor(245, 245, 245);
        doc.rect(0, 40, pageWidth, 25, 'F');

        doc.setTextColor(50, 50, 50);
        doc.setFontSize(10);

        // Left: ID and Date
        doc.setFont('helvetica', 'bold');
        doc.text(billNumberDisplay, 15, 52);
        doc.setFont('helvetica', 'normal');
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 15, 58);

        // Middle: Delivery
        if (workOrder.estimated_delivery_date) {
            doc.setFont('helvetica', 'bold');
            doc.text("Estimated Delivery:", pageWidth / 2, 52, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.text(new Date(workOrder.estimated_delivery_date).toLocaleString(), pageWidth / 2, 58, { align: 'center' });
        }

        // --- Customer & Vehicle Cards ---
        const startY = 75;

        // Customer Box
        doc.setDrawColor(220, 220, 220);
        doc.setFillColor(252, 252, 252);
        doc.roundedRect(15, startY, (pageWidth / 2) - 20, 35, 3, 3, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(41, 128, 185);
        doc.text("CUSTOMER", 20, startY + 8);

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.text(workOrder.vehicle?.customers?.name || 'Unknown', 20, startY + 16);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text(workOrder.vehicle?.customers?.phone || '', 20, startY + 22);
        if (workOrder.vehicle?.customers?.address) {
            doc.text(workOrder.vehicle.customers.address, 20, startY + 28);
        }

        // Vehicle Box
        doc.setDrawColor(220, 220, 220);
        doc.setFillColor(252, 252, 252);
        doc.roundedRect((pageWidth / 2) + 5, startY, (pageWidth / 2) - 20, 35, 3, 3, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(41, 128, 185);
        doc.text("VEHICLE DETAILS", (pageWidth / 2) + 10, startY + 8);

        doc.setTextColor(0, 0, 0);
        doc.text(workOrder.vehicle?.vehicle_number || 'Unknown', (pageWidth / 2) + 10, startY + 16);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text(`${workOrder.vehicle?.model || ''}`, (pageWidth / 2) + 10, startY + 22);

        let kmText = "";
        if (workOrder.vehicle?.kilometers_driven) kmText += `KM: ${workOrder.vehicle.kilometers_driven}  `;
        doc.text(kmText, (pageWidth / 2) + 10, startY + 28);


        // --- Table ---
        // Define columns
        let tableHead = [['#', 'Description']];
        if (settings.show_rates) tableHead[0].push('Amount');

        // Define body
        // Define body with grouping
        let tableBody: any[] = [];

        // 1. Group items by category
        const groupedItems: Record<string, any[]> = {};

        finalItems.forEach((item: any) => {
            const cat = item.category || 'General';
            if (!groupedItems[cat]) groupedItems[cat] = [];
            groupedItems[cat].push(item);
        });

        // 2. Iterate categories and build rows
        const sortedCategories = Object.keys(groupedItems).sort();
        let runningIndex = 1;

        sortedCategories.forEach(category => {
            // Add Category Header Row (if more than 1 category or just to be explicit)
            if (sortedCategories.length > 0) {
                tableBody.push([{ content: category.toUpperCase(), colSpan: settings.show_rates ? 3 : 2, styles: { fillColor: [240, 240, 240], fontStyle: 'bold', textColor: 50 } }]);
            }

            groupedItems[category].forEach(s => {
                const row = [
                    (runningIndex++).toString(),
                    s.service_type || s.description || 'Item',
                ];
                if (settings.show_rates) {
                    row.push(Number(s.estimated_cost || s.total || s.unit_price * s.quantity || 0).toFixed(2));
                }
                tableBody.push(row);
            });
        });

        const tableStartY = startY + 45;

        autoTable(doc, {
            head: tableHead,
            body: tableBody,
            startY: tableStartY,
            theme: 'striped',
            headStyles: {
                fillColor: type === 'invoice' ? [39, 60, 117] : [41, 128, 185],
                textColor: 255,
                fontStyle: 'bold',
                halign: 'left'
            },
            styles: {
                fontSize: 10,
                cellPadding: 4,
                textColor: 50
            },
            columnStyles: {
                0: { cellWidth: 15 },
                [settings.show_rates ? 2 : 99]: { halign: 'right' }
            },
            alternateRowStyles: {
                fillColor: [245, 248, 250]
            }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;

        // --- Totals Section ---
        if (settings.show_rates) {

            // Draw a colored background for total
            doc.setFillColor(250, 250, 250);
            doc.roundedRect(pageWidth - 80, finalY, 65, 30, 2, 2, 'F');

            doc.setFontSize(10);
            doc.setTextColor(80, 80, 80);
            doc.text(`Subtotal:`, pageWidth - 40, finalY + 8, { align: 'right' });
            doc.text(`${finalSubtotal.toFixed(2)}`, pageWidth - 20, finalY + 8, { align: 'right' });

            if (settings.show_taxes) {
                doc.text(`Tax:`, pageWidth - 40, finalY + 14, { align: 'right' });
                doc.text(`${finalTax.toFixed(2)}`, pageWidth - 20, finalY + 14, { align: 'right' });
            }

            doc.setDrawColor(200, 200, 200);
            doc.line(pageWidth - 75, finalY + 18, pageWidth - 15, finalY + 18);

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(39, 60, 117);
            doc.text(`Total:`, pageWidth - 40, finalY + 26, { align: 'right' });
            doc.text(`${finalTotal.toFixed(2)}`, pageWidth - 20, finalY + 26, { align: 'right' });
        }

        // --- Footer & Terms ---
        let footerY = pageHeight - 50;

        // Terms
        if (settings.terms_and_conditions) {
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text("Terms & Conditions:", 15, footerY - 10);
            const terms = doc.splitTextToSize(settings.terms_and_conditions, pageWidth - 30);
            doc.text(terms, 15, footerY - 5);
        }

        // Signatures Area
        doc.setDrawColor(200, 200, 200);
        doc.line(15, footerY + 25, 70, footerY + 25);
        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);
        doc.text("Customer Signature", 15, footerY + 30);

        doc.line(pageWidth - 70, footerY + 25, pageWidth - 15, footerY + 25);
        doc.text("Authorized Signature", pageWidth - 15, footerY + 30, { align: 'right' });

        // Bottom Bar
        doc.setFillColor(39, 60, 117);
        doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');
        if (settings.footer_text) {
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.text(settings.footer_text, pageWidth / 2, pageHeight - 4, { align: 'center' });
        }

        doc.save(`${settings.title}_${billNumberDisplay.replace(/[^a-z0-9]/gi, '_')}.pdf`);

    } catch (error) {
        console.error("PDF Generation failed:", error);
        throw error;
    }
};
