/**
 * Workspace file browser panel.
 *
 * Desktop: right-side panel alongside chat (320px wide).
 * Mobile: bottom sheet overlay.
 */

import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
  Linking,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { getFileDownloadUrl } from "@/lib/api/files";
import { getTokens } from "@/lib/auth/storage";
import type { FileNode } from "@/lib/api/files";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function formatSize(bytes: number | undefined): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── FileTreeNode ──────────────────────────────────────────────────────

function FileTreeNode({
  node,
  agentId,
  depth = 0,
}: {
  node: FileNode;
  agentId: string;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth === 0);

  const handleFilePress = async () => {
    const url = getFileDownloadUrl(agentId, node.path);
    if (Platform.OS === "web") {
      try {
        const tokens = await getTokens();
        const resp = await fetch(url, {
          headers: { Authorization: `Bearer ${tokens?.access_token}` },
        });
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = node.name;
        a.click();
        URL.revokeObjectURL(blobUrl);
      } catch {
        window.open(url, "_blank");
      }
    } else {
      Linking.openURL(url);
    }
  };

  if (node.type === "dir") {
    return (
      <View>
        <TouchableOpacity
          className="flex-row items-center py-1.5"
          style={{ paddingLeft: depth * 16 + 8 }}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name={expanded ? "folder-open" : "folder"}
            size={16}
            color="#ff5e00"
            style={{ marginRight: 6 }}
          />
          <Text className="text-sm text-text-primary flex-1" numberOfLines={1}>
            {node.name}
          </Text>
          <MaterialIcons
            name={expanded ? "expand-less" : "expand-more"}
            size={14}
            color="#5a5464"
            style={{ marginRight: 8 }}
          />
        </TouchableOpacity>
        {expanded &&
          node.children?.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              agentId={agentId}
              depth={depth + 1}
            />
          ))}
      </View>
    );
  }

  const isImg = IMAGE_EXTENSIONS.has(getExtension(node.name));

  return (
    <TouchableOpacity
      className="flex-row items-center py-1.5"
      style={{ paddingLeft: depth * 16 + 8 }}
      onPress={handleFilePress}
      activeOpacity={0.7}
    >
      <MaterialIcons
        name={isImg ? "image" : "description"}
        size={16}
        color="#8a8494"
        style={{ marginRight: 6 }}
      />
      <Text
        className="text-sm text-text-secondary flex-1"
        numberOfLines={1}
      >
        {node.name}
      </Text>
      {node.size != null && (
        <Text
          className="text-[10px] font-mono text-text-tertiary mr-2"
        >
          {formatSize(node.size)}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ── FilePanel ─────────────────────────────────────────────────────────

interface FilePanelProps {
  agentId: string;
  visible: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
  isUpgrading?: boolean;
}

export default function FilePanel({
  agentId,
  visible,
  onClose,
  onUpgrade,
  isUpgrading = false,
}: FilePanelProps) {
  const { tree, isLoading, isError, refetch, upload } = useWorkspace(agentId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(() => {
    if (Platform.OS === "web") {
      fileInputRef.current?.click();
    }
    // TODO: native file picker via expo-document-picker
  }, []);

  const handleFileSelected = useCallback(
    async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      try {
        await upload(file);
      } catch {
        // upload error — silently ignore for now
      }
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [upload],
  );

  if (!visible) return null;

  const isDesktop = Platform.OS === "web" && Dimensions.get("window").width >= 1024;

  const content = (
    <>
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4 py-3"
        style={{
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255, 255, 255, 0.08)",
        }}
      >
        <Text className="text-sm font-bold text-text-primary">
          Workspace Files
        </Text>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            className="p-1.5 rounded"
            onPress={() => refetch()}
            activeOpacity={0.7}
          >
            <MaterialIcons name="refresh" size={18} color="#8a8494" />
          </TouchableOpacity>
          <TouchableOpacity
            className="p-1.5 rounded"
            onPress={handleUpload}
            activeOpacity={0.7}
          >
            <MaterialIcons name="upload-file" size={18} color="#ff5e00" />
          </TouchableOpacity>
          {!isDesktop && (
            <TouchableOpacity
              className="p-1.5 rounded"
              onPress={onClose}
              activeOpacity={0.7}
            >
              <MaterialIcons name="close" size={18} color="#8a8494" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Hidden file input (web) */}
      {Platform.OS === "web" && (
        <input
          ref={fileInputRef as any}
          type="file"
          style={{ display: "none" }}
          onChange={handleFileSelected}
        />
      )}

      {/* Tree */}
      <ScrollView className="flex-1 py-2">
        {isLoading ? (
          <View className="items-center py-8">
            <Text className="text-text-tertiary text-xs">Loading...</Text>
          </View>
        ) : isError ? (
          <View className="items-center px-4 py-8">
            <MaterialIcons name="system-update" size={32} color="#ff5e00" />
            <Text className="text-sm text-claw-orange font-semibold mt-3 mb-1 text-center">
              Agent upgrade required
            </Text>
            <Text className="text-xs text-text-tertiary text-center mb-4">
              This agent is running an older version that doesn't support file browsing. Upgrade to get the latest features.
            </Text>
            {onUpgrade && (
              <TouchableOpacity
                className="bg-claw-orange rounded-lg px-6 py-2.5 flex-row items-center gap-2"
                onPress={onUpgrade}
                disabled={isUpgrading}
                activeOpacity={0.8}
              >
                {isUpgrading ? (
                  <Text className="text-white font-bold text-sm">Upgrading...</Text>
                ) : (
                  <>
                    <MaterialIcons name="system-update" size={16} color="#ffffff" />
                    <Text className="text-white font-bold text-sm">Upgrade Agent</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : tree.length === 0 ? (
          <View className="items-center py-8">
            <MaterialIcons name="folder-open" size={32} color="#5a5464" />
            <Text className="text-text-tertiary text-xs mt-2">
              Workspace is empty
            </Text>
          </View>
        ) : (
          tree.map((node) => (
            <FileTreeNode key={node.path} node={node} agentId={agentId} />
          ))
        )}
      </ScrollView>
    </>
  );

  // Desktop: side panel
  if (isDesktop) {
    return (
      <View
        style={{
          width: 320,
          backgroundColor: "#0a0810",
          borderLeftWidth: 1,
          borderLeftColor: "rgba(255, 255, 255, 0.08)",
        }}
      >
        {content}
      </View>
    );
  }

  // Mobile: bottom sheet overlay
  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "60%",
        backgroundColor: "#0a0810",
        borderTopWidth: 1,
        borderTopColor: "rgba(255, 255, 255, 0.08)",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        zIndex: 50,
      }}
    >
      {/* Drag handle */}
      <View className="items-center py-2">
        <View
          className="w-10 h-1 rounded-full"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.2)" }}
        />
      </View>
      {content}
    </View>
  );
}
