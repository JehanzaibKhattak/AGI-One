export interface BaseRecord {
  branchId?: string;
  id: string;
  name: string;
  status: string;
  createdAt: string;
  notes?: string;
}
export interface Permission {
  module: string;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  export: boolean;
}
export interface Role extends BaseRecord {
  permissions: Permission[];
}
export interface User extends BaseRecord {
  email: string;
  role: string;
  branch: string;
  lastLogin: string;
}
export interface Organization extends BaseRecord {
  code: string;
  type: string;
  city: string;
  province: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  ntn: string;
  strn: string;
  owner: string;
  creditLimit: number;
  paymentTerms: string;
}
export interface Contact extends BaseRecord {
  organizationId: string;
  title: string;
  department: string;
  phone: string;
  mobile: string;
  whatsapp: string;
  email: string;
  decisionMaker: boolean;
}
export interface Opportunity extends BaseRecord {
  organizationId: string;
  contactId: string;
  productId: string;
  value: number;
  closeDate: string;
  owner: string;
  probability: number;
  nextActivity: string;
}
export interface Activity extends BaseRecord {
  organizationId: string;
  recordId: string;
  date: string;
  user: string;
  description: string;
}
export interface QuotationItem {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
}
export interface Quotation extends BaseRecord {
  organizationId: string;
  contactId: string;
  date: string;
  validUntil: string;
  owner: string;
  currency: string;
  paymentTerms: string;
  deliveryTerms: string;
  warranty: string;
  installationTerms: string;
  items: QuotationItem[];
}
export interface SalesOrder extends BaseRecord {
  allocations?: { productId: string; warehouseId: string; quantity: number }[];
  organizationId: string;
  quotationId: string;
  date: string;
  expectedDelivery: string;
  total: number;
  fulfilment: string;
  payment: string;
  items: QuotationItem[];
}
export interface ProductCategory extends BaseRecord {
  description: string;
}
export interface Product extends BaseRecord {
  sku: string;
  category: string;
  brand: string;
  model: string;
  unitCost: number;
  price: number;
  reorderLevel: number;
  warranty: string;
  partNumber: string;
  compatibility: string;
}
export interface InventoryStock extends BaseRecord {
  productId: string;
  warehouseId: string;
  quantity: number;
  reserved: number;
}
export interface Warehouse extends BaseRecord {
  city: string;
  manager: string;
  address: string;
}
export interface InventoryTransaction extends BaseRecord {
  productId: string;
  warehouseId: string;
  toWarehouseId: string;
  quantity: number;
  reference: string;
  date: string;
}
export interface Batch extends BaseRecord {
  productId: string;
  warehouseId: string;
  lot: string;
  manufacturingDate: string;
  expiry: string;
  quantity: number;
}
export interface SerialNumber extends BaseRecord {
  productId: string;
  serial: string;
  warranty: string;
  equipmentId: string;
}
export interface Supplier extends BaseRecord {
  country: string;
  contact: string;
  email: string;
  phone: string;
  currency: string;
}
export type PurchaseOrderItem = QuotationItem;
export interface PurchaseOrder extends BaseRecord {
  supplierId: string;
  currency: string;
  exchangeRate: number;
  expectedArrival: string;
  shippingMethod: string;
  terms: string;
  items: PurchaseOrderItem[];
  freight: number;
  insurance: number;
  customs: number;
  clearing: number;
  other: number;
}
export interface GoodsReceipt extends BaseRecord {
  purchaseOrderId: string;
  warehouseId: string;
  date: string;
  reference: string;
}
export interface Equipment extends BaseRecord {
  organizationId: string;
  productId: string;
  model: string;
  serial: string;
  manufacturer: string;
  department: string;
  site: string;
  installationDate: string;
  warrantyUntil: string;
  contractId: string;
  engineerId: string;
  lastService: string;
  nextPM: string;
}
export interface ServiceTicket extends BaseRecord {
  organizationId: string;
  equipmentId: string;
  engineerId: string;
  contactId: string;
  problem: string;
  priority: string;
  opened: string;
  sla: string;
  parts: { productId: string; quantity: number }[];
  attachments: string[];
}
export interface ServiceActivity extends BaseRecord {
  ticketId: string;
  date: string;
  user: string;
  description: string;
}
export interface Engineer extends BaseRecord {
  city: string;
  completed: number;
  responseTime: string;
  compliance: number;
  phone: string;
}
export interface PreventiveMaintenance extends BaseRecord {
  equipmentId: string;
  organizationId: string;
  engineerId: string;
  lastPM: string;
  nextPM: string;
  contractId: string;
}
export interface ServiceContract extends BaseRecord {
  organizationId: string;
  type: string;
  start: string;
  expiry: string;
  value: number;
  visits: number;
}
export type InvoiceItem = QuotationItem;
export interface Invoice extends BaseRecord {
  organizationId: string;
  orderId: string;
  date: string;
  dueDate: string;
  owner: string;
  items: InvoiceItem[];
}
export interface Payment extends BaseRecord {
  organizationId: string;
  invoiceId: string;
  amount: number;
  date: string;
  bankId: string;
  method: string;
  reference: string;
  receivedBy: string;
}
export interface Expense extends BaseRecord {
  date: string;
  category: string;
  vendor: string;
  amount: number;
  tax: number;
  method: string;
  costCenter: string;
  reference: string;
  attachment: string;
}
export interface BankAccount extends BaseRecord {
  bank: string;
  accountNumber: string;
  openingBalance: number;
  reconciled: boolean;
}
export interface JournalEntry extends BaseRecord {
  date: string;
  account: string;
  debit: number;
  credit: number;
  reference: string;
}
export interface Tender extends BaseRecord {
  organizationId: string;
  closingDate: string;
  products: string;
  value: number;
  bidBond: number;
  owner: string;
  technical: string;
  competitors: string;
}
export interface Notification extends BaseRecord {
  category: string;
  href: string;
  read: boolean;
}
export interface Approval extends BaseRecord {
  type: string;
  requestedBy: string;
  date: string;
  amount: number;
  reason: string;
  recordId: string;
}
export interface AuditLog extends BaseRecord {
  user: string;
  module: string;
  action: string;
  record: string;
  before: string;
  after: string;
  device: string;
}
export interface Delivery extends BaseRecord {
  organizationId: string;
  orderId: string;
  date: string;
  warehouseId: string;
  reference: string;
}
export interface PurchaseRequest extends BaseRecord {
  productId: string;
  quantity: number;
  requestedBy: string;
  date: string;
}
export interface Database {
  organizations: Organization[];
  contacts: Contact[];
  opportunities: Opportunity[];
  activities: Activity[];
  quotations: Quotation[];
  orders: SalesOrder[];
  products: Product[];
  categories: ProductCategory[];
  stock: InventoryStock[];
  warehouses: Warehouse[];
  transactions: InventoryTransaction[];
  batches: Batch[];
  serials: SerialNumber[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  goodsReceipts: GoodsReceipt[];
  equipment: Equipment[];
  tickets: ServiceTicket[];
  serviceActivities: ServiceActivity[];
  engineers: Engineer[];
  maintenance: PreventiveMaintenance[];
  contracts: ServiceContract[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  banks: BankAccount[];
  journals: JournalEntry[];
  tenders: Tender[];
  notifications: Notification[];
  approvals: Approval[];
  users: User[];
  roles: Role[];
  audit: AuditLog[];
  deliveries: Delivery[];
  purchaseRequests: PurchaseRequest[];
  settings: Record<string, string>;
}
export type Collection = Exclude<keyof Database, "settings">;
export type Entity<K extends Collection> = Database[K][number];
