// import { useState, useMemo } from 'react';
// import { useInventory } from '../context/InventoryContext';
// import { Link } from 'react-router';
// import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
// import { Badge } from './ui/badge';
// import { Input } from './ui/input';
// import { formatINR } from '../utils/currency';
// import { Users, Building2, Search, FileText, TrendingDown, TrendingUp, Phone, IndianRupee } from 'lucide-react';
// import { IncomingTransaction, OutgoingTransaction } from '../types';

// // Normalise a contact string to digits only for matching
// function normaliseContact(contact?: string) {
//   if (!contact) return '';
//   return contact.replace(/\D/g, '').slice(-10);
// }

// // Build a party key from name + last-10-digits of mobile
// function partyKey(name: string, contact?: string) {
//   const digits = normaliseContact(contact);
//   return `${name.trim().toLowerCase()}|${digits}`;
// }

// interface CustomerParty {
//   key: string;
//   name: string;
//   contact?: string;
//   totalBilled: number;
//   totalPaid: number;
//   totalPending: number;
//   transactions: OutgoingTransaction[];
// }

// interface SupplierParty {
//   key: string;
//   name: string;
//   contact?: string;
//   totalBilled: number;
//   totalPaid: number;
//   totalPending: number;
//   transactions: IncomingTransaction[];
// }

// function PaymentChip({ status }: { status: 'paid' | 'partial' | 'unpaid' }) {
//   const map = {
//     paid: 'bg-green-100 text-green-700',
//     partial: 'bg-amber-100 text-amber-700',
//     unpaid: 'bg-red-100 text-red-700',
//   };
//   return (
//     <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status]}`}>
//       {status.charAt(0).toUpperCase() + status.slice(1)}
//     </span>
//   );
// }

// function SummaryCard({ label, amount, icon: Icon, colorClass }: {
//   label: string; amount: number; icon: React.ElementType; colorClass: string
// }) {
//   return (
//     <Card className="border-border">
//       <CardContent className="p-5 flex items-center gap-4">
//         <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass}`}>
//           <Icon className="w-5 h-5" />
//         </div>
//         <div>
//           <p className="text-xs text-muted-foreground">{label}</p>
//           <p className="text-xl font-bold text-foreground">{formatINR(amount)}</p>
//         </div>
//       </CardContent>
//     </Card>
//   );
// }

// function PartyRow({ name, contact, totalBilled, totalPaid, totalPending, bills, billPath }: {
//   name: string;
//   contact?: string;
//   totalBilled: number;
//   totalPaid: number;
//   totalPending: number;
//   bills: { billNumber: string; date: string; total: number; pending: number; paymentStatus: 'paid' | 'partial' | 'unpaid'; id: string }[];
//   billPath: (id: string) => string;
// }) {
//   const [open, setOpen] = useState(false);

//   return (
//     <div className="border border-border rounded-xl overflow-hidden">
//       <button
//         onClick={() => setOpen(o => !o)}
//         className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/40 transition-colors text-left"
//       >
//         <div className="flex items-center gap-3 min-w-0">
//           <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
//             <span className="text-sm font-bold text-primary">{name.charAt(0).toUpperCase()}</span>
//           </div>
//           <div className="min-w-0">
//             <p className="font-semibold text-foreground truncate">{name}</p>
//             {contact && (
//               <p className="text-xs text-muted-foreground flex items-center gap-1">
//                 <Phone className="w-3 h-3" />{contact}
//               </p>
//             )}
//           </div>
//         </div>
//         <div className="flex items-center gap-6 flex-shrink-0 ml-4">
//           <div className="hidden sm:block text-right">
//             <p className="text-xs text-muted-foreground">Billed</p>
//             <p className="text-sm font-semibold text-foreground">{formatINR(totalBilled)}</p>
//           </div>
//           <div className="hidden sm:block text-right">
//             <p className="text-xs text-muted-foreground">Paid</p>
//             <p className="text-sm font-semibold text-green-600">{formatINR(totalPaid)}</p>
//           </div>
//           <div className="text-right">
//             <p className="text-xs text-muted-foreground">Pending</p>
//             <p className={`text-sm font-bold ${totalPending > 0 ? 'text-red-600' : 'text-green-600'}`}>
//               {formatINR(totalPending)}
//             </p>
//           </div>
//           <span className="text-muted-foreground text-lg">{open ? '▲' : '▼'}</span>
//         </div>
//       </button>

