/**
 * 삭제 상태 필터. 프로젝트와 화이트보드 문서가 같은 값을 쓴다 — 백엔드도 두 목록에
 * 같은 `status` 쿼리를 받는다. 기본값은 `all`이다. 삭제된 리소스를 감추면 복구 대상을
 * 찾을 수 없고, 복구가 이 화면들의 존재 이유다.
 */
export type ResourceStatusFilter = 'all' | 'active' | 'deleted'
