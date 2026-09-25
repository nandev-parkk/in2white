export const PROJECTS_ROUTE = '/workspaces/$workspaceId/projects' as const
export const MEMBERS_ROUTE = '/workspaces/$workspaceId/members' as const
export const SETTINGS_ROUTE = '/workspaces/$workspaceId/settings' as const
export const PROJECT_DETAIL_ROUTE =
  '/workspaces/$workspaceId/projects/$projectId' as const

export const WORKSPACE_NAV_ROUTES = {
  projects: PROJECTS_ROUTE,
  members: MEMBERS_ROUTE,
  settings: SETTINGS_ROUTE,
} as const
