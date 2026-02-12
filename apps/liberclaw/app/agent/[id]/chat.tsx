import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Animated,
} from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Markdown from "react-native-markdown-display";
import { useAgent } from "@/lib/hooks/useAgents";
import { useChat } from "@/lib/hooks/useChat";
import type { ChatMessage } from "@/lib/api/types";

// ── Tool icon mapping ────────────────────────────────────────────────

const TOOL_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  bash: "terminal",
  web_fetch: "language",
  web_search: "public",
  read_file: "folder-open",
  write_file: "save",
  edit_file: "edit",
  list_dir: "folder",
  spawn: "call-split",
};

function getToolIcon(
  name: string | undefined,
): keyof typeof MaterialIcons.glyphMap {
  if (!name) return "build";
  return TOOL_ICONS[name] ?? "build";
}

// ── Humanize tool names ──────────────────────────────────────────────

function formatToolName(name: string | undefined): string {
  if (!name) return "UNKNOWN";
  return name.replace(/_/g, " ").toUpperCase();
}

// ── Format tool output lines ─────────────────────────────────────────

interface OutputLine {
  text: string;
  isPrompt: boolean;
  isSuccess: boolean;
}

function parseToolOutput(content: string | undefined): OutputLine[] {
  if (!content) return [];
  return content.split("\n").map((line) => ({
    text: line,
    isPrompt: line.trimStart().startsWith("$"),
    isSuccess:
      line.includes("success") ||
      line.includes("ok") ||
      line.includes("done") ||
      line.includes("created") ||
      line.includes("✓"),
  }));
}

// ── Typing indicator with animated dots ──────────────────────────────

function TypingIndicator(): React.JSX.Element {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    function animateDot(
      dot: Animated.Value,
      delay: number,
    ): Animated.CompositeAnimation {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      );
    }

    const a1 = animateDot(dot1, 0);
    const a2 = animateDot(dot2, 200);
    const a3 = animateDot(dot3, 400);
    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View className="flex-row items-center px-4 pb-2 pt-1">
      <View className="flex-row items-center rounded-full bg-surface-raised px-4 py-2 border border-surface-border">
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={{
              opacity: dot,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#ff5e00",
              marginHorizontal: 3,
            }}
          />
        ))}
      </View>
    </View>
  );
}

// ── Tool call card ───────────────────────────────────────────────────

interface ToolCallCardProps {
  message: ChatMessage;
}

