import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter, Stack } from "expo-router";
import { useCreateAgent } from "@/lib/hooks/useAgents";
import ModelSelector from "@/components/agent/ModelSelector";
import SoulEditor from "@/components/agent/SoulEditor";

const isWeb = Platform.OS === "web";

const STEPS = [
  { key: "identity", label: "Identity" },
  { key: "capabilities", label: "Capabilities" },
  { key: "model", label: "Model" },
  { key: "review", label: "Review" },
];

const MODEL_BRANDS: Record<string, string> = {
  "qwen3-coder-next": "Claw-Core",
  "glm-4.7": "Deep-Claw",
};

const DEFAULT_PROMPT = "You are a helpful AI assistant. Be concise and accurate.";

function DeploymentPreview({ name, model }: { name: string; model: string }): React.JSX.Element {
  const brand = MODEL_BRANDS[model] ?? model;
  const initial = name ? name.charAt(0).toUpperCase() : "L";

  return (
    <View
      className="rounded-3xl overflow-hidden relative"
      style={isWeb ? {
        background: "linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(255,94,0,0.3)",
        boxShadow: "0 0 15px rgba(255,94,0,0.1)",
      } as any : {
        backgroundColor: "#131018",
        borderWidth: 1,
        borderColor: "#2a2235",
        borderRadius: 24,
      }}
    >
      {/* Map grid + scan line background */}
      {isWeb && (
        <>
          <View className="absolute inset-0 map-grid" style={{ opacity: 0.5 } as any} />
          <View className="scan-line" />
        </>
      )}

      <View className="relative p-6" style={{ zIndex: 10 }}>
        <Text className="text-lg font-bold text-white uppercase mb-6 pb-4 border-b border-white/10">
          Deployment Preview
        </Text>

        {/* Agent info card */}
        <View className="bg-surface-raised/80 border border-white/10 rounded-xl p-4 mb-6" style={isWeb ? { backdropFilter: "blur(8px)" } as any : undefined}>
          <View className="flex-row items-center gap-3 mb-4">
            <View
              className="w-12 h-12 rounded-lg items-center justify-center"
              style={[
                { backgroundColor: "#ff5e00" },
                isWeb && { background: "linear-gradient(135deg, #ff5e00, #dc2626)", boxShadow: "0 0 12px rgba(255,94,0,0.3)" } as any,
              ]}
            >
              <Text className="text-white font-bold text-xl">{initial}</Text>
            </View>
            <View>
              <Text className="text-white font-bold">{name || "Agent-01"}</Text>
              <Text className="text-[10px] text-text-tertiary font-mono">ID: 0x8a...2b9c</Text>
            </View>
          </View>
          <View className="gap-3">
            <View className="flex-row justify-between">
              <Text className="text-text-tertiary text-xs font-mono">Role:</Text>
              <Text className="text-text-primary text-xs font-mono">Trader / Analyst</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-text-tertiary text-xs font-mono">Model:</Text>
              <Text className="text-claw-orange text-xs font-mono">{brand}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-text-tertiary text-xs font-mono">Network:</Text>
              <Text className="text-claw-orange text-xs font-mono">LiberClaw Mainnet</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-text-tertiary text-xs font-mono">Est. Cost:</Text>
              <Text className="text-text-primary text-xs font-mono">0.04 ETH / day</Text>
            </View>
          </View>
        </View>

        {/* Initialization sequence */}
        <Text className="text-xs font-bold text-text-tertiary uppercase mb-3">Initialization Sequence</Text>
        <View className="gap-3 mb-6">
          {[
            { done: true, label: "Wallet Connected" },
            { done: true, label: "Permissions Granted" },
            { done: false, active: true, label: "Deploying to Decentralized Substrate..." },
            { done: false, active: false, label: "Live Activation" },
          ].map((item, i) => (
            <View key={i} className="flex-row items-center gap-3" style={{ opacity: !item.done && !item.active ? 0.5 : 1 }}>
              <View className={`w-5 h-5 rounded-full items-center justify-center ${item.done ? "bg-claw-orange/20" : "bg-white/10 border border-white/10"}`}>
                {item.done ? (
                  <MaterialIcons name="check" size={12} color="#ff5e00" />
                ) : item.active ? (
                  <View className="w-1.5 h-1.5 bg-claw-orange rounded-full" />
                ) : null}
              </View>
              <Text className={`text-xs ${item.active ? "text-white font-bold" : item.done ? "text-text-secondary" : "text-text-tertiary"}`}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Mini terminal */}
        <View className="bg-black/50 rounded-lg p-3 border border-white/5 mb-6">
          <Text className="font-mono text-[10px] text-text-tertiary">{">"} init_claw_protocol()</Text>
          <Text className="font-mono text-[10px] text-text-tertiary">{">"} allocating_resources...</Text>
          <Text className="font-mono text-[10px] text-claw-orange">{">"} waiting for confirmation_</Text>
        </View>

        {/* Notice */}
        <View className="flex-row gap-3 p-3 bg-claw-orange/10 border border-claw-orange/20 rounded-lg">
          <MaterialIcons name="info-outline" size={14} color="#ff5e00" style={{ marginTop: 2 }} />
          <Text className="text-[10px] text-text-secondary leading-tight flex-1">
            By deploying this agent, you agree to the LiberClaw autonomous execution protocols.
          </Text>
        </View>
      </View>
    </View>
  );
}

function ExecutionParams(): React.JSX.Element {
  return (
    <View className="mt-8 pt-8 border-t border-surface-border">
      <Text className="font-mono text-xs text-text-tertiary uppercase tracking-wider mb-6">Execution Parameters</Text>
      <View className="gap-6">
        <View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-sm font-bold text-text-primary">Aggression Level</Text>
            <Text className="text-claw-orange font-mono text-sm">75%</Text>
          </View>
          <View className="relative h-2 bg-surface-raised rounded-full">
            <View className="h-full bg-claw-orange rounded-full" style={{ width: "75%" }} />
            <View
              className="absolute w-4 h-4 rounded-full bg-slate-300 border-2 border-surface-base"
              style={{ top: -3, left: "73%", boxShadow: isWeb ? "0 0 6px rgba(0,0,0,0.3)" : undefined } as any}
            />
          </View>
        </View>
        <View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-sm font-bold text-text-primary">Autonomy Threshold</Text>
            <Text className="text-claw-orange font-mono text-sm">92%</Text>
          </View>
          <View className="relative h-2 bg-surface-raised rounded-full">
            <View className="h-full bg-claw-orange rounded-full" style={{ width: "92%" }} />
            <View
              className="absolute w-4 h-4 rounded-full bg-slate-300 border-2 border-surface-base"
              style={{ top: -3, left: "90%", boxShadow: isWeb ? "0 0 6px rgba(0,0,0,0.3)" : undefined } as any}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

export default function CreateAgentScreen() {
  const router = useRouter();
  const createAgent = useCreateAgent();

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_PROMPT);
  const [model, setModel] = useState("qwen3-coder-next");
  const [error, setError] = useState<string | null>(null);

  function canProceed(): boolean {
    switch (step) {
      case 1: return name.trim().length > 0;
      case 2: return systemPrompt.trim().length > 0;
      case 3: return true;
      case 4: return true;
      default: return false;
    }
  }

  function handleNext(): void {
    if (step < 4) setStep(step + 1);
  }

  function handleBack(): void {
    if (step > 1) setStep(step - 1);
    else router.back();
  }

  async function handleCreate(): Promise<void> {
    setError(null);
    try {
      const agent = await createAgent.mutateAsync({
        name: name.trim(),
        system_prompt: systemPrompt.trim(),
        model,
      });
      router.replace(`/agent/${agent.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    }
  }

  const progressPercent = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <ScrollView
        className="flex-1 bg-surface-base"
        contentContainerStyle={{ padding: 24, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Background effects (web) */}
        {isWeb && (
          <>
            <View className="absolute inset-0 hero-glow pointer-events-none" style={{ zIndex: 0, position: 'fixed' } as any} />
            <View className="absolute inset-0 carbon-fiber pointer-events-none" style={{ zIndex: 0, position: 'fixed' } as any} />
          </>
        )}

        {/* Title */}
        <View className="items-center mb-8 mt-4">
          <View className="flex-row items-center justify-center mb-3">
            <Text className="text-2xl font-bold text-white tracking-widest uppercase">
              Initialize{" "}
            </Text>
            <Text className="text-2xl font-bold text-claw-orange tracking-widest uppercase">
              New Agent
            </Text>
          </View>
          <Text className="font-mono text-xs text-slate-400 text-center leading-relaxed max-w-md">
            Configure your autonomous entity for deployment on the LiberClaw
            decentralized substrate.
          </Text>
        </View>

        {/* Wizard Progress */}
        <View className="mb-10">
          <View className="relative">
            {/* Connecting line background */}
            <View className="absolute top-5 left-5 right-5 h-1 bg-white/10 rounded-full" />
            {/* Connecting line filled */}
            <View
              className="absolute top-5 left-5 h-1 bg-claw-orange rounded-full"
              style={[
                { width: `${progressPercent}%` },
                isWeb
                  ? ({ backgroundImage: "linear-gradient(to right, #ff5e00, #ff003c)", boxShadow: "0 0 12px rgba(255,94,0,0.5)" } as any)
                  : {},
              ]}
            />
            {/* Step circles */}
            <View className="flex-row justify-between">
              {STEPS.map((s, i) => {
                const stepNum = i + 1;
                const isCompleted = stepNum < step;
                const isCurrent = stepNum === step;
                return (
                  <View key={s.key} className="items-center" style={{ width: 70 }}>
                    <View
                      className={[
                        "w-10 h-10 rounded-full items-center justify-center",
                        isCompleted
                          ? "bg-claw-orange border-2 border-claw-orange"
                          : isCurrent
                            ? "bg-surface-base border-2 border-claw-orange"
                            : "bg-surface-base border-2 border-white/20",
                      ].join(" ")}
                      style={
                        isCompleted && isWeb
                          ? { boxShadow: "0 0 12px rgba(255,94,0,0.5)" }
                          : undefined
                      }
                    >
                      {isCompleted ? (
                        <MaterialIcons name="check" size={18} color="#ffffff" />
                      ) : (
                        <Text
                          className={[
                            "font-mono text-sm font-bold",
                            isCurrent ? "text-claw-orange" : "text-slate-500",
                          ].join(" ")}
                        >
                          {String(stepNum).padStart(2, "0")}
                        </Text>
                      )}
                    </View>
                    <Text
                      className={[
                        "font-mono text-[10px] uppercase tracking-wider mt-2",
                        isCompleted || isCurrent
                          ? "text-claw-orange font-bold"
                          : "text-slate-500",
                      ].join(" ")}
                    >
                      {s.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {error && (
          <View className="bg-claw-red/10 border border-claw-red/25 p-3 rounded-lg mb-4">
            <Text className="text-claw-red text-sm">{error}</Text>
          </View>
        )}

        {/* 2-column layout on desktop */}
        <View
          style={isWeb ? { display: "grid" as any, gridTemplateColumns: "2fr 1fr", gap: 24 } as any : undefined}
        >
          {/* Left column — main form */}
          <View>
            {/* Step Content — glass widget on web */}
            <View
              className={[
                "rounded-3xl p-6 mb-6",
                isWeb
                  ? "border border-claw-orange/30"
                  : "bg-surface-raised border border-surface-border",
              ].join(" ")}
              style={
                isWeb
                  ? ({
                      backgroundImage: "linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)",
                      backdropFilter: "blur(24px)",
                      WebkitBackdropFilter: "blur(24px)",
                      boxShadow: "0 0 15px rgba(255,94,0,0.1)",
                    } as any)
                  : undefined
              }
            >
              {/* Step 1: Identity */}
              {step === 1 && (
                <View>
                  <View className="flex-row items-center gap-2 mb-2">
                    <MaterialIcons name="badge" size={20} color="#ff5e00" />
                    <Text className="text-xl font-bold text-text-primary">
                      Name your agent
                    </Text>
                  </View>
                  <Text className="text-sm text-text-secondary mb-6">
                    Choose a memorable designation for your autonomous entity.
                  </Text>
                  <TextInput
                    className="bg-surface-base border border-surface-border rounded-xl px-4 py-3.5 text-base text-text-primary"
                    placeholder="e.g., Research Assistant"
                    placeholderTextColor="#5a5464"
                    value={name}
                    onChangeText={setName}
                    autoFocus
                    maxLength={50}
                  />
                  <Text className="font-mono text-xs text-text-tertiary mt-2 text-right">
                    {name.length}/50
                  </Text>
                </View>
              )}

              {/* Step 2: Agent Soul — prompt with templates */}
              {step === 2 && (
                <View>
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-2">
                      <MaterialIcons name="psychology" size={20} color="#ff5e00" />
                      <Text className="text-xl font-bold text-text-primary">
                        Agent Soul
                      </Text>
                    </View>
                    <View className="bg-surface-overlay border border-surface-border rounded-full px-2 py-0.5">
                      <Text className="font-mono text-[10px] text-text-secondary">v2.4</Text>
                    </View>
                  </View>
                  <Text className="text-sm text-text-secondary mb-4">
                    Pick a template or define your agent's personality and behavior.
                  </Text>
                  <SoulEditor
                    value={systemPrompt}
                    onChangeText={setSystemPrompt}
                    minHeight={isWeb ? 240 : 180}
                  />
                </View>
              )}

              {/* Step 3: Model Selection + Execution Params */}
              {step === 3 && (
                <View>
                  <View className="flex-row items-center justify-between mb-6">
                    <View className="flex-row items-center gap-2">
                      <MaterialIcons name="psychology" size={20} color="#ff5e00" />
                      <Text className="text-xl font-black text-text-primary uppercase">
                        Neural Configuration
                      </Text>
                    </View>
                    {isWeb && (
                      <View className="flex-row items-center gap-1.5 px-3 py-1 rounded-full border border-status-running/30 bg-status-running/10">
                        <View className="w-2 h-2 rounded-full bg-status-running" />
                        <Text className="text-[10px] font-mono font-bold text-status-running uppercase tracking-wider">Substrate Ready</Text>
                      </View>
                    )}
                  </View>
                  <Text className="font-mono text-xs text-text-tertiary uppercase tracking-wider mb-6">
                    Select Core Logic Model
                  </Text>
                  <ModelSelector selected={model} onSelect={setModel} />
                  <ExecutionParams />
                </View>
              )}

              {/* Step 4: Review */}
              {step === 4 && (
                <View>
                  <View className="flex-row items-center gap-2 mb-6">
                    <MaterialIcons name="rocket-launch" size={20} color="#ff5e00" />
                    <Text className="text-xl font-bold text-text-primary">
                      Review &amp; Deploy
                    </Text>
                  </View>

                  <View className="bg-surface-base border border-surface-border rounded-xl p-4 mb-3">
                    <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
                      Agent Name
                    </Text>
                    <Text className="text-base text-text-primary font-semibold">
                      {name}
                    </Text>
                  </View>

                  <View className="bg-surface-base border border-surface-border rounded-xl p-4 mb-3">
                    <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
                      Model
                    </Text>
                    <Text className="text-base text-text-primary font-semibold">
                      {MODEL_BRANDS[model] ?? model}
                    </Text>
                    <Text className="font-mono text-xs text-claw-orange mt-0.5">
                      {model}
                    </Text>
                  </View>

                  <View className="bg-surface-base border border-surface-border rounded-xl p-4 mb-3">
                    <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
                      System Prompt
                    </Text>
                    <Text
                      className="text-sm text-text-secondary mt-1 leading-relaxed font-mono"
                      numberOfLines={6}
                    >
                      {systemPrompt}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Bottom Buttons */}
            <View className="flex-row items-center justify-between pt-4 pb-8 gap-4">
              <Pressable
                onPress={handleBack}
                className="flex-row items-center gap-1 py-3 px-2"
              >
                <MaterialIcons name="arrow-back" size={18} color="#8a8494" />
                <Text className="font-mono text-sm uppercase tracking-wider text-text-secondary">
                  {step > 1 ? "Back" : "Cancel"}
                </Text>
              </Pressable>

              {step < 4 ? (
                <Pressable
                  className={[
                    "flex-row items-center justify-center gap-2 rounded-xl py-3.5 px-8",
                    canProceed()
                      ? "bg-claw-orange active:bg-claw-orange-dark"
                      : "bg-surface-border",
                  ].join(" ")}
                  onPress={handleNext}
                  disabled={!canProceed()}
                  style={
                    canProceed() && isWeb
                      ? { boxShadow: "0 0 20px rgba(255,94,0,0.4)" }
                      : undefined
                  }
                >
                  <Text
                    className={[
                      "font-bold text-base uppercase tracking-wider",
                      canProceed() ? "text-white" : "text-text-tertiary",
                    ].join(" ")}
                  >
                    {step === 3 ? "Review & Deploy" : "Next"}
                  </Text>
                  <MaterialIcons
                    name="arrow-forward"
                    size={18}
                    color={canProceed() ? "#ffffff" : "#5a5464"}
                  />
                </Pressable>
              ) : (
                <Pressable
                  className="bg-claw-orange active:bg-claw-orange-dark rounded-xl py-3.5 px-8 flex-row items-center justify-center gap-2"
                  onPress={handleCreate}
                  disabled={createAgent.isPending}
                  style={
                    isWeb
                      ? { boxShadow: "0 0 20px rgba(255,94,0,0.4)" }
                      : undefined
                  }
                >
                  {createAgent.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <MaterialIcons name="rocket-launch" size={18} color="#ffffff" />
                      <Text className="text-white font-bold text-base uppercase tracking-wider">
                        Deploy
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </View>

          {/* Right column — deployment preview (desktop only) */}
          {isWeb && (
            <DeploymentPreview name={name} model={model} />
          )}
        </View>
      </ScrollView>
    </>
  );
}
