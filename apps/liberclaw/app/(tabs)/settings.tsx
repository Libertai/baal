import { View, Text, TouchableOpacity, Switch, ScrollView } from "react-native";
import { useAuth } from "@/lib/auth/provider";
import type { ApiKeyResponse } from "@/lib/api/types";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-6">
      <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
        {title}
      </Text>
      <View className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {children}
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string | null;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800"
      onPress={onPress}
      disabled={!onPress}
    >
      <Text className="text-base text-gray-900 dark:text-white">{label}</Text>
      {value != null && (
        <Text className="text-base text-gray-500 dark:text-gray-400">
          {value}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth();

  return (
    <ScrollView
      className="flex-1 bg-gray-50 dark:bg-gray-950"
      contentContainerStyle={{ padding: 16 }}
    >
      {/* Profile */}
      <Section title="Profile">
        <Row label="Name" value={user?.display_name ?? "Not set"} />
        <Row label="Email" value={user?.email ?? "Not set"} />
        <Row label="Tier" value={user?.tier ?? "free"} />
      </Section>

      {/* Preferences */}
      <Section title="Preferences">
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-base text-gray-900 dark:text-white">
            Show Tool Calls
          </Text>
          <Switch
            value={user?.show_tool_calls ?? true}
            onValueChange={() => {
              // TODO: call useUpdateProfile mutation
            }}
            trackColor={{ false: "#d1d5db", true: "#3b82f6" }}
          />
        </View>
      </Section>

      {/* API Keys */}
      <Section title="API Keys">
        <Row label="Manage API Keys" value="" onPress={() => {
          // TODO: navigate to API keys management screen
        }} />
      </Section>

      {/* Usage */}
      <Section title="Usage">
        <Row label="Daily Messages" value="--/--" />
        <Row label="Active Agents" value="--" />
      </Section>

      {/* Sign Out */}
      <TouchableOpacity
        className="bg-red-50 dark:bg-red-900/20 rounded-xl py-3 items-center mt-4"
        onPress={signOut}
      >
        <Text className="text-red-600 dark:text-red-400 font-semibold text-base">
          Sign Out
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
