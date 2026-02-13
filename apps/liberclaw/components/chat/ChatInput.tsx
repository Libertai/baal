/**
 * Unified chat input card matching the design reference.
 *
 * Floating on web with gradient fade + orange glow behind the card.
 * Simple border-t on native.
 */

import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Toggle from "@/components/ui/Toggle";

export interface PendingFile {
  file: File;
  name: string;
  size: number;
  preview?: string;
}

interface ChatInputProps {
  onSend: (text: string, files?: PendingFile[]) => void;
  disabled?: boolean;
  showInternals: boolean;
  onToggleInternals: (value: boolean) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ChatInput({
  onSend,
  disabled = false,
  showInternals,
  onToggleInternals,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSend = (input.trim().length > 0 || pendingFiles.length > 0) && !disabled;

  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles: PendingFile[] = [];
    for (const file of Array.from(files)) {
      const pending: PendingFile = {
        file,
        name: file.name,
        size: file.size,
      };
      // Generate preview for images
      if (file.type.startsWith("image/")) {
        pending.preview = URL.createObjectURL(file);
      }
      newFiles.push(pending);
    }
    setPendingFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if ((!text && pendingFiles.length === 0) || disabled) return;
    setInput("");
    const files = pendingFiles.length > 0 ? [...pendingFiles] : undefined;
    setPendingFiles([]);
    onSend(text, files);
  }, [input, pendingFiles, disabled, onSend]);

  const handleAttachPress = useCallback(() => {
    if (Platform.OS === "web") {
      fileInputRef.current?.click();
    }
    // TODO: native picker via expo-document-picker
  }, []);

  const handleFileSelected = useCallback(
    (e: any) => {
      const files = e.target?.files;
      if (files?.length) addFiles(files);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [addFiles],
  );

  // Web drag-and-drop handlers
  const dragHandlers =
    Platform.OS === "web"
      ? {
          onDragOver: (e: any) => {
            e.preventDefault();
            setIsDragOver(true);
          },
          onDragLeave: () => setIsDragOver(false),
          onDrop: (e: any) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer?.files?.length) {
              addFiles(e.dataTransfer.files);
            }
          },
        }
      : {};

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
              borderWidth: isDragOver ? 2 : 1,
              borderColor: isDragOver
                ? "#ff5e00"
                : "rgba(255, 255, 255, 0.1)",
            },
            Platform.OS === "web" &&
              ({
                boxShadow: "0 0 20px rgba(255, 94, 0, 0.3), 0 0 8px rgba(220, 38, 38, 0.2)",
              } as any),
          ]}
          {...dragHandlers}
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
                onPress={handleAttachPress}
              >
                <MaterialIcons
                  name="upload-file"
                  size={18}
                  color={pendingFiles.length > 0 ? "#ff5e00" : "#5a5464"}
                />
              </TouchableOpacity>
              <TouchableOpacity
                className="p-1.5 rounded ml-1"
                activeOpacity={0.7}
              >
                <MaterialIcons name="mic" size={18} color="#5a5464" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Hidden file input (web) */}
          {Platform.OS === "web" && (
            <input
              ref={fileInputRef as any}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={handleFileSelected}
            />
          )}

          {/* Pending file chips */}
          {pendingFiles.length > 0 && (
            <View
              className="flex-row flex-wrap gap-2 px-4 py-2"
              style={{
                borderBottomWidth: 1,
                borderBottomColor: "rgba(255, 255, 255, 0.05)",
              }}
            >
              {pendingFiles.map((pf, i) => (
                <View
                  key={`${pf.name}-${i}`}
                  className="flex-row items-center rounded-lg px-3 py-1.5"
                  style={{
                    backgroundColor: "rgba(255, 94, 0, 0.1)",
                    borderWidth: 1,
                    borderColor: "rgba(255, 94, 0, 0.3)",
                  }}
                >
                  <MaterialIcons
                    name={pf.file.type?.startsWith("image/") ? "image" : "description"}
                    size={14}
                    color="#ff5e00"
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    className="text-xs font-mono mr-1"
                    style={{ color: "#ff5e00", maxWidth: 120 }}
                    numberOfLines={1}
                  >
                    {pf.name}
                  </Text>
                  <Text className="text-[10px] font-mono mr-2" style={{ color: "#8a8494" }}>
                    {formatSize(pf.size)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => removeFile(i)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialIcons name="close" size={14} color="#8a8494" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

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
