# GarageCommon - Comprehensive Garage & Workshop Management System

A dynamic, full-featured management platform designed for modern auto garages, workshops, and vehicle service centers. Built with **React**, **TypeScript**, **Vite**, **Tailwind CSS**, and **Supabase**.

---

## 🚀 Overview

**GarageCommon** is a flexible, all-in-one software solution that digitizes and streamlines complete automotive workshop operations. It adapts to garages of any scale—providing configurable branding, digital vehicle job cards, automated workflow transitions, parts inventory, financial bookkeeping, employee payroll, and customer self-service portals.

---

## ✨ Key Features

### 🛠️ 1. Dynamic Job Cards & Work Order Workflow
- **Digital Job Cards**: Create, dispatch, and track service orders across customizable stages (Inspection, Repair, Review, Completed, Invoiced).
- **Technician & Task Assignment**: Assign specific mechanics to distinct job tasks with real-time progress updates.
- **Multi-Stage Approvals**: Structured checkpoints for initial inspection, replacement part approvals, and quality assurance.
- **Media & Inspection Logging**: Attach vehicle damage photos, inspection checklists, and technician notes.

### 👥 2. Role-Based Portals & Access Control
- **Admin & Workshop Manager Portal**: Central hub for workshop metrics, billing, technician oversight, customer records, and global settings.
- **Technician / Mechanic Portal**: Distraction-free interface for floor mechanics to view assigned tasks, update work statuses, and track labor hours.
- **Customer Self-Service Portal**: Transparent tracking for vehicle owners to view live service milestones, repair estimates, and invoices.
- **Inventory Clerk Room**: Dedicated terminal for inventory controllers to record part dispatches and stock audits.

### 📦 3. Spare Parts & Inventory Management
- **Live Stock Auditing**: Monitor inventory levels, reorder thresholds, procurement costs, and selling prices.
- **QR / Barcode Label Printing**: Generate and print standardized inventory barcode/QR labels directly to label printers (`html5-qrcode` & `qrcode.react`).
- **Multi-Location / Room Management**: Categorize and assign parts to distinct storage rooms, bays, or shelves.

### 🧾 4. Invoicing, Billing & Accounting
- **Itemized Invoice Builder**: Automated calculation of spare parts, labor charges, custom discounts, and local tax rates.
- **Instant PDF Invoicing**: Clean, professional printable invoices powered by `jsPDF` and `jspdf-autotable`.
- **Flexible Payments**: Track partial settlements, advances, and payment channels (Cash, UPI, Card, Bank Transfer).
- **Customer Ledgers & Tally Export**: Full debit/credit transaction records per customer with accounting data export support.

### ⏱️ 5. Workforce, Attendance & Payroll
- **Session-Based Attendance**: Biometric or manual check-in/check-out with duration and session logging.
- **Salary Configuration**: Modular salary structures supporting base wages, allowances, overtime, and deductions.
- **Automated Payslip Generation**: Generate downloadable monthly payslips for workshop personnel.

### 📊 6. Workshop Analytics & Real-Time HUD
- **Global Workshop HUD**: Live heads-up display featuring workshop clock, active vehicle bay counters, and pending invoice totals.
- **Interactive Analytics**: Workshop performance charts, revenue trends, and operational metrics powered by **Recharts**.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Build Tool** | [Vite](https://vitejs.dev/) |
| **Styling & UI Components** | [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Data Fetching & Caching** | [TanStack React Query v5](https://tanstack.com/query/latest) |
| **Backend & Realtime** | [Supabase](https://supabase.com/) (PostgreSQL, Realtime, Auth, Row Level Security) |
| **PDF Generation & Printing** | `jspdf`, `jspdf-autotable`, `react-to-print` |
| **Data Visualization** | `recharts` |
| **Form Validation** | `zod` + `react-hook-form` |

---

## 📁 Project Structure

```text
├── public/                 # Static assets and icons
├── src/
│   ├── components/         # Reusable modular UI components
│   │   ├── auth/           # Authentication forms and role dialogs
│   │   ├── customers/      # Customer directory and vehicle linkage
│   │   ├── dashboard/      # HUD, metrics cards, summary widgets
│   │   ├── employees/      # Staff rosters, payslips, attendance
│   │   ├── inventory/      # Stock lists, QR/barcode label printing
│   │   ├── invoices/       # Invoice builder and template views
│   │   ├── layout/         # Navigation sidebars, top headers, layouts
│   │   ├── ui/             # shadcn/ui design system primitives
│   │   └── workorders/     # Digital job cards and task boards
│   ├── config/             # Role permissions & access control rules
│   ├── contexts/           # Global states (AuthContext, RequestsContext)
│   ├── hooks/              # Custom React utilities and hooks
│   ├── pages/              # Portal pages (Admin, Staff, Customer, Inventory)
│   ├── services/           # Supabase client and query services
│   ├── utils/              # PDF engine, date utilities, calculation helpers
│   ├── App.tsx             # Master router & permission guard
│   └── main.tsx            # Application entry point
├── supabase/
│   └── migrations/         # PostgreSQL database schemas, functions & RLS policies
├── .env.example            # Environment configuration template
└── package.json            # Project dependencies and npm scripts
```

---

## 🚦 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- A **Supabase** instance (Cloud or self-hosted)

### 1. Clone the Repository

```bash
git clone https://github.com/vishnumv-havdox/GarageCommon.git
cd GarageCommon
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Copy the provided [.env.example](.env.example) template:

```bash
cp .env.example .env
```

Configure your Supabase credentials in `.env`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### 4. Database Setup

Execute the SQL migration scripts in `supabase/migrations/` using either:
- The **Supabase Dashboard** (SQL Editor)
- Or the **Supabase CLI**:
  ```bash
  supabase db push
  ```

### 5. Launch the Development Server

```bash
npm run dev
```

Visit `http://localhost:5173` to access the application.

---

## 📦 Available Scripts

- `npm run dev` - Launch the Vite development server with hot module replacement (HMR).
- `npm run build` - Compile TypeScript and produce an optimized production build in `dist/`.
- `npm run preview` - Locally preview the compiled production build.
- `npm run lint` - Run ESLint code checks.

---

## 🛡️ Security & Access Control

- **Environment Isolation**: `.env` and sensitive access tokens are excluded from Git via `.gitignore`.
- **Database Row Level Security (RLS)**: Enforces access restrictions at the database layer across Admin, Staff, and Customer user accounts.

---

## 📄 License

This software is distributed under the terms specified by the repository maintainers.
