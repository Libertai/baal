/**
 * TanStack Query hook for usage summary (slots, messages, tier).
 */

import { useQuery } from "@tanstack/react-query";
import { getUsageSummary } from "@/lib/api/usage";

export const USAGE_QUERY_KEY = ["usage"] as const;

/**
 * Fetch the current user's usage summary.
 * Refetches every 60 seconds.
 */
export function useUsage() {
  return useQuery({
    queryKey: USAGE_QUERY_KEY,
    queryFn: getUsageSummary,
    refetchInterval: 60_000,
  });
}
