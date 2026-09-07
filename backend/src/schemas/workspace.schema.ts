import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";

const workspaceNameSchema = z
  .string({ error: ERROR_MESSAGES.WORKSPACE_NAME_REQUIRED })
  .trim()
  .min(1, ERROR_MESSAGES.WORKSPACE_NAME_REQUIRED)
  .max(255, ERROR_MESSAGES.WORKSPACE_NAME_TOO_LONG);

export const createWorkspaceSchema = z.object({ name: workspaceNameSchema });
export const updateWorkspaceSchema = z.object({ name: workspaceNameSchema });
