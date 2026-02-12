/**
 * TanStack Query hook for fetching a single agent by ID.
 */

import { useQuery } from "@tanstack/react-query";

import { getAgent } from "@/lib/api/agents";

/**
 * Fetch a single agent's details.
 *
 * @param id - Agent UUID. Query is disabled when undefined/empty.
 */
export function useAgent(id: string | undefined) {
  return useQuery({
    queryKey: ["agent", id],
    queryFn: () => getAgent(id!),
    enabled: !!id,
  });
}
