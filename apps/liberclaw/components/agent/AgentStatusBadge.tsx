import React from 'react';
import { View, Text } from 'react-native';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface AgentStatusBadgeProps {
  status: string;
}

const statusMap: Record<string, { label: string; variant: BadgeVariant }> = {
  running: { label: 'Running', variant: 'success' },
  deploying: { label: 'Deploying', variant: 'warning' },
  failed: { label: 'Failed', variant: 'error' },
  pending: { label: 'Pending', variant: 'warning' },
  stopped: { label: 'Stopped', variant: 'neutral' },
};

const variantStyles: Record<BadgeVariant, { dot: string; bg: string; text: string; border: string }> = {
  success: { dot: 'bg-status-running', bg: 'bg-status-running/15', text: 'text-status-running', border: 'border-status-running/25' },
  warning: { dot: 'bg-status-deploying', bg: 'bg-status-deploying/15', text: 'text-status-deploying', border: 'border-status-deploying/25' },
  error: { dot: 'bg-status-failed', bg: 'bg-status-failed/15', text: 'text-status-failed', border: 'border-status-failed/25' },
  info: { dot: 'bg-claw-orange', bg: 'bg-claw-orange/15', text: 'text-claw-orange', border: 'border-claw-orange/25' },
  neutral: { dot: 'bg-status-stopped', bg: 'bg-surface-overlay', text: 'text-text-secondary', border: 'border-surface-border' },
};

export default function AgentStatusBadge({ status }: AgentStatusBadgeProps) {
  const mapping = statusMap[status] ?? { label: status, variant: 'neutral' as BadgeVariant };
  const styles = variantStyles[mapping.variant];

  return (
    <View className={`flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1 border ${styles.bg} ${styles.border}`}>
      <View className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
      <Text className={`font-mono text-[10px] uppercase tracking-wider font-semibold ${styles.text}`}>
        {mapping.label}
      </Text>
    </View>
  );
}
