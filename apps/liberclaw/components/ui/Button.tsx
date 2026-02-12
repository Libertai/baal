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

const variantStyles: Record<ButtonVariant, { container: string; text: string }> = {
  primary: {
    container: 'bg-blue-600 active:bg-blue-700',
    text: 'text-white',
  },
  secondary: {
    container: 'bg-gray-200 active:bg-gray-300',
    text: 'text-gray-900',
  },
  danger: {
    container: 'bg-red-600 active:bg-red-700',
    text: 'text-white',
  },
  ghost: {
    container: 'bg-transparent active:bg-gray-100',
    text: 'text-blue-600',
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
          color={variant === 'secondary' ? '#111827' : '#ffffff'}
          className="mr-2"
        />
      ) : null}
      <Text className={`text-base font-semibold ${styles.text}`}>{title}</Text>
    </Pressable>
  );
}
