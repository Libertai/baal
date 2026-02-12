import React from 'react';
import { View, Text } from 'react-native';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  success: {
    bg: 'bg-status-running/15 border border-status-running/25',
    text: 'text-status-running',
  },
  warning: {
    bg: 'bg-status-deploying/15 border border-status-deploying/25',
    text: 'text-status-deploying',
  },
  error: {
    bg: 'bg-status-failed/15 border border-status-failed/25',
    text: 'text-status-failed',
  },
  info: {
    bg: 'bg-claw-orange/15 border border-claw-orange/25',
    text: 'text-claw-orange',
  },
  neutral: {
    bg: 'bg-surface-overlay border border-surface-border',
    text: 'text-text-secondary',
  },
};

export default function Badge({ text, variant = 'neutral' }: BadgeProps) {
  const styles = variantStyles[variant];

  return (
    <View className={`self-start rounded-full px-2.5 py-0.5 ${styles.bg}`}>
      <Text className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${styles.text}`}>
        {text}
      </Text>
    </View>
  );
}
