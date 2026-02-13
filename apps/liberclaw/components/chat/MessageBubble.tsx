/**
 * Chat message bubble — handles user, agent, tool_use, and error messages.
 */

import { View, Text, Platform } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Markdown from "react-native-markdown-display";
import type { ChatMessage } from "@/lib/api/types";
import { markdownStyles, formatTimestamp } from "./utils";
import ToolCallCard from "./ToolCallCard";
import FileCard from "./FileCard";

interface MessageBubbleProps {
  message: ChatMessage;
  showInternals: boolean;
  agentName?: string;
  agentId?: string;
  isLastMessage?: boolean;
  isStreaming?: boolean;
}

export default function MessageBubble({
  message,
  showInternals,
  agentName = "LiberClaw Agent",
  agentId,
  isLastMessage = false,
  isStreaming = false,
}: MessageBubbleProps) {
  // Tool use → delegate to ToolCallCard, indented to align with agent text
  if (message.type === "tool_use") {
    if (!showInternals) return null;
    // Only the very last message during streaming could still be executing
    const isCompleted = !(isLastMessage && isStreaming);
    return (
      <View style={{ marginLeft: 52 }}>
        <ToolCallCard message={message} isCompleted={isCompleted} />
      </View>
    );
  }

  // Error message
  if (message.type === "error") {
    return (
      <View className="mb-8 flex-row items-start">
        <View
          className="w-10 h-10 rounded items-center justify-center mr-3"
          style={{ backgroundColor: "rgba(255, 23, 68, 0.2)" }}
        >
          <MaterialIcons name="error-outline" size={20} color="#ff1744" />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            <Text className="text-sm font-bold mr-2" style={{ color: "#ff1744" }}>
              Error
            </Text>
            <Text className="font-mono text-xs text-text-secondary">
              {formatTimestamp()}
            </Text>
          </View>
          <View
            className="rounded-lg px-4 py-3"
            style={{
              backgroundColor: "rgba(255, 23, 68, 0.08)",
              borderWidth: 1,
              borderColor: "rgba(255, 23, 68, 0.3)",
            }}
          >
            <Text className="text-sm" style={{ color: "#ff8a80" }}>
              {message.content ?? "An error occurred"}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // File event from agent
  if (message.type === "file" && agentId && message.path) {
    return (
      <View className="mb-8 flex-row items-start">
        <View
          className="w-10 h-10 rounded items-center justify-center mr-3"
          style={[
            { backgroundColor: "#ff5e00" },
            Platform.OS === "web" &&
              ({
                backgroundImage:
                  "linear-gradient(to bottom right, #ff5e00, #dc2626)",
                boxShadow: "0 4px 6px rgba(234, 88, 12, 0.2)",
              } as any),
          ]}
        >
          <MaterialIcons name="smart-toy" size={20} color="#ffffff" />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            <Text className="text-sm font-bold text-text-primary mr-2">
              {agentName}
            </Text>
            <Text className="font-mono text-xs text-text-secondary">
              {formatTimestamp()}
            </Text>
          </View>
          <View className="max-w-[95%]">
            <FileCard
              agentId={agentId}
              path={message.path}
              caption={message.caption}
            />
          </View>
        </View>
      </View>
    );
  }

  // Skip non-displayable types
  if (message.type !== "text") return null;

  const isUser = message.name === "user";

  // User message
  if (isUser) {
    return (
      <View className="mb-8 flex-row-reverse items-start">
        <View className="w-10 h-10 rounded bg-slate-700 items-center justify-center ml-3">
          <MaterialIcons name="person" size={20} color="#8a8494" />
        </View>
        <View className="flex-1 items-end">
          <View className="flex-row items-center mb-1">
            <Text className="font-mono text-xs text-text-secondary mr-2">
              {formatTimestamp()}
            </Text>
            <Text className="text-sm font-bold text-text-primary">
              Operator
            </Text>
          </View>
          <View
            className="rounded-2xl rounded-tr-none px-6 py-3 max-w-[90%]"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.1)",
            }}
          >
            <Text className="text-base text-text-primary">
              {message.content ?? ""}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Agent message
  return (
    <View className="mb-8 flex-row items-start">
      <View
        className="w-10 h-10 rounded items-center justify-center mr-3"
        style={[
          { backgroundColor: "#ff5e00" },
          Platform.OS === "web" &&
            ({
              backgroundImage:
                "linear-gradient(to bottom right, #ff5e00, #dc2626)",
              boxShadow: "0 4px 6px rgba(234, 88, 12, 0.2)",
            } as any),
        ]}
      >
        <MaterialIcons name="smart-toy" size={20} color="#ffffff" />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center mb-1">
          <Text className="text-sm font-bold text-text-primary mr-2">
            {agentName}
          </Text>
          <Text className="font-mono text-xs text-text-secondary">
            {formatTimestamp()}
          </Text>
        </View>
        <View className="max-w-[95%]">
          <Markdown style={markdownStyles}>{message.content ?? ""}</Markdown>
        </View>
      </View>
    </View>
  );
}
