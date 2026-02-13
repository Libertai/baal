/**
 * File card — renders agent-sent file events as downloadable cards.
 * Shows inline preview for images, download button for all files.
 */

import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Image, Linking, Platform } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { getFileDownloadUrl } from "@/lib/api/files";
import { getTokens } from "@/lib/auth/storage";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

function isImage(filename: string): boolean {
  return IMAGE_EXTENSIONS.has(getExtension(filename));
}

function formatSize(bytes: number | undefined): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileCardProps {
  agentId: string;
  path: string;
  caption?: string;
  size?: number;
}

export default function FileCard({ agentId, path, caption, size }: FileCardProps) {
  const filename = path.includes("/") ? path.split("/").pop()! : path;
  const downloadUrl = getFileDownloadUrl(agentId, path);
  const showPreview = isImage(filename);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  // Fetch image with auth headers and create a blob URL for preview
  useEffect(() => {
    if (!showPreview) return;
    let revoke: string | null = null;
    (async () => {
      try {
        const tokens = await getTokens();
        const resp = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${tokens?.access_token}` },
        });
        if (!resp.ok) return;
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        revoke = url;
        setPreviewUri(url);
      } catch {
        // Preview unavailable — download still works
      }
    })();
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [downloadUrl, showPreview]);

  const handleDownload = async () => {
    if (Platform.OS === "web") {
      // Open in new tab with auth header via fetch + blob
      try {
        const tokens = await getTokens();
        const resp = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${tokens?.access_token}` },
        });
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        // Fallback: just open URL
        window.open(downloadUrl, "_blank");
      }
    } else {
      Linking.openURL(downloadUrl);
    }
  };

  return (
    <View
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: "rgba(255, 94, 0, 0.5)" }}
    >
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4 py-2"
        style={{
          backgroundColor: "rgba(255, 94, 0, 0.1)",
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255, 94, 0, 0.2)",
        }}
      >
        <View className="flex-row items-center flex-1 mr-2">
          <MaterialIcons
            name={showPreview ? "image" : "attach-file"}
            size={14}
            color="#ff5e00"
            style={{ marginRight: 8 }}
          />
          <Text
            className="font-mono text-xs font-bold tracking-wider flex-1"
            style={{ color: "#ff5e00" }}
            numberOfLines={1}
          >
            {filename}
          </Text>
          {size != null && (
            <Text className="font-mono text-[10px] ml-2" style={{ color: "#8a8494" }}>
              {formatSize(size)}
            </Text>
          )}
        </View>
        <TouchableOpacity
          className="p-1.5 rounded"
          onPress={handleDownload}
          activeOpacity={0.7}
        >
          <MaterialIcons name="download" size={18} color="#ff5e00" />
        </TouchableOpacity>
      </View>

      {/* Image preview */}
      {showPreview && previewUri && (
        <View className="p-3" style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}>
          <Image
            source={{ uri: previewUri }}
            style={{
              width: "100%",
              height: 200,
              borderRadius: 6,
            }}
            resizeMode="contain"
          />
        </View>
      )}

      {/* Caption */}
      {caption ? (
        <View
          className="px-4 py-2"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
        >
          <Text className="text-xs" style={{ color: "#8a8494" }}>
            {caption}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
