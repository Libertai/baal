import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useCreateAgent } from "@/lib/hooks/useAgents";

const MODELS = [
  { id: "qwen3-coder-next", label: "Qwen3 Coder Next", description: "98K context, strong at coding" },
  { id: "glm-4.7", label: "GLM 4.7", description: "128K context, general purpose" },
];

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

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

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
          headerLeft: () => (
            <TouchableOpacity onPress={handleBack} className="pr-4">
              <Text className="text-blue-600 text-base">Back</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        className="flex-1 bg-gray-50 dark:bg-gray-950"
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress indicator */}
        <View className="flex-row mb-8">
          {[1, 2, 3, 4].map((s) => (
            <View key={s} className="flex-1 mx-1">
              <View
                className={`h-1 rounded-full ${
                  s <= step ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"
                }`}
              />
              <Text className="text-xs text-gray-400 mt-1 text-center">
                {s === 1 ? "Name" : s === 2 ? "Prompt" : s === 3 ? "Model" : "Review"}
              </Text>
            </View>
          ))}
        </View>

        {error && (
          <View className="bg-red-50 dark:bg-red-900/30 p-3 rounded-lg mb-4">
            <Text className="text-red-600 dark:text-red-400 text-sm">{error}</Text>
          </View>
        )}

        {/* Step 1: Name */}
        {step === 1 && (
          <View>
            <Text className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Name your agent
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Choose a memorable name for your AI agent.
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-base text-gray-900 dark:text-white bg-white dark:bg-gray-900"
              placeholder="e.g., Research Assistant"
              placeholderTextColor="#9ca3af"
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={50}
            />
            <Text className="text-xs text-gray-400 mt-2 text-right">
              {name.length}/50
            </Text>
          </View>
        )}

        {/* Step 2: System Prompt */}
        {step === 2 && (
          <View>
            <Text className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              System prompt
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Tell your agent who it is and how to behave.
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-base text-gray-900 dark:text-white bg-white dark:bg-gray-900 min-h-[160px]"
              placeholder="You are a helpful assistant..."
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              value={systemPrompt}
              onChangeText={setSystemPrompt}
              autoFocus
            />
          </View>
        )}

        {/* Step 3: Model */}
        {step === 3 && (
          <View>
            <Text className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Choose a model
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Select the AI model for your agent.
            </Text>
            {MODELS.map((m) => (
              <TouchableOpacity
                key={m.id}
                className={`rounded-xl p-4 mb-3 border-2 ${
                  model === m.id
                    ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                }`}
                onPress={() => setModel(m.id)}
              >
                <Text
                  className={`text-base font-semibold ${
                    model === m.id
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-900 dark:text-white"
                  }`}
                >
                  {m.label}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {m.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <View>
            <Text className="text-xl font-bold text-gray-900 dark:text-white mb-6">
              Review your agent
            </Text>

            <View className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 mb-4">
              <Text className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                Name
              </Text>
              <Text className="text-base text-gray-900 dark:text-white">
                {name}
              </Text>
            </View>

            <View className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 mb-4">
              <Text className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                Model
              </Text>
              <Text className="text-base text-gray-900 dark:text-white">
                {MODELS.find((m) => m.id === model)?.label ?? model}
              </Text>
            </View>

            <View className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 mb-4">
              <Text className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                System Prompt
              </Text>
              <Text
                className="text-sm text-gray-700 dark:text-gray-300 mt-1"
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
            <TouchableOpacity
              className={`rounded-lg py-3 items-center ${
                canProceed() ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"
              }`}
              onPress={handleNext}
              disabled={!canProceed()}
            >
              <Text className="text-white font-semibold text-base">Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className="bg-blue-600 rounded-lg py-3 items-center"
              onPress={handleCreate}
              disabled={createAgent.isPending}
            >
              {createAgent.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-base">
                  Create Agent
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </>
  );
}
