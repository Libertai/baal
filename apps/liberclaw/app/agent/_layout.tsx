import { Stack } from "expo-router";
import { Platform, View, useWindowDimensions } from "react-native";

const DESKTOP_BREAKPOINT = 1024;

export default function AgentLayout() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;

  if (!isDesktopWeb) {
    return (
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0a0810" },
          headerTintColor: "#f0ede8",
          headerTitleStyle: { fontWeight: "700", color: "#f0ede8" },
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1, alignItems: "center", backgroundColor: "#0a0810" }}>
      <View style={{ flex: 1, width: "100%", maxWidth: 1200 }}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: "#0a0810" },
            headerTintColor: "#f0ede8",
            headerTitleStyle: { fontWeight: "700", color: "#f0ede8" },
          }}
        />
      </View>
    </View>
  );
}
