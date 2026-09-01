import { useState, useMemo } from "react";
import { useInventory } from "../context/InventoryContext";
import { Link } from "react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./ui/tabs";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { formatINR } from "../utils/currency";
import {
  Users,
  Building2,
  Search,
  FileText,
  TrendingDown,
  TrendingUp,
  Phone,
} from "lucide-react";
import {
  IncomingTransaction,
  OutgoingTransaction,
} from "../types";
import { normalizePartyKey } from "../utils/party";

function partyKey(name: string, contact?: string) {
  return normalizePartyKey(name, contact);
}

interface CustomerParty {
  key: string;
  name: string;
  contact?: string;
  totalBilled: number;
  totalPaid: number;
  totalPending: number;
  transactions: OutgoingTransaction[];
}

interface SupplierParty {
  key: string;
  name: string;
  contact?: string;
  totalBilled: number;
  totalPaid: number;
  totalPending: number;
  transactions: IncomingTransaction[];
}

function PaymentChip({
  status,
}: {
  status: "paid" | "partial" | "unpaid";
}) {
  const map = {
    paid: "bg-green-100 text-green-700",
    partial: "bg-amber-100 text-amber-700",
    unpaid: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function PartyRow({
  name,
  contact,
  totalBilled,
  totalPaid,
  totalPending,
  bills,
  billPath,
}: {
  name: string;
  contact?: string;
  totalBilled: number;
  totalPaid: number;
  totalPending: number;
  bills: {
    billNumber: string;
    date: string;
    total: number;
    pending: number;
    paymentStatus: "paid" | "partial" | "unpaid";
    id: string;
  }[];
  billPath: (id: string) => string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left rounded-lg"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-blue-600">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {name}
            </p>
            {contact && (
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {contact}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6 flex-shrink-0 ml-4">
          <div className="hidden sm:block text-right">
            <p className="text-sm text-gray-600">Billed</p>
            <p className="text-sm font-medium text-gray-900">
              {formatINR(totalBilled)}
            </p>
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-sm text-gray-600">Paid</p>
            <p className="text-sm font-medium text-green-600">
              {formatINR(totalPaid)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Pending</p>
            <p
              className={`text-sm font-semibold ${totalPending > 0 ? "text-red-600" : "text-green-600"}`}
            >
              {formatINR(totalPending)}
            </p>
          </div>
          <span className="text-gray-400 text-sm">
            {open ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-200 divide-y divide-gray-100">
          {bills.map((bill) => (
            <div
              key={bill.id}
              className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {bill.billNumber}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(bill.date).toLocaleDateString(
                      "en-IN",
                      {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      },
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0 ml-3">
                <div className="hidden sm:block text-right">
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatINR(bill.total)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Due</p>
                  <p
                    className={`text-sm font-semibold ${bill.pending > 0 ? "text-red-600" : "text-green-600"}`}
                  >
                    {formatINR(bill.pending)}
                  </p>
                </div>
                <PaymentChip status={bill.paymentStatus} />
                <Link
                  to={billPath(bill.id)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  View Bill
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PartiesDirectory() {
  const { outgoingTransactions, incomingTransactions } =
    useInventory();
  const [search, setSearch] = useState("");

  const customers = useMemo<CustomerParty[]>(() => {
    const map = new Map<string, CustomerParty>();
    for (const tx of outgoingTransactions) {
      const key = partyKey(tx.customerName, tx.customerContact);
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: tx.customerName,
          contact: tx.customerContact,
          totalBilled: 0,
          totalPaid: 0,
          totalPending: 0,
          transactions: [],
        });
      }
      const p = map.get(key)!;
      p.totalBilled += tx.totalRevenue;
      p.totalPaid += tx.paidAmount;
      p.totalPending += tx.pendingAmount;
      p.transactions.push(tx);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.totalPending - a.totalPending,
    );
  }, [outgoingTransactions]);

  const suppliers = useMemo<SupplierParty[]>(() => {
    const map = new Map<string, SupplierParty>();
    for (const tx of incomingTransactions) {
      const key = partyKey(tx.supplierName, tx.supplierContact);
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: tx.supplierName,
          contact: tx.supplierContact,
          totalBilled: 0,
          totalPaid: 0,
          totalPending: 0,
          transactions: [],
        });
      }
      const p = map.get(key)!;
      p.totalBilled += tx.totalCost;
      p.totalPaid += tx.paidAmount;
      p.totalPending += tx.pendingAmount;
      p.transactions.push(tx);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.totalPending - a.totalPending,
    );
  }, [incomingTransactions]);

  const totalReceivables = useMemo(
    () => customers.reduce((s, c) => s + c.totalPending, 0),
    [customers],
  );
  const totalPayables = useMemo(
    () => suppliers.reduce((s, c) => s + c.totalPending, 0),
    [suppliers],
  );

  const filteredCustomers = useMemo(
    () =>
      customers.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.contact && c.contact.includes(search)),
      ),
    [customers, search],
  );

  const filteredSuppliers = useMemo(
    () =>
      suppliers.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          (s.contact && s.contact.includes(search)),
      ),
    [suppliers, search],
  );

  return (
    <div className="space-y-6">
      {/* Page header — matches Dashboard / Analytics */}
      <div>
        <h2 className="text-3xl font-semibold text-gray-900">
          Customers & Suppliers
        </h2>
        <p className="text-gray-600 mt-2">
          Receivables from customers · Payables to suppliers ·
          Matched by name & mobile
        </p>
      </div>

      {/* Summary cards — identical structure to Dashboard stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Receivables
            </CardTitle>
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-blue-600">
              {formatINR(totalReceivables)}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Pending from customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Payables
            </CardTitle>
            <TrendingDown className="w-5 h-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-red-600">
              {formatINR(totalPayables)}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Due to suppliers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Customers
            </CardTitle>
            <Users className="w-5 h-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-gray-900">
              {customers.length}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Unique customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Suppliers
            </CardTitle>
            <Building2 className="w-5 h-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-gray-900">
              {suppliers.length}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Unique suppliers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs — same structure as TransactionHistory */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="customers">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger
                value="customers"
                className="flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Customers ({customers.length})
              </TabsTrigger>
              <TabsTrigger
                value="suppliers"
                className="flex items-center gap-2"
              >
                <Building2 className="w-4 h-4" />
                Suppliers ({suppliers.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="customers" className="mt-6">
              <div className="space-y-4">
                {filteredCustomers.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {search
                      ? "No customers match your search"
                      : "No customers yet — record a sale to see them here"}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>
                        {filteredCustomers.length} customer
                        {filteredCustomers.length !== 1
                          ? "s"
                          : ""}
                      </span>
                      <span>
                        Total receivable:{" "}
                        <strong className="text-gray-900">
                          {formatINR(totalReceivables)}
                        </strong>
                      </span>
                    </div>
                    {filteredCustomers.map((c) => (
                      <PartyRow
                        key={c.key}
                        name={c.name}
                        contact={c.contact}
                        totalBilled={c.totalBilled}
                        totalPaid={c.totalPaid}
                        totalPending={c.totalPending}
                        bills={c.transactions.map((tx) => ({
                          id: tx.billNumber,
                          billNumber: tx.billNumber,
                          date: tx.date,
                          total: tx.totalRevenue,
                          pending: tx.pendingAmount,
                          paymentStatus: tx.paymentStatus,
                        }))}
                        billPath={(id) => `/bill/${id}`}
                      />
                    ))}
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="suppliers" className="mt-6">
              <div className="space-y-4">
                {filteredSuppliers.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {search
                      ? "No suppliers match your search"
                      : "No suppliers yet — record a purchase to see them here"}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>
                        {filteredSuppliers.length} supplier
                        {filteredSuppliers.length !== 1
                          ? "s"
                          : ""}
                      </span>
                      <span>
                        Total payable:{" "}
                        <strong className="text-gray-900">
                          {formatINR(totalPayables)}
                        </strong>
                      </span>
                    </div>
                    {filteredSuppliers.map((s) => (
                      <PartyRow
                        key={s.key}
                        name={s.name}
                        contact={s.contact}
                        totalBilled={s.totalBilled}
                        totalPaid={s.totalPaid}
                        totalPending={s.totalPending}
                        bills={s.transactions.map((tx) => ({
                          id: tx.billNumber,
                          billNumber: tx.billNumber,
                          date: tx.date,
                          total: tx.totalCost,
                          pending: tx.pendingAmount,
                          paymentStatus: tx.paymentStatus,
                        }))}
                        billPath={(id) => `/bill/${id}`}
                      />
                    ))}
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}