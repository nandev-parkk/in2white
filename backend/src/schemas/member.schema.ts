import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";

export const memberParamsSchema = z.object({
  workspaceId: z.uuid({ error: ERROR_MESSAGES.WORKSPACE_ID_INVALID }),
});

export const addMemberBodySchema = z
  .object({
    userId: z.uuid({ error: ERROR_MESSAGES.USER_ID_INVALID }),
  })
  .strict();
