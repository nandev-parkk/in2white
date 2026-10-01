import type { Request } from "express";

/*
 * 감사 로그의 요청 출처다. 누가 어디서 조작했는지가 사후 추적의 시작점이라 모든
 * 변경 엔드포인트가 같은 방식으로 채운다. 값이 없으면 열을 비워 둔다 — 빈 문자열이
 * 들어가면 "기록했지만 알 수 없음"과 "기록하지 않음"을 구분할 수 없다.
 */
export function getAuditRequestContext(req: Request): { ip?: string; userAgent?: string } {
  return { ip: req.ip, userAgent: req.get("user-agent") };
}
