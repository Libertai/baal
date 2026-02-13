/**
 * Animated typing indicator — 3 orange pulsing dots.
 */

import { useEffect, useRef } from "react";
import { View, Animated } from "react-native";

export default function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    function animateDot(
      dot: Animated.Value,
      delay: number,
    ): Animated.CompositeAnimation {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      );
    }

    const a1 = animateDot(dot1, 0);
    const a2 = animateDot(dot2, 200);
    const a3 = animateDot(dot3, 400);
    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View className="flex-row items-center px-4 pb-2 pt-1">
      <View className="flex-row items-center rounded-full bg-surface-raised px-4 py-2 border border-surface-border">
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={{
              opacity: dot,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#ff5e00",
              marginHorizontal: 3,
            }}
          />
        ))}
      </View>
    </View>
  );
}
