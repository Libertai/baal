/**
 * Chat hook combining SSE streaming with the Zustand chat store.
 *
 * Provides a unified interface for sending messages, reading history,
 * and managing streaming state per agent.
 */

import { useCallback, useEffect, useRef } from "react";

import { streamChat, clearChat, getChatHistory } from "@/lib/api/chat";
import type { ChatMessage } from "@/lib/api/types";
import { useChatStore } from "@/lib/store/chat";

interface UseChatReturn {
  /** All messages for this agent. */
  messages: ChatMessage[];
  /** Send a user message and stream the agent response. */
  sendMessage: (text: string) => void;
  /** Whether the agent is currently streaming. */
  isStreaming: boolean;
  /** Clear local + remote chat history. */
  clearHistory: () => Promise<void>;
}

export function useChat(agentId: string): UseChatReturn {
  const {
    messages: allMessages,
    streamingAgentId,
    addMessage,
    setMessages,
    setStreaming,
    clearMessages,
  } = useChatStore();

  const messages = allMessages.get(agentId) ?? [];
  const isStreaming = streamingAgentId === agentId;
  const abortRef = useRef<AbortController | null>(null);

  // Load history from server on first mount (if no messages in store yet)
  useEffect(() => {
    if (allMessages.has(agentId)) return;
    getChatHistory(agentId)
      .then((history) => {
        if (history.length > 0) {
          setMessages(agentId, history);
        }
      })
      .catch(() => {
        // Silently ignore — agent may be offline
      });
  }, [agentId]);

  // Cancel stream on unmount or agent change
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, [agentId]);

  const sendMessage = useCallback(
    (text: string) => {
      // Abort any in-flight stream
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Add user message to store
      addMessage(agentId, { type: "text", content: text, name: "user" });
      setStreaming(agentId);

      streamChat(
        agentId,
        text,
        (event: ChatMessage) => {
          addMessage(agentId, event);
        },
        (_err: Error) => {
          addMessage(agentId, {
            type: "error",
            content: _err.message,
          });
          setStreaming(null);
        },
        controller.signal,
      ).then(() => {
        setStreaming(null);
      });
    },
    [agentId, addMessage, setStreaming],
  );

  const clearHistory = useCallback(async () => {
    abortRef.current?.abort();
    setStreaming(null);
    clearMessages(agentId);
    await clearChat(agentId);
  }, [agentId, clearMessages, setStreaming]);

  return { messages, sendMessage, isStreaming, clearHistory };
}
