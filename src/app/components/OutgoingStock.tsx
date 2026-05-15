import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useInventory } from '../context/InventoryContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowUpFromLine, FileText, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { formatINR, generateBillNumber } from '../utils/currency';
import { TransactionItem } from '../types';
import { normalizePartyKey, roundMoney } from '../utils/party';
import { receivableOutstandingForPartyKey } from '../utils/partySummaries';
import { generateAdHocSku } from '../utils/sku';
import { Checkbox } from './ui/checkbox';

interface CartItem extends TransactionItem {
  purchasePrice: number;
  profit: number;
}

export function OutgoingStock() {
  const navigate = useNavigate();
  const { items, addOutgoingTransaction, outgoingTransactions } = useInventory();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerInfo, setCustomerInfo] = useState({
    customerName: '',
    customerContact: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    paidAmount: '',
    paymentMethod: 'cash',
  });

  const [currentItem, setCurrentItem] = useState({
    itemId: '',
    quantity: '',
    sellingPrice: '',
  });

  const [isCustomItem, setIsCustomItem] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemQuantity, setCustomItemQuantity] = useState('');

  const [includePreviousOutstanding, setIncludePreviousOutstanding] = useState(false);
  const [carryAmountStr, setCarryAmountStr] = useState('');

  const partyKeyPreview = useMemo(() => {
    if (!customerInfo.customerName.trim()) return null;
    return normalizePartyKey(customerInfo.customerName, customerInfo.customerContact);
  }, [customerInfo.customerName, customerInfo.customerContact]);

  const priorOutstanding = useMemo(() => {
    if (!partyKeyPreview) return 0;
    return receivableOutstandingForPartyKey(outgoingTransactions, partyKeyPreview);
  }, [outgoingTransactions, partyKeyPreview]);

  useEffect(() => {
    setIncludePreviousOutstanding(false);
    setCarryAmountStr('');
  }, [partyKeyPreview]);

  useEffect(() => {
    if (includePreviousOutstanding && priorOutstanding > 0) {
      setCarryAmountStr(String(roundMoney(priorOutstanding)));
    }
  }, [includePreviousOutstanding, priorOutstanding]);

  const selectedItem = items.find(item => item.id === currentItem.itemId);

  const handleAddToCart = () => {
    if (isCustomItem) {
      // Add custom item
      if (!customItemName.trim() || !customItemQuantity || !customItemPrice) {
        toast.error('Please fill in all custom item fields');
        return;
      }

      const quantity = parseInt(customItemQuantity);
      const sellingPrice = parseFloat(customItemPrice);

      if (isNaN(quantity) || isNaN(sellingPrice) || quantity <= 0 || sellingPrice < 0) {
        toast.error('Please enter valid values');
        return;
      }

      const totalPrice = quantity * sellingPrice;
      const profit = 0; // No profit calculation for custom items as we don't know the cost

      const cartItem: CartItem = {
        itemId: `custom-${Date.now()}`,
        itemName: customItemName.trim(),
        sku: generateAdHocSku(),
        quantity,
        pricePerUnit: sellingPrice,
        totalPrice,
        purchasePrice: 0,
        profit,
      };

      setCart([...cart, cartItem]);
      setCustomItemName('');
      setCustomItemPrice('');
      setCustomItemQuantity('');
      toast.success(`Added ${customItemName} to cart`);
    } else {
      // Add from inventory
      if (!currentItem.itemId || !currentItem.quantity || !currentItem.sellingPrice) {
        toast.error('Please select item and fill in all fields');
        return;
      }

      const quantity = parseInt(currentItem.quantity);
      const sellingPrice = parseFloat(currentItem.sellingPrice);

      if (isNaN(quantity) || isNaN(sellingPrice) || quantity <= 0 || sellingPrice < 0) {
        toast.error('Please enter valid values');
        return;
      }

      const item = items.find(i => i.id === currentItem.itemId);
      if (!item) {
        toast.error('Item not found');
        return;
      }

      if (quantity > item.currentStock) {
        toast.error(`Insufficient stock! Only ${item.currentStock} units available`);
        return;
      }

      const totalPrice = quantity * sellingPrice;
      const profit = quantity * (sellingPrice - item.purchasePrice);

      const cartItem: CartItem = {
        itemId: item.id,
        itemName: item.name,
        sku: item.sku,
        quantity,
        pricePerUnit: sellingPrice,
        totalPrice,
        purchasePrice: item.purchasePrice,
        profit,
      };

      setCart([...cart, cartItem]);
      setCurrentItem({ itemId: '', quantity: '', sellingPrice: '' });
      toast.success(`Added ${item.name} to cart`);
    }
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
    toast.success('Item removed from cart');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (cart.length === 0) {
      toast.error('Please add at least one item to the cart');
      return;
    }

    if (!customerInfo.customerName) {
      toast.error('Please enter customer name');
      return;
    }

    // Validate stock availability for all items
    for (const cartItem of cart) {
      const item = items.find(i => i.id === cartItem.itemId);
      if (!item || cartItem.quantity > item.currentStock) {
        toast.error(`Insufficient stock for ${cartItem.itemName}`);
        return;
      }
    }

    const linesSubtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    const parsedCarry = includePreviousOutstanding ? parseFloat(carryAmountStr) : 0;
    let previousCarried = Number.isFinite(parsedCarry) ? parsedCarry : 0;
    previousCarried = roundMoney(previousCarried);
    if (!includePreviousOutstanding) {
      previousCarried = 0;
    }
    const maxPrior = roundMoney(priorOutstanding);
    if (includePreviousOutstanding && maxPrior <= 0) {
      toast.error('There is no previous outstanding balance for this customer/contact');
      return;
    }
    if (previousCarried < 0) {
      toast.error('Outstanding amount cannot be negative');
      return;
    }
    if (previousCarried > maxPrior) {
      toast.error(`Outstanding to add cannot exceed ${formatINR(maxPrior)} for this party`);
      return;
    }

    const totalRevenue = roundMoney(linesSubtotal + previousCarried);
    const totalProfit = cart.reduce((sum, item) => sum + item.profit, 0);
    const billNumber = generateBillNumber();
    const paidAmount = parseFloat(customerInfo.paidAmount) || 0;
    const pendingAmount = roundMoney(totalRevenue - paidAmount);
    const paymentStatus: 'paid' | 'partial' | 'unpaid' = 
      paidAmount === 0 ? 'unpaid' : 
      paidAmount >= totalRevenue ? 'paid' : 
      'partial';

    const transactionItems: TransactionItem[] = cart.map(item => ({
      itemId: item.itemId,
      itemName: item.itemName,
      sku: item.sku,
      quantity: item.quantity,
      pricePerUnit: item.pricePerUnit,
      totalPrice: item.totalPrice,
    }));

    addOutgoingTransaction({
      items: transactionItems,
      totalRevenue,
      totalProfit,
      previousOutstandingCarried: previousCarried || undefined,
      customerName: customerInfo.customerName,
      customerContact: customerInfo.customerContact || undefined,
      date: new Date(customerInfo.date).toISOString(),
      notes: customerInfo.notes || undefined,
      billNumber,
      paidAmount,
      pendingAmount,
      paymentStatus,
      paymentHistory: paidAmount > 0 ? [
        {
          id: '1',
          amount: paidAmount,
          date: new Date().toISOString(),
          method: customerInfo.paymentMethod,
          notes: 'Initial payment',
        }
      ] : undefined,
    });

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    toast.success(`Sale recorded successfully! Bill #${billNumber}`);
    navigate(`/bill/${billNumber}`);
  };

  const linesSubtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  let carryParsed = includePreviousOutstanding ? parseFloat(carryAmountStr) : 0;
  carryParsed = Number.isFinite(carryParsed) ? roundMoney(carryParsed) : 0;
  const cappedCarry = includePreviousOutstanding
    ? roundMoney(Math.min(Math.max(carryParsed, 0), roundMoney(priorOutstanding)))
    : 0;
  const invoiceGrandTotal = roundMoney(linesSubtotal + cappedCarry);
  const totalRevenueDisplay = invoiceGrandTotal;
  const totalProfit = cart.reduce((sum, item) => sum + item.profit, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const profitMargin = totalRevenueDisplay > 0 ? ((totalProfit / totalRevenueDisplay) * 100).toFixed(1) : '0';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <ArrowUpFromLine className="w-8 h-8 text-blue-600" />
          <h2 className="text-3xl font-semibold text-gray-900">Record Sale</h2>
        </div>
        <p className="text-gray-600">Add multiple items to sell in a single transaction</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Add Items to Cart */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add Items to Sale
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 mb-4">
                <Button
                  type="button"
                  variant={!isCustomItem ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsCustomItem(false)}
                  className="flex-1"
                >
                  From Inventory
                </Button>
                <Button
                  type="button"
                  variant={isCustomItem ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsCustomItem(true)}
                  className="flex-1"
                >
                  Custom Item
                </Button>
              </div>

              {!isCustomItem ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="itemId">Select Item</Label>
                    <Select
                      value={currentItem.itemId}
                      onValueChange={(value) => {
                        const item = items.find(i => i.id === value);
                        setCurrentItem(prev => ({
                          ...prev,
                          itemId: value,
                          sellingPrice: item?.sellingPrice.toString() || '',
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an item" />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map(item => (
                          <SelectItem
                            key={item.id}
                            value={item.id}
                            disabled={item.currentStock === 0}
                          >
                            {item.name} ({item.sku}) - Stock: {item.currentStock}
                            {item.currentStock === 0 && ' - OUT OF STOCK'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedItem && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-4">
                        {selectedItem.imageUrl && (
                          <img
                            src={selectedItem.imageUrl}
                            alt={selectedItem.name}
                            className="w-16 h-16 object-cover rounded-md"
                          />
                        )}
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{selectedItem.name}</h4>
                          <p className={`text-sm font-medium ${
                            selectedItem.currentStock <= selectedItem.lowStockThreshold
                              ? 'text-orange-600'
                              : 'text-gray-600'
                          }`}>
                            Available Stock: {selectedItem.currentStock} units
                          </p>
                          <p className="text-xs text-gray-600">
                            Recommended Price: {formatINR(selectedItem.sellingPrice)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        max={selectedItem?.currentStock || undefined}
                        value={currentItem.quantity}
                        onChange={(e) => setCurrentItem(prev => ({ ...prev, quantity: e.target.value }))}
                        placeholder="0"
                      />
                      {selectedItem && (
                        <p className="text-xs text-gray-500">
                          Max: {selectedItem.currentStock} units
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sellingPrice">Selling Price (INR/unit)</Label>
                      <Input
                        id="sellingPrice"
                        type="number"
                        step="0.01"
                        min="0"
                        value={currentItem.sellingPrice}
                        onChange={(e) => setCurrentItem(prev => ({ ...prev, sellingPrice: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customItemName">Item Name *</Label>
                    <Input
                      id="customItemName"
                      value={customItemName}
                      onChange={(e) => setCustomItemName(e.target.value)}
                      placeholder="Enter item name"
                    />
                    <p className="text-xs text-gray-500">A unique line code is generated for this row automatically.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customItemQuantity">Quantity *</Label>
                      <Input
                        id="customItemQuantity"
                        type="number"
                        min="1"
                        value={customItemQuantity}
                        onChange={(e) => setCustomItemQuantity(e.target.value)}
                        placeholder="0"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customItemPrice">Selling Price (INR/unit) *</Label>
                      <Input
                        id="customItemPrice"
                        type="number"
                        step="0.01"
                        min="0"
                        value={customItemPrice}
                        onChange={(e) => setCustomItemPrice(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-800">
                      <strong>Note:</strong> Custom items won't affect your inventory stock. Profit calculation will be unavailable for these items.
                    </p>
                  </div>
                </div>
              )}

              <Button type="button" onClick={handleAddToCart} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add to Cart
              </Button>
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name *</Label>
                <Input
                  id="customerName"
                  value={customerInfo.customerName}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, customerName: e.target.value }))}
                  placeholder="Enter customer name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerContact">Customer Contact</Label>
                <Input
                  id="customerContact"
                  value={customerInfo.customerContact}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, customerContact: e.target.value }))}
                  placeholder="+91 XXXXXXXXXX"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Sale Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={customerInfo.date}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, date: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={customerInfo.notes}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any additional notes about this sale..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paidAmount">Paid Amount (INR)</Label>
                <Input
                  id="paidAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={customerInfo.paidAmount}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, paidAmount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select
                  value={customerInfo.paymentMethod}
                  onValueChange={(value) => setCustomerInfo(prev => ({ ...prev, paymentMethod: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {partyKeyPreview && priorOutstanding > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-amber-900">Previous invoice balance</p>
                  <p className="text-xs text-amber-800">
                    Outstanding for this exact customer/contact (past sales only):{' '}
                    <span className="font-medium">{formatINR(roundMoney(priorOutstanding))}</span>
                  </p>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="carryPrevOutstanding"
                      checked={includePreviousOutstanding}
                      onCheckedChange={(checked) =>
                        setIncludePreviousOutstanding(Boolean(checked))
                      }
                    />
                    <label htmlFor="carryPrevOutstanding" className="text-sm leading-tight cursor-pointer">
                      Add this unpaid balance onto the current invoice total
                    </label>
                  </div>
                  {includePreviousOutstanding && (
                    <div className="space-y-2">
                      <Label htmlFor="carryAmount">Amount to add (max {formatINR(roundMoney(priorOutstanding))})</Label>
                      <Input
                        id="carryAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        max={priorOutstanding}
                        value={carryAmountStr}
                        onChange={(e) => setCarryAmountStr(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Cart */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Sale Cart
                </span>
                <span className="text-sm font-normal text-gray-600">
                  {cart.length} item(s)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Cart is empty</p>
                  <p className="text-xs">Add items to sell</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {cart.map((item, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h5 className="font-medium text-sm text-gray-900">{item.itemName}</h5>
                            <p className="text-xs text-gray-600">{item.sku}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFromCart(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Quantity:</span>
                            <span className="font-medium">{item.quantity} units</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Price/unit:</span>
                            <span className="font-medium">{formatINR(item.pricePerUnit)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Revenue:</span>
                            <span className="font-medium text-blue-600">{formatINR(item.totalPrice)}</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-gray-300">
                            <span className="text-gray-700 font-medium">Profit:</span>
                            <span className="font-semibold text-green-600">{formatINR(item.profit)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-gray-300 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Items:</span>
                      <span className="font-medium">{totalItems} units</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Line items subtotal:</span>
                      <span className="font-medium text-blue-700">{formatINR(linesSubtotal)}</span>
                    </div>
                    {includePreviousOutstanding && cappedCarry > 0 && (
                      <div className="flex justify-between text-xs text-amber-800">
                        <span>Prior outstanding:</span>
                        <span>{formatINR(cappedCarry)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-gray-800">Invoice total:</span>
                      <span className="font-medium text-blue-600">{formatINR(totalRevenueDisplay)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-900">Total Profit:</span>
                      <span className="font-bold text-xl text-green-600">{formatINR(totalProfit)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Profit Margin:</span>
                      <span className="font-medium text-green-600">{profitMargin}%</span>
                    </div>
                  </div>

                  <Button 
                    onClick={handleSubmit} 
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={cart.length === 0 || !customerInfo.customerName}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Record Sale & Generate Bill
                  </Button>
                </>
              )}

              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate('/inventory')}
                className="w-full"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}