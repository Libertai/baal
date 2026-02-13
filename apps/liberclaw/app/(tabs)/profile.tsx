import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Platform } from "react-native";
import Toggle from "@/components/ui/Toggle";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useAuth } from "@/lib/auth/provider";
import { useUsage } from "@/lib/hooks/useUsage";

const isWeb = Platform.OS === "web";

// ── Types ────────────────────────────────────────────────────────────

type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

interface SettingsRowProps {
  icon: IconName;
  label: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
}

interface SlotIndicatorProps {
  filled: number;
  total: number;
}

// ── Reusable badges ──────────────────────────────────────────────────

function ComingSoonBadge(): React.ReactElement {
  return (
    <View className="bg-surface-overlay border border-surface-border rounded-full px-2 py-0.5">
      <Text className="font-mono text-[9px] uppercase tracking-wider text-text-tertiary font-semibold">
        Coming Soon
      </Text>
    </View>
  );
}

// ── Card wrapper ─────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }): React.ReactElement {
  const base = isWeb
    ? "glass-card rounded-2xl"
    : "bg-surface-raised border border-surface-border rounded-card";

  return <View className={`${base} ${className}`}>{children}</View>;
}

// ── Settings Row ─────────────────────────────────────────────────────

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

// ── Slot Indicator ───────────────────────────────────────────────────

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

