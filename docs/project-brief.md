You are a senior product designer and senior frontend engineer. Build a production-quality frontend for a business management platform called:

# AMSS One

Company: AM Sales & Services
Website reference: https://www.amsalesandservices.com/

AM Sales & Services operates in Pakistan and deals with biomedical/diagnostic equipment, laboratory instruments, reagents, consumables, spare parts, sales, installations, maintenance, field engineers, hospitals, laboratories, institutional customers, procurement, invoicing and collections.

The application should be a professional integrated:

* CRM
* Sales Management
* Inventory Management
* Procurement Management
* Accounting / Finance
* Biomedical Equipment Registry
* Field Service Management
* Preventive Maintenance
* Tender Management
* Reporting Platform

This must NOT look like a generic admin dashboard template.

It should feel like a polished SaaS/ERP product with usability inspired by:

* Stripe Dashboard
* Linear
* HubSpot
* modern Odoo
* modern ERPNext
* Ramp
* Attio

Do not copy those products directly. Use them only as UX quality references.

---

# TECH STACK

Build using:

* Next.js latest stable version with App Router
* TypeScript
* Tailwind CSS
* shadcn/ui
* Lucide React icons
* Recharts for charts
* React Hook Form
* Zod validation
* TanStack Table for complex tables
* Zustand if global frontend state is needed
* date-fns for date formatting

Use clean reusable architecture.

Do NOT build the backend yet.

Use realistic mock data through a mock service/repository layer so it can later be replaced by API calls without rewriting the UI.

Create interfaces/types for every major data entity.

---

# PRIMARY GOAL

Build a REAL usable frontend prototype.

I should be able to run:

npm install
npm run dev

and navigate through the application.

The application must have:

* responsive layouts
* working navigation
* functioning dropdowns
* forms
* modals/drawers
* search
* filtering
* sorting
* pagination
* tables
* charts
* tabs
* detail pages
* editable mock records
* status badges
* validation
* loading states
* empty states
* error states
* notification/toast system

Do not create buttons that do nothing.

Every visible primary button should perform a meaningful frontend action.

---

# DESIGN SYSTEM

Create a clean enterprise UI.

Visual direction:

* very professional
* minimal
* light theme first
* optional dark mode
* white / very light gray surfaces
* dark charcoal typography
* subtle borders
* moderate use of blue as primary brand/accent
* green for successful/paid/in-stock states
* amber for warnings
* red only for overdue/critical errors
* soft rounded corners
* restrained shadows
* high information density without clutter

Avoid:

* excessive gradients
* neon UI
* giant rounded cards everywhere
* glassmorphism
* huge dashboard fonts
* unnecessary animation
* childish icons
* excessive empty space

Use typography suitable for enterprise software.

---

# MAIN APPLICATION SHELL

Create a desktop sidebar plus responsive mobile navigation.

Sidebar:

AMSS One
Business Operations

MAIN

* Dashboard

CUSTOMERS

* CRM
* Organizations
* Contacts
* Opportunities
* Quotations
* Sales Orders

OPERATIONS

* Inventory
* Warehouses
* Procurement
* Purchase Orders
* Deliveries

SERVICE

* Equipment
* Service Tickets
* Preventive Maintenance
* Service Contracts
* Engineers

FINANCE

* Invoices
* Receipts
* Expenses
* Accounts
* Banking

COMMERCIAL

* Tenders

ANALYTICS

* Reports

SYSTEM

* Users & Roles
* Activity Logs
* Settings

Sidebar should support collapsing.

---

# TOP HEADER

Include:

* breadcrumb
* global search
* quick create button
* notifications
* help icon
* profile dropdown

Global search placeholder:

"Search customer, invoice, quotation, serial number, product..."

Search should display categorized mock results such as:

Customers
Equipment
Invoices
Products
Tickets
Quotations

Use Command / Cmd+K style search.

---

# 1. EXECUTIVE DASHBOARD

