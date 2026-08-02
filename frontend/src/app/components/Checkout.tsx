// import { useState, useEffect } from 'react';
// import { useNavigate, useSearchParams } from 'react-router';
// import { useAuth } from '../context/AuthContext';
// import { Card } from './ui/card';
// import { Button } from './ui/button';
// import { Badge } from './ui/badge';
// import { ArrowLeft, CreditCard, Loader2, Shield } from 'lucide-react';
// import { formatINR } from '../utils/currency';
// import { SubscriptionPlan } from '../types';
// import { toast } from 'sonner';
// import { AuthAppHeader } from './AuthAppHeader';

// export function Checkout() {
//   const navigate = useNavigate();
//   const [searchParams] = useSearchParams();
//   const { user, createSubscription } = useAuth();
//   const [isProcessing, setIsProcessing] = useState(false);

//   const planParam = searchParams.get('plan') as SubscriptionPlan | null;
//   const durationParam = searchParams.get('duration');

//   useEffect(() => {
//     if (!planParam) {
//       navigate('/pricing');
//     }
//   }, [planParam, navigate]);

//   useEffect(() => {
//     if (searchParams.get('canceled') === '1') {
//       toast.message('Checkout canceled', {
//         description: 'You can complete payment whenever you are ready.',
//       });
//     }
//   }, [searchParams]);

//   if (!user || !planParam) {
//     return null;
//   }

//   const getPlanDetails = () => {
//     const MONTHLY_PRICE = 199;

//     const customDuration = durationParam
//       ? parseInt(durationParam, 10)
//       : 1;

//     const calculateDiscount = (months) => {

//       // 1–2 months → 0%
//       if (months <= 2) return 0;

//       // 3–5 months → 5%
//       if (months >= 3 && months <= 5) return 5;

//       // 6–11 months → 10%
//       if (months >= 6 && months <= 11) return 10;

//       // 12–17 months → 15%
//       if (months >= 12 && months <= 17) return 15;

//       // 18–23 months → 20%
//       if (months >= 18 && months <= 23) return 20;

//       // 24+ months → 25%
//       return 25;
//     };

//     const calculatePrice = (months) => {
//       const discount = calculateDiscount(months);

//       const originalPrice = MONTHLY_PRICE * months;

//       const discountedPrice =
//         originalPrice - (originalPrice * discount) / 100;

//       return {
//         originalPrice,
//         finalPrice: Math.round(discountedPrice),
//         discount,
//         savings: Math.round(originalPrice - discountedPrice),
//       };
//     };

//     switch (planParam) {

//       case "monthly": {
//         return {
//           name: "Monthly Plan",
//           duration: "1 Month",
//           price: MONTHLY_PRICE,
//           months: 1,
//           discount: 0,
//           savings: 0,
//         };
//       }

//       case "quarterly": {
//         const pricing = calculatePrice(3);

//         return {
//           name: "Quarterly Plan",
//           duration: "3 Months",
//           price: pricing.finalPrice,
//           months: 3,
//           discount: pricing.discount,
//           savings: pricing.savings,
//         };
//       }

//       case "annual": {
//         const pricing = calculatePrice(12);

//         return {
//           name: "Annual Plan",
//           duration: "12 Months",
//           price: pricing.finalPrice,
//           months: 12,
//           discount: pricing.discount,
//           savings: pricing.savings,
//         };
//       }

//       case "custom": {
//         const pricing = calculatePrice(customDuration);

//         return {
//           name: `Custom ${customDuration}-Month Plan`,
//           duration: `${customDuration} Months`,
//           price: pricing.finalPrice,
//           months: customDuration,
//           discount: pricing.discount,
//           savings: pricing.savings,
//         };
//       }

//       default: {
//         return {
//           name: "Monthly Plan",
//           duration: "1 Month",
//           price: MONTHLY_PRICE,
//           months: 1,
//           discount: 0,
//           savings: 0,
//         };
//       }
//     }
//   };

//   const planDetails = getPlanDetails();

//   const handleStripeCheckout = async () => {
//     setIsProcessing(true);
//     const result = await createSubscription(
//       planParam,
//       planParam === 'custom' ? planDetails.months : undefined
//     );
//     if (!result.success) {
//       setIsProcessing(false);
//     }
//   };

