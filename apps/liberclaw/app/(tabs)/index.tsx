import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Platform,
  TextInput,
  TouchableOpacity,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";

import { useAgents } from "@/lib/hooks/useAgents";
import { useUsage } from "@/lib/hooks/useUsage";
import { useAuth } from "@/lib/auth/provider";
import AgentStatusBadge from "@/components/agent/AgentStatusBadge";
import type { Agent } from "@/lib/api/types";

const isWeb = Platform.OS === "web";

const MODEL_BRANDS: Record<string, string> = {
  "qwen3-coder-next": "Claw-Core",
  "glm-4.7": "Deep-Claw",
};

const ICON_COLORS: string[] = [
  "#ff5e00",
  "#00e676",
  "#ff8533",
  "#e040fb",
  "#ffab00",
  "#00bcd4",
];

const FILTERS = ["all", "running", "failed"] as const;
type Filter = (typeof FILTERS)[number];

function getIconColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ICON_COLORS[Math.abs(hash) % ICON_COLORS.length];
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Stat Cards
// ---------------------------------------------------------------------------

interface SlotsCardProps {
  used: number;
  total: number;
}

function SlotsCard({ used, total }: SlotsCardProps) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  const nativeCard =
    "bg-surface-raised border border-surface-border rounded-card";
  const cardClass = isWeb ? "glass-card rounded-2xl" : nativeCard;

  return (
    <View className={`flex-1 ${cardClass} p-4 overflow-hidden`}>
      {/* Faint watermark icon */}
      <View className="absolute -right-2 -bottom-2 opacity-[0.04]">
        <MaterialIcons name="memory" size={72} color="#ff5e00" />
      </View>

      <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
        Slots Usage
      </Text>
      <Text className="text-3xl font-bold text-text-primary mt-1">
        {used}
        <Text className="text-lg text-text-tertiary">/{total}</Text>
      </Text>

      {/* Progress bar */}
      <View className="h-1.5 bg-white/5 rounded-full mt-3 overflow-hidden">
        <View
          className="h-full bg-claw-orange rounded-full"
          style={{ width: `${pct}%` as any }}
        />
      </View>
    </View>
  );
}

