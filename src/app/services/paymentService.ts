import { apiFetch } from "../lib/api";

export async function createStripeCheckoutSession(body: {
  plan: string;
  custom_months?: number;
}) {
  return apiFetch<{ checkout_url: string }>("/payments/stripe/create-checkout-session", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createStripeBillingPortalSession() {
  return apiFetch<{ portal_url: string }>("/payments/stripe/billing-portal", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function verifyStripeCheckoutSession(session_id: string) {
  return apiFetch<{ ok: boolean }>("/payments/stripe/verify-checkout-session", {
    method: "POST",
    body: JSON.stringify({ session_id }),
  });
}
