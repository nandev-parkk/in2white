import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";

const projectNameSchema = z
  .string({ error: ERROR_MESSAGES.PROJECT_NAME_REQUIRED })
  .trim()
  .min(1, ERROR_MESSAGES.PROJECT_NAME_REQUIRED)
  .max(50, ERROR_MESSAGES.PROJECT_NAME_TOO_LONG);

const projectDescriptionValueSchema = z
  .string({ error: ERROR_MESSAGES.PROJECT_DESCRIPTION_INVALID })
  .trim()
  .max(200, ERROR_MESSAGES.PROJECT_DESCRIPTION_TOO_LONG)
  .nullable();

const createProjectDescriptionSchema = projectDescriptionValueSchema
  .optional()
  .transform((description) => description || null);

const updateProjectDescriptionSchema = projectDescriptionValueSchema
  .optional()
  .transform((description) => {
    if (description === undefined) {
      return undefined;
    }

    return description || null;
  });

export const projectParamsSchema = z.object({
  workspaceId: z.uuid({ error: ERROR_MESSAGES.WORKSPACE_ID_INVALID }),
});

export const createProjectSchema = z.object({
  name: projectNameSchema,
  description: createProjectDescriptionSchema,
});

export const projectUpdateParamsSchema = z.object({
  workspaceId: z.uuid({ error: ERROR_MESSAGES.WORKSPACE_ID_INVALID }),
  projectId: z.uuid({ error: ERROR_MESSAGES.PROJECT_ID_INVALID }),
});

export const updateProjectSchema = z
  .object({
    name: projectNameSchema.optional(),
    description: updateProjectDescriptionSchema,
  })
  .refine(({ name, description }) => name !== undefined || description !== undefined, {
    message: ERROR_MESSAGES.PROJECT_UPDATE_FIELDS_REQUIRED,
  });