Route:

/dashboard

Create a strong executive dashboard.

Header:

Good morning, Admin

Date range selector:

* Today
* This Week
* This Month
* Quarter
* Custom

KPIs:

* Sales This Month
* Collections
* Outstanding Receivables
* Inventory Value
* Open Opportunities
* Open Service Tickets
* PM Due This Month
* Active Tenders

Sample values:

Sales This Month: PKR 48.2M
Collections: PKR 29.1M
Receivables: PKR 17.4M
Inventory Value: PKR 86.3M
Pipeline: PKR 124M
Open Tickets: 34

Charts:

1. Revenue vs Collections
2. Sales by Month
3. Sales by Product Category
4. Pipeline by Stage
5. Receivables Aging
6. Service Ticket Status

Attention Required panel:

* overdue invoices
* low-stock products
* reagent batches nearing expiry
* maintenance visits due
* quotations awaiting follow-up
* expired service contracts

Recent Activity panel.

Quick actions:

* New Customer
* New Opportunity
* Create Quotation
* Add Service Ticket
* Create Invoice
* Receive Payment

---

# 2. CRM

Route:

/crm

CRM should be organization-based.

Customers include:

* Hospitals
* Laboratories
* Clinics
* Government institutions
* Universities
* Research facilities
* Distributors

CRM table columns:

* Organization
* Type
* City
* Primary Contact
* Sales Owner
* Open Opportunities
* Outstanding Balance
* Last Activity
* Status

Filters:

* city
* organization type
* salesperson
* status
* outstanding amount

Create customer drawer/modal.

Fields:

* Organization Name
* Customer Code
* Organization Type
* NTN
* STRN
* Phone
* Email
* Website
* Address
* City
* Province
* Sales Owner
* Credit Limit
* Payment Terms
* Notes

---

# CUSTOMER DETAIL PAGE

Route:

/crm/customers/[id]

Use a strong customer profile layout.

Header:

Organization name
Customer code
Status
City
Sales owner

Summary cards:

* Lifetime Sales
* Outstanding Balance
* Open Opportunities
* Installed Equipment
* Active Service Contracts

Tabs:

Overview
Contacts
Opportunities
Quotations
Orders
Invoices
Payments
Installed Equipment
Service Tickets
Contracts
Documents
Activity

Overview should display:

* address
* phone
* tax information
* payment terms
* account status
* credit limit
* recent activities
* upcoming follow-ups

---

# 3. CONTACT MANAGEMENT

Routes:

/crm/contacts

Contacts should be linked to organizations.

Fields:

* Name
* Job Title
* Department
* Organization
* Phone
* Mobile
* WhatsApp
* Email
* Decision maker flag
* Notes

---

# 4. SALES OPPORTUNITIES

Route:

/sales/opportunities

Build BOTH:

* kanban board
* table view

Stages:

New Lead
Qualified
Demo
Quotation
Negotiation
PO Expected
Won
Lost

Opportunity card:

* Organization
* Contact
* Product / Product Category
* Deal Value
* Expected Close Date
* Salesperson
* Probability
* Next Activity

Enable drag-style visual behavior if practical, otherwise provide stage-edit controls.

Opportunity detail page should include:

* activity timeline
* notes
* quotations
* documents
* follow-up history
* linked contacts
* estimated revenue

---

# 5. QUOTATIONS

Route:

/sales/quotations

Columns:

* Quotation #
* Customer
* Date
* Valid Until
* Salesperson
* Subtotal
* Discount
* Tax
* Grand Total
* Status

Statuses:

Draft
Sent
Viewed
Negotiation
Accepted
Rejected
Expired

Quotation creation page:

/sales/quotations/new

Create proper line-item editor.

Columns:

Product
Description
Quantity
Unit Price
Discount
Tax
Total

Fields:

Customer
Contact
Currency
Validity
Payment Terms
Delivery Terms
Warranty
Installation Terms
Notes

