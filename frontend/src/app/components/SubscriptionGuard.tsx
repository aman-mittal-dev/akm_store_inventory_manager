import { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { AlertCircle, Crown } from 'lucide-react';
import { useNavigate } from 'react-router';

interface SubscriptionGuardProps {
  children: ReactNode;
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { user, subscription, hasActiveSubscription, isLoading } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // New users get a 14-day trial
  if (!subscription) {
    // Auto-create trial subscription for new users
    return <Navigate to="/pricing" replace />;
  }

  if (!hasActiveSubscription) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex items-center justify-center px-4">
        <Card className="max-w-lg w-full p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10 text-orange-600" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Subscription {subscription.status === 'expired' ? 'Expired' : 'Required'}
            </h2>

            {subscription.status === 'expired' ? (
              <p className="text-gray-600 mb-6">
                Your subscription expired on{' '}
                {new Date(subscription.endDate).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                . Please renew to continue using the service.
              </p>
            ) : subscription.status === 'cancelled' ? (
              <p className="text-gray-600 mb-6">
                Your subscription has been cancelled. Subscribe again to continue using the service.
              </p>
            ) : (
              <p className="text-gray-600 mb-6">
                You need an active subscription to access this service.
              </p>
            )}

            <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-900">Why Subscribe?</span>
              </div>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✓ Complete inventory management</li>
                <li>✓ Unlimited transactions & bills</li>
                <li>✓ Advanced analytics & reports</li>
                <li>✓ Payment tracking & receivables</li>
                <li>✓ Priority support</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => navigate('/pricing')}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                View Pricing Plans
              </Button>
              <Button
                onClick={() => navigate('/account')}
                variant="outline"
                className="flex-1"
              >
                Manage Account
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
