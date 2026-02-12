import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';

interface ToolIndicatorProps {
  toolName: string;
  isRunning: boolean;
  result?: string;
}

export default function ToolIndicator({
  toolName,
  isRunning,
  result,
}: ToolIndicatorProps) {
  const [expanded, setExpanded] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRunning) {
      const animation = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      animation.start();
      return () => animation.stop();
    }
    spin.setValue(0);
  }, [isRunning, spin]);

  const rotation = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View className="my-1 self-start rounded-lg bg-gray-100 px-3 py-2">
      <Pressable
        onPress={() => result && setExpanded((prev) => !prev)}
        className="flex-row items-center"
      >
        {isRunning ? (
          <Animated.Text
            style={{ transform: [{ rotate: rotation }] }}
            className="mr-2 text-sm"
          >
            {'*'}
          </Animated.Text>
        ) : (
          <Text className="mr-2 text-sm text-green-600">{'>'}</Text>
        )}
        <Text className="text-sm font-medium text-gray-700">
          {toolName}
          {isRunning ? ' ...' : ''}
        </Text>
        {result ? (
          <Text className="ml-2 text-xs text-gray-400">
            {expanded ? '[-]' : '[+]'}
          </Text>
        ) : null}
      </Pressable>
      {expanded && result ? (
        <View className="mt-2 rounded bg-gray-800 p-2">
          <Text className="text-xs text-gray-200">{result}</Text>
        </View>
      ) : null}
    </View>
  );
}
