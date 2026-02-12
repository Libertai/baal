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
        headerStyle: { backgroundColor: "#0a0810" },
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
      <View style={{ flex: 1, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: 1200 }}>
          {stack}
        </View>
      </View>
    </View>
  );
}
