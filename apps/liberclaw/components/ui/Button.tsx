import React from 'react';
import { Pressable, Text, ActivityIndicator } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, { container: string; text: string; indicator: string }> = {
  primary: {
    container: 'bg-claw-orange active:bg-claw-orange-dark',
    text: 'text-white',
    indicator: '#ffffff',
  },
  secondary: {
    container: 'bg-surface-raised active:bg-surface-overlay border border-surface-border',
    text: 'text-text-primary',
    indicator: '#f0ede8',
  },
  danger: {
    container: 'bg-claw-red active:bg-red-700',
    text: 'text-white',
    indicator: '#ffffff',
  },
  ghost: {
    container: 'bg-transparent active:bg-surface-overlay',
    text: 'text-claw-orange',
    indicator: '#ffffff',
  },
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: ButtonProps) {
  const styles = variantStyles[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`flex-row items-center justify-center rounded-lg px-5 py-3 ${styles.container} ${
        disabled || loading ? 'opacity-50' : ''
      }`}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={styles.indicator}
          className="mr-2"
        />
      ) : null}
      <Text className={`text-base font-semibold ${styles.text}`}>{title}</Text>
    </Pressable>
  );
}
