import { Stack } from "expo-router";
import { Platform, View, useWindowDimensions } from "react-native";

import SidebarNav from "@/components/layout/SidebarNav";

const DESKTOP_BREAKPOINT = 1024;

export default function AgentLayout() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;

  const stack = (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0a0810", borderBottomWidth: 1, borderBottomColor: "#2a2235" },
        headerShadowVisible: false,
        headerTintColor: "#f0ede8",
        headerTitleStyle: { fontWeight: "700", color: "#f0ede8" },
        headerShown: !isDesktopWeb,
      }}
    />
  );

  if (!isDesktopWeb) {
    return stack;
  }

  return (
    <View className="flex-1 flex-row bg-surface-base">
      <SidebarNav />
      <View className="flex-1">{stack}</View>
    </View>
  );
}
