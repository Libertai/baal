/**
 * File API — workspace tree, upload, and download helpers.
 */

import { apiFetch, API_BASE_URL } from "./client";
import { getTokens } from "@/lib/auth/storage";

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  children?: FileNode[];
}

export interface WorkspaceTree {
  tree: FileNode[];
}

export async function getWorkspaceTree(
  agentId: string,
): Promise<WorkspaceTree> {
  return apiFetch<WorkspaceTree>(`/files/${agentId}/tree`);
}

export async function uploadFile(
  agentId: string,
  file: File | { uri: string; name: string; type: string },
  path?: string,
): Promise<{ path: string; size: number; name: string }> {
  const formData = new FormData();
  formData.append("file", file as any);
  if (path) formData.append("path", path);

  const tokens = await getTokens();
  const res = await fetch(`${API_BASE_URL}/files/${agentId}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokens?.access_token}` },
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

export function getFileDownloadUrl(
  agentId: string,
  filePath: string,
): string {
  return `${API_BASE_URL}/files/${agentId}/${filePath}`;
}
