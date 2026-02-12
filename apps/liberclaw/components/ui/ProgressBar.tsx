import React from 'react';
import { View } from 'react-native';

interface ProgressBarProps {
  progress: number; // 0 to 1
  className?: string;
}

export default function ProgressBar({
  progress,
  className = '',
}: ProgressBarProps) {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const widthPercent = `${Math.round(clampedProgress * 100)}%` as const;

  return (
    <View className={`h-2 w-full overflow-hidden rounded-full bg-surface-border ${className}`}>
      <View
        className="h-full rounded-full bg-claw-orange"
        style={{ width: widthPercent as `${number}%` }}
      />
    </View>
  );
}