Buttons:

Save Draft
Preview
Generate PDF
Mark as Sent
Convert to Sales Order

Frontend-only mock actions are acceptable.

---

# 6. SALES ORDERS

Route:

/sales/orders

Sales order workflow:

Quotation
→ Sales Order
→ Stock Reservation
→ Delivery
→ Invoice

Columns:

Order #
Customer
Order Date
Expected Delivery
Total
Fulfilment
Payment
Status

---

# 7. INVENTORY

Route:

/inventory

Inventory must support:

* Instruments
* Reagents
* Consumables
* Spare Parts

Create summary cards:

Total Inventory Value
SKUs
Low Stock
Out of Stock
Expiring Soon
Reserved Stock

Inventory table:

SKU
Product
Brand/Principal
Category
Warehouse
Available
Reserved
Reorder Level
Unit Cost
Stock Value
Status

Filters:

Warehouse
Category
Brand
Stock Status
Expiry
Product Type

Add search.

---

# PRODUCT DETAIL

Route:

/inventory/products/[id]

Tabs:

Overview
Stock
Batches
Serial Numbers
Transactions
Purchases
Sales
Service Compatibility

For Instruments:

* serial tracking
* model
* manufacturer
* warranty
* installed status

For Reagents:

* lot/batch
* manufacturing date
* expiry
* quantity

For Spare Parts:

* compatible equipment
* part number
* engineer stock

---

# 8. WAREHOUSES

Route:

/inventory/warehouses

Mock locations:

* Karachi Main Warehouse
* Lahore Warehouse
* Islamabad Warehouse
* Engineer Stock

Warehouse page should show:

* total stock
* inventory value
* low stock
* stock transfers
* transaction history

Create stock transfer modal:

From Warehouse
To Warehouse
Product
Quantity
Reference
Notes

---

# 9. PROCUREMENT

Route:

/procurement

Include:

Suppliers
Purchase Requests
Purchase Orders
Goods Receipts

Purchase workflow:

Purchase Request
→ Approval
→ Purchase Order
→ Shipment
→ GRN
→ Supplier Invoice
→ Payment

---

# PURCHASE ORDER PAGE

Fields:

Supplier
Currency
Exchange Rate
Expected Arrival
Shipping Method
Terms

Line items.

Also include landed cost fields:

* Product Cost
* Freight
* Insurance
* Customs Duty
* Clearing Charges
* Other Costs

Calculate estimated landed cost.

---

# 10. BIOMEDICAL EQUIPMENT REGISTRY

Route:

/service/equipment

This is a critical module.

Table columns:

Asset ID
Equipment
Model
Serial Number
Manufacturer
Customer
City
Installation Date
Warranty
Contract
Status

Statuses:

In Stock
Installed
Under Maintenance
Out of Service
Retired

---

# EQUIPMENT DETAIL PAGE

Route:

/service/equipment/[id]

Example equipment:

STA Compact Max

Show:

Asset ID
Model
Serial Number
Manufacturer
Customer
Department
Site
Installation Date
Warranty Until
Service Contract
Assigned Engineer
Last Service
Next Preventive Maintenance

Tabs:

Overview
Service History
Parts Used
Preventive Maintenance
Contracts
Documents

Service timeline should be visually clear.

---

# 11. SERVICE TICKETS

Route:

/service/tickets

Columns:

Ticket #
Customer
Equipment
Serial
City
Problem
Priority
Engineer
Opened
SLA
Status

Statuses:

New
Assigned
Engineer En Route
On Site
Repairing
Waiting for Parts
Resolved
Closed

Priorities:

Low
Medium
High
Critical

Filters:

Engineer
City
Priority
Status
SLA

---

# SERVICE TICKET DETAIL

Show:

Customer
Site
Equipment
Serial
Contact Person
Phone
Reported Problem
Priority
Assigned Engineer
SLA countdown/status

