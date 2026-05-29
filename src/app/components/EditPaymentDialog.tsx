import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { CreditCard, Plus } from 'lucide-react';
import { formatINR } from '../utils/currency';
import { PaymentRecord } from '../types';
import { resolveInitialPaymentHistory } from '../utils/paymentHistory';

interface EditPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (paidAmount: number, pendingAmount: number, paymentStatus: 'paid' | 'partial' | 'unpaid', paymentHistory: PaymentRecord[]) => void;
  totalAmount: number;
  currentPaidAmount: number;
  currentPendingAmount: number;
  currentPaymentHistory?: PaymentRecord[];
  transactionType: 'sale' | 'purchase';
  partyName: string;
}

export function EditPaymentDialog({
  isOpen,
  onClose,
  onSave,
  totalAmount,
  currentPaidAmount,
  currentPendingAmount,
  currentPaymentHistory = [],
  transactionType,
  partyName,
}: EditPaymentDialogProps) {
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState('cash');
  const [newPaymentNotes, setNewPaymentNotes] = useState('');
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    setPaymentHistory(resolveInitialPaymentHistory(currentPaymentHistory, currentPaidAmount));
    setNewPaymentAmount('');
    setNewPaymentMethod('cash');
    setNewPaymentNotes('');
  }, [isOpen, currentPaymentHistory, currentPaidAmount]);

  const totalPaid = paymentHistory.reduce((sum, payment) => sum + payment.amount, 0);
  const remainingBalance = totalAmount - totalPaid;

  const handleAddPayment = () => {
    const amount = parseFloat(newPaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      return;
    }

    if (amount > remainingBalance) {
      alert(`Payment amount cannot exceed remaining balance of ${formatINR(remainingBalance)}`);
      return;
    }

    const newPayment: PaymentRecord = {
      id: Date.now().toString(),
      amount,
      date: new Date().toISOString(),
      method: newPaymentMethod,
      notes: newPaymentNotes.trim() || undefined,
    };

    setPaymentHistory([...paymentHistory, newPayment]);
    setNewPaymentAmount('');
    setNewPaymentNotes('');
  };

  const handleMarkAsPaid = () => {
    if (remainingBalance > 0) {
      const newPayment: PaymentRecord = {
        id: Date.now().toString(),
        amount: remainingBalance,
        date: new Date().toISOString(),
        method: newPaymentMethod,
        notes: 'Payment cleared',
      };
      setPaymentHistory([...paymentHistory, newPayment]);
    }
  };

  const handleSave = () => {
    const totalPaidAmount = paymentHistory.reduce((sum, payment) => sum + payment.amount, 0);
    const pendingAmount = totalAmount - totalPaidAmount;
    const paymentStatus: 'paid' | 'partial' | 'unpaid' = 
      totalPaidAmount === 0 ? 'unpaid' : 
      totalPaidAmount >= totalAmount ? 'paid' : 
      'partial';

    onSave(totalPaidAmount, pendingAmount, paymentStatus, paymentHistory);
    onClose();
  };

  const handleRemovePayment = (id: string) => {
    setPaymentHistory(paymentHistory.filter(p => p.id !== id));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Update Payment Status
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-700">
                {transactionType === 'sale' ? 'Customer' : 'Vendor'}:
              </span>
              <span className="text-sm font-medium text-gray-900">{partyName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-700">Total Amount:</span>
              <span className="text-sm font-semibold text-gray-900">{formatINR(totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-700">Paid Amount:</span>
              <span className="text-sm font-semibold text-green-600">{formatINR(totalPaid)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-blue-300">
              <span className="text-sm font-semibold text-gray-900">Remaining Balance:</span>
              <span className={`text-sm font-bold ${remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatINR(remainingBalance)}
              </span>
            </div>
          </div>

          {/* Payment History */}
          {paymentHistory.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Payment History</h4>
              <div className="space-y-2">
                {paymentHistory.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{formatINR(payment.amount)}</span>
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                          {payment.method}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {new Date(payment.date).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {payment.notes && (
                        <p className="text-xs text-gray-500 mt-1">{payment.notes}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePayment(payment.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add New Payment */}
          {remainingBalance > 0 && (
            <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-900">Add Payment</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentAmount">Amount (INR)</Label>
                  <Input
                    id="paymentAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    max={remainingBalance}
                    value={newPaymentAmount}
                    onChange={(e) => setNewPaymentAmount(e.target.value)}
                    placeholder={`Max: ${formatINR(remainingBalance)}`}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select value={newPaymentMethod} onValueChange={setNewPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentNotes">Notes (optional)</Label>
                <Textarea
                  id="paymentNotes"
                  value={newPaymentNotes}
                  onChange={(e) => setNewPaymentNotes(e.target.value)}
                  placeholder="Add any notes about this payment..."
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddPayment} disabled={!newPaymentAmount || parseFloat(newPaymentAmount) <= 0}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Payment
                </Button>
                <Button variant="outline" onClick={handleMarkAsPaid}>
                  Mark as Fully Paid
                </Button>
              </div>
            </div>
          )}

          {remainingBalance === 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <p className="text-green-800 font-medium">✓ Payment Completed</p>
              <p className="text-sm text-green-600 mt-1">All payments have been received</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Payment Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
