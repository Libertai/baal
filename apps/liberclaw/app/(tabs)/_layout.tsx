import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Redirect, Tabs } from "expo-router";
import { Platform, View, useWindowDimensions } from "react-native";

import SidebarNav from "@/components/layout/SidebarNav";
import { useAuth } from "@/lib/auth/provider";

const DESKTOP_BREAKPOINT = 1024;

export default function TabsLayout() {
  const { user, isLoading } = useAuth();
  const { width } = useWindowDimensions();

  const isDesktopWeb = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;

  if (isLoading) return null;

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  const tabs = (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#ff5e00",
        tabBarInactiveTintColor: "#5a5464",
        tabBarStyle: isDesktopWeb
          ? { display: "none" }
          : {
              backgroundColor: "#0a0810",
              borderTopColor: "#2a2235",
            },
        headerStyle: {
          backgroundColor: "#0a0810",
        },
        headerTintColor: "#f0ede8",
        headerTitleStyle: {
          fontWeight: "700",
          color: "#f0ede8",
        },
        headerShown: !isDesktopWeb,
      }}
    >
      <Tabs.Screen
        name="live"
        options={{
          title: "Live",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="sensors" size={24} color={color} />
          ),
          href: isDesktopWeb ? null : "/(tabs)/live",
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Agents",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="smart-toy" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color }) => (
            <MaterialIcons
              name="chat-bubble-outline"
              size={24}
              color={color}
            />
          ),
          href: isDesktopWeb ? "/(tabs)/chat" : null,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="history" size={24} color={color} />
          ),
          href: isDesktopWeb ? null : "/(tabs)/history",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="person-outline" size={24} color={color} />
          ),
          href: isDesktopWeb ? null : "/(tabs)/profile",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="settings" size={24} color={color} />
          ),
          href: isDesktopWeb ? "/(tabs)/settings" : null,
        }}
      />
    </Tabs>
  );

  if (!isDesktopWeb) {
    return tabs;
  }

  return (
    <View className="flex-1 flex-row bg-surface-base">
      <SidebarNav />
      <View style={{ flex: 1, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: 1200 }}>
          {tabs}
        </View>
      </View>
    </View>
  );
}
