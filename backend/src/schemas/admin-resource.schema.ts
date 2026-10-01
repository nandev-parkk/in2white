import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";

/*
 * 프로젝트와 화이트보드 문서는 둘 다 `deletedAt` 소프트 삭제를 쓴다. 두 목록이 같은 필터
 * 값을 받아야 어드민 화면의 토글 하나로 양쪽을 다룰 수 있다.
 *
 * 기본값은 `all`이다 — 삭제된 리소스가 기본으로 숨으면 복구 대상을 찾을 길이 없다.
 * 복구가 어드민 콘솔이 제품에 없는 기능을 제공하는 지점이다.
 */
export const resourceStatusFilterSchema = z.enum(["all", "active", "deleted"], {
  error: ERROR_MESSAGES.RESOURCE_STATUS_INVALID,
});

export type ResourceStatusFilter = z.infer<typeof resourceStatusFilterSchema>;
