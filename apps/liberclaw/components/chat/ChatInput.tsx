/**
 * Unified chat input card matching the design reference.
 *
 * Floating on web with gradient fade + orange glow behind the card.
 * Simple border-t on native.
 */

import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Toggle from "@/components/ui/Toggle";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  showInternals: boolean;
  onToggleInternals: (value: boolean) => void;
}

export default function ChatInput({
  onSend,
  disabled = false,
  showInternals,
  onToggleInternals,
}: ChatInputProps) {
  const [input, setInput] = useState("");

  const canSend = input.trim().length > 0 && !disabled;

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || disabled) return;
    setInput("");
    onSend(text);
  }, [input, disabled, onSend]);

  return (
    <View
      style={[
        Platform.OS === "web"
          ? ({
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              paddingHorizontal: 24,
              paddingBottom: 0,
              paddingTop: 0,
              backgroundColor: "#0a0810",
              zIndex: 20,
            } as any)
          : {
              borderTopWidth: 1,
              borderTopColor: "#2a2235",
            },
      ]}
    >
      <View
        style={{
          maxWidth: 896,
          width: "100%",
          alignSelf: "center",
        }}
      >
        {/* Card with orange glow via box-shadow (web only) */}
        <View
          className="rounded-xl overflow-hidden"
          style={[
            {
              backgroundColor: "#131018",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.1)",
            },
            Platform.OS === "web" &&
              ({
                boxShadow: "0 0 20px rgba(255, 94, 0, 0.3), 0 0 8px rgba(220, 38, 38, 0.2)",
              } as any),
          ]}
        >
          {/* Toolbar row */}
          <View
            className="flex-row items-center justify-between px-4 py-2"
            style={{
              borderBottomWidth: 1,
              borderBottomColor: "rgba(255, 255, 255, 0.05)",
            }}
          >
            <View className="flex-row items-center">
              <View className="flex-row items-center gap-2">
                <Toggle
                  value={showInternals}
                  onValueChange={onToggleInternals}
                />
                <Text className="text-xs font-mono text-slate-400 uppercase">
                  Show Internals
                </Text>
              </View>
            </View>
            <View className="flex-row items-center">
              <TouchableOpacity
                className="p-1.5 rounded"
                activeOpacity={0.7}
              >
                <MaterialIcons name="upload-file" size={18} color="#5a5464" />
              </TouchableOpacity>
              <TouchableOpacity
                className="p-1.5 rounded ml-1"
                activeOpacity={0.7}
              >
                <MaterialIcons name="mic" size={18} color="#5a5464" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Textarea + send button */}
          <View style={{ position: "relative" }}>
            <TextInput
              className="px-4 py-4 text-base text-text-primary"
              placeholder="Command the agent..."
              placeholderTextColor="#5a5464"
              multiline
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
              style={{
                backgroundColor: "transparent",
                maxHeight: 120,
                paddingRight: 52,
                fontFamily: "Inter",
              }}
            />
            <View
              style={{
                position: "absolute",
                bottom: 12,
                right: 12,
              }}
            >
              <TouchableOpacity
                className="w-9 h-9 rounded-lg items-center justify-center"
                style={[
                  { backgroundColor: canSend ? "#ff5e00" : "#2a2235" },
                  canSend &&
                    Platform.OS === "web" &&
                    ({
                      boxShadow: "0 0 15px rgba(255, 94, 0, 0.4)",
                    } as any),
                  canSend &&
                    Platform.OS === "web" &&
                    ({
                      transition: "box-shadow 0.2s, background-color 0.2s",
                    } as any),
                ]}
                onPress={handleSend}
                disabled={!canSend}
                activeOpacity={0.8}
              >
                <MaterialIcons name="send" size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Status footer (web only) */}
        {Platform.OS === "web" && (
          <View className="py-3 items-center">
            <Text className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
              LiberClaw Autonomous Environment v1.0.0 •{" "}
              <Text className="text-claw-orange">System Secure</Text>
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
