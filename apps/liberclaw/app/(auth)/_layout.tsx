import { Slot } from "expo-router";
import { View } from "react-native";

export default function AuthLayout() {
  return (
    <View className="flex-1 items-center justify-center bg-surface-base px-6">
      <Slot />
    </View>
  );
}
