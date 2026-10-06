import { format } from "date-fns";

export interface LedgerMap {
  salesLedger: string;
  cgstLedger: string;
  sgstLedger: string;
  igstLedger: string;
  roundOffLedger: string;
  bankLedger: string;
}

export function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return unsafe.toString().replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

/**
 * Generates Tally XML for Customer Ledgers (Sundry Debtors)
 */
export function generateCustomersXml(customers: any[]): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
`;

  customers.forEach((c) => {
    const partyName = escapeXml(c.company_name || c.name || "Unknown Customer");
    const mailingName = escapeXml(c.name || c.company_name || partyName);
    const address = escapeXml(c.address || "");
    const phone = escapeXml(c.phone || "");
    const email = escapeXml(c.email || "");
    const gstin = escapeXml(c.gst_number || "");

    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${partyName}" ACTION="Create">
            <NAME.LIST>
              <NAME>${partyName}</NAME>
            </NAME.LIST>
            <PARENT>Sundry Debtors</PARENT>
            <ISBILLWISEON>Yes</ISBILLWISEON>
            <AFFECTSSTOCK>No</AFFECTSSTOCK>
            <MAILINGNAME.LIST>
              <MAILINGNAME>${mailingName}</MAILINGNAME>
            </MAILINGNAME.LIST>
            ${address ? `<ADDRESS.LIST><ADDRESS>${address}</ADDRESS></ADDRESS.LIST>` : ""}
            ${phone ? `<LEDGERPHONE>${phone}</LEDGERPHONE>` : ""}
            ${email ? `<EMAIL>${email}</EMAIL>` : ""}
            ${
              gstin
                ? `<PARTYGSTIN>${gstin}</PARTYGSTIN><GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>`
                : `<GSTREGISTRATIONTYPE>Unregistered</GSTREGISTRATIONTYPE>`
            }
          </LEDGER>
        </TALLYMESSAGE>
`;
  });

  xml += `      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
  return xml;
}

/**
 * Generates Tally XML for Sales and Receipt Vouchers
 */
export function generateVouchersXml(
  invoices: any[],
  ledgerMap: LedgerMap,
  exportType: "sales" | "receipts"
): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
`;

  invoices.forEach((inv) => {
    const partyName = escapeXml(inv.customer?.company_name || inv.customer?.name || "Cash");
    const invoiceDate = format(new Date(inv.created_at), "yyyyMMdd");
    const vchNo = escapeXml(inv.bill_number ? `Bill-${inv.bill_number}` : inv.invoice_number);

    const subtotal = Number(inv.subtotal) || 0;
    const taxTotal = Number(inv.tax) || 0;
    const cgst = Number((taxTotal / 2).toFixed(2));
    const sgst = Number((taxTotal / 2).toFixed(2));
    const total = Number(inv.total) || 0;
    const roundOff = Number((total - (subtotal + taxTotal)).toFixed(2));

    const vehicleInfo = inv.work_order?.vehicle
      ? `(Vehicle: ${inv.work_order.vehicle.vehicle_number} ${inv.work_order.vehicle.model || ""})`
      : "";
    const narration = escapeXml(`Invoice ${vchNo} ${vehicleInfo}`.trim());

    if (exportType === "sales") {
      xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>${invoiceDate}</DATE>
            <VOUCHERNUMBER>${vchNo}</VOUCHERNUMBER>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <PARTYLEDGERNAME>${partyName}</PARTYLEDGERNAME>
            <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
            <NARRATION>${narration}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${partyName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${total.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(ledgerMap.salesLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${subtotal.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;
      if (cgst > 0) {
        xml += `            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(ledgerMap.cgstLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${cgst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;
      }
      if (sgst > 0) {
        xml += `            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(ledgerMap.sgstLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${sgst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;
      }
      if (roundOff !== 0) {
        const isDeemedPos = roundOff < 0 ? "Yes" : "No";
        xml += `            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(ledgerMap.roundOffLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${isDeemedPos}</ISDEEMEDPOSITIVE>
              <AMOUNT>${roundOff.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;
      }
      xml += `          </VOUCHER>
        </TALLYMESSAGE>
`;
    } else {
      // Receipts
      xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Receipt" ACTION="Create">
            <DATE>${invoiceDate}</DATE>
            <VOUCHERNUMBER>RCPT-${vchNo}</VOUCHERNUMBER>
            <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
            <PARTYLEDGERNAME>${escapeXml(ledgerMap.bankLedger)}</PARTYLEDGERNAME>
            <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
            <NARRATION>Payment received for invoice ${vchNo}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(ledgerMap.bankLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${total.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${partyName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${total.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
`;
    }
  });

  xml += `      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
  return xml;
}

/**
 * Generates Columnar CSV for Excel / Audit
 */
export function generateColumnarCsv(
  invoices: any[],
  ledgerMap: LedgerMap,
  exportType: "sales" | "receipts"
): string {
  const headers = [
    "Date",
    "Voucher No",
    "Voucher Type",
    "Party Ledger Name",
    "Sales Ledger Name",
    "Taxable Value",
    "CGST Ledger",
    "CGST Amount",
    "SGST Ledger",
    "SGST Amount",
    "IGST Ledger",
    "IGST Amount",
    "Round Off Ledger",
    "Round Off Amount",
    "Gross Total",
    "Narration",
  ];

  const rows = invoices.map((inv) => {
    const partyName = inv.customer?.company_name || inv.customer?.name || "Cash";
    const invoiceDate = format(new Date(inv.created_at), "dd-MM-yyyy");
    const vchNo = inv.bill_number ? `Bill-${inv.bill_number}` : inv.invoice_number;

    const subtotal = inv.subtotal || 0;
    const taxTotal = inv.tax || 0;
    const cgst = Number((taxTotal / 2).toFixed(2));
    const sgst = Number((taxTotal / 2).toFixed(2));
    const total = inv.total || 0;
    const roundOff = Number((total - (subtotal + taxTotal)).toFixed(2));
    const vehicleInfo = inv.work_order?.vehicle
      ? `(Vehicle: ${inv.work_order.vehicle.vehicle_number} ${inv.work_order.vehicle.model || ""})`
      : "";
    const narration = `Sales Invoice ${vchNo} ${vehicleInfo}`.trim();

    if (exportType === "sales") {
      return [
        invoiceDate,
        vchNo,
        "Sales",
        partyName,
        ledgerMap.salesLedger,
        subtotal.toFixed(2),
        ledgerMap.cgstLedger,
        cgst.toFixed(2),
        ledgerMap.sgstLedger,
        sgst.toFixed(2),
        ledgerMap.igstLedger,
        "0.00",
        ledgerMap.roundOffLedger,
        roundOff.toFixed(2),
        total.toFixed(2),
        narration,
      ];
    } else {
      return [
        invoiceDate,
        `RCPT-${vchNo}`,
        "Receipt",
        partyName,
        ledgerMap.bankLedger,
        total.toFixed(2),
        "", "", "", "", "", "", "", "",
        total.toFixed(2),
        `Payment received for ${vchNo}`,
      ];
    }
  });

  return [headers.join(","), ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
}

/**
 * Generates Multi-Row Journal CSV for Tally
 */
export function generateMultiRowCsv(
  invoices: any[],
  ledgerMap: LedgerMap,
  exportType: "sales" | "receipts"
): string {
  const headers = ["Date", "Voucher No", "Voucher Type", "Ledger Name", "Debit Amount", "Credit Amount", "Narration"];
  const rows: any[] = [];

  invoices.forEach((inv) => {
    const partyName = inv.customer?.company_name || inv.customer?.name || "Cash";
    const invoiceDate = format(new Date(inv.created_at), "dd-MM-yyyy");
    const vchNo = inv.bill_number ? `Bill-${inv.bill_number}` : inv.invoice_number;

    const subtotal = inv.subtotal || 0;
    const taxTotal = inv.tax || 0;
    const cgst = Number((taxTotal / 2).toFixed(2));
    const sgst = Number((taxTotal / 2).toFixed(2));
    const total = inv.total || 0;
    const roundOff = Number((total - (subtotal + taxTotal)).toFixed(2));

    const vehicleInfo = inv.work_order?.vehicle
      ? `(Vehicle: ${inv.work_order.vehicle.vehicle_number} ${inv.work_order.vehicle.model || ""})`
      : "";
    const narration = `Invoice ${vchNo} ${vehicleInfo}`.trim();

    if (exportType === "sales") {
      rows.push([invoiceDate, vchNo, "Sales", partyName, total.toFixed(2), "0.00", narration]);
      rows.push([invoiceDate, vchNo, "Sales", ledgerMap.salesLedger, "0.00", subtotal.toFixed(2), narration]);
      if (cgst > 0) {
        rows.push([invoiceDate, vchNo, "Sales", ledgerMap.cgstLedger, "0.00", cgst.toFixed(2), narration]);
      }
      if (sgst > 0) {
        rows.push([invoiceDate, vchNo, "Sales", ledgerMap.sgstLedger, "0.00", sgst.toFixed(2), narration]);
      }
      if (roundOff !== 0) {
        const dr = roundOff < 0 ? Math.abs(roundOff).toFixed(2) : "0.00";
        const cr = roundOff > 0 ? roundOff.toFixed(2) : "0.00";
        rows.push([invoiceDate, vchNo, "Sales", ledgerMap.roundOffLedger, dr, cr, narration]);
      }
    } else {
      rows.push([invoiceDate, `RCPT-${vchNo}`, "Receipt", ledgerMap.bankLedger, total.toFixed(2), "0.00", `Payment recd for ${vchNo}`]);
      rows.push([invoiceDate, `RCPT-${vchNo}`, "Receipt", partyName, "0.00", total.toFixed(2), `Payment recd for ${vchNo}`]);
    }
  });

  return [headers.join(","), ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
}

export interface TallySyncResult {
  success: boolean;
  created: number;
  altered: number;
  errors: number;
  errorMessage?: string;
  rawResponse?: string;
}

/**
 * Sends XML to Tally Prime over HTTP (trying proxy or direct endpoint)
 */
export async function sendXmlToTally(
  xmlContent: string,
  targetUrl: string = "http://localhost:9000",
  preferProxy: boolean = true
): Promise<TallySyncResult> {
  const endpointsToTry: string[] = [];

  // If local dev environment, try the vite proxy endpoint first to bypass any CORS restrictions
  if (preferProxy && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    endpointsToTry.push("/tally-proxy");
  }
  endpointsToTry.push(targetUrl);

  let lastError = "";

  for (const endpoint of endpointsToTry) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
        },
        body: xmlContent,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        lastError = `HTTP ${response.status}: ${response.statusText}`;
        continue;
      }

      const text = await response.text();
      return parseTallyResponse(text);
    } catch (err: any) {
      if (err.name === "AbortError") {
        lastError = "Connection to Tally timed out after 12s.";
      } else {
        lastError = err.message || "Failed to reach Tally HTTP server.";
      }
    }
  }

  return {
    success: false,
    created: 0,
    altered: 0,
    errors: 1,
    errorMessage: lastError,
  };
}

/**
 * Test Tally connectivity & read active company name
 */
export async function testTallyConnection(
  targetUrl: string = "http://localhost:9000"
): Promise<{ connected: boolean; companyName?: string; error?: string }> {
  const pingXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Companies</REPORTNAME>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  const result = await sendXmlToTally(pingXml, targetUrl, true);

  if (result.success || result.rawResponse) {
    const raw = result.rawResponse || "";
    // Try extract company name from response
    const match = raw.match(/<COMPANY>(.*?)<\/COMPANY>/i) || raw.match(/<NAME>(.*?)<\/NAME>/i);
    const companyName = match ? match[1] : undefined;
    return {
      connected: true,
      companyName,
    };
  }

  return {
    connected: false,
    error: result.errorMessage || "Unable to reach Tally Prime on port 9000",
  };
}

/**
 * Parses Tally XML Response Envelope
 */
function parseTallyResponse(responseText: string): TallySyncResult {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(responseText, "text/xml");

    const created = parseInt(xmlDoc.getElementsByTagName("CREATED")[0]?.textContent || "0", 10);
    const altered = parseInt(xmlDoc.getElementsByTagName("ALTERED")[0]?.textContent || "0", 10);
    const errors = parseInt(xmlDoc.getElementsByTagName("ERRORS")[0]?.textContent || "0", 10);

    const lineErrors: string[] = [];
    const lineErrorNodes = xmlDoc.getElementsByTagName("LINEERROR");
    for (let i = 0; i < lineErrorNodes.length; i++) {
      const msg = lineErrorNodes[i]?.textContent?.trim();
      if (msg) lineErrors.push(msg);
    }

    const hasSuccess = (created > 0 || altered > 0) && errors === 0;

    return {
      success: hasSuccess,
      created,
      altered,
      errors,
      errorMessage: lineErrors.length > 0 ? lineErrors.join(" | ") : (errors > 0 ? "Voucher import was rejected by Tally." : undefined),
      rawResponse: responseText,
    };
  } catch (err: any) {
    // If response was non-XML but 200, or parser failed
    return {
      success: false,
      created: 0,
      altered: 0,
      errors: 1,
      errorMessage: "Could not parse response from Tally: " + err.message,
      rawResponse: responseText,
    };
  }
}

/**
 * Helper to download content as a file
 */
export function downloadFile(content: string, filename: string, contentType: string) {
  const blob = new Blob([content], { type: `${contentType};charset=utf-8;` });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
