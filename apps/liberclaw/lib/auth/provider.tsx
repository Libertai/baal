/**
 * AuthContext — provides authenticated user state throughout the app.
 *
 * On mount, loads tokens from secure storage and validates them by
 * fetching /users/me. If the access token is expired, tries a refresh.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { apiFetch, ApiError } from "@/lib/api/client";
import { refreshTokens as refreshTokensApi } from "@/lib/api/auth";
import type { TokenPair, User } from "@/lib/api/types";
import { getTokens, setTokens, clearTokens } from "./storage";

// ── Context shape ─────────────────────────────────────────────────────

interface AuthContextValue {
  /** The authenticated user, or null if not logged in. */
  user: User | null;
  /** True while the initial token validation is in progress. */
  isLoading: boolean;
  /** Store tokens and fetch the user profile. */
  login: (tokens: TokenPair) => Promise<void>;
  /** Clear tokens and reset user state. */
  logout: () => Promise<void>;
  /** Re-fetch /users/me (e.g. after profile update). */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /** Fetch the user profile using the current access token. */
  const fetchUser = useCallback(async (): Promise<User | null> => {
    try {
      return await apiFetch<User>("/users/me");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Access token expired — try to refresh
        const tokens = await getTokens();
        if (tokens?.refresh_token) {
          try {
            const newTokens = await refreshTokensApi(tokens.refresh_token);
            await setTokens(newTokens);
            return await apiFetch<User>("/users/me");
          } catch {
            // Refresh also failed — clear everything
            await clearTokens();
          }
        } else {
          await clearTokens();
        }
      }
      return null;
    }
  }, []);

  // Validate stored tokens on mount
  useEffect(() => {
    let mounted = true;

    (async () => {
      const tokens = await getTokens();
      if (!tokens) {
        if (mounted) setIsLoading(false);
        return;
      }

      const profile = await fetchUser();
      if (mounted) {
        setUser(profile);
        setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [fetchUser]);

  const login = useCallback(
    async (tokens: TokenPair) => {
      await setTokens(tokens);
      const profile = await fetchUser();
      setUser(profile);
    },
    [fetchUser],
  );

  const logout = useCallback(async () => {
    // Best-effort: revoke the refresh token on the server
    try {
      const tokens = await getTokens();
      if (tokens?.refresh_token) {
        const { logout: logoutApi } = await import("@/lib/api/auth");
        await logoutApi(tokens.refresh_token);
      }
    } catch {
      // ignore — we clear locally regardless
    }
    await clearTokens();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const profile = await fetchUser();
    setUser(profile);
  }, [fetchUser]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, logout, refreshUser }),
    [user, isLoading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
