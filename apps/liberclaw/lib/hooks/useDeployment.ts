/**
 * TanStack Query hook for polling deployment status.
 *
 * Polls every 3 seconds while `enabled` is true — typically while
 * deployment_status is "pending" or "deploying".
 */

import { useQuery } from "@tanstack/react-query";

import { getDeploymentStatus } from "@/lib/api/agents";

/**
 * Poll the deployment status of an agent.
 *
 * @param agentId - Agent UUID
 * @param enabled - Whether polling is active (pass false once deployed/failed)
 */
export function useDeploymentStatus(
  agentId: string | undefined,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ["deployment-status", agentId],
    queryFn: () => getDeploymentStatus(agentId!),
    enabled: !!agentId && enabled,
    refetchInterval: enabled ? 3_000 : false,
  });
}
