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

const isWeb = Platform.OS === "web";

const STEPS = [
  { key: "identity", label: "Identity" },
  { key: "prompt", label: "Prompt" },
  { key: "model", label: "Model" },
  { key: "review", label: "Review" },
];

const MODEL_BRANDS: Record<string, string> = {
  "qwen3-coder-next": "Claw-Core",
  "glm-4.7": "Deep-Claw",
};

const DEFAULT_PROMPT = "You are a helpful AI assistant. Be concise and accurate.";

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

          {/* Step 2: System Prompt */}
          {step === 2 && (
            <View>
              <View className="flex-row items-center gap-2 mb-2">
                <MaterialIcons name="terminal" size={20} color="#ff5e00" />
                <Text className="text-xl font-bold text-text-primary">
                  System prompt
                </Text>
              </View>
              <Text className="text-sm text-text-secondary mb-6">
                Define your agent's personality and behavior directives.
              </Text>
              <TextInput
                className="bg-surface-base border border-surface-border rounded-xl px-4 py-3.5 text-base text-text-primary min-h-[180px] font-mono"
                placeholder="You are a helpful assistant..."
                placeholderTextColor="#5a5464"
                multiline
                textAlignVertical="top"
                value={systemPrompt}
                onChangeText={setSystemPrompt}
                autoFocus
              />
              <Text className="font-mono text-xs text-text-tertiary mt-2 text-right">
                {systemPrompt.length} chars
              </Text>
            </View>
          )}

          {/* Step 3: Model Selection */}
          {step === 3 && (
            <View>
              <View className="flex-row items-center gap-2 mb-2">
                <MaterialIcons name="psychology" size={20} color="#ff5e00" />
                <Text className="text-xl font-bold text-text-primary">
                  Neural Configuration
                </Text>
              </View>
              <Text className="text-sm text-text-secondary mb-6">
                Select the core inference model for your agent.
              </Text>
              <ModelSelector selected={model} onSelect={setModel} />
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

        {/* Spacer */}
        <View className="flex-1" />

        {/* Bottom Buttons */}
        <View className="flex-row items-center justify-between pt-4 pb-8 gap-4">
          {/* Back button */}
          <Pressable
            onPress={handleBack}
            className="flex-row items-center gap-1 py-3 px-2"
          >
            <MaterialIcons name="arrow-back" size={18} color="#8a8494" />
            <Text className="font-mono text-sm uppercase tracking-wider text-text-secondary">
              {step > 1 ? "Back" : "Cancel"}
            </Text>
          </Pressable>

          {/* Next / Deploy button */}
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
                Next
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
      </ScrollView>
    </>
  );
}
