const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

export const AUTH_TOKEN_KEY = "inventory_access_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    return;
  }
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

function isApiEnvelope(value: unknown): value is { data: unknown; message: string; status: number } {
  return (
    value !== null &&
    typeof value === "object" &&
    "data" in value &&
    "message" in value &&
    "status" in value &&
    typeof (value as { message: unknown }).message === "string" &&
    typeof (value as { status: unknown }).status === "number"
  );
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("Content-Type") || "";
  const isJson = contentType.includes("application/json");

  let parsed: unknown;
  if (isJson && response.status !== 204) {
    const text = await response.text();
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = undefined;
      }
    }
  }

  if (!response.ok) {
    let message = "Request failed";
    if (parsed && typeof parsed === "object") {
      const o = parsed as Record<string, unknown>;
      message = String(o.detail ?? o.message ?? message);
    }
    throw new Error(message);
  }

  if (response.status === 204 && !isJson) {
    return undefined as T;
  }

  if (!isJson || parsed === undefined) {
    return undefined as T;
  }

  if (isApiEnvelope(parsed)) {
    return parsed.data as T;
  }

  return parsed as T;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(init?.headers || {});

  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  return parseResponse<T>(response);
}

/** Multipart upload (do not set Content-Type — browser sets boundary). */
export async function apiUploadFile<T>(path: string, formData: FormData): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body: formData,
    headers,
  });

  return parseResponse<T>(response);
}
