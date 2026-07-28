import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';
import { Subscription, SubscriptionPlan } from '../types';
import {
  googleAuthApi,
  loginApi,
  logoutApi,
  meApi,
  signupApi,
  type ApiSubscription,
  type ApiUser,
  type AuthSuccessData,
} from '../services/authService';
import { createStripeBillingPortalSession, createStripeCheckoutSession } from '../services/paymentService';
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  refreshAuthTokens,
  setAuthTokens,
} from '../lib/api';
import { humanizeApiError } from '../utils/apiErrors';

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export type AuthActionResult = {
  success: boolean;
  error?: string;
  /** True when the user has an active paid plan or a valid free trial. */
  hasActiveAccess?: boolean;
};

interface AuthContextType {
  user: User | null;
  subscription: Subscription | null;
  isLoading: boolean;
  hasActiveSubscription: boolean;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  loginWithGoogle: (idToken: string) => Promise<AuthActionResult>;
  signup: (email: string, password: string, name: string) => Promise<AuthActionResult>;
  logout: () => void;
  createSubscription: (plan: SubscriptionPlan, customDuration?: number) => Promise<{ success: boolean; subscription?: Subscription }>;
  cancelSubscription: () => Promise<void>;
  checkSubscriptionStatus: () => boolean;
  /** Reloads /auth/me and updates subscription. Returns true on success. */
  refreshUser: () => Promise<boolean>;
  /** Applies a user payload from auth/payments APIs (e.g. after Stripe verify). */
  applyApiUser: (apiUser: ApiUser) => boolean;
  /** Dashboard for subscribers/trial; pricing otherwise. */
  getPostAuthPath: (hasAccess?: boolean) => string;
  /** Navigate helper path: dashboard if entitled, else pricing. */
  getDashboardPath: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Brief grant so checkout → dashboard is not blocked before React state settles. */
const SUB_ACCESS_GRANT_KEY = 'inventory_sub_access_grant';

export function grantTemporaryDashboardAccess(ms = 60_000): void {
  sessionStorage.setItem(SUB_ACCESS_GRANT_KEY, String(Date.now() + ms));
}

function hasTemporaryDashboardAccess(): boolean {
  const raw = sessionStorage.getItem(SUB_ACCESS_GRANT_KEY);
  if (!raw) return false;
  const until = Number(raw);
  if (Number.isNaN(until) || Date.now() > until) {
    sessionStorage.removeItem(SUB_ACCESS_GRANT_KEY);
    return false;
  }
  return true;
}

function isSubscriptionRecordActive(sub: Subscription | null | undefined): boolean {
  if (!sub) return false;
  if (sub.status !== 'active' && sub.status !== 'trial') return false;
  // Active Stripe rows sometimes omit period end briefly after checkout
  if (!sub.endDate) return true;
  const end = new Date(sub.endDate).getTime();
  if (Number.isNaN(end)) return true;
  return Date.now() <= end;
}

function isSubscriptionActive(sub: Subscription | null | undefined): boolean {
  return hasTemporaryDashboardAccess() || isSubscriptionRecordActive(sub);
}

function hasStripeSubscription(apiUser: { subscription?: ApiSubscription | null }): boolean {
  return Boolean(apiUser.subscription?.stripe_subscription_id);
}

function mapApiSubscriptionToLocal(sub: ApiSubscription, userId: string): Subscription {
  const isLive = sub.status === 'active' || sub.status === 'trial';
  // Avoid treating "now" as expiry when Stripe has not yet sent period end
  const fallbackEnd = isLive
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : new Date(0).toISOString();

  return {
    id: sub.stripe_subscription_id,
    userId,
    plan: sub.plan as SubscriptionPlan,
    status: sub.status as Subscription['status'],
    startDate: sub.start_date || new Date().toISOString(),
    endDate: sub.end_date || fallbackEnd,
    amount: sub.amount_inr ?? 0,
    customDuration: sub.custom_duration_months ?? undefined,
    autoRenew: sub.status === 'active' && !sub.cancel_at_period_end,
    stripeBacked: true,
  };
}

/** Subscribers and users on a free 14-day trial go to the dashboard; others to pricing. */
export function resolvePostAuthPath(hasActiveAccess: boolean): string {
  return hasActiveAccess ? '/' : '/pricing';
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

  const applyApiUser = (apiUser: ApiUser): boolean => {
    const normalizedUser: User = {
      id: apiUser.id,
      email: apiUser.email,
      name: apiUser.name,
      createdAt: apiUser.created_at,
    };
    setUser(normalizedUser);

    let nextSub: Subscription;
    if (hasStripeSubscription(apiUser) && apiUser.subscription) {
      nextSub = mapApiSubscriptionToLocal(apiUser.subscription, normalizedUser.id);
    } else {
      nextSub = ensureUserSubscription(normalizedUser);
    }
    setSubscription(nextSub);
    const active = isSubscriptionRecordActive(nextSub);
    if (active) {
      grantTemporaryDashboardAccess();
    }
    return active;
  };

  const applyAuthSuccess = (response: AuthSuccessData): { hasActiveAccess: boolean } => {
    setAuthTokens(response.access_token, response.refresh_token);
    const hasActiveAccess = applyApiUser(response.user);
    return { hasActiveAccess };
  };

  const refreshUser = async (): Promise<boolean> => {
    const token = getAccessToken();
    if (!token && !getRefreshToken()) return false;
    try {
      const apiUser = await meApi();
      return applyApiUser(apiUser);
    } catch {
      return false;
    }
  };

  const checkSubscriptionStatus = (): boolean => isSubscriptionActive(subscription);

  const hasActiveSubscription = checkSubscriptionStatus();

  const getPostAuthPath = (hasAccess?: boolean): string =>
    resolvePostAuthPath(hasAccess ?? hasActiveSubscription);

  const getDashboardPath = (): string => resolvePostAuthPath(hasActiveSubscription);

  useEffect(() => {
    const bootstrap = async () => {
      const accessToken = getAccessToken();
      const refreshToken = getRefreshToken();
      if (!accessToken && !refreshToken) {
        setIsLoading(false);
        return;
      }

      try {
        if (!accessToken && refreshToken) {
          const ok = await refreshAuthTokens();
          if (!ok) {
            clearAuthTokens();
            setIsLoading(false);
            return;
          }
        }

        const apiUser = await meApi();
        applyApiUser(apiUser);
      } catch (error) {
        clearAuthTokens();
        setUser(null);
        setSubscription(null);
        toast.error(humanizeApiError(error, 'Could not restore your session.'));
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, []);

  const signup = async (email: string, password: string, name: string): Promise<AuthActionResult> => {
    setIsLoading(true);

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

    try {
      const response = await signupApi(email, password, name);
      setAuthTokens(response.access_token, response.refresh_token);
      const newUser: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        createdAt: response.user.created_at,
      };
      setUser(newUser);

      let nextSub: Subscription;
      if (hasStripeSubscription(response.user) && response.user.subscription) {
        nextSub = mapApiSubscriptionToLocal(response.user.subscription, newUser.id);
      } else {
        const trialStartDate = new Date();
        const trialEndDate = new Date(trialStartDate);
        trialEndDate.setDate(trialEndDate.getDate() + 14);

        nextSub = {
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
        subscriptions.push(nextSub);
        localStorage.setItem('inventory_subscriptions', JSON.stringify(subscriptions));
      }
      setSubscription(nextSub);

      setIsLoading(false);
      toast.success('Account created! You are signed in.');
      return { success: true, hasActiveAccess: isSubscriptionActive(nextSub) };
    } catch (error) {
      setIsLoading(false);
      const msg = humanizeApiError(error, 'Could not create your account.');
      toast.error(msg);
      return { success: false, error: msg };
    }
  };

  const login = async (email: string, password: string): Promise<AuthActionResult> => {
    setIsLoading(true);

    if (!email || !password) {
      setIsLoading(false);
      const err = 'Please enter both email and password.';
      toast.error(err);
      return { success: false, error: err };
    }

    try {
      const response = await loginApi(email, password);
      const { hasActiveAccess } = applyAuthSuccess(response);
      setIsLoading(false);
      toast.success('Signed in successfully.');
      return { success: true, hasActiveAccess };
    } catch (error) {
      setIsLoading(false);
      const msg = humanizeApiError(error, 'Could not sign you in.');
      toast.error(msg);
      return { success: false, error: msg };
    }
  };

  const loginWithGoogle = async (idToken: string): Promise<AuthActionResult> => {
    setIsLoading(true);
    try {
      const response = await googleAuthApi(idToken);
      const { hasActiveAccess } = applyAuthSuccess(response);
      setIsLoading(false);
      toast.success('Signed in with Google.');
      return { success: true, hasActiveAccess };
    } catch (error) {
      setIsLoading(false);
      const msg = humanizeApiError(error, 'Google sign-in failed.');
      toast.error(msg);
      return { success: false, error: msg };
    }
  };

  const logout = () => {
    void logoutApi();
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
        applyApiUser,
        getPostAuthPath,
        getDashboardPath,
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
