import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";
import { resourceStatusFilterSchema } from "@/schemas/admin-resource.schema";
import { listQuerySchema } from "@/schemas/list-query.schema";

/*
 * 전역 목록이다. 프로젝트로 좁히는 것은 선택이고, 좁히지 않으면 모든 프로젝트의 문서를
 * 최신순으로 본다. 프로젝트 상세에도 문서 목록이 있지만 그쪽은 페이지를 나누지 않는다 —
 * 전역에서 삭제된 문서만 훑는 용도가 이 엔드포인트다.
 */
export const adminWhiteboardDocumentListQuerySchema = listQuerySchema.extend({
  projectId: z.uuid({ error: ERROR_MESSAGES.PROJECT_ID_INVALID }).optional(),
  status: resourceStatusFilterSchema.default("all"),
});

export const adminWhiteboardDocumentParamsSchema = z.object({
  documentId: z.uuid({ error: ERROR_MESSAGES.WHITEBOARD_DOCUMENT_ID_INVALID }),
});

export type AdminWhiteboardDocumentListQuery = z.infer<
  typeof adminWhiteboardDocumentListQuerySchema
>;