//       {open && (
//         <div className="border-t border-border divide-y divide-border">
//           {bills.map(bill => (
//             <div key={bill.id} className="px-5 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors">
//               <div className="flex items-center gap-3 min-w-0">
//                 <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
//                 <div className="min-w-0">
//                   <p className="text-sm font-medium text-foreground">{bill.billNumber}</p>
//                   <p className="text-xs text-muted-foreground">
//                     {new Date(bill.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
//                   </p>
//                 </div>
//               </div>
//               <div className="flex items-center gap-4 flex-shrink-0 ml-3">
//                 <div className="hidden sm:block text-right">
//                   <p className="text-xs text-muted-foreground">Total</p>
//                   <p className="text-sm font-medium text-foreground">{formatINR(bill.total)}</p>
//                 </div>
//                 <div className="text-right">
//                   <p className="text-xs text-muted-foreground">Due</p>
//                   <p className={`text-sm font-semibold ${bill.pending > 0 ? 'text-red-600' : 'text-green-600'}`}>
//                     {formatINR(bill.pending)}
//                   </p>
//                 </div>
//                 <PaymentChip status={bill.paymentStatus} />
//                 <Link
//                   to={billPath(bill.id)}
//                   className="text-xs text-primary hover:underline font-medium"
//                   onClick={e => e.stopPropagation()}
//                 >
//                   View
//                 </Link>
//               </div>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// export function CustomersSuppliers() {
//   const { outgoingTransactions, incomingTransactions } = useInventory();
//   const [search, setSearch] = useState('');

//   const customers = useMemo<CustomerParty[]>(() => {
//     const map = new Map<string, CustomerParty>();
//     for (const tx of outgoingTransactions) {
//       const key = partyKey(tx.customerName, tx.customerContact);
//       if (!map.has(key)) {
//         map.set(key, {
//           key,
//           name: tx.customerName,
//           contact: tx.customerContact,
//           totalBilled: 0,
//           totalPaid: 0,
//           totalPending: 0,
//           transactions: [],
//         });
//       }
//       const party = map.get(key)!;
//       party.totalBilled += tx.totalRevenue;
//       party.totalPaid += tx.paidAmount;
//       party.totalPending += tx.pendingAmount;
//       party.transactions.push(tx);
//     }
//     return Array.from(map.values()).sort((a, b) => b.totalPending - a.totalPending);
//   }, [outgoingTransactions]);

//   const suppliers = useMemo<SupplierParty[]>(() => {
//     const map = new Map<string, SupplierParty>();
//     for (const tx of incomingTransactions) {
//       const key = partyKey(tx.supplierName, tx.supplierContact);
//       if (!map.has(key)) {
//         map.set(key, {
//           key,
//           name: tx.supplierName,
//           contact: tx.supplierContact,
//           totalBilled: 0,
//           totalPaid: 0,
//           totalPending: 0,
//           transactions: [],
//         });
//       }
//       const party = map.get(key)!;
//       party.totalBilled += tx.totalCost;
//       party.totalPaid += tx.paidAmount;
//       party.totalPending += tx.pendingAmount;
//       party.transactions.push(tx);
//     }
//     return Array.from(map.values()).sort((a, b) => b.totalPending - a.totalPending);
//   }, [incomingTransactions]);

//   const totalReceivables = useMemo(() => customers.reduce((s, c) => s + c.totalPending, 0), [customers]);
//   const totalPayables = useMemo(() => suppliers.reduce((s, c) => s + c.totalPending, 0), [suppliers]);

//   const filteredCustomers = useMemo(() =>
//     customers.filter(c =>
//       c.name.toLowerCase().includes(search.toLowerCase()) ||
//       (c.contact && c.contact.includes(search))
//     ), [customers, search]);

//   const filteredSuppliers = useMemo(() =>
//     suppliers.filter(s =>
//       s.name.toLowerCase().includes(search.toLowerCase()) ||
//       (s.contact && s.contact.includes(search))
//     ), [suppliers, search]);

//   return (
//     <div className="space-y-6">
//       {/* Page header */}
//       <div>
//         <h2 className="text-2xl font-bold text-foreground">Customers & Suppliers</h2>
//         <p className="text-sm text-muted-foreground mt-1">
//           Receivables from customers · Payables to suppliers · Matched by name & mobile
//         </p>
//       </div>

