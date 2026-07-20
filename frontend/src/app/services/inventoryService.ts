import { apiFetch, apiUploadFile } from "../lib/api";
import {
  InventoryItem,
  IncomingTransaction,
  OutgoingTransaction,
  NewInventoryItemInput,
  PaymentRecord,
} from "../types";

export function getItemsApi() {
  return apiFetch<{ items: InventoryItem[] }>("/items").then((body) => body.items ?? []);
}

export async function uploadItemImageApi(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const data = await apiUploadFile<{ url: string }>("/items/images/upload", fd);
  return data.url;
}

export function createItemApi(payload: NewInventoryItemInput) {
  const body: Record<string, unknown> = { ...payload };
  if (!body.sku || String(body.sku).trim() === "") {
    delete body.sku;
  }
  return apiFetch<{ item: InventoryItem }>("/items", {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.item);
}

export function updateItemApi(itemId: string, payload: Partial<InventoryItem>) {
  return apiFetch<{ item: InventoryItem }>(`/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }).then((r) => r.item);
}

export function deleteItemApi(itemId: string) {
  return apiFetch<null | undefined>(`/items/${itemId}`, { method: "DELETE" });
}

type ApiTransaction = {
  id: string;
  transactionType: "incoming" | "outgoing";
  billNumber: string;
  paymentStatus: "paid" | "partial" | "unpaid";
  totalAmount: number;
  totalProfit?: number | null;
  paidAmount: number;
  pendingAmount: number;
  contactName: string;
  contactPhone?: string | null;
  date: string;
  notes?: string | null;
  items: IncomingTransaction["items"];
  previousOutstandingCarried?: number;
  paymentHistory?: PaymentRecord[];
};

export function getTransactionsApi() {
  return apiFetch<ApiTransaction[] | null>("/transactions").then((data) =>
    Array.isArray(data) ? data : [],
  );
}

export function createIncomingTransactionApi(payload: Omit<IncomingTransaction, "id">) {
  return apiFetch<ApiTransaction>("/transactions/incoming", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createOutgoingTransactionApi(payload: Omit<OutgoingTransaction, "id">) {
  return apiFetch<ApiTransaction>("/transactions/outgoing", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePaymentStatusApi(
  transactionId: string,
  payload: {
    paymentStatus: "paid" | "partial" | "unpaid";
    paidAmount: number;
    pendingAmount: number;
    paymentHistory: PaymentRecord[];
  },
) {
  return apiFetch<ApiTransaction>(`/transactions/${transactionId}/payment-status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function mapIncomingTransaction(tx: ApiTransaction): IncomingTransaction {
  return {
    id: tx.id,
    items: tx.items,
    totalCost: tx.totalAmount,
    paidAmount: tx.paidAmount,
    pendingAmount: tx.pendingAmount,
    paymentStatus: tx.paymentStatus,
    supplierName: tx.contactName,
    supplierContact: tx.contactPhone || undefined,
    previousOutstandingCarried: tx.previousOutstandingCarried,
    date: tx.date,
    notes: tx.notes || undefined,
    billNumber: tx.billNumber,
    paymentHistory: tx.paymentHistory,
  };
}

export function mapOutgoingTransaction(tx: ApiTransaction): OutgoingTransaction {
  return {
    id: tx.id,
    items: tx.items,
    totalRevenue: tx.totalAmount,
    totalProfit: tx.totalProfit || 0,
    paidAmount: tx.paidAmount,
    pendingAmount: tx.pendingAmount,
    paymentStatus: tx.paymentStatus,
    customerName: tx.contactName,
    customerContact: tx.contactPhone || undefined,
    previousOutstandingCarried: tx.previousOutstandingCarried,
    date: tx.date,
    notes: tx.notes || undefined,
    billNumber: tx.billNumber,
    paymentHistory: tx.paymentHistory,
  };
}
