import { Redirect, Tabs } from "expo-router";
import { Text } from "react-native";
import { useAuth } from "@/lib/auth/provider";

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: {
          borderTopColor: "#e5e7eb",
        },
        headerStyle: {
          backgroundColor: "#ffffff",
        },
        headerTitleStyle: {
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Agents",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>{"@"}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>{"\u2709"}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>{"\u2699"}</Text>
          ),
        }}
      />
    </Tabs>
  );
}
