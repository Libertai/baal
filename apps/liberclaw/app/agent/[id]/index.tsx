import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAgent, useDeleteAgent } from "@/lib/hooks/useAgents";
import { useDeploymentStatus } from "@/lib/hooks/useDeployment";
import AgentStatusBadge from "@/components/agent/AgentStatusBadge";

const MODEL_BRANDS: Record<string, string> = {
  "qwen3-coder-next": "Claw-Core",
  "glm-4.7": "Deep-Claw",
};

function DeploymentProgress({ agentId }: { agentId: string }) {
  const { data } = useDeploymentStatus(agentId);
  const steps = data?.steps ?? [];

  return (
    <View className="bg-surface-raised border border-surface-border rounded-card p-4 mb-4">
      <Text className="text-sm font-semibold text-text-primary mb-3">
        Deployment Progress
      </Text>
      {steps.length > 0 ? (
        steps.map((step, i) => (
          <View key={i} className="flex-row items-center mb-2">
            <Text className="text-sm text-text-secondary mr-2">
              {step.status === "done" ? "[done]" : step.status === "active" ? "[...]" : "[ ]"}
            </Text>
            <Text className="text-sm text-text-primary">
              {String(step.label ?? step.step ?? `Step ${i + 1}`)}
            </Text>
          </View>
        ))
      ) : (
        <View className="flex-row items-center">
          <ActivityIndicator size="small" color="#ff5e00" />
          <Text className="text-sm text-text-secondary ml-2">
            Provisioning...
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
        <Stack.Screen
          options={{
            headerShown: true,
            title: "Agent",
            headerStyle: { backgroundColor: "#0a0810" },
            headerTintColor: "#f0ede8",
            headerTitleStyle: { fontWeight: "700", color: "#f0ede8" },
          }}
        />
        <View className="flex-1 items-center justify-center bg-surface-base">
          <ActivityIndicator size="large" color="#ff5e00" />
        </View>
      </>
    );
  }

  const brandName = MODEL_BRANDS[agent.model] ?? agent.model;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: agent.name,
          headerStyle: { backgroundColor: "#0a0810" },
          headerTintColor: "#f0ede8",
          headerTitleStyle: { fontWeight: "700", color: "#f0ede8" },
        }}
      />
      <ScrollView
        className="flex-1 bg-surface-base"
        contentContainerStyle={{ padding: 16 }}
      >
        {/* Status badge */}
        <View className="flex-row items-center mb-6">
          <AgentStatusBadge status={agent.deployment_status} />
        </View>

        {/* Deployment progress */}
        {isDeploying && <DeploymentProgress agentId={id!} />}

        {/* Agent info */}
        <View className="bg-surface-raised border border-surface-border rounded-card p-4 mb-4">
          <View className="mb-3">
            <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
              Name
            </Text>
            <Text className="text-base text-text-primary">
              {agent.name}
            </Text>
          </View>
          <View className="mb-3">
            <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
              Model
            </Text>
            <Text className="text-base text-text-primary">
              {brandName}
            </Text>
            <Text className="font-mono text-xs text-claw-orange">
              {agent.model}
            </Text>
          </View>
          <View>
            <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
              System Prompt
            </Text>
            <Text
              className="text-sm text-text-secondary"
              numberOfLines={4}
            >
              {agent.system_prompt}
            </Text>
          </View>
        </View>

        {/* Health */}
        {agent.deployment_status === "running" && (
          <View className="bg-surface-raised border border-surface-border rounded-card p-4 mb-4 flex-row items-center">
            <View className="w-2.5 h-2.5 rounded-full bg-status-running mr-2" />
            <Text className="text-sm text-text-secondary">
              Agent is healthy
            </Text>
          </View>
        )}

        {/* Actions */}
        <View className="flex-row gap-3 mb-4">
          {agent.deployment_status === "running" && (
            <TouchableOpacity
              className="flex-1 bg-claw-orange active:bg-claw-orange-dark rounded-button py-3 flex-row items-center justify-center gap-2"
              onPress={() => router.push(`/agent/${id}/chat`)}
            >
              <MaterialIcons name="chat-bubble-outline" size={18} color="#ffffff" />
              <Text className="text-white font-semibold text-base">Chat</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            className="flex-1 bg-surface-raised border border-surface-border active:bg-surface-overlay rounded-button py-3 flex-row items-center justify-center gap-2"
            onPress={() => router.push(`/agent/${id}/edit`)}
          >
            <MaterialIcons name="edit" size={18} color="#f0ede8" />
            <Text className="text-text-primary font-semibold text-base">
              Edit
            </Text>
          </TouchableOpacity>
        </View>

        {/* Delete */}
        <TouchableOpacity
          className="bg-claw-red/10 border border-claw-red/25 rounded-button py-3 flex-row items-center justify-center gap-2"
          onPress={handleDelete}
          disabled={deleteAgent.isPending}
        >
          {deleteAgent.isPending ? (
            <ActivityIndicator color="#ff1744" />
          ) : (
            <>
              <MaterialIcons name="delete-outline" size={18} color="#ff003c" />
              <Text className="text-claw-red font-semibold text-base">
                Delete Agent
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}
