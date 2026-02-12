import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { useAgent, useUpdateAgent } from "@/lib/hooks/useAgents";
import { redeployAgent } from "@/lib/api/agents";

const MODELS = [
  { id: "qwen3-coder-next", label: "Claw-Core", subtitle: "qwen3-coder-next" },
  { id: "glm-4.7", label: "Deep-Claw", subtitle: "glm-4.7" },
];

const PROMPT_TEMPLATES = [
  {
    label: "Expert Coder",
    prompt:
      "You are an expert software engineer. Write clean, efficient code. Explain your reasoning.",
  },
  {
    label: "Creative Writer",
    prompt:
      "You are a creative writer. Craft engaging, original content with vivid storytelling.",
  },
  {
    label: "Research Analyst",
    prompt:
      "You are a research analyst. Provide thorough, evidence-based analysis with citations.",
  },
  {
    label: "Task Assistant",
    prompt:
      "You are a helpful task assistant. Be concise, accurate, and proactive.",
  },
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
  const [isRedeploying, setIsRedeploying] = useState(false);

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setSystemPrompt(agent.system_prompt);
      setModel(agent.model);
    }
  }, [agent]);

  async function handleSave() {
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
  }

  async function handleRedeploy() {
    setError(null);
    setIsRedeploying(true);
    try {
      await redeployAgent(id!);
      router.back();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to redeploy agent",
      );
    } finally {
      setIsRedeploying(false);
    }
  }

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: "Edit Agent",
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

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Edit Agent",
          headerStyle: { backgroundColor: "#0a0810" },
          headerTintColor: "#ff5e00",
          headerTitleStyle: { fontWeight: "700", color: "#f0ede8" },
        }}
      />
      <ScrollView
        className="flex-1 bg-surface-base"
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {error && (
          <View className="bg-claw-red/10 border border-claw-red/25 p-3 rounded-card mb-4">
            <Text className="text-claw-red text-sm">{error}</Text>
          </View>
        )}

        {/* Name */}
        <View className="mb-6">
          <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary mb-2">
            Name
          </Text>
          <TextInput
            className="bg-surface-raised border border-surface-border rounded-card px-4 py-3 text-base text-text-primary"
            placeholderTextColor="#5a5464"
            value={name}
            onChangeText={setName}
            maxLength={50}
          />
          <Text className="font-mono text-xs text-text-tertiary mt-1 text-right">
            {name.length}/50
          </Text>
        </View>

        {/* System Prompt */}
        <View className="mb-6">
          <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary mb-2">
            System Prompt
          </Text>

          {/* Template suggestions */}
          <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary mb-2">
            Templates
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-3">
            {PROMPT_TEMPLATES.map((template) => (
              <Pressable
                key={template.label}
                className="bg-surface-overlay border border-surface-border rounded-full px-3 py-1.5"
                onPress={() => setSystemPrompt(template.prompt)}
              >
                <Text className="text-xs text-text-secondary">
                  {template.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            className="font-mono bg-surface-raised border border-surface-border rounded-card px-4 py-3 text-base text-text-primary min-h-[160px]"
            placeholderTextColor="#5a5464"
            multiline
            textAlignVertical="top"
            value={systemPrompt}
            onChangeText={setSystemPrompt}
          />
          <Text className="font-mono text-xs text-text-tertiary mt-1 text-right">
            {systemPrompt.length} chars
          </Text>
        </View>

        {/* Model */}
        <View className="mb-6">
          <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary mb-2">
            Model
          </Text>
          {MODELS.map((m) => (
            <TouchableOpacity
              key={m.id}
              className={`rounded-card p-4 mb-2 border ${
                model === m.id
                  ? "border-claw-orange bg-claw-orange/5"
                  : "border-surface-border bg-surface-raised"
              }`}
              onPress={() => setModel(m.id)}
            >
              <Text
                className={`text-base font-bold ${
                  model === m.id ? "text-claw-orange" : "text-text-primary"
                }`}
              >
                {m.label}
              </Text>
              <Text className="font-mono text-xs text-text-secondary mt-0.5">
                {m.subtitle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Spacer */}
        <View className="flex-1" />

        {/* Save */}
        <TouchableOpacity
          className="bg-claw-orange active:bg-claw-orange-dark rounded-lg py-3 items-center mb-4"
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

        {/* Redeploy */}
        <TouchableOpacity
          className="bg-surface-raised border border-claw-orange rounded-lg py-3 items-center flex-row justify-center gap-2 mb-4"
          onPress={handleRedeploy}
          disabled={isRedeploying}
        >
          {isRedeploying ? (
            <ActivityIndicator color="#ff5e00" />
          ) : (
            <>
              <MaterialIcons name="rocket-launch" size={18} color="#ff5e00" />
              <Text className="text-claw-orange font-semibold text-base">
                Redeploy Agent
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}
