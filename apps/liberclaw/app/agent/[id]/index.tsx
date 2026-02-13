import { Platform, View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Pressable } from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Svg, { Circle } from "react-native-svg";
import { useState, useRef, useEffect } from "react";
import { useAgent, useDeleteAgent } from "@/lib/hooks/useAgents";
import { useDeploymentStatus } from "@/lib/hooks/useDeployment";
import { rebuildAgent, redeployAgent, getAgentHealth } from "@/lib/api/agents";
import AgentStatusBadge from "@/components/agent/AgentStatusBadge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeploymentStep, DeploymentLogEntry } from "@/lib/api/types";

const isWeb = Platform.OS === "web";

const MODEL_BRANDS: Record<string, string> = {
  "qwen3-coder-next": "Claw-Core",
  "glm-4.7": "Deep-Claw",
};

const DEPLOY_STEPS = [
  { key: "provisioning", label: "Infrastructure Provisioning", detail: "Allocating compute on Aleph Cloud." },
  { key: "allocation", label: "Network Allocation", detail: "Waiting for VM to come online." },
  { key: "ssh", label: "Secure Connection", detail: "Establishing SSH connection to VM." },
  { key: "environment", label: "Environment Setup", detail: "Installing runtime and deploying code." },
  { key: "service", label: "Service Activation", detail: "Starting agent and configuring HTTPS." },
  { key: "health", label: "Health Check", detail: "Verifying agent is responding." },
];

const UPGRADE_STEPS = [
  { key: "allocation", label: "Locating VM", detail: "Finding existing VM on the network." },
  { key: "environment", label: "Pushing Update", detail: "Deploying latest code and configuration." },
  { key: "health", label: "Health Check", detail: "Verifying agent is responding." },
];

const LOG_COLORS: Record<string, string> = {
  success: "text-status-running",
  error: "text-claw-red",
  warning: "text-claw-orange",
  info: "text-text-tertiary",
};

function CircularProgress({ progress, activeLabel }: { progress: number; activeLabel: string }) {
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
          {activeLabel}
        </Text>
      </View>
    </View>
  );
}

