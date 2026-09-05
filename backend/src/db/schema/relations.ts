import { relations } from "drizzle-orm";
import { users } from "@/db/schema/users";
import { workspaces } from "@/db/schema/workspaces";
import { workspaceMemberships } from "@/db/schema/workspace-memberships";
import { projects } from "@/db/schema/projects";
import { whiteboardDocuments } from "@/db/schema/whiteboard-documents";

export const usersRelations = relations(users, ({ many }) => ({
  ownedWorkspaces: many(workspaces),
  memberships: many(workspaceMemberships),
  createdProjects: many(projects),
  createdWhiteboardDocuments: many(whiteboardDocuments),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  memberships: many(workspaceMemberships),
  projects: many(projects),
}));

export const workspaceMembershipsRelations = relations(workspaceMemberships, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMemberships.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMemberships.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(users, {
    fields: [projects.creatorId],
    references: [users.id],
  }),
  whiteboardDocuments: many(whiteboardDocuments),
}));

export const whiteboardDocumentsRelations = relations(whiteboardDocuments, ({ one }) => ({
  project: one(projects, {
    fields: [whiteboardDocuments.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [whiteboardDocuments.creatorId],
    references: [users.id],
  }),
}));