interface CountCardProps {
  label: string;
  count: number;
  badgeLabel: string;
  badgeColor: "green" | "red";
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

function CountCard({
  label,
  count,
  badgeLabel,
  badgeColor,
  subtitle,
  icon,
}: CountCardProps) {
  const nativeCard =
    "bg-surface-raised border border-surface-border rounded-card";
  const cardClass = isWeb ? "glass-card rounded-2xl" : nativeCard;

  const badgeBg =
    badgeColor === "green" ? "bg-status-running/15" : "bg-status-failed/15";
  const badgeText =
    badgeColor === "green" ? "text-status-running" : "text-status-failed";
  const countColor =
    badgeColor === "green" ? "text-status-running" : "text-status-failed";

  return (
    <View className={`flex-1 ${cardClass} p-4 overflow-hidden`}>
      <View className="absolute -right-2 -bottom-2 opacity-[0.04]">
        <MaterialIcons
          name={icon}
          size={72}
          color={badgeColor === "green" ? "#00e676" : "#ff1744"}
        />
      </View>

      <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
        {label}
      </Text>
      <View className="flex-row items-end gap-2 mt-1">
        <Text className={`text-3xl font-bold ${countColor}`}>{count}</Text>
        <View className={`${badgeBg} rounded-full px-2 py-0.5 mb-1`}>
          <Text
            className={`font-mono text-[9px] uppercase tracking-wider font-semibold ${badgeText}`}
          >
            {badgeLabel}
          </Text>
        </View>
      </View>
      <Text className="text-[10px] text-text-tertiary mt-1">{subtitle}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Agent Card (running / deploying / stopped)
// ---------------------------------------------------------------------------

interface AgentCardProps {
  agent: Agent;
  onPress: () => void;
  onChat: () => void;
  onEdit: () => void;
}

function AgentCard({ agent, onPress, onChat, onEdit }: AgentCardProps) {
  const initial = agent.name.charAt(0).toUpperCase();
  const brand = MODEL_BRANDS[agent.model] ?? agent.model;
  const iconBg = getIconColor(agent.name);
  const isFailed = agent.deployment_status === "failed";

  const nativeCard =
    "bg-surface-raised border border-surface-border rounded-card";
  const nativeFailedCard =
    "bg-surface-raised border border-status-failed/30 rounded-card";
  const webCard = isFailed
    ? "glass-card rounded-2xl border-rose-500/30"
    : "glass-card glass-card-hover rounded-2xl";

  const cardClass = isWeb
    ? webCard
    : isFailed
      ? nativeFailedCard
      : nativeCard;

  if (isFailed) {
    return (
      <Pressable
        onPress={onPress}
        className={`${cardClass} p-4 mb-3 active:opacity-90`}
      >
        {/* Failed gradient overlay on web */}
        {isWeb && (
          <View
            className="absolute inset-0 rounded-2xl"
            // @ts-expect-error web-only gradient
            style={{ background: "linear-gradient(to bottom, rgba(255,23,68,0.05), transparent)" }}
          />
        )}

        {/* Icon + status */}
        <View className="flex-row items-start justify-between mb-3">
          <View
            className="w-12 h-12 rounded-lg items-center justify-center"
            style={{ backgroundColor: "rgba(255,23,68,0.15)" }}
          >
            <MaterialIcons name="error-outline" size={24} color="#ff1744" />
          </View>
          <AgentStatusBadge status={agent.deployment_status} />
        </View>

        <Text
          className="text-lg font-bold text-text-primary mb-1"
          numberOfLines={1}
        >
          {agent.name}
        </Text>

        {/* Error message */}
        <Text className="text-xs text-status-failed mb-3" numberOfLines={2}>
          Deployment failed. Check configuration and retry.
        </Text>

        {/* Retry button */}
        <Pressable
          onPress={onPress}
          className={`bg-claw-orange rounded-lg py-2.5 items-center active:bg-claw-orange-dark ${isWeb ? "glow-orange" : ""}`}
        >
          <Text className="text-white font-semibold text-sm">
            Retry Deployment
          </Text>
        </Pressable>

        {/* Secondary links */}
        <View className="flex-row justify-center gap-6 mt-3">
          <Pressable onPress={onPress}>
            <Text className="text-text-secondary text-xs">View Logs</Text>
          </Pressable>
          <Pressable onPress={onEdit}>
            <Text className="text-text-secondary text-xs">Config</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      className={`${cardClass} p-4 mb-3 active:opacity-90`}
    >
      {/* Icon + status */}
      <View className="flex-row items-start justify-between mb-3">
        <View
          className="w-12 h-12 rounded-lg items-center justify-center"
          style={{ backgroundColor: `${iconBg}15` }}
        >
          <Text style={{ color: iconBg }} className="font-bold text-xl">
            {initial}
          </Text>
        </View>
        <AgentStatusBadge status={agent.deployment_status} />
      </View>

      {/* Name */}
      <Text
        className="text-lg font-bold text-text-primary mb-1"
        numberOfLines={1}
      >
        {agent.name}
      </Text>

      {/* Description / system prompt preview */}
      <Text
        className="text-xs text-text-tertiary mb-3 leading-4"
        numberOfLines={2}
      >
        {agent.system_prompt}
      </Text>

      {/* Model badge + timestamp */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="bg-surface-overlay border border-surface-border rounded-full px-2.5 py-0.5">
          <Text className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
            {brand}
          </Text>
        </View>
        <Text className="text-[10px] text-text-tertiary">
          {formatTimeAgo(agent.updated_at)}
        </Text>
      </View>

      {/* Action buttons */}
      <View className="flex-row border-t border-surface-border pt-3">
        {agent.deployment_status === "running" && (
          <Pressable
            onPress={onChat}
            className="flex-1 flex-row items-center justify-center py-2 rounded-lg active:bg-surface-overlay"
          >
            <MaterialIcons
              name="chat-bubble-outline"
              size={16}
              color="#8a8494"
            />
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
        <Pressable
          onPress={onPress}
          className="flex-1 flex-row items-center justify-center py-2 rounded-lg active:bg-surface-overlay"
        >
          <MaterialIcons name="article" size={16} color="#8a8494" />
          <Text className="text-text-secondary text-xs font-medium ml-1.5">
            Logs
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Deploy New Agent Card
// ---------------------------------------------------------------------------

interface DeployNewCardProps {
  onPress: () => void;
}

function DeployNewCard({ onPress }: DeployNewCardProps) {
  const nativeCard =
    "border-2 border-dashed border-white/10 rounded-card bg-transparent";
  const webCard =
    "border-2 border-dashed border-white/10 rounded-2xl bg-transparent";

  const cardClass = isWeb ? webCard : nativeCard;

  return (
    <Pressable
      onPress={onPress}
      className={`${cardClass} p-6 mb-3 items-center justify-center active:opacity-80`}
      style={
        isWeb
          ? ({
              transition: "border-color 0.2s, background-color 0.2s",
              minHeight: 200,
            } as any)
          : { minHeight: 200 }
      }
    >
      <View className="w-14 h-14 rounded-full bg-white/5 items-center justify-center mb-3">
        <MaterialIcons name="add" size={28} color="#5a5464" />
      </View>
      <Text className="text-base font-bold text-text-secondary mb-1">
        Deploy New Agent
      </Text>
      <Text className="text-xs text-text-tertiary text-center">
        Configure a new model and deploy it to the cloud
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Screen
// ---------------------------------------------------------------------------

export default function AgentDashboard(): React.JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const { data, isLoading, isRefetching, refetch } = useAgents();
  const { data: usage } = useUsage();
  const agents = data?.agents ?? [];
  const agentLimit = usage?.agent_limit ?? agents.length;
  const [filter, setFilter] = useState<Filter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const runningCount = useMemo(
    () => agents.filter((a) => a.deployment_status === "running").length,
    [agents],
  );
  const failedCount = useMemo(
    () => agents.filter((a) => a.deployment_status === "failed").length,
    [agents],
  );

  const filteredAgents = useMemo(() => {
    let result =
      filter === "all"
        ? agents
        : agents.filter((a) => a.deployment_status === filter);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a) => a.name.toLowerCase().includes(q));
    }

    return result;
  }, [agents, filter, searchQuery]);

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

  function renderFilterTab(f: Filter): React.JSX.Element {
    const isActive = filter === f;
    const label =
      f === "all" ? "All Agents" : f.charAt(0).toUpperCase() + f.slice(1);

    return (
      <Pressable
        key={f}
        onPress={() => setFilter(f)}
        className={`flex-row items-center px-4 py-1.5 rounded-full ${isActive ? "bg-claw-orange" : ""}`}
      >
        {f === "failed" && failedCount > 0 && !isActive && (
          <View className="w-1.5 h-1.5 rounded-full bg-status-failed mr-1.5" />
        )}
        <Text
          className={`text-sm font-medium ${isActive ? "text-white" : "text-text-secondary"}`}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  const filterContainerClass = isWeb
    ? "glass-card rounded-full"
    : "bg-surface-raised rounded-full border border-surface-border";

  return (
    <View className="flex-1 bg-surface-base">
      <FlatList
        data={filteredAgents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        numColumns={isWeb ? 2 : 1}
        key={isWeb ? "web-2col" : "mobile-1col"}
        columnWrapperStyle={isWeb ? { gap: 12 } : undefined}
        ListHeaderComponent={
          <View className="mb-2">
            {/* Guest upgrade banner */}
            {user?.tier === "guest" && (
              <TouchableOpacity
                className="bg-claw-orange/10 border border-claw-orange/25 rounded-lg p-3 mb-4 flex-row items-center justify-between"
                onPress={() => router.push("/(auth)/login")}
              >
                <Text className="text-claw-orange text-sm flex-1">
                  Sign in to unlock more agents and messages
                </Text>
                <Text className="text-claw-orange font-semibold text-sm ml-2">
                  Sign in →
                </Text>
              </TouchableOpacity>
            )}

            {/* Header: Title + Beta badge + Create button */}
            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl font-bold text-text-primary">
                  Agents Dashboard
                </Text>
                <View className="bg-claw-orange/15 border border-claw-orange/25 rounded-full px-2.5 py-0.5">
                  <Text className="font-mono text-[9px] uppercase tracking-wider font-semibold text-claw-orange">
                    Beta
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={handleCreateAgent}
                className={`flex-row items-center bg-claw-orange rounded-lg px-4 py-2.5 active:bg-claw-orange-dark ${isWeb ? "glow-orange" : ""}`}
              >
                <MaterialIcons name="add" size={18} color="#ffffff" />
                <Text className="text-white font-semibold text-sm ml-1.5">
                  Create New Agent
                </Text>
              </Pressable>
            </View>

            {/* Search bar (web only) */}
            {isWeb && (
              <View className="glass-card rounded-xl flex-row items-center px-4 py-2.5 mb-6">
                <MaterialIcons name="search" size={20} color="#5a5464" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search agents..."
                  placeholderTextColor="#5a5464"
                  className="flex-1 ml-3 text-sm text-text-primary"
                  // @ts-expect-error web-only outline style
                  style={{ outlineStyle: "none" }}
                />
              </View>
            )}

            {/* Stats Row */}
            <View className="flex-row gap-3 mb-6">
              <SlotsCard used={agents.length} total={agentLimit} />
              <CountCard
                label="Active Agents"
                count={runningCount}
                badgeLabel="Running"
                badgeColor="green"
                subtitle={`${runningCount} of ${agents.length} online`}
                icon="check-circle"
              />
              <CountCard
                label="Issues Detected"
                count={failedCount}
                badgeLabel="Failed"
                badgeColor="red"
                subtitle={failedCount > 0 ? "Attention required" : "All clear"}
                icon="error-outline"
              />
            </View>

            {/* Filter Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
            >
              <View className={`flex-row ${filterContainerClass} p-1`}>
                {FILTERS.map(renderFilterTab)}
              </View>
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => (
          <View className={isWeb ? "flex-1" : ""}>
            <AgentCard
              agent={item}
              onPress={() => router.push(`/agent/${item.id}`)}
              onChat={() => router.push(`/agent/${item.id}/chat`)}
              onEdit={() => router.push(`/agent/${item.id}/edit`)}
            />
          </View>
        )}
        ListFooterComponent={
          filteredAgents.length > 0 ? (
            <View className={isWeb ? "flex-1 max-w-[50%]" : ""}>
              <DeployNewCard onPress={handleCreateAgent} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <View
              className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${
                isWeb
                  ? "glass-card"
                  : "bg-surface-raised border border-surface-border"
              }`}
            >
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
              className={`bg-claw-orange rounded-lg px-6 py-3 active:bg-claw-orange-dark ${isWeb ? "glow-orange" : ""}`}
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
    </View>
  );
}
