import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Platform } from "react-native";
import Toggle from "@/components/ui/Toggle";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useAuth } from "@/lib/auth/provider";

const isWeb = Platform.OS === "web";

// ── Types ────────────────────────────────────────────────────────────

type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

interface ActivityEntry {
  agentName: string;
  initial: string;
  action: string;
  status: "success" | "failed" | "pending";
  tokens: string;
  time: string;
}

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

// ── Mock Data ────────────────────────────────────────────────────────

const RECENT_ACTIVITY: ActivityEntry[] = [
  {
    agentName: "Customer Support Bot",
    initial: "C",
    action: "Chat Session",
    status: "success",
    tokens: "245",
    time: "2 min ago",
  },
  {
    agentName: "Data Analyzer",
    initial: "D",
    action: "Tool Execution",
    status: "success",
    tokens: "1,024",
    time: "15 min ago",
  },
  {
    agentName: "Translator V2",
    initial: "T",
    action: "Deployment",
    status: "failed",
    tokens: "--",
    time: "1 hr ago",
  },
];

// ── Status helpers ───────────────────────────────────────────────────

function getStatusBadge(status: ActivityEntry["status"]): { label: string; bg: string; text: string } {
  switch (status) {
    case "success":
      return { label: "Success", bg: "bg-status-running/15", text: "text-status-running" };
    case "failed":
      return { label: "Failed", bg: "bg-status-failed/15", text: "text-status-failed" };
    case "pending":
      return { label: "Pending", bg: "bg-status-deploying/15", text: "text-status-deploying" };
  }
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

// ── Activity Row ─────────────────────────────────────────────────────

function ActivityRow({ entry, isLast }: { entry: ActivityEntry; isLast: boolean }): React.ReactElement {
  const badge = getStatusBadge(entry.status);
  const borderClass = isLast ? "" : "border-b border-surface-border";

  return (
    <View className={`flex-row items-center px-4 py-3 ${borderClass}`}>
      {/* Agent avatar + name */}
      <View className="w-8 h-8 rounded-lg bg-claw-orange/10 border border-claw-orange/20 items-center justify-center mr-3">
        <Text className="text-claw-orange font-bold text-sm">{entry.initial}</Text>
      </View>
      <View className="flex-1 mr-3">
        <Text className="text-text-primary text-sm font-medium" numberOfLines={1}>
          {entry.agentName}
        </Text>
        <Text className="text-text-tertiary text-xs mt-0.5">{entry.action}</Text>
      </View>

      {/* Status badge */}
      <View className={`rounded-full px-2 py-0.5 mr-3 ${badge.bg}`}>
        <Text className={`font-mono text-[10px] uppercase tracking-wider font-semibold ${badge.text}`}>
          {badge.label}
        </Text>
      </View>

      {/* Tokens */}
      <Text className="font-mono text-xs text-text-secondary w-14 text-right mr-3">
        {entry.tokens}
      </Text>

      {/* Time */}
      <Text className="text-text-tertiary text-xs w-16 text-right">{entry.time}</Text>
    </View>
  );
}

// ── Checklist item for upgrade CTA ───────────────────────────────────

function CheckItem({ label }: { label: string }): React.ReactElement {
  return (
    <View className="flex-row items-center">
      <MaterialIcons name="check-circle" size={18} color="white" />
      <Text className="text-white text-sm ml-2">{label}</Text>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────

export default function ProfileScreen(): React.ReactElement {
  const { user, logout } = useAuth();
  const [showToolCalls, setShowToolCalls] = useState(user?.show_tool_calls ?? true);

  const tier = user?.tier ?? "free";
  const isPremium = tier === "pro" || tier === "premium";
  const tierLabel = isPremium ? "Pro Plan" : "Free Plan";

  // Placeholder usage values (to be wired to real API later)
  const messagesUsed = 23;
  const messagesLimit = 50;
  const messagePercent = Math.round((messagesUsed / messagesLimit) * 100);
  const agentCount = 2;
  const agentLimit = isPremium ? 10 : 3;

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
          <TouchableOpacity activeOpacity={0.7}>
            <MaterialIcons name="notifications-none" size={24} color="#8a8494" />
          </TouchableOpacity>
          <View className="bg-claw-orange/15 border border-claw-orange/25 rounded-full px-3 py-1">
            <Text className="font-mono text-[10px] uppercase tracking-wider text-claw-orange font-semibold">
              {tierLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* ── 3-Column Stats Grid ──────────────────────────────────── */}
      <View
        className="mb-6"
        style={
          isWeb
            ? ({ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 } as any)
            : undefined
        }
      >
        {/* On native, stack vertically with gaps */}
        {!isWeb && (
          <View className="gap-3">
            <MessageUsageCard
              used={messagesUsed}
              limit={messagesLimit}
              percent={messagePercent}
            />
            <AgentSlotsCard filled={agentCount} total={agentLimit} />
            {!isPremium && <UpgradeCard />}
          </View>
        )}

        {/* On web, cards render directly into the CSS grid */}
        {isWeb && (
          <>
            <MessageUsageCard
              used={messagesUsed}
              limit={messagesLimit}
              percent={messagePercent}
            />
            <AgentSlotsCard filled={agentCount} total={agentLimit} />
            {!isPremium && <UpgradeCard />}
          </>
        )}
      </View>

      {/* ── Recent Activity ──────────────────────────────────────── */}
      <Card className="overflow-hidden mb-6">
        {/* Section header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-surface-border">
          <Text className="text-text-primary text-base font-bold font-display">
            Recent Activity
          </Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text className="text-claw-orange text-sm font-medium">View All Logs</Text>
          </TouchableOpacity>
        </View>

        {/* Column headers (web only) */}
        {isWeb && (
          <View className="flex-row items-center px-4 py-2 border-b border-surface-border">
            <Text className="flex-1 font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
              Agent Name
            </Text>
            <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary w-20 mr-3">
              Status
            </Text>
            <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary w-14 text-right mr-3">
              Tokens
            </Text>
            <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary w-16 text-right">
              Time
            </Text>
          </View>
        )}

        {/* Rows */}
        {RECENT_ACTIVITY.map((entry, i) => (
          <ActivityRow
            key={entry.agentName}
            entry={entry}
            isLast={i === RECENT_ACTIVITY.length - 1}
          />
        ))}

        {/* Footer */}
        <View className="px-4 py-2 border-t border-surface-border">
          <Text className="text-text-tertiary text-xs text-center">
            Showing last {RECENT_ACTIVITY.length} activities
          </Text>
        </View>
      </Card>

      {/* ── Billing History ──────────────────────────────────────── */}
      <Card className="p-6 items-center mb-6">
        <View className="w-14 h-14 rounded-full bg-surface-overlay border border-surface-border items-center justify-center mb-3">
          <MaterialIcons name="receipt-long" size={24} color="#5a5464" />
        </View>
        <Text className="text-text-primary text-base font-bold font-display mb-1">
          No invoices yet
        </Text>
        <Text className="text-text-secondary text-sm text-center mb-3">
          Your billing history will appear here once you upgrade.
        </Text>
        <TouchableOpacity activeOpacity={0.7}>
          <Text className="text-claw-orange text-sm font-medium">
            {"View Pricing Plans \u2192"}
          </Text>
        </TouchableOpacity>
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
      {/* Header row */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
          Message Usage
        </Text>
        <View className="flex-row items-center gap-1.5 bg-status-running/15 rounded-full px-2 py-0.5">
          <View className="w-1.5 h-1.5 rounded-full bg-status-running" />
          <Text className="font-mono text-[10px] uppercase tracking-wider text-status-running font-semibold">
            Active
          </Text>
        </View>
      </View>

      {/* Large number */}
      <View className="flex-row items-baseline mb-3">
        <Text className="text-text-primary text-3xl font-bold">{used}</Text>
        <Text className="text-text-secondary text-sm ml-1">/{limit} messages</Text>
      </View>

      {/* Progress bar */}
      <View className="h-3 bg-surface-border rounded-full overflow-hidden mb-2">
        <View
          className="h-full bg-claw-orange rounded-full"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </View>

      {/* Footer row */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <MaterialIcons name="schedule" size={14} color="#5a5464" />
          <Text className="text-text-tertiary text-xs ml-1">Resets in 4h 12m</Text>
        </View>
        <Text className="text-text-secondary text-xs font-medium">{percent}% Used</Text>
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
      {/* Header row */}
      <View className="flex-row items-start justify-between mb-2">
        <Text className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
          Agent Slots
        </Text>
        <View className="w-8 h-8 rounded-lg bg-claw-orange/10 items-center justify-center">
          <MaterialIcons name="smart-toy" size={18} color="#ff5e00" />
        </View>
      </View>

      {/* Large number */}
      <View className="flex-row items-baseline mb-2">
        <Text className="text-text-primary text-3xl font-bold">{filled}</Text>
        <Text className="text-text-secondary text-sm ml-1">/{total} slots used</Text>
      </View>

      {/* Slot indicators */}
      <SlotIndicator filled={filled} total={total} />

      {/* Buy more button */}
      <TouchableOpacity
        className="flex-row items-center justify-center mt-3 py-2 rounded-lg border border-surface-border"
        activeOpacity={0.7}
      >
        <MaterialIcons name="add-circle-outline" size={16} color="#8a8494" />
        <Text className="text-text-secondary text-sm font-medium ml-1.5">Buy More Slots</Text>
      </TouchableOpacity>
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
      {/* Dot pattern overlay (web only) */}
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

      {/* Header */}
      <View className="flex-row items-center gap-2 mb-2">
        <Text className="text-white font-bold text-lg font-display">
          Upgrade to Pro
        </Text>
        <View className="bg-white/20 rounded-full px-2 py-0.5">
          <Text className="font-mono text-[10px] uppercase tracking-wider text-white font-semibold">
            Recommended
          </Text>
        </View>
      </View>

      <Text className="text-white/80 text-sm leading-5 mb-4">
        Remove limits and unleash the full potential of your AI agents.
      </Text>

      {/* Checklist */}
      <View className="gap-2 mb-4">
        <CheckItem label="Unlimited Messages" />
        <CheckItem label="10 Agent Slots" />
        <CheckItem label="Premium Models" />
      </View>

      {/* CTA button */}
      <TouchableOpacity
        className="bg-white rounded-lg py-2.5 items-center"
        activeOpacity={0.8}
      >
        <Text className="text-claw-orange font-bold text-base">
          {"Upgrade Now \u2192"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
