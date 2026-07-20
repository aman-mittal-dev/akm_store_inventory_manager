import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { DollarSign, Package, TrendingUp, AlertTriangle, ArrowDownCircle, ArrowUpCircle, Crown, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Link, useNavigate } from 'react-router';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { formatINR } from '../utils/currency';

export function Dashboard() {
  const { items, incomingTransactions, outgoingTransactions } = useInventory();
  const { subscription } = useAuth();
  const navigate = useNavigate();

  // Calculate statistics
  const totalItems = items.length;
  const totalStockValue = items.reduce(
    (sum, item) => sum + item.purchasePrice * item.currentStock,
    0
  );
  const totalPotentialRevenue = items.reduce(
    (sum, item) => sum + item.sellingPrice * item.currentStock,
    0
  );
  const totalPotentialProfit = totalPotentialRevenue - totalStockValue;
  const lowStockItems = items.filter(item => item.currentStock <= item.lowStockThreshold);

  // Calculate pending receivables (customers owe us)
  const totalReceivables = outgoingTransactions.reduce(
    (sum, transaction) => sum + transaction.pendingAmount,
    0
  );

  // Calculate pending payables (we owe vendors)
  const totalPayables = incomingTransactions.reduce(
    (sum, transaction) => sum + transaction.pendingAmount,
    0
  );

  // Calculate trial days remaining
  const trialDaysRemaining = subscription && subscription.status === 'trial'
    ? Math.ceil((new Date(subscription.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-semibold text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-2">Overview of your store's inventory and finances</p>
      </div>

      {/* Trial Banner */}
      {subscription?.status === 'trial' && (
        <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    14-Day Free Trial Active
                  </h3>
                  <p className="text-sm text-gray-600">
                    <Clock className="w-4 h-4 inline mr-1" />
                    {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} remaining
                    {' • '}
                    Trial ends on {new Date(subscription.endDate).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate('/pricing')}
                className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
              >
                View Plans
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Items</CardTitle>
            <Package className="w-5 h-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-gray-900">{totalItems}</div>
            <p className="text-sm text-gray-500 mt-1">Unique products</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Stock Value</CardTitle>
            <DollarSign className="w-5 h-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-gray-900">{formatINR(totalStockValue)}</div>
            <p className="text-sm text-gray-500 mt-1">Total purchase cost</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Potential Profit</CardTitle>
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-green-600">{formatINR(totalPotentialProfit)}</div>
            <p className="text-sm text-gray-500 mt-1">If all items sell</p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Overview - Receivables and Payables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-900">Pending Receivables</CardTitle>
            <ArrowDownCircle className="w-5 h-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-green-700">{formatINR(totalReceivables)}</div>
            <p className="text-sm text-green-600 mt-1">Money to receive from customers</p>
            {totalReceivables > 0 && (
              <Link 
                to="/transactions?filter=receivables" 
                className="text-sm text-green-700 hover:text-green-800 font-medium mt-2 inline-block"
              >
                View pending bills →
              </Link>
            )}
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-900">Pending Payables</CardTitle>
            <ArrowUpCircle className="w-5 h-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-red-700">{formatINR(totalPayables)}</div>
            <p className="text-sm text-red-600 mt-1">Money to pay to vendors</p>
            {totalPayables > 0 && (
              <Link 
                to="/transactions?filter=payables" 
                className="text-sm text-red-700 hover:text-red-800 font-medium mt-2 inline-block"
              >
                View pending bills →
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <CardTitle>Low Stock Alerts</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lowStockItems.map(item => {
                const profitMargin = ((item.sellingPrice - item.purchasePrice) / item.sellingPrice * 100).toFixed(1);
                return (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center gap-4">
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-16 h-16 object-cover rounded-md"
                        />
                      )}
                      <div>
                        <h4 className="font-medium text-gray-900">{item.name}</h4>
                        <p className="text-sm text-gray-600">SKU: {item.sku}</p>
                        <p className="text-sm text-orange-600 mt-1">
                          Only {item.currentStock} left (Threshold: {item.lowStockThreshold})
                        </p>
                      </div>
                    </div>
                    <Link
                      to={`/edit-item/${item.id}`}
                      className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                    >
                      Update Stock
                    </Link>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Items */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Inventory Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {items.slice(0, 5).map(item => {
              const profitMargin = ((item.sellingPrice - item.purchasePrice) / item.sellingPrice * 100).toFixed(1);
              const profit = item.sellingPrice - item.purchasePrice;
              const isLowStock = item.currentStock <= item.lowStockThreshold;

              return (
                <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-4 flex-1">
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-md"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">{item.name}</h4>
                        {isLowStock && (
                          <Badge variant="destructive" className="text-xs">Low Stock</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">SKU: {item.sku} | Category: {item.category}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-gray-600">
                          Purchase: <span className="font-medium">{formatINR(item.purchasePrice)}</span>
                        </span>
                        <span className="text-gray-600">
                          Selling: <span className="font-medium">{formatINR(item.sellingPrice)}</span>
                        </span>
                        <span className="text-green-600">
                          Profit: <span className="font-medium">{formatINR(profit)}</span> ({profitMargin}%)
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-semibold ${isLowStock ? 'text-orange-600' : 'text-gray-900'}`}>
                        {item.currentStock}
                      </div>
                      <p className="text-sm text-gray-600">in stock</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Link
            to="/inventory"
            className="block mt-6 text-center py-2 text-blue-600 hover:text-blue-800 font-medium"
          >
            View All Inventory →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}