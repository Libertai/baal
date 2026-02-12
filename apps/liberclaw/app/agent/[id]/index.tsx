import { Platform, View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Pressable } from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Svg, { Circle } from "react-native-svg";
import { useAgent, useDeleteAgent } from "@/lib/hooks/useAgents";
import { useDeploymentStatus } from "@/lib/hooks/useDeployment";
import AgentStatusBadge from "@/components/agent/AgentStatusBadge";

const isWeb = Platform.OS === "web";

const MODEL_BRANDS: Record<string, string> = {
  "qwen3-coder-next": "Claw-Core",
  "glm-4.7": "Deep-Claw",
};

const DEPLOY_STEPS = [
  { key: "provisioning", label: "Infrastructure Provisioning", detail: "Allocating compute on Aleph Cloud.", doneDetail: "Allocated 8x GPU Cluster on Node US-East-4." },
  { key: "deploying", label: "Environment Setup", detail: "Configuring runtime and dependencies.", doneDetail: "Python 3.11 env configured. Dependencies installed." },
  { key: "model", label: "Model Hydration", detail: "Loading weights into VRAM.", doneDetail: "Model loaded successfully." },
  { key: "handshake", label: "Neural Link Handshake", detail: "Establishing secure websocket connection.", doneDetail: "Secure connection established." },
  { key: "health", label: "Health Check", detail: "Verifying agent is responding.", doneDetail: "Agent responding normally." },
  { key: "running", label: "Live Activation", detail: "Agent is online and ready.", doneDetail: "Agent is live." },
];

function CircularProgress({ progress }: { progress: number }) {
  const size = 200;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* Spinning dashed ring */}
      {isWeb && (
        <View
          className="absolute inset-0 rounded-full animate-spin-slow"
          style={{ border: "1px dashed rgba(255,255,255,0.1)" } as any}
        />
      )}
      {/* Inner orange blur pulse */}
      {isWeb && (
        <View
          className="absolute rounded-full"
          style={{ inset: 16, backgroundColor: "rgba(255,94,0,0.05)", filter: "blur(20px)", animation: "pulse 2s ease-in-out infinite" } as any}
        />
      )}
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="#1e1b24" strokeWidth={strokeWidth} fill="transparent"
        />
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="#ff5e00" strokeWidth={strokeWidth} fill="transparent"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text
          className="text-5xl font-black text-text-primary"
          style={isWeb ? { textShadow: "0 0 20px rgba(255,94,0,0.5)" } as any : undefined}
        >
          {Math.round(progress)}
          <Text className="text-xl">%</Text>
        </Text>
        <Text className="font-mono text-[10px] text-claw-orange uppercase mt-1">
          Initializing...
        </Text>
      </View>
    </View>
  );
}

