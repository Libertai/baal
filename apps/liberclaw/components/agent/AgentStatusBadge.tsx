import React from "react";
import { View, Text } from "react-native";

type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral";

interface AgentStatusBadgeProps {
  status: string;
}

const statusMap: Record<string, { label: string; variant: BadgeVariant }> = {
  running: { label: "Running", variant: "success" },
  deploying: { label: "Deploying", variant: "warning" },
  failed: { label: "Failed", variant: "error" },
  pending: { label: "Pending", variant: "warning" },
  stopped: { label: "Stopped", variant: "neutral" },
};

const variantStyles: Record<
  BadgeVariant,
  { dot: string; bg: string; text: string; border: string; animated?: boolean }
> = {
  success: {
    dot: "bg-status-running",
    bg: "bg-status-running/10",
    text: "text-status-running",
    border: "border-status-running/20",
    animated: true,
  },
  warning: {
    dot: "bg-status-deploying",
    bg: "bg-status-deploying/10",
    text: "text-status-deploying",
    border: "border-status-deploying/20",
    animated: true,
  },
  error: {
    dot: "bg-status-failed",
    bg: "bg-status-failed/10",
    text: "text-status-failed",
    border: "border-status-failed/20",
  },
  info: {
    dot: "bg-claw-orange",
    bg: "bg-claw-orange/10",
    text: "text-claw-orange",
    border: "border-claw-orange/20",
  },
  neutral: {
    dot: "bg-status-stopped",
    bg: "bg-surface-overlay",
    text: "text-text-secondary",
    border: "border-surface-border",
  },
};

export default function AgentStatusBadge({ status }: AgentStatusBadgeProps) {
  const mapping = statusMap[status] ?? {
    label: status,
    variant: "neutral" as BadgeVariant,
  };
  const styles = variantStyles[mapping.variant];

  return (
    <View
      className={`flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1 border ${styles.bg} ${styles.border}`}
    >
      {/* Animated ping dot for running/deploying states */}
      <View className="relative" style={{ width: 8, height: 8 }}>
        {styles.animated && (
          <View
            className={`absolute inset-0 rounded-full ${styles.dot} opacity-75`}
            style={{
              // @ts-expect-error -- web-only animation
              animation: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite",
            }}
          />
        )}
        <View
          className={`w-2 h-2 rounded-full ${styles.dot}`}
          style={{ position: "relative" }}
        />
      </View>
      <Text
        className={`text-xs font-medium ${styles.text}`}
      >
        {mapping.label}
      </Text>
    </View>
  );
}
