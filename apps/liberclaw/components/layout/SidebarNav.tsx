import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { usePathname, useRouter } from "expo-router";
import { View, Text, Pressable } from "react-native";

import { useAuth } from "@/lib/auth/provider";

const NAV_ITEMS = [
  { label: "Agents", icon: "smart-toy" as const, href: "/(tabs)/" },
  { label: "Chat", icon: "chat-bubble-outline" as const, href: "/(tabs)/chat" },
  { label: "Settings", icon: "settings" as const, href: "/(tabs)/settings" },
];

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function isActiveRoute(pathname: string, href: string): boolean {
  // The index tab matches both "/(tabs)/" and "/(tabs)"
  if (href === "/(tabs)/") {
    return pathname === "/(tabs)" || pathname === "/(tabs)/";
  }
  return pathname.startsWith(href);
}

export default function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  return (
    <View
      style={{ width: 240 }}
      className="h-full bg-surface-raised border-r border-surface-border"
    >
      {/* Logo */}
      <View className="px-5 pt-6 pb-2">
        <Text className="text-xl font-bold">
          <Text className="text-text-primary">Liber</Text>
          <Text className="text-claw-orange">Claw</Text>
        </Text>
        <Text className="text-xs text-text-tertiary font-mono mt-1">
          AI agents on Aleph Cloud
        </Text>
      </View>

      {/* Nav items */}
      <View className="mt-4 px-2 flex-1">
        {NAV_ITEMS.map((item) => {
          const active = isActiveRoute(pathname, item.href);

          return (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href as never)}
              className={`flex-row items-center px-3 py-3 rounded-r-lg mb-1 ${
                active
                  ? "bg-claw-orange/10 border-l-2 border-claw-orange"
                  : "border-l-2 border-transparent"
              }`}
            >
              <MaterialIcons
                name={item.icon}
                size={22}
                color={active ? "#ff5e00" : "#8a8494"}
              />
              <Text
                className={`ml-3 text-sm font-medium ${
                  active ? "text-claw-orange" : "text-text-secondary"
                }`}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* User profile */}
      {user ? (
        <View className="px-4 py-4 border-t border-surface-border">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-full bg-surface-overlay items-center justify-center">
              <Text className="text-xs font-semibold text-text-primary">
                {getInitials(user.display_name)}
              </Text>
            </View>
            <View className="ml-3 flex-1">
              <Text
                className="text-sm font-medium text-text-primary"
                numberOfLines={1}
              >
                {user.display_name || "User"}
              </Text>
              {user.email ? (
                <Text
                  className="text-xs text-text-tertiary"
                  numberOfLines={1}
                >
                  {user.email}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
