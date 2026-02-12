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
  const widthPercent = `${Math.round(clampedProgress * 100)}%`;

  return (
    <View className={`h-2 w-full overflow-hidden rounded-full bg-gray-200 ${className}`}>
      <View
        className="h-full rounded-full bg-blue-600"
        style={{ width: widthPercent }}
      />
    </View>
  );
}