//   const totalWithGst = Math.round(planDetails.price * 1.18);

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
//       <AuthAppHeader
//         leftSlot={
//           <Button variant="ghost" size="sm" onClick={() => navigate('/pricing')} className="mr-1">
//             <ArrowLeft className="w-4 h-4 mr-2" />
//             Back to Pricing
//           </Button>
//         }
//       />
//       <div className="container mx-auto max-w-3xl py-12 px-4">
//         <Card className="p-8">
//           <div className="flex items-center justify-between mb-6">
//             <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
//             <div className="flex items-center gap-2 text-sm text-gray-600">
//               <Shield className="w-4 h-4" />
//               <span>Secured by Stripe</span>
//             </div>
//           </div>

//           <div className="rounded-lg border border-gray-200 p-6 mb-6 bg-gray-50">
//             <div className="flex items-center justify-between mb-2">
//               <span className="font-medium text-gray-900">{planDetails.name}</span>
//               {planDetails.savings ? (
//                 <Badge className="bg-green-100 text-green-800">
//                   Save {formatINR(planDetails.savings)}
//                 </Badge>
//               ) : null}
//             </div>
//             <p className="text-sm text-gray-600 mb-4">{planDetails.duration} subscription</p>
//             <div className="space-y-2 text-sm">
//               <div className="flex justify-between">
//                 <span className="text-gray-600">Subtotal</span>
//                 <span>{formatINR(planDetails.price)}</span>
//               </div>
//               <div className="flex justify-between">
//                 <span className="text-gray-600">GST (18%)</span>
//                 <span>{formatINR(Math.round(planDetails.price * 0.18))}</span>
//               </div>
//               <div className="flex justify-between text-lg font-semibold pt-2 border-t border-gray-200">
//                 <span>Total due</span>
//                 <span className="text-blue-600">{formatINR(totalWithGst)}</span>
//               </div>
//             </div>
//             <p className="text-xs text-gray-500 mt-3">
//               The amount charged on Stripe matches this total (catalog prices + 18% GST).
//             </p>
//           </div>

//           <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 mb-6 text-sm text-blue-900">
//             <p className="font-medium mb-1">Account</p>
//             <p>
//               {user.name} · {user.email}
//             </p>
//           </div>

//           <Button
//             onClick={handleStripeCheckout}
//             disabled={isProcessing}
//             className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6"
//           >
//             {isProcessing ? (
//               <>
//                 <Loader2 className="w-5 h-5 mr-2 animate-spin" />
//                 Redirecting to Stripe…
//               </>
//             ) : (
//               <>
//                 <CreditCard className="w-5 h-5 mr-2" />
//                 Pay {formatINR(totalWithGst)} with Stripe
//               </>
//             )}
//           </Button>

//           <p className="text-xs text-center text-gray-500 mt-4">
//             You will complete payment on Stripe Checkout. Cards and other methods supported by Stripe
//             for your region may be available.
//           </p>
//         </Card>
//       </div>
//     </div>
//   );
// }


import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ArrowLeft, CreditCard, Loader2, CheckCircle, Shield, Lock } from 'lucide-react';
import { formatINR } from '../utils/currency';
import { SubscriptionPlan } from '../types';
import { toast } from 'sonner';

