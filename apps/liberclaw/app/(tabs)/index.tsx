import { useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAgents } from "@/lib/hooks/useAgents";
import type { Agent, DeploymentStatusValue } from "@/lib/api/types";

const STATUS_COLORS: Record<DeploymentStatusValue, string> = {
  running: "bg-green-500",
  deploying: "bg-yellow-500",
  pending: "bg-yellow-500",
  failed: "bg-red-500",
  stopped: "bg-gray-400",
};

function AgentCard({ agent, onPress }: { agent: Agent; onPress: () => void }) {
  return (
    <TouchableOpacity
      className="bg-white dark:bg-gray-900 rounded-xl p-4 mb-3 border border-gray-200 dark:border-gray-800"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center flex-1">
          <View
            className={`w-2.5 h-2.5 rounded-full mr-2 ${STATUS_COLORS[agent.deployment_status] ?? "bg-gray-400"}`}
          />
          <Text
            className="text-base font-semibold text-gray-900 dark:text-white"
            numberOfLines={1}
          >
            {agent.name}
          </Text>
        </View>
        <Text className="text-xs text-gray-400 dark:text-gray-500 ml-2">
          {agent.deployment_status}
        </Text>
      </View>
      <Text className="text-sm text-gray-500 dark:text-gray-400 ml-4.5">
        {agent.model}
      </Text>
    </TouchableOpacity>
  );
}

export default function AgentDashboard() {
  const router = useRouter();
  const { data, isLoading, isRefetching, refetch } = useAgents();
  const agents = data?.agents ?? [];

  const handleCreateAgent = useCallback(() => {
    router.push("/agent/create");
  }, [router]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-950">
      <FlatList
        data={agents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <AgentCard
            agent={item}
            onPress={() => router.push(`/agent/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Text className="text-lg text-gray-400 dark:text-gray-500 mb-2">
              No agents yet
            </Text>
            <Text className="text-sm text-gray-400 dark:text-gray-600">
              Create your first!
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full items-center justify-center shadow-lg"
        onPress={handleCreateAgent}
        activeOpacity={0.8}
      >
        <Text className="text-white text-2xl font-light leading-none">+</Text>
      </TouchableOpacity>
    </View>
  );
}
