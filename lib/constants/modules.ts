import type { Collection, Database, BaseRecord } from "@/types";
import { money, totals, dateLabel } from "@/lib/utils";
import {
  customerBalance,
  invoiceBalance,
  paidAmount,
  purchaseTotal,
} from "@/lib/services/repository";
export type Field = {
  key: string;
  label: string;
  type?:
    "text" | "email" | "number" | "date" | "textarea" | "select" | "checkbox";
  options?: string[];
  relation?: Collection;
  required?: boolean;
  default?: string | number;
};
export type Module = {
  key: Collection;
  title: string;
  singular: string;
  description: string;
  path: string;
  columns: [string, string][];
  fields: Field[];
  statuses: string[];
  filters?: string[];
  tabs?: string[];
};
const f = (
  key: string,
  label: string,
  type: Field["type"] = "text",
  extra: Partial<Field> = {},
): Field => ({ key, label, type, ...extra });
const org = f("organizationId", "Organization", "select", {
  relation: "organizations",
  required: true,
});
const engineer = f("engineerId", "Assigned engineer", "select", {
  relation: "engineers",
});
const note = f("notes", "Notes", "textarea");
const owner = f("owner", "Sales owner", "select", {
  options: ["Ahmed Khan", "Sara Hussain", "Ali Raza"],
  default: "Ahmed Khan",
});
const date = f("date", "Date", "date", {
  required: true,
  default: "2026-09-18",
});
const amount = f("amount", "Amount (PKR)", "number", { required: true });
const name = f("name", "Name", "text", { required: true });
const statuses = {
  tickets: [
    "New",
    "Assigned",
    "Engineer En Route",
    "On Site",
    "Repairing",
    "Waiting for Parts",
    "Resolved",
    "Closed",
  ],
  quotations: [
    "Draft",
    "Sent",
    "Viewed",
    "Negotiation",
    "Accepted",
    "Rejected",
    "Expired",
  ],
  opportunities: [
    "New Lead",
    "Qualified",
    "Demo",
    "Quotation",
    "Negotiation",
    "PO Expected",
    "Won",
    "Lost",
  ],
};
export const modules: Module[] = [
  {
    key: "organizations",
    title: "Organizations",
    singular: "Customer",
    description: "Stronger relationships. A complete view of every customer.",
    path: "/crm",
    columns: [
      ["name", "Organization"],
      ["type", "Type"],
      ["city", "City"],
      ["contact", "Primary contact"],
      ["owner", "Sales owner"],
      ["opportunities", "Opportunities"],
      ["balance", "Outstanding"],
      ["lastActivity", "Last activity"],
      ["status", "Status"],
    ],
    fields: [
      f("name", "Organization name", "text", { required: true }),
      f("code", "Customer code"),
      f("type", "Organization type", "select", {
        options: [
          "Hospital",
          "Laboratory",
          "Clinic",
          "Government Institution",
          "University",
          "Research Facility",
          "Distributor",
        ],
        required: true,
      }),
      f("city", "City", "select", {
        options: [
          "Karachi",
          "Lahore",
          "Islamabad",
          "Rawalpindi",
          "Peshawar",
          "Multan",
          "Quetta",
          "Hyderabad",
        ],
        required: true,
      }),
      f("province", "Province"),
      f("address", "Address"),
      f("phone", "Phone"),
      f("email", "Email", "email"),
      f("website", "Website"),
      f("ntn", "NTN"),
      f("strn", "STRN"),
      owner,
      f("creditLimit", "Credit limit (PKR)", "number"),
      f("paymentTerms", "Payment terms", "select", {
        options: ["Net 30", "Net 60", "Advance", "Cash on delivery"],
      }),
      note,
    ],
    statuses: ["Active", "Inactive", "On Hold"],
    filters: ["city", "type", "owner", "status"],
    tabs: [
      "Overview",
      "Contacts",
      "Opportunities",
      "Quotations",
      "Orders",
      "Invoices",
      "Payments",
      "Installed Equipment",
      "Service Tickets",
      "Contracts",
      "Documents",
      "Activity",
    ],
  },
  {
    key: "contacts",
    title: "Contacts",
    singular: "Contact",
    description: "The people behind every relationship.",
    path: "/crm/contacts",
    columns: [
      ["name", "Name"],
      ["title", "Job title"],
      ["organization", "Organization"],
      ["phone", "Phone"],
      ["email", "Email"],
      ["decisionMaker", "Decision maker"],
    ],
    fields: [
      name,
      org,
      f("title", "Job title"),
      f("department", "Department"),
      f("phone", "Phone"),
      f("mobile", "Mobile"),
      f("whatsapp", "WhatsApp"),
      f("email", "Email", "email"),
      f("decisionMaker", "Decision maker", "checkbox"),
      note,
    ],
    statuses: ["Active", "Inactive"],
  },
  {
    key: "opportunities",
    title: "Opportunities",
    singular: "Opportunity",
    description: "Turn meaningful conversations into lasting partnerships.",
    path: "/sales/opportunities",
    columns: [
      ["name", "Opportunity"],
      ["organization", "Organization"],
      ["product", "Product"],
      ["value", "Deal value"],
      ["closeDate", "Expected close"],
      ["owner", "Salesperson"],
      ["probability", "Probability"],
      ["status", "Stage"],
    ],
    fields: [
      name,
      org,
      f("contactId", "Contact", "select", { relation: "contacts" }),
      f("productId", "Product", "select", { relation: "products" }),
      f("value", "Deal value (PKR)", "number", { required: true }),
      f("closeDate", "Expected close", "date", { required: true }),
      owner,
      f("probability", "Probability (%)", "number"),
      f("nextActivity", "Next activity"),
      note,
    ],
    statuses: statuses.opportunities,
    filters: ["owner", "status"],
    tabs: [
      "Overview",
      "Activity",
      "Notes",
      "Quotations",
      "Documents",
      "Follow-ups",
      "Contacts",
    ],
  },
  {
    key: "quotations",
    title: "Quotations",
    singular: "Quotation",
    description: "Precise proposals, from first quote to purchase order.",
    path: "/sales/quotations",
    columns: [
      ["name", "Quotation #"],
      ["organization", "Customer"],
      ["date", "Date"],
      ["validUntil", "Valid until"],
      ["owner", "Salesperson"],
      ["subtotal", "Subtotal"],
      ["discount", "Discount"],
      ["tax", "Tax"],
      ["total", "Grand total"],
      ["status", "Status"],
    ],
    fields: [org],
    statuses: statuses.quotations,
    filters: ["status", "owner"],
    tabs: ["Overview", "Line Items", "Activity"],
  },
  {
    key: "orders",
    title: "Sales orders",
    singular: "Sales Order",
    description: "Keep every commitment moving, from confirmation to delivery.",
    path: "/sales/orders",
    columns: [
      ["name", "Order #"],
      ["organization", "Customer"],
      ["date", "Order date"],
      ["expectedDelivery", "Expected delivery"],
      ["total", "Total"],
      ["fulfilment", "Fulfilment"],
      ["payment", "Payment"],
      ["status", "Status"],
    ],
    fields: [
      name,
      org,
      date,
      f("expectedDelivery", "Expected delivery", "date"),
      f("quotationId", "Quotation", "select", { relation: "quotations" }),
      note,
    ],
    statuses: ["Confirmed", "Reserved", "Delivered", "Cancelled"],
    tabs: ["Overview", "Line Items", "Deliveries", "Invoices", "Activity"],
  },
  {
    key: "products",
    title: "Inventory",
    singular: "Product",
    description: "The right stock, in the right place, at the right time.",
    path: "/inventory",
    columns: [
      ["sku", "SKU"],
      ["name", "Product"],
      ["brand", "Brand / principal"],
      ["category", "Category"],
      ["warehouse", "Warehouse"],
      ["available", "Available"],
      ["reserved", "Reserved"],
      ["reorderLevel", "Reorder level"],
      ["unitCost", "Unit cost"],
      ["stockValue", "Stock value"],
      ["status", "Status"],
    ],
    fields: [
      name,
      f("sku", "SKU", "text", { required: true }),
      f("category", "Category", "select", {
        options: ["Instruments", "Reagents", "Consumables", "Spare Parts"],
        required: true,
      }),
      f("brand", "Brand / principal"),
      f("model", "Model"),
      f("unitCost", "Unit cost (PKR)", "number"),
      f("price", "Selling price (PKR)", "number"),
      f("reorderLevel", "Reorder level", "number"),
      f("warranty", "Warranty"),
      f("partNumber", "Part number"),
      f("compatibility", "Compatible equipment"),
      note,
    ],
    statuses: ["Active", "Discontinued"],
    filters: ["category", "brand", "status", "warehouse", "expiry"],
    tabs: [
      "Overview",
      "Stock",
      "Batches",
      "Serial Numbers",
      "Transactions",
      "Purchases",
      "Sales",
      "Service Compatibility",
    ],
  },
  {
    key: "warehouses",
    title: "Warehouses",
    singular: "Warehouse",
    description: "A connected view of your stock across Pakistan.",
    path: "/inventory/warehouses",
    columns: [
      ["name", "Warehouse"],
      ["city", "City"],
      ["manager", "Manager"],
      ["stock", "Total stock"],
      ["stockValue", "Inventory value"],
      ["lowStock", "Low stock"],
      ["status", "Status"],
    ],
    fields: [
      name,
      f("city", "City"),
      f("manager", "Manager"),
      f("address", "Address"),
    ],
    statuses: ["Active", "Inactive"],
    tabs: ["Overview", "Stock", "Transactions"],
  },
  {
    key: "suppliers",
    title: "Procurement",
    singular: "Supplier",
    description: "Reliable supply. Clear commitments. Complete visibility.",
    path: "/procurement",
    columns: [
      ["name", "Supplier"],
      ["country", "Country"],
      ["contact", "Contact"],
      ["email", "Email"],
      ["currency", "Currency"],
      ["status", "Status"],
    ],
    fields: [
      name,
      f("country", "Country"),
      f("contact", "Contact"),
      f("email", "Email", "email"),
      f("phone", "Phone"),
      f("currency", "Currency", "select", { options: ["PKR", "USD", "EUR"] }),
    ],
    statuses: ["Active", "Inactive"],
  },
  {
    key: "purchaseRequests",
    title: "Purchase requests",
    singular: "Purchase Request",
    description: "Plan replenishment and route requests for approval.",
    path: "/procurement/requests",
    columns: [
      ["name", "Request #"],
      ["product", "Product"],
      ["quantity", "Quantity"],
      ["requestedBy", "Requested by"],
      ["date", "Date"],
      ["status", "Status"],
    ],
    fields: [
      name,
      f("productId", "Product", "select", {
        relation: "products",
        required: true,
      }),
      f("quantity", "Quantity", "number", { required: true }),
      f("requestedBy", "Requested by"),
      date,
      note,
    ],
    statuses: ["Pending", "Approved", "Rejected", "Ordered"],
  },
  {
    key: "purchaseOrders",
    title: "Purchase orders",
    singular: "Purchase Order",
    description: "Manage overseas sourcing, arrivals, and landed costs.",
    path: "/procurement/orders",
    columns: [
      ["name", "Purchase order #"],
      ["supplier", "Supplier"],
      ["currency", "Currency"],
      ["expectedArrival", "Expected arrival"],
      ["shippingMethod", "Shipping"],
      ["total", "Landed cost"],
      ["status", "Status"],
    ],
    fields: [name],
    statuses: [
      "Draft",
      "Awaiting Approval",
      "Approved",
      "Shipped",
      "Received",
      "Cancelled",
    ],
    tabs: [
      "Overview",
      "Line Items",
      "Landed Costs",
      "Goods Receipts",
      "Activity",
    ],
  },
  {
    key: "goodsReceipts",
    title: "Goods receipts",
    singular: "Goods Receipt",
    description: "Track incoming shipments and warehouse receipts.",
    path: "/procurement/receipts",
    columns: [
      ["name", "GRN #"],
      ["purchaseOrder", "Purchase order"],
      ["warehouse", "Warehouse"],
      ["date", "Received"],
      ["reference", "Reference"],
      ["status", "Status"],
    ],
    fields: [
      name,
      f("purchaseOrderId", "Purchase order", "select", {
        relation: "purchaseOrders",
        required: true,
      }),
      f("warehouseId", "Warehouse", "select", {
        relation: "warehouses",
        required: true,
      }),
      date,
      f("reference", "Reference"),
    ],
    statuses: ["Received", "Inspection Pending"],
  },
  {
    key: "deliveries",
    title: "Deliveries",
    singular: "Delivery",
    description: "Follow each order through its final mile.",
    path: "/sales/deliveries",
    columns: [
      ["name", "Delivery #"],
      ["organization", "Customer"],
      ["order", "Sales order"],
      ["warehouse", "Warehouse"],
      ["date", "Date"],
      ["reference", "Tracking reference"],
      ["status", "Status"],
    ],
    fields: [
      name,
      org,
      f("orderId", "Order", "select", { relation: "orders", required: true }),
      f("warehouseId", "Warehouse", "select", { relation: "warehouses" }),
      date,
      f("reference", "Tracking reference"),
    ],
    statuses: ["Scheduled", "In Transit", "Delivered"],
  },
  {
    key: "equipment",
    title: "Equipment registry",
    singular: "Equipment",
    description: "Every instrument. Its complete lifecycle. One place.",
    path: "/service/equipment",
    columns: [
      ["id", "Asset ID"],
      ["name", "Equipment"],
      ["model", "Model"],
      ["serial", "Serial number"],
      ["manufacturer", "Manufacturer"],
      ["organization", "Customer"],
      ["city", "City"],
      ["installationDate", "Installed"],
      ["warrantyUntil", "Warranty"],
      ["contract", "Contract"],
      ["status", "Status"],
    ],
    fields: [
      name,
      org,
      f("productId", "Product", "select", {
        relation: "products",
        required: true,
      }),
      f("model", "Model"),
      f("serial", "Serial number", "text", { required: true }),
      f("manufacturer", "Manufacturer"),
      f("department", "Department"),
      f("site", "Site"),
      f("installationDate", "Installation date", "date"),
      f("warrantyUntil", "Warranty until", "date"),
      f("contractId", "Service contract", "select", { relation: "contracts" }),
      engineer,
      f("lastService", "Last service", "date"),
      f("nextPM", "Next preventive maintenance", "date"),
      note,
    ],
    statuses: [
      "In Stock",
      "Installed",
      "Under Maintenance",
      "Out of Service",
      "Retired",
    ],
    filters: ["city", "manufacturer", "status"],
    tabs: [
      "Overview",
      "Service History",
      "Parts Used",
      "Preventive Maintenance",
      "Contracts",
      "Documents",
    ],
  },
  {
    key: "tickets",
    title: "Service tickets",
    singular: "Service Ticket",
    description: "Keep critical equipment running and care moving forward.",
    path: "/service/tickets",
    columns: [
      ["name", "Ticket #"],
      ["organization", "Customer"],
      ["equipment", "Equipment"],
      ["serial", "Serial"],
      ["city", "City"],
      ["problem", "Reported problem"],
      ["priority", "Priority"],
      ["engineer", "Engineer"],
      ["opened", "Opened"],
      ["slaStatus", "SLA"],
      ["status", "Status"],
    ],
    fields: [
      f("name", "Ticket #", "text", { required: true }),
      org,
      f("equipmentId", "Equipment", "select", {
        relation: "equipment",
        required: true,
      }),
      f("contactId", "Contact person", "select", { relation: "contacts" }),
      f("problem", "Reported problem", "textarea", { required: true }),
      f("priority", "Priority", "select", {
        options: ["Low", "Medium", "High", "Critical"],
        required: true,
      }),
      engineer,
      f("opened", "Opened", "date", { default: "2026-09-18" }),
      f("sla", "SLA deadline", "date", { required: true }),
      note,
    ],
    statuses: statuses.tickets,
    filters: ["engineer", "city", "priority", "status", "slaStatus"],
    tabs: ["Overview", "Service Timeline", "Parts Used", "Documents"],
  },
  {
    key: "engineers",
    title: "Field engineers",
    singular: "Engineer",
    description: "Empower the people keeping laboratories operational.",
    path: "/service/engineers",
    columns: [
      ["name", "Engineer"],
      ["city", "City"],
      ["jobs", "Current jobs"],
      ["completed", "Completed this month"],
      ["responseTime", "Average response"],
      ["compliance", "SLA compliance"],
      ["status", "Status"],
    ],
    fields: [
      name,
      f("city", "City"),
      f("phone", "Phone"),
      f("completed", "Completed jobs", "number"),
      f("responseTime", "Average response time"),
      f("compliance", "SLA compliance (%)", "number"),
    ],
    statuses: ["Available", "On Site", "On Leave"],
    tabs: [
      "Overview",
      "Today's Jobs",
      "Upcoming PM",
      "Parts Carried",
      "Ticket History",
      "Performance",
    ],
  },
  {
    key: "maintenance",
    title: "Preventive maintenance",
    singular: "Maintenance Visit",
    description: "Plan ahead. Prevent downtime. Protect every instrument.",
    path: "/service/maintenance",
    columns: [
      ["equipment", "Equipment"],
      ["organization", "Customer"],
      ["city", "City"],
      ["engineer", "Engineer"],
      ["lastPM", "Last PM"],
      ["nextPM", "Next PM"],
      ["contract", "Contract"],
      ["status", "Status"],
    ],
    fields: [
      name,
      org,
      f("equipmentId", "Equipment", "select", {
        relation: "equipment",
        required: true,
      }),
      engineer,
      f("lastPM", "Last PM", "date"),
      f("nextPM", "Next PM", "date", { required: true }),
      f("contractId", "Contract", "select", { relation: "contracts" }),
      note,
    ],
    statuses: ["Upcoming", "Due", "Overdue", "Completed"],
    filters: ["engineer", "status"],
  },
  {
    key: "contracts",
    title: "Service contracts",
    singular: "Service Contract",
    description: "Protect customer relationships beyond installation.",
    path: "/service/contracts",
    columns: [
      ["name", "Contract #"],
      ["organization", "Customer"],
      ["type", "Type"],
      ["equipmentCount", "Equipment"],
      ["start", "Start"],
      ["expiry", "Expiry"],
      ["value", "Value"],
      ["visits", "Visits"],
      ["renewal", "Renewal"],
      ["status", "Status"],
    ],
    fields: [
      name,
      org,
      f("type", "Type", "select", {
        options: ["Warranty", "AMC", "CMC", "Paid Service"],
      }),
      f("start", "Start", "date"),
      f("expiry", "Expiry", "date", { required: true }),
      f("value", "Contract value (PKR)", "number"),
      f("visits", "Visits", "number"),
      note,
    ],
    statuses: ["Active", "Expired", "Renewed"],
    filters: ["type", "status", "renewal"],
  },
  {
    key: "invoices",
    title: "Invoices",
    singular: "Invoice",
    description: "Clear billing. Faster collections. Healthier cash flow.",
    path: "/finance/invoices",
    columns: [
      ["name", "Invoice #"],
      ["organization", "Customer"],
      ["date", "Invoice date"],
      ["dueDate", "Due date"],
      ["subtotal", "Subtotal"],
      ["tax", "Tax"],
      ["total", "Total"],
      ["paid", "Paid"],
      ["balance", "Balance"],
      ["status", "Status"],
    ],
    fields: [org],
    statuses: [
      "Draft",
      "Sent",
      "Partially Paid",
      "Paid",
      "Overdue",
      "Cancelled",
    ],
    filters: ["organization", "status", "owner"],
    tabs: ["Overview", "Line Items", "Payments", "Activity"],
  },
  {
    key: "payments",
    title: "Receipts",
    singular: "Payment",
    description: "Every collection, matched to the right customer and invoice.",
    path: "/finance/receipts",
    columns: [
      ["name", "Receipt #"],
      ["organization", "Customer"],
      ["invoice", "Invoice"],
      ["amount", "Amount"],
      ["date", "Date"],
      ["bank", "Bank"],
      ["method", "Method"],
      ["reference", "Reference"],
      ["receivedBy", "Received by"],
    ],
    fields: [
      name,
      org,
      f("invoiceId", "Invoice", "select", {
        relation: "invoices",
        required: true,
      }),
      amount,
      date,
      f("bankId", "Bank", "select", { relation: "banks", required: true }),
      f("method", "Payment method", "select", {
        options: ["Cash", "Bank Transfer", "Cheque", "Online"],
        required: true,
      }),
      f("reference", "Reference"),
      f("receivedBy", "Received by", "text", { default: "Admin" }),
      note,
    ],
    statuses: ["Received"],
  },
  {
    key: "expenses",
    title: "Expenses",
    singular: "Expense",
    description: "Stay on top of the cost of doing business.",
    path: "/finance/expenses",
    columns: [
      ["name", "Expense #"],
      ["date", "Date"],
      ["category", "Category"],
      ["vendor", "Vendor"],
      ["amount", "Amount"],
      ["tax", "Tax"],
      ["method", "Method"],
      ["costCenter", "Cost center"],
      ["status", "Status"],
    ],
    fields: [
      name,
      date,
      f("category", "Category", "select", {
        options: [
          "Travel",
          "Fuel",
          "Salary",
          "Office",
          "Freight",
          "Customs",
          "Maintenance",
          "Marketing",
          "Utilities",
          "Other",
        ],
        required: true,
      }),
      f("vendor", "Vendor"),
      amount,
      f("tax", "Tax (PKR)", "number"),
      f("method", "Payment method", "select", {
        options: ["Cash", "Bank Transfer", "Cheque", "Online"],
      }),
      f("costCenter", "Cost center"),
      f("reference", "Reference"),
      f("attachment", "Attachment reference"),
      note,
    ],
    statuses: ["Awaiting Approval", "Approved", "Paid", "Rejected"],
    filters: ["category", "status", "costCenter"],
  },
  {
    key: "banks",
    title: "Banking",
    singular: "Bank Account",
    description: "Your cash position, connected and reconciled.",
    path: "/finance/banking",
    columns: [
      ["name", "Account"],
      ["bank", "Bank"],
      ["accountNumber", "Account number"],
      ["balance", "Current balance"],
      ["deposits", "Deposits"],
      ["reconciled", "Reconciled"],
    ],
    fields: [
      name,
      f("bank", "Bank"),
      f("accountNumber", "Account number"),
      f("openingBalance", "Opening balance (PKR)", "number"),
      f("reconciled", "Reconciled", "checkbox"),
    ],
    statuses: ["Active", "Inactive"],
    tabs: ["Overview", "Transactions", "Reconciliation"],
  },
  {
    key: "journals",
    title: "Accounts",
    singular: "Journal Entry",
    description: "A clear picture of your business, down to the last rupee.",
    path: "/finance/accounts",
    columns: [
      ["name", "Journal #"],
      ["date", "Date"],
      ["account", "Account"],
      ["debit", "Debit"],
      ["credit", "Credit"],
      ["reference", "Reference"],
      ["status", "Status"],
    ],
    fields: [
      name,
      date,
      f("account", "Account"),
      f("debit", "Debit (PKR)", "number"),
      f("credit", "Credit (PKR)", "number"),
      f("reference", "Reference"),
      note,
    ],
    statuses: ["Draft", "Posted"],
  },
  {
    key: "tenders",
    title: "Tenders",
    singular: "Tender",
    description: "From opportunity identification to a winning submission.",
    path: "/tenders",
    columns: [
      ["name", "Tender #"],
      ["organization", "Organization"],
      ["closingDate", "Closing date"],
      ["products", "Products"],
      ["value", "Estimated value"],
      ["bidBond", "Bid bond"],
      ["owner", "Assigned to"],
      ["status", "Status"],
    ],
    fields: [
      name,
      org,
      f("closingDate", "Closing date", "date", { required: true }),
      f("products", "Products"),
      f("value", "Estimated value (PKR)", "number"),
      f("bidBond", "Bid bond (PKR)", "number"),
      owner,
      f("technical", "Technical requirements", "textarea"),
      f("competitors", "Competitors"),
      note,
    ],
    statuses: [
      "Identified",
      "Preparing",
      "Submitted",
      "Technical Evaluation",
      "Financial Evaluation",
      "Won",
      "Lost",
    ],
    filters: ["status", "owner"],
    tabs: [
      "Overview",
      "Products",
      "Documents",
      "Timeline",
      "Competitors",
      "Technical Requirements",
      "Financial Proposal",
      "Result",
    ],
  },
  {
    key: "users",
    title: "Users & roles",
    singular: "User",
    description: "Give your team the right access to do their best work.",
    path: "/settings/users",
    columns: [
      ["name", "Name"],
      ["email", "Email"],
      ["role", "Role"],
      ["branch", "Branch"],
      ["status", "Status"],
      ["lastLogin", "Last login"],
    ],
    fields: [
      name,
      f("email", "Email", "email", { required: true }),
      f("role", "Role", "select", {
        options: [
          "Super Admin",
          "Director",
          "Finance Manager",
          "Sales Manager",
          "Sales Representative",
          "Procurement Officer",
          "Warehouse Manager",
          "Service Manager",
          "Field Engineer",
          "Auditor",
        ],
        required: true,
      }),
      f("branch", "Branch", "select", {
        options: ["Karachi", "Lahore", "Islamabad"],
      }),
    ],
    statuses: ["Active", "Invited", "Suspended"],
  },
  {
    key: "audit",
    title: "Activity logs",
    singular: "Activity",
    description: "A transparent record of changes across your workspace.",
    path: "/settings/audit-log",
    columns: [
      ["createdAt", "Time"],
      ["user", "User"],
      ["module", "Module"],
      ["action", "Action"],
      ["record", "Record"],
      ["before", "Before"],
      ["after", "After"],
      ["device", "IP / device"],
    ],
    fields: [],
    statuses: [],
    filters: ["module", "action"],
  },
  {
    key: "approvals",
    title: "Approvals",
    singular: "Approval",
    description: "Thoughtful checks that keep work moving.",
    path: "/approvals",
    columns: [
      ["name", "Request #"],
      ["type", "Request type"],
      ["requestedBy", "Requested by"],
      ["date", "Date"],
      ["amount", "Amount"],
      ["reason", "Reason"],
      ["status", "Status"],
    ],
    fields: [
      name,
      f("type", "Request type", "select", {
        options: [
          "Discount Approval",
          "Purchase Order Approval",
          "Expense Approval",
          "Payment Approval",
          "Stock Adjustment Approval",
        ],
      }),
      f("requestedBy", "Requested by"),
      date,
      amount,
      f("reason", "Reason", "textarea"),
    ],
    statuses: ["Pending", "Approved", "Rejected", "Changes Requested"],
    filters: ["type", "status"],
  },
];
export const moduleFor = (key: Collection) =>
  modules.find((m) => m.key === key)!;
