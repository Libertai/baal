/**
 * Usage tracking API calls.
 */

import { apiFetch } from "./client";
import type { UsageSummary } from "./types";

/**
 * Get the current user's usage summary (messages, agent slots, tier).
 */
export async function getUsageSummary(): Promise<UsageSummary> {
  return apiFetch<UsageSummary>("/usage/");
}
