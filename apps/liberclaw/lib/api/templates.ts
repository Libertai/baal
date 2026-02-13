/**
 * Template gallery and skills library API calls.
 */

import { apiFetch } from "./client";
import type {
  TemplateListResponse,
  TemplateDetail,
  SkillListResponse,
  SkillDetail,
} from "./types";

export async function listTemplates(): Promise<TemplateListResponse> {
  return apiFetch<TemplateListResponse>("/templates/", { noAuth: true });
}

export async function getTemplate(id: string): Promise<TemplateDetail> {
  return apiFetch<TemplateDetail>(`/templates/${id}`, { noAuth: true });
}

export async function listSkills(): Promise<SkillListResponse> {
  return apiFetch<SkillListResponse>("/skills/", { noAuth: true });
}

export async function getSkill(id: string): Promise<SkillDetail> {
  return apiFetch<SkillDetail>(`/skills/${id}`, { noAuth: true });
}
