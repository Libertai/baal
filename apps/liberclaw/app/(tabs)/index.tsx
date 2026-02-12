import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useAgents } from "@/lib/hooks/useAgents";
import AgentStatusBadge from "@/components/agent/AgentStatusBadge";
import type { Agent, DeploymentStatusValue } from "@/lib/api/types";

const MODEL_BRANDS: Record<string, string> = {
  "qwen3-coder-next": "Claw-Core",
  "glm-4.7": "Deep-Claw",
};

const FILTERS = ["all", "running", "deploying", "failed"] as const;
type Filter = (typeof FILTERS)[number];

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View className="flex-1 bg-surface-raised border border-surface-border rounded-card p-4">
      <MaterialIcons name={icon} size={20} color={accent} />
      <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary mt-2">
        {label}
      </Text>
      <Text className="text-2xl font-bold text-text-primary mt-1">{value}</Text>
    </View>
  );
}

function AgentGridCard({
  agent,
  onPress,
  onChat,
  onEdit,
}: {
  agent: Agent;
  onPress: () => void;
  onChat: () => void;
  onEdit: () => void;
}) {
  const initial = agent.name.charAt(0).toUpperCase();
  const brand = MODEL_BRANDS[agent.model] ?? agent.model;

  return (
    <Pressable
      onPress={onPress}
      className="bg-surface-raised border border-surface-border rounded-card p-4 mb-3 active:opacity-90"
    >
      <View className="flex-row items-start justify-between mb-3">
        <View className="w-10 h-10 rounded-lg bg-claw-orange/10 border border-claw-orange/20 items-center justify-center">
          <Text className="text-claw-orange font-bold text-lg">{initial}</Text>
        </View>
        <AgentStatusBadge status={agent.deployment_status} />
      </View>

      <Text
        className="text-base font-bold text-text-primary mb-1"
        numberOfLines={1}
      >
        {agent.name}
      </Text>

      <View className="flex-row items-center gap-2 mb-4">
        <View className="bg-surface-overlay border border-surface-border rounded px-2 py-0.5">
          <Text className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
            {brand}
          </Text>
        </View>
      </View>

      <View className="flex-row border-t border-surface-border pt-3 gap-2">
        {agent.deployment_status === "running" && (
          <Pressable
            onPress={onChat}
            className="flex-1 flex-row items-center justify-center py-2 rounded-lg active:bg-surface-overlay"
          >
            <MaterialIcons name="chat-bubble-outline" size={16} color="#8a8494" />
            <Text className="text-text-secondary text-xs font-medium ml-1.5">
              Chat
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={onEdit}
          className="flex-1 flex-row items-center justify-center py-2 rounded-lg active:bg-surface-overlay"
        >
          <MaterialIcons name="edit" size={16} color="#8a8494" />
          <Text className="text-text-secondary text-xs font-medium ml-1.5">
            Edit
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function AgentDashboard() {
  const router = useRouter();
  const { data, isLoading, isRefetching, refetch } = useAgents();
  const agents = data?.agents ?? [];
  const [filter, setFilter] = useState<Filter>("all");

  const filteredAgents =
    filter === "all"
      ? agents
      : agents.filter((a) => a.deployment_status === filter);

  const runningCount = agents.filter(
    (a) => a.deployment_status === "running"
  ).length;
  const failedCount = agents.filter(
    (a) => a.deployment_status === "failed"
  ).length;

  const handleCreateAgent = useCallback(() => {
    router.push("/agent/create");
  }, [router]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-base">
        <ActivityIndicator size="large" color="#ff5e00" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-base">
      <FlatList
        data={filteredAgents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        ListHeaderComponent={
          <View>
            {/* Stats Row */}
            <View className="flex-row gap-3 mb-6">
              <StatCard
                icon="smart-toy"
                label="Agents"
                value={`${agents.length}`}
                accent="#ff5e00"
              />
              <StatCard
                icon="check-circle"
                label="Running"
                value={`${runningCount}`}
                accent="#00e676"
              />
              <StatCard
                icon="error-outline"
                label="Issues"
                value={`${failedCount}`}
                accent={failedCount > 0 ? "#ff1744" : "#546e7a"}
              />
            </View>

            {/* Filter Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
            >
              <View className="flex-row bg-surface-raised rounded-lg p-1 border border-surface-border">
                {FILTERS.map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => setFilter(f)}
                    className={`px-4 py-1.5 rounded-md ${
                      filter === f ? "bg-claw-orange" : ""
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium capitalize ${
                        filter === f ? "text-white" : "text-text-secondary"
                      }`}
                    >
                      {f === "all" ? "All Agents" : f}
                      {f === "failed" && failedCount > 0 ? ` (${failedCount})` : ""}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => (
          <AgentGridCard
            agent={item}
            onPress={() => router.push(`/agent/${item.id}`)}
            onChat={() => router.push(`/agent/${item.id}/chat`)}
            onEdit={() => router.push(`/agent/${item.id}/edit`)}
          />
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <View className="w-16 h-16 rounded-full bg-surface-raised border border-surface-border items-center justify-center mb-4">
              <MaterialIcons name="add" size={28} color="#5a5464" />
            </View>
            <Text className="text-lg text-text-secondary mb-2">
              No agents yet
            </Text>
            <Text className="text-sm text-text-tertiary mb-6">
              Deploy your first autonomous agent
            </Text>
            <Pressable
              onPress={handleCreateAgent}
              className="bg-claw-orange rounded-lg px-6 py-3 active:bg-claw-orange-dark"
            >
              <Text className="text-white font-semibold text-sm">
                Create Agent
              </Text>
            </Pressable>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#ff5e00"
          />
        }
      />

      {/* FAB */}
      {agents.length > 0 && (
        <Pressable
          className="absolute bottom-6 right-6 w-14 h-14 bg-claw-orange rounded-full items-center justify-center active:bg-claw-orange-dark"
          onPress={handleCreateAgent}
        >
          <MaterialIcons name="add" size={28} color="#ffffff" />
        </Pressable>
      )}
    </View>
  );
}