function TerminalLog({ logs }: { logs: DeploymentLogEntry[] }) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [logs.length]);

  const levelPrefix: Record<string, string> = {
    success: "[SUCCESS]",
    error: "[ERROR]",
    warning: "[WARN]",
    info: ">",
  };

  return (
    <View className="bg-black/30 border border-surface-border rounded-lg relative overflow-hidden" style={{ maxHeight: 180 }}>
      {isWeb && <View className="scan-line" />}
      <ScrollView ref={scrollRef} style={{ padding: 12 }}>
        {logs.length === 0 && (
          <Text className="font-mono text-[10px] text-text-tertiary">
            {">"} Waiting for deployment to start...
          </Text>
        )}
        {logs.map((log, i) => (
          <Text key={i} className={`font-mono text-[10px] ${LOG_COLORS[log.level] ?? "text-text-tertiary"}`}>
            {levelPrefix[log.level] ?? ">"} {log.message}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

function DeploymentView({ agentId, agentName, isUpgrade, onAbort, onRebuild }: { agentId: string; agentName: string; isUpgrade: boolean; onAbort: () => void; onRebuild: () => void }) {
  const { data } = useDeploymentStatus(agentId);
  const apiSteps: DeploymentStep[] = data?.steps ?? [];
  const apiLogs: DeploymentLogEntry[] = data?.logs ?? [];
  const steps = isUpgrade ? UPGRADE_STEPS : DEPLOY_STEPS;

  // Find current step index from API data
  let currentStep = 0;
  let activeLabel = "Initializing...";
  if (apiSteps.length > 0) {
    // Map API steps to our display steps by key
    const activeStep = apiSteps.find((s) => s.status === "active");
    const failedStep = apiSteps.find((s) => s.status === "failed");
    const doneKeys = new Set(apiSteps.filter((s) => s.status === "done").map((s) => s.key));

    if (failedStep) {
      const idx = steps.findIndex((s) => s.key === failedStep.key);
      currentStep = idx >= 0 ? idx : 0;
      activeLabel = "Failed";
    } else if (activeStep) {
      const idx = steps.findIndex((s) => s.key === activeStep.key);
      currentStep = idx >= 0 ? idx : 0;
      activeLabel = steps[currentStep]?.label ?? "Deploying...";
    } else {
      const doneCount = steps.filter((s) => doneKeys.has(s.key)).length;
      currentStep = doneCount;
      activeLabel = doneCount >= steps.length ? "Complete" : "Deploying...";
    }
  }

  const progress = apiSteps.length > 0
    ? Math.min(((currentStep + 0.5) / steps.length) * 100, 100)
    : 0;

  // Get step status and detail from API data, falling back to static defaults
  const getStepState = (stepKey: string, idx: number) => {
    const apiStep = apiSteps.find((s) => s.key === stepKey);
    const stepDef = steps[idx];
    if (!apiStep) {
      return { status: "pending" as const, detail: stepDef.detail };
    }
    return {
      status: apiStep.status,
      detail: apiStep.detail ?? stepDef.detail,
    };
  };

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
    <View className="flex-1">
      {/* Background effects (web) */}
      {isWeb && (
        <>
          <View className="absolute inset-0 hero-glow pointer-events-none" style={{ zIndex: 0 } as any} />
          <View className="absolute inset-0 mesh-bg pointer-events-none" style={{ zIndex: 0 } as any} />
        </>
      )}
      <View style={{ padding: 16, paddingVertical: 24, width: "100%", maxWidth: 1200, alignSelf: "center", flex: 1 } as any}>
      {/* Title */}
      <View className="items-center mb-8">
        <Text
          className="text-2xl font-black text-text-primary uppercase tracking-tight text-center"
          style={isWeb ? { textShadow: "0 0 20px rgba(255,94,0,0.5)" } as any : undefined}
        >
          {isUpgrade ? "Updating" : "Deploying"}{" "}
          <Text className="text-claw-orange">{agentName}</Text>
        </Text>
        <Text className="font-mono text-xs text-claw-orange/70 uppercase tracking-widest mt-1">
          {isUpgrade ? "Pushing latest code to existing VM" : "Provisioning on Aleph Cloud Secure Enclave"}
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
              <CircularProgress progress={progress} activeLabel={activeLabel} />
            </View>

            {/* Terminal log — real data from API */}
            <TerminalLog logs={apiLogs} />
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
                height: `${Math.max(0, (currentStep / (steps.length - 1)) * 100)}%` as any,
                ...(isWeb
                  ? { background: "linear-gradient(to bottom, #ff5e00, #ff003c)" }
                  : { backgroundColor: "#ff5e00" }),
              }}
            />

            {steps.map((step, i) => {
              const state = getStepState(step.key, i);
              const isDone = state.status === "done";
              const isCurrent = state.status === "active";
              const isFailed = state.status === "failed";
              const isPending = state.status === "pending";

              return (
                <View
                  key={step.key}
                  className="flex-row mb-5 last:mb-0"
                  style={{ opacity: isPending ? 0.5 : 1 }}
                >
                  <View className="z-10">
                    {isDone ? (
                      <View
                        className="w-8 h-8 rounded-full bg-claw-orange items-center justify-center"
                        style={isWeb ? { boxShadow: "0 0 15px rgba(255,94,0,0.4)" } as any : undefined}
                      >
                        <MaterialIcons name="check" size={16} color="#ffffff" />
                      </View>
                    ) : isFailed ? (
                      <View
                        className="w-8 h-8 rounded-full bg-claw-red items-center justify-center"
                        style={isWeb ? { boxShadow: "0 0 15px rgba(255,0,60,0.4)" } as any : undefined}
                      >
                        <MaterialIcons name="close" size={16} color="#ffffff" />
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
                    <Text className={`text-base font-bold ${isPending ? "text-text-secondary" : "text-text-primary"}`}>
                      {step.label}
                    </Text>
                    {isDone && (
                      <View>
                        <Text className="font-mono text-[10px] text-status-running uppercase mt-0.5">
                          {"✓ "}COMPLETE
                        </Text>
                        <Text className="text-xs text-text-tertiary mt-0.5">{state.detail}</Text>
                      </View>
                    )}
                    {isFailed && (
                      <View>
                        <Text className="font-mono text-[10px] text-claw-red uppercase mt-0.5">
                          {"✗ "}FAILED
                        </Text>
                        <Text className="text-xs text-claw-red/70 mt-0.5">{state.detail}</Text>
                      </View>
                    )}
                    {isCurrent && (
                      <View>
                        <Text className="font-mono text-[10px] text-claw-orange uppercase mt-0.5">
                          IN PROGRESS
                        </Text>
                        <Text className="text-xs text-text-tertiary mt-0.5">{state.detail}</Text>
                        {/* Progress bar for active step */}
                        <View className="mt-2 h-1 bg-surface-raised rounded-full overflow-hidden">
                          <View
                            className="h-full rounded-full"
                            style={[
                              { width: "60%" },
                              isWeb
                                ? { background: "linear-gradient(to right, #ff5e00, #ff003c)", animation: "pulse 2s ease-in-out infinite" } as any
                                : { backgroundColor: "#ff5e00" },
                            ]}
                          />
                        </View>
                      </View>
                    )}
                    {isPending && (
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
          <View className="flex-row items-center gap-4">
            <Pressable className="flex-row items-center gap-2" onPress={onRebuild}>
              <MaterialIcons name="refresh" size={16} color="rgba(255,94,0,0.7)" />
              <Text className="text-sm font-mono text-claw-orange/70 uppercase">Rebuild</Text>
            </Pressable>
            <Pressable className="flex-row items-center gap-2" onPress={onAbort}>
              <MaterialIcons name="cancel" size={16} color="rgba(255,0,60,0.7)" />
              <Text className="text-sm font-mono text-claw-red/70 uppercase">Abort</Text>
            </Pressable>
          </View>
        </View>
      </View>

      </View>
    </View>
  );
}

export default function AgentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDeployingRef = useRef(false);
  const { data: agent, isLoading, refetch } = useAgent(id!);
  const deleteAgent = useDeleteAgent();
  const queryClient = useQueryClient();
  const [aborting, setAborting] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  const isDeploying =
    agent?.deployment_status === "pending" ||
    agent?.deployment_status === "deploying";

  // Refetch agent data periodically while deploying so the page
  // transitions to the result view when deployment finishes
  useEffect(() => {
    if (!isDeploying) {
      // If we were deploying and now we're not, do one final refetch
      if (isDeployingRef.current) {
        isDeployingRef.current = false;
        refetch();
      }
      return;
    }
    isDeployingRef.current = true;
    const interval = setInterval(() => refetch(), 5_000);
    return () => clearInterval(interval);
  }, [isDeploying, refetch]);

  // Poll health for "running" agents
  const { data: health } = useQuery({
    queryKey: ["agent-health", id],
    queryFn: () => getAgentHealth(id!),
    enabled: !!id && agent?.deployment_status === "running",
    refetchInterval: 15_000,
  });

  const isUnhealthy = agent?.deployment_status === "running" && health && !health.healthy;
  const isFailed = agent?.deployment_status === "failed";
  const needsUpgrade =
    agent?.deployment_status === "running" &&
    health?.healthy &&
    health.agent_version != null &&
    health.current_version != null &&
    health.agent_version < health.current_version;
  const [upgrading, setUpgrading] = useState(false);

  const handleAbort = async () => {
    setAborting(true);
    try {
      await deleteAgent.mutateAsync(id!);
      router.back();
    } catch {
      setAborting(false);
    }
  };

  const doRebuild = async () => {
    setRebuilding(true);
    try {
      const updated = await rebuildAgent(id!);
      queryClient.setQueryData(["agent", id], updated);
    } catch {
      await refetch();
    } finally {
      setRebuilding(false);
    }
  };

  const handleRebuild = () => {
    if (isWeb) {
      if (window.confirm("This will destroy the current VM and create a new one from scratch. The agent will be unavailable during redeployment (~2-3 min).\n\nContinue?")) {
        doRebuild();
      }
    } else {
      Alert.alert(
        "Rebuild Agent",
        "This will destroy the current VM and create a new one from scratch. The agent will be unavailable during redeployment (~2-3 min).\n\nContinue?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Rebuild", style: "destructive", onPress: doRebuild },
        ]
      );
    }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const updated = await redeployAgent(id!);
      queryClient.setQueryData(["agent", id], updated);
    } catch {
      await refetch();
    } finally {
      setUpgrading(false);
    }
  };

  const handleDelete = async () => {
    if (isWeb) {
      if (!window.confirm(`Are you sure you want to delete "${agent?.name}"? This cannot be undone.`)) return;
      try {
        await deleteAgent.mutateAsync(id!);
        router.back();
      } catch {
        window.alert("Failed to delete agent");
      }
    } else {
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
    }
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
          <DeploymentView agentId={id!} agentName={agent.name} isUpgrade={!!agent.vm_url} onAbort={handleAbort} onRebuild={handleRebuild} />
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

            {/* Health / failure indicator */}
            {isFailed && (
              <View className={`${cardClass} p-4 mb-4`}>
                <View className="flex-row items-center mb-3">
                  <MaterialIcons name="error-outline" size={20} color="#ff003c" />
                  <Text className="text-sm text-claw-red font-semibold ml-2 flex-1">
                    Deployment failed
                  </Text>
                </View>
                <Text className="text-xs text-text-tertiary mb-3">
                  The agent could not start. Try pushing an update first, or rebuild to create a fresh VM from scratch.
                </Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    className="flex-1 bg-claw-orange active:bg-claw-orange-dark rounded-lg py-3 flex-row items-center justify-center gap-2"
                    onPress={handleUpgrade}
                    disabled={upgrading}
                  >
                    {upgrading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <MaterialIcons name="sync" size={18} color="#ffffff" />
                        <Text className="text-white font-bold">Update</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 bg-surface-raised border border-claw-red/30 active:bg-surface-overlay rounded-lg py-3 flex-row items-center justify-center gap-2"
                    onPress={handleRebuild}
                    disabled={rebuilding}
                  >
                    {rebuilding ? (
                      <ActivityIndicator color="#ff003c" />
                    ) : (
                      <>
                        <MaterialIcons name="build" size={18} color="#ff003c" />
                        <Text className="text-claw-red font-bold">Rebuild</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {agent.deployment_status === "running" && isUnhealthy && (
              <View className={`${cardClass} p-4 mb-4`}>
                <View className="flex-row items-center mb-3">
                  <MaterialIcons name="warning" size={20} color="#ff5e00" />
                  <Text className="text-sm text-claw-orange font-semibold ml-2 flex-1">
                    Agent is not responding
                  </Text>
                </View>
                <Text className="text-xs text-text-tertiary mb-3">
                  The VM is deployed but the agent service is down. Try updating first, or rebuild to start fresh.
                </Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    className="flex-1 bg-claw-orange active:bg-claw-orange-dark rounded-lg py-3 flex-row items-center justify-center gap-2"
                    onPress={handleUpgrade}
                    disabled={upgrading}
                  >
                    {upgrading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <MaterialIcons name="sync" size={18} color="#ffffff" />
                        <Text className="text-white font-bold">Update</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 bg-surface-raised border border-claw-orange/30 active:bg-surface-overlay rounded-lg py-3 flex-row items-center justify-center gap-2"
                    onPress={handleRebuild}
                    disabled={rebuilding}
                  >
                    {rebuilding ? (
                      <ActivityIndicator color="#ff5e00" />
                    ) : (
                      <>
                        <MaterialIcons name="build" size={18} color="#ff5e00" />
                        <Text className="text-claw-orange font-bold">Rebuild</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {agent.deployment_status === "running" && health?.healthy && (
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

            {needsUpgrade && (
              <View className={`${cardClass} p-4 mb-4`}>
                <View className="flex-row items-center mb-3">
                  <MaterialIcons name="system-update" size={20} color="#ff5e00" />
                  <Text className="text-sm text-claw-orange font-semibold ml-2 flex-1">
                    Update available
                  </Text>
                  <Text className="font-mono text-[10px] text-text-tertiary">
                    v{health!.agent_version} → v{health!.current_version}
                  </Text>
                </View>
                <Text className="text-xs text-text-tertiary mb-3">
                  A newer version of the agent runtime is available. Update pushes new code to the existing VM. Rebuild creates a fresh VM from scratch.
                </Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    className="flex-1 bg-claw-orange active:bg-claw-orange-dark rounded-lg py-3 flex-row items-center justify-center gap-2"
                    onPress={handleUpgrade}
                    disabled={upgrading}
                  >
                    {upgrading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <MaterialIcons name="sync" size={18} color="#ffffff" />
                        <Text className="text-white font-bold">Update</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 bg-surface-raised border border-claw-orange/30 active:bg-surface-overlay rounded-lg py-3 flex-row items-center justify-center gap-2"
                    onPress={handleRebuild}
                    disabled={rebuilding}
                  >
                    {rebuilding ? (
                      <ActivityIndicator color="#ff5e00" />
                    ) : (
                      <>
                        <MaterialIcons name="build" size={18} color="#ff5e00" />
                        <Text className="text-claw-orange font-bold">Rebuild</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Action buttons */}
            <View className="flex-row gap-3 mb-4">
              {agent.deployment_status === "running" && health?.healthy && (
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
