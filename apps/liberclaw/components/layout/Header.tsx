import React from "react";
import { View, Text, Pressable } from "react-native";

interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: {
    label: string;
    onPress: () => void;
  };
}

export default function Header({
  title,
  showBack = false,
  onBack,
  rightAction,
}: HeaderProps) {
  return (
    <View className="flex-row items-center justify-between bg-surface-base border-b border-surface-border px-4 py-3">
      <View className="w-16">
        {showBack && onBack ? (
          <Pressable onPress={onBack} className="py-1">
            <Text className="text-base text-claw-orange">Back</Text>
          </Pressable>
        ) : null}
      </View>
      <Text
        className="flex-1 text-center text-lg font-semibold text-text-primary"
        numberOfLines={1}
      >
        {title}
      </Text>
      <View className="w-16 items-end">
        {rightAction ? (
          <Pressable onPress={rightAction.onPress} className="py-1">
            <Text className="text-base text-claw-orange">
              {rightAction.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
