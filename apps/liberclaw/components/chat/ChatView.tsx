/**
 * Complete chat experience — messages, typing indicator, floating input.
 *
 * Used by both the tab chat screen and the dedicated agent chat screen.
 */

import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useChat } from "@/lib/hooks/useChat";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";

interface ChatViewProps {
  agentId: string;
  agentName?: string;
}

export default function ChatView({ agentId, agentName }: ChatViewProps) {
  const { messages, sendMessage, isStreaming } = useChat(agentId);
  const [showInternals, setShowInternals] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const handleSend = useCallback(
    (text: string) => {
      if (isStreaming) return;
      sendMessage(text);
    },
    [isStreaming, sendMessage],
  );

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface-base"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Subtle texture overlays (web) */}
      {Platform.OS === "web" && (
        <>
          <View
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 0 } as any}
          />
          <View
            className="absolute inset-0 pointer-events-none"
            style={
              {
                zIndex: 0,
                backgroundImage:
                  "linear-gradient(to right, #2d2830 1px, transparent 1px), linear-gradient(to bottom, #2d2830 1px, transparent 1px)",
                backgroundSize: "40px 40px",
                opacity: 0.03,
              } as any
            }
          />
        </>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, index) => String(index)}
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: Platform.OS === "web" ? 200 : 16,
          paddingHorizontal: 16,
          flexGrow: 1,
          justifyContent: "flex-end",
          maxWidth: 896,
          width: "100%",
          alignSelf: "center",
        }}
        renderItem={({ item, index }) => (
          <MessageBubble
            message={item}
            showInternals={showInternals}
            agentName={agentName}
            isLastMessage={index === messages.length - 1}
            isStreaming={isStreaming}
          />
        )}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center">
            <MaterialIcons name="smart-toy" size={48} color="#5a5464" />
            <Text className="text-text-tertiary text-base mt-4">
              Send a message to start chatting
            </Text>
          </View>
        }
      />

      {/* Typing indicator */}
      {isStreaming && <TypingIndicator />}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={isStreaming}
        showInternals={showInternals}
        onToggleInternals={setShowInternals}
      />
    </KeyboardAvoidingView>
  );
}