function ToolCallCard({ message }: ToolCallCardProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const isCompleted = true; // tool_use messages arrive after completion
  const lines = parseToolOutput(message.content);
  const toolIcon = getToolIcon(message.name);

  return (
    <TouchableOpacity
      className="mb-3 rounded-lg border overflow-hidden"
      style={{ borderColor: "rgba(255, 94, 0, 0.5)" }}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.8}
    >
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4 py-2"
        style={{
          backgroundColor: "rgba(255, 94, 0, 0.1)",
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255, 94, 0, 0.2)",
        }}
      >
        <View className="flex-row items-center">
          <MaterialIcons
            name={toolIcon}
            size={14}
            color="#ff5e00"
            style={{ marginRight: 8 }}
          />
          <Text
            className="font-mono text-xs font-bold tracking-wider"
            style={{ color: "#ff5e00" }}
          >
            TOOL: {formatToolName(message.name)}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Text
            className="font-mono text-xs font-bold tracking-wider mr-2"
            style={{ color: isCompleted ? "#00e676" : "#ffab00" }}
          >
            {isCompleted ? "COMPLETED" : "EXECUTING"}
          </Text>
          <MaterialIcons
            name={expanded ? "expand-less" : "expand-more"}
            size={16}
            color="#8a8494"
          />
        </View>
      </View>

      {/* Body (expandable) */}
      {expanded && message.content && (
        <View className="p-4" style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}>
          {lines.map((line, i) => (
            <Text
              key={i}
              className="font-mono text-xs leading-5"
              style={{ color: "#8a8494" }}
            >
              {line.isPrompt && (
                <Text style={{ color: "#ff3366" }}>$ </Text>
              )}
              {line.isSuccess && (
                <Text style={{ color: "#00e676" }}>{"✓ "}</Text>
              )}
              {line.isPrompt
                ? line.text.trimStart().slice(1).trimStart()
                : line.isSuccess
                  ? line.text
                  : line.text}
            </Text>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Markdown styles ──────────────────────────────────────────────────

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

// ── Timestamp helper ─────────────────────────────────────────────────

function formatTimestamp(): string {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, "0");
  const m = now.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

// ── Message bubble ───────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ChatMessage;
  showInternals: boolean;
}

function MessageBubble({
  message,
  showInternals,
}: MessageBubbleProps): React.JSX.Element | null {
  if (message.type === "tool_use") {
    if (!showInternals) return null;
    return <ToolCallCard message={message} />;
  }

  const isUser = message.name === "user";

  if (isUser) {
    return (
      <View className="mb-4 flex-row-reverse items-start">
        {/* User avatar */}
        <View className="w-10 h-10 rounded-lg bg-slate-700 items-center justify-center ml-3">
          <MaterialIcons name="person" size={20} color="#8a8494" />
        </View>

        {/* Content */}
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
    <View className="mb-4 flex-row items-start">
      {/* Agent avatar with orange gradient */}
      <View
        className="w-10 h-10 rounded-lg items-center justify-center mr-3"
        style={[
          { backgroundColor: "#ff5e00" },
          Platform.OS === "web" &&
            ({ backgroundImage: "linear-gradient(to bottom right, #ff5e00, #dc2626)" } as any),
        ]}
      >
        <MaterialIcons name="smart-toy" size={20} color="#ffffff" />
      </View>

      {/* Content */}
      <View className="flex-1">
        <View className="flex-row items-center mb-1">
          <Text className="text-sm font-bold text-text-primary mr-2">
            LiberClaw Agent
          </Text>
          <Text className="font-mono text-xs text-text-secondary">
            {formatTimestamp()}
          </Text>
        </View>
        <View className="max-w-[95%]">
          <Markdown style={markdownStyles}>
            {message.content ?? ""}
          </Markdown>
        </View>
      </View>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────

export default function AgentChatScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: agent } = useAgent(id!);
  const { messages, sendMessage, clearHistory, isStreaming } = useChat(id!);
  const [input, setInput] = useState("");
  const [showInternals, setShowInternals] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendMessage(text);
  }, [input, isStreaming, sendMessage]);

  const canSend = input.trim().length > 0 && !isStreaming;

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
          renderItem={({ item }) => (
            <MessageBubble message={item} showInternals={showInternals} />
          )}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center">
              <MaterialIcons name="smart-toy" size={48} color="#5a5464" />
              <Text className="text-text-tertiary text-base mt-4">
                Start a conversation
              </Text>
            </View>
          }
        />

        {/* Typing indicator */}
        {isStreaming && <TypingIndicator />}

        {/* Input area */}
        <View className="border-t border-surface-border">
          {/* Glow backdrop on web */}
          {Platform.OS === "web" && (
            <View
              className="absolute -top-1 left-4 right-4 h-1 rounded-full"
              style={[
                { opacity: 0.3 },
                { backgroundImage: "linear-gradient(to right, #ff5e00, #dc2626)", filter: "blur(8px)" } as any,
              ]}
            />
          )}

          <View className="bg-surface-raised">
            {/* Toolbar row */}
            <View className="flex-row items-center justify-between px-4 pt-3 pb-1">
              <View className="flex-row items-center">
                <Text className="text-xs text-text-secondary mr-2">
                  Show Internals
                </Text>
                <Switch
                  value={showInternals}
                  onValueChange={setShowInternals}
                  trackColor={{ false: "#2a2235", true: "rgba(255, 94, 0, 0.4)" }}
                  thumbColor={showInternals ? "#ff5e00" : "#5a5464"}
                  style={{ transform: [{ scale: 0.8 }] }}
                />
              </View>
              <View className="flex-row items-center">
                <TouchableOpacity className="p-2 mr-1">
                  <MaterialIcons name="attach-file" size={20} color="#5a5464" />
                </TouchableOpacity>
                <TouchableOpacity className="p-2">
                  <MaterialIcons name="mic" size={20} color="#5a5464" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Input row */}
            <View className="flex-row items-end px-4 pb-3 pt-1">
              <View
                className="flex-1 rounded-xl mr-3"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.1)",
                }}
              >
                <TextInput
                  className="px-4 py-2.5 text-base text-text-primary max-h-28"
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
                style={[
                  { backgroundColor: canSend ? "#ff5e00" : "#2a2235" },
                  canSend &&
                    Platform.OS === "web" &&
                    ({ boxShadow: "0 0 15px rgba(255, 94, 0, 0.4)" } as any),
                ]}
                onPress={handleSend}
                disabled={!canSend}
              >
                <MaterialIcons name="arrow-upward" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
