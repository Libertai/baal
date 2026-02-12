/**
 * Custom hook wrapping the SSE streaming client for agent chat.
 *
 * Manages message state, streaming lifecycle, and cleanup on unmount.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { streamChat } from "@/lib/api/chat";
import type { ChatMessage } from "@/lib/api/types";

interface UseSSEReturn {
  /** Send a user message and begin streaming the response. */
  sendMessage: (text: string) => void;
  /** All messages received during the current session. */
  messages: ChatMessage[];
  /** Whether the agent is currently streaming a response. */
  isStreaming: boolean;
  /** The last error encountered, or null. */
  error: Error | null;
}

export function useSSE(agentId: string): UseSSEReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // AbortController for the current stream
  const abortRef = useRef<AbortController | null>(null);

  // Cancel any in-flight stream on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, [agentId]);

  const sendMessage = useCallback(
    (text: string) => {
      // Abort any previous stream
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsStreaming(true);
      setError(null);

      // Add the user message locally
      setMessages((prev) => [
        ...prev,
        { type: "text" as const, content: text, name: "user" },
      ]);

      streamChat(
        agentId,
        text,
        (event) => {
          setMessages((prev) => [...prev, event]);
        },
        (err) => {
          setError(err);
          setIsStreaming(false);
        },
        controller.signal,
      ).then(() => {
        setIsStreaming(false);
      });
    },
    [agentId],
  );

  return { sendMessage, messages, isStreaming, error };
}
