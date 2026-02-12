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
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import Markdown from "react-native-markdown-display";
import { useAgent } from "@/lib/hooks/useAgents";
import { useChat } from "@/lib/hooks/useChat";
import type { ChatMessage } from "@/lib/api/types";

function ToolCallIndicator({ message }: { message: ChatMessage }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 mb-2 self-start max-w-[85%]"
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View className="flex-row items-center">
        <Text className="text-xs text-gray-500 dark:text-gray-400 mr-1">
          {expanded ? "v" : ">"}
        </Text>
        <Text className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Tool: {message.name ?? "unknown"}
        </Text>
      </View>
      {expanded && message.content && (
        <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
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

  const isUser = message.name === "user";

  return (
    <View className={`mb-3 max-w-[85%] ${isUser ? "self-end" : "self-start"}`}>
      <View
        className={`rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-blue-600 rounded-br-sm"
            : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <Text className="text-base text-white">{message.content ?? ""}</Text>
        ) : (
          <Markdown
            style={{
              body: { color: "#111827", fontSize: 15, lineHeight: 22 },
              code_inline: {
                backgroundColor: "#f3f4f6",
                paddingHorizontal: 4,
                borderRadius: 4,
                fontSize: 13,
                fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
              },
              fence: {
                backgroundColor: "#f3f4f6",
                padding: 12,
                borderRadius: 8,
                fontSize: 13,
                fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
              },
            }}
          >
            {message.content ?? ""}
          </Markdown>
        )}
      </View>
    </View>
  );
}

export default function AgentChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: agent } = useAgent(id!);
  const { messages, sendMessage, clearHistory, isStreaming } = useChat(id!);
  const [input, setInput] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendMessage(text);
  }, [input, isStreaming, sendMessage]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: agent?.name ?? "Chat",
          headerRight: () => (
            <TouchableOpacity onPress={clearHistory} className="pl-4">
              <Text className="text-red-500 text-sm">Clear</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        className="flex-1 bg-gray-50 dark:bg-gray-950"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={{
            padding: 16,
            flexGrow: 1,
            justifyContent: "flex-end",
          }}
          renderItem={({ item }) => <MessageBubble message={item} />}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center">
              <Text className="text-gray-400 dark:text-gray-500 text-base">
                Start a conversation
              </Text>
            </View>
          }
        />

        {/* Streaming indicator */}
        {isStreaming && (
          <View className="flex-row items-center px-4 pb-1">
            <ActivityIndicator size="small" color="#2563eb" />
            <Text className="text-xs text-gray-400 ml-2">Thinking...</Text>
          </View>
        )}

        {/* Input */}
        <View className="flex-row items-end px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <TextInput
            className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2.5 text-base text-gray-900 dark:text-white mr-2 max-h-28"
            placeholder="Message..."
            placeholderTextColor="#9ca3af"
            multiline
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            className={`w-10 h-10 rounded-full items-center justify-center ${
              input.trim() && !isStreaming
                ? "bg-blue-600"
                : "bg-gray-300 dark:bg-gray-700"
            }`}
            onPress={handleSend}
            disabled={!input.trim() || isStreaming}
          >
            <Text className="text-white font-bold text-base">{"\u2191"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