Timeline:

Ticket Created
Engineer Assigned
Engineer Arrived
Diagnosis
Part Replaced
Testing
Resolved

Allow frontend actions:

Assign Engineer
Change Status
Add Notes
Add Parts
Upload mock attachment
Resolve Ticket

---

# 12. FIELD ENGINEERS

Route:

/service/engineers

Cards/table:

Engineer
City
Current Jobs
Completed This Month
Average Response Time
SLA Compliance
Status

Engineer detail:

Today's jobs
Upcoming PM
Parts carried
Ticket history
Performance stats

---

# 13. PREVENTIVE MAINTENANCE

Route:

/service/maintenance

Views:

Calendar
Table

Columns:

Equipment
Customer
City
Engineer
Last PM
Next PM
Contract
Status

Status:

Upcoming
Due
Overdue
Completed

---

# 14. SERVICE CONTRACTS

Route:

/service/contracts

Support:

Warranty
AMC
CMC
Paid Service

Columns:

Contract #
Customer
Equipment Count
Start
Expiry
Contract Value
Visits
Renewal Status

Highlight contracts expiring within:

30
60
90 days

---

# 15. ACCOUNTS

Route:

/finance/accounts

Create finance dashboard.

Metrics:

Cash
Bank Balance
Receivables
Payables
Monthly Revenue
Monthly Expenses
Net Profit

Sections:

Chart of Accounts
General Ledger
Journal Entries
Receivables
Payables
Banking

Use mock accounting data.

---

# 16. INVOICES

Route:

/finance/invoices

Columns:

Invoice #
Customer
Invoice Date
Due Date
Subtotal
Tax
Total
Paid
Balance
Status

Statuses:

Draft
Sent
Partially Paid
Paid
Overdue
Cancelled

Filters:

Customer
Status
Date
Salesperson

Create invoice modal/page.

---

# 17. RECEIVABLE AGING

Route:

/finance/receivables

Display:

0–30 Days
31–60 Days
61–90 Days
90+ Days

Create aging chart and detailed table.

Use realistic PKR values.

---

# 18. PAYMENTS / RECEIPTS

Route:

/finance/receipts

Fields:

Receipt #
Customer
Invoice
Amount
Date
Bank
Payment Method
Reference
Received By

Payment methods:

Cash
Bank Transfer
Cheque
Online

---

# 19. EXPENSE MANAGEMENT

Route:

/finance/expenses

Categories:

Travel
Fuel
Salary
Office
Freight
Customs
Maintenance
Marketing
Utilities
Other

Fields:

Expense Date
Category
Vendor
Amount
Tax
Payment Method
Cost Center
Reference
Attachment
Notes

---

# 20. BANKING

Route:

/finance/banking

Display:

Bank accounts
Current balance
Deposits
Payments
Reconciliation status

Create bank reconciliation screen.

---

# 21. TENDER MANAGEMENT

Route:

/tenders

Tender statuses:

Identified
Preparing
Submitted
Technical Evaluation
Financial Evaluation
Won
Lost

Columns:

Tender #
Organization
Closing Date
Products
Estimated Value
Bid Bond
Assigned Salesperson
Status

Tender detail:

Overview
Products
Documents
Timeline
Competitors
Technical Requirements
Financial Proposal
Result

---

# 22. REPORTS

Route:

/reports

Create report cards:

Sales Reports
Inventory Reports
Finance Reports
CRM Reports
Service Reports
Procurement Reports
Tender Reports

Examples:

Sales by Customer
Sales by Product
Sales by City
Sales by Salesperson
Profitability by Product
Inventory Valuation
Slow Moving Stock
Expiring Stock
Stock Movement
Receivable Aging
Customer Statement
Profit & Loss
Balance Sheet
Cash Flow
Service Response Time
Engineer Performance
Equipment Failure Frequency

Include report filters and mock export buttons:

PDF
Excel
CSV

---

