/**
 * TypeScript types mirroring the LiberClaw backend Pydantic schemas.
 */

// ── Auth ──────────────────────────────────────────────────────────────

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number; // seconds
}

// ── Users ─────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string | null;
  email_verified: boolean;
  display_name: string | null;
  avatar_url: string | null;
  tier: string;
  show_tool_calls: boolean;
  created_at: string;
}

export interface UserUpdate {
  display_name?: string | null;
  show_tool_calls?: boolean | null;
}

export interface Connection {
  id: string;
  type: "oauth" | "wallet";
  provider?: string | null;
  chain?: string | null;
  address?: string | null;
  email?: string | null;
  created_at: string;
}

export interface ApiKeyResponse {
  id: string;
  label: string;
  masked_key: string;
  is_active: boolean;
  created_at: string;
}

// ── Agents ────────────────────────────────────────────────────────────

export type DeploymentStatusValue =
  | "pending"
  | "deploying"
  | "running"
  | "failed"
  | "stopped";

export interface Agent {
  id: string;
  name: string;
  system_prompt: string;
  model: string;
  deployment_status: DeploymentStatusValue;
  vm_url: string | null;
  source: string;
  skills: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface AgentCreate {
  name: string;
  system_prompt?: string;
  model?: string;
  template_id?: string;
  skills?: string[];
}

export interface AgentUpdate {
  name?: string;
  system_prompt?: string;
  model?: string;
}

// ── Templates & Skills ───────────────────────────────────────────────

export interface SkillSummary {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface SkillDetail extends SkillSummary {
  content: string;
}

export interface SkillListResponse {
  skills: SkillSummary[];
}

export interface TemplateSummary {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  model: string;
  skills: string[];
  featured: boolean;
}

export interface TemplateDetail extends TemplateSummary {
  system_prompt: string;
}

export interface CategoryGroup {
  id: string;
  name: string;
  icon: string;
  description: string;
  templates: TemplateSummary[];
}

export interface TemplateListResponse {
  categories: CategoryGroup[];
}

export interface AgentListResponse {
  agents: Agent[];
  total: number;
}

export interface AgentHealthResponse {
  agent_id: string;
  healthy: boolean;
  vm_url: string | null;
}

export interface DeploymentStep {
  key: string;
  status: "pending" | "active" | "done" | "failed";
  detail: string | null;
}

export interface DeploymentLogEntry {
  timestamp: number;
  level: "info" | "success" | "error" | "warning";
  message: string;
}

export interface DeploymentStatus {
  agent_id: string;
  deployment_status: DeploymentStatusValue;
  vm_url: string | null;
  steps: DeploymentStep[];
  logs: DeploymentLogEntry[];
}

// ── Chat ──────────────────────────────────────────────────────────────

export type ChatMessageType =
  | "text"
  | "tool_use"
  | "file"
  | "error"
  | "done"
  | "keepalive";

export interface ChatMessage {
  type: ChatMessageType;
  content?: string;
  name?: string;
  input?: string;    // Tool arguments JSON (present on tool_use events)
  path?: string;     // File path (present on file events)
  caption?: string;  // File caption (present on file events)
}

export interface PendingMessagesResponse {
  messages: ChatMessage[];
}

// ── Usage ─────────────────────────────────────────────────────────────

export interface UsageSummary {
  daily_messages_used: number;
  daily_messages_limit: number;
  agent_count: number;
  agent_limit: number;
  tier: string;
}

export interface UsageDay {
  date: string;
  message_count: number;
}

export interface UsageHistory {
  days: UsageDay[];
}
