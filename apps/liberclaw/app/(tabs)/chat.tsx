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
} from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAgents } from "@/lib/hooks/useAgents";
import { useChat } from "@/lib/hooks/useChat";
import type { Agent, ChatMessage } from "@/lib/api/types";

const TOOL_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  bash: "terminal",
  web_fetch: "language",
  web_search: "search",
  read_file: "folder-open",
  write_file: "save",
  edit_file: "edit",
  list_dir: "folder",
  spawn: "call-split",
};

function getToolIcon(name: string | undefined): keyof typeof MaterialIcons.glyphMap {
  if (!name) return "build";
  return TOOL_ICONS[name] ?? "build";
}

function ToolCallIndicator({ message }: { message: ChatMessage }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      className="bg-surface-overlay border border-surface-border rounded-lg px-3 py-2 mb-2 self-start max-w-[80%]"
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View className="flex-row items-center">
        <MaterialIcons
          name={getToolIcon(message.name)}
          size={12}
          color="#ff5e00"
          style={{ marginRight: 4 }}
        />
        <Text className="text-xs font-medium text-claw-orange mr-1.5">
          {message.name ?? "unknown"}
        </Text>
        <MaterialIcons
          name={expanded ? "expand-less" : "expand-more"}
          size={14}
          color="#8a8494"
        />
      </View>
      {expanded && message.content && (
        <Text className="text-xs text-text-secondary mt-1 font-mono">
          {message.content}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.type === "tool_use") {
    return <ToolCallIndicator message={message} />;
  }

  const isUser = message.type === "text" && message.name === "user";

  return (
    <View
      className={`mb-2 max-w-[80%] ${isUser ? "self-end" : "self-start"}`}
    >
      <View
        className={`rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-claw-orange rounded-br-sm"
            : "bg-surface-raised border border-surface-border rounded-bl-sm"
        }`}
      >
        <Text
          className={`text-base ${
            isUser ? "text-white" : "text-text-primary"
          }`}
        >
          {message.content ?? ""}
        </Text>
      </View>
    </View>
  );
}

function AgentPicker({
  agents,
  onSelect,
}: {
  agents: Agent[];
  onSelect: (id: string) => void;
}) {
  const runningAgents = agents.filter((a) => a.deployment_status === "running");

  if (runningAgents.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <MaterialIcons name="chat-bubble-outline" size={48} color="#5a5464" />
        <Text className="text-lg text-text-tertiary mb-2 mt-4">
          No running agents
        </Text>
        <Text className="text-sm text-text-tertiary text-center">
          Deploy an agent first, then start chatting
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 px-4 pt-4">
      <Text className="text-base text-text-secondary mb-4">
        Pick an agent to chat with:
      </Text>
      {runningAgents.map((agent) => (
        <TouchableOpacity
          key={agent.id}
          className="bg-surface-raised border border-surface-border rounded-card p-4 mb-3"
          onPress={() => onSelect(agent.id)}
        >
          <Text className="text-base font-semibold text-text-primary">
            {agent.name}
          </Text>
          <Text className="text-sm font-mono text-text-secondary">
            {agent.model}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function ChatTab() {
  const router = useRouter();
  const { data: agentsData, isLoading: agentsLoading } = useAgents();
  const agents = agentsData?.agents ?? [];

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

  if (agentsLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-base">
        <ActivityIndicator size="large" color="#ff5e00" />
      </View>
    );
  }

  if (!selectedAgentId) {
    return (
      <View className="flex-1 bg-surface-base">
        <AgentPicker agents={agents} onSelect={setSelectedAgentId} />
      </View>
    );
  }

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface-base"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header with agent name */}
      <View className="px-4 py-2 border-b border-surface-border bg-surface-raised flex-row items-center justify-between">
        <TouchableOpacity onPress={() => setSelectedAgentId(null)}>
          <Text className="text-claw-orange text-sm">Switch</Text>
        </TouchableOpacity>
        <Text className="text-base font-semibold text-text-primary">
          {selectedAgent?.name ?? "Chat"}
        </Text>
        <TouchableOpacity
          onPress={() => router.push(`/agent/${selectedAgentId}/chat`)}
        >
          <Text className="text-claw-orange text-sm">Full</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, index) => String(index)}
        contentContainerStyle={{ padding: 16, flexGrow: 1, justifyContent: "flex-end" }}
        renderItem={({ item }) => <MessageBubble message={item} />}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center">
            <Text className="text-text-tertiary">
              Send a message to start chatting
            </Text>
          </View>
        }
      />

      {/* Streaming indicator */}
      {isStreaming && (
        <View className="flex-row items-center px-4 pb-1">
          <ActivityIndicator size="small" color="#ff5e00" />
          <Text className="text-xs text-text-secondary ml-2">
            Processing...
          </Text>
        </View>
      )}

      {/* Input */}
      <View className="flex-row items-end px-4 py-3 border-t border-surface-border bg-surface-raised">
        <TextInput
          className="flex-1 bg-surface-overlay rounded-2xl px-4 py-2.5 text-base text-text-primary mr-2 max-h-24"
          placeholder="Message..."
          placeholderTextColor="#5a5464"
          multiline
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          className={`w-10 h-10 rounded-full items-center justify-center ${
            input.trim() && !isStreaming ? "bg-claw-orange" : "bg-surface-border"
          }`}
          onPress={handleSend}
          disabled={!input.trim() || isStreaming}
        >
          <MaterialIcons name="arrow-upward" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
