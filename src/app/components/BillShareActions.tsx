import { useEffect, useMemo, useState } from 'react';
import { Mail, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  BillDeliveryRow,
  deliverBill,
  getDeliveryConfig,
  type DeliveryConfig,
} from '../services/billService';
import { humanizeApiError } from '../utils/apiErrors';

type ShareChannel = 'email' | 'whatsapp';

type Props = {
  billNumber: string;
  logs: BillDeliveryRow[];
  onRefreshLogs: () => Promise<void>;
  billFormat: 'full' | 'compact';
  invoiceType: 'internal' | 'customer';
  defaultEmail?: string;
  defaultPhone?: string;
  onCapturePdfBase64: () => Promise<{ base64: string; fileName: string } | null>;
};

export function BillShareActions({
  billNumber,
  logs,
  onRefreshLogs,
  billFormat,
  invoiceType,
  defaultEmail = '',
  defaultPhone = '',
  onCapturePdfBase64,
}: Props) {
  const [config, setConfig] = useState<DeliveryConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [sending, setSending] = useState(false);
  const [openChannel, setOpenChannel] = useState<ShareChannel | null>(null);
  const [recipientEmail, setRecipientEmail] = useState(defaultEmail);
  const [recipientPhone, setRecipientPhone] = useState(defaultPhone);
  const [scheduleLater, setScheduleLater] = useState(false);
  const [scheduledLocal, setScheduledLocal] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadingConfig(true);
    getDeliveryConfig()
      .then((c) => {
        if (!cancelled) setConfig(c);
      })
      .catch(() => {
        if (!cancelled) setConfig({ emailEnabled: false, whatsappEnabled: false });
      })
      .finally(() => {
        if (!cancelled) setLoadingConfig(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setRecipientEmail(defaultEmail);
    setRecipientPhone(defaultPhone);
  }, [defaultEmail, defaultPhone]);

  const lastSent = useMemo(() => {
    let email: BillDeliveryRow | undefined;
    let whatsapp: BillDeliveryRow | undefined;
    for (const row of logs) {
      if (row.status !== 'sent' || !row.sentAt) continue;
      if (row.channel === 'email' && (!email || new Date(row.sentAt) > new Date(email.sentAt!))) {
        email = row;
      }
      if (row.channel === 'whatsapp' && (!whatsapp || new Date(row.sentAt) > new Date(whatsapp.sentAt!))) {
        whatsapp = row;
      }
    }
    return { email, whatsapp };
  }, [logs]);

  const openShare = (channel: ShareChannel) => {
    setOpenChannel(channel);
    setScheduleLater(false);
    setScheduledLocal('');
    if (channel === 'email') {
      setRecipientEmail((prev) => prev || defaultEmail);
    } else {
      setRecipientPhone((prev) => prev || defaultPhone);
    }
  };

  const closeShare = () => {
    if (!sending) setOpenChannel(null);
  };

  const handleSend = async () => {
    if (!openChannel) return;

    const channel = openChannel;
    if (channel === 'email' && !recipientEmail.trim()) {
      toast.error('Enter the recipient email address.');
      return;
    }
    if (channel === 'whatsapp' && !recipientPhone.trim()) {
      toast.error('Enter the recipient phone number (with country code, e.g. +91…).');
      return;
    }

    let scheduledAt: string | null = null;
    if (scheduleLater) {
      if (!scheduledLocal) {
        toast.error('Choose when to send this bill.');
        return;
      }
      const d = new Date(scheduledLocal);
      if (Number.isNaN(d.getTime())) {
        toast.error('Invalid date and time.');
        return;
      }
      scheduledAt = d.toISOString();
    }

    const alreadySent = logs.some((l) => l.channel === channel && l.status === 'sent');

    setSending(true);
    try {
      const pdf = await onCapturePdfBase64();
      await deliverBill(billNumber, {
        channel,
        sendMode: scheduleLater ? 'later' : 'now',
        scheduledAt: scheduleLater ? scheduledAt : null,
        billFormat,
        invoiceType,
        isResend: alreadySent,
        ...(pdf ? { pdfBase64: pdf.base64, fileName: pdf.fileName } : {}),
        ...(channel === 'email'
          ? { recipientEmail: recipientEmail.trim() }
          : { recipientPhoneE164: recipientPhone.trim() }),
      });

      toast.success(
        scheduleLater
          ? channel === 'email'
            ? 'Bill scheduled to email.'
            : 'Bill scheduled for WhatsApp.'
          : channel === 'email'
            ? 'Bill sent by email.'
            : 'Bill sent on WhatsApp.',
      );
      setOpenChannel(null);
      await onRefreshLogs();
    } catch (err) {
      toast.error(humanizeApiError(err, 'Could not send this bill.'));
    } finally {
      setSending(false);
    }
  };

  const emailTitle = lastSent.email
    ? `Email sent ${new Date(lastSent.email.sentAt!).toLocaleString()}`
    : config?.emailEnabled
      ? 'Send bill by email'
      : 'Email not configured on server';

  const waTitle = lastSent.whatsapp
    ? `WhatsApp sent ${new Date(lastSent.whatsapp.sentAt!).toLocaleString()}`
    : config?.whatsappEnabled
      ? 'Send bill on WhatsApp'
      : 'WhatsApp not configured on server';

  return (
    <>
      <div className="flex items-center gap-1 print:hidden" aria-label="Share bill">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
          disabled={loadingConfig || !config?.emailEnabled || sending}
          title={emailTitle}
          aria-label="Share by email"
          onClick={() => openShare('email')}
        >
          <Mail className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-slate-600 hover:text-[#25D366] hover:bg-green-50"
          disabled={loadingConfig || !config?.whatsappEnabled || sending}
          title={waTitle}
          aria-label="Share on WhatsApp"
          onClick={() => openShare('whatsapp')}
        >
          <MessageCircle className="h-5 w-5" />
        </Button>
      </div>

      <Dialog open={openChannel !== null} onOpenChange={(open) => !open && closeShare()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {openChannel === 'email' ? (
                <>
                  <Mail className="h-5 w-5 text-blue-600" />
                  Send bill by email
                </>
              ) : (
                <>
                  <MessageCircle className="h-5 w-5 text-[#25D366]" />
                  Send bill on WhatsApp
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {openChannel === 'email' ? (
            <div className="space-y-2">
              <Label htmlFor="share-email">Recipient email</Label>
              <Input
                id="share-email"
                type="email"
                autoFocus
                placeholder="customer@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                The invoice PDF is sent via your configured email service (SendGrid or SMTP/Brevo).
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="share-phone">Recipient phone</Label>
              <Input
                id="share-phone"
                type="tel"
                autoFocus
                placeholder="+911234567890"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Include country code (E.164). Sent via Meta WhatsApp Cloud API or Twilio, configured on the server.
              </p>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={scheduleLater}
                onChange={(e) => setScheduleLater(e.target.checked)}
                className="rounded border-slate-300"
              />
              Schedule for later
            </label>
            {scheduleLater && (
              <Input
                type="datetime-local"
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
              />
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeShare} disabled={sending}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSend()} disabled={sending}>
              {sending
                ? 'Sending…'
                : scheduleLater
                  ? 'Schedule'
                  : lastSent[openChannel === 'email' ? 'email' : 'whatsapp']
                    ? 'Send again'
                    : 'Send now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
