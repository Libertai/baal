import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAgents } from "@/lib/hooks/useAgents";
import type { Agent } from "@/lib/api/types";
import ChatView from "@/components/chat/ChatView";
import ChatHeader from "@/components/chat/ChatHeader";

// ── Agent picker ─────────────────────────────────────────────────────

interface AgentPickerProps {
  agents: Agent[];
  onSelect: (id: string) => void;
}

function AgentPicker({ agents, onSelect }: AgentPickerProps) {
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
    <View className="flex-1 px-4 pt-6">
      <Text className="text-base text-text-secondary mb-4">
        Pick an agent to chat with:
      </Text>
      {runningAgents.map((agent) => (
        <TouchableOpacity
          key={agent.id}
          className="rounded-card p-4 mb-3 flex-row items-center"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            borderWidth: 1,
            borderColor: "rgba(255, 94, 0, 0.15)",
          }}
          onPress={() => onSelect(agent.id)}
          activeOpacity={0.7}
        >
          <View
            className="w-10 h-10 rounded-lg items-center justify-center mr-4"
            style={[
              { backgroundColor: "#ff5e00" },
              Platform.OS === "web" &&
                ({
                  backgroundImage:
                    "linear-gradient(to bottom right, #ff5e00, #dc2626)",
                } as any),
            ]}
          >
            <MaterialIcons name="smart-toy" size={20} color="#ffffff" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-text-primary">
              {agent.name}
            </Text>
            <Text className="text-sm font-mono text-text-secondary">
              {agent.model}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#5a5464" />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────

export default function ChatTab() {
  const router = useRouter();
  const { data: agentsData, isLoading: agentsLoading } = useAgents();
  const agents = agentsData?.agents ?? [];
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

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
    <View className="flex-1 bg-surface-base">
      <ChatHeader
        agent={selectedAgent}
        onHistoryPress={() => setSelectedAgentId(null)}
        onMorePress={() => router.push(`/agent/${selectedAgentId}/chat`)}
      />

      {/* Chat */}
      <ChatView
        agentId={selectedAgentId}
        agentName={selectedAgent?.name}
      />
    </View>
  );
}
