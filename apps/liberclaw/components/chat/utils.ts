/**
 * Shared chat utilities: tool icons, formatting, markdown styles.
 */

import { Platform } from "react-native";
import type MaterialIcons from "@expo/vector-icons/MaterialIcons";

// ── Tool icon mapping ────────────────────────────────────────────────

export const TOOL_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  bash: "terminal",
  web_fetch: "language",
  web_search: "public",
  read_file: "folder-open",
  write_file: "save",
  edit_file: "edit",
  list_dir: "folder",
  spawn: "call-split",
};

export function getToolIcon(
  name: string | undefined,
): keyof typeof MaterialIcons.glyphMap {
  if (!name) return "build";
  return TOOL_ICONS[name] ?? "build";
}

// ── Tool name formatting ─────────────────────────────────────────────

export function formatToolName(name: string | undefined): string {
  if (!name) return "UNKNOWN";
  return name.replace(/_/g, " ").toUpperCase();
}

// ── Tool input formatting ────────────────────────────────────────────

export interface FormattedToolLine {
  text: string;
  isPrompt: boolean;
}

export function formatToolInput(
  name: string | undefined,
  input: string | undefined,
): FormattedToolLine[] {
  if (!input) return [];

  try {
    const args = typeof input === "string" ? JSON.parse(input) : input;

    switch (name) {
      case "bash":
        return [{ text: args.command ?? input, isPrompt: true }];

      case "web_search":
        return [{ text: `search: ${args.query ?? input}`, isPrompt: false }];

      case "web_fetch":
        return [{ text: `fetch: ${args.url ?? input}`, isPrompt: false }];

      case "read_file":
        return [{ text: args.path ?? args.file_path ?? input, isPrompt: false }];

      case "write_file":
      case "edit_file":
        return [{ text: args.path ?? args.file_path ?? input, isPrompt: false }];

      case "list_dir":
        return [{ text: args.path ?? args.directory ?? ".", isPrompt: false }];

      case "spawn":
        return [
          {
            text: `spawn: ${(args.task ?? input).slice(0, 120)}${(args.task ?? input).length > 120 ? "..." : ""}`,
            isPrompt: false,
          },
        ];

      default: {
        const pretty = JSON.stringify(args, null, 2);
        return pretty.split("\n").map((line) => ({ text: line, isPrompt: false }));
      }
    }
  } catch {
    return [{ text: input, isPrompt: false }];
  }
}

// ── Tool output parsing (for future result streaming) ────────────────

export interface OutputLine {
  text: string;
  isPrompt: boolean;
  isSuccess: boolean;
}

export function parseToolOutput(content: string | undefined): OutputLine[] {
  if (!content) return [];
  return content.split("\n").map((line) => ({
    text: line,
    isPrompt: line.trimStart().startsWith("$"),
    isSuccess:
      line.includes("success") ||
      line.includes("ok") ||
      line.includes("done") ||
      line.includes("created") ||
      line.includes("✓"),
  }));
}

// ── Timestamp helper ─────────────────────────────────────────────────

export function formatTimestamp(): string {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, "0");
  const m = now.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

// ── Markdown styles ──────────────────────────────────────────────────

export const markdownStyles = {
  body: { color: "#cbd5e1", fontSize: 15, lineHeight: 22 },
  code_inline: {
    backgroundColor: "#1a1424",
    color: "#ff5e00",
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  fence: {
    backgroundColor: "#131018",
    color: "#f0ede8",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a2235",
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  link: { color: "#ff5e00" },
  heading1: { color: "#f0ede8" },
  heading2: { color: "#f0ede8" },
  heading3: { color: "#f0ede8" },
};
