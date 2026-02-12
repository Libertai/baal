import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { usePathname, useRouter } from "expo-router";
import { Pressable, Text, View, ViewStyle } from "react-native";

import ClawLogo from "@/components/ui/ClawLogo";
import { useAuth } from "@/lib/auth/provider";
import { useAgents } from "@/lib/hooks/useAgents";

type WebPressableState = { hovered?: boolean; pressed: boolean };
type WebStyle = ViewStyle & Record<string, unknown>;

const SYSTEM_ITEMS = [
  { label: "Settings", icon: "settings" as const, href: "/(tabs)/settings" },
  { label: "API Keys", icon: "vpn-key" as const, href: "/(tabs)/settings" },
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
  if (href === "/(tabs)/") {
    return pathname === "/(tabs)" || pathname === "/(tabs)/";
  }
  return pathname.startsWith(href);
}

function PulseDot(): React.JSX.Element {
  return (
    <View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#ff5e00",
        // @ts-expect-error -- web-only CSS property for animated pulse
        animation: "pulse 2s ease-in-out infinite",
      }}
    />
  );
}

export default function SidebarNav(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { data: agentsData } = useAgents();
  const agents = agentsData?.agents ?? [];
  const runningAgents = agents.filter((a: any) => a.deployment_status === "running");
  const otherAgents = agents.filter((a: any) => a.deployment_status !== "running");

  return (
    <View
      style={[
        { width: 240 },
        {
          // @ts-expect-error -- web-only CSS property
          background:
            "linear-gradient(180deg, rgba(19,16,24,0.95) 0%, rgba(10,8,16,0.98) 100%)",
        },
      ]}
      className="h-full border-r border-surface-border"
    >
      {/* Logo bar */}
      <View className="h-16 flex-row items-center px-5 border-b border-surface-border">
        <View
          style={[
            {
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: "#ff5e00",
              alignItems: "center",
              justifyContent: "center",
            },
            {
              background: "linear-gradient(135deg, #ff5e00, #dc2626)",
              boxShadow: "0 0 12px rgba(255,94,0,0.4)",
            } as WebStyle,
          ]}
        >
          <ClawLogo size={16} color="#fff" />
        </View>
        <Text className="ml-3 font-bold text-lg tracking-tight text-white uppercase font-mono">
          LIBERCLAW
        </Text>
      </View>

      {/* Active Agents section */}
      <View className="px-5 mt-6 mb-3">
        <Text className="font-mono text-xs text-claw-orange uppercase tracking-widest opacity-70">
          Active Agents
        </Text>
      </View>

      {/* Nav items */}
      <View className="px-2 flex-1">
        {/* Running agents */}
        {runningAgents.map((agent: any) => {
          const isActive = pathname.includes(`/agent/${agent.id}`) ||
            (pathname.includes("/chat"));

          if (isActive) {
            return (
              <Pressable
                key={agent.id}
                onPress={() => router.push(`/agent/${agent.id}/chat` as never)}
                className="flex-row items-center px-3 py-2.5 rounded-lg mb-1 bg-claw-orange/10 border border-claw-orange/30 relative overflow-hidden"
              >
                <View
                  style={[
                    {
                      position: "absolute",
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: 3,
                      backgroundColor: "#ff5e00",
                      borderRadius: 2,
                    },
                    { boxShadow: "0 0 8px rgba(255,94,0,0.6)" } as WebStyle,
                  ]}
                />
                <View className="w-8 h-8 rounded bg-surface-raised border border-claw-orange/20 items-center justify-center">
                  <MaterialIcons name="psychology" size={18} color="#ff5e00" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-bold text-sm text-white" numberOfLines={1}>{agent.name}</Text>
                  <View className="flex-row items-center gap-1.5 mt-0.5">
                    <PulseDot />
                    <Text className="text-[10px] text-claw-orange font-mono">ONLINE</Text>
                  </View>
                </View>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={agent.id}
              onPress={() => router.push(`/agent/${agent.id}/chat` as never)}
              style={(state) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 8,
                  marginBottom: 4,
                },
                (state as WebPressableState).hovered && {
                  backgroundColor: "rgba(255,255,255,0.05)",
                },
              ]}
            >
              <View className="w-8 h-8 rounded bg-surface-raised border border-white/10 items-center justify-center">
                <MaterialIcons name="smart-toy" size={18} color="#64748b" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="font-medium text-sm text-slate-400" numberOfLines={1}>{agent.name}</Text>
                <Text className="text-[10px] text-slate-500 font-mono mt-0.5">IDLE</Text>
              </View>
            </Pressable>
          );
        })}

        {/* Other agents (stopped/failed) */}
        {otherAgents.length > 0 && otherAgents.map((agent: any) => (
          <Pressable
            key={agent.id}
            onPress={() => router.push(`/agent/${agent.id}` as never)}
            style={(state) => [
              {
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 8,
                marginBottom: 4,
              },
              (state as WebPressableState).hovered && {
                backgroundColor: "rgba(255,255,255,0.05)",
              },
            ]}
          >
            <View className="w-8 h-8 rounded bg-surface-raised border border-white/10 items-center justify-center">
              <MaterialIcons name="smart-toy" size={18} color="#64748b" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="font-medium text-sm text-slate-400" numberOfLines={1}>{agent.name}</Text>
              <Text className="text-[10px] text-slate-500 font-mono mt-0.5">
                {agent.deployment_status === "failed" ? "FAILED" : "SLEEPING"}
              </Text>
            </View>
          </Pressable>
        ))}

        {/* Dashboard link */}
        <Pressable
          onPress={() => router.push("/(tabs)/" as never)}
          style={(state) => [
            {
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 8,
              marginBottom: 4,
              marginTop: 8,
            },
            (state as WebPressableState).hovered && {
              backgroundColor: "rgba(255,255,255,0.05)",
            },
            isActiveRoute(pathname, "/(tabs)/") && {
              backgroundColor: "rgba(255,94,0,0.1)",
              borderWidth: 1,
              borderColor: "rgba(255,94,0,0.3)",
            },
          ]}
        >
          <View className="w-8 h-8 rounded bg-surface-raised border border-white/10 items-center justify-center">
            <MaterialIcons name="dashboard" size={18} color={isActiveRoute(pathname, "/(tabs)/") ? "#ff5e00" : "#64748b"} />
          </View>
          <View className="ml-3 flex-1">
            <Text className={`font-medium text-sm ${isActiveRoute(pathname, "/(tabs)/") ? "text-white" : "text-slate-400"}`}>Dashboard</Text>
          </View>
        </Pressable>

        {/* System section */}
        <View className="mt-8 mb-3 px-3">
          <Text className="font-mono text-xs text-slate-600 uppercase tracking-widest">
            System
          </Text>
        </View>

        {SYSTEM_ITEMS.map((item) => {
          const active = isActiveRoute(pathname, item.href);

          return (
            <Pressable
              key={item.label}
              onPress={() => router.push(item.href as never)}
              style={(state) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  gap: 12,
                },
                (state as WebPressableState).hovered && {
                  backgroundColor: "rgba(255,255,255,0.05)",
                },
              ]}
            >
              <MaterialIcons
                name={item.icon}
                size={20}
                color={active ? "#ff5e00" : "#94a3b8"}
              />
              <Text
                className={`text-sm ${active ? "text-claw-orange font-medium" : "text-slate-400"}`}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Bottom section */}
      <View className="border-t border-surface-border p-4">
        {/* Terminate button */}
        <Pressable
          style={(state) => [
            {
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 10,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "rgba(255,0,60,0.3)",
              backgroundColor: "rgba(255,0,60,0.1)",
              gap: 8,
              width: "100%",
            },
            (state as WebPressableState).hovered && {
              backgroundColor: "rgba(255,0,60,0.2)",
            },
          ]}
        >
          <MaterialIcons name="power-settings-new" size={18} color="#ff003c" />
          <Text className="text-sm font-medium text-claw-red">Terminate</Text>
        </Pressable>

        {/* User profile */}
        {user ? (
          <View className="flex-row items-center mt-4">
            <View className="w-8 h-8 rounded-full bg-claw-orange items-center justify-center">
              <Text className="text-xs font-semibold text-white">
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
                  className="text-xs text-text-secondary"
                  numberOfLines={1}
                >
                  {user.email}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
