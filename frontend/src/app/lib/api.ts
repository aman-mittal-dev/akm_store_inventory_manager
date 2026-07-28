const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

export const AUTH_TOKEN_KEY = "inventory_access_token";
export const REFRESH_TOKEN_KEY = "inventory_refresh_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    return;
  }
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function setRefreshToken(token: string | null): void {
  if (token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
    return;
  }
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function setAuthTokens(accessToken: string | null, refreshToken: string | null): void {
  setAccessToken(accessToken);
  setRefreshToken(refreshToken);
}

export function clearAuthTokens(): void {
  setAccessToken(null);
  setRefreshToken(null);
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
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  if (response.status === 204 && !isJson) {
    return undefined as T;
  }

  if (!isJson || parsed === undefined) {
    return undefined as T;
  }

  if (isApiEnvelope(parsed)) {
    // Some auth error responses use HTTP 200 with a non-2xx envelope status
    if (parsed.status >= 400) {
      const error = new Error(parsed.message || "Request failed") as Error & { status?: number };
      error.status = parsed.status;
      throw error;
    }
    return parsed.data as T;
  }

  return parsed as T;
}

type TokenRefreshResult = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
};

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const data = await parseResponse<TokenRefreshResult>(response);
      if (!data?.access_token || !data?.refresh_token) {
        clearAuthTokens();
        return false;
      }
      setAuthTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      clearAuthTokens();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function fetchWithAuth(
  path: string,
  init?: RequestInit,
  options?: { skipAuthRefresh?: boolean; isUpload?: boolean }
): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  const token = getAccessToken();

  if (!options?.isUpload && !headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (
    response.status === 401 &&
    !options?.skipAuthRefresh &&
    !path.startsWith("/auth/login") &&
    !path.startsWith("/auth/signup") &&
    !path.startsWith("/auth/google") &&
    !path.startsWith("/auth/refresh") &&
    !path.startsWith("/auth/logout")
  ) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      const retryHeaders = new Headers(init?.headers || {});
      if (!options?.isUpload && !retryHeaders.has("Content-Type") && init?.body) {
        retryHeaders.set("Content-Type", "application/json");
      }
      const newToken = getAccessToken();
      if (newToken) {
        retryHeaders.set("Authorization", `Bearer ${newToken}`);
      }
      return fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: retryHeaders,
      });
    }
  }

  return response;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithAuth(path, init);
  return parseResponse<T>(response);
}

/** Multipart upload (do not set Content-Type — browser sets boundary). */
export async function apiUploadFile<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetchWithAuth(
    path,
    { method: "POST", body: formData },
    { isUpload: true }
  );
  return parseResponse<T>(response);
}

/** Refresh without going through apiFetch (avoids recursion). */
export async function refreshAuthTokens(): Promise<boolean> {
  return tryRefreshAccessToken();
}
