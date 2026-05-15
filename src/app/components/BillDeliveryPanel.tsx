import { useMemo, useState } from "react";
import { BillDeliveryRow, DeliverBillPayload, deliverBill } from "../services/billService";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { Mail, MessageCircle, Send, Clock } from "lucide-react";
import { humanizeApiError } from "../utils/apiErrors";

type Channel = "email" | "whatsapp";
type EmailProvider = "sendgrid" | "smtp_brevo";
type WaProvider = "twilio_whatsapp" | "meta_whatsapp";

type Props = {
  billNumber: string;
  logs: BillDeliveryRow[];
  loadingLogs: boolean;
  onRefreshLogs: () => Promise<void>;
  billFormat: "full" | "compact";
  invoiceType: "internal" | "customer";
  /** Capture current bill as PDF for sending; if null, backend uses latest saved print record. */
  onCapturePdfBase64: () => Promise<{ base64: string; fileName: string } | null>;
};

function formatDispatchLine(d: BillDeliveryRow): string {
  const ch = d.channel === "email" ? "Email" : "WhatsApp";
  const when = d.sentAt || d.scheduledAt || d.createdAt;
  const dt = new Date(when).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  if (d.status === "sent") {
    return `${ch} sent ${dt}${d.isResend ? " (resend)" : ""}`;
  }
  if (d.status === "scheduled") {
    return `${ch} scheduled ${new Date(d.scheduledAt || d.createdAt).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })}`;
  }
  if (d.status === "failed") {
    return `${ch} failed ${dt}`;
  }
  return `${ch} ${d.status} ${dt}`;
}

