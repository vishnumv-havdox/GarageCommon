import os
import base64
import subprocess

WORKSPACE = "/home/ai/Desktop/vishnu/AmmaAuto/amma-drive-flow"
LOGO_PATH = os.path.join(WORKSPACE, "public/logo.png")
OUTPUT_HTML = os.path.join(WORKSPACE, "docs/DriveFlow_Commercial_Proposal_HavDox.html")
OUTPUT_PDF = os.path.join(WORKSPACE, "docs/DriveFlow_Commercial_Proposal_HavDox.pdf")

with open(LOGO_PATH, "rb") as f:
    logo_base64 = base64.b64encode(f.read()).decode("utf-8")

logo_data_uri = f"data:image/png;base64,{logo_base64}"

html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>DriveFlow - Commercial Proposal & Feature Specifications</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page {{
    size: A4 portrait;
    margin: 0;
  }}
  *, *::before, *::after {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }}
  html, body {{
    background-color: #F4F4F5;
    color: #18181B;
    font-family: 'Inter', sans-serif;
    font-size: 9.8pt;
    line-height: 1.48;
    font-weight: 400;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }}

  /* Page Wrapper - Exactly 210mm x 297mm A4 */
  .page {{
    width: 210mm;
    height: 297mm;
    min-height: 297mm;
    max-height: 297mm;
    padding: 14mm 16mm 14mm 16mm;
    margin: 0 auto;
    background: #FFFFFF;
    page-break-after: always;
    page-break-inside: avoid;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
  }}

  @media screen {{
    .page {{
      margin: 20px auto;
      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
      border-radius: 4px;
    }}
  }}

  /* Typography - Black & White Aesthetic */
  h1, h2, h3, h4 {{
    font-family: 'Outfit', sans-serif;
    color: #000000;
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: -0.015em;
  }}
  h1 {{ font-size: 19pt; }}
  h2 {{ font-size: 12.5pt; margin-bottom: 5px; }}
  h3 {{ font-size: 10.5pt; font-weight: 600; }}
  p {{ margin-bottom: 5px; color: #18181B; }}
  .font-mono {{ font-family: 'JetBrains Mono', monospace; font-size: 8.5pt; }}
  .text-muted {{ color: #71717A; }}
  .text-black {{ color: #000000; }}
  .font-semibold {{ font-weight: 600; }}
  .font-bold {{ font-weight: 700; }}

  /* Header Specification with Motto */
  .doc-header {{
    width: 100%;
    padding-bottom: 8px;
    border-bottom: 1px solid #E4E4E7;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }}
  .doc-header .header-left {{
    display: flex;
    align-items: center;
    gap: 12px;
  }}
  .doc-header .header-logo {{
    height: 38px;
    width: auto;
    object-fit: contain;
    display: block;
  }}
  .doc-header .company-meta {{
    border-left: 1.5px solid #E4E4E7;
    padding-left: 12px;
    height: 24px;
    display: flex;
    align-items: center;
  }}
  .doc-header .company-motto {{
    font-size: 8pt;
    color: #71717A;
    font-weight: 500;
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.02em;
  }}
  .doc-header .header-right {{
    text-align: right;
    font-size: 8.5pt;
    color: #71717A;
    line-height: 1.35;
  }}
  .doc-header .header-right strong {{
    color: #000000;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8pt;
  }}

  /* Footer Specification */
  .doc-footer {{
    width: 100%;
    padding-top: 7px;
    border-top: 1px solid #E4E4E7;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 7.8pt;
    color: #71717A;
    flex-shrink: 0;
  }}
  .doc-footer .footer-left {{
    text-transform: uppercase;
    font-size: 7.2pt;
    letter-spacing: 0.05em;
    font-weight: 600;
    color: #71717A;
  }}
  .doc-footer .footer-center {{
    font-size: 7.8pt;
    color: #71717A;
  }}
  .doc-footer .footer-right {{
    text-align: right;
    font-weight: 600;
    color: #000000;
  }}

  /* Page Content Area */
  .page-body {{
    flex: 1;
    padding: 10px 0 8px 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }}

  /* Badges & Pills - Monochrome */
  .pill-badge {{
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2.5px 8.5px;
    border-radius: 4px;
    font-size: 7.2pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: #FFFFFF;
    color: #000000;
    border: 1px solid #000000;
  }}
  .badge-solid {{
    background: #000000;
    color: #FFFFFF;
    border: 1px solid #000000;
  }}

  /* Card Box */
  .card-box {{
    background: #FAFAFA;
    border: 1px solid #E4E4E7;
    border-radius: 6px;
    padding: 10px 13px;
    margin-bottom: 9px;
  }}

  /* Callout - Black Accent Line */
  .callout-box {{
    border-left: 3.5px solid #000000;
    background: #FAFAFA;
    border-top: 1px solid #E4E4E7;
    border-right: 1px solid #E4E4E7;
    border-bottom: 1px solid #E4E4E7;
    border-radius: 0 6px 6px 0;
    padding: 7px 11px;
    margin-bottom: 8px;
    font-size: 8.5pt;
  }}

  /* Tables - Monochrome */
  table.custom-table {{
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
    font-size: 8.2pt;
  }}
  table.custom-table th {{
    background: #000000;
    color: #FFFFFF;
    text-align: left;
    padding: 6px 9px;
    font-family: 'Outfit', sans-serif;
    font-weight: 600;
    font-size: 8.2pt;
    letter-spacing: 0.02em;
    border: 1px solid #000000;
  }}
  table.custom-table td {{
    padding: 5px 9px;
    border: 1px solid #E4E4E7;
    vertical-align: middle;
  }}
  table.custom-table tr:nth-child(even) td {{
    background: #FAFAFA;
  }}

  /* Matrix Table Specific Tight Padding */
  table.matrix-table th {{
    padding: 4px 7px;
    font-size: 7.8pt;
  }}
  table.matrix-table td {{
    padding: 3.2px 7px;
    font-size: 7.6pt;
  }}

  /* Grid Layouts */
  .grid-2 {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }}
  .grid-3 {{
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }}

  /* Bullet check-list */
  ul.check-list {{
    list-style: none;
    padding: 0;
    margin: 0;
  }}
  ul.check-list li {{
    position: relative;
    padding-left: 14px;
    margin-bottom: 4px;
    font-size: 8.2pt;
    color: #18181B;
  }}
  ul.check-list li::before {{
    content: "•";
    position: absolute;
    left: 2px;
    color: #000000;
    font-weight: bold;
    font-size: 11pt;
    line-height: 1;
  }}

  /* Signature Block */
  .signature-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 10px;
  }}
  .signature-card {{
    border: 1px solid #E4E4E7;
    background: #FAFAFA;
    border-radius: 6px;
    padding: 12px 14px;
  }}
  .signature-line {{
    margin-top: 26px;
    border-bottom: 1px dashed #71717A;
    margin-bottom: 6px;
  }}
</style>
</head>
<body>

<!-- ================= PAGE 1 ================= -->
<div class="page">
  <div class="doc-header">
    <div class="header-left">
      <img src="{logo_data_uri}" alt="HavDox Logo" class="header-logo">
      <div class="company-meta">
        <div class="company-motto">Imagine. Build. Go beyond.</div>
      </div>
    </div>
    <div class="header-right">
      <div>Reference: <strong>HDX-DF-2026-PROP</strong></div>
      <div>Date: <strong>October 7, 2026</strong></div>
      <div>Status: <strong>v1.0 | Official Commercial Proposal</strong></div>
    </div>
  </div>

  <div class="page-body">
    <!-- Title Banner -->
    <div style="margin-bottom: 10px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px;">
        <span class="pill-badge">Commercial Proposal & Technical Specifications</span>
        <span class="font-mono text-muted" style="font-size: 7.8pt;">Automotive Workshop Operating System</span>
      </div>
      <h1 style="font-size: 19pt;">DriveFlow — Enterprise Garage ERP</h1>
      <p style="font-size: 9.8pt; color: #71717A; margin-top: 2px;">
        A comprehensive digital workshop platform for automotive service centers, multi-brand garages, and fleet operations.
      </p>
    </div>

    <!-- Executive Summary Card -->
    <div class="card-box">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
        <h3 style="color: #000000; font-size: 10.5pt;">Executive Overview</h3>
        <span class="pill-badge badge-solid" style="font-size: 6.8pt;">Workshop OS</span>
      </div>
      <p style="font-size: 9pt; line-height: 1.45; color: #18181B; margin-bottom: 6px;">
        <strong>DriveFlow</strong> is a complete digital operating system engineered to eliminate manual paperwork, job card bottlenecks, and spare parts shrinkage in automotive workshops. From customer arrival, vehicle registration, and digital job card authoring to live bay progression, inventory control, GST invoicing, and Tally accounting sync, DriveFlow unifies every operational phase into a single intuitive system.
      </p>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 5px; padding-top: 5px; border-top: 1px solid #E4E4E7; font-size: 8.2pt;">
        <div><strong class="text-black">Zero Revenue Leakage:</strong> 100% billable parts & labor tracking.</div>
        <div><strong class="text-black">Live Workshop Floor:</strong> Real-time technician bay tracking.</div>
        <div><strong class="text-black">Tally & GST Compliant:</strong> Instant accounting voucher export.</div>
      </div>
    </div>

    <!-- Commercial Fare Division Models -->
    <div>
      <h2>Commercial Fare Division & Payment Models</h2>
      <p style="font-size: 8.8pt; color: #71717A; margin-bottom: 7px;">
        Workshops can choose from three flexible payment models based on cash flow and ownership preferences:
      </p>

      <div class="grid-3" style="margin-bottom: 9px;">
        <div class="card-box" style="margin-bottom: 0; padding: 9px;">
          <h4 style="font-size: 9pt; margin-bottom: 2px;">Model A: Monthly SaaS</h4>
          <p style="font-size: 7.8pt; color: #71717A; margin-bottom: 3px;">Pay-as-you-go subscription. Month-to-month commitment with zero long-term lock-in.</p>
          <div class="font-mono text-black font-semibold" style="font-size: 8.2pt;">Monthly Recurring Fare</div>
        </div>

        <div class="card-box" style="margin-bottom: 0; padding: 9px; border: 1.5px solid #000000; background: #FFFFFF;">
          <h4 style="font-size: 9pt; margin-bottom: 2px; color: #000000;">Model B: Annual SaaS</h4>
          <p style="font-size: 7.8pt; color: #71717A; margin-bottom: 3px;">Prepaid annual contract with <strong>2 months complimentary</strong> (~17% discount). Guaranteed uptime.</p>
          <div class="font-mono text-black font-bold" style="font-size: 8.2pt;">Best Value (Recommended)</div>
        </div>

        <div class="card-box" style="margin-bottom: 0; padding: 9px;">
          <h4 style="font-size: 9pt; margin-bottom: 2px;">Model C: One-Time Buyout</h4>
          <p style="font-size: 7.8pt; color: #71717A; margin-bottom: 3px;">Perpetual software license ownership. Includes 12 months support + optional Year 2+ AMC.</p>
          <div class="font-mono text-black font-semibold" style="font-size: 8.2pt;">Perpetual + 20% AMC</div>
        </div>
      </div>

      <!-- Pricing Comparison Table -->
      <table class="custom-table">
        <thead>
          <tr>
            <th style="width: 25%;">Plan Tier</th>
            <th style="width: 25%;">Monthly Subscription</th>
            <th style="width: 25%;">Annual Subscription (Prepaid)</th>
            <th style="width: 25%;">Perpetual License (One-Time)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Basic (Starter)</strong><br>
              <span class="text-muted" style="font-size: 7.2pt;">Up to 2 User Logins</span>
            </td>
            <td>
              <span class="font-mono font-semibold">INR 1,499</span> / month<br>
              <span class="text-muted" style="font-size: 7.2pt;">+ 18% GST</span>
            </td>
            <td>
              <span class="font-mono font-semibold text-black">INR 14,990</span> / year<br>
              <span class="text-muted" style="font-size: 7.2pt;">Effective INR 1,249/mo (Save 17%)</span>
            </td>
            <td>
              <span class="font-mono font-semibold">INR 45,000</span> (Full)<br>
              <span class="text-muted" style="font-size: 7.2pt;">Year 2+ AMC: INR 9,000/yr</span>
            </td>
          </tr>
          <tr>
            <td style="background: #F4F4F5;">
              <strong style="color: #000000;">Pro (Workshop Growth)</strong><br>
              <span class="pill-badge badge-solid" style="font-size: 6.2pt; padding: 1px 5px;">Hero Tier</span>
            </td>
            <td style="background: #F4F4F5;">
              <span class="font-mono font-semibold">INR 3,499</span> / month<br>
              <span class="text-muted" style="font-size: 7.2pt;">+ 18% GST</span>
            </td>
            <td style="background: #F4F4F5;">
              <span class="font-mono font-bold text-black">INR 34,990</span> / year<br>
              <span class="text-muted" style="font-size: 7.2pt;">Effective INR 2,915/mo (Save 17%)</span>
            </td>
            <td style="background: #F4F4F5;">
              <span class="font-mono font-semibold">INR 1,15,000</span> (Full)<br>
              <span class="text-muted" style="font-size: 7.2pt;">Year 2+ AMC: INR 23,000/yr</span>
            </td>
          </tr>
          <tr>
            <td>
              <strong>Pro Max (Enterprise)</strong><br>
              <span class="text-muted" style="font-size: 7.2pt;">Unlimited Logins & Multi-Branch</span>
            </td>
            <td>
              <span class="font-mono font-semibold">INR 6,999</span> / month<br>
              <span class="text-muted" style="font-size: 7.2pt;">+ 18% GST</span>
            </td>
            <td>
              <span class="font-mono font-semibold text-black">INR 69,990</span> / year<br>
              <span class="text-muted" style="font-size: 7.2pt;">Effective INR 5,832/mo (Save 17%)</span>
            </td>
            <td>
              <span class="font-mono font-semibold">INR 2,25,000</span> (Full)<br>
              <span class="text-muted" style="font-size: 7.2pt;">Year 2+ AMC: INR 45,000/yr</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="callout-box">
        <strong>Infrastructure Included:</strong> All cloud database storage, automated nightly backups, 256-bit SSL encryption, and software updates are fully included in the subscription fare with zero hidden server maintenance fees.
      </div>
    </div>
  </div>

  <div class="doc-footer">
    <div class="footer-left">CONFIDENTIAL & PROPRIETARY — HAVDOX</div>
    <div class="footer-center">havdox.in | havdoxofficial@gmail.com</div>
    <div class="footer-right">Page 1 of 5</div>
  </div>
</div>

<!-- ================= PAGE 2 ================= -->
<div class="page">
  <div class="doc-header">
    <div class="header-left">
      <img src="{logo_data_uri}" alt="HavDox Logo" class="header-logo">
      <div class="company-meta">
        <div class="company-motto">Imagine. Build. Go beyond.</div>
      </div>
    </div>
    <div class="header-right">
      <div>Reference: <strong>HDX-DF-2026-PROP</strong></div>
      <div>Date: <strong>October 7, 2026</strong></div>
      <div>Status: <strong>v1.0 | Official Commercial Proposal</strong></div>
    </div>
  </div>

  <div class="page-body">
    <div style="margin-bottom: 8px;">
      <span class="pill-badge">Tier Breakdown: Part 1</span>
      <h2 style="font-size: 14pt; margin-top: 2px;">Basic vs. Pro Plan — Technical Feature Analysis</h2>
      <p style="font-size: 8.5pt; color: #71717A;">Detailed evaluation of functional capabilities, target workshop size, and operational workflows.</p>
    </div>

    <!-- Tier 1: Basic -->
    <div class="card-box" style="margin-bottom: 10px; border-left: 3.5px solid #71717A;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
        <div>
          <h3 style="font-size: 11.5pt; color: #000000;">Tier 1: Basic (Starter Plan)</h3>
          <p style="font-size: 8pt; color: #71717A; margin-bottom: 0;">Designed for single-shutter auto workshops, 1–2 bay quick-service garages, and two-wheeler centers.</p>
        </div>
        <div style="text-align: right; min-width: 150px; flex-shrink: 0;">
          <div class="font-mono font-semibold text-black" style="font-size: 11pt; white-space: nowrap;">INR 1,499 / mo</div>
          <div class="font-mono text-muted" style="font-size: 7.5pt; white-space: nowrap;">or INR 14,990 / year</div>
        </div>
      </div>

      <div class="grid-2" style="font-size: 8.2pt; gap: 8px; margin-top: 4px;">
        <div>
          <strong class="text-black" style="display: block; margin-bottom: 3px;">Included Core Modules:</strong>
          <ul class="check-list">
            <li><strong>Customer Directory & CRM:</strong> Complete phone, email, and company lookup.</li>
            <li><strong>Vehicle Registration:</strong> Indian format plate badge previews, odometer, model/make.</li>
            <li><strong>Digital Job Card Creation:</strong> Standard check-in, complaint recording, status flags.</li>
            <li><strong>GST Invoicing & Billing:</strong> Professional A4 & thermal receipt PDF generator.</li>
            <li><strong>Payment Tracking:</strong> Record cash, UPI, card transactions per invoice.</li>
          </ul>
        </div>
        <div>
          <strong class="text-black" style="display: block; margin-bottom: 3px;">Service & Follow-up Modules:</strong>
          <ul class="check-list">
            <li><strong>Service Due Alerts:</strong> Odometer and date-based preventive maintenance tracker.</li>
            <li><strong>Reminders & Sticky Notes:</strong> Manual workshop task and follow-up logging.</li>
            <li><strong>Basic Dashboard:</strong> Daily vehicle check-in volume and revenue totals.</li>
            <li><strong>User Capacity:</strong> 2 Active Staff/Admin Accounts.</li>
            <li><span class="text-muted">Excluded: Live bay tracking, Inventory room, Tally, Customer portal.</span></li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Tier 2: Pro -->
    <div class="card-box" style="margin-bottom: 9px; border: 1.5px solid #000000; background: #FFFFFF;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <h3 style="font-size: 12.5pt; color: #000000;">Tier 2: Pro (Workshop Growth Plan)</h3>
            <span class="pill-badge badge-solid" style="font-size: 6.2pt;">Recommended Hero Tier</span>
          </div>
          <p style="font-size: 8pt; color: #71717A; margin-bottom: 0;">Designed for high-activity 3–8 bay workshops, bodyshops, and multi-brand centers handling 15–40 vehicles daily.</p>
        </div>
        <div style="text-align: right; min-width: 150px; flex-shrink: 0;">
          <div class="font-mono font-bold text-black" style="font-size: 11.5pt; white-space: nowrap;">INR 3,499 / mo</div>
          <div class="font-mono text-muted" style="font-size: 7.5pt; white-space: nowrap;">or INR 34,990 / year</div>
        </div>
      </div>

      <p style="font-size: 8.2pt; margin-bottom: 5px; font-weight: 500; color: #000000;">
        Includes ALL Basic features, PLUS advanced floor automation and inventory control:
      </p>

      <div class="grid-2" style="font-size: 8.2pt; gap: 8px;">
        <div>
          <strong class="text-black" style="display: block; margin-bottom: 3px;">Floor Automation & Appointments:</strong>
          <ul class="check-list">
            <li><strong>Live Bay Progression (/admin/progress):</strong> Visual workflow tracking across 6 bays (Arrived -> Inspection -> Spares Ordered -> In Repair -> QC -> Ready).</li>
            <li><strong>Admin Appointment Studio (/admin/appointments):</strong> Integrated calendar, slot booking, auto customer-vehicle linking, Indian plate search.</li>
            <li><strong>Technician Floor Terminal (/staff):</strong> Floor tablet terminal for mechanics to view assigned tasks, upload issue photos, and log work.</li>
            <li><strong>Customer Live Web Portal (/customer):</strong> End-customers track vehicle repair status, inspect photos, and view estimates from their smartphones.</li>
          </ul>
        </div>
        <div>
          <strong class="text-black" style="display: block; margin-bottom: 3px;">Parts, Accounts & Staff:</strong>
          <ul class="check-list">
            <li><strong>Spare Parts Inventory (/admin/inventory):</strong> Reorder alerts, supplier catalogs, margin computation, parts allocated directly to job cards.</li>
            <li><strong>Dedicated Inventory Room (/inventory/room):</strong> Standalone counter terminal for parts storekeepers to issue spares seamlessly.</li>
            <li><strong>Customer Credit Ledger (/admin/ledger):</strong> Running account statements, credit allowances, and partial receipt tracking.</li>
            <li><strong>Staff Attendance Logs (/admin/attendance):</strong> Daily punch records, active technician bay hours, overtime logs.</li>
            <li><strong>User Capacity:</strong> Up to 6 Active Staff/Admin Accounts.</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="callout-box" style="margin-bottom: 0;">
      <strong>Why Workshops Choose the Pro Tier:</strong> Live Bay Progression prevents vehicle bottlenecks in service bays, while the dedicated Inventory Counter eliminates the 8% to 15% revenue shrinkage typically lost to untracked workshop spares and fluids.
    </div>
  </div>

  <div class="doc-footer">
    <div class="footer-left">CONFIDENTIAL & PROPRIETARY — HAVDOX</div>
    <div class="footer-center">havdox.in | havdoxofficial@gmail.com</div>
    <div class="footer-right">Page 2 of 5</div>
  </div>
</div>

<!-- ================= PAGE 3 ================= -->
<div class="page">
  <div class="doc-header">
    <div class="header-left">
      <img src="{logo_data_uri}" alt="HavDox Logo" class="header-logo">
      <div class="company-meta">
        <div class="company-motto">Imagine. Build. Go beyond.</div>
      </div>
    </div>
    <div class="header-right">
      <div>Reference: <strong>HDX-DF-2026-PROP</strong></div>
      <div>Date: <strong>October 7, 2026</strong></div>
      <div>Status: <strong>v1.0 | Official Commercial Proposal</strong></div>
    </div>
  </div>

  <div class="page-body">
    <div style="margin-bottom: 8px;">
      <span class="pill-badge">Tier Breakdown: Part 2</span>
      <h2 style="font-size: 14pt; margin-top: 2px;">Pro Max (Enterprise) & Add-On Services</h2>
      <p style="font-size: 8.5pt; color: #71717A;">Multi-branch governance, financial compliance, and usage-based operational services.</p>
    </div>

    <!-- Tier 3: Pro Max -->
    <div class="card-box" style="margin-bottom: 10px; border: 1.5px solid #000000; background: #FFFFFF;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <h3 style="font-size: 12.5pt; color: #000000;">Tier 3: Pro Max (Enterprise & Multi-Branch Plan)</h3>
            <span class="pill-badge badge-solid" style="font-size: 6.2pt;">Full Enterprise Suite</span>
          </div>
          <p style="font-size: 8pt; color: #71717A; margin-bottom: 0;">Built for enterprise franchise chains, commercial vehicle fleet depots, and multi-location automotive groups.</p>
        </div>
        <div style="text-align: right; min-width: 150px; flex-shrink: 0;">
          <div class="font-mono font-bold text-black" style="font-size: 11.5pt; white-space: nowrap;">INR 6,999 / mo</div>
          <div class="font-mono text-muted" style="font-size: 7.5pt; white-space: nowrap;">or INR 69,990 / year</div>
        </div>
      </div>

      <p style="font-size: 8.2pt; margin-bottom: 5px; font-weight: 500; color: #000000;">
        Includes ALL Pro features, PLUS corporate accounting, HR payroll, and granular governance:
      </p>

      <div class="grid-2" style="font-size: 8.2pt; gap: 8px;">
        <div>
          <strong class="text-black" style="display: block; margin-bottom: 3px;">Accounting & Multi-Role Governance:</strong>
          <ul class="check-list">
            <li><strong>Tally Accounting Bridge (/admin/tally):</strong> One-click XML & Excel export for Tally ERP 9 and TallyPrime with automated GST tax classification and ledger mapping.</li>
            <li><strong>Granular RBAC (/admin/access-control):</strong> Define custom view/edit/delete authority per module (Receptionist, Technician, Storekeeper, Accountant, GM).</li>
            <li><strong>Executive Multi-Dimensional Analytics:</strong> Deep-dive technician productivity metrics, repeat turnaround times, and dead-stock depreciation.</li>
          </ul>
        </div>
        <div>
          <strong class="text-black" style="display: block; margin-bottom: 3px;">HR Payroll & Fleet Operations:</strong>
          <ul class="check-list">
            <li><strong>Salary & Payroll Engine (/admin/salary):</strong> Attendance-based salary calculations, advance deductions, overtime tracking, digital salary slips.</li>
            <li><strong>Employee Document Vault (/admin/employees):</strong> Aadhaar, driving license, and certification locker.</li>
            <li><strong>Commercial Fleet & FC Workflows:</strong> Fitness Certificate expiry alerts, chassis/engine number tracking, and fleet master profiles.</li>
            <li><strong>Global HUD & Sirens (GlobalAlarmModal):</strong> Audio-visual alarms for overdue repairs and high-priority vehicle arrivals.</li>
            <li><strong>User Capacity:</strong> <strong>Unlimited</strong> Staff, Technician, and Admin Accounts.</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Add-On Service Charges -->
    <div>
      <h2 style="font-size: 12pt;">Add-On Service Charges & Usage Packages</h2>
      <p style="font-size: 8.5pt; color: #71717A; margin-bottom: 6px;">
        Optional value-added services available across all plan tiers to enhance operations:
      </p>

      <table class="custom-table" style="margin-bottom: 6px; font-size: 8pt;">
        <thead>
          <tr>
            <th style="width: 25%;">Service Add-On</th>
            <th style="width: 20%;">Fare Structure</th>
            <th style="width: 55%;">Operational Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Onboarding & Data Setup</strong></td>
            <td><span class="font-mono">INR 4,999 - 12,000</span></td>
            <td>Dedicated engineer setup: historical customer/vehicle Excel migration, labor rate card configuration, A4/thermal printer mapping, and staff training.</td>
          </tr>
          <tr>
            <td><strong>WhatsApp Business API</strong></td>
            <td><span class="font-mono">INR 499 / 1,000 alerts</span></td>
            <td>Automated WhatsApp messages: appointment confirmations, live job card tracking links, digital invoice PDFs, and periodic service due reminders.</td>
          </tr>
          <tr>
            <td><strong>Transactional SMS Gateway</strong></td>
            <td><span class="font-mono">INR 250 / 1,000 SMS</span></td>
            <td>DLT-registered SMS for OTP logins, immediate status updates, and emergency alerts.</td>
          </tr>
          <tr>
            <td><strong>Additional Staff Seat</strong></td>
            <td><span class="font-mono">INR 199 / user / mo</span></td>
            <td>Add extra technician or counter user logins beyond tier allowances.</td>
          </tr>
          <tr>
            <td><strong>Custom Integration & Dev</strong></td>
            <td><span class="font-mono">INR 1,500 / billable hr</span></td>
            <td>Specialized development: custom ERP connectors, specialized parts supplier catalogs, or hardware integrations.</td>
          </tr>
        </tbody>
      </table>

      <div class="callout-box" style="margin-bottom: 0;">
        <strong>Prepaid Credit Policy:</strong> WhatsApp and SMS communication credits are prepaid and never expire. Workshop owners receive automatic low-balance alerts when credits dip below 150 messages.
      </div>
    </div>
  </div>

  <div class="doc-footer">
    <div class="footer-left">CONFIDENTIAL & PROPRIETARY — HAVDOX</div>
    <div class="footer-center">havdox.in | havdoxofficial@gmail.com</div>
    <div class="footer-right">Page 3 of 5</div>
  </div>
</div>

<!-- ================= PAGE 4 ================= -->
<div class="page">
  <div class="doc-header">
    <div class="header-left">
      <img src="{logo_data_uri}" alt="HavDox Logo" class="header-logo">
      <div class="company-meta">
        <div class="company-motto">Imagine. Build. Go beyond.</div>
      </div>
    </div>
    <div class="header-right">
      <div>Reference: <strong>HDX-DF-2026-PROP</strong></div>
      <div>Date: <strong>October 7, 2026</strong></div>
      <div>Status: <strong>v1.0 | Official Commercial Proposal</strong></div>
    </div>
  </div>

  <div class="page-body">
    <div style="margin-bottom: 6px;">
      <span class="pill-badge">Feature Entitlement Matrix</span>
      <h2 style="font-size: 14pt; margin-top: 2px;">Complete Page-by-Page Feature Mapping</h2>
      <p style="font-size: 8.5pt; color: #71717A;">Transparent overview of route-level module access across Basic, Pro, and Pro Max tiers.</p>
    </div>

    <!-- Complete Matrix Table with tight styling -->
    <table class="custom-table matrix-table" style="margin-bottom: 8px;">
      <thead>
        <tr>
          <th style="width: 25%;">System Route / Path</th>
          <th style="width: 42%;">Functional Page Description</th>
          <th style="width: 11%; text-align: center;">Basic</th>
          <th style="width: 11%; text-align: center;">Pro</th>
          <th style="width: 11%; text-align: center;">Pro Max</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="font-mono">/admin/customers</span></td>
          <td>Customer CRM Directory & Profile Details</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
        </tr>
        <tr>
          <td><span class="font-mono">/admin/vehicles</span></td>
          <td>Vehicles Directory & Indian Registration Plate Badging</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
        </tr>
        <tr>
          <td><span class="font-mono">/admin/vehicles/:id</span></td>
          <td>Vehicle Service History & Odometer Timeline</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
        </tr>
        <tr>
          <td><span class="font-mono">/admin/work-orders</span></td>
          <td>Digital Job Card Authoring & Service Dispatch</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
        </tr>
        <tr>
          <td><span class="font-mono">/admin/invoices</span></td>
          <td>GST Tax Invoicing & Thermal / A4 Print Studio</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
        </tr>
        <tr>
          <td><span class="font-mono">/admin/service-due</span></td>
          <td>Periodic Maintenance Mileage & Expiry Tracker</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
        </tr>
        <tr>
          <td><span class="font-mono">/admin/reminders</span></td>
          <td>Sticky Notes & Manual Workshop Reminders</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
        </tr>
        <tr style="background: #FAFAFA;">
          <td><span class="font-mono">/admin/appointments</span></td>
          <td>Appointment Calendar Studio & Slot Allocator</td>
          <td style="text-align: center; color: #A1A1AA;">Locked</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
        </tr>
        <tr style="background: #FAFAFA;">
          <td><span class="font-mono">/admin/progress</span></td>
          <td>Live Bay Progression & Workshop Floor Monitor</td>
          <td style="text-align: center; color: #A1A1AA;">Locked</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
        </tr>
        <tr style="background: #FAFAFA;">
          <td><span class="font-mono">/admin/inventory</span></td>
          <td>Parts & Spares Inventory with Reorder Alarms</td>
          <td style="text-align: center; color: #A1A1AA;">Locked</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
        </tr>
        <tr style="background: #FAFAFA;">
          <td><span class="font-mono">/inventory/room</span></td>
          <td>Dedicated Storekeeper Counter Terminal</td>
          <td style="text-align: center; color: #A1A1AA;">Locked</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
        </tr>
        <tr style="background: #FAFAFA;">
          <td><span class="font-mono">/admin/ledger</span></td>
          <td>Customer Running Ledger & Outstanding Balances</td>
          <td style="text-align: center; color: #A1A1AA;">Locked</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
        </tr>
        <tr style="background: #FAFAFA;">
          <td><span class="font-mono">/staff</span></td>
          <td>Technician Floor Mobile / Tablet Work Board</td>
          <td style="text-align: center; color: #A1A1AA;">Locked</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
        </tr>
        <tr style="background: #FAFAFA;">
          <td><span class="font-mono">/customer</span></td>
          <td>Live Vehicle Service Inspection Customer Portal</td>
          <td style="text-align: center; color: #A1A1AA;">Locked</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
          <td style="text-align: center; color: #000000; font-weight: 600;">Included</td>
        </tr>
        <tr style="background: #F4F4F5;">
          <td><span class="font-mono">/admin/tally</span></td>
          <td>Tally ERP 9 / TallyPrime XML & Excel Accounting Bridge</td>
          <td style="text-align: center; color: #A1A1AA;">Locked</td>
          <td style="text-align: center; color: #A1A1AA;">Locked</td>
          <td style="text-align: center; color: #000000; font-bold;">Included</td>
        </tr>
        <tr style="background: #F4F4F5;">
          <td><span class="font-mono">/admin/attendance</span></td>
          <td>Employee Attendance Master & Biometric Logs</td>
          <td style="text-align: center; color: #A1A1AA;">Locked</td>
          <td style="text-align: center; color: #A1A1AA;">Locked</td>
          <td style="text-align: center; color: #000000; font-bold;">Included</td>
        </tr>
        <tr style="background: #F4F4F5;">
          <td><span class="font-mono">/admin/salary</span></td>
          <td>Staff Payroll, Advances & Overtime Engine</td>
          <td style="text-align: center; color: #A1A1AA;">Locked</td>
          <td style="text-align: center; color: #A1A1AA;">Locked</td>
          <td style="text-align: center; color: #000000; font-bold;">Included</td>
        </tr>
        <tr style="background: #F4F4F5;">
          <td><span class="font-mono">/admin/access-control</span></td>
          <td>Granular Role-Based Access Control (RBAC) Matrix</td>
          <td style="text-align: center; color: #A1A1AA;">Locked</td>
          <td style="text-align: center; color: #A1A1AA;">Locked</td>
          <td style="text-align: center; color: #000000; font-bold;">Included</td>
        </tr>
        <tr style="background: #F4F4F5;">
          <td><span class="font-mono">/admin/analytics</span></td>
          <td>Executive Multi-Dimensional Workshop BI Analytics</td>
          <td style="text-align: center; color: #A1A1AA;">Locked</td>
          <td style="text-align: center; color: #A1A1AA;">Locked</td>
          <td style="text-align: center; color: #000000; font-bold;">Included</td>
        </tr>
      </tbody>
    </table>

    <!-- Infrastructure & Security Callout -->
    <div class="card-box" style="margin-bottom: 0; padding: 8px 12px;">
      <h4 style="font-size: 9.5pt; color: #000000; margin-bottom: 3px;">Cloud Infrastructure & Security Guarantees</h4>
      <div class="grid-3" style="font-size: 7.8pt; color: #18181B;">
        <div><strong>PostgreSQL Engine:</strong> Hosted on Supabase enterprise architecture with multi-region replication.</div>
        <div><strong>Data Privacy:</strong> 256-bit SSL encryption in transit & rest. Customer phone/email privacy enforced.</div>
        <div><strong>Backup SLA:</strong> Automated daily database snapshots with point-in-time recovery capabilities.</div>
      </div>
    </div>
  </div>

  <div class="doc-footer">
    <div class="footer-left">CONFIDENTIAL & PROPRIETARY — HAVDOX</div>
    <div class="footer-center">havdox.in | havdoxofficial@gmail.com</div>
    <div class="footer-right">Page 4 of 5</div>
  </div>
</div>

<!-- ================= PAGE 5 ================= -->
<div class="page">
  <div class="doc-header">
    <div class="header-left">
      <img src="{logo_data_uri}" alt="HavDox Logo" class="header-logo">
      <div class="company-meta">
        <div class="company-motto">Imagine. Build. Go beyond.</div>
      </div>
    </div>
    <div class="header-right">
      <div>Reference: <strong>HDX-DF-2026-PROP</strong></div>
      <div>Date: <strong>October 7, 2026</strong></div>
      <div>Status: <strong>v1.0 | Official Commercial Proposal</strong></div>
    </div>
  </div>

  <div class="page-body">
    <div style="margin-bottom: 8px;">
      <span class="pill-badge">Onboarding & Commercial Execution</span>
      <h2 style="font-size: 14pt; margin-top: 2px;">Implementation Roadmap & Acceptance Sign-off</h2>
      <p style="font-size: 8.5pt; color: #71717A;">4-stage deployment methodology, financial return on investment, and legal sign-off block.</p>
    </div>

    <!-- Implementation Roadmap -->
    <div class="card-box" style="margin-bottom: 10px; padding: 9px 12px;">
      <h3 style="font-size: 10.5pt; color: #000000; margin-bottom: 5px;">4-Stage Rapid Onboarding Methodology (Go-Live in 72 Hours)</h3>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 8.2pt;">
        <div style="background: #FFFFFF; padding: 7px; border: 1px solid #E4E4E7; border-radius: 4px;">
          <div class="font-mono font-bold text-black" style="font-size: 7.5pt; margin-bottom: 2px;">STAGE 1</div>
          <strong class="text-black">Data Extraction</strong>
          <p style="font-size: 7.2pt; color: #71717A; margin-top: 2px; margin-bottom: 0;">Upload customer contacts, vehicle fleet lists, and labor rate cards from Excel.</p>
        </div>
        <div style="background: #FFFFFF; padding: 7px; border: 1px solid #E4E4E7; border-radius: 4px;">
          <div class="font-mono font-bold text-black" style="font-size: 7.5pt; margin-bottom: 2px;">STAGE 2</div>
          <strong class="text-black">Hardware Setup</strong>
          <p style="font-size: 7.2pt; color: #71717A; margin-top: 2px; margin-bottom: 0;">Configure thermal/A4 invoice printers, tablet terminals, and WhatsApp sender ID.</p>
        </div>
        <div style="background: #FFFFFF; padding: 7px; border: 1px solid #E4E4E7; border-radius: 4px;">
          <div class="font-mono font-bold text-black" style="font-size: 7.5pt; margin-bottom: 2px;">STAGE 3</div>
          <strong class="text-black">Staff Orientation</strong>
          <p style="font-size: 7.2pt; color: #71717A; margin-top: 2px; margin-bottom: 0;">Role-specific training for service advisors, mechanics, and parts storekeepers.</p>
        </div>
        <div style="background: #FFFFFF; padding: 7px; border: 1px solid #E4E4E7; border-radius: 4px;">
          <div class="font-mono font-bold text-black" style="font-size: 7.5pt; margin-bottom: 2px;">STAGE 4</div>
          <strong class="text-black">Live Deployment</strong>
          <p style="font-size: 7.2pt; color: #71717A; margin-top: 2px; margin-bottom: 0;">Cutover to digital job cards with dedicated priority engineer standby.</p>
        </div>
      </div>
    </div>

    <!-- Commercial Terms Summary -->
    <div class="card-box" style="margin-bottom: 10px; font-size: 8.2pt; padding: 9px 12px;">
      <h3 style="font-size: 10pt; color: #000000; margin-bottom: 3px;">Commercial Terms & Conditions</h3>
      <div class="grid-2" style="gap: 10px;">
        <ul class="check-list">
          <li><strong>Taxes:</strong> All quoted prices are exclusive of 18% Goods & Services Tax (GST).</li>
          <li><strong>Payment Terms:</strong> SaaS plans are payable in advance. Annual contracts receive 2 months complimentary.</li>
          <li><strong>Perpetual AMC:</strong> Covers version updates, bug fixes, database security patches, and cloud backup monitoring.</li>
        </ul>
        <ul class="check-list">
          <li><strong>Data Ownership:</strong> Client retains 100% intellectual property and data ownership. Full export available anytime in CSV/Excel.</li>
          <li><strong>Support SLAs:</strong> Priority email & phone response within 4 business hours for Pro and Pro Max customers.</li>
        </ul>
      </div>
    </div>

    <!-- Formal Sign-Off / Acceptance Block -->
    <div>
      <h3 style="font-size: 10.5pt; color: #000000; margin-bottom: 3px;">Proposal Authorization & Sign-Off</h3>
      <p style="font-size: 8pt; color: #71717A; margin-bottom: 5px;">By signing below, the parties confirm acceptance of the selected tier, fare division schedule, and service parameters.</p>

      <div class="signature-grid">
        <!-- HavDox Sign-off -->
        <div class="signature-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong class="text-black" style="font-size: 9pt;">Authorized Representative: HavDox</strong>
            <span class="pill-badge" style="font-size: 6.2pt;">Service Provider</span>
          </div>
          <div class="signature-line"></div>
          <div style="font-size: 8pt; line-height: 1.35;">
            <div><strong>Name:</strong> Executive Partner / Account Director</div>
            <div><strong>Designation:</strong> Enterprise Systems Lead</div>
            <div><strong>Date:</strong> October 7, 2026</div>
          </div>
        </div>

        <!-- Client Sign-off -->
        <div class="signature-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong class="text-black" style="font-size: 9pt;">Authorized Signatory: Client Workshop</strong>
            <span class="pill-badge" style="font-size: 6.2pt;">Customer Acceptance</span>
          </div>
          <div class="signature-line"></div>
          <div style="font-size: 8pt; line-height: 1.35;">
            <div><strong>Workshop Name:</strong> ____________________________________</div>
            <div><strong>Signatory Name:</strong> ____________________________________</div>
            <div><strong>Designation / Date:</strong> _________________________________</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="doc-footer">
    <div class="footer-left">CONFIDENTIAL & PROPRIETARY — HAVDOX</div>
    <div class="footer-center">havdox.in | havdoxofficial@gmail.com</div>
    <div class="footer-right">Page 5 of 5</div>
  </div>
</div>

</body>
</html>
"""

# Write HTML file
with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"HTML generated at: {OUTPUT_HTML}")

# Generate PDF with headless chrome
chrome_cmd = [
    "google-chrome",
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--run-all-compositor-stages-before-draw",
    f"--print-to-pdf={OUTPUT_PDF}",
    OUTPUT_HTML
]

res = subprocess.run(chrome_cmd, capture_output=True, text=True)
print("Chrome return code:", res.returncode)
if res.returncode == 0:
    print(f"PDF successfully created at: {OUTPUT_PDF}")
    print(f"File size: {os.path.getsize(OUTPUT_PDF)} bytes")
else:
    print("Chrome error:", res.stderr)
