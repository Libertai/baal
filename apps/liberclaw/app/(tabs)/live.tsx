import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Markdown from "react-native-markdown-display";
import { useAgents } from "@/lib/hooks/useAgents";
import { useChat } from "@/lib/hooks/useChat";
import type { Agent, ChatMessage } from "@/lib/api/types";

const markdownStyles = {
  body: { color: "#cbd5e1", fontSize: 15, lineHeight: 22 },
  code_inline: {
    backgroundColor: "#1a1424",
    color: "#ff5e00",
    paddingHorizontal: 4,
    borderRadius: 4,
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  fence: {
    backgroundColor: "#131018",
    color: "#f0ede8",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a2235",
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  link: { color: "#ff5e00" },
  heading1: { color: "#f0ede8" },
  heading2: { color: "#f0ede8" },
  heading3: { color: "#f0ede8" },
};

function formatTimestamp(): string {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, "0");
  const m = now.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function MessageBubble({ message }: { message: ChatMessage }): React.JSX.Element | null {
  if (message.type === "tool_use") return null;

  const isUser = message.type === "text" && message.name === "user";

  if (isUser) {
    return (
      <View className="mb-4 flex-row-reverse items-start">
        <View className="w-10 h-10 rounded-lg bg-slate-700 items-center justify-center ml-3">
          <MaterialIcons name="person" size={20} color="#8a8494" />
        </View>
        <View className="flex-1 items-end">
          <View className="flex-row items-center mb-1">
            <Text className="font-mono text-xs text-text-secondary mr-2">{formatTimestamp()}</Text>
            <Text className="text-sm font-bold text-text-primary">Operator</Text>
          </View>
          <View
            className="rounded-2xl rounded-tr-none px-6 py-3 max-w-[90%]"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.05)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.1)" }}
          >
            <Text className="text-base text-text-primary">{message.content ?? ""}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="mb-4 flex-row items-start">
      <View
        className="w-10 h-10 rounded-lg items-center justify-center mr-3"
        style={{ backgroundColor: "#ff5e00" }}
      >
        <MaterialIcons name="smart-toy" size={20} color="#ffffff" />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center mb-1">
          <Text className="text-sm font-bold text-text-primary mr-2">LiberClaw Agent</Text>
          <Text className="font-mono text-xs text-text-secondary">{formatTimestamp()}</Text>
        </View>
        <View className="max-w-[95%]">
          <Markdown style={markdownStyles}>{message.content ?? ""}</Markdown>
        </View>
      </View>
    </View>
  );
}

export default function LiveScreen(): React.JSX.Element {
  const router = useRouter();
  const { data: agentsData, isLoading: agentsLoading } = useAgents();
  const agents = agentsData?.agents ?? [];
  const runningAgents = agents.filter((a) => a.deployment_status === "running");

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const { messages, sendMessage, isStreaming } = useChat(selectedAgentId ?? "");
  const [input, setInput] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendMessage(text);
  }, [input, isStreaming, sendMessage]);

  const canSend = input.trim().length > 0 && !isStreaming;

  if (agentsLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-base">
        <ActivityIndicator size="large" color="#ff5e00" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface-base"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {/* MAINNET LIVE status bar */}
      <View className="flex-row items-center justify-between px-4 py-2 bg-surface-raised border-b border-surface-border">
        <View className="flex-row items-center gap-2">
          <View className="w-2 h-2 rounded-full bg-status-running" />
          <Text className="text-[10px] font-mono font-bold text-status-running uppercase tracking-wider">Mainnet Live</Text>
        </View>
        <Text className="text-[10px] font-mono text-text-tertiary">v1.0.0</Text>
      </View>

      {/* Horizontal agent carousel */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="border-b border-surface-border bg-surface-raised">
        <View className="flex-row px-4 py-3 gap-4">
          {runningAgents.map((agent) => {
            const isActive = agent.id === selectedAgentId;
            return (
              <Pressable key={agent.id} onPress={() => setSelectedAgentId(agent.id)} className="items-center gap-1.5">
                <View
                  className={`w-12 h-12 rounded-lg items-center justify-center ${isActive ? "border-2 border-claw-orange" : "border border-surface-border"}`}
                  style={{ backgroundColor: "#131018" }}
                >
                  <MaterialIcons name="smart-toy" size={20} color={isActive ? "#ff5e00" : "#5a5464"} />
                  {isActive && <View className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-status-running border-2 border-surface-raised" />}
                </View>
                <Text
                  className={`text-[10px] font-medium ${isActive ? "text-text-primary" : "text-text-tertiary"}`}
                  numberOfLines={1}
                  style={{ maxWidth: 60 }}
                >
                  {agent.name}
                </Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => router.push("/agent/create")} className="items-center gap-1.5">
            <View className="w-12 h-12 rounded-lg items-center justify-center border border-dashed border-surface-border bg-surface-raised">
              <MaterialIcons name="add" size={20} color="#5a5464" />
            </View>
            <Text className="text-[10px] text-text-tertiary">Deploy</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Messages */}
      {!selectedAgentId ? (
        <View className="flex-1 items-center justify-center px-6">
          <MaterialIcons name="sensors" size={48} color="#5a5464" />
          <Text className="text-lg text-text-tertiary mb-2 mt-4">Select an agent above</Text>
          <Text className="text-sm text-text-tertiary text-center">Tap an agent to start chatting</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={{ padding: 16, flexGrow: 1, justifyContent: "flex-end" }}
          renderItem={({ item }) => <MessageBubble message={item} />}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center">
              <MaterialIcons name="smart-toy" size={48} color="#5a5464" />
              <Text className="text-text-tertiary mt-4">Send a message to start chatting</Text>
            </View>
          }
        />
      )}

      {/* Input area */}
      {selectedAgentId && (
        <View className="border-t border-surface-border bg-surface-raised">
          <View className="flex-row items-end px-4 py-3">
            <View
              className="flex-1 rounded-xl mr-3"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.03)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.1)" }}
            >
              <TextInput
                className="px-4 py-2.5 text-base text-text-primary max-h-24"
                placeholder="Command the agent..."
                placeholderTextColor="#5a5464"
                multiline
                value={input}
                onChangeText={setInput}
                onSubmitEditing={handleSend}
                style={{ backgroundColor: "transparent" }}
              />
            </View>
            <TouchableOpacity
              className="w-10 h-10 rounded-lg items-center justify-center"
              style={{ backgroundColor: canSend ? "#ff5e00" : "#2a2235" }}
              onPress={handleSend}
              disabled={!canSend}
            >
              <MaterialIcons name="arrow-upward" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
