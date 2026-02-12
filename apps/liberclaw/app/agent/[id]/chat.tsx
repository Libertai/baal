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
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Markdown from "react-native-markdown-display";
import { useAgent } from "@/lib/hooks/useAgents";
import { useChat } from "@/lib/hooks/useChat";
import type { ChatMessage } from "@/lib/api/types";

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
      className="bg-surface-overlay border border-surface-border rounded-lg px-3 py-2 mb-2 self-start max-w-[85%]"
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

const markdownStyles = {
  body: { color: "#f0ede8", fontSize: 15, lineHeight: 22 },
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
            ? "bg-claw-orange rounded-br-sm"
            : "bg-surface-raised border border-surface-border rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <Text className="text-base text-white">{message.content ?? ""}</Text>
        ) : (
          <Markdown style={markdownStyles}>
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
          headerStyle: { backgroundColor: "#0a0810" },
          headerTintColor: "#f0ede8",
          headerTitleStyle: { fontWeight: "700", color: "#f0ede8" },
          headerRight: () => (
            <TouchableOpacity onPress={clearHistory} className="pl-4">
              <Text className="text-claw-red text-sm">Clear</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        className="flex-1 bg-surface-base"
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
              <Text className="text-text-tertiary text-base">
                Start a conversation
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
            className="flex-1 bg-surface-overlay rounded-2xl px-4 py-2.5 text-base text-text-primary mr-2 max-h-28"
            placeholder="Message..."
            placeholderTextColor="#5a5464"
            multiline
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            className={`w-10 h-10 rounded-full items-center justify-center ${
              input.trim() && !isStreaming
                ? "bg-claw-orange"
                : "bg-surface-border"
            }`}
            onPress={handleSend}
            disabled={!input.trim() || isStreaming}
          >
            <MaterialIcons name="arrow-upward" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
