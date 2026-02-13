/**
 * Custom toggle switch matching the mockup design.
 *
 * w-9 h-5 track, 16px white thumb, orange glow when on.
 * Uses Animated for smooth thumb translation on native.
 */

import { useEffect, useRef } from "react";
import { Pressable, Animated, Platform, View } from "react-native";

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export default function Toggle({ value, onValueChange, disabled }: ToggleProps) {
  const translateX = useRef(new Animated.Value(value ? 18 : 2)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: value ? 18 : 2,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [value, translateX]);

  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      style={[
        {
          width: 36,
          height: 20,
          borderRadius: 10,
          backgroundColor: value ? "#ff5e00" : "#334155",
          justifyContent: "center",
          opacity: disabled ? 0.5 : 1,
        },
        value &&
          Platform.OS === "web" &&
          ({
            boxShadow: "0 0 10px #ff5e00",
            transition: "background-color 0.15s, box-shadow 0.15s",
          } as any),
        !value &&
          Platform.OS === "web" &&
          ({
            transition: "background-color 0.15s, box-shadow 0.15s",
          } as any),
      ]}
    >
      <Animated.View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: "#ffffff",
          transform: [{ translateX }],
        }}
      />
    </Pressable>
  );
}
