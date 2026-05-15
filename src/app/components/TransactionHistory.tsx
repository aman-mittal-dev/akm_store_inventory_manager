import { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowDownToLine, ArrowUpFromLine, FileText, Calendar, Filter, X } from 'lucide-react';
import { formatINR } from '../utils/currency';

type FilterType = 'all' | 'year' | 'month' | 'custom';

export function TransactionHistory() {
  const { incomingTransactions, outgoingTransactions } = useInventory();
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonth, setSelectedMonth] = useState<string>('0');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Get available years
  const availableYears = Array.from(new Set(
    [...incomingTransactions, ...outgoingTransactions]
      .map(t => new Date(t.date).getFullYear().toString())
  )).sort((a, b) => parseInt(b) - parseInt(a));

  if (availableYears.length === 0) {
    availableYears.push('2026', '2025', '2024');
  }

  const months = [
    { value: '0', label: 'January' },
    { value: '1', label: 'February' },
    { value: '2', label: 'March' },
    { value: '3', label: 'April' },
    { value: '4', label: 'May' },
    { value: '5', label: 'June' },
    { value: '6', label: 'July' },
    { value: '7', label: 'August' },
    { value: '8', label: 'September' },
    { value: '9', label: 'October' },
    { value: '10', label: 'November' },
    { value: '11', label: 'December' },
  ];

  // Filter transactions based on selected filter
  const filterTransactions = <T extends { date: string }>(transactions: T[]): T[] => {
    if (filterType === 'all') return transactions;

    return transactions.filter(t => {
      const date = new Date(t.date);
      
      if (filterType === 'year') {
        return date.getFullYear().toString() === selectedYear;
      }
      
      if (filterType === 'month') {
        return date.getFullYear().toString() === selectedYear && 
               date.getMonth().toString() === selectedMonth;
      }
      
      if (filterType === 'custom' && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include end date
        return date >= start && date <= end;
      }
      
      return true;
    });
  };

  const filteredIncoming = filterTransactions(incomingTransactions);
  const filteredOutgoing = filterTransactions(outgoingTransactions);

  const sortedIncoming = [...filteredIncoming].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const sortedOutgoing = [...filteredOutgoing].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPurchases = filteredIncoming.reduce((sum, t) => sum + t.totalCost, 0);
  const totalSales = filteredOutgoing.reduce((sum, t) => sum + t.totalRevenue, 0);
  const totalProfit = filteredOutgoing.reduce((sum, t) => sum + t.totalProfit, 0);

  const handleResetFilter = () => {
    setFilterType('all');
    setSelectedYear('2026');
    setSelectedMonth('0');
    setStartDate('');
    setEndDate('');
  };

  const getFilterLabel = () => {
    if (filterType === 'all') return 'All Time';
    if (filterType === 'year') return selectedYear;
    if (filterType === 'month') return `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`;
    if (filterType === 'custom' && startDate && endDate) {
      return `${new Date(startDate).toLocaleDateString('en-IN')} - ${new Date(endDate).toLocaleDateString('en-IN')}`;
    }
    return 'Filtered';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold text-gray-900">Transaction History</h2>
        <p className="text-gray-600 mt-2">Complete record of all inventory transactions</p>
      </div>

      {/* Filter Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
            {filterType !== 'all' && (
              <Button variant="outline" size="sm" onClick={handleResetFilter}>
                <X className="w-4 h-4 mr-2" />
                Reset Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterType('all')}
              >
                All Time
              </Button>
              <Button
                variant={filterType === 'year' ? 'default' : 'outline'}
                onClick={() => setFilterType('year')}
              >
                By Year
              </Button>
              <Button
                variant={filterType === 'month' ? 'default' : 'outline'}
                onClick={() => setFilterType('month')}
              >
                By Month
              </Button>
              <Button
                variant={filterType === 'custom' ? 'default' : 'outline'}
                onClick={() => setFilterType('custom')}
              >
                Custom Range
              </Button>
            </div>

            {filterType === 'year' && (
              <div className="flex items-center gap-3">
                <Label htmlFor="year" className="whitespace-nowrap">Select Year:</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger id="year" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {filterType === 'month' && (
              <div className="flex items-center gap-3">
                <Label htmlFor="month" className="whitespace-nowrap">Select Month:</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger id="month" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => (
                      <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label htmlFor="monthYear" className="whitespace-nowrap">of</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger id="monthYear" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {filterType === 'custom' && (
              <div className="flex items-center gap-3">
                <div>
                  <Label htmlFor="startDate">From:</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">To:</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {filterType !== 'all' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Showing:</strong> {getFilterLabel()} • {filteredIncoming.length + filteredOutgoing.length} transactions
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-red-600">{formatINR(totalPurchases)}</div>
            <p className="text-sm text-gray-500 mt-1">{filteredIncoming.length} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-blue-600">{formatINR(totalSales)}</div>
            <p className="text-sm text-gray-500 mt-1">{filteredOutgoing.length} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-green-600">{formatINR(totalProfit)}</div>
            <p className="text-sm text-gray-500 mt-1">From all sales</p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Lists */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="outgoing">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="outgoing" className="flex items-center gap-2">
                <ArrowUpFromLine className="w-4 h-4" />
                Sales ({filteredOutgoing.length})
              </TabsTrigger>
              <TabsTrigger value="incoming" className="flex items-center gap-2">
                <ArrowDownToLine className="w-4 h-4" />
                Purchases ({filteredIncoming.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="outgoing" className="mt-6">
              <div className="space-y-4">
                {sortedOutgoing.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No sales recorded yet
                  </div>
                ) : (
                  sortedOutgoing.map(transaction => (
                    <div
                      key={transaction.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-medium text-gray-900">
                              {transaction.items.length} Item{transaction.items.length > 1 ? 's' : ''} Sale
                            </h4>
                            <Badge className="bg-blue-600">Sale</Badge>
                          </div>

                          {/* List all items */}
                          <div className="mb-3 space-y-1">
                            {transaction.items.map((item, idx) => (
                              <div key={idx} className="text-sm">
                                <span className="font-medium text-gray-900">{item.itemName}</span>
                                <span className="text-gray-600"> ({item.sku})</span>
                                <span className="text-gray-600"> - {item.quantity} units @ {formatINR(item.pricePerUnit)}</span>
                              </div>
                            ))}
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">Customer</p>
                              <p className="font-medium text-gray-900">{transaction.customerName}</p>
                              {transaction.customerContact && (
                                <p className="text-gray-500 text-xs">{transaction.customerContact}</p>
                              )}
                            </div>
                            <div>
                              <p className="text-gray-600">Total Quantity</p>
                              <p className="font-medium text-gray-900">
                                {transaction.items.reduce((sum, item) => sum + item.quantity, 0)} units
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Revenue</p>
                              <p className="font-medium text-blue-600">{formatINR(transaction.totalRevenue)}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Profit</p>
                              <p className="font-medium text-green-600">{formatINR(transaction.totalProfit)}</p>
                              <p className="text-xs text-gray-500">
                                {((transaction.totalProfit / transaction.totalRevenue) * 100).toFixed(1)}% margin
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(transaction.date)}
                            </div>
                            <div className="flex items-center gap-1">
                              <FileText className="w-4 h-4" />
                              Bill: {transaction.billNumber}
                            </div>
                          </div>

                          {transaction.notes && (
                            <p className="text-sm text-gray-600 mt-2 italic">
                              Note: {transaction.notes}
                            </p>
                          )}
                        </div>

                        <Link to={`/bill/${transaction.billNumber}`}>
                          <Button variant="outline" size="sm">
                            <FileText className="w-4 h-4 mr-2" />
                            View Bill
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="incoming" className="mt-6">
              <div className="space-y-4">
                {sortedIncoming.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No purchases recorded yet
                  </div>
                ) : (
                  sortedIncoming.map(transaction => (
                    <div
                      key={transaction.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-medium text-gray-900">
                              {transaction.items.length} Item{transaction.items.length > 1 ? 's' : ''} Purchase
                            </h4>
                            <Badge className="bg-green-600">Purchase</Badge>
                          </div>

                          {/* List all items */}
                          <div className="mb-3 space-y-1">
                            {transaction.items.map((item, idx) => (
                              <div key={idx} className="text-sm">
                                <span className="font-medium text-gray-900">{item.itemName}</span>
                                <span className="text-gray-600"> ({item.sku})</span>
                                {item.pricePerUnit > 0 && (
                                  <span className="text-gray-600"> - {item.quantity} units @ {formatINR(item.pricePerUnit)}</span>
                                )}
                                {item.pricePerUnit === 0 && (
                                  <span className="text-gray-500 italic"> - {item.quantity} units (from bundle)</span>
                                )}
                              </div>
                            ))}
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">Supplier</p>
                              <p className="font-medium text-gray-900">{transaction.supplierName}</p>
                              {transaction.supplierContact && (
                                <p className="text-gray-500 text-xs">{transaction.supplierContact}</p>
                              )}
                            </div>
                            <div>
                              <p className="text-gray-600">Total Quantity</p>
                              <p className="font-medium text-gray-900">
                                {transaction.items.reduce((sum, item) => sum + item.quantity, 0)} units
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Items</p>
                              <p className="font-medium text-gray-900">{transaction.items.length}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Total Cost</p>
                              <p className="font-medium text-red-600">{formatINR(transaction.totalCost)}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(transaction.date)}
                            </div>
                            <div className="flex items-center gap-1">
                              <FileText className="w-4 h-4" />
                              Bill: {transaction.billNumber}
                            </div>
                          </div>

                          {transaction.notes && (
                            <p className="text-sm text-gray-600 mt-2 italic">
                              Note: {transaction.notes}
                            </p>
                          )}
                        </div>

                        <Link to={`/bill/${transaction.billNumber}`}>
                          <Button variant="outline" size="sm">
                            <FileText className="w-4 h-4 mr-2" />
                            View Bill
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}