import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";
import { resourceStatusFilterSchema } from "@/schemas/admin-resource.schema";
import { listQuerySchema } from "@/schemas/list-query.schema";

/*
 * 전역 목록이다. 워크스페이스로 좁히는 것은 선택이고, 좁히지 않으면 모든 워크스페이스의
 * 프로젝트를 최신순으로 본다. 어드민은 신고받은 프로젝트를 이름으로 찾는다.
 */
export const adminProjectListQuerySchema = listQuerySchema.extend({
  workspaceId: z.uuid({ error: ERROR_MESSAGES.WORKSPACE_ID_INVALID }).optional(),
  status: resourceStatusFilterSchema.default("all"),
});

export const adminProjectParamsSchema = z.object({
  projectId: z.uuid({ error: ERROR_MESSAGES.PROJECT_ID_INVALID }),
});

export type AdminProjectListQuery = z.infer<typeof adminProjectListQuerySchema>;
