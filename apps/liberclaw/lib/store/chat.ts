/**
 * Zustand store for chat messages, keyed by agentId.
 */

import { create } from "zustand";
import type { ChatMessage } from "@/lib/api/types";

interface ChatState {
  /** Messages per agent. */
  messages: Map<string, ChatMessage[]>;
  /** The agent currently streaming a response, or null. */
  streamingAgentId: string | null;

  /** Append a single message to an agent's conversation. */
  addMessage: (agentId: string, msg: ChatMessage) => void;
  /** Set messages for an agent (used for loading history). Only sets if no messages exist yet. */
  setMessages: (agentId: string, msgs: ChatMessage[]) => void;
  /** Mark which agent is currently streaming (or null to clear). */
  setStreaming: (agentId: string | null) => void;
  /** Clear all messages for a given agent. */
  clearMessages: (agentId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: new Map(),
  streamingAgentId: null,

  addMessage: (agentId, msg) =>
    set((state) => {
      const next = new Map(state.messages);
      const existing = next.get(agentId) ?? [];
      next.set(agentId, [...existing, msg]);
      return { messages: next };
    }),

  setMessages: (agentId, msgs) =>
    set((state) => {
      // Only set if no messages exist yet (don't overwrite active conversation)
      if (state.messages.has(agentId)) return state;
      const next = new Map(state.messages);
      next.set(agentId, msgs);
      return { messages: next };
    }),

  setStreaming: (agentId) => set({ streamingAgentId: agentId }),

  clearMessages: (agentId) =>
    set((state) => {
      const next = new Map(state.messages);
      next.delete(agentId);
      return { messages: next };
    }),
}));
