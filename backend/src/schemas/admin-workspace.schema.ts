import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";
import { listQuerySchema } from "@/schemas/list-query.schema";
import { workspaceNameSchema } from "@/schemas/workspace.schema";

/* 목록은 이름·소유자로만 좁힌다. 기본 워크스페이스 여부는 목록 응답에 그대로 보여준다. */
export const adminWorkspaceListQuerySchema = listQuerySchema;

export const adminWorkspaceParamsSchema = z.object({
  workspaceId: z.uuid({ error: ERROR_MESSAGES.WORKSPACE_ID_INVALID }),
});

export const adminWorkspaceMemberParamsSchema = adminWorkspaceParamsSchema.extend({
  userId: z.uuid({ error: ERROR_MESSAGES.USER_ID_INVALID }),
});

/* 어드민도 이름만 바꾼다. 소유자·기본 여부는 전용 엔드포인트와 불변식이 관리한다. */
export const updateWorkspaceSchema = z.object({ name: workspaceNameSchema }).strict();

const targetUserIdSchema = z.uuid({ error: ERROR_MESSAGES.USER_ID_INVALID });

export const transferWorkspaceOwnerSchema = z.object({ userId: targetUserIdSchema }).strict();

/* 추가되는 멤버의 role은 항상 `member`다. 소유자 지정은 소유자 이전으로만 한다. */
export const addWorkspaceMemberSchema = z.object({ userId: targetUserIdSchema }).strict();

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type TransferWorkspaceOwnerInput = z.infer<typeof transferWorkspaceOwnerSchema>;
export type AddWorkspaceMemberInput = z.infer<typeof addWorkspaceMemberSchema>;
