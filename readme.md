# AMSS One

A working frontend prototype for **AM Sales & Services**, connecting customer relationships, sales, stock, procurement, biomedical equipment, field service, and finance in one workspace.

The original product specification is preserved in [docs/project-brief.md](docs/project-brief.md).

## Run locally

Requires Node.js 20.9 or newer (Node.js 22/24 LTS recommended).

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js, normally **http://localhost:3000**. Next.js chooses another port if that port is occupied. The development session used for verification runs at **http://127.0.0.1:3001**.

```bash
npm run lint        # ESLint
npm run typecheck   # Strict TypeScript
npm test           # Repository and business-workflow tests
npm run build      # Production build
npm start          # Serve the production build
npm run format     # Format application source
```

Development and production builds use Next.js's supported webpack mode because Turbopack's CSS-worker port binding is restricted in the implementation environment. This does not require a different deployment platform.

## Demo sign-in

| Field | Value |
| --- | --- |
| Email | `admin@amss.pk` |
| Password | `admin123` |
| Personas | Super Admin, Director, Sales Manager, Finance Manager, Service Manager |

Authentication is deliberately frontend-only. Session state lives in `sessionStorage`. Personas have the same demo access; the role matrix is editable but does not enforce authorization. Do not use this build with real patient, customer, financial, or employee data.

## What works

- Responsive workspace with collapsible desktop sidebar, mobile navigation drawer, breadcrumbs, profile menu, notifications, help, and quick creation.
- Cmd/Ctrl+K search across organizations, products, equipment, invoices, quotations, sales orders, and service records.
- Executive dashboard with six chart views, financial KPI snapshots, operational counts, attention items, recent activity, and quick actions.
- Customer creation and editing with validation, organization-linked contacts and transactions, profile tabs, and follow-ups.
- Opportunity board and table, editable stages, weighted pipeline, linked records, and activity notes.
- Quotation/invoice/purchase-order editors with product lines, quantity, discount, tax, live totals, print previews, and browser PDF output.
- Quote → sales order → stock reservation → delivery → invoice workflow, with duplicate and stock-availability checks.
- Invoice payments allocated to the same customer, overpayment prevention, calculated balances, and paid/partially-paid transitions.
- Inventory, warehouses, batches, expiry information, serials, stock history, and atomic warehouse transfers.
- Equipment profiles, service history, engineer assignment, ticket status updates, notes, replacement-part references, mock attachment references, and resolution.
- Maintenance calendar/table, visits, service contracts and renewal windows, and engineer profiles.
- Procurement suppliers, requests, orders, goods-receipt records, and landed-cost calculations.
- Accounting overview, receivable aging, receipts, expenses, bank balances, and a demo reconciliation confirmation.
- Tender lifecycle, linked organizations, technical/financial details, and document references.
- Report catalog with filters, CSV downloads, Excel-compatible XML, and printable PDF reports.
- Approval decisions, editable role-permission matrix, activity logs, saved settings, JSON backup, and confirmed demo reset.
- Searchable/sortable tables with filters, pagination, selectable rows, column visibility, selected-row exports, and relevant bulk status actions.
- Loading skeletons, useful empty states, error recovery, accessible Radix dialogs, keyboard focus management, and toast feedback.

## Important routes

| Area | Routes |
| --- | --- |
| Entry | `/login`, `/dashboard` |
| CRM | `/crm`, `/crm/overview`, `/crm/contacts`, `/crm/customers/org-1` |
| Sales | `/sales/opportunities`, `/sales/quotations`, `/sales/quotations/new`, `/sales/orders`, `/sales/deliveries` |
| Inventory | `/inventory`, `/inventory/products/prd-1`, `/inventory/warehouses` |
| Procurement | `/procurement`, `/procurement/requests`, `/procurement/orders`, `/procurement/orders/new`, `/procurement/receipts` |
| Service | `/service/equipment`, `/service/equipment/eq-1`, `/service/tickets`, `/service/tickets/ticket-1`, `/service/maintenance`, `/service/contracts`, `/service/engineers` |
| Finance | `/finance/accounts`, `/finance/invoices`, `/finance/invoices/new`, `/finance/receivables`, `/finance/receipts`, `/finance/expenses`, `/finance/banking` |
| Commercial | `/tenders`, `/tenders/tnd-1` |
| Oversight | `/reports`, `/approvals`, `/settings/users`, `/settings/audit-log`, `/settings` |

Other records have equivalent ID-based detail URLs. Open a row for a quick-view drawer, then choose **Open** for the full profile. Document edit URLs end in `/edit`.

## Technology

Next.js 16.3.5 App Router, React 19.3, TypeScript, Tailwind CSS 4, shadcn/ui source components, Radix UI, Lucide React, Recharts, React Hook Form, Zod, TanStack Table 8, date-fns, and Sonner. Dependency versions and lockfile are pinned. React's external-store API supplies shared reactive state without another state-management dependency.

## Project structure

