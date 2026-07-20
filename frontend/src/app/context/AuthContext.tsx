import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';
import { Subscription, SubscriptionPlan } from '../types';
import { googleAuthApi, loginApi, meApi, signupApi, type ApiSubscription, type AuthSuccessData } from '../services/authService';
import { createStripeBillingPortalSession, createStripeCheckoutSession } from '../services/paymentService';
import { getAccessToken, setAccessToken } from '../lib/api';
import { humanizeApiError } from '../utils/apiErrors';

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  subscription: Subscription | null;
  isLoading: boolean;
  hasActiveSubscription: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: (idToken: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  createSubscription: (plan: SubscriptionPlan, customDuration?: number) => Promise<{ success: boolean; subscription?: Subscription }>;
  cancelSubscription: () => Promise<void>;
  checkSubscriptionStatus: () => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function hasStripeSubscription(apiUser: { subscription?: ApiSubscription | null }): boolean {
  return Boolean(apiUser.subscription?.stripe_subscription_id);
}

function mapApiSubscriptionToLocal(sub: ApiSubscription, userId: string): Subscription {
  return {
    id: sub.stripe_subscription_id,
    userId,
    plan: sub.plan as SubscriptionPlan,
    status: sub.status as Subscription['status'],
    startDate: sub.start_date || new Date().toISOString(),
    endDate: sub.end_date || new Date().toISOString(),
    amount: sub.amount_inr ?? 0,
    customDuration: sub.custom_duration_months ?? undefined,
    autoRenew: sub.status === 'active' && !sub.cancel_at_period_end,
    stripeBacked: true,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getStoredSubscriptions = (): Subscription[] =>
    JSON.parse(localStorage.getItem('inventory_subscriptions') || '[]');

  const saveStoredSubscriptions = (subscriptions: Subscription[]) => {
    localStorage.setItem('inventory_subscriptions', JSON.stringify(subscriptions));
  };

  const ensureUserSubscription = (currentUser: User): Subscription => {
    const subscriptions = getStoredSubscriptions();
    const userSubscriptions = subscriptions
      .filter((sub) => sub.userId === currentUser.id)
      .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());

    let target = userSubscriptions[0];
    if (!target) {
      const trialStartDate = new Date(currentUser.createdAt);
      const trialEndDate = new Date(trialStartDate);
      trialEndDate.setDate(trialEndDate.getDate() + 14);
      const now = new Date();

      target = {
        id: `trial_${currentUser.id}`,
        userId: currentUser.id,
        plan: 'monthly',
        status: now > trialEndDate ? 'expired' : 'trial',
        startDate: trialStartDate.toISOString(),
        endDate: trialEndDate.toISOString(),
        amount: 0,
        autoRenew: false,
      };
      saveStoredSubscriptions([...subscriptions, target]);
      return target;
    }

    if ((target.status === 'active' || target.status === 'trial') && new Date() > new Date(target.endDate)) {
      const updatedTarget = { ...target, status: 'expired' as const };
      const updatedSubscriptions = subscriptions.map((sub) =>
        sub.id === target!.id ? updatedTarget : sub
      );
      saveStoredSubscriptions(updatedSubscriptions);
      return updatedTarget;
    }

    return target;
  };

  const refreshUser = async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const apiUser = await meApi();
      const normalizedUser: User = {
        id: apiUser.id,
        email: apiUser.email,
        name: apiUser.name,
        createdAt: apiUser.created_at,
      };
      setUser(normalizedUser);
      if (hasStripeSubscription(apiUser) && apiUser.subscription) {
        setSubscription(mapApiSubscriptionToLocal(apiUser.subscription, normalizedUser.id));
      } else {
        setSubscription(ensureUserSubscription(normalizedUser));
      }
    } catch {
      /* leave existing session; caller may toast */
    }
  };

  const checkSubscriptionStatus = (): boolean => {
    if (!subscription) return false;
    if (subscription.status !== 'active' && subscription.status !== 'trial') return false;
    return new Date() <= new Date(subscription.endDate);
  };

  const hasActiveSubscription = checkSubscriptionStatus();

  useEffect(() => {
    const bootstrap = async () => {
      const token = getAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const apiUser = await meApi();
        const normalizedUser: User = {
          id: apiUser.id,
          email: apiUser.email,
          name: apiUser.name,
          createdAt: apiUser.created_at,
        };
        setUser(normalizedUser);

        if (hasStripeSubscription(apiUser) && apiUser.subscription) {
          setSubscription(mapApiSubscriptionToLocal(apiUser.subscription, normalizedUser.id));
        } else {
          setSubscription(ensureUserSubscription(normalizedUser));
        }
      } catch (error) {
        setAccessToken(null);
        setUser(null);
        toast.error(humanizeApiError(error, 'Could not restore your session.'));
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, []);

  const signup = async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    // Validate inputs
    if (!email.includes('@')) {
      setIsLoading(false);
      const err = 'Please enter a valid email address.';
      toast.error(err);
      return { success: false, error: err };
    }

    if (password.length < 6) {
      setIsLoading(false);
      const err = 'Password must be at least 6 characters.';
      toast.error(err);
      return { success: false, error: err };
    }

    if (name.trim().length < 2) {
      setIsLoading(false);
      const err = 'Please enter your full name (at least 2 characters).';
      toast.error(err);
      return { success: false, error: err };
    }

    let newUser: User;
    let response: AuthSuccessData;
    try {
      response = await signupApi(email, password, name);
      setAccessToken(response.access_token);
      newUser = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        createdAt: response.user.created_at,
      };
    } catch (error) {
      setIsLoading(false);
      const msg = humanizeApiError(error, 'Could not create your account.');
      toast.error(msg);
      return { success: false, error: msg };
    }

    setUser(newUser);

    if (hasStripeSubscription(response.user) && response.user.subscription) {
      setSubscription(mapApiSubscriptionToLocal(response.user.subscription, newUser.id));
    } else {
      const trialStartDate = new Date();
      const trialEndDate = new Date(trialStartDate);
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      const trialSubscription: Subscription = {
        id: `trial_${Date.now()}`,
        userId: newUser.id,
        plan: 'monthly',
        status: 'trial',
        startDate: trialStartDate.toISOString(),
        endDate: trialEndDate.toISOString(),
        amount: 0,
        autoRenew: false,
      };

      const subscriptions = JSON.parse(localStorage.getItem('inventory_subscriptions') || '[]');
      subscriptions.push(trialSubscription);
      localStorage.setItem('inventory_subscriptions', JSON.stringify(subscriptions));
      setSubscription(trialSubscription);
    }

    setIsLoading(false);
    toast.success('Account created! You are signed in.');
    return { success: true };
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    if (!email || !password) {
      setIsLoading(false);
      const err = 'Please enter both email and password.';
      toast.error(err);
      return { success: false, error: err };
    }

    try {
      const response = await loginApi(email, password);
      setAccessToken(response.access_token);
      const loggedInUser: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        createdAt: response.user.created_at,
      };
      setUser(loggedInUser);
      if (hasStripeSubscription(response.user) && response.user.subscription) {
        setSubscription(mapApiSubscriptionToLocal(response.user.subscription, loggedInUser.id));
      } else {
        setSubscription(ensureUserSubscription(loggedInUser));
      }
      setIsLoading(false);
      toast.success('Signed in successfully.');
      return { success: true };
    } catch (error) {
      setIsLoading(false);
      const msg = humanizeApiError(error, 'Could not sign you in.');
      toast.error(msg);
      return { success: false, error: msg };
    }
  };

  const loginWithGoogle = async (idToken: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const response = await googleAuthApi(idToken);
      setAccessToken(response.access_token);
      const loggedInUser: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        createdAt: response.user.created_at,
      };
      setUser(loggedInUser);
      if (hasStripeSubscription(response.user) && response.user.subscription) {
        setSubscription(mapApiSubscriptionToLocal(response.user.subscription, loggedInUser.id));
      } else {
        setSubscription(ensureUserSubscription(loggedInUser));
      }
      setIsLoading(false);
      toast.success('Signed in with Google.');
      return { success: true };
    } catch (error) {
      setIsLoading(false);
      const msg = humanizeApiError(error, 'Google sign-in failed.');
      toast.error(msg);
      return { success: false, error: msg };
    }
  };

  const logout = () => {
    setAccessToken(null);
    setUser(null);
    setSubscription(null);
    toast.success('You have been signed out.');
  };

  const createSubscription = async (
    plan: SubscriptionPlan,
    customDuration?: number
  ): Promise<{ success: boolean; subscription?: Subscription }> => {
    if (!user) {
      toast.error('Please sign in to choose a plan.');
      return { success: false };
    }

    try {
      const body: { plan: string; custom_months?: number } = { plan };
      if (plan === 'custom') {
        body.custom_months = customDuration && customDuration > 0 ? customDuration : 6;
      }
      const { checkout_url } = await createStripeCheckoutSession(body);
      window.location.assign(checkout_url);
      return { success: true };
    } catch (error) {
      const msg = humanizeApiError(error, 'Could not start checkout. Is Stripe configured on the server?');
      toast.error(msg);
      return { success: false };
    }
  };

  const cancelSubscription = async () => {
    if (!subscription) return;

    if (!subscription.stripeBacked) {
      const subscriptions = JSON.parse(localStorage.getItem('inventory_subscriptions') || '[]');
      const updated = subscriptions.map((sub: Subscription) =>
        sub.id === subscription.id ? { ...sub, status: 'cancelled' as const, autoRenew: false } : sub
      );
      localStorage.setItem('inventory_subscriptions', JSON.stringify(updated));
      setSubscription({ ...subscription, status: 'cancelled', autoRenew: false });
      toast.message('Subscription cancelled', {
        description: 'You can subscribe again anytime from Pricing.',
      });
      return;
    }

    try {
      const { portal_url } = await createStripeBillingPortalSession();
      toast.message('Opening Stripe billing portal…');
      window.location.assign(portal_url);
    } catch (error) {
      toast.error(humanizeApiError(error, 'Could not open billing portal.'));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        subscription,
        isLoading,
        hasActiveSubscription,
        login,
        loginWithGoogle,
        signup,
        logout,
        createSubscription,
        cancelSubscription,
        checkSubscriptionStatus,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