//       {/* Summary cards */}
//       <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
//         <SummaryCard label="Total Receivables" amount={totalReceivables} icon={TrendingUp} colorClass="bg-blue-100 text-blue-600" />
//         <SummaryCard label="Total Payables" amount={totalPayables} icon={TrendingDown} colorClass="bg-red-100 text-red-600" />
//         <SummaryCard label="Customers" amount={customers.length} icon={Users} colorClass="bg-purple-100 text-purple-600" />
//         <SummaryCard label="Suppliers" amount={suppliers.length} icon={Building2} colorClass="bg-amber-100 text-amber-600" />
//       </div>

//       {/* Search */}
//       <div className="relative max-w-sm">
//         <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
//         <Input
//           placeholder="Search by name or phone…"
//           value={search}
//           onChange={e => setSearch(e.target.value)}
//           className="pl-9"
//         />
//       </div>

//       <Tabs defaultValue="customers">
//         <TabsList>
//           <TabsTrigger value="customers" className="flex items-center gap-2">
//             <Users className="w-4 h-4" />
//             Customers
//             {customers.length > 0 && (
//               <Badge variant="secondary" className="ml-1">{customers.length}</Badge>
//             )}
//           </TabsTrigger>
//           <TabsTrigger value="suppliers" className="flex items-center gap-2">
//             <Building2 className="w-4 h-4" />
//             Suppliers
//             {suppliers.length > 0 && (
//               <Badge variant="secondary" className="ml-1">{suppliers.length}</Badge>
//             )}
//           </TabsTrigger>
//         </TabsList>

//         <TabsContent value="customers" className="mt-4 space-y-3">
//           {filteredCustomers.length === 0 ? (
//             <Card>
//               <CardContent className="py-16 text-center text-muted-foreground">
//                 <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
//                 <p className="font-medium">No customers found</p>
//                 <p className="text-sm mt-1">Record a sale to see customers here.</p>
//               </CardContent>
//             </Card>
//           ) : (
//             <>
//               <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
//                 <span>{filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''}</span>
//                 <span>Total receivable: <strong className="text-foreground">{formatINR(totalReceivables)}</strong></span>
//               </div>
//               {filteredCustomers.map(c => (
//                 <PartyRow
//                   key={c.key}
//                   name={c.name}
//                   contact={c.contact}
//                   totalBilled={c.totalBilled}
//                   totalPaid={c.totalPaid}
//                   totalPending={c.totalPending}
//                   bills={c.transactions.map(tx => ({
//                     id: tx.id,
//                     billNumber: tx.billNumber,
//                     date: tx.date,
//                     total: tx.totalRevenue,
//                     pending: tx.pendingAmount,
//                     paymentStatus: tx.paymentStatus,
//                   }))}
//                   billPath={id => `/bill/${id}`}
//                 />
//               ))}
//             </>
//           )}
//         </TabsContent>

//         <TabsContent value="suppliers" className="mt-4 space-y-3">
//           {filteredSuppliers.length === 0 ? (
//             <Card>
//               <CardContent className="py-16 text-center text-muted-foreground">
//                 <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
//                 <p className="font-medium">No suppliers found</p>
//                 <p className="text-sm mt-1">Record a purchase to see suppliers here.</p>
//               </CardContent>
//             </Card>
//           ) : (
//             <>
//               <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
//                 <span>{filteredSuppliers.length} supplier{filteredSuppliers.length !== 1 ? 's' : ''}</span>
//                 <span>Total payable: <strong className="text-foreground">{formatINR(totalPayables)}</strong></span>
//               </div>
//               {filteredSuppliers.map(s => (
//                 <PartyRow
//                   key={s.key}
//                   name={s.name}
//                   contact={s.contact}
//                   totalBilled={s.totalBilled}
//                   totalPaid={s.totalPaid}
//                   totalPending={s.totalPending}
//                   bills={s.transactions.map(tx => ({
//                     id: tx.id,
//                     billNumber: tx.billNumber,
//                     date: tx.date,
//                     total: tx.totalCost,
//                     pending: tx.pendingAmount,
//                     paymentStatus: tx.paymentStatus,
//                   }))}
//                   billPath={id => `/bill/${id}`}
//                 />
//               ))}
//             </>
//           )}
//         </TabsContent>
//       </Tabs>
//     </div>
//   );
// }
