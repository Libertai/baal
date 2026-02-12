/**
 * SSE streaming client for agent chat and related helpers.
 */

import { API_BASE_URL } from "./client";
import { getTokens } from "@/lib/auth/storage";
import type { ChatMessage, PendingMessagesResponse } from "./types";
import { apiFetch } from "./client";

const INACTIVITY_TIMEOUT_MS = 60_000;

/**
 * Stream chat messages from an agent via SSE.
 *
 * POSTs to /chat/{agentId} and reads the response as an SSE stream.
 * Calls `onEvent` for each parsed ChatMessage (except keepalive).
 * Calls `onError` on failures.
 *
 * @param agentId - The agent UUID
 * @param message - User message text
 * @param onEvent - Callback for each ChatMessage event
 * @param onError - Error callback
 * @param signal  - Optional AbortSignal for cancellation
 */
export async function streamChat(
  agentId: string,
  message: string,
  onEvent: (event: ChatMessage) => void,
  onError: (error: Error) => void,
  signal?: AbortSignal,
): Promise<void> {
  const tokens = await getTokens();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (tokens?.access_token) {
    headers["Authorization"] = `Bearer ${tokens.access_token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/chat/${agentId}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message }),
      signal,
    });
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
    return;
  }

  if (!res.ok) {
    let detail = `Chat request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.detail) detail = body.detail;
    } catch {
      // ignore
    }
    onError(new Error(detail));
    return;
  }

  if (!res.body) {
    onError(new Error("No response body"));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

  const resetInactivityTimer = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      onError(new Error("Stream timed out (60s inactivity)"));
      reader.cancel();
    }, INACTIVITY_TIMEOUT_MS);
  };

  resetInactivityTimer();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      resetInactivityTimer();
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE lines: "data: {...}\n\n"
      const parts = buffer.split("\n\n");
      // Keep the last incomplete chunk in the buffer
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const lines = part.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6); // Remove "data: " prefix
          if (!jsonStr.trim()) continue;

          try {
            const event = JSON.parse(jsonStr) as ChatMessage;

            // Filter keepalive events
            if (event.type === "keepalive") continue;

            onEvent(event);
          } catch {
            // Malformed JSON line; skip
          }
        }
      }
    }
  } catch (err) {
    // AbortError is expected when the caller cancels
    if (err instanceof Error && err.name === "AbortError") return;
    onError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    if (inactivityTimer) clearTimeout(inactivityTimer);
  }
}

/**
 * Clear conversation history for an agent.
 */
export async function clearChat(agentId: string): Promise<void> {
  return apiFetch(`/chat/${agentId}`, {
    method: "DELETE",
  });
}

/**
 * Get pending proactive messages from an agent (heartbeat / subagent results).
 */
export async function getPendingMessages(
  agentId: string,
): Promise<PendingMessagesResponse> {
  return apiFetch<PendingMessagesResponse>(`/chat/${agentId}/pending`);
}
