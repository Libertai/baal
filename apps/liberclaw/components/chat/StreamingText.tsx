import React, { useEffect, useRef } from 'react';
import { Text, Animated } from 'react-native';

interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
}

export default function StreamingText({ text, isStreaming }: StreamingTextProps) {
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isStreaming) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(cursorOpacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(cursorOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
    cursorOpacity.setValue(0);
  }, [isStreaming, cursorOpacity]);

  return (
    <Text className="text-base text-gray-900">
      {text}
      {isStreaming ? (
        <Animated.Text style={{ opacity: cursorOpacity }} className="text-blue-600">
          {'|'}
        </Animated.Text>
      ) : null}
    </Text>
  );
}
