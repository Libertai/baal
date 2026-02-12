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
import { useAgents } from "@/lib/hooks/useAgents";
import { useChat } from "@/lib/hooks/useChat";
import type { Agent, ChatMessage } from "@/lib/api/types";

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.type === "text" && message.name === "user";
  return (
    <View
      className={`mb-2 max-w-[80%] ${isUser ? "self-end" : "self-start"}`}
    >
      <View
        className={`rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-blue-600"
            : "bg-gray-200 dark:bg-gray-800"
        }`}
      >
        <Text
          className={`text-base ${
            isUser ? "text-white" : "text-gray-900 dark:text-white"
          }`}
        >
          {message.content ?? ""}
        </Text>
      </View>
      {message.type === "tool_use" && (
        <Text className="text-xs text-gray-400 mt-1 ml-1">
          Tool: {message.name}
        </Text>
      )}
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
        <Text className="text-lg text-gray-400 dark:text-gray-500 mb-2">
          No running agents
        </Text>
        <Text className="text-sm text-gray-400 dark:text-gray-600 text-center">
          Deploy an agent first, then start chatting
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 px-4 pt-4">
      <Text className="text-base text-gray-500 dark:text-gray-400 mb-4">
        Pick an agent to chat with:
      </Text>
      {runningAgents.map((agent) => (
        <TouchableOpacity
          key={agent.id}
          className="bg-white dark:bg-gray-900 rounded-xl p-4 mb-3 border border-gray-200 dark:border-gray-800"
          onPress={() => onSelect(agent.id)}
        >
          <Text className="text-base font-semibold text-gray-900 dark:text-white">
            {agent.name}
          </Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
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
  const { messages, sendMessage, isStreaming } = useChat(selectedAgentId);
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
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!selectedAgentId) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-gray-950">
        <AgentPicker agents={agents} onSelect={setSelectedAgentId} />
      </View>
    );
  }

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50 dark:bg-gray-950"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header with agent name */}
      <View className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => setSelectedAgentId(null)}>
          <Text className="text-blue-600 text-sm">Switch</Text>
        </TouchableOpacity>
        <Text className="text-base font-semibold text-gray-900 dark:text-white">
          {selectedAgent?.name ?? "Chat"}
        </Text>
        <TouchableOpacity
          onPress={() => router.push(`/agent/${selectedAgentId}/chat`)}
        >
          <Text className="text-blue-600 text-sm">Full</Text>
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
            <Text className="text-gray-400 dark:text-gray-500">
              Send a message to start chatting
            </Text>
          </View>
        }
      />

      {/* Streaming indicator */}
      {isStreaming && (
        <View className="px-4 pb-1">
          <Text className="text-xs text-gray-400">Thinking...</Text>
        </View>
      )}

      {/* Input */}
      <View className="flex-row items-end px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <TextInput
          className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2.5 text-base text-gray-900 dark:text-white mr-2 max-h-24"
          placeholder="Message..."
          placeholderTextColor="#9ca3af"
          multiline
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          className={`w-10 h-10 rounded-full items-center justify-center ${
            input.trim() && !isStreaming ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"
          }`}
          onPress={handleSend}
          disabled={!input.trim() || isStreaming}
        >
          <Text className="text-white font-bold text-base">{"\u2191"}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
