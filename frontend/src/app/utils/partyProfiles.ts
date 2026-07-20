export type PartyType = 'customer' | 'supplier';

export interface PartyProfile {
  /** Address, GST, secondary email, notes — optional */
  email?: string;
  address?: string;
  gstNumber?: string;
  notes?: string;
}

const PREFIX = 'inventory_party_profile:';

export function profileStorageKey(kind: PartyType, partyKey: string): string {
  return `${PREFIX}${kind}:${partyKey}`;
}

export function getPartyProfile(kind: PartyType, partyKey: string): PartyProfile {
  try {
    const raw = localStorage.getItem(profileStorageKey(kind, partyKey));
    if (!raw) return {};
    return JSON.parse(raw) as PartyProfile;
  } catch {
    return {};
  }
}

export function setPartyProfile(kind: PartyType, partyKey: string, patch: Partial<PartyProfile>): void {
  const current = getPartyProfile(kind, partyKey);
  const next = { ...current, ...patch };
  Object.keys(next).forEach((k) => {
    const v = next[k as keyof PartyProfile];
    if (v === undefined || v === '') delete next[k as keyof PartyProfile];
  });
  localStorage.setItem(profileStorageKey(kind, partyKey), JSON.stringify(next));
}
