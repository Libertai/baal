/**
 * Agent CRUD and deployment API calls.
 */

import { apiFetch } from "./client";
import type {
  Agent,
  AgentCreate,
  AgentHealthResponse,
  AgentListResponse,
  AgentUpdate,
  DeploymentStatus,
} from "./types";

/**
 * List all agents belonging to the current user.
 */
export async function listAgents(): Promise<AgentListResponse> {
  return apiFetch<AgentListResponse>("/agents/");
}

/**
 * Create a new agent and trigger background deployment.
 */
export async function createAgent(data: AgentCreate): Promise<Agent> {
  return apiFetch<Agent>("/agents/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Get a single agent by ID.
 */
export async function getAgent(id: string): Promise<Agent> {
  return apiFetch<Agent>(`/agents/${id}`);
}

/**
 * Update agent configuration (name, system prompt, model).
 */
export async function updateAgent(
  id: string,
  data: AgentUpdate,
): Promise<Agent> {
  return apiFetch<Agent>(`/agents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * Delete an agent and destroy its VM.
 */
export async function deleteAgent(id: string): Promise<void> {
  return apiFetch(`/agents/${id}`, {
    method: "DELETE",
  });
}

/**
 * Check if an agent's VM is reachable.
 */
export async function getAgentHealth(
  id: string,
): Promise<AgentHealthResponse> {
  return apiFetch<AgentHealthResponse>(`/agents/${id}/health`);
}

/**
 * Get deployment progress for an agent (poll during creation).
 */
export async function getDeploymentStatus(
  id: string,
): Promise<DeploymentStatus> {
  return apiFetch<DeploymentStatus>(`/agents/${id}/status`);
}

/**
 * Retry a failed deployment.
 */
export async function repairAgent(id: string): Promise<Agent> {
  return apiFetch<Agent>(`/agents/${id}/repair`, {
    method: "POST",
  });
}

/**
 * Push latest code to a running agent's VM.
 */
export async function redeployAgent(id: string): Promise<Agent> {
  return apiFetch<Agent>(`/agents/${id}/redeploy`, {
    method: "POST",
  });
}