function DeploymentView({ agentId, agentName }: { agentId: string; agentName: string }) {
  const { data } = useDeploymentStatus(agentId);
  const apiSteps = data?.steps ?? [];

  let currentStep = 0;
  if (apiSteps.length > 0) {
    const activeIdx = apiSteps.findIndex(
      (s: Record<string, unknown>) => s.status === "active" || s.status === "in_progress"
    );
    const doneCount = apiSteps.filter(
      (s: Record<string, unknown>) => s.status === "done" || s.status === "complete"
    ).length;
    currentStep = activeIdx >= 0 ? activeIdx : doneCount;
  }

  const progress = Math.min(((currentStep + 0.5) / DEPLOY_STEPS.length) * 100, 100);

  const containerStyle = isWeb
    ? ({
        background: "linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(255,94,0,0.3)",
        borderRadius: 24,
        boxShadow: "0 0 15px rgba(255,94,0,0.1)",
      } as any)
    : {
        backgroundColor: "#131018",
        borderWidth: 1,
        borderColor: "#2a2235",
        borderRadius: 16,
      };

  return (
    <View className="px-4 py-6">
      {/* Background effects (web) */}
      {isWeb && (
        <>
          <View className="absolute inset-0 hero-glow pointer-events-none" style={{ zIndex: 0 } as any} />
          <View className="absolute inset-0 mesh-bg pointer-events-none" style={{ zIndex: 0 } as any} />
        </>
      )}
      {/* Title */}
      <View className="items-center mb-8">
        <Text
          className="text-2xl font-black text-text-primary uppercase tracking-tight text-center"
          style={isWeb ? { textShadow: "0 0 20px rgba(255,94,0,0.5)" } as any : undefined}
        >
          Deploying{" "}
          <Text className="text-claw-orange">{agentName}</Text>
        </Text>
        <Text className="font-mono text-xs text-claw-orange/70 uppercase tracking-widest mt-1">
          Provisioning on Aleph Cloud Secure Enclave
        </Text>
      </View>

      <View style={[containerStyle, { padding: isWeb ? 32 : 20, overflow: "hidden" }]}>
        {/* Corner blur blobs */}
        {isWeb && (
          <>
            <View style={{ position: "absolute", top: 0, right: 0, width: 256, height: 256, backgroundColor: "rgba(255,94,0,0.05)", borderRadius: 9999, filter: "blur(60px)" } as any} />
            <View style={{ position: "absolute", bottom: 0, left: 0, width: 256, height: 256, backgroundColor: "rgba(255,0,60,0.05)", borderRadius: 9999, filter: "blur(60px)" } as any} />
          </>
        )}

        {/* 2-column layout on desktop: progress+terminal LEFT, timeline RIGHT */}
        <View
          style={isWeb ? { display: "grid" as any, gridTemplateColumns: "1fr 1fr", gap: 32 } as any : undefined}
        >
          {/* Left column — Circular Progress + Terminal */}
          <View>
            <View className="items-center mb-8">
              <CircularProgress progress={progress} />
            </View>

            {/* Terminal log */}
            <View className="bg-black/30 border border-surface-border rounded-lg p-3 relative overflow-hidden">
              {isWeb && <View className="scan-line" />}
              <Text className="font-mono text-[10px] text-status-running">
                {">"} [SUCCESS] VM instance created (ID: vm-3Xv2)
              </Text>
              <Text className="font-mono text-[10px] text-status-running">
                {">"} [SUCCESS] Network interface bound to 10.0.4.2
              </Text>
              <Text className="font-mono text-[10px] text-status-running">
                {">"} Security groups applied
              </Text>
              <Text className="font-mono text-[10px] text-claw-orange">
                {">"} [PENDING] Pulling Docker image liberclaw/agent-core:latest...
              </Text>
              <Text className="font-mono text-[10px] text-text-tertiary">
                {">"} Waiting for container orchestration...
              </Text>
            </View>
          </View>

          {/* Right column — Timeline */}
          <View className="relative">
            {/* Connecting line */}
            <View
              className="absolute w-0.5"
              style={{
                left: 15,
                top: 16,
                bottom: 16,
                backgroundColor: "#2a2235",
              }}
            />
            <View
              className="absolute w-0.5"
              style={{
                left: 15,
                top: 16,
                height: `${Math.max(0, (currentStep / (DEPLOY_STEPS.length - 1)) * 100)}%` as any,
                ...(isWeb
                  ? { background: "linear-gradient(to bottom, #ff5e00, #ff003c)" }
                  : { backgroundColor: "#ff5e00" }),
              }}
            />

            {DEPLOY_STEPS.map((step, i) => {
              const isDone = i < currentStep;
              const isCurrent = i === currentStep;

              return (
                <View
                  key={step.key}
                  className="flex-row mb-5 last:mb-0"
                  style={{ opacity: i > currentStep ? 0.5 : 1 }}
                >
                  <View className="z-10">
                    {isDone ? (
                      <View
                        className="w-8 h-8 rounded-full bg-claw-orange items-center justify-center"
                        style={isWeb ? { boxShadow: "0 0 15px rgba(255,94,0,0.4)" } as any : undefined}
                      >
                        <MaterialIcons name="check" size={16} color="#ffffff" />
                      </View>
                    ) : isCurrent ? (
                      <View className="w-8 h-8 rounded-full bg-surface-base border-2 border-claw-orange items-center justify-center">
                        <View className="w-3 h-3 bg-claw-orange rounded-full" />
                        {isWeb && (
                          <View
                            className="absolute w-3 h-3 bg-claw-orange rounded-full"
                            style={{ animation: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite" } as any}
                          />
                        )}
                      </View>
                    ) : (
                      <View className="w-8 h-8 rounded-full bg-surface-base border border-surface-border items-center justify-center">
                        <Text className="font-mono text-[10px] text-text-tertiary font-bold">
                          {String(i + 1).padStart(2, "0")}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View className="ml-3 flex-1">
                    <Text className={`text-base font-bold ${isDone || isCurrent ? "text-text-primary" : "text-text-secondary"}`}>
                      {step.label}
                    </Text>
                    {isDone && (
                      <View>
                        <Text className="font-mono text-[10px] text-status-running uppercase mt-0.5">
                          {"✓ "}COMPLETE
                        </Text>
                        <Text className="text-xs text-text-tertiary mt-0.5">{step.doneDetail}</Text>
                      </View>
                    )}
                    {isCurrent && (
                      <View>
                        <Text className="font-mono text-[10px] text-claw-orange uppercase mt-0.5">
                          IN PROGRESS
                        </Text>
                        <Text className="text-xs text-text-tertiary mt-0.5">{step.detail}</Text>
                        {/* Progress bar for active step */}
                        <View className="mt-2 h-1 bg-surface-raised rounded-full overflow-hidden">
                          <View
                            className="h-full rounded-full"
                            style={[
                              { width: "60%" },
                              isWeb
                                ? { background: "linear-gradient(to right, #ff5e00, #ff003c)" } as any
                                : { backgroundColor: "#ff5e00" },
                            ]}
                          />
                        </View>
                      </View>
                    )}
                    {!isDone && !isCurrent && (
                      <View>
                        <Text className="font-mono text-[10px] text-text-tertiary uppercase mt-0.5">
                          PENDING
                        </Text>
                        <Text className="text-xs text-text-tertiary mt-0.5">{step.detail}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Footer inside glass widget */}
        <View className="mt-8 pt-4 border-t border-white/5 flex-row justify-between items-center">
          <Text className="text-xs font-mono text-text-tertiary">
            SESSION ID: <Text className="text-text-secondary">0x{agentId.slice(0, 6)}...{agentId.slice(-4)}</Text>
          </Text>
          <Pressable className="flex-row items-center gap-2">
            <MaterialIcons name="cancel" size={16} color="rgba(255,0,60,0.7)" />
            <Text className="text-sm font-mono text-claw-red/70 uppercase">Abort Deployment</Text>
          </Pressable>
        </View>
      </View>

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

  const cardClass = isWeb
    ? "glass-card rounded-2xl"
    : "bg-surface-raised border border-surface-border rounded-card";

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
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Deployment Progress (full-page takeover when deploying) */}
        {isDeploying ? (
          <DeploymentView agentId={id!} agentName={agent.name} />
        ) : (
          <View className="px-4 pt-4">
            {/* Status + Agent Icon */}
            <View className="items-center mb-6">
              <View
                className="w-20 h-20 rounded-2xl items-center justify-center mb-4"
                style={[
                  { backgroundColor: "#ff5e00" },
                  isWeb && {
                    // @ts-expect-error -- web-only
                    background: "linear-gradient(135deg, #ff5e00, #dc2626)",
                    boxShadow: "0 0 30px rgba(255,94,0,0.3)",
                  },
                ]}
              >
                <MaterialIcons name="smart-toy" size={36} color="#ffffff" />
              </View>
              <Text className="text-2xl font-bold text-text-primary mb-1">
                {agent.name}
              </Text>
              <AgentStatusBadge status={agent.deployment_status} />
            </View>

            {/* Agent info card */}
            <View className={`${cardClass} p-5 mb-4`}>
              <View className="mb-4 pb-4 border-b border-surface-border">
                <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
                  Model
                </Text>
                <Text className="text-lg text-text-primary font-bold">
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
                <Text className="text-sm text-text-secondary leading-relaxed" numberOfLines={6}>
                  {agent.system_prompt}
                </Text>
              </View>
            </View>

            {/* Health indicator */}
            {agent.deployment_status === "running" && (
              <View className={`${cardClass} p-4 mb-4 flex-row items-center`}>
                <View className="w-2.5 h-2.5 rounded-full bg-status-running mr-3" />
                <Text className="text-sm text-text-primary font-medium flex-1">
                  Agent is healthy and responding
                </Text>
                <Text className="font-mono text-[10px] text-status-running uppercase">
                  Online
                </Text>
              </View>
            )}

            {/* Action buttons */}
            <View className="flex-row gap-3 mb-4">
              {agent.deployment_status === "running" && (
                <TouchableOpacity
                  className="flex-1 bg-claw-orange active:bg-claw-orange-dark rounded-lg py-3.5 flex-row items-center justify-center gap-2"
                  style={isWeb ? { boxShadow: "0 0 20px rgba(255,94,0,0.4)" } as any : undefined}
                  onPress={() => router.push(`/agent/${id}/chat`)}
                >
                  <MaterialIcons name="chat-bubble-outline" size={18} color="#ffffff" />
                  <Text className="text-white font-bold text-base">Chat</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                className="flex-1 bg-surface-raised border border-surface-border active:bg-surface-overlay rounded-lg py-3.5 flex-row items-center justify-center gap-2"
                onPress={() => router.push(`/agent/${id}/edit`)}
              >
                <MaterialIcons name="edit" size={18} color="#f0ede8" />
                <Text className="text-text-primary font-semibold text-base">Edit</Text>
              </TouchableOpacity>
            </View>

            {/* Delete */}
            <TouchableOpacity
              className="bg-claw-red/10 border border-claw-red/25 rounded-lg py-3.5 flex-row items-center justify-center gap-2"
              onPress={handleDelete}
              disabled={deleteAgent.isPending}
            >
              {deleteAgent.isPending ? (
                <ActivityIndicator color="#ff1744" />
              ) : (
                <>
                  <MaterialIcons name="delete-outline" size={18} color="#ff003c" />
                  <Text className="text-claw-red font-semibold text-base">Delete Agent</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </>
  );
}
