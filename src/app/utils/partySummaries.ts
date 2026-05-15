import type { IncomingTransaction, OutgoingTransaction } from '../types';
import { normalizePartyKey, roundMoney } from './party';

export interface CustomerPartySummary {
  partyKey: string;
  displayName: string;
  contact?: string;
  /** Amount this customer owes you (sum of pending on sales). */
  receivableOutstanding: number;
  invoiceCount: number;
}

export interface SupplierPartySummary {
  partyKey: string;
  displayName: string;
  contact?: string;
  /** Amount you owe this supplier (sum of pending on purchases). */
  payableOutstanding: number;
  invoiceCount: number;
}

export function buildCustomerSummaries(outgoing: OutgoingTransaction[]): CustomerPartySummary[] {
  const map = new Map<string, CustomerPartySummary>();
  for (const t of outgoing) {
    const key = normalizePartyKey(t.customerName, t.customerContact);
    const prev = map.get(key);
    const receivable = roundMoney((prev?.receivableOutstanding ?? 0) + t.pendingAmount);
    map.set(key, {
      partyKey: key,
      displayName: t.customerName.trim(),
      contact: t.customerContact?.trim() || undefined,
      receivableOutstanding: receivable,
      invoiceCount: (prev?.invoiceCount ?? 0) + 1,
    });
  }
  return [...map.values()].sort((a, b) =>
    Math.abs(b.receivableOutstanding) - Math.abs(a.receivableOutstanding)
  );
}

export function buildSupplierSummaries(incoming: IncomingTransaction[]): SupplierPartySummary[] {
  const map = new Map<string, SupplierPartySummary>();
  for (const t of incoming) {
    const key = normalizePartyKey(t.supplierName, t.supplierContact);
    const prev = map.get(key);
    const payable = roundMoney((prev?.payableOutstanding ?? 0) + t.pendingAmount);
    map.set(key, {
      partyKey: key,
      displayName: t.supplierName.trim(),
      contact: t.supplierContact?.trim() || undefined,
      payableOutstanding: payable,
      invoiceCount: (prev?.invoiceCount ?? 0) + 1,
    });
  }
  return [...map.values()].sort((a, b) =>
    Math.abs(b.payableOutstanding) - Math.abs(a.payableOutstanding)
  );
}

export function outgoingForPartyKey(transactions: OutgoingTransaction[], partyKey: string): OutgoingTransaction[] {
  return transactions
    .filter((t) => normalizePartyKey(t.customerName, t.customerContact) === partyKey)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function incomingForPartyKey(transactions: IncomingTransaction[], partyKey: string): IncomingTransaction[] {
  return transactions
    .filter((t) => normalizePartyKey(t.supplierName, t.supplierContact) === partyKey)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function receivableOutstandingForPartyKey(transactions: OutgoingTransaction[], partyKey: string): number {
  return roundMoney(transactions.reduce((sum, t) => {
    if (normalizePartyKey(t.customerName, t.customerContact) !== partyKey) return sum;
    return sum + t.pendingAmount;
  }, 0));
}

export function payableOutstandingForPartyKey(transactions: IncomingTransaction[], partyKey: string): number {
  return roundMoney(transactions.reduce((sum, t) => {
    if (normalizePartyKey(t.supplierName, t.supplierContact) !== partyKey) return sum;
    return sum + t.pendingAmount;
  }, 0));
}
