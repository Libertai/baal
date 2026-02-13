/**
 * Workspace tree hook — fetches and caches the agent's file tree.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getWorkspaceTree, uploadFile } from "@/lib/api/files";
import type { FileNode } from "@/lib/api/files";

export type { FileNode };

export function useWorkspace(agentId: string) {
  const queryClient = useQueryClient();

  const treeQuery = useQuery({
    queryKey: ["workspace", agentId],
    queryFn: () => getWorkspaceTree(agentId),
    enabled: !!agentId,
  });

  const upload = async (file: File, path?: string) => {
    const result = await uploadFile(agentId, file, path);
    queryClient.invalidateQueries({ queryKey: ["workspace", agentId] });
    return result;
  };

  return {
    tree: treeQuery.data?.tree ?? [],
    isLoading: treeQuery.isLoading,
    isError: treeQuery.isError,
    refetch: treeQuery.refetch,
    upload,
  };
}
