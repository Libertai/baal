/**
 * Chat header bar — shows agent name, model, node, and status.
 */

import { View, Text, TouchableOpacity, Platform } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { Agent } from "@/lib/api/types";

const STATUS_CONFIG = {
  running: { label: "ONLINE", color: "#00e676", glow: "0 0 8px #00e676" },
  deploying: { label: "DEPLOYING", color: "#ffab00", glow: "0 0 8px #ffab00" },
  failed: { label: "OFFLINE", color: "#ff1744", glow: "0 0 8px #ff1744" },
  stopped: { label: "STOPPED", color: "#546e7a", glow: "none" },
  pending: { label: "PENDING", color: "#ffab00", glow: "0 0 8px #ffab00" },
} as const;

function extractNodeId(vmUrl: string | null | undefined): string {
  if (!vmUrl) return "LOCAL";
  try {
    const hostname = new URL(vmUrl).hostname;
    // e.g., "abc123.2n6.me" → "ABC123"
    const sub = hostname.split(".")[0];
    return sub.toUpperCase().slice(0, 8);
  } catch {
    return "UNKNOWN";
  }
}

interface ChatHeaderProps {
  agent: Agent | undefined;
  onHistoryPress?: () => void;
  onMorePress?: () => void;
}

export default function ChatHeader({
  agent,
  onHistoryPress,
  onMorePress,
}: ChatHeaderProps) {
  const status = agent?.deployment_status ?? "pending";
  const cfg = STATUS_CONFIG[status];
  const nodeId = extractNodeId(agent?.vm_url);

  return (
    <View
      className="h-16 px-6 border-b border-surface-border flex-row items-center justify-between"
      style={[
        {
          backgroundColor: "rgba(10, 8, 16, 0.95)",
          zIndex: 30,
          flexShrink: 0,
        },
        Platform.OS === "web" &&
          ({ backdropFilter: "blur(8px)" } as any),
      ]}
    >
      {/* Left: agent info */}
      <View className="flex-row items-center gap-4">
        <View>
          <View className="flex-row items-center gap-2">
            <Text className="text-white font-bold text-lg">
              {agent?.name ?? "Chat"}
            </Text>
            <View className="px-2 py-0.5 rounded bg-claw-orange/20 border border-claw-orange/40">
              <Text className="text-claw-orange text-[10px] font-mono uppercase tracking-wide">
                {agent?.model ?? "agent"}
              </Text>
            </View>
          </View>
          <Text className="text-xs text-slate-500 font-mono">
            Running on Node:{" "}
            <Text className="text-claw-orange">{nodeId}</Text>
          </Text>
        </View>
      </View>

      {/* Right: status + actions */}
      <View className="flex-row items-center gap-4">
        <View className="flex-row items-center gap-2 px-3 py-1.5 rounded-full bg-black border border-surface-border">
          <View
            className="w-2 h-2 rounded-full"
            style={[
              { backgroundColor: cfg.color },
              Platform.OS === "web" &&
                status === "running" &&
                ({
                  animation: "pulse 2s ease-in-out infinite",
                  boxShadow: cfg.glow,
                } as any),
            ]}
          />
          <Text className="text-xs font-mono text-slate-400">
            {cfg.label}
          </Text>
        </View>
        {onHistoryPress && (
          <TouchableOpacity className="p-2" onPress={onHistoryPress}>
            <MaterialIcons name="history" size={22} color="#94a3b8" />
          </TouchableOpacity>
        )}
        {onMorePress && (
          <TouchableOpacity className="p-2" onPress={onMorePress}>
            <MaterialIcons name="more-vert" size={22} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
