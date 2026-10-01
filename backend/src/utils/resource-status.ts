import { isNotNull, isNull } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { ResourceStatusFilter } from "@/schemas/admin-resource.schema";

/*
 * 프로젝트와 화이트보드 문서가 같은 필터를 쓴다. `all`은 조건을 만들지 않으므로 호출자는
 * 반환값을 그대로 `and(...)`에 넘길 수 있다 — drizzle은 `undefined` 조건을 무시한다.
 */
export function resourceStatusCondition(status: ResourceStatusFilter, deletedAt: AnyPgColumn) {
  if (status === "active") return isNull(deletedAt);
  if (status === "deleted") return isNotNull(deletedAt);
  return undefined;
}
