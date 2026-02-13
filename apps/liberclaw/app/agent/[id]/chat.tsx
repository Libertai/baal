import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { useAgent } from "@/lib/hooks/useAgents";
import { useChat } from "@/lib/hooks/useChat";
import ChatView from "@/components/chat/ChatView";
import ChatHeader from "@/components/chat/ChatHeader";

export default function AgentChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: agent } = useAgent(id!);
  const { clearHistory } = useChat(id!);
  const [showFilePanel, setShowFilePanel] = useState(false);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 bg-surface-base">
        <ChatHeader
          agent={agent}
          onHistoryPress={clearHistory}
          onMorePress={() => router.back()}
          onToggleFilePanel={() => setShowFilePanel((v) => !v)}
          showFilePanel={showFilePanel}
        />
        <ChatView
          agentId={id!}
          agentName={agent?.name}
          showFilePanel={showFilePanel}
          onCloseFilePanel={() => setShowFilePanel(false)}
        />
      </View>
    </>
  );
}
