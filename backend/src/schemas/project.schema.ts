import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";

const projectNameSchema = z
  .string({ error: ERROR_MESSAGES.PROJECT_NAME_REQUIRED })
  .trim()
  .min(1, ERROR_MESSAGES.PROJECT_NAME_REQUIRED)
  .max(50, ERROR_MESSAGES.PROJECT_NAME_TOO_LONG);

const projectDescriptionSchema = z
  .string({ error: ERROR_MESSAGES.PROJECT_DESCRIPTION_INVALID })
  .trim()
  .max(200, ERROR_MESSAGES.PROJECT_DESCRIPTION_TOO_LONG)
  .nullable()
  .optional()
  .transform((description) => description || null);

export const projectParamsSchema = z.object({
  workspaceId: z.uuid({ error: ERROR_MESSAGES.WORKSPACE_ID_INVALID }),
});

export const createProjectSchema = z.object({
  name: projectNameSchema,
  description: projectDescriptionSchema,
});