```text
app/
  layout.tsx                  Root layout and metadata
  login/                      Demo sign-in
  (workspace)/
    layout.tsx                Shared authenticated-demo shell
    [...path]/page.tsx        Server-side module/detail route resolver
    loading.tsx               Route skeleton
    error.tsx                 Recoverable error boundary
  globals.css                 Enterprise visual system and responsive styles
components/
  layout/                     Sidebar, header, search, notification center
  dashboard/                  Executive dashboard and Recharts views
  modules/                    Module-specific lists, profiles, finance, reports
  forms/                      React Hook Form + Zod record editor
  tables/                     TanStack table with reusable table behaviors
  common/                     Composed dialogs, menus, badges, headings
  ui/                         Owned shadcn/ui components
lib/
  constants/modules.ts        Module metadata, fields, columns, display selectors
  mock-data/seed.ts            Shared relational fictional dataset
  services/repository.ts      Repository, persistence, transactions, workflows
  services/provider.tsx       Reactive subscription and initialization boundary
  utils.ts                    Money/date formatting, totals, safe CSV output
types/                        Typed interfaces for all major business entities
tests/
  repository.test.ts          Core invariants and cross-module workflows
  e2e/workspace.spec.ts        Browser routes, forms, workflows, and mobile checks
docs/
  project-brief.md             Original supplied specification
```

The catch-all route keeps module routing concise while dedicated components preserve purpose-specific UX. Server layouts and the route resolver choose the page; client boundaries are limited to interactive screens and browser-backed data.

## Data and service boundaries

There is **one organization collection**. Contacts, opportunities, quotes, orders, deliveries, invoices, receipts, equipment, service tickets, and contracts reference shared IDs. Display names are resolved rather than copied into unrelated modules.

Components read via `useDatabase()` and selectors. Seed imports are isolated to the repository. Named services include `customerService`, `quotationService`, `inventoryService`, `invoiceService`, and `ticketService`. Transaction helpers handle conversion, stock transfers, allocation, service updates, and approval decisions.

Mutations clone the current database and write the complete new snapshot before notifying subscribers. Failed operations leave the prior snapshot unchanged. Records persist under `amss-one:v1` in `localStorage`; browser profiles do not share changes. Reset from **Settings → Demo workspace**. Incompatible/corrupt stored data has an explicit recovery screen.

The seed uses a fixed **18 September 2026** demonstration date for reproducible SLA/expiry/aging examples. Operational tables and customer balances derive from the editable records. The dashboard's historic executive sales/collection/category/aging series are illustrative management snapshots, not a reconciled ledger; period controls provide demo projections. Accounting reports label estimates and opening snapshots explicitly.

## Browser verification

Start the application first, then:

```bash
npx playwright install chromium
BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```

If a compatible Chrome is already installed, optionally provide its executable path:

```bash
CHROMIUM_PATH='/path/to/chrome' BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```

The tests exercise all main routes, customer creation and persistent edits, quotation calculation/conversion, stock reservation, global search, service actions, profile tabs, the maintenance calendar, roles, report downloads, login validation, and a 390px mobile viewport. Unit tests cover calculation order, atomic stock movement, payment ownership/limits, duplicate conversion prevention, fulfilment, approvals, and shared customer identity.

## Frontend-only boundaries / future backend work

This is a functional **frontend prototype**, not a deployed production ERP:

- Real authentication, sessions, permissions, approval policy enforcement, and immutable audit storage.
- Multi-user database persistence, transactional locking, cross-tab synchronization, concurrency/versioning, and generated document numbers.
- Balanced accounting journals, legal tax treatment, landed-cost posting, currency feeds, COGS, opening balances, supplier bills, and audited financial statements.
- Bank feeds and transaction-by-transaction statement matching. Current reconciliation records a demo confirmation.
- Purchase receiving automation and serial/lot allocation; procurement records are editable mock records. Service parts currently record usage references, rather than issuing warehouse inventory.
- Real document uploads/storage, OCR, outbound email/SMS/WhatsApp, electronic signatures, payment rails, and shipping integrations.
- Scheduled PM/SLA notifications, maps/GPS dispatch, background jobs, and true mobile/offline field-service synchronization.
- Server-generated PDF documents and native `.xlsx` exports. Current PDF actions use **Print → Save as PDF**, and Excel downloads are correctly labelled SpreadsheetML XML.
- Template, notification, and numbering settings are saved configuration previews. Light theme is implemented; dark mode remains optional future work.

## Suggested next phase

1. Agree on the data dictionary and demonstrate the quote-to-cash and equipment-service flows with management.
2. Add PostgreSQL and authenticated APIs behind the repository interface: `/api/customers`, `/api/products`, `/api/quotations`, `/api/service-tickets`, `/api/invoices`, `/api/payments`.
3. Move validations, approval decisions, inventory movements, and payment allocation into authorized database transactions.
4. Implement the accounting ledger, procurement receiving, file storage, and notification jobs before importing real records.
5. Add permission-aware navigation, role-based server enforcement, integration tests, deployment monitoring, and a staged pilot with one branch.
