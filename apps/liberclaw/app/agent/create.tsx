import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter, Stack } from "expo-router";
import { useCreateAgent } from "@/lib/hooks/useAgents";
import ModelSelector from "@/components/agent/ModelSelector";

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

  const canProceed = () => {
    switch (step) {
      case 1: return name.trim().length > 0;
      case 2: return systemPrompt.trim().length > 0;
      case 3: return true;
      case 4: return true;
      default: return false;
    }
  };

  const handleNext = () => { if (step < 4) setStep(step + 1); };
  const handleBack = () => { if (step > 1) setStep(step - 1); else router.back(); };

  const handleCreate = async () => {
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
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Create Agent",
          headerStyle: { backgroundColor: "#0a0810" },
          headerTintColor: "#f0ede8",
          headerTitleStyle: { fontWeight: "700", color: "#f0ede8" },
          headerLeft: () => (
            <Pressable onPress={handleBack} className="pr-4">
              <Text className="text-claw-orange text-base font-medium">Back</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        className="flex-1 bg-surface-base"
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress Wizard */}
        <View className="mb-10">
          <View className="relative">
            {/* Track */}
            <View className="absolute top-5 left-0 right-0 h-0.5 bg-surface-border" />
            <View
              className="absolute top-5 left-0 h-0.5 bg-claw-orange"
              style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
            />
            {/* Steps */}
            <View className="flex-row justify-between">
              {STEPS.map((s, i) => {
                const stepNum = i + 1;
                const isCompleted = stepNum < step;
                const isCurrent = stepNum === step;
                return (
                  <View key={s.key} className="items-center" style={{ width: 60 }}>
                    <View
                      className={`w-10 h-10 rounded-full items-center justify-center border-2 ${
                        isCompleted
                          ? "bg-claw-orange border-claw-orange"
                          : isCurrent
                          ? "bg-surface-base border-claw-orange"
                          : "bg-surface-base border-surface-border"
                      }`}
                    >
                      {isCompleted ? (
                        <MaterialIcons name="check" size={18} color="#ffffff" />
                      ) : (
                        <Text
                          className={`font-mono text-sm font-bold ${
                            isCurrent ? "text-claw-orange" : "text-text-tertiary"
                          }`}
                        >
                          {String(stepNum).padStart(2, "0")}
                        </Text>
                      )}
                    </View>
                    <Text
                      className={`font-mono text-[10px] uppercase tracking-wider mt-2 ${
                        isCompleted || isCurrent
                          ? "text-claw-orange font-bold"
                          : "text-text-tertiary"
                      }`}
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

        {/* Step 1: Identity */}
        {step === 1 && (
          <View>
            <Text className="text-xl font-bold text-text-primary mb-2">
              Name your agent
            </Text>
            <Text className="text-sm text-text-secondary mb-6">
              Choose a memorable name for your autonomous entity.
            </Text>
            <TextInput
              className="bg-surface-raised border border-surface-border rounded-lg px-4 py-3 text-base text-text-primary"
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
            <Text className="text-xl font-bold text-text-primary mb-2">
              System prompt
            </Text>
            <Text className="text-sm text-text-secondary mb-6">
              Define your agent's personality and behavior directives.
            </Text>
            <TextInput
              className="bg-surface-raised border border-surface-border rounded-lg px-4 py-3 text-base text-text-primary min-h-[160px] font-mono"
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
            <Text className="text-xl font-bold text-text-primary mb-2">
              Neural Configuration
            </Text>
            <Text className="text-sm text-text-secondary mb-6">
              Select the core logic model for your agent.
            </Text>
            <ModelSelector selected={model} onSelect={setModel} />
          </View>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <View>
            <Text className="text-xl font-bold text-text-primary mb-6">
              Review &amp; Deploy
            </Text>

            <View className="bg-surface-raised border border-surface-border rounded-card p-4 mb-4">
              <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
                Agent Name
              </Text>
              <Text className="text-base text-text-primary font-semibold">
                {name}
              </Text>
            </View>

            <View className="bg-surface-raised border border-surface-border rounded-card p-4 mb-4">
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

            <View className="bg-surface-raised border border-surface-border rounded-card p-4 mb-4">
              <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
                System Prompt
              </Text>
              <Text
                className="text-sm text-text-secondary mt-1 leading-relaxed"
                numberOfLines={6}
              >
                {systemPrompt}
              </Text>
            </View>
          </View>
        )}

        {/* Spacer */}
        <View className="flex-1" />

        {/* Bottom buttons */}
        <View className="pt-4 pb-8">
          {step < 4 ? (
            <Pressable
              className={`rounded-lg py-3.5 items-center flex-row justify-center gap-2 ${
                canProceed()
                  ? "bg-claw-orange active:bg-claw-orange-dark"
                  : "bg-surface-border"
              }`}
              onPress={handleNext}
              disabled={!canProceed()}
            >
              <Text
                className={`font-semibold text-base ${
                  canProceed() ? "text-white" : "text-text-tertiary"
                }`}
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
              className="bg-claw-orange active:bg-claw-orange-dark rounded-lg py-3.5 items-center flex-row justify-center gap-2"
              onPress={handleCreate}
              disabled={createAgent.isPending}
            >
              {createAgent.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="rocket-launch" size={18} color="#ffffff" />
                  <Text className="text-white font-bold text-base uppercase tracking-wider">
                    Deploy Agent
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
