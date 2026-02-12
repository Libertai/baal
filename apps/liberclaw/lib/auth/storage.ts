/**
 * Secure token storage.
 *
 * Uses expo-secure-store on native platforms and localStorage on web.
 */

import { Platform } from "react-native";
import type { TokenPair } from "@/lib/api/types";

const ACCESS_TOKEN_KEY = "liberclaw_access_token";
const REFRESH_TOKEN_KEY = "liberclaw_refresh_token";

// ── Platform-specific helpers ─────────────────────────────────────────

async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(key);
}

async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(key, value);
    } catch {
      // localStorage may be unavailable (e.g. private browsing quota exceeded)
    }
    return;
  }

  const SecureStore = await import("expo-secure-store");
  return SecureStore.setItemAsync(key, value);
}

async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
    return;
  }

  const SecureStore = await import("expo-secure-store");
  return SecureStore.deleteItemAsync(key);
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Retrieve stored tokens, or null if none are present.
 */
export async function getTokens(): Promise<TokenPair | null> {
  const accessToken = await getSecureItem(ACCESS_TOKEN_KEY);
  const refreshToken = await getSecureItem(REFRESH_TOKEN_KEY);

  if (!accessToken || !refreshToken) return null;

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "bearer",
    expires_in: 0, // unknown from storage; rely on server response
  };
}

/**
 * Persist a token pair to secure storage.
 */
export async function setTokens(tokens: TokenPair): Promise<void> {
  await setSecureItem(ACCESS_TOKEN_KEY, tokens.access_token);
  await setSecureItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

/**
 * Remove all stored tokens (logout).
 */
export async function clearTokens(): Promise<void> {
  await deleteSecureItem(ACCESS_TOKEN_KEY);
  await deleteSecureItem(REFRESH_TOKEN_KEY);
}
