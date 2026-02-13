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
  Dimensions,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useChat } from "@/lib/hooks/useChat";
import { useChatStore } from "@/lib/store/chat";
import { uploadFile } from "@/lib/api/files";
import { redeployAgent } from "@/lib/api/agents";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import FilePanel from "./FilePanel";
import type { PendingFile } from "./ChatInput";

interface ChatViewProps {
  agentId: string;
  agentName?: string;
  showFilePanel?: boolean;
  onCloseFilePanel?: () => void;
}

export default function ChatView({
  agentId,
  agentName,
  showFilePanel = false,
  onCloseFilePanel,
}: ChatViewProps) {
  const { messages, sendMessage, isStreaming } = useChat(agentId);
  const { addMessage } = useChatStore();
  const [showInternals, setShowInternals] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleSend = useCallback(
    async (text: string, files?: PendingFile[]) => {
      if (isStreaming) return;

      let messageText = text;

      // Upload files first if any
      if (files && files.length > 0) {
        for (const f of files) {
          try {
            const result = await uploadFile(agentId, f.file);
            messageText = `[User uploaded ${result.name} to ${result.path}]\n${messageText}`;
          } catch {
            addMessage(agentId, {
              type: "error",
              content: `Failed to upload ${f.name}`,
            });
          }
        }
      }

      if (messageText.trim()) {
        sendMessage(messageText);
      }
    },
    [isStreaming, sendMessage, agentId, addMessage],
  );

  const handleUpgrade = useCallback(async () => {
    setIsUpgrading(true);
    try {
      await redeployAgent(agentId);
    } catch {
      // ignore — user will see the deployment status change
    } finally {
      setIsUpgrading(false);
    }
  }, [agentId]);

  const isDesktop =
    Platform.OS === "web" && Dimensions.get("window").width >= 1024;

  const chatContent = (
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
            agentId={agentId}
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

  // Desktop with file panel: side-by-side layout
  if (showFilePanel && isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: "row" }}>
        {chatContent}
        <FilePanel
          agentId={agentId}
          visible={true}
          onClose={onCloseFilePanel ?? (() => {})}
          onUpgrade={handleUpgrade}
          isUpgrading={isUpgrading}
        />
      </View>
    );
  }

  // Mobile with file panel: overlay
  if (showFilePanel && !isDesktop) {
    return (
      <View style={{ flex: 1 }}>
        {chatContent}
        <FilePanel
          agentId={agentId}
          visible={true}
          onClose={onCloseFilePanel ?? (() => {})}
          onUpgrade={handleUpgrade}
          isUpgrading={isUpgrading}
        />
      </View>
    );
  }

  return chatContent;
}
