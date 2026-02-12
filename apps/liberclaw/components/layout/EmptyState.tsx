import React from 'react';
import { View, Text } from 'react-native';
import Button from '../ui/Button';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <Text className="mb-2 text-center text-xl font-semibold text-gray-900">
        {title}
      </Text>
      <Text className="mb-6 text-center text-base text-gray-500">
        {description}
      </Text>
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  );
}
