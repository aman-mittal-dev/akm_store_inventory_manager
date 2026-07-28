import { apiFetch, clearAuthTokens, getRefreshToken } from "../lib/api";

export interface ApiSubscription {
  status: string;
  plan: string;
  start_date: string | null;
  end_date: string | null;
  amount_inr: number | null;
  custom_duration_months: number | null;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string;
}

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
  subscription?: ApiSubscription | null;
}

export interface AuthSuccessData {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  user: ApiUser;
}

export function signupApi(email: string, password: string, name: string) {
  return apiFetch<AuthSuccessData>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
}

export function loginApi(email: string, password: string) {
  return apiFetch<AuthSuccessData>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function googleAuthApi(idToken: string) {
  return apiFetch<AuthSuccessData>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
}

export function refreshTokensApi(refreshToken: string) {
  return apiFetch<AuthSuccessData>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export async function logoutApi(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearAuthTokens();
    return;
  }
  try {
    await apiFetch<null>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    /* best-effort revoke */
  } finally {
    clearAuthTokens();
  }
}

export async function meApi(): Promise<ApiUser> {
  const data = await apiFetch<{ user: ApiUser }>("/auth/me");
  return data.user;
}
