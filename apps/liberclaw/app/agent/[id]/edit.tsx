import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { useAgent, useUpdateAgent } from "@/lib/hooks/useAgents";

const MODELS = [
  { id: "qwen3-coder-next", label: "Qwen3 Coder Next" },
  { id: "glm-4.7", label: "GLM 4.7" },
];

export default function EditAgentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: agent, isLoading } = useAgent(id!);
  const updateAgent = useUpdateAgent();

  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState("qwen3-coder-next");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setSystemPrompt(agent.system_prompt);
      setModel(agent.model);
    }
  }, [agent]);

  const handleSave = async () => {
    setError(null);
    try {
      await updateAgent.mutateAsync({
        id: id!,
        data: {
          name: name.trim(),
          system_prompt: systemPrompt.trim(),
          model,
        },
      });
      router.back();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update agent");
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Edit Agent" }} />
        <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Edit Agent" }} />
      <ScrollView
        className="flex-1 bg-gray-50 dark:bg-gray-950"
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {error && (
          <View className="bg-red-50 dark:bg-red-900/30 p-3 rounded-lg mb-4">
            <Text className="text-red-600 dark:text-red-400 text-sm">{error}</Text>
          </View>
        )}

        {/* Name */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Name
          </Text>
          <TextInput
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-base text-gray-900 dark:text-white bg-white dark:bg-gray-900"
            value={name}
            onChangeText={setName}
            maxLength={50}
          />
        </View>

        {/* System Prompt */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            System Prompt
          </Text>
          <TextInput
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-base text-gray-900 dark:text-white bg-white dark:bg-gray-900 min-h-[160px]"
            multiline
            textAlignVertical="top"
            value={systemPrompt}
            onChangeText={setSystemPrompt}
          />
        </View>

        {/* Model */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Model
          </Text>
          {MODELS.map((m) => (
            <TouchableOpacity
              key={m.id}
              className={`rounded-xl p-4 mb-2 border-2 ${
                model === m.id
                  ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
              }`}
              onPress={() => setModel(m.id)}
            >
              <Text
                className={`text-base font-medium ${
                  model === m.id
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-900 dark:text-white"
                }`}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Spacer */}
        <View className="flex-1" />

        {/* Save */}
        <TouchableOpacity
          className="bg-blue-600 rounded-lg py-3 items-center mb-8"
          onPress={handleSave}
          disabled={updateAgent.isPending || !name.trim() || !systemPrompt.trim()}
        >
          {updateAgent.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">
              Save Changes
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}
