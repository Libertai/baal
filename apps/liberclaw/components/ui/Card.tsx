import React from 'react';
import { View, Pressable } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onPress?: () => void;
}

export default function Card({ children, className = '', onPress }: CardProps) {
  const baseStyles = `rounded-xl bg-white p-4 shadow-sm shadow-black/10 ${className}`;

  if (onPress) {
    return (
      <Pressable onPress={onPress} className={`${baseStyles} active:opacity-90`}>
        {children}
      </Pressable>
    );
  }

  return <View className={baseStyles}>{children}</View>;
}
