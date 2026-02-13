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
import { useQueryClient } from "@tanstack/react-query";

import { useAgent, useUpdateAgent } from "@/lib/hooks/useAgents";
import { redeployAgent } from "@/lib/api/agents";
import { useSkills, useTemplates } from "@/lib/hooks/useTemplates";
import SoulEditor from "@/components/agent/SoulEditor";
import ModelSelector from "@/components/agent/ModelSelector";

const isWeb = Platform.OS === "web";
const MAX_PROMPT_LENGTH = 2000;

type TabKey = "soul" | "skills" | "parameters";

const TABS: { key: TabKey; label: string; icon: React.ComponentProps<typeof MaterialIcons>["name"] }[] = [
  { key: "soul", label: "Soul", icon: "psychology" },
  { key: "skills", label: "Skills", icon: "extension" },
  { key: "parameters", label: "Parameters", icon: "tune" },
];

function getRiskLevel(prompt: string): { label: string; color: string; bgColor: string } {
  const length = prompt.length;
  if (length < 400) return { label: "Low", color: "#00e676", bgColor: "rgba(0, 230, 118, 0.1)" };
  if (length < 1200) return { label: "Medium", color: "#ff5e00", bgColor: "rgba(255, 94, 0, 0.1)" };
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
  const queryClient = useQueryClient();
  const { data: skillsData } = useSkills();
  const { data: templatesData } = useTemplates();
  const { width } = useWindowDimensions();
  const isDesktop = isWeb && width >= 1024;

  const [tab, setTab] = useState<TabKey>("soul");
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState("qwen3-coder-next");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const allTemplates = (templatesData?.categories ?? []).flatMap(c => c.templates);
  const lineNumbers = useMemo(() => generateLineNumbers(systemPrompt), [systemPrompt]);
  const risk = useMemo(() => getRiskLevel(systemPrompt), [systemPrompt]);

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setSystemPrompt(agent.system_prompt);
      setModel(agent.model);
      setSelectedSkills(agent.skills ?? []);
    }
  }, [agent]);

  function selectTemplate(tmplId: string) {
    const tmpl = allTemplates.find(t => t.id === tmplId);
    if (!tmpl) return;
    if (selectedTemplateId === tmplId) {
      setSelectedTemplateId(null);
      return;
    }
    setSelectedTemplateId(tmplId);
    setModel(tmpl.model);
    setSelectedSkills([...tmpl.skills]);
    import("@/lib/api/templates").then(({ getTemplate }) =>
      getTemplate(tmplId).then(detail => {
        if (detail?.system_prompt) setSystemPrompt(detail.system_prompt);
      })
    );
  }

  function toggleSkill(skillId: string) {
    setSelectedSkills(prev =>
      prev.includes(skillId)
        ? prev.filter(s => s !== skillId)
        : [...prev, skillId]
    );
  }

  async function handleSaveAndRedeploy(): Promise<void> {
    setError(null);
    setSaving(true);
    try {
      await updateAgent.mutateAsync({
        id: id!,
        data: { name: name.trim(), system_prompt: systemPrompt.trim(), model, skills: selectedSkills },
      });
      // redeployAgent returns the agent with status "deploying"
      const updated = await redeployAgent(id!);
      // Write directly into cache so detail page sees "deploying" immediately
      queryClient.setQueryData(["agent", id], updated);
      router.back();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save or update agent");
      setSaving(false);
    }
  }

  async function handleSaveOnly(): Promise<void> {
    setError(null);
    setSaving(true);
    try {
      await updateAgent.mutateAsync({
        id: id!,
        data: { name: name.trim(), system_prompt: systemPrompt.trim(), model, skills: selectedSkills },
      });
      router.back();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  const canSave = name.trim().length > 0 && systemPrompt.trim().length > 0;
  const isRunning = agent?.deployment_status === "running";

  if (isLoading || !agent) {
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
          headerShown: false,
        }}
      />
      <View className="flex-1 bg-surface-base">
        {/* ── Header bar ─────────────────────────────────────────── */}
        <View
          className="flex-row items-center justify-between px-4 border-b border-surface-border"
          style={[
            { paddingTop: isWeb ? 12 : 52, paddingBottom: 12 },
            isWeb && { backgroundColor: "#08060e" },
          ]}
        >
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => router.back()} className="p-1">
              <MaterialIcons name="arrow-back" size={22} color="#f0ede8" />
            </Pressable>
            <View
              className="w-8 h-8 rounded-lg items-center justify-center"
              style={[
                { backgroundColor: "#ff5e00" },
                isWeb && {
                  // @ts-expect-error -- web-only
                  background: "linear-gradient(135deg, #ff5e00, #dc2626)",
                  boxShadow: "0 0 10px rgba(255,94,0,0.3)",
                },
              ]}
            >
              <MaterialIcons name="smart-toy" size={18} color="#ffffff" />
            </View>
            <View>
              <Text className="text-base font-bold text-text-primary">{name || agent.name}</Text>
              <Text className="text-[10px] text-text-tertiary font-mono">editing agent</Text>
            </View>
          </View>
          {/* Skills count badge in header */}
          {tab === "skills" && selectedSkills.length > 0 && (
            <View className="bg-claw-orange/20 rounded-full px-2 py-0.5">
              <Text className="text-claw-orange text-xs font-bold">{selectedSkills.length} skills</Text>
            </View>
          )}
        </View>

        {/* ── Tab bar ────────────────────────────────────────────── */}
        <View
          className="flex-row border-b border-surface-border"
          style={{ backgroundColor: "#0a0810" }}
        >
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                className="flex-1 flex-row items-center justify-center gap-2 py-3"
                style={active ? { borderBottomWidth: 2, borderBottomColor: "#ff5e00" } : undefined}
              >
                <MaterialIcons
                  name={t.icon}
                  size={16}
                  color={active ? "#ff5e00" : "#5a5464"}
                />
                <Text
                  className={`text-sm font-semibold ${active ? "text-claw-orange" : "text-text-tertiary"}`}
                >
                  {t.label}
                </Text>
                {/* Badge for skills count */}
                {t.key === "skills" && selectedSkills.length > 0 && (
                  <View className="bg-claw-orange/20 rounded-full px-1.5 min-w-[18px] items-center">
                    <Text className="text-claw-orange text-[10px] font-bold">{selectedSkills.length}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* ── Error banner ───────────────────────────────────────── */}
        {error && (
          <View className="bg-claw-red/10 border-b border-claw-red/25 px-4 py-2.5">
            <Text className="text-claw-red text-sm">{error}</Text>
          </View>
        )}

        {/* ── Tab content (fills remaining space) ────────────────── */}
        <View className="flex-1">
          {/* Soul tab */}
          {tab === "soul" && (
            <View className={`flex-1 ${isDesktop ? "flex-row" : ""}`}>
              {/* Template sidebar (desktop) */}
              {isDesktop && (
                <View
                  className="border-r border-surface-border"
                  style={[
                    { width: 288 },
                    isWeb && {
                      // @ts-expect-error -- web-only
                      background: "linear-gradient(180deg, rgba(19,16,24,0.95) 0%, rgba(10,8,16,0.98) 100%)",
                    },
                  ]}
                >
                  <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
                    <Text className="font-mono text-[10px] uppercase tracking-widest text-text-secondary mb-1">
                      Library
                    </Text>
                    <Text className="text-xl font-bold text-text-primary mb-5">
                      Templates
                    </Text>
                    <View className="gap-2">
                      {allTemplates.map(tmpl => {
                        const isSelected = selectedTemplateId === tmpl.id;
                        return (
                          <Pressable
                            key={tmpl.id}
                            onPress={() => selectTemplate(tmpl.id)}
                            className={`rounded-card p-3.5 ${
                              isSelected
                                ? "bg-claw-orange/20 border border-claw-orange/40"
                                : "bg-slate-800/40 border border-slate-700"
                            }`}
                          >
                            <Text
                              className={`text-sm font-semibold mb-1 ${
                                isSelected ? "text-claw-orange" : "text-text-primary"
                              }`}
                            >
                              {tmpl.name}
                            </Text>
                            <Text className="text-xs text-text-secondary leading-relaxed" numberOfLines={2}>
                              {tmpl.description}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Editor column */}
              <View className="flex-1">
                {/* Editor header bar */}
                <View className="flex-row items-center justify-between px-5 py-3 border-b border-surface-border bg-surface-raised">
                  <View className="flex-row items-center gap-3">
                    <View
                      style={[
                        { width: 36, height: 36, borderRadius: 9, backgroundColor: "#ff5e00", alignItems: "center", justifyContent: "center" },
                        isWeb && {
                          // @ts-expect-error -- web-only
                          background: "linear-gradient(135deg, #ff5e00, #dc2626)",
                          boxShadow: "0 0 12px rgba(255,94,0,0.3)",
                        },
                      ]}
                    >
                      <MaterialIcons name="psychology" size={20} color="#ffffff" />
                    </View>
                    <View>
                      <Text className="text-base font-bold text-text-primary">Agent Soul</Text>
                      <Text className="text-[10px] text-text-secondary">
                        editing <Text className="text-claw-orange font-medium">@{name || "Agent"}</Text>
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="font-mono text-[10px] text-text-tertiary">
                      {systemPrompt.length}<Text className="text-text-tertiary/50"> / {MAX_PROMPT_LENGTH}</Text>
                    </Text>
                    <View
                      className="flex-row items-center gap-1 rounded px-1.5 py-0.5"
                      style={{ backgroundColor: risk.bgColor }}
                    >
                      <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: risk.color }} />
                      <Text className="text-[9px] font-mono font-medium" style={{ color: risk.color }}>
                        {risk.label}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Mobile template pills */}
                {!isDesktop && allTemplates.length > 0 && (
                  <View className="px-4 pt-3 pb-2">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {allTemplates.map(tmpl => {
                        const isSelected = selectedTemplateId === tmpl.id;
                        return (
                          <Pressable
                            key={tmpl.id}
                            onPress={() => selectTemplate(tmpl.id)}
                            className={`rounded-full px-4 py-2 flex-row items-center gap-2 ${
                              isSelected
                                ? "bg-claw-orange/20 border border-claw-orange/40"
                                : "bg-surface-overlay border border-surface-border"
                            }`}
                          >
                            <Text
                              className={`text-xs font-semibold ${
                                isSelected ? "text-claw-orange" : "text-text-secondary"
                              }`}
                            >
                              {tmpl.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* Full-screen code editor */}
                <View className="flex-1" style={{ backgroundColor: "#0d0d12" }}>
                  <View className="relative flex-1">
                    {/* Line numbers gutter (web only) */}
                    {isWeb && (
                      <View
                        className="absolute top-0 bottom-0 left-0 border-r border-surface-border"
                        style={{ width: 48, backgroundColor: "#08060e" }}
                      >
                        <View className="py-4 pr-3">
                          {lineNumbers.map(num => (
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
                    )}

                    <TextInput
                      className="flex-1 font-mono text-sm text-slate-300"
                      style={[
                        {
                          paddingTop: 16,
                          paddingBottom: 16,
                          paddingRight: 16,
                          paddingLeft: isWeb ? 64 : 16,
                          lineHeight: 24,
                          textAlignVertical: "top",
                        },
                        isWeb && {
                          // @ts-expect-error -- web-only
                          outline: "none",
                        },
                      ]}
                      placeholderTextColor="#3a3444"
                      placeholder="Define your agent's personality and behavior..."
                      multiline
                      textAlignVertical="top"
                      value={systemPrompt}
                      onChangeText={text => {
                        if (text.length <= MAX_PROMPT_LENGTH) setSystemPrompt(text);
                      }}
                    />

                    {/* Insert Variable floating button */}
                    {isWeb && (
                      <Pressable
                        className="absolute bottom-4 right-4 bg-surface-overlay border border-surface-border rounded-lg px-3 py-2 flex-row items-center gap-1.5"
                        style={{ backdropFilter: "blur(8px)" } as any}
                      >
                        <MaterialIcons name="data-object" size={14} color="#8a8494" />
                        <Text className="text-xs text-text-secondary font-medium">Insert Variable</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Skills tab */}
          {tab === "skills" && (
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ padding: 16, paddingBottom: 8, maxWidth: 800, width: "100%", alignSelf: "center" }}
            >
              {["developer", "productivity", "web3"].map(category => {
                const catSkills = (skillsData?.skills ?? []).filter(s => s.category === category);
                if (catSkills.length === 0) return null;
                return (
                  <View key={category} className="mb-5">
                    <Text className="text-text-tertiary text-xs font-bold uppercase tracking-wider mb-2">
                      {category}
                    </Text>
                    {catSkills.map(skill => {
                      const checked = selectedSkills.includes(skill.id);
                      return (
                        <Pressable
                          key={skill.id}
                          onPress={() => toggleSkill(skill.id)}
                          className="flex-row items-center py-3 px-3 rounded-xl mb-1"
                          style={{ backgroundColor: checked ? "rgba(255,94,0,0.1)" : "transparent" }}
                        >
                          <View
                            className="w-5 h-5 rounded items-center justify-center mr-3"
                            style={{
                              backgroundColor: checked ? "#ff5e00" : "#1a1520",
                              borderWidth: checked ? 0 : 1,
                              borderColor: "#2a2235",
                            }}
                          >
                            {checked && <MaterialIcons name="check" size={14} color="white" />}
                          </View>
                          <View className="flex-1">
                            <Text className="text-white text-sm font-medium">{skill.name}</Text>
                            <Text className="text-text-tertiary text-xs">{skill.description}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
              {selectedSkills.length === 0 && (
                <Text className="text-text-tertiary text-xs font-mono">
                  No skills selected — your agent will use default capabilities.
                </Text>
              )}
            </ScrollView>
          )}

          {/* Parameters tab */}
          {tab === "parameters" && (
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ padding: 16, paddingBottom: 8, maxWidth: 800, width: "100%", alignSelf: "center" }}
            >
              {/* Name */}
              <View className="mb-6">
                <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary mb-2">
                  Agent Name
                </Text>
                <TextInput
                  className="bg-surface-raised border border-surface-border rounded-xl px-4 py-3 text-base text-text-primary"
                  placeholder="Agent name"
                  placeholderTextColor="#5a5464"
                  value={name}
                  onChangeText={setName}
                  maxLength={50}
                />
                <Text className="font-mono text-[10px] text-text-tertiary mt-1.5 text-right">
                  {name.length}/50
                </Text>
              </View>

              {/* Model */}
              <View>
                <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary mb-2">
                  Model
                </Text>
                <ModelSelector selected={model} onSelect={setModel} />
              </View>
            </ScrollView>
          )}
        </View>

        {/* ── Bottom action bar ──────────────────────────────────── */}
        <View
          className="flex-row items-center justify-between px-4 py-3 border-t border-surface-border"
          style={{ backgroundColor: "#0a0810" }}
        >
          <Pressable className="py-2 px-2" onPress={() => router.back()}>
            <Text className="text-sm font-medium text-text-secondary">Cancel</Text>
          </Pressable>

          <View className="flex-row items-center gap-3">
            <Pressable
              className={`bg-surface-raised border border-surface-border rounded-lg px-5 py-2.5 flex-row items-center gap-2 ${
                !canSave || saving ? "opacity-50" : "active:bg-surface-overlay"
              }`}
              onPress={handleSaveOnly}
              disabled={!canSave || saving}
            >
              <MaterialIcons name="save" size={16} color="#f0ede8" />
              <Text className="text-sm font-semibold text-text-primary">Save</Text>
            </Pressable>

            {isRunning && (
              <Pressable
                className={`bg-claw-orange rounded-lg px-5 py-2.5 flex-row items-center gap-2 ${
                  !canSave || saving ? "opacity-50" : "active:bg-claw-orange-dark"
                }`}
                onPress={handleSaveAndRedeploy}
                disabled={!canSave || saving}
                style={isWeb && canSave && !saving ? { boxShadow: "0 0 16px rgba(255,94,0,0.4)" } as any : undefined}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <MaterialIcons name="sync" size={16} color="#ffffff" />
                    <Text className="text-sm font-semibold text-white">Save & Update</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </>
  );
}
