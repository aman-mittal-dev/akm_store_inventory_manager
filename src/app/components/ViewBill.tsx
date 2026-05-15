import { useParams, useNavigate } from 'react-router';
import { useInventory } from '../context/InventoryContext';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { ArrowLeft, Printer, Edit2, Save, X, Plus, Trash2, CreditCard } from 'lucide-react';
import { formatINR } from '../utils/currency';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TransactionItem, PaymentRecord } from '../types';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import { EditPaymentDialog } from './EditPaymentDialog';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { listBillDeliveries, savePrintedBillApi, type BillDeliveryRow } from '../services/billService';
import { generateAdHocSku } from '../utils/sku';
import { humanizeApiError } from '../utils/apiErrors';
import { BillDeliveryPanel } from './BillDeliveryPanel';
import { toast } from 'sonner';

type InvoiceType = 'internal' | 'customer';
type BillFormat = 'full' | 'compact';

export function ViewBill() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { outgoingTransactions, incomingTransactions, items, storeSettings, updateOutgoingTransaction, updateIncomingTransaction } = useInventory();

  // Try to find in outgoing (sales) first
  const outgoingTransaction = outgoingTransactions.find(t => t.billNumber === transactionId);
  // Then try incoming (purchases)
  const incomingTransaction = incomingTransactions.find(t => t.billNumber === transactionId);

  const transaction = outgoingTransaction || incomingTransaction;
  const isSale = !!outgoingTransaction;

  const [invoiceType, setInvoiceType] = useState<InvoiceType>('internal');
  const [billFormat, setBillFormat] = useState<BillFormat>('full');
  const [isEditing, setIsEditing] = useState(false);
  const [editableItems, setEditableItems] = useState<TransactionItem[]>([]);
  const [newItemId, setNewItemId] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [isCustomItem, setIsCustomItem] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState(0);
  const [customItemQuantity, setCustomItemQuantity] = useState(1);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const printableRef = useRef<HTMLDivElement>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<BillDeliveryRow[]>([]);
  const [deliveryLogsLoading, setDeliveryLogsLoading] = useState(true);

  const refreshDeliveryLogs = useCallback(async () => {
    if (!transactionId) {
      return;
    }
    setDeliveryLogsLoading(true);
    try {
      const rows = await listBillDeliveries(transactionId);
      setDeliveryLogs(rows);
    } catch {
      setDeliveryLogs([]);
    } finally {
      setDeliveryLogsLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    void refreshDeliveryLogs();
  }, [refreshDeliveryLogs]);

  const deliveryRecordLine = useMemo(() => {
    const sent = deliveryLogs.filter((l) => l.status === 'sent' && l.sentAt);
    let lastEmail: BillDeliveryRow | undefined;
    let lastWa: BillDeliveryRow | undefined;
    for (const l of sent) {
      if (l.channel === 'email') {
        if (!lastEmail || new Date(l.sentAt!) > new Date(lastEmail.sentAt!)) {
          lastEmail = l;
        }
      }
      if (l.channel === 'whatsapp') {
        if (!lastWa || new Date(l.sentAt!) > new Date(lastWa.sentAt!)) {
          lastWa = l;
        }
      }
    }
    const parts: string[] = [];
    if (lastEmail) {
      parts.push(
        `Email sent ${new Date(lastEmail.sentAt!).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}`,
      );
    }
    if (lastWa) {
      parts.push(
        `WhatsApp sent ${new Date(lastWa.sentAt!).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}`,
      );
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }, [deliveryLogs]);

  const captureBillPdfBase64 = useCallback(async (): Promise<{ base64: string; fileName: string } | null> => {
    if (!printableRef.current || !transactionId) {
      return null;
    }
    const canvas = await html2canvas(printableRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });
    const imageData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height],
    });
    pdf.addImage(imageData, 'PNG', 0, 0, canvas.width, canvas.height);
    const pdfBlob = pdf.output('blob');
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const value = reader.result?.toString() || '';
        resolve(value.split(',')[1] || '');
      };
      reader.onerror = () => reject(new Error('Unable to read PDF blob'));
      reader.readAsDataURL(pdfBlob);
    });
    const fileName = `${transactionId}-${billFormat}-${invoiceType}.pdf`;
    return { base64, fileName };
  }, [transactionId, billFormat, invoiceType]);

  if (!transaction) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Bill Not Found</h2>
        <p className="text-gray-600 mb-4">The requested bill could not be found.</p>
        <Button onClick={() => navigate('/transactions')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Transactions
        </Button>
      </div>
    );
  }

  const handlePrint = async () => {
    try {
      const captured = await captureBillPdfBase64();
      if (!captured) {
        throw new Error('Printable bill section not found');
      }
      const { base64, fileName } = captured;
      await savePrintedBillApi({
        billNumber: transaction.billNumber,
        billFormat,
        invoiceType,
        fileName,
        pdfBase64: base64,
      });
      toast.success('Bill PDF saved to database');
    } catch (error) {
      toast.error(humanizeApiError(error, 'Could not save the bill PDF.'));
    }

    window.print();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleStartEdit = () => {
    setEditableItems([...transaction.items]);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditableItems([]);
    setNewItemId('');
    setNewItemQuantity(1);
    setIsCustomItem(false);
    setCustomItemName('');
    setCustomItemSku('');
    setCustomItemPrice(0);
    setCustomItemQuantity(1);
  };

  const handleSaveEdit = () => {
    if (isSale && outgoingTransaction) {
      const linesSubtotal = editableItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const carried = outgoingTransaction.previousOutstandingCarried ?? 0;
      const totalRevenue = linesSubtotal + carried;
      const totalProfit = editableItems.reduce((sum, item) => {
        const inventoryItem = items.find(i => i.id === item.itemId);
        const costPerUnit = inventoryItem?.purchasePrice || 0;
        return sum + ((item.pricePerUnit - costPerUnit) * item.quantity);
      }, 0);

      updateOutgoingTransaction(outgoingTransaction.id, {
        items: editableItems,
        totalRevenue,
        totalProfit,
      });
    } else if (!isSale && incomingTransaction) {
      const linesSubtotal = editableItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const carried = incomingTransaction.previousOutstandingCarried ?? 0;
      const totalCost = linesSubtotal + carried;
      updateIncomingTransaction(incomingTransaction.id, {
        items: editableItems,
        totalCost,
      });
    }

    setIsEditing(false);
    setEditableItems([]);
    setNewItemId('');
    setNewItemQuantity(1);
    setIsCustomItem(false);
    setCustomItemName('');
    setCustomItemSku('');
    setCustomItemPrice(0);
    setCustomItemQuantity(1);
  };

  const handleUpdateItemQuantity = (index: number, quantity: number) => {
    const newItems = [...editableItems];
    newItems[index].quantity = quantity;
    newItems[index].totalPrice = quantity * newItems[index].pricePerUnit;
    setEditableItems(newItems);
  };

  const handleUpdateItemPrice = (index: number, price: number) => {
    const newItems = [...editableItems];
    newItems[index].pricePerUnit = price;
    newItems[index].totalPrice = price * newItems[index].quantity;
    setEditableItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = editableItems.filter((_, i) => i !== index);
    setEditableItems(newItems);
  };

  const handleAddItem = () => {
    if (isCustomItem) {
      // Add custom item
      if (!customItemName.trim() || customItemPrice <= 0) {
        return;
      }

      const newItem: TransactionItem = {
        itemId: `custom-${Date.now()}`,
        itemName: customItemName.trim(),
        sku: generateAdHocSku(),
        quantity: customItemQuantity,
        pricePerUnit: customItemPrice,
        totalPrice: customItemPrice * customItemQuantity,
      };

      setEditableItems([...editableItems, newItem]);
      setCustomItemName('');
      setCustomItemPrice(0);
      setCustomItemQuantity(1);
    } else {
      // Add from inventory
      const item = items.find(i => i.id === newItemId);
      if (!item) return;

      const pricePerUnit = isSale ? item.sellingPrice : item.purchasePrice;
      const newItem: TransactionItem = {
        itemId: item.id,
        itemName: item.name,
        sku: item.sku,
        quantity: newItemQuantity,
        pricePerUnit,
        totalPrice: pricePerUnit * newItemQuantity,
      };

      setEditableItems([...editableItems, newItem]);
      setNewItemId('');
      setNewItemQuantity(1);
    }
  };

  const displayItems = isEditing ? editableItems : transaction.items;
  const previousCarried = transaction.previousOutstandingCarried ?? 0;
  const goodsSubtotal = displayItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const invoiceGrandTotal = isSale && outgoingTransaction
    ? outgoingTransaction.totalRevenue
    : incomingTransaction!.totalCost;
  const displayInvoiceGrandTotal = isEditing
    ? Math.round((goodsSubtotal + previousCarried) * 100) / 100
    : invoiceGrandTotal;
  const totalAmount = displayInvoiceGrandTotal;
  const totalProfit = isSale && outgoingTransaction
    ? displayItems.reduce((sum, item) => {
        const inventoryItem = items.find(i => i.id === item.itemId);
        const costPerUnit = inventoryItem?.purchasePrice || 0;
        return sum + ((item.pricePerUnit - costPerUnit) * item.quantity);
      }, 0)
    : 0;

  const handlePaymentUpdate = (
    paidAmount: number,
    pendingAmount: number,
    paymentStatus: 'paid' | 'partial' | 'unpaid',
    paymentHistory: PaymentRecord[]
  ) => {
    if (isSale && outgoingTransaction) {
      updateOutgoingTransaction(outgoingTransaction.id, {
        paidAmount,
        pendingAmount,
        paymentStatus,
        paymentHistory,
      });
    } else if (!isSale && incomingTransaction) {
      updateIncomingTransaction(incomingTransaction.id, {
        paidAmount,
        pendingAmount,
        paymentStatus,
        paymentHistory,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons - Hidden when printing */}
      <div className="flex flex-col gap-3 print:hidden md:flex-row md:items-center md:justify-between">
        <Button variant="outline" onClick={() => navigate('/transactions')} className="w-full md:w-auto">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Transactions
        </Button>
        <div className="flex flex-col gap-2 md:flex-row">
          <div className="flex gap-2">
            <Button
              variant={billFormat === 'full' ? 'default' : 'outline'}
              onClick={() => setBillFormat('full')}
              className="flex-1 md:flex-none"
            >
              Full Page
            </Button>
            <Button
              variant={billFormat === 'compact' ? 'default' : 'outline'}
              onClick={() => setBillFormat('compact')}
              className="flex-1 md:flex-none"
            >
              Compact Receipt
            </Button>
          </div>
          {isSale && (
            <div className="flex gap-2">
              <Button
                variant={invoiceType === 'internal' ? 'default' : 'outline'}
                onClick={() => setInvoiceType('internal')}
                className="flex-1 md:flex-none"
              >
                Internal
              </Button>
              <Button
                variant={invoiceType === 'customer' ? 'default' : 'outline'}
                onClick={() => setInvoiceType('customer')}
                className="flex-1 md:flex-none"
              >
                Customer
              </Button>
            </div>
          )}
          {!isEditing ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleStartEdit} className="flex-1 md:flex-none">
                <Edit2 className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Edit Invoice</span>
                <span className="sm:hidden">Edit</span>
              </Button>
              <Button variant="outline" onClick={handlePrint} className="flex-1 md:flex-none">
                <Printer className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Print Bill</span>
                <span className="sm:hidden">Print</span>
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancelEdit} className="flex-1 md:flex-none">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} className="flex-1 md:flex-none">
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </div>

      <BillDeliveryPanel
        billNumber={transaction.billNumber}
        logs={deliveryLogs}
        loadingLogs={deliveryLogsLoading}
        onRefreshLogs={refreshDeliveryLogs}
        billFormat={billFormat}
        invoiceType={invoiceType}
        onCapturePdfBase64={captureBillPdfBase64}
      />

      <div ref={printableRef}>
      {billFormat === 'compact' ? (
        /* Compact Receipt Format */
        <Card className="max-w-sm mx-auto">
          <div className="p-4 text-sm">
            {deliveryRecordLine && (
              <div className="mb-3 rounded border border-dashed border-gray-300 bg-gray-50 px-2 py-1.5 text-center text-[10px] text-gray-700 sm:text-xs">
                {deliveryRecordLine}
              </div>
            )}
            {/* Store Header */}
            <div className="text-center border-b border-gray-300 pb-3 mb-3">
              <h1 className="text-lg font-bold text-gray-900">{storeSettings.storeName}</h1>
              <p className="text-xs text-gray-600 mt-1">{storeSettings.address}</p>
              <p className="text-xs text-gray-600">GST: {storeSettings.gstNumber}</p>
              <p className="text-xs text-gray-600">{storeSettings.phone}</p>
              {storeSettings.email && <p className="text-xs text-gray-600">{storeSettings.email}</p>}
            </div>

            {/* Bill Type */}
            <div className="text-center mb-3">
              <h2 className="font-bold text-sm">{isSale ? 'SALES RECEIPT' : 'PURCHASE RECEIPT'}</h2>
              {isSale && invoiceType === 'internal' && (
                <p className="text-xs text-blue-600">(Internal)</p>
              )}
            </div>

            {/* Transaction Info */}
            <div className="border-b border-gray-300 pb-2 mb-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Bill #:</span>
                <span className="font-medium">{transaction.billNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date:</span>
                <span className="font-medium">{new Date(transaction.date).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{isSale ? 'Customer:' : 'Supplier:'}</span>
                <span className="font-medium">
                  {isSale ? outgoingTransaction?.customerName : incomingTransaction?.supplierName}
                </span>
              </div>
            </div>

            {/* Items */}
            <div className="border-b border-gray-300 pb-2 mb-3">
              {displayItems.map((item, index) => (
                <div key={index} className="mb-2 text-xs">
                  <div className="flex justify-between font-medium">
                    <span>{item.itemName}</span>
                    <span>{formatINR(item.totalPrice)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>{item.quantity} × {formatINR(item.pricePerUnit)}</span>
                    <span className="text-xs">SKU: {item.sku}</span>
                  </div>
                  {isEditing && (
                    <div className="mt-1 flex gap-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItemQuantity(index, parseInt(e.target.value) || 1)}
                        className="w-16 px-1 py-1 text-xs border border-gray-300 rounded"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.pricePerUnit}
                        onChange={(e) => handleUpdateItemPrice(index, parseFloat(e.target.value) || 0)}
                        className="w-20 px-1 py-1 text-xs border border-gray-300 rounded"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-600 h-6 w-6 p-0"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-1 text-xs mb-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Line items:</span>
                <span>{formatINR(goodsSubtotal)}</span>
              </div>
              {previousCarried > 0 && (
                <div className="flex justify-between text-amber-800">
                  <span>Prior balance added:</span>
                  <span>{formatINR(previousCarried)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-gray-300">
                <span>TOTAL:</span>
                <span>{formatINR(displayInvoiceGrandTotal)}</span>
              </div>
            </div>

            {/* Payment status in compact view */}
            <div className="border-t border-gray-300 pt-2 mb-3 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Status:</span>
                <PaymentStatusBadge status={transaction.paymentStatus} />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Paid:</span>
                <span className="font-medium text-green-600">{formatINR(transaction.paidAmount)}</span>
              </div>
              {transaction.pendingAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Pending:</span>
                  <span className="font-medium text-red-600">{formatINR(transaction.pendingAmount)}</span>
                </div>
              )}
            </div>

            {/* Profit Info for Internal */}
            {isSale && invoiceType === 'internal' && (
              <div className="border-t border-gray-300 pt-2 mb-3 text-xs space-y-1">
                <div className="flex justify-between text-green-600">
                  <span>Profit:</span>
                  <span className="font-medium">{formatINR(totalProfit)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Margin:</span>
                  <span className="font-medium">
                    {goodsSubtotal > 0 ? ((totalProfit / goodsSubtotal) * 100).toFixed(1) : '0'}%
                  </span>
                </div>
              </div>
            )}

            {/* Notes */}
            {transaction.notes && (
              <div className="border-t border-gray-300 pt-2 mb-3 text-xs">
                <p className="text-gray-600 italic">{transaction.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-gray-300 pt-3 text-center text-xs text-gray-500">
              <p>{isSale ? 'Thank you for your business!' : 'Purchase recorded'}</p>
              <p className="mt-1">Powered by Store Inventory Manager</p>
            </div>
          </div>
        </Card>
      ) : (
        /* Full Page Invoice Format */
        <Card className="max-w-4xl mx-auto">
          <div className="p-4 sm:p-6 md:p-8 lg:p-12">
            {deliveryRecordLine && (
              <div className="mb-4 rounded border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-center text-xs text-gray-700">
                {deliveryRecordLine}
              </div>
            )}
            {/* Header */}
            <div className="text-center border-b border-gray-300 pb-6 mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                {storeSettings.storeName}
              </h1>
              <p className="text-gray-600 text-sm sm:text-base">{storeSettings.address}</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mt-2 text-xs sm:text-sm text-gray-600">
                <span>GST: {storeSettings.gstNumber}</span>
                <span className="hidden sm:inline">•</span>
                <span>{storeSettings.phone}</span>
                {storeSettings.email && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span>{storeSettings.email}</span>
                  </>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mt-4">
                {isSale ? 'SALES INVOICE' : 'PURCHASE INVOICE'}
              </h2>
              {isSale && invoiceType === 'internal' && (
                <p className="text-sm text-blue-600 mt-2">(Internal - With Profit Details)</p>
              )}
              {isSale && invoiceType === 'customer' && (
                <p className="text-sm text-green-600 mt-2">(Customer Copy)</p>
              )}
            </div>

            {/* Bill Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-8">
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-2">
                  {isSale ? 'BILL TO:' : 'PURCHASED FROM:'}
                </h3>
                <p className="font-medium text-gray-900 text-lg">
                  {isSale ? outgoingTransaction?.customerName : incomingTransaction?.supplierName}
                </p>
                {((isSale && outgoingTransaction?.customerContact) ||
                  (!isSale && incomingTransaction?.supplierContact)) && (
                  <p className="text-gray-600">
                    {isSale ? outgoingTransaction?.customerContact : incomingTransaction?.supplierContact}
                  </p>
                )}
              </div>
              <div className="md:text-right">
                <div className="mb-4">
                  <p className="text-sm text-gray-600">Bill Number</p>
                  <p className="font-semibold text-gray-900 text-lg">{transaction.billNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date</p>
                  <p className="font-medium text-gray-900">{formatDate(transaction.date)}</p>
                </div>
              </div>
            </div>

            {/* Item Details Table */}
            <div className="mb-8 overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-100 border-y border-gray-300">
                  <tr>
                    <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700 text-sm">Item Description</th>
                    <th className="text-center py-3 px-2 sm:px-4 font-semibold text-gray-700 text-sm">SKU</th>
                    <th className="text-center py-3 px-2 sm:px-4 font-semibold text-gray-700 text-sm">Quantity</th>
                    <th className="text-right py-3 px-2 sm:px-4 font-semibold text-gray-700 text-sm">Unit Price</th>
                    <th className="text-right py-3 px-2 sm:px-4 font-semibold text-gray-700 text-sm">Total</th>
                    {isEditing && <th className="text-center py-3 px-2 sm:px-4 font-semibold text-gray-700 text-sm">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((item, index) => (
                    <tr key={index} className="border-b border-gray-200">
                      <td className="py-3 sm:py-4 px-2 sm:px-4">
                        <p className="font-medium text-gray-900 text-sm sm:text-base">{item.itemName}</p>
                      </td>
                      <td className="text-center py-3 sm:py-4 px-2 sm:px-4 text-gray-600 text-sm">{item.sku}</td>
                      <td className="text-center py-3 sm:py-4 px-2 sm:px-4 text-gray-900 text-sm">
                        {isEditing ? (
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItemQuantity(index, parseInt(e.target.value) || 1)}
                            className="w-16 sm:w-20 px-1 sm:px-2 py-1 border border-gray-300 rounded text-center text-sm"
                          />
                        ) : (
                          item.quantity
                        )}
                      </td>
                      <td className="text-right py-3 sm:py-4 px-2 sm:px-4 text-gray-900 text-sm">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.pricePerUnit}
                            onChange={(e) => handleUpdateItemPrice(index, parseFloat(e.target.value) || 0)}
                            className="w-20 sm:w-28 px-1 sm:px-2 py-1 border border-gray-300 rounded text-right text-sm"
                          />
                        ) : (
                          formatINR(item.pricePerUnit)
                        )}
                      </td>
                      <td className="text-right py-3 sm:py-4 px-2 sm:px-4 font-medium text-gray-900 text-sm sm:text-base">{formatINR(item.totalPrice)}</td>
                      {isEditing && (
                        <td className="text-center py-3 sm:py-4 px-2 sm:px-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Add Item Section */}
              {isEditing && (
                <div className="mt-4 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-3">
                    <h4 className="font-semibold text-gray-700">Add Item</h4>
                    <div className="flex gap-2">
                      <Button
                        variant={!isCustomItem ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setIsCustomItem(false)}
                        className="flex-1 sm:flex-none"
                      >
                        From Inventory
                      </Button>
                      <Button
                        variant={isCustomItem ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setIsCustomItem(true)}
                        className="flex-1 sm:flex-none"
                      >
                        Custom Item
                      </Button>
                    </div>
                  </div>

                  {!isCustomItem ? (
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
                      <div className="flex-1">
                        <label className="block text-sm text-gray-600 mb-1">Select Item</label>
                        <select
                          value={newItemId}
                          onChange={(e) => setNewItemId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        >
                          <option value="">Choose an item...</option>
                          {items.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({item.sku}) - {formatINR(isSale ? item.sellingPrice : item.purchasePrice)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-full sm:w-32">
                        <label className="block text-sm text-gray-600 mb-1">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={newItemQuantity}
                          onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <Button
                        onClick={handleAddItem}
                        disabled={!newItemId}
                        className="w-full sm:w-auto whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Item
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Item Name *</label>
                        <input
                          type="text"
                          value={customItemName}
                          onChange={(e) => setCustomItemName(e.target.value)}
                          placeholder="Enter item name"
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">A unique line code is assigned automatically.</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
                        <div className="flex-1">
                          <label className="block text-sm text-gray-600 mb-1">Unit Price * ({isSale ? 'Selling' : 'Purchase'})</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={customItemPrice}
                            onChange={(e) => setCustomItemPrice(parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div className="w-full sm:w-32">
                          <label className="block text-sm text-gray-600 mb-1">Quantity *</label>
                          <input
                            type="number"
                            min="1"
                            value={customItemQuantity}
                            onChange={(e) => setCustomItemQuantity(parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <Button
                          onClick={handleAddItem}
                          disabled={!customItemName.trim() || customItemPrice <= 0}
                          className="w-full sm:w-auto whitespace-nowrap"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Custom Item
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="border-t border-gray-300 pt-6">
              <div className="flex justify-end">
                <div className="w-full sm:w-96 md:w-80">
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Line items subtotal:</span>
                    <span className="font-medium text-gray-900">
                      {formatINR(goodsSubtotal)}
                    </span>
                  </div>
                  {previousCarried > 0 && (
                    <div className="flex justify-between py-2 text-amber-800 text-sm">
                      <span>Prior balance added:</span>
                      <span>{formatINR(previousCarried)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-t border-gray-200">
                    <span className="text-lg font-semibold text-gray-900">Invoice total:</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatINR(displayInvoiceGrandTotal)}
                    </span>
                  </div>
                  
                  {/* Payment Information */}
                  <div className="mt-4 pt-4 border-t-2 border-gray-300 space-y-2">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm text-gray-600">Payment Status:</span>
                      <PaymentStatusBadge status={transaction.paymentStatus} />
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-sm text-gray-600">Paid Amount:</span>
                      <span className="font-medium text-green-600">
                        {formatINR(transaction.paidAmount)}
                      </span>
                    </div>
                    {transaction.pendingAmount > 0 && (
                      <div className="flex justify-between py-1">
                        <span className="text-sm font-semibold text-gray-900">Pending Amount:</span>
                        <span className="font-bold text-red-600">
                          {formatINR(transaction.pendingAmount)}
                        </span>
                      </div>
                    )}
                    
                    {/* Payment History */}
                    {transaction.paymentHistory && transaction.paymentHistory.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Payment History:</p>
                        <div className="space-y-1">
                          {transaction.paymentHistory.map((payment) => (
                            <div key={payment.id} className="flex justify-between text-xs">
                              <span className="text-gray-600">
                                {new Date(payment.date).toLocaleDateString('en-IN')} - {payment.method}
                              </span>
                              <span className="font-medium text-green-600">{formatINR(payment.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Update Payment Button */}
                    <div className="pt-3 print:hidden">
                      <Button
                        onClick={() => setIsPaymentDialogOpen(true)}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Update Payment Status
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Info - Only show profit on Internal invoices */}
            {(invoiceType === 'internal' || !isSale) && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Transaction Summary:</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Total Items: {displayItems.reduce((sum, item) => sum + item.quantity, 0)} units</p>
                      {isSale ? (
                        <>
                          <p>Line-item revenue: {formatINR(goodsSubtotal)}</p>
                          {previousCarried > 0 && (
                            <p className="text-amber-800">Prior balance on invoice: {formatINR(previousCarried)}</p>
                          )}
                          <p>Invoice total (customer): {formatINR(displayInvoiceGrandTotal)}</p>
                          <p>Total Profit: <span className="text-green-600 font-medium">{formatINR(totalProfit)}</span></p>
                          <p>Profit Margin: <span className="text-green-600 font-medium">
                            {goodsSubtotal > 0 ? ((totalProfit / goodsSubtotal) * 100).toFixed(1) : '0'}%
                          </span></p>
                        </>
                      ) : (
                        <>
                          <p>Purchase lines subtotal: {formatINR(goodsSubtotal)}</p>
                          {previousCarried > 0 && (
                            <p className="text-amber-800">Prior unpaid added: {formatINR(previousCarried)}</p>
                          )}
                          <p>Invoice total: {formatINR(displayInvoiceGrandTotal)}</p>
                        </>
                      )}
                    </div>
                  </div>
                  {transaction.notes && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Notes:</h4>
                      <p className="text-sm text-gray-600 italic">{transaction.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Customer Invoice - Only show notes if present */}
            {invoiceType === 'customer' && isSale && transaction.notes && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Notes:</h4>
                  <p className="text-sm text-gray-600 italic">{transaction.notes}</p>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-12 pt-6 border-t border-gray-300 text-center">
              <p className="text-gray-600 text-sm mb-2">
                {isSale ? 'Thank you for your business!' : 'Purchase recorded successfully'}
              </p>
              <p className="text-gray-500 text-xs">
                This is a computer-generated invoice. For any queries, please contact us.
              </p>
            </div>
          </div>
        </Card>
      )}
      </div>

      {/* Edit Payment Dialog */}
      <EditPaymentDialog
        isOpen={isPaymentDialogOpen}
        onClose={() => setIsPaymentDialogOpen(false)}
        onSave={handlePaymentUpdate}
        totalAmount={isSale ? (outgoingTransaction?.totalRevenue || 0) : (incomingTransaction?.totalCost || 0)}
        currentPaidAmount={transaction.paidAmount}
        currentPendingAmount={transaction.pendingAmount}
        currentPaymentHistory={transaction.paymentHistory}
        transactionType={isSale ? 'sale' : 'purchase'}
        partyName={isSale ? (outgoingTransaction?.customerName || '') : (incomingTransaction?.supplierName || '')}
      />
    </div>
  );
}