/**
 * TanStack Query hooks for templates and skills.
 */

import { useQuery } from "@tanstack/react-query";
import { listTemplates, getTemplate, listSkills } from "@/lib/api/templates";

export const TEMPLATES_QUERY_KEY = ["templates"] as const;
export const SKILLS_QUERY_KEY = ["skills"] as const;

export function useTemplates() {
  return useQuery({
    queryKey: TEMPLATES_QUERY_KEY,
    queryFn: listTemplates,
    staleTime: 5 * 60 * 1000, // 5 min — catalog rarely changes
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ["template", id],
    queryFn: () => getTemplate(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSkills() {
  return useQuery({
    queryKey: SKILLS_QUERY_KEY,
    queryFn: listSkills,
    staleTime: 5 * 60 * 1000,
  });
}