# 23. NOTIFICATIONS

Create notification center.

Examples:

Invoice INV-8891 is overdue by 34 days.

Reagent batch RG-23091 expires in 27 days.

Service ticket ST-1098 has exceeded SLA.

AMC contract for XYZ Diagnostics expires in 30 days.

Purchase order PO-3021 is awaiting approval.

Quotation QT-2026-0431 requires follow-up.

Allow:

Mark as read
Mark all as read
Filter by category

---

# 24. APPROVAL SYSTEM

Create frontend approval workflows.

Examples:

Discount Approval
Purchase Order Approval
Expense Approval
Payment Approval
Stock Adjustment Approval

Approval screen:

Request Type
Requested By
Date
Amount
Reason
Status

Actions:

Approve
Reject
Request Changes

---

# 25. USERS & ROLES

Route:

/settings/users

Roles:

Super Admin
Director
Finance Manager
Sales Manager
Sales Representative
Procurement Officer
Warehouse Manager
Service Manager
Field Engineer
Auditor

Users table:

Name
Email
Role
Branch
Status
Last Login

Create role permissions UI.

Permissions should look like a matrix:

Module × View/Create/Edit/Delete/Approve/Export.

---

# 26. AUDIT LOG

Route:

/settings/audit-log

Columns:

Time
User
Module
Action
Record
Before
After
IP/Device placeholder

Example:

Ahmed Khan
Edited quotation QT-2026-0431

Price:
PKR 250,000 → PKR 225,000

---

# 27. SETTINGS

Include:

Company Profile
Branches
Warehouses
Taxes
Currencies
Number Sequences
Payment Terms
Service SLA
Quotation Templates
Invoice Templates
Notification Preferences
System Preferences

---

# DATA MODEL

Create strong TypeScript interfaces for:

User
Role
Permission
Organization
Contact
Opportunity
Activity
Quotation
QuotationItem
SalesOrder
Product
ProductCategory
InventoryStock
Warehouse
InventoryTransaction
Batch
SerialNumber
Supplier
PurchaseOrder
PurchaseOrderItem
GoodsReceipt
Equipment
ServiceTicket
ServiceActivity
Engineer
PreventiveMaintenance
ServiceContract
Invoice
InvoiceItem
Payment
Expense
BankAccount
JournalEntry
Tender
Notification
Approval
AuditLog

---

# MOCK DATA

Create realistic Pakistani mock data.

Use organizations like fictional examples such as:

* Capital Diagnostic Centre
* National Medical Laboratory
* CityCare Hospital
* Metro Diagnostics
* Prime Health Laboratory
* Central Medical Centre

Cities:

Karachi
Lahore
Islamabad
Rawalpindi
Peshawar
Multan
Quetta
Hyderabad

Use PKR currency formatting.

Do not populate the application with random lorem ipsum.

Use realistic healthcare/business terminology.

---

# GLOBAL SEARCH

Implement Cmd/Ctrl + K.

Searching:

ST-1098

should show the service ticket.

Searching:

STA Compact Max

should display:

Product
Installed Equipment
Service History related entries

Searching customer name should find:

Customer
Invoices
Orders
Tickets
Equipment

---

# QUICK CREATE

Global + New button opens command-style menu:

New Customer
New Contact
New Opportunity
New Quotation
New Sales Order
New Purchase Order
New Service Ticket
New Invoice
Receive Payment
Add Expense

---

# DETAIL DRAWERS

For quick viewing, clicking rows should open a right-side detail drawer where appropriate.

Example customer drawer:

Company Name
Contact
Outstanding Balance
Current Opportunity
Installed Equipment
Last Activity

Buttons:

Open Customer
Create Quotation
Create Ticket

---

# TABLE UX

Tables must support where relevant:

Search
Sort
Filters
Pagination
Column visibility
Row selection
Bulk actions

Do not make tables visually heavy.

Use sticky headers where useful.

---

