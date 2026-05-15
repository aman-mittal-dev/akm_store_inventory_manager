export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  currentStock: number;
  lowStockThreshold: number;
  imageUrl?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  // Bundle/Composite support
  isBundle?: boolean;
  bundleItems?: BundleItem[];
}

export interface BundleItem {
  itemId: string;
  quantity: number;
}

export interface TransactionItem {
  itemId: string;
  itemName: string;
  sku: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
}

export interface IncomingTransaction {
  id: string;
  items: TransactionItem[];
  totalCost: number;
  paidAmount: number;
  pendingAmount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  supplierName: string;
  supplierContact?: string;
  /** Prior bills’ unpaid balance rolled into this purchase total (supplier-specific). */
  previousOutstandingCarried?: number;
  date: string;
  notes?: string;
  billNumber: string;
  paymentHistory?: PaymentRecord[];
}

export interface OutgoingTransaction {
  id: string;
  items: TransactionItem[];
  totalRevenue: number;
  totalProfit: number;
  paidAmount: number;
  pendingAmount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  customerName: string;
  customerContact?: string;
  /** Prior bills’ unpaid balance rolled into this sale total (customer-specific). */
  previousOutstandingCarried?: number;
  date: string;
  notes?: string;
  billNumber: string;
  paymentHistory?: PaymentRecord[];
}

export interface PaymentRecord {
  id: string;
  amount: number;
  date: string;
  method?: string;
  notes?: string;
}

export interface StoreSettings {
  storeName: string;
  gstNumber: string;
  address: string;
  phone: string;
  email?: string;
}

/** Payload for creating an item; `sku` is optional — the API assigns a unique SKU when omitted. */
export type NewInventoryItemInput = Omit<InventoryItem, "id" | "createdAt" | "updatedAt" | "sku"> & {
  sku?: string;
};

export interface InventoryContextType {
  items: InventoryItem[];
  incomingTransactions: IncomingTransaction[];
  outgoingTransactions: OutgoingTransaction[];
  storeSettings: StoreSettings;
  addItem: (item: NewInventoryItemInput) => Promise<InventoryItem>;
  updateItem: (id: string, item: Partial<InventoryItem>) => Promise<InventoryItem>;
  deleteItem: (id: string) => Promise<void>;
  getItemById: (id: string) => InventoryItem | undefined;
  addIncomingTransaction: (transaction: Omit<IncomingTransaction, 'id'>) => void;
  addOutgoingTransaction: (transaction: Omit<OutgoingTransaction, 'id'>) => void;
  updateIncomingTransaction: (id: string, transaction: Partial<IncomingTransaction>) => void;
  updateOutgoingTransaction: (id: string, transaction: Partial<OutgoingTransaction>) => void;
  getTransactionsByItemId: (itemId: string) => { incoming: IncomingTransaction[], outgoing: OutgoingTransaction[] };
  updateStoreSettings: (settings: Partial<StoreSettings>) => void;
}

export type SubscriptionPlan = 'monthly' | 'quarterly' | 'annual' | 'custom';

export interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: 'active' | 'expired' | 'cancelled' | 'trial';
  startDate: string;
  endDate: string;
  amount: number;
  customDuration?: number; // in months for custom plans
  autoRenew: boolean;
  paymentMethod?: string;
  transactionId?: string;
  /** True when this row was loaded from Stripe via the API (not the legacy localStorage demo). */
  stripeBacked?: boolean;
}

export interface PricingPlan {
  id: SubscriptionPlan;
  name: string;
  duration: string;
  price: number;
  features: string[];
  popular?: boolean;
  customDuration?: boolean;
}