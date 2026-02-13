/**
 * TanStack Query hook for user's activity feed.
 */

import { useQuery } from "@tanstack/react-query";
import { getMyActivity } from "@/lib/api/activity";

export const ACTIVITY_QUERY_KEY = ["activity"] as const;

export function useActivity(limit = 50) {
  return useQuery({
    queryKey: [...ACTIVITY_QUERY_KEY, limit],
    queryFn: () => getMyActivity(limit),
  });
}
