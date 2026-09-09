import type { WorkspaceSummary } from '../api/workspace'

export function selectDefaultWorkspace(
  workspaces: WorkspaceSummary[],
): WorkspaceSummary | null {
  return workspaces.find(({ isDefault }) => isDefault) ?? workspaces[0] ?? null
}