export default function ProfileScreen(): React.ReactElement {
  const { user, logout } = useAuth();
  const { data: usage } = useUsage();
  const [showToolCalls, setShowToolCalls] = useState(user?.show_tool_calls ?? true);

  const tier = usage?.tier ?? user?.tier ?? "free";
  const tierLabel = tier === "pro" ? "Pro Plan" : tier === "guest" ? "Guest" : "Free Plan";

  const messagesUsed = usage?.daily_messages_used ?? 0;
  const messagesLimit = usage?.daily_messages_limit ?? 50;
  const messagePercent = messagesLimit > 0 ? Math.round((messagesUsed / messagesLimit) * 100) : 0;
  const agentCount = usage?.agent_count ?? 0;
  const agentLimit = usage?.agent_limit ?? 5;

  return (
    <ScrollView
      className="flex-1 bg-surface-base"
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
    >
      {/* ── Header ───────────────────────────────────────────────── */}
      <View className="flex-row items-center justify-between mb-6">
        <Text className="text-text-primary text-2xl font-bold font-display">
          Account Overview
        </Text>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity activeOpacity={0.7} className="relative">
            <MaterialIcons name="notifications-none" size={24} color="#5a5464" />
          </TouchableOpacity>
          <View className="bg-claw-orange/15 border border-claw-orange/25 rounded-full px-3 py-1">
            <Text className="font-mono text-[10px] uppercase tracking-wider text-claw-orange font-semibold">
              {tierLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Stats Grid ─────────────────────────────────────────── */}
      <View
        className="mb-6"
        style={
          isWeb
            ? ({ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 } as any)
            : undefined
        }
      >
        {!isWeb && (
          <View className="gap-3">
            <MessageUsageCard
              used={messagesUsed}
              limit={messagesLimit}
              percent={messagePercent}
            />
            <AgentSlotsCard filled={agentCount} total={agentLimit} />
            {tier !== "pro" && <UpgradeCard />}
          </View>
        )}

        {isWeb && (
          <>
            <MessageUsageCard
              used={messagesUsed}
              limit={messagesLimit}
              percent={messagePercent}
            />
            <AgentSlotsCard filled={agentCount} total={agentLimit} />
            {tier !== "pro" && <UpgradeCard />}
          </>
        )}
      </View>

      {/* ── Recent Activity ──────────────────────────────────────── */}
      <Card className="overflow-hidden mb-6">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-surface-border">
          <Text className="text-text-primary text-base font-bold font-display">
            Recent Activity
          </Text>
          <ComingSoonBadge />
        </View>
        <View className="p-6 items-center">
          <View className="w-12 h-12 rounded-full bg-surface-overlay border border-surface-border items-center justify-center mb-3">
            <MaterialIcons name="timeline" size={22} color="#5a5464" />
          </View>
          <Text className="text-text-secondary text-sm text-center">
            Activity logs will appear here once available.
          </Text>
        </View>
      </Card>

      {/* ── Billing History ──────────────────────────────────────── */}
      <Card className="p-6 items-center mb-6">
        <View className="w-14 h-14 rounded-full bg-surface-overlay border border-surface-border items-center justify-center mb-3">
          <MaterialIcons name="receipt-long" size={24} color="#5a5464" />
        </View>
        <Text className="text-text-primary text-base font-bold font-display mb-1">
          Billing History
        </Text>
        <Text className="text-text-secondary text-sm text-center mb-3">
          Invoices and payment history will appear here.
        </Text>
        <ComingSoonBadge />
      </Card>

      {/* ── Settings ─────────────────────────────────────────────── */}
      <Card className="overflow-hidden mb-4">
        <SettingsRow
          icon="code"
          label="Show Tool Calls"
          trailing={
            <Toggle
              value={showToolCalls}
              onValueChange={setShowToolCalls}
            />
          }
        />
        <SettingsRow
          icon="vpn-key"
          label="API Keys"
          trailing={<ComingSoonBadge />}
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
      </Card>

      {/* ── Sign Out ─────────────────────────────────────────────── */}
      <TouchableOpacity
        className={
          isWeb
            ? "glass-card rounded-2xl py-3 flex-row items-center justify-center"
            : "bg-claw-red/10 border border-claw-red/25 rounded-card py-3 flex-row items-center justify-center"
        }
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

// ── Stat Cards ───────────────────────────────────────────────────────

interface MessageUsageCardProps {
  used: number;
  limit: number;
  percent: number;
}

function MessageUsageCard({ used, limit, percent }: MessageUsageCardProps): React.ReactElement {
  return (
    <Card className="p-4">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
          Daily Messages
        </Text>
        <View className="flex-row items-center gap-1.5 bg-status-running/15 rounded-full px-2 py-0.5">
          <View className="w-1.5 h-1.5 rounded-full bg-status-running" />
          <Text className="font-mono text-[10px] uppercase tracking-wider text-status-running font-semibold">
            Active
          </Text>
        </View>
      </View>

      <View className="flex-row items-baseline mb-3">
        <Text className="text-text-primary text-3xl font-bold">{used}</Text>
        <Text className="text-text-secondary text-sm ml-1">/{limit} messages</Text>
      </View>

      <View className="h-3 bg-surface-border rounded-full overflow-hidden mb-2">
        <View
          className="h-full bg-claw-orange rounded-full"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <MaterialIcons name="schedule" size={14} color="#5a5464" />
          <Text className="text-text-tertiary text-xs ml-1">Resets daily</Text>
        </View>
        <Text className="text-text-secondary text-xs font-medium">{percent}% used</Text>
      </View>
    </Card>
  );
}

interface AgentSlotsCardProps {
  filled: number;
  total: number;
}

function AgentSlotsCard({ filled, total }: AgentSlotsCardProps): React.ReactElement {
  return (
    <Card className="p-4">
      <View className="flex-row items-start justify-between mb-2">
        <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
          Agent Slots
        </Text>
        <View className="w-8 h-8 rounded-lg bg-claw-orange/10 items-center justify-center">
          <MaterialIcons name="smart-toy" size={18} color="#ff5e00" />
        </View>
      </View>

      <View className="flex-row items-baseline mb-2">
        <Text className="text-text-primary text-3xl font-bold">{filled}</Text>
        <Text className="text-text-secondary text-sm ml-1">/{total} slots used</Text>
      </View>

      <SlotIndicator filled={filled} total={total} />

      {/* Buy more button */}
      <View
        className="flex-row items-center justify-center mt-3 py-2 rounded-lg border border-surface-border opacity-50"
      >
        <MaterialIcons name="add-circle-outline" size={16} color="#8a8494" />
        <Text className="text-text-secondary text-sm font-medium ml-1.5">Buy More Slots</Text>
        <View className="ml-2">
          <ComingSoonBadge />
        </View>
      </View>
    </Card>
  );
}

function UpgradeCard(): React.ReactElement {
  return (
    <View
      className={isWeb ? "rounded-2xl p-6 overflow-hidden" : "rounded-card p-6 overflow-hidden"}
      style={
        isWeb
          ? ({
              background: "linear-gradient(135deg, #ff5e00 0%, #cc4b00 100%)",
              position: "relative",
            } as any)
          : { backgroundColor: "#ff5e00" }
      }
    >
      {isWeb && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.1,
            backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          } as any}
        />
      )}

      <View className="flex-row items-center gap-2 mb-2">
        <Text className="text-white font-bold text-lg font-display">
          Upgrade to Pro
        </Text>
        <View className="bg-white/20 rounded-full px-2 py-0.5">
          <Text className="font-mono text-[10px] uppercase tracking-wider text-white font-semibold">
            Coming Soon
          </Text>
        </View>
      </View>

      <Text className="text-white/80 text-sm leading-5 mb-4">
        Remove limits and unleash the full potential of your AI agents.
      </Text>

      <View className="gap-2 mb-4">
        <View className="flex-row items-center">
          <MaterialIcons name="check-circle" size={18} color="white" />
          <Text className="text-white text-sm ml-2">Unlimited Messages</Text>
        </View>
        <View className="flex-row items-center">
          <MaterialIcons name="check-circle" size={18} color="white" />
          <Text className="text-white text-sm ml-2">More Agent Slots</Text>
        </View>
        <View className="flex-row items-center">
          <MaterialIcons name="check-circle" size={18} color="white" />
          <Text className="text-white text-sm ml-2">Premium Models</Text>
        </View>
      </View>

      <View
        className="bg-white/30 rounded-lg py-2.5 items-center"
      >
        <Text className="text-white font-bold text-base">
          Stay Tuned
        </Text>
      </View>
    </View>
  );
}
