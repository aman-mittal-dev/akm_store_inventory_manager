import { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Package, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatINR } from '../utils/currency';

type PeriodType = 'month' | 'year';

export function Analytics() {
  const { outgoingTransactions, incomingTransactions, items } = useInventory();
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [comparisonYear, setComparisonYear] = useState<string>('2025');

  // Get available years from transactions
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    [...outgoingTransactions, ...incomingTransactions].forEach(t => {
      const year = new Date(t.date).getFullYear().toString();
      years.add(year);
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [outgoingTransactions, incomingTransactions]);

  // Add default years if no transactions
  if (availableYears.length === 0) {
    availableYears.push('2026', '2025', '2024');
  }

  // Monthly sales and purchases data
  const monthlyData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data = months.map((month, index) => {
      const sales = outgoingTransactions
        .filter(t => {
          const date = new Date(t.date);
          return date.getFullYear().toString() === selectedYear && date.getMonth() === index;
        })
        .reduce((sum, t) => sum + t.totalRevenue, 0);

      const purchases = incomingTransactions
        .filter(t => {
          const date = new Date(t.date);
          return date.getFullYear().toString() === selectedYear && date.getMonth() === index;
        })
        .reduce((sum, t) => sum + t.totalCost, 0);

      const profit = outgoingTransactions
        .filter(t => {
          const date = new Date(t.date);
          return date.getFullYear().toString() === selectedYear && date.getMonth() === index;
        })
        .reduce((sum, t) => sum + t.totalProfit, 0);

      return { month, sales, purchases, profit };
    });
    return data;
  }, [outgoingTransactions, incomingTransactions, selectedYear]);

  // Year-over-year comparison
  const yearComparisonData = useMemo(() => {
    const getYearTotals = (year: string) => {
      const sales = outgoingTransactions
        .filter(t => new Date(t.date).getFullYear().toString() === year)
        .reduce((sum, t) => sum + t.totalRevenue, 0);

      const purchases = incomingTransactions
        .filter(t => new Date(t.date).getFullYear().toString() === year)
        .reduce((sum, t) => sum + t.totalCost, 0);

      const profit = outgoingTransactions
        .filter(t => new Date(t.date).getFullYear().toString() === year)
        .reduce((sum, t) => sum + t.totalProfit, 0);

      return { sales, purchases, profit };
    };

    const current = getYearTotals(selectedYear);
    const previous = getYearTotals(comparisonYear);

    return [
      { id: 'comparison', year: comparisonYear, ...previous },
      { id: 'selected', year: selectedYear, ...current },
    ];
  }, [outgoingTransactions, incomingTransactions, selectedYear, comparisonYear]);

  // Item performance analysis
  const itemPerformance = useMemo(() => {
    const itemStats = new Map<string, { name: string; revenue: number; profit: number; quantity: number }>();

    outgoingTransactions
      .filter(t => new Date(t.date).getFullYear().toString() === selectedYear)
      .forEach(t => {
        t.items.forEach(item => {
          const existing = itemStats.get(item.itemId) || { name: item.itemName, revenue: 0, profit: 0, quantity: 0 };
          const inventoryItem = items.find(i => i.id === item.itemId);
          const itemProfit = inventoryItem ? (item.pricePerUnit - inventoryItem.purchasePrice) * item.quantity : 0;
          
          itemStats.set(item.itemId, {
            name: item.itemName,
            revenue: existing.revenue + item.totalPrice,
            profit: existing.profit + itemProfit,
            quantity: existing.quantity + item.quantity,
          });
        });
      });

    return Array.from(itemStats.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [outgoingTransactions, items, selectedYear]);

  // Category performance
  const categoryPerformance = useMemo(() => {
    const categoryStats = new Map<string, { revenue: number; profit: number }>();

    outgoingTransactions
      .filter(t => new Date(t.date).getFullYear().toString() === selectedYear)
      .forEach(t => {
        t.items.forEach(item => {
          const inventoryItem = items.find(i => i.id === item.itemId);
          const category = inventoryItem?.category || 'Uncategorized';
          const existing = categoryStats.get(category) || { revenue: 0, profit: 0 };
          const itemProfit = inventoryItem ? (item.pricePerUnit - inventoryItem.purchasePrice) * item.quantity : 0;
          
          categoryStats.set(category, {
            revenue: existing.revenue + item.totalPrice,
            profit: existing.profit + itemProfit,
          });
        });
      });

    return Array.from(categoryStats.entries()).map(([name, data]) => ({
      name,
      value: data.revenue,
      profit: data.profit,
    }));
  }, [outgoingTransactions, items, selectedYear]);

  // Summary statistics
  const currentYearStats = useMemo(() => {
    const sales = outgoingTransactions
      .filter(t => new Date(t.date).getFullYear().toString() === selectedYear)
      .reduce((sum, t) => sum + t.totalRevenue, 0);

    const purchases = incomingTransactions
      .filter(t => new Date(t.date).getFullYear().toString() === selectedYear)
      .reduce((sum, t) => sum + t.totalCost, 0);

    const profit = outgoingTransactions
      .filter(t => new Date(t.date).getFullYear().toString() === selectedYear)
      .reduce((sum, t) => sum + t.totalProfit, 0);

    const previousSales = outgoingTransactions
      .filter(t => new Date(t.date).getFullYear().toString() === comparisonYear)
      .reduce((sum, t) => sum + t.totalRevenue, 0);

    const salesChange = previousSales > 0 ? ((sales - previousSales) / previousSales) * 100 : 0;

    return { sales, purchases, profit, salesChange };
  }, [outgoingTransactions, incomingTransactions, selectedYear, comparisonYear]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-gray-900">Analytics & Reports</h2>
          <p className="text-gray-600 mt-2">Comprehensive insights into your business performance</p>
        </div>
        <div className="flex gap-3">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(year => (
                <SelectItem key={year} value={year}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={comparisonYear} onValueChange={setComparisonYear}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Compare to" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(year => (
                <SelectItem key={year} value={year}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Sales ({selectedYear})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-semibold text-blue-600">{formatINR(currentYearStats.sales)}</div>
                <div className="flex items-center gap-1 mt-2">
                  {currentYearStats.salesChange >= 0 ? (
                    <>
                      <ArrowUpRight className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600 font-medium">
                        +{currentYearStats.salesChange.toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    <>
                      <ArrowDownRight className="w-4 h-4 text-red-600" />
                      <span className="text-sm text-red-600 font-medium">
                        {currentYearStats.salesChange.toFixed(1)}%
                      </span>
                    </>
                  )}
                  <span className="text-sm text-gray-500">vs {comparisonYear}</span>
                </div>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Purchases ({selectedYear})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-semibold text-red-600">{formatINR(currentYearStats.purchases)}</div>
                <p className="text-sm text-gray-500 mt-2">Cost of goods</p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Profit ({selectedYear})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-semibold text-green-600">{formatINR(currentYearStats.profit)}</div>
                <p className="text-sm text-gray-500 mt-2">
                  {currentYearStats.sales > 0 ? ((currentYearStats.profit / currentYearStats.sales) * 100).toFixed(1) : '0'}% margin
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Performance Trend - {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatINR(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} name="Sales" />
              <Line type="monotone" dataKey="purchases" stroke="#ef4444" strokeWidth={2} name="Purchases" />
              <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} name="Profit" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Year-over-Year Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Year-over-Year Comparison: {comparisonYear} vs {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={yearComparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip formatter={(value) => formatINR(Number(value))} />
              <Legend />
              <Bar dataKey="sales" fill="#3b82f6" name="Sales" />
              <Bar dataKey="purchases" fill="#ef4444" name="Purchases" />
              <Bar dataKey="profit" fill="#10b981" name="Profit" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Item Performance and Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Items */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Items by Revenue - {selectedYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {itemPerformance.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No sales data available for {selectedYear}</p>
              ) : (
                itemPerformance.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                        {index + 1}
                      </Badge>
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-600">{item.quantity} units sold</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-blue-600">{formatINR(item.revenue)}</p>
                      <p className="text-sm text-green-600">{formatINR(item.profit)} profit</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Category Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Category - {selectedYear}</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryPerformance.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No category data available for {selectedYear}</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={categoryPerformance}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryPerformance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatINR(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {categoryPerformance.map((cat, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-gray-700">{cat.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium text-gray-900">{formatINR(cat.value)}</span>
                        <span className="text-gray-500 ml-2">({formatINR(cat.profit)} profit)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Sales Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Sales Breakdown - {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatINR(Number(value))} />
              <Legend />
              <Bar dataKey="sales" fill="#3b82f6" name="Revenue" />
              <Bar dataKey="profit" fill="#10b981" name="Profit" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}