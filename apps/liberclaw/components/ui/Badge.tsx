import React from 'react';
import { View, Text } from 'react-native';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: 'bg-green-100', text: 'text-green-800' },
  warning: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  error: { bg: 'bg-red-100', text: 'text-red-800' },
  info: { bg: 'bg-blue-100', text: 'text-blue-800' },
  neutral: { bg: 'bg-gray-100', text: 'text-gray-800' },
};

export default function Badge({ text, variant = 'neutral' }: BadgeProps) {
  const styles = variantStyles[variant];

  return (
    <View className={`self-start rounded-full px-2.5 py-0.5 ${styles.bg}`}>
      <Text className={`text-xs font-medium ${styles.text}`}>{text}</Text>
    </View>
  );
}