export function recordPath(key: Collection, id: string) {
  return key === "organizations"
    ? `/crm/customers/${id}`
    : key === "products"
      ? `/inventory/products/${id}`
      : `${moduleFor(key)?.path || "/dashboard"}/${id}`;
}
export type DisplayRow = Record<string, string | number | boolean> & {
  id: string;
  name: string;
  status: string;
};
export function displayRows(db: Database, key: Collection): DisplayRow[] {
  return (db[key] as BaseRecord[]).map((record) => {
    const r = record as BaseRecord & Record<string, unknown>;
    const row: DisplayRow = { id: r.id, name: r.name, status: r.status };
    Object.entries(r).forEach(([k, v]) => {
      if (["string", "number", "boolean"].includes(typeof v))
        row[k] = v as string | number | boolean;
    });
    const o = db.organizations.find((o) => o.id === r.organizationId);
    if (o) {
      row.organization = o.name;
      row.city = o.city;
    }
    const e = db.equipment.find((e) => e.id === r.equipmentId);
    if (e) {
      row.equipment = e.name;
      row.serial = e.serial;
    }
    row.engineer =
      db.engineers.find((e) => e.id === r.engineerId)?.name || "Unassigned";
    row.product = db.products.find((p) => p.id === r.productId)?.name || "";
    row.contract =
      db.contracts.find((c) => c.id === r.contractId)?.name || "No contract";
    row.supplier = db.suppliers.find((s) => s.id === r.supplierId)?.name || "";
    row.warehouse =
      db.warehouses.find((w) => w.id === r.warehouseId)?.name || "";
    row.purchaseOrder =
      db.purchaseOrders.find((p) => p.id === r.purchaseOrderId)?.name || "";
    row.order = db.orders.find((p) => p.id === r.orderId)?.name || "";
    row.invoice = db.invoices.find((i) => i.id === r.invoiceId)?.name || "";
    row.bank = db.banks.find((b) => b.id === r.bankId)?.bank || "";
    if ("items" in r) {
      const t = totals(r.items as Database["quotations"][number]["items"]);
      Object.assign(row, t);
    }
    if (key === "organizations") {
      row.contact =
        db.contacts.find((c) => c.organizationId === r.id)?.name ||
        "No contact";
      row.balance = customerBalance(db, r.id);
      row.opportunities = db.opportunities.filter(
        (p) => p.organizationId === r.id && !["Won", "Lost"].includes(p.status),
      ).length;
      row.lastActivity =
        db.activities.find((a) => a.organizationId === r.id)?.date ||
        r.createdAt;
    }
    if (key === "products") {
      const stock = db.stock.filter((s) => s.productId === r.id);
      row.available = stock.reduce((a, s) => a + s.quantity - s.reserved, 0);
      row.reserved = stock.reduce((a, s) => a + s.reserved, 0);
      row.stockValue = stock.reduce(
        (a, s) => a + s.quantity * Number(r.unitCost),
        0,
      );
      row.warehouse =
        stock.length > 1
          ? `${stock.length} locations`
          : db.warehouses.find((w) => w.id === stock[0]?.warehouseId)?.name ||
            "Not stocked";
      row.status =
        Number(row.available) === 0
          ? "Out of Stock"
          : Number(row.available) <= Number(r.reorderLevel)
            ? "Low Stock"
            : "In Stock";
      row.expiry = db.batches.some(
        (b) => b.productId === r.id && b.expiry < "2026-10-18",
      )
        ? "Expiring Soon"
        : "Healthy";
    }
    if (key === "warehouses") {
      const stock = db.stock.filter((s) => s.warehouseId === r.id);
      row.stock = stock.reduce((a, s) => a + s.quantity, 0);
      row.stockValue = stock.reduce(
        (a, s) =>
          a +
          s.quantity *
            (db.products.find((p) => p.id === s.productId)?.unitCost || 0),
        0,
      );
      row.lowStock = stock.filter(
        (s) =>
          s.quantity - s.reserved <
          (db.products.find((p) => p.id === s.productId)?.reorderLevel || 0),
      ).length;
    }
    if (key === "invoices") {
      row.paid = paidAmount(db, r.id);
      row.balance = invoiceBalance(db, r.id);
    }
    if (key === "tickets")
      row.slaStatus = ["Resolved", "Closed"].includes(r.status)
        ? "Met"
        : String(r.sla) < "2026-09-18"
          ? "Breached"
          : "Within SLA";
    if (key === "engineers")
      row.jobs = db.tickets.filter(
        (t) =>
          t.engineerId === r.id && !["Resolved", "Closed"].includes(t.status),
      ).length;
    if (key === "contracts") {
      row.equipmentCount = db.equipment.filter(
        (e) => e.contractId === r.id,
      ).length;
      const days = Math.ceil(
        (new Date(String(r.expiry)).getTime() -
          new Date("2026-09-18").getTime()) /
          86400000,
      );
      row.renewal =
        days < 0
          ? "Expired"
          : days <= 30
            ? "Within 30 days"
            : days <= 60
              ? "Within 60 days"
              : days <= 90
                ? "Within 90 days"
                : "Healthy";
    }
    if (key === "banks") {
      row.deposits = db.payments
        .filter((p) => p.bankId === r.id)
        .reduce((s, p) => s + p.amount, 0);
      row.balance = Number(r.openingBalance) + Number(row.deposits);
    }
    if (key === "purchaseOrders")
      row.total = purchaseTotal(
        r.items as Database["purchaseOrders"][number]["items"],
        Number(r.exchangeRate),
        [
          Number(r.freight),
          Number(r.insurance),
          Number(r.customs),
          Number(r.clearing),
          Number(r.other),
        ],
      );
    return row;
  });
}
export const currencyKeys = new Set([
  "balance",
  "value",
  "amount",
  "total",
  "subtotal",
  "discount",
  "tax",
  "paid",
  "unitCost",
  "stockValue",
  "creditLimit",
  "price",
  "bidBond",
  "debit",
  "credit",
  "deposits",
  "openingBalance",
]);
export function cellLabel(key: string, value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  if (currencyKeys.has(key) && typeof value === "number") return money(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value))
    return dateLabel(value);
  if (key === "probability" || key === "compliance") return value + "%";
  return String(value);
}
