/**
 * Auth API calls: magic link, OAuth URLs, token refresh, logout.
 */

import { apiFetch } from "./client";
import type { TokenPair } from "./types";

/**
 * Request a magic link email. The API always returns a success message
 * regardless of whether the email exists (to prevent enumeration).
 */
export async function requestMagicLink(
  email: string,
): Promise<{ message: string }> {
  return apiFetch("/auth/login/email", {
    method: "POST",
    body: JSON.stringify({ email }),
    noAuth: true,
  });
}

/**
 * Verify a magic link token and receive a JWT pair.
 */
export async function verifyMagicLink(token: string): Promise<TokenPair> {
  return apiFetch<TokenPair>("/auth/verify-magic-link", {
    method: "POST",
    body: JSON.stringify({ token }),
    noAuth: true,
  });
}

/**
 * Exchange a refresh token for a new token pair (rotation).
 */
export async function refreshTokens(
  refreshToken: string,
): Promise<TokenPair> {
  return apiFetch<TokenPair>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
    noAuth: true,
  });
}

/**
 * Revoke a single refresh token (logout current session).
 */
export async function logout(refreshToken: string): Promise<void> {
  return apiFetch("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
    noAuth: true,
  });
}

/**
 * Revoke all sessions for the authenticated user.
 */
export async function logoutAll(): Promise<void> {
  return apiFetch("/auth/logout/all", {
    method: "POST",
  });
}

/**
 * Get the Google OAuth redirect URL. The backend will redirect the user
 * to the Google consent screen.
 */
export function getGoogleOAuthUrl(): string {
  // For Expo/mobile we open this in a browser; the backend handles the redirect.
  return `${process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/auth/oauth/google`;
}

/**
 * Get the GitHub OAuth redirect URL.
 */
export function getGitHubOAuthUrl(): string {
  return `${process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/auth/oauth/github`;
}
