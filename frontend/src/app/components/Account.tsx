import { Navigate, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  User,
  Mail,
  Calendar,
  CreditCard,
  ArrowLeft,
  Crown,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { formatINR } from '../utils/currency';
import { toast } from 'sonner';

export function Account() {
  const navigate = useNavigate();
  const { user, subscription, hasActiveSubscription, logout, cancelSubscription } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleCancelSubscription = async () => {
    if (
      !window.confirm(
        'Are you sure you want to cancel your subscription? Your access will continue until the end of the current billing period.'
      )
    ) {
      return;
    }
    await cancelSubscription();
    if (!subscription?.stripeBacked) {
      toast.success('Subscription cancelled successfully');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'trial':
        return 'bg-blue-100 text-blue-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'trial':
        return <Crown className="w-5 h-5 text-blue-600" />;
      case 'expired':
      case 'cancelled':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getPlanName = () => {
    if (!subscription) return 'No Plan';

    switch (subscription.plan) {
      case 'monthly':
        return 'Monthly Plan';
      case 'quarterly':
        return 'Quarterly Plan';
      case 'annual':
        return 'Annual Plan';
      case 'custom':
        return `Custom ${subscription.customDuration}-Month Plan`;
      default:
        return 'Unknown Plan';
    }
  };

  const daysRemaining = subscription
    ? Math.ceil((new Date(subscription.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Account Settings</h1>
          <p className="text-gray-600">Manage your account and subscription</p>
        </div>

        {/* Account Information */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Account Information</h2>
            <Button variant="outline" size="sm" onClick={logout}>
              Log Out
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-medium text-gray-900">{user.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Mail className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium text-gray-900">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Member Since</p>
                <p className="font-medium text-gray-900">
                  {new Date(user.createdAt).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Subscription Information */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Subscription</h2>
            {subscription && (
              <Badge className={getStatusColor(subscription.status)}>
                <span className="flex items-center gap-1">
                  {getStatusIcon(subscription.status)}
                  {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                </span>
              </Badge>
            )}
          </div>

          {subscription ? (
            <div className="space-y-6">
              {/* Current Plan */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                      <Crown className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{getPlanName()}</h3>
                      <p className="text-sm text-gray-600">
                        {formatINR(subscription.amount)} total
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Start Date</p>
                    <p className="font-medium text-gray-900">
                      {new Date(subscription.startDate).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">End Date</p>
                    <p className="font-medium text-gray-900">
                      {new Date(subscription.endDate).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                {hasActiveSubscription && (
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Days Remaining</span>
                      <span className="text-lg font-bold text-blue-600">
                        {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                    <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all"
                        style={{
                          width: `${Math.max(0, Math.min(100, (daysRemaining / 365) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                {hasActiveSubscription ? (
                  <>
                    <Button
                      onClick={() => navigate('/pricing')}
                      variant="outline"
                      className="flex-1"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Upgrade Plan
                    </Button>
                    {subscription.status !== 'cancelled' && (
                      <Button
                        onClick={handleCancelSubscription}
                        variant="outline"
                        className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Cancel Subscription
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    onClick={() => navigate('/pricing')}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Renew Subscription
                  </Button>
                )}
              </div>

              {/* Warning for Cancelled */}
              {subscription.status === 'cancelled' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-900 mb-1">Subscription Cancelled</p>
                      <p className="text-sm text-amber-800">
                        Your subscription has been cancelled. You can continue using the service until{' '}
                        {new Date(subscription.endDate).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                        .
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Warning for Expired */}
              {subscription.status === 'expired' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-900 mb-1">Subscription Expired</p>
                      <p className="text-sm text-red-800">
                        Your subscription expired on{' '}
                        {new Date(subscription.endDate).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                        . Please renew to continue using the service.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Subscription</h3>
              <p className="text-gray-600 mb-4">
                Subscribe to unlock all features and start managing your inventory.
              </p>
              <Button
                onClick={() => navigate('/pricing')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                View Pricing Plans
              </Button>
            </div>
          )}
        </Card>

        {/* Help & Support */}
        <Card className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Help & Support</h2>
          <div className="space-y-3">
            <p className="text-gray-600">
              Need help? Contact our support team at{' '}
              <a href="mailto:support@inventorymanager.com" className="text-blue-600 hover:underline">
                support@inventorymanager.com
              </a>
            </p>
            <p className="text-sm text-gray-500">
              We typically respond within 24 hours.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
