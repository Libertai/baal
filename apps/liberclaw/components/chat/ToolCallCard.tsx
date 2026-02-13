/**
 * Expandable tool call card showing tool name, status, and formatted arguments.
 */

import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ChatMessage } from "@/lib/api/types";
import { getToolIcon, formatToolName, formatToolInput } from "./utils";

interface ToolCallCardProps {
  message: ChatMessage;
  isCompleted?: boolean;
}

export default function ToolCallCard({ message, isCompleted = true }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(true);
  const toolIcon = getToolIcon(message.name);
  const lines = formatToolInput(message.name, message.input);

  return (
    <TouchableOpacity
      className="mb-3 rounded-lg border overflow-hidden"
      style={{ borderColor: "rgba(255, 94, 0, 0.5)" }}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.8}
    >
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4 py-2"
        style={{
          backgroundColor: "rgba(255, 94, 0, 0.1)",
          borderBottomWidth: expanded ? 1 : 0,
          borderBottomColor: "rgba(255, 94, 0, 0.2)",
        }}
      >
        <View className="flex-row items-center">
          <MaterialIcons
            name={toolIcon}
            size={14}
            color="#ff5e00"
            style={{ marginRight: 8 }}
          />
          <Text
            className="font-mono text-xs font-bold tracking-wider"
            style={{ color: "#ff5e00" }}
          >
            TOOL: {formatToolName(message.name)}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Text
            className="font-mono text-[10px] tracking-wider mr-2"
            style={{ color: isCompleted ? "#00e676" : "rgba(255, 94, 0, 0.7)" }}
          >
            {isCompleted ? "COMPLETED" : "EXECUTING"}
          </Text>
          <MaterialIcons
            name={expanded ? "expand-less" : "expand-more"}
            size={16}
            color="#8a8494"
          />
        </View>
      </View>

      {/* Body (expandable) */}
      {expanded && lines.length > 0 && (
        <View className="p-4" style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}>
          {lines.map((line, i) => (
            <Text
              key={i}
              className="font-mono text-xs leading-5"
              style={{ color: "#8a8494" }}
            >
              {line.isPrompt && (
                <Text style={{ color: "#ff3366" }}>$ </Text>
              )}
              {line.isPrompt ? line.text : line.text}
            </Text>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}
