/**
 * Animated typing indicator — styled as an agent message bubble with pulsing dots.
 */

import { useEffect, useRef } from "react";
import { View, Text, Animated, Platform } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

interface TypingIndicatorProps {
  agentName?: string;
}

export default function TypingIndicator({ agentName = "Agent" }: TypingIndicatorProps) {
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
    <View className="mb-8 flex-row items-start">
      <View
        className="w-10 h-10 rounded items-center justify-center mr-3"
        style={[
          { backgroundColor: "#ff5e00" },
          Platform.OS === "web" &&
            ({
              backgroundImage:
                "linear-gradient(to bottom right, #ff5e00, #dc2626)",
              boxShadow: "0 4px 6px rgba(234, 88, 12, 0.2)",
            } as any),
        ]}
      >
        <MaterialIcons name="smart-toy" size={20} color="#ffffff" />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center mb-1">
          <Text className="text-sm font-bold text-text-primary mr-2">
            {agentName}
          </Text>
          <Text className="font-mono text-xs text-text-secondary">
            thinking...
          </Text>
        </View>
        <View className="flex-row items-center rounded-lg px-4 py-3"
          style={{
            backgroundColor: "rgba(255, 94, 0, 0.06)",
            borderWidth: 1,
            borderColor: "rgba(255, 94, 0, 0.15)",
            alignSelf: "flex-start",
          }}
        >
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
    </View>
  );
}
