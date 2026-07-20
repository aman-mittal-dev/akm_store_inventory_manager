import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, FileText, Save } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { formatINR } from '../utils/currency';
import { useInventory } from '../context/InventoryContext';
import { decodePartyRouteSegment } from '../utils/party';
import {
  incomingForPartyKey,
  outgoingForPartyKey,
  payableOutstandingForPartyKey,
  receivableOutstandingForPartyKey,
} from '../utils/partySummaries';
import {
  getPartyProfile,
  setPartyProfile,
  type PartyType,
} from '../utils/partyProfiles';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import { toast } from 'sonner';
import type { IncomingTransaction, OutgoingTransaction } from '../types';

type Kind = 'customer' | 'supplier';

export function PartyDetail() {
  const { partyKind, partyKeyEncoded } = useParams<{
    partyKind: string;
    partyKeyEncoded: string;
  }>();
  const navigate = useNavigate();
  const { incomingTransactions, outgoingTransactions } = useInventory();

  const kind: Kind =
    partyKind === 'supplier' ? 'supplier' : 'customer';

  const [partyKey, setPartyKey] = useState<string | null>(null);
  const [profileEmail, setProfileEmail] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [profileGst, setProfileGst] = useState('');
  const [profileNotes, setProfileNotes] = useState('');

  useEffect(() => {
    if (!partyKeyEncoded) {
      navigate('/parties');
      return;
    }
    try {
      const decoded = decodePartyRouteSegment(partyKeyEncoded);
      setPartyKey(decoded);
    } catch {
      toast.error('Invalid party link');
      navigate('/parties');
    }
  }, [partyKeyEncoded, navigate]);

  const partyType: PartyType = kind === 'customer' ? 'customer' : 'supplier';

  useEffect(() => {
    if (!partyKey) return;
    const p = getPartyProfile(partyType, partyKey);
    setProfileEmail(p.email ?? '');
    setProfileAddress(p.address ?? '');
    setProfileGst(p.gstNumber ?? '');
    setProfileNotes(p.notes ?? '');
  }, [partyKey, partyType]);

  const displayNameContact = useMemo(() => {
    if (!partyKey) return { name: '', contact: '' };
    const pipe = partyKey.indexOf('|');
    const rawName = pipe >= 0 ? partyKey.slice(0, pipe) : partyKey;
    const phoneDigits = pipe >= 0 ? partyKey.slice(pipe + 1) : '';
    const contactFmt = phoneDigits || '';
    const prettyName =
      rawName
        .trim()
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ') || 'Unknown';
    return { name: prettyName, contact: contactFmt };
  }, [partyKey]);

  const receivable =
    partyKey && kind === 'customer'
      ? receivableOutstandingForPartyKey(outgoingTransactions, partyKey)
      : 0;
  const payable =
    partyKey && kind === 'supplier'
      ? payableOutstandingForPartyKey(incomingTransactions, partyKey)
      : 0;

  const salesList = useMemo(
    () =>
      partyKey ? outgoingForPartyKey(outgoingTransactions, partyKey) : [],
    [partyKey, outgoingTransactions],
  );

  const purchaseList = useMemo(
    () =>
      partyKey ? incomingForPartyKey(incomingTransactions, partyKey) : [],
    [partyKey, incomingTransactions],
  );

  const invoices: (OutgoingTransaction | IncomingTransaction)[] =
    kind === 'customer' ? salesList : purchaseList;

  const persistProfile = () => {
    if (!partyKey) return;
    setPartyProfile(partyType, partyKey, {
      email: profileEmail || undefined,
      address: profileAddress || undefined,
      gstNumber: profileGst || undefined,
      notes: profileNotes || undefined,
    });
    toast.success('Details saved locally');
  };

  if (!partyKey) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        Loading party...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button variant="outline" asChild className="w-fit">
          <Link to="/parties">
            <ArrowLeft className="w-4 h-4 mr-2" />
            All parties
          </Link>
        </Button>
        <Button variant="outline" asChild size="sm" className="w-fit">
          <Link to={kind === 'customer' ? '/outgoing-stock' : '/incoming-stock'}>
            Record new {kind === 'customer' ? 'sale' : 'purchase'}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-2xl">
                {displayNameContact.name}
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Contact:{' '}
                {displayNameContact.contact || '—'}{' '}
                <span className="text-xs text-gray-400">
                  ({kind})
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                Party key hashed in URL — same name + same mobile digits merge
              </Badge>
              {kind === 'customer' && (
                <Badge className={receivable > 0 ? 'bg-orange-100 text-orange-900' : ''}>
                  Receivable: {formatINR(receivable)}
                </Badge>
              )}
              {kind === 'supplier' && (
                <Badge className={payable > 0 ? 'bg-red-100 text-red-900' : ''}>
                  Payable: {formatINR(payable)}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="pEmail">Email</Label>
              <Input
                id="pEmail"
                type="email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                placeholder="Optional — stored only in browser"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pGst">{kind === 'customer' ? 'GST (if billed)' : 'Supplier GST / tax ID'}</Label>
              <Input
                id="pGst"
                value={profileGst}
                onChange={(e) => setProfileGst(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="pAddr">Address</Label>
              <Textarea
                id="pAddr"
                rows={3}
                value={profileAddress}
                onChange={(e) => setProfileAddress(e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="pNotes">Notes</Label>
              <Textarea
                id="pNotes"
                rows={3}
                value={profileNotes}
                onChange={(e) => setProfileNotes(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={persistProfile}>
            <Save className="w-4 h-4 mr-2" />
            Save profile (local browser)
          </Button>
          <p className="text-xs text-gray-500">
            Stored in <code>localStorage</code> until backend party APIs are wired.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{kind === 'customer' ? 'Sales invoices' : 'Purchase invoices'}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {invoices.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              No invoices for this party yet.
            </p>
          ) : (
            invoices.map((inv) => {
              const isOut = kind === 'customer';
              const bill = inv.billNumber;
              const totalAmt = isOut
                ? (inv as OutgoingTransaction).totalRevenue
                : (inv as IncomingTransaction).totalCost;
              const prev = inv.previousOutstandingCarried ?? 0;
              return (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-4 px-2"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/bill/${bill}`}
                      className="font-medium text-blue-700 hover:underline inline-flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4 shrink-0" />
                      {bill}
                    </Link>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(inv.date).toLocaleString('en-IN')}
                      {prev > 0 && (
                        <span className="ml-2 text-amber-800">
                          Includes prior ₹{prev.toFixed(2)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">{formatINR(totalAmt)}</p>
                    <PaymentStatusBadge status={inv.paymentStatus} />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
