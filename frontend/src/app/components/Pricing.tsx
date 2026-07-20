import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Check, Sparkles, ArrowLeft } from 'lucide-react';
import { formatINR } from '../utils/currency';
import { PricingPlan } from '../types';

const MONTHLY_PRICE = 199;

const pricingPlans: PricingPlan[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    duration: '1 Month',
    price: 199,
    features: [
      'Unlimited inventory items',
      'Complete transaction management',
      'Sales & purchase tracking',
      'Payment tracking & receivables',
      'Bill generation & printing',
      'Analytics & reports',
      'Bundle items support',
      'Mobile & desktop responsive',
      'Priority email support',
    ],
  },
  {
    id: 'quarterly',
    name: 'Quarterly',
    duration: '3 Months',
    price: 567,
    popular: true,
    features: [
      'All Monthly features',
      'Save 5%',
      'Extended support',
      'Quarterly business insights',
      'Priority feature requests',
    ],
  },
  {
    id: 'annual',
    name: 'Annual',
    duration: '12 Months',
    price: 2030,
    features: [
      'All Monthly features',
      'Save 15%',
      'Best value for money',
      'Dedicated account manager',
      'Annual business review',
      'Premium support',
      'Early access to new features',
    ],
  },
];

export function Pricing() {

  const navigate = useNavigate();
  const { user } = useAuth();

  const [customMonths, setCustomMonths] = useState(6);

  const handleSelectPlan = (planId: string) => {

    if (planId === 'custom') {
      navigate(`/checkout?plan=custom&duration=${customMonths}`);
    } else {
      navigate(`/checkout?plan=${planId}`);
    }

  };

  // Discount Logic
  const calculateDiscount = (months: number) => {

    // 1–2 months → 0%
    if (months <= 2) return 0;

    // 3–5 months → 5%
    if (months >= 3 && months <= 5) return 5;

    // 6–11 months → 10%
    if (months >= 6 && months <= 11) return 10;

    // 12–17 months → 15%
    if (months >= 12 && months <= 17) return 15;

    // 18–23 months → 20%
    if (months >= 18 && months <= 23) return 20;

    // 24+ months → 25%
    return 25;
  };

  // Calculate Final Price
  const calculateCustomPrice = (months: number) => {

    const discount = calculateDiscount(months);

    const originalPrice = MONTHLY_PRICE * months;

    const discountedPrice =
      originalPrice - (originalPrice * discount) / 100;

    return Math.round(discountedPrice);

  };

  // Calculate Savings
  const calculateSavings = (months: number) => {

    const regularPrice = MONTHLY_PRICE * months;

    const customPrice = calculateCustomPrice(months);

    return regularPrice - customPrice;

  };

  return (

    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">

      <div className="container mx-auto px-4 py-12">

        {/* Back Button */}
        {user && (

          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-6"
          >

            <ArrowLeft className="w-4 h-4 mr-2" />

            Back to Dashboard

          </Button>

        )}

        {/* Header */}
        <div className="text-center mb-12">

          <div className="flex items-center justify-center mb-4">

            <Sparkles className="w-8 h-8 text-blue-600 mr-2" />

            <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
              Simple, Transparent Pricing
            </h1>

          </div>

          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Choose the perfect plan for your business.
            All plans include full access to all features.
          </p>

          <p className="text-sm text-gray-500 mt-2">
            All prices in Indian Rupees (₹) • No hidden fees • Cancel anytime
          </p>

        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto mb-12">

          {pricingPlans.map((plan) => (

            <Card
              key={plan.id}
              className={`relative p-8 ${
                plan.popular
                  ? 'border-2 border-blue-500 shadow-xl scale-105'
                  : 'border border-gray-200'
              }`}
            >

              {plan.popular && (

                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1">
                  Most Popular
                </Badge>

              )}

              <div className="text-center mb-6">

                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>

                <div className="mb-4">

                  <span className="text-4xl font-bold text-gray-900">
                    {formatINR(plan.price)}
                  </span>

                  <span className="text-gray-600 ml-2">
                    / {plan.duration}
                  </span>

                </div>

                <p className="text-sm text-gray-500">

                  {`${formatINR(
                    Math.round(
                      plan.price /
                      (plan.id === 'quarterly' ? 3 : 12)
                    )
                  )}/month`}

                </p>

              </div>

              <ul className="space-y-3 mb-8">

                {plan.features.map((feature, index) => (

                  <li key={index} className="flex items-start">

                    <Check className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />

                    <span className="text-gray-700">
                      {feature}
                    </span>

                  </li>

                ))}

              </ul>

              <Button
                onClick={() => handleSelectPlan(plan.id)}
                className={`w-full ${
                  plan.popular
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-900 hover:bg-gray-800'
                }`}
              >

                Get Started

              </Button>

            </Card>

          ))}

        </div>

        {/* Custom Duration Plan */}
        <Card className="max-w-4xl mx-auto p-8 border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">

          <div className="text-center mb-6">

            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Custom Duration Plan
            </h3>

            <p className="text-gray-600">
              Need a different duration?
              Create your own custom plan
            </p>

          </div>

          <div className="max-w-2xl mx-auto">

            {/* Slider */}
            <div className="mb-6">

              <label className="block text-sm font-medium text-gray-700 mb-3">

                Select Duration (Months): {customMonths}

              </label>

              <input
                type="range"
                min="1"
                max="36"
                value={customMonths}
                onChange={(e) =>
                  setCustomMonths(parseInt(e.target.value))
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />

              <div className="flex justify-between text-xs text-gray-500 mt-1">

                <span>1 month</span>

                <span>36 months</span>

              </div>

            </div>

            {/* Pricing Summary */}
            <div className="bg-white rounded-lg p-6 mb-6 border border-gray-200">

              <div className="flex justify-between items-center mb-3">

                <span className="text-gray-700">
                  Duration:
                </span>

                <span className="font-semibold text-gray-900">
                  {customMonths} {customMonths === 1 ? 'month' : 'months'}
                </span>

              </div>

              <div className="flex justify-between items-center mb-3">

                <span className="text-gray-700">
                  Monthly Price:
                </span>

                <span className="font-semibold text-gray-900">
                  {formatINR(MONTHLY_PRICE)}
                </span>

              </div>

              <div className="flex justify-between items-center mb-3">

                <span className="text-gray-700">
                  Discount:
                </span>

                <span className="font-semibold text-green-600">
                  {calculateDiscount(customMonths)}%
                </span>

              </div>

              {calculateDiscount(customMonths) > 0 && (

                <div className="flex justify-between items-center mb-3 text-green-600">

                  <span>You save:</span>

                  <span className="font-semibold">
                    {formatINR(calculateSavings(customMonths))}
                  </span>

                </div>

              )}

              <div className="border-t border-gray-200 pt-3 mt-3">

                <div className="flex justify-between items-center">

                  <span className="text-lg font-bold text-gray-900">
                    Total:
                  </span>

                  <span className="text-2xl font-bold text-purple-600">
                    {formatINR(calculateCustomPrice(customMonths))}
                  </span>

                </div>

              </div>

            </div>

            <Button
              onClick={() => handleSelectPlan('custom')}
              className="w-full bg-purple-600 hover:bg-purple-700 text-lg py-6"
            >

              Subscribe for {customMonths}{' '}
              {customMonths === 1 ? 'Month' : 'Months'}

            </Button>

          </div>

        </Card>

        {/* FAQ */}
        <div className="mt-16 max-w-4xl mx-auto text-center">

          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">

            <div>

              <h4 className="font-semibold text-gray-900 mb-2">
                Can I cancel anytime?
              </h4>

              <p className="text-gray-600 text-sm">
                Yes, you can cancel your subscription at any time.
                Your access will continue until the end of your billing period.
              </p>

            </div>

            <div>

              <h4 className="font-semibold text-gray-900 mb-2">
                Do you offer refunds?
              </h4>

              <p className="text-gray-600 text-sm">
                We offer a 7-day money-back guarantee if you're not satisfied with our service.
              </p>

            </div>

            <div>

              <h4 className="font-semibold text-gray-900 mb-2">
                What payment methods do you accept?
              </h4>

              <p className="text-gray-600 text-sm">
                We accept all major payment methods including UPI,
                cards, net banking, and wallets through Razorpay.
              </p>

            </div>

            <div>

              <h4 className="font-semibold text-gray-900 mb-2">
                Is there a free trial?
              </h4>

              <p className="text-gray-600 text-sm">
                New users get a 14-day free trial with full access to all features.
                No credit card required.
              </p>

            </div>

          </div>

        </div>

      </div>

    </div>

  );
}