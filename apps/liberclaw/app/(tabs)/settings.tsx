import { useState } from "react";
import { View, Text, TouchableOpacity, Switch, ScrollView } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useAuth } from "@/lib/auth/provider";

// ── Helpers ──────────────────────────────────────────────────────────

function getUserInitial(user: { display_name?: string | null; email?: string | null }): string {
  if (user.display_name) return user.display_name[0].toUpperCase();
  if (user.email) return user.email[0].toUpperCase();
  return "?";
}

// ── Sub-components ───────────────────────────────────────────────────

interface SettingsRowProps {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  label: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
}

function SettingsRow({ icon, label, trailing, onPress, isLast = false }: SettingsRowProps): React.ReactElement {
  const borderClass = isLast ? "" : "border-b border-surface-border";

  return (
    <TouchableOpacity
      className={`flex-row items-center px-4 py-3 ${borderClass}`}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <MaterialIcons name={icon} size={20} color="#8a8494" />
      <Text className="flex-1 ml-3 text-base text-text-primary">{label}</Text>
      {trailing}
    </TouchableOpacity>
  );
}

interface StatCardProps {
  label: string;
  children: React.ReactNode;
}

function StatCard({ label, children }: StatCardProps): React.ReactElement {
  return (
    <View className="flex-1 bg-surface-raised border border-surface-border rounded-card p-4">
      <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary mb-2">
        {label}
      </Text>
      {children}
    </View>
  );
}

// ── Slot Indicator ───────────────────────────────────────────────────

interface SlotIndicatorProps {
  filled: number;
  total: number;
}

function SlotIndicator({ filled, total }: SlotIndicatorProps): React.ReactElement {
  const slots = [];
  for (let i = 0; i < total; i++) {
    const isFilled = i < filled;
    slots.push(
      <View
        key={i}
        className={
          isFilled
            ? "w-6 h-6 rounded bg-claw-orange/20 border border-claw-orange/40"
            : "w-6 h-6 rounded bg-surface-overlay border border-dashed border-surface-border"
        }
      />,
    );
  }
  return <View className="flex-row gap-1.5 mt-2">{slots}</View>;
}

// ── Main Screen ──────────────────────────────────────────────────────

export default function SettingsScreen(): React.ReactElement {
  const { user, logout } = useAuth();
  const [showToolCalls, setShowToolCalls] = useState(user?.show_tool_calls ?? true);

  const displayName = user?.display_name ?? "Anonymous";
  const email = user?.email ?? "No email";
  const tier = user?.tier ?? "free";
  const isPremium = tier === "pro" || tier === "premium";

  // Placeholder usage values (to be wired to real API later)
  const messagesUsed = 23;
  const messagesLimit = 50;
  const messageProgress = messagesUsed / messagesLimit;
  const agentCount = 2;
  const agentLimit = isPremium ? 10 : 3;

  return (
    <ScrollView
      className="flex-1 bg-surface-base"
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
    >
      {/* ── Profile Card ─────────────────────────────────────────── */}
      <View className="bg-surface-raised border border-surface-border rounded-card p-4 flex-row items-center mb-4">
        <View className="w-14 h-14 rounded-full bg-claw-orange items-center justify-center">
          <Text className="text-white text-xl font-bold">
            {getUserInitial({ display_name: user?.display_name, email: user?.email })}
          </Text>
        </View>
        <View className="ml-4 flex-1">
          <Text className="text-text-primary font-bold text-lg font-display">
            {displayName}
          </Text>
          <Text className="text-text-secondary text-sm mt-0.5">{email}</Text>
          <Text className="font-mono text-[10px] uppercase tracking-wider text-claw-orange mt-1">
            {tier}
          </Text>
        </View>
      </View>

      {/* ── Usage Stats ──────────────────────────────────────────── */}
      <View className="flex-row gap-3 mb-4">
        <StatCard label="Message Usage">
          <Text className="text-text-primary text-xl font-bold">
            {messagesUsed}
            <Text className="text-text-secondary text-sm font-normal">
              {" "}/ {messagesLimit}
            </Text>
          </Text>
          <View className="h-1.5 bg-surface-border rounded-full mt-2 overflow-hidden">
            <View
              className="h-full bg-claw-orange rounded-full"
              style={{ width: `${Math.min(messageProgress * 100, 100)}%` }}
            />
          </View>
          <Text className="text-text-tertiary text-[10px] font-mono mt-1.5">
            Resets in 4h 12m
          </Text>
        </StatCard>

        <StatCard label="Agent Slots">
          <Text className="text-text-primary text-xl font-bold">
            {agentCount}
            <Text className="text-text-secondary text-sm font-normal">
              {" "}/ {agentLimit}
            </Text>
          </Text>
          <SlotIndicator filled={agentCount} total={agentLimit} />
        </StatCard>
      </View>

      {/* ── Upgrade CTA (free tier only) ─────────────────────────── */}
      {!isPremium && (
        <View className="bg-claw-orange rounded-card p-6 mb-4">
          <Text className="text-white font-bold text-lg font-display">
            Upgrade to Pro
          </Text>
          <Text className="text-white/80 text-sm mt-1 leading-5">
            Remove limits and unleash the full potential of your AI agents.
          </Text>
          <View className="mt-4 gap-2">
            <View className="flex-row items-center">
              <MaterialIcons name="check-circle" size={18} color="white" />
              <Text className="text-white text-sm ml-2">Unlimited Messages</Text>
            </View>
            <View className="flex-row items-center">
              <MaterialIcons name="check-circle" size={18} color="white" />
              <Text className="text-white text-sm ml-2">10 Agent Slots</Text>
            </View>
            <View className="flex-row items-center">
              <MaterialIcons name="check-circle" size={18} color="white" />
              <Text className="text-white text-sm ml-2">Premium Models</Text>
            </View>
          </View>
          <TouchableOpacity
            className="bg-white rounded-lg py-2.5 items-center mt-4"
            activeOpacity={0.8}
          >
            <Text className="text-claw-orange font-bold text-base">Upgrade Now</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Settings ─────────────────────────────────────────────── */}
      <View className="bg-surface-raised border border-surface-border rounded-card overflow-hidden mb-4">
        <SettingsRow
          icon="code"
          label="Show Tool Calls"
          trailing={
            <Switch
              value={showToolCalls}
              onValueChange={setShowToolCalls}
              trackColor={{ false: "#2a2235", true: "#ff5e00" }}
              thumbColor="#f0ede8"
            />
          }
        />
        <SettingsRow
          icon="vpn-key"
          label="API Keys"
          onPress={() => {
            // TODO: navigate to API keys screen
          }}
          trailing={
            <MaterialIcons name="chevron-right" size={20} color="#5a5464" />
          }
        />
        <SettingsRow
          icon="dark-mode"
          label="Dark Mode"
          isLast
          trailing={
            <Text className="font-mono text-[10px] uppercase tracking-wider text-status-running">
              Active
            </Text>
          }
        />
      </View>

      {/* ── Sign Out ─────────────────────────────────────────────── */}
      <TouchableOpacity
        className="bg-claw-red/10 border border-claw-red/25 rounded-card py-3 flex-row items-center justify-center"
        onPress={logout}
        activeOpacity={0.7}
      >
        <MaterialIcons name="logout" size={18} color="#ff003c" />
        <Text className="text-claw-red font-semibold text-base ml-2">Sign Out</Text>
      </TouchableOpacity>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <Text className="font-mono text-[10px] text-text-tertiary text-center mt-8">
        LiberClaw v0.1.0
      </Text>
    </ScrollView>
  );
}
