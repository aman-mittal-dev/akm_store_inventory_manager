/** Stable key per customer/supplier (name + contact). Contact normalised for duplicate detection. */
export function normalizePartyKey(name: string, contact?: string | null): string {
  const n = name.trim().toLowerCase().replace(/\s+/g, ' ');
  const phoneDigits = (contact || '').replace(/\D/g, '');
  return `${n}|${phoneDigits}`;
}

export function encodePartyRouteSegment(rawKey: string): string {
  const utf8Key = encodeURIComponent(rawKey);
  return btoa(utf8Key).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}


export function decodePartyRouteSegment(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  return decodeURIComponent(atob(base64 + pad));
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
