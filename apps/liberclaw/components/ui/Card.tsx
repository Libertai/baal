import React from 'react';
import { Platform, View, Pressable } from 'react-native';

type CardVariant = 'default' | 'glass';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: CardVariant;
  onPress?: () => void;
}

export default function Card({
  children,
  className = '',
  variant = 'default',
  onPress,
}: CardProps) {
  const glassWeb = variant === 'glass' && Platform.OS === 'web' ? 'shadow-glow-sm' : '';
  const baseStyles = `rounded-card bg-surface-raised border border-surface-border p-4 ${glassWeb} ${className}`;

  if (onPress) {
    return (
      <Pressable onPress={onPress} className={`${baseStyles} active:opacity-90`}>
        {children}
      </Pressable>
    );
  }

  return <View className={baseStyles}>{children}</View>;
}
