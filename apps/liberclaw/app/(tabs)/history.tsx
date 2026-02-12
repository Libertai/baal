import { View, Text, ScrollView } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function HistoryScreen(): React.JSX.Element {
  return (
    <ScrollView className="flex-1 bg-surface-base" contentContainerStyle={{ padding: 16 }}>
      <Text className="text-2xl font-bold text-text-primary mb-6">Activity History</Text>
      <View className="bg-surface-raised border border-surface-border rounded-2xl p-6 items-center">
        <MaterialIcons name="history" size={48} color="#5a5464" />
        <Text className="text-text-secondary mt-4 text-center">Chat history will appear here</Text>
      </View>
    </ScrollView>
  );
}
