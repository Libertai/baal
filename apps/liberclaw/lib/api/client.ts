/**
 * HTTP client with JWT auth, auto-refresh on 401, and error handling.
 */

import { getTokens, setTokens, clearTokens } from "@/lib/auth/storage";
import type { TokenPair } from "./types";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

// ── ApiError ──────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// ── Internal helpers ──────────────────────────────────────────────────

let refreshPromise: Promise<TokenPair | null> | null = null;

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Deduplicates concurrent refresh attempts.
 */
async function tryRefresh(): Promise<TokenPair | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const tokens = await getTokens();
      if (!tokens?.refresh_token) return null;

      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: tokens.refresh_token }),
      });

      if (!res.ok) {
        await clearTokens();
        return null;
      }

      const newTokens: TokenPair = await res.json();
      await setTokens(newTokens);
      return newTokens;
    } catch {
      await clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ── apiFetch ──────────────────────────────────────────────────────────

export interface ApiFetchOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
  /** Skip attaching the Authorization header (e.g. for login endpoints). */
  noAuth?: boolean;
}

/**
 * Wrapper around `fetch` that handles:
 * - Base URL prefixing
 * - JWT Bearer token injection
 * - Auto-refresh on 401 (single retry)
 * - JSON Content-Type for mutating methods
 * - Structured error handling via ApiError
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { noAuth, headers: extraHeaders, ...fetchOpts } = options;

  const buildHeaders = async (
    accessToken?: string | null,
  ): Promise<Record<string, string>> => {
    const h: Record<string, string> = { ...extraHeaders };

    // Set JSON content-type for mutating methods with a body
    const method = (fetchOpts.method ?? "GET").toUpperCase();
    if (["POST", "PATCH", "PUT"].includes(method) && fetchOpts.body) {
      h["Content-Type"] = h["Content-Type"] ?? "application/json";
    }

    // Attach bearer token
    if (!noAuth) {
      const token =
        accessToken ?? (await getTokens())?.access_token ?? null;
      if (token) {
        h["Authorization"] = `Bearer ${token}`;
      }
    }

    return h;
  };

  const url = `${API_BASE_URL}${path}`;

  // First attempt
  const res = await fetch(url, {
    ...fetchOpts,
    headers: await buildHeaders(),
  });

  // Auto-refresh on 401
  if (res.status === 401 && !noAuth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const retryRes = await fetch(url, {
        ...fetchOpts,
        headers: await buildHeaders(refreshed.access_token),
      });
      return handleResponse<T>(retryRes);
    }
  }

  return handleResponse<T>(res);
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T;
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.detail) {
        message = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      // body is not JSON; keep the default message
    }
    throw new ApiError(res.status, message);
  }

  // Some successful responses may not have a body
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