# RESPONSIVENESS

Desktop is primary because this is enterprise software.

Still make it usable on:

* laptop
* tablet
* mobile

On mobile:

Sidebar should become a drawer.

Tables may switch to cards or use controlled horizontal scrolling.

---

# ACCESSIBILITY

Use:

semantic HTML
keyboard navigation
labels
focus states
accessible dialogs
appropriate ARIA
good contrast

---

# PERFORMANCE

Avoid unnecessary client components.

Use Server Components where sensible.

Only interactive parts should use "use client".

Do not add huge dependencies without justification.

---

# FOLDER STRUCTURE

Use a professional folder structure similar to:

app/
(auth)/
(dashboard)/
dashboard/
crm/
sales/
inventory/
procurement/
service/
finance/
tenders/
reports/
settings/

components/
layout/
dashboard/
crm/
sales/
inventory/
service/
finance/
common/
tables/
forms/

lib/
mock-data/
services/
utils/
constants/
validations/

types/

hooks/

stores/

---

# IMPORTANT ARCHITECTURAL RULE

Do NOT duplicate customers across modules.

The same organization record must be used throughout:

Customer
→ Contacts
→ Opportunities
→ Quotations
→ Orders
→ Deliveries
→ Invoices
→ Payments
→ Installed Equipment
→ Service Tickets
→ Contracts

Use shared IDs and relational mock data.

This architecture is critical.

---

# UX RULES

Do NOT make every page look identical.

Each module should be optimized for its actual purpose.

Examples:

CRM → relationships and activities

Inventory → stock and movement

Service → operational tickets and SLAs

Finance → balances and transactions

Dashboard → analytics and alerts

Equipment → asset lifecycle

---

# POLISH

Add:

* skeleton loading states
* useful empty states
* confirmation dialogs
* breadcrumbs
* proper page titles
* toasts
* tooltips where necessary
* avatar initials
* contextual actions
* status colors
* date formatting
* PKR money formatting

Use smooth but subtle UI transitions.

---

# DEMO LOGIN

Create a simple frontend-only login page.

Email:

[admin@amss.pk](mailto:admin@amss.pk)

Password:

admin123

No actual authentication backend is required yet.

After login go to:

/dashboard

Also create fake personas if useful:

Director
Sales Manager
Finance Manager
Service Manager

Role selection can affect visible sidebar items if practical.

---

# README

Create a professional README explaining:

* project purpose
* tech stack
* installation
* development commands
* project architecture
* available modules
* mock authentication
* future backend integration plan

---

# FUTURE BACKEND READINESS

Structure frontend services so later APIs could be:

GET /api/customers
GET /api/products
GET /api/service-tickets
GET /api/invoices

etc.

Do not scatter mock-data imports throughout every component.

Create a mock repository/service abstraction.

Example:

customerService.getAll()

quotationService.create()

inventoryService.getStock()

This can later be changed to Axios/fetch calls.

---

# IMPORTANT

Do not stop after generating a homepage.

Do not give me only wireframes.

Do not create static screenshots.

Actually create the Next.js application and all major frontend routes.

Prioritize these modules if implementation becomes large:

1. Application shell
2. Dashboard
3. CRM
4. Customer detail
5. Opportunities
6. Quotations
7. Inventory
8. Equipment
9. Service Tickets
10. Accounts/Invoices
11. Procurement
12. Reports
13. Tenders
14. Settings

Build it iteratively but leave the repository in a working state after every stage.

After implementing, run:

npm install
npm run lint
npm run build

Fix all TypeScript, lint and build errors.

Do not declare the application complete until the build succeeds.

Finally provide:

1. summary of what was implemented
2. folder structure
3. important routes
4. demo credentials
5. commands to run locally
6. list of features that remain backend-only
7. suggested next development phase

The final result should look credible enough to demonstrate directly to AM Sales & Services management as the proposed interface for their future integrated ERP + CRM platform.
