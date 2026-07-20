import { PaymentRecord } from '../types';

/** Build dialog history from API data, or synthesize one entry from paidAmount for older bills. */
export function resolveInitialPaymentHistory(
  history: PaymentRecord[] | undefined,
  paidAmount: number,
): PaymentRecord[] {
  if (history && history.length > 0) {
    return history;
  }

  if (paidAmount > 0) {
    return [
      {
        id: 'prior-payments',
        amount: paidAmount,
        date: new Date().toISOString(),
        method: 'other',
        notes: 'Previously recorded payment',
      },
    ];
  }

  return [];
}
