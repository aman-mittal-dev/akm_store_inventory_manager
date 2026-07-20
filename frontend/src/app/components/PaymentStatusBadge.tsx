import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface PaymentStatusBadgeProps {
  status: 'paid' | 'partial' | 'unpaid';
  className?: string;
}

export function PaymentStatusBadge({ status, className = '' }: PaymentStatusBadgeProps) {
  const statusConfig = {
    paid: {
      label: 'Paid',
      icon: CheckCircle2,
      className: 'bg-green-100 text-green-800 border-green-200',
    },
    partial: {
      label: 'Partially Paid',
      icon: Clock,
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    },
    unpaid: {
      label: 'Unpaid',
      icon: AlertCircle,
      className: 'bg-red-100 text-red-800 border-red-200',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.className} ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}