export function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, createSubscription } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const planParam = searchParams.get('plan') as SubscriptionPlan | null;

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');

  useEffect(() => {
    if (!planParam) {
      navigate('/pricing');
    }
  }, [planParam, navigate]);

  if (!user || !planParam) {
    return null;
  }

  const getPlanDetails = () => {
    switch (planParam) {
      case 'monthly':
        return { name: 'Monthly Plan', duration: '1 Month', price: 999, months: 1 };
      case 'quarterly':
        return { name: 'Quarterly Plan', duration: '3 Months', price: 2699, months: 3, savings: 298 };
      case 'six_month':
        return { name: '6-Month Plan', duration: '6 Months', price: 4999, months: 6, savings: 995 };
      case 'annual':
        return { name: 'Annual Plan', duration: '12 Months', price: 9999, months: 12, savings: 1989 };
      default:
        return { name: 'Monthly Plan', duration: '1 Month', price: 999, months: 1 };
    }
  };

  const planDetails = getPlanDetails();

  const handlePayment = async () => {
    setIsProcessing(true);

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Create subscription
    const result = await createSubscription(planParam);

    if (result.success) {
      setPaymentSuccess(true);
      toast.success('Subscription activated successfully!');

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } else {
      toast.error('Payment failed. Please try again.');
      setIsProcessing(false);
    }
  };

  if (paymentSuccess) {
    return (
      <div className="h-screen overflow-y-auto bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center px-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Payment Successful!
            </h2>
            <p className="text-gray-600">
              Your subscription has been activated successfully.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Plan:</span>
              <span className="font-semibold text-gray-900">{planDetails.name}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Duration:</span>
              <span className="font-semibold text-gray-900">{planDetails.duration}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Amount Paid:</span>
              <span className="font-semibold text-green-600">{formatINR(planDetails.price)}</span>
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Redirecting to dashboard...
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="container mx-auto max-w-5xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/pricing')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Pricing
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Order Summary */}
          <div className="lg:col-span-2">
            <Card className="p-6 sticky top-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h2>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700 font-medium">{planDetails.name}</span>
                  {planDetails.savings && (
                    <Badge className="bg-green-100 text-green-800">
                      Save {formatINR(planDetails.savings)}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500">{planDetails.duration} subscription</p>
              </div>

              <div className="border-t border-gray-200 pt-4 mb-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="text-gray-900">{formatINR(planDetails.price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax (GST 18%):</span>
                  <span className="text-gray-900">{formatINR(Math.round(planDetails.price * 0.18))}</span>
                </div>
                <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">Total:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {formatINR(Math.round(planDetails.price * 1.18))}
                  </span>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">What's Included:</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>✓ Full access to all features</li>
                  <li>✓ Unlimited inventory items</li>
                  <li>✓ Priority support</li>
                  <li>✓ Regular updates</li>
                  <li>✓ Mobile & desktop access</li>
                </ul>
              </div>
            </Card>
          </div>

          {/* Payment Form */}
          <div className="lg:col-span-3">
            <Card className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Payment Details</h2>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Shield className="w-4 h-4" />
                  <span>Secure Checkout</span>
                </div>
              </div>

              {/* Account Info */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Account Information</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Name:</span>
                    <span className="font-medium text-gray-900">{user.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-medium text-gray-900">{user.email}</span>
                  </div>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Payment Method</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => setSelectedPaymentMethod('upi')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedPaymentMethod === 'upi'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-semibold text-gray-900 mb-1">UPI</div>
                      <div className="text-xs text-gray-500">Google Pay, PhonePe</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedPaymentMethod('card')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedPaymentMethod === 'card'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-semibold text-gray-900 mb-1">Card</div>
                      <div className="text-xs text-gray-500">Credit/Debit</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedPaymentMethod('netbanking')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedPaymentMethod === 'netbanking'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-semibold text-gray-900 mb-1">Net Banking</div>
                      <div className="text-xs text-gray-500">All banks</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Payment Form - Simulated */}
              <div className="mb-6 bg-gray-50 rounded-lg p-6 border border-gray-200">
                <div className="flex items-center gap-2 mb-4 text-amber-700">
                  <Lock className="w-4 h-4" />
                  <span className="text-sm font-medium">Demo Mode - No Real Payment Required</span>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  This is a demo checkout. In production, this would integrate with Razorpay or Stripe for secure payment processing.
                </p>

                {selectedPaymentMethod === 'upi' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      UPI ID
                    </label>
                    <input
                      type="text"
                      placeholder="yourname@upi"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}

                {selectedPaymentMethod === 'card' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Card Number
                      </label>
                      <input
                        type="text"
                        placeholder="1234 5678 9012 3456"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Expiry Date
                        </label>
                        <input
                          type="text"
                          placeholder="MM/YY"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          CVV
                        </label>
                        <input
                          type="text"
                          placeholder="123"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedPaymentMethod === 'netbanking' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Bank
                    </label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option>State Bank of India</option>
                      <option>HDFC Bank</option>
                      <option>ICICI Bank</option>
                      <option>Axis Bank</option>
                      <option>Other</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Terms and Conditions */}
              <div className="mb-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    defaultChecked
                  />
                  <span className="text-sm text-gray-600">
                    I agree to the{' '}
                    <a href="#" className="text-blue-600 hover:underline">
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="#" className="text-blue-600 hover:underline">
                      Privacy Policy
                    </a>
                  </span>
                </label>
              </div>

              {/* Pay Button */}
              <Button
                onClick={handlePayment}
                disabled={isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 mr-2" />
                    Pay {formatINR(Math.round(planDetails.price * 1.18))}
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-gray-500 mt-4">
                Your payment is secured with 256-bit SSL encryption
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
