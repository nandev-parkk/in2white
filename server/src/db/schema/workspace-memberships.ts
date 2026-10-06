import { pgEnum, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { users } from "@/db/schema/users";
import { workspaces } from "@/db/schema/workspaces";

export const workspaceMemberRole = pgEnum("workspace_member_role", ["owner", "member"]);

export const workspaceMemberships = pgTable(
  "workspace_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceMemberRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.workspaceId, table.userId)],
);

export const insertWorkspaceMembershipSchema = createInsertSchema(workspaceMemberships);
export const selectWorkspaceMembershipSchema = createSelectSchema(workspaceMemberships);
