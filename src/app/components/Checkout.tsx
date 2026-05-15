import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ArrowLeft, CreditCard, Loader2, Shield } from 'lucide-react';
import { formatINR } from '../utils/currency';
import { SubscriptionPlan } from '../types';
import { toast } from 'sonner';

export function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, createSubscription } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const planParam = searchParams.get('plan') as SubscriptionPlan | null;
  const durationParam = searchParams.get('duration');

  useEffect(() => {
    if (!planParam) {
      navigate('/pricing');
    }
  }, [planParam, navigate]);

  useEffect(() => {
    if (searchParams.get('canceled') === '1') {
      toast.message('Checkout canceled', {
        description: 'You can complete payment whenever you are ready.',
      });
    }
  }, [searchParams]);

  if (!user || !planParam) {
    return null;
  }

  const getPlanDetails = () => {
    const customDuration = durationParam ? parseInt(durationParam, 10) : 6;

    switch (planParam) {
      case 'monthly':
        return {
          name: 'Monthly Plan',
          duration: '1 Month',
          price: 999,
          months: 1,
        };
      case 'quarterly':
        return {
          name: 'Quarterly Plan',
          duration: '3 Months',
          price: 2699,
          months: 3,
          savings: 298,
        };
      case 'annual':
        return {
          name: 'Annual Plan',
          duration: '12 Months',
          price: 9999,
          months: 12,
          savings: 1989,
        };
      case 'custom': {
        const pricePerMonth = customDuration >= 6 ? 899 : 999;
        const totalPrice = customDuration * pricePerMonth;
        const regularPrice = customDuration * 999;
        return {
          name: `Custom ${customDuration}-Month Plan`,
          duration: `${customDuration} Months`,
          price: totalPrice,
          months: customDuration,
          savings: customDuration >= 6 ? regularPrice - totalPrice : 0,
        };
      }
      default:
        return {
          name: 'Monthly Plan',
          duration: '1 Month',
          price: 999,
          months: 1,
        };
    }
  };

  const planDetails = getPlanDetails();

  const handleStripeCheckout = async () => {
    setIsProcessing(true);
    const result = await createSubscription(
      planParam,
      planParam === 'custom' ? planDetails.months : undefined
    );
    if (!result.success) {
      setIsProcessing(false);
    }
  };

  const totalWithGst = Math.round(planDetails.price * 1.18);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="container mx-auto max-w-3xl">
        <Button variant="ghost" onClick={() => navigate('/pricing')} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Pricing
        </Button>

        <Card className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Shield className="w-4 h-4" />
              <span>Secured by Stripe</span>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-6 mb-6 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900">{planDetails.name}</span>
              {planDetails.savings ? (
                <Badge className="bg-green-100 text-green-800">
                  Save {formatINR(planDetails.savings)}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-gray-600 mb-4">{planDetails.duration} subscription</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span>{formatINR(planDetails.price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">GST (18%)</span>
                <span>{formatINR(Math.round(planDetails.price * 0.18))}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold pt-2 border-t border-gray-200">
                <span>Total due</span>
                <span className="text-blue-600">{formatINR(totalWithGst)}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              The amount charged on Stripe matches this total (catalog prices + 18% GST).
            </p>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 mb-6 text-sm text-blue-900">
            <p className="font-medium mb-1">Account</p>
            <p>
              {user.name} · {user.email}
            </p>
          </div>

          <Button
            onClick={handleStripeCheckout}
            disabled={isProcessing}
            className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Redirecting to Stripe…
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Pay {formatINR(totalWithGst)} with Stripe
              </>
            )}
          </Button>

          <p className="text-xs text-center text-gray-500 mt-4">
            You will complete payment on Stripe Checkout. Cards and other methods supported by Stripe
            for your region may be available.
          </p>
        </Card>
      </div>
    </div>
  );
}
