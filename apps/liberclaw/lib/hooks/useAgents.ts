/**
 * TanStack Query hooks for the agents list and agent creation/deletion.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  listAgents,
  createAgent,
  deleteAgent,
  updateAgent,
} from "@/lib/api/agents";
import type { AgentCreate, AgentUpdate } from "@/lib/api/types";

/** Query key used for the agents list. */
export const AGENTS_QUERY_KEY = ["agents"] as const;

/**
 * Fetch the list of agents for the authenticated user.
 * Refetches every 30 seconds.
 */
export function useAgents() {
  return useQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: listAgents,
    refetchInterval: 30_000,
  });
}

/**
 * Mutation: create a new agent.
 * On success, invalidates the agents list.
 */
export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AgentCreate) => createAgent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
    },
  });
}

/**
 * Mutation: delete an agent.
 * On success, invalidates the agents list.
 */
export function useDeleteAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
    },
  });
}

/**
 * Mutation: update an agent's configuration.
 * On success, invalidates both the agents list and the individual agent query.
 */
export function useUpdateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AgentUpdate }) =>
      updateAgent(id, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["agent", variables.id] });
    },
  });
}