export function BillDeliveryPanel({
  billNumber,
  logs,
  loadingLogs,
  onRefreshLogs,
  billFormat,
  invoiceType,
  onCapturePdfBase64,
}: Props) {
  const [sending, setSending] = useState(false);

  const [channel, setChannel] = useState<Channel>("email");
  const [emailProvider, setEmailProvider] = useState<EmailProvider>("sendgrid");
  const [waProvider, setWaProvider] = useState<WaProvider>("meta_whatsapp");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [timing, setTiming] = useState<"now" | "later">("now");
  const [scheduledLocal, setScheduledLocal] = useState("");

  const summaryBadges = useMemo(() => {
    let lastEmail: BillDeliveryRow | undefined;
    let lastWa: BillDeliveryRow | undefined;
    for (const r of logs) {
      if (r.channel === "email" && r.status === "sent" && (!lastEmail || new Date(r.sentAt || 0) > new Date(lastEmail.sentAt || 0))) {
        lastEmail = r;
      }
      if (r.channel === "whatsapp" && r.status === "sent" && (!lastWa || new Date(r.sentAt || 0) > new Date(lastWa.sentAt || 0))) {
        lastWa = r;
      }
    }
    return { lastEmail, lastWa };
  }, [logs]);

  const handleSubmit = async (isResend: boolean) => {
    setSending(true);
    try {
      const pdf = await onCapturePdfBase64();
      const pdfBase64 = pdf?.base64;
      const fileName = pdf?.fileName;

      const provider: DeliverBillPayload["provider"] =
        channel === "email"
          ? emailProvider
          : waProvider;

      let scheduledAt: string | null = null;
      if (timing === "later") {
        if (!scheduledLocal) {
          toast.error("Choose date and time for “Send later”.");
          setSending(false);
          return;
        }
        const d = new Date(scheduledLocal);
        if (Number.isNaN(d.getTime())) {
          toast.error("Invalid schedule date.");
          setSending(false);
          return;
        }
        scheduledAt = d.toISOString();
      }

      const body: DeliverBillPayload = {
        channel,
        provider,
        sendMode: timing,
        scheduledAt: timing === "later" ? scheduledAt : null,
        billFormat,
        invoiceType,
        isResend,
      };
      if (pdfBase64) {
        body.pdfBase64 = pdfBase64;
        body.fileName = fileName ?? null;
      }
      if (channel === "email") {
        body.recipientEmail = recipientEmail.trim();
      } else {
        body.recipientPhoneE164 = recipientPhone.trim();
      }

      await deliverBill(billNumber, body);
      toast.success(
        timing === "now"
          ? "Bill send request completed. Check the log below for status."
          : "Bill send scheduled. You will see it in the log when it runs.",
      );
      await onRefreshLogs();
    } catch (err) {
      toast.error(humanizeApiError(err, "We could not send this bill."));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="print:hidden border-slate-200 p-4 max-w-3xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Send className="w-4 h-4" />
            Send bill
          </h3>
          <p className="text-xs text-slate-600 mt-1">
            Email (SendGrid or SMTP/Brevo) or WhatsApp (Twilio or Meta Cloud API). Logs below include every send and resend.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-700">
          {summaryBadges.lastEmail && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 border border-emerald-100">
              <Mail className="w-3.5 h-3.5" />
              Email last sent{" "}
              {new Date(summaryBadges.lastEmail.sentAt || "").toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          )}
          {summaryBadges.lastWa && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 border border-green-100">
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp last sent{" "}
              {new Date(summaryBadges.lastWa.sentAt || "").toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-slate-600">Channel</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
            value={channel}
            onChange={(e) => setChannel(e.target.value as Channel)}
          >
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Provider</span>
          {channel === "email" ? (
            <select
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
              value={emailProvider}
              onChange={(e) => setEmailProvider(e.target.value as EmailProvider)}
            >
              <option value="sendgrid">SendGrid (API key)</option>
              <option value="smtp_brevo">SMTP (Brevo / Sendinblue)</option>
            </select>
          ) : (
            <select
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
              value={waProvider}
              onChange={(e) => setWaProvider(e.target.value as WaProvider)}
            >
              <option value="meta_whatsapp">Meta WhatsApp Cloud API</option>
              <option value="twilio_whatsapp">Twilio WhatsApp</option>
            </select>
          )}
        </label>
      </div>

      {channel === "email" ? (
        <label className="mt-3 block text-sm">
          <span className="text-slate-600">Recipient email</span>
          <input
            type="email"
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="customer@example.com"
          />
        </label>
      ) : (
        <label className="mt-3 block text-sm">
          <span className="text-slate-600">Recipient phone (E.164, e.g. +9198…)</span>
          <input
            type="tel"
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
            value={recipientPhone}
            onChange={(e) => setRecipientPhone(e.target.value)}
            placeholder="+911234567890"
          />
        </label>
      )}

      <div className="mt-4 flex flex-col gap-3">
        <span className="text-xs font-medium text-slate-700">When to send</span>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={timing === "now" ? "default" : "outline"}
            onClick={() => setTiming("now")}
            className="gap-1"
          >
            <Send className="w-3.5 h-3.5" />
            Send now
          </Button>
          <Button
            type="button"
            size="sm"
            variant={timing === "later" ? "default" : "outline"}
            onClick={() => setTiming("later")}
            className="gap-1"
          >
            <Clock className="w-3.5 h-3.5" />
            Send later
          </Button>
        </div>
        {timing === "later" && (
          <input
            type="datetime-local"
            className="max-w-xs rounded-md border border-slate-300 px-2 py-2 text-sm"
            value={scheduledLocal}
            onChange={(e) => setScheduledLocal(e.target.value)}
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" disabled={sending} onClick={() => void handleSubmit(false)}>
          {sending ? "Sending…" : timing === "now" ? "Send bill" : "Schedule send"}
        </Button>
        <Button type="button" variant="outline" disabled={sending} onClick={() => void handleSubmit(true)}>
          {sending ? "Sending…" : "Resend (log as resend)"}
        </Button>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="text-xs font-medium text-slate-700 mb-2">Dispatch log</div>
        {loadingLogs ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="text-xs text-slate-500">No sends yet for this bill.</p>
        ) : (
          <ul className="space-y-1 max-h-40 overflow-y-auto text-xs text-slate-600">
            {logs.map((d) => (
              <li key={d.id} className="flex flex-col sm:flex-row sm:justify-between sm:gap-2">
                <span>{formatDispatchLine(d)}</span>
                <span className="text-slate-400 shrink-0">
                  {d.provider} · {d.status}
                  {d.errorMessage ? ` — ${d.errorMessage.slice(0, 80)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
