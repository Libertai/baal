import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { useAgent, useDeleteAgent } from "@/lib/hooks/useAgents";
import { useDeploymentStatus } from "@/lib/hooks/useDeployment";
import type { DeploymentStatusValue } from "@/lib/api/types";

const STATUS_LABELS: Record<DeploymentStatusValue, { label: string; color: string }> = {
  running: { label: "Running", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  deploying: { label: "Deploying", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  failed: { label: "Failed", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  stopped: { label: "Stopped", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400" },
};

function DeploymentProgress({ agentId }: { agentId: string }) {
  const { data } = useDeploymentStatus(agentId);
  const steps = data?.steps ?? [];

  return (
    <View className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 mb-4">
      <Text className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Deployment Progress
      </Text>
      {steps.length > 0 ? (
        steps.map((step, i) => (
          <View key={i} className="flex-row items-center mb-2">
            <Text className="text-sm text-gray-500 dark:text-gray-400 mr-2">
              {step.status === "done" ? "[done]" : step.status === "active" ? "[...]" : "[ ]"}
            </Text>
            <Text className="text-sm text-gray-700 dark:text-gray-300">
              {String(step.label ?? step.step ?? `Step ${i + 1}`)}
            </Text>
          </View>
        ))
      ) : (
        <View className="flex-row items-center">
          <ActivityIndicator size="small" color="#2563eb" />
          <Text className="text-sm text-gray-500 dark:text-gray-400 ml-2">
            Provisioning VM...
          </Text>
        </View>
      )}
    </View>
  );
}

export default function AgentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: agent, isLoading } = useAgent(id!);
  const deleteAgent = useDeleteAgent();

  const isDeploying =
    agent?.deployment_status === "pending" ||
    agent?.deployment_status === "deploying";

  const handleDelete = () => {
    Alert.alert(
      "Delete Agent",
      `Are you sure you want to delete "${agent?.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAgent.mutateAsync(id!);
              router.back();
            } catch {
              Alert.alert("Error", "Failed to delete agent");
            }
          },
        },
      ]
    );
  };

  if (isLoading || !agent) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Agent" }} />
        <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </>
    );
  }

  const statusInfo = STATUS_LABELS[agent.deployment_status] ?? STATUS_LABELS.stopped;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: agent.name,
        }}
      />
      <ScrollView
        className="flex-1 bg-gray-50 dark:bg-gray-950"
        contentContainerStyle={{ padding: 16 }}
      >
        {/* Status badge */}
        <View className="flex-row items-center mb-6">
          <View className={`rounded-full px-3 py-1 ${statusInfo.color}`}>
            <Text className={`text-sm font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        {/* Deployment progress */}
        {isDeploying && <DeploymentProgress agentId={id!} />}

        {/* Agent info */}
        <View className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 mb-4">
          <View className="mb-3">
            <Text className="text-xs text-gray-400 uppercase tracking-wider mb-1">
              Name
            </Text>
            <Text className="text-base text-gray-900 dark:text-white">
              {agent.name}
            </Text>
          </View>
          <View className="mb-3">
            <Text className="text-xs text-gray-400 uppercase tracking-wider mb-1">
              Model
            </Text>
            <Text className="text-base text-gray-900 dark:text-white">
              {agent.model}
            </Text>
          </View>
          <View>
            <Text className="text-xs text-gray-400 uppercase tracking-wider mb-1">
              System Prompt
            </Text>
            <Text
              className="text-sm text-gray-700 dark:text-gray-300"
              numberOfLines={4}
            >
              {agent.system_prompt}
            </Text>
          </View>
        </View>

        {/* Health */}
        {agent.deployment_status === "running" && (
          <View className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 mb-4 flex-row items-center">
            <View className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2" />
            <Text className="text-sm text-gray-700 dark:text-gray-300">
              Agent is healthy
            </Text>
          </View>
        )}

        {/* Actions */}
        <View className="flex-row gap-3 mb-4">
          {agent.deployment_status === "running" && (
            <TouchableOpacity
              className="flex-1 bg-blue-600 rounded-lg py-3 items-center"
              onPress={() => router.push(`/agent/${id}/chat`)}
            >
              <Text className="text-white font-semibold text-base">Chat</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg py-3 items-center"
            onPress={() => router.push(`/agent/${id}/edit`)}
          >
            <Text className="text-gray-900 dark:text-white font-semibold text-base">
              Edit
            </Text>
          </TouchableOpacity>
        </View>

        {/* Delete */}
        <TouchableOpacity
          className="bg-red-50 dark:bg-red-900/20 rounded-lg py-3 items-center"
          onPress={handleDelete}
          disabled={deleteAgent.isPending}
        >
          {deleteAgent.isPending ? (
            <ActivityIndicator color="#dc2626" />
          ) : (
            <Text className="text-red-600 dark:text-red-400 font-semibold text-base">
              Delete Agent
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}
