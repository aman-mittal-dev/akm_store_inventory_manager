import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ArrowLeft } from 'lucide-react';
import { formatINR } from '../utils/currency';
import { useInventory } from '../context/InventoryContext';
import { useMemo } from 'react';
import {
  buildCustomerSummaries,
  buildSupplierSummaries,
} from '../utils/partySummaries';
import { encodePartyRouteSegment } from '../utils/party';

export function PartiesDirectory() {
  const { incomingTransactions, outgoingTransactions } = useInventory();

  const customers = useMemo(
    () => buildCustomerSummaries(outgoingTransactions),
    [outgoingTransactions],
  );
  const suppliers = useMemo(
    () => buildSupplierSummaries(incomingTransactions),
    [incomingTransactions],
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-gray-900">
            Customers & Suppliers
          </h2>
          <p className="text-gray-600 mt-1">
            Receivable and payable totals are derived from unpaid amounts on recorded
            bills. Party identity is matched by name + mobile digits.
          </p>
        </div>
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link to="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            Customers
            <Badge variant={customers.length ? 'secondary' : 'outline'}>
              {customers.length} profiles
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-semibold uppercase text-gray-500 px-3 py-2">
            <div className="col-span-4">Name</div>
            <div className="col-span-3">Contact</div>
            <div className="col-span-3 text-right">Receivable (owe us)</div>
            <div className="col-span-2 text-right">Bills</div>
          </div>
          {customers.length === 0 && (
            <p className="text-sm text-gray-500 py-6 text-center">
              No customers yet — sales will appear here automatically.
            </p>
          )}
          {customers.map((c) => {
            const enc = encodePartyRouteSegment(c.partyKey);
            const hasBal = c.receivableOutstanding > 0;
            return (
              <Link
                key={c.partyKey}
                to={`/parties/customer/${enc}`}
                className="block rounded-lg border border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/40 transition-colors"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-1 px-3 py-3 text-sm md:items-center">
                  <div className="md:col-span-4 font-medium text-gray-900">
                    {c.displayName}
                  </div>
                  <div className="md:col-span-3 text-gray-600 text-sm">
                    {c.contact ?? '—'}
                  </div>
                  <div
                    className={`md:col-span-3 md:text-right font-semibold ${hasBal ? 'text-orange-700' : 'text-gray-500'
                      }`}
                  >
                    {formatINR(c.receivableOutstanding)}
                  </div>
                  <div className="md:col-span-2 md:text-right text-gray-600 text-sm">
                    {c.invoiceCount} invoices
                  </div>
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            Suppliers
            <Badge variant={suppliers.length ? 'secondary' : 'outline'}>
              {suppliers.length} profiles
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-semibold uppercase text-gray-500 px-3 py-2">
            <div className="col-span-4">Name</div>
            <div className="col-span-3">Contact</div>
            <div className="col-span-3 text-right">Payable (we owe)</div>
            <div className="col-span-2 text-right">Bills</div>
          </div>
          {suppliers.length === 0 && (
            <p className="text-sm text-gray-500 py-6 text-center">
              No suppliers yet — purchases will appear here automatically.
            </p>
          )}
          {suppliers.map((s) => {
            const enc = encodePartyRouteSegment(s.partyKey);
            const hasBal = s.payableOutstanding > 0;
            return (
              <Link
                key={s.partyKey}
                to={`/parties/supplier/${enc}`}
                className="block rounded-lg border border-gray-100 bg-white hover:border-green-200 hover:bg-green-50/40 transition-colors"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-1 px-3 py-3 text-sm md:items-center">
                  <div className="md:col-span-4 font-medium text-gray-900">
                    {s.displayName}
                  </div>
                  <div className="md:col-span-3 text-gray-600 text-sm">
                    {s.contact ?? '—'}
                  </div>
                  <div
                    className={`md:col-span-3 md:text-right font-semibold ${hasBal ? 'text-red-700' : 'text-gray-500'
                      }`}
                  >
                    {formatINR(s.payableOutstanding)}
                  </div>
                  <div className="md:col-span-2 md:text-right text-gray-600 text-sm">
                    {s.invoiceCount} invoices
                  </div>
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
