import { apiFetch } from "../lib/api";

interface SavePrintedBillPayload {
  billNumber: string;
  billFormat: "full" | "compact";
  invoiceType: "internal" | "customer";
  fileName: string;
  pdfBase64: string;
}

export function savePrintedBillApi(payload: SavePrintedBillPayload) {
  return apiFetch("/bills/print-records", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type BillDeliveryRow = {
  id: string;
  billNumber: string;
  printedBillId: string | null;
  channel: string;
  provider: string;
  recipientEmail: string | null;
  recipientPhoneE164: string | null;
  sendMode: string;
  scheduledAt: string | null;
  status: string;
  isResend: boolean;
  errorMessage: string | null;
  providerMessageId: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type DeliverBillPayload = {
  channel: "email" | "whatsapp";
  provider: "sendgrid" | "smtp_brevo" | "twilio_whatsapp" | "meta_whatsapp";
  recipientEmail?: string;
  recipientPhoneE164?: string;
  sendMode: "now" | "later";
  scheduledAt?: string | null;
  pdfBase64?: string | null;
  fileName?: string | null;
  billFormat?: "full" | "compact";
  invoiceType?: "internal" | "customer";
  isResend?: boolean;
};

export function listBillDeliveries(billNumber: string) {
  return apiFetch<BillDeliveryRow[]>(
    `/bills/${encodeURIComponent(billNumber)}/deliveries`,
  );
}

export function deliverBill(billNumber: string, payload: DeliverBillPayload) {
  return apiFetch<BillDeliveryRow>(`/bills/${encodeURIComponent(billNumber)}/deliver`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
