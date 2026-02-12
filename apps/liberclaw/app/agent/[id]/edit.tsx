import { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";

import { useAgent, useUpdateAgent } from "@/lib/hooks/useAgents";
import { redeployAgent } from "@/lib/api/agents";
import { PROMPT_TEMPLATES } from "@/components/agent/SoulEditor";

const MAX_PROMPT_LENGTH = 2000;
const DESKTOP_BREAKPOINT = 1024;

function getRiskLevel(prompt: string): { label: string; color: string; bgColor: string } {
  const length = prompt.length;
  if (length < 400) {
    return { label: "Low", color: "#00e676", bgColor: "rgba(0, 230, 118, 0.1)" };
  }
  if (length < 1200) {
    return { label: "Medium", color: "#ff5e00", bgColor: "rgba(255, 94, 0, 0.1)" };
  }
  return { label: "High", color: "#ff003c", bgColor: "rgba(255, 0, 60, 0.1)" };
}

function generateLineNumbers(text: string): string[] {
  const lineCount = Math.max(text.split("\n").length, 15);
  return Array.from({ length: lineCount }, (_, i) => String(i + 1));
}

export default function EditAgentScreen(): React.JSX.Element {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: agent, isLoading } = useAgent(id!);
  const updateAgent = useUpdateAgent();
  const { width } = useWindowDimensions();

  const isWeb = Platform.OS === "web";
  const isDesktop = isWeb && width >= DESKTOP_BREAKPOINT;

  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState("qwen3-coder-next");
  const [error, setError] = useState<string | null>(null);
  const [isRedeploying, setIsRedeploying] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setSystemPrompt(agent.system_prompt);
      setModel(agent.model);
    }
  }, [agent]);

  const lineNumbers = useMemo(() => generateLineNumbers(systemPrompt), [systemPrompt]);
  const risk = useMemo(() => getRiskLevel(systemPrompt), [systemPrompt]);

  async function handleSave(): Promise<void> {
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

  async function handleRedeploy(): Promise<void> {
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

  function handleTemplateSelect(template: typeof PROMPT_TEMPLATES[number]): void {
    setSelectedTemplate(template.label);
    setSystemPrompt(template.prompt);
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

  // -- Template Sidebar (desktop only) --
  function renderSidebar(): React.JSX.Element {
    return (
      <View
        className="border-r border-surface-border"
        style={[
          { width: 288 },
          isWeb && {
            // @ts-expect-error -- web-only CSS property
            background:
              "linear-gradient(180deg, rgba(19,16,24,0.95) 0%, rgba(10,8,16,0.98) 100%)",
          },
        ]}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20 }}
        >
          {/* Section header */}
          <Text className="font-mono text-[10px] uppercase tracking-widest text-text-secondary mb-1">
            Library
          </Text>
          <Text className="text-xl font-bold text-text-primary mb-5">
            Templates
          </Text>

          {/* Template items */}
          <View className="gap-2">
            {PROMPT_TEMPLATES.map((template) => {
              const isSelected = selectedTemplate === template.label;
              return (
                <Pressable
                  key={template.label}
                  onPress={() => handleTemplateSelect(template)}
                  className={`rounded-card p-3.5 ${
                    isSelected
                      ? "bg-claw-orange/20 border border-claw-orange/40"
                      : "bg-slate-800/40 border border-slate-700"
                  }`}
                >
                  <View className="flex-row items-center justify-between mb-1.5">
                    <Text
                      className={`text-sm font-semibold ${
                        isSelected ? "text-claw-orange" : "text-text-primary"
                      }`}
                    >
                      {template.label}
                    </Text>
                    <MaterialIcons
                      name={template.icon}
                      size={18}
                      color={isSelected ? "#ff5e00" : "#8a8494"}
                    />
                  </View>
                  <Text
                    className="text-xs text-text-secondary leading-relaxed"
                    numberOfLines={2}
                  >
                    {template.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Create Template button */}
          <Pressable className="mt-4 rounded-card border border-dashed border-surface-border p-3.5 items-center justify-center">
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="add" size={18} color="#5a5464" />
              <Text className="text-sm text-text-tertiary font-medium">
                Create Template
              </Text>
            </View>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // -- Mobile template pills --
  function renderMobileTemplates(): React.JSX.Element {
    return (
      <View className="mb-4">
        <Text className="font-mono text-[10px] uppercase tracking-widest text-text-secondary mb-2 px-4">
          Templates
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {PROMPT_TEMPLATES.map((template) => {
            const isSelected = selectedTemplate === template.label;
            return (
              <Pressable
                key={template.label}
                onPress={() => handleTemplateSelect(template)}
                className={`rounded-full px-4 py-2 flex-row items-center gap-2 ${
                  isSelected
                    ? "bg-claw-orange/20 border border-claw-orange/40"
                    : "bg-surface-overlay border border-surface-border"
                }`}
              >
                <MaterialIcons
                  name={template.icon}
                  size={14}
                  color={isSelected ? "#ff5e00" : "#8a8494"}
                />
                <Text
                  className={`text-xs font-semibold ${
                    isSelected ? "text-claw-orange" : "text-text-secondary"
                  }`}
                >
                  {template.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // -- Editor header bar --
  function renderEditorHeader(): React.JSX.Element {
    return (
      <View className="flex-row items-center justify-between px-5 py-4 border-b border-surface-border bg-surface-raised">
        <View className="flex-row items-center gap-3">
          {/* Agent icon with gradient */}
          <View
            style={[
              {
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: "#ff5e00",
                alignItems: "center",
                justifyContent: "center",
              },
              isWeb && {
                // @ts-expect-error -- web-only CSS properties
                background: "linear-gradient(135deg, #ff5e00, #dc2626)",
                boxShadow: "0 0 12px rgba(255,94,0,0.3)",
              },
            ]}
          >
            <MaterialIcons name="psychology" size={22} color="#ffffff" />
          </View>
          <View>
            <View className="flex-row items-center gap-2">
              <Text className="text-lg font-bold text-text-primary">
                Agent Soul
              </Text>
              <View className="bg-surface-overlay border border-surface-border rounded-full px-2 py-0.5">
                <Text className="font-mono text-[10px] text-text-secondary">
                  v2.4
                </Text>
              </View>
            </View>
            <Text className="text-xs text-text-secondary">
              editing{" "}
              <Text className="text-claw-orange font-medium">
                @{name || "Agent"}
              </Text>
            </Text>
          </View>
        </View>

        {/* Last saved indicator */}
        <View className="flex-row items-center gap-1.5">
          <View
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: "#00e676" }}
          />
          <Text className="text-xs text-text-secondary">
            Last saved: 2 mins ago
          </Text>
        </View>
      </View>
    );
  }

  // -- Line numbers column (web only) --
  function renderLineNumbers(): React.JSX.Element {
    return (
      <View
        className="absolute top-0 bottom-0 left-0 border-r border-surface-border"
        style={{
          width: 48,
          backgroundColor: "#08060e",
        }}
      >
        <View className="py-4 pr-3">
          {lineNumbers.map((num) => (
            <Text
              key={num}
              className="font-mono text-right leading-6"
              style={{ fontSize: 13, color: "#3a3444" }}
            >
              {num}
            </Text>
          ))}
        </View>
      </View>
    );
  }

  // -- Editor area --
  function renderEditor(): React.JSX.Element {
    return (
      <View className="flex-1" style={{ backgroundColor: "#0d0d12" }}>
        <View className="relative flex-1" style={{ minHeight: isDesktop ? 400 : 240 }}>
          {isDesktop && renderLineNumbers()}
          <TextInput
            className="flex-1 font-mono text-sm text-slate-300"
            style={[
              {
                paddingTop: 16,
                paddingBottom: 16,
                paddingRight: 16,
                paddingLeft: isDesktop ? 64 : 16,
                lineHeight: 24,
                textAlignVertical: "top",
              },
              isWeb && {
                // @ts-expect-error -- web-only CSS property
                outline: "none",
              },
            ]}
            placeholderTextColor="#3a3444"
            placeholder="Define your agent's personality and behavior..."
            multiline
            textAlignVertical="top"
            value={systemPrompt}
            onChangeText={(text) => {
              if (text.length <= MAX_PROMPT_LENGTH) {
                setSystemPrompt(text);
              }
            }}
          />

          {/* Insert Variable floating button */}
          <Pressable
            className="absolute bottom-4 right-4 bg-surface-overlay border border-surface-border rounded-lg px-3 py-2 flex-row items-center gap-1.5"
            style={[
              isWeb && {
                // @ts-expect-error -- web-only CSS property
                backdropFilter: "blur(8px)",
              },
            ]}
          >
            <MaterialIcons name="data-object" size={14} color="#8a8494" />
            <Text className="text-xs text-text-secondary font-medium">
              Insert Variable
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // -- Footer bar --
  function renderFooter(): React.JSX.Element {
    const isSaving = updateAgent.isPending;
    const canSave = name.trim().length > 0 && systemPrompt.trim().length > 0;

    return (
      <View
        className="border-t border-surface-border bg-surface-raised"
        style={{ height: isDesktop ? 80 : undefined }}
      >
        <View
          className={`flex-1 px-5 ${
            isDesktop
              ? "flex-row items-center justify-between"
              : "py-4 gap-4"
          }`}
        >
          {/* Left side: char counter + risk */}
          <View className={`flex-row items-center gap-3 ${isDesktop ? "" : "justify-between"}`}>
            {/* Character counter */}
            <View className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5">
              <Text className="font-mono text-xs text-text-secondary">
                {systemPrompt.length}
                <Text className="text-text-tertiary"> / {MAX_PROMPT_LENGTH}</Text>
              </Text>
            </View>

            {/* Risk level */}
            <View
              className="flex-row items-center gap-1.5 rounded-lg px-3 py-1.5"
              style={{ backgroundColor: risk.bgColor }}
            >
              <MaterialIcons name="warning" size={14} color={risk.color} />
              <Text className="text-xs font-medium" style={{ color: risk.color }}>
                Risk Level: {risk.label}
              </Text>
            </View>
          </View>

          {/* Right side: Cancel + Redeploy */}
          <View className="flex-row items-center gap-3">
            <Pressable
              className="px-4 py-2.5"
              onPress={() => router.back()}
            >
              <Text className="text-sm font-medium text-text-secondary">
                Cancel
              </Text>
            </Pressable>

            <Pressable
              className={`bg-claw-orange rounded-lg px-5 py-2.5 flex-row items-center gap-2 ${
                !canSave || isSaving || isRedeploying ? "opacity-50" : "active:bg-claw-orange-dark"
              }`}
              onPress={async () => {
                await handleSave();
                if (!error) {
                  await handleRedeploy();
                }
              }}
              disabled={!canSave || isSaving || isRedeploying}
            >
              {isSaving || isRedeploying ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <MaterialIcons name="rocket-launch" size={16} color="#ffffff" />
                  <Text className="text-sm font-semibold text-white">
                    Redeploy Agent
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // -- Error banner --
  function renderError(): React.JSX.Element | null {
    if (!error) return null;
    return (
      <View className="bg-claw-red/10 border border-claw-red/25 px-5 py-3">
        <Text className="text-claw-red text-sm">{error}</Text>
      </View>
    );
  }

  // -- Main content (editor column) --
  function renderMainContent(): React.JSX.Element {
    return (
      <View className="flex-1 bg-surface-base">
        {renderEditorHeader()}
        {renderError()}
        {!isDesktop && renderMobileTemplates()}
        {renderEditor()}
        {renderFooter()}
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: !isDesktop,
          title: "Edit Agent",
          headerStyle: { backgroundColor: "#0a0810" },
          headerTintColor: "#ff5e00",
          headerTitleStyle: { fontWeight: "700", color: "#f0ede8" },
        }}
      />

      <View className={`flex-1 bg-surface-base ${isDesktop ? "flex-row" : ""}`}>
        {isDesktop && renderSidebar()}
        {renderMainContent()}
      </View>
    </>
  );
}
