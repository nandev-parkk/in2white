# 프로젝트 상세 조회 백엔드 설계

## 상태와 작업 정보

- 상태: 2026-09-14 사용자 승인 후 구현·독립 리뷰·검증 완료. 프로젝트 기본 정보·생성자 단건 조회 범위를 구현했다.
- 작성일: 2026-09-14
- 작업 유형 / 프로필 / 실행 방식: Feature / Deep / Direct
- 선정 이유: 새 인증 조회 API에서 워크스페이스 경계와 삭제 상태를 잘못 처리하면 프로젝트 정보가 노출될 수 있어 실제 PostgreSQL 검증을 포함한다. 구현은 기존 프로젝트 계층에 집중되므로 현재 에이전트가 직접 수행한다.
- 작업 공간: `/Users/nandev/orca/workspaces/in2white/feature-project-detail-backend`
- 브랜치: `feature/project-detail-backend`
- 기준: `dev`, `origin/dev`, 원격 `dev` 모두 `4b50edd8009f9a50ff27ac9d06411a941624449a`로 확인했다.
- Git 호스팅 / 이슈 대상: GitHub / `nandev-parkk/in2white`
- 이슈: [#54 프로젝트 상세 조회 백엔드 API 구현](https://github.com/nandev-parkk/in2white/issues/54). 기존 중복 이슈와 열린 PR이 없음을 확인한 후 발행했다.
- Matt 보조 스킬: 사용하지 않는다. 기존 제품 용어·권한·서비스 경계를 재사용한다.

## 목표와 근거

프로젝트 상세 화면을 새로고침하거나 주소로 직접 열어도 프로젝트 이름·설명·생성자를 조회할 수 있도록 인증 단건 조회 API를 추가한다.

- [제품 문서](../../../PRODUCT.md)의 프로젝트 상세 페이지는 상단에 프로젝트 이름·설명·생성자를 요구한다.
- 프로젝트 생성·목록·수정·삭제는 구현되어 있지만 단건 GET은 없다.
- [화이트보드 문서 목록 설계](2026-09-09-whiteboard-document-list-backend-design.md)는 프로젝트 정보 조회를 별도 범위로 두었다.
- `GET /workspaces/:workspaceId/projects/:projectId/whiteboard-documents`는 문서 검색·페이지네이션을 이미 제공한다.
- 기존 프로젝트 목록은 `creator: { id, name }`를 포함하며, 프론트엔드의 `Project` 타입도 이 구조를 사용한다.

## 접근법 비교

| 접근법                                   | 장점                                                                                        | 비용·제약                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 프로젝트 정보만 단건 조회 — 추천         | 기존 문서 목록 계약과 조합할 수 있고 프로젝트 정보와 문서 목록을 독립적으로 갱신할 수 있다. | 상세 화면 최초 진입 시 프로젝트와 문서 목록 요청이 각각 필요하다.                  |
| 프로젝트와 문서 목록을 한 응답으로 제공  | 최초 진입 요청을 하나로 묶을 수 있다.                                                       | 문서 검색·페이지네이션 계약이 프로젝트 조회와 결합되고 기존 목록 API와 중복된다.   |
| 프로젝트 목록 응답에서 한 건을 찾아 사용 | 새 단건 API가 필요 없다.                                                                    | 페이지네이션 밖의 프로젝트와 새로고침·직접 주소 접근을 안정적으로 처리하기 어렵다. |

추천안으로 프로젝트 메타데이터와 생성자만 반환한다. 문서 목록과 개수는 기존 문서 목록 API의 `whiteboardDocuments`, `pagination.total`을 사용한다. 사용자가 이 응답 범위를 승인했다.

## API 계약

```http
GET /workspaces/:workspaceId/projects/:projectId
Authorization: Bearer <access-token>
```

- `workspaceId`, `projectId`는 UUID다.
- 요청 본문이나 검색·페이지네이션 query는 필요하지 않다.
- 성공은 `200 OK`와 `{ project }`다.

```json
{
  "project": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "workspaceId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "브랜드 캠페인",
    "description": "캠페인 아이디어를 정리하는 프로젝트",
    "creatorId": "7a1e6679-7425-40de-944b-e07fc1f90ae7",
    "creator": {
      "id": "7a1e6679-7425-40de-944b-e07fc1f90ae7",
      "name": "작성자"
    },
    "createdAt": "2026-09-14T00:00:00.000Z",
    "updatedAt": "2026-09-14T00:00:00.000Z"
  }
}
```

공개 필드는 위 8개로 고정한다. `description`이 없으면 `null`을 유지한다. 날짜는 서비스에서 `Date`, HTTP 응답에서 ISO 문자열이다. 생성자는 현재 `users.name`을 사용한다.

`deletedAt`, 생성자의 이메일·비밀번호 해시·세션 정보, 문서 목록·캔버스 데이터는 이 응답에 포함하지 않는다. 문서가 없는 활성 프로젝트도 정상 조회된다. 조회로 프로젝트의 `updatedAt`을 갱신하지 않는다.

## 권한과 오류 계약

기존 읽기 API와 같은 순서로 검증한다.

1. `authenticate`가 access token을 확인한다.
2. 컨트롤러가 현재 사용자와 두 경로 UUID를 확인한다.
3. 서비스가 요청 워크스페이스와 현재 사용자에 해당하는 멤버십을 확인한다.
4. 멤버십이 있을 때만 프로젝트 ID·워크스페이스 ID·`deletedAt IS NULL` 조건으로 프로젝트와 생성자를 조회한다.
5. 찾은 프로젝트의 공개 필드만 반환한다.

Owner, 생성자 Member, 생성자가 아닌 Member가 모두 조회할 수 있다. 조회에는 수정·삭제의 Owner/Creator 제한을 적용하지 않는다.

| 상황                                                     | HTTP | 오류 코드               |
| -------------------------------------------------------- | ---- | ----------------------- |
| 인증 누락·유효하지 않은 토큰                             | 401  | `UNAUTHORIZED`          |
| 잘못된 경로 UUID                                         | 400  | `VALIDATION_ERROR`      |
| 존재하지 않는 워크스페이스 또는 해당 워크스페이스 비멤버 | 404  | `WORKSPACE_NOT_FOUND`   |
| 프로젝트 없음·다른 워크스페이스 소속·소프트 삭제 상태    | 404  | `PROJECT_NOT_FOUND`     |
| 예상하지 못한 DB 오류                                    | 500  | `INTERNAL_SERVER_ERROR` |

인증·입력 오류에서는 조회 서비스를 호출하지 않는다. 비멤버 요청에서는 프로젝트를 조회하지 않고 워크스페이스 오류로 처리한다. 삭제 여부를 별도 오류로 드러내지 않는다. 오류 응답은 기존 `{ error: { message, code } }` 형식을 따른다.

## 구현 구조와 변경 범위

기존 `route → controller → service → DB` 구조를 따른다.

| 파일                                               | 책임                                                        |
| -------------------------------------------------- | ----------------------------------------------------------- |
| `backend/src/routes/project.routes.ts`             | 인증된 `GET /:projectId` 등록                               |
| `backend/src/controllers/project.controller.ts`    | `getProjectDetailHandler`: UUID 파싱·사용자 추출·응답       |
| `backend/src/services/project.service.ts`          | `getProjectDetail`: 멤버십 확인·활성 프로젝트와 생성자 조회 |
| `backend/tests/project-detail.test.ts`             | HTTP 응답·인증·입력·오류 전달 검증                          |
| `backend/tests/project-detail.integration.test.ts` | 실제 PostgreSQL에서 접근 범위·소프트 삭제·응답 필드 검증    |
| `backend/README.md`                                | 새 API와 통합 검증 명령 안내                                |
| 설계·구현 계획 문서                                | 계약·작업 단계·실행 결과 기록                               |

서비스 입력은 `{ workspaceId, projectId, userId }`이며 반환 타입은 기존 `ProjectListItem`을 재사용한다. 컨트롤러는 기존 `projectUpdateParamsSchema`를 재사용한다. 이 스키마는 현재 삭제 API에서도 공용으로 사용하므로 이름 변경을 위한 별도 리팩터링은 하지 않는다.

프로젝트 조회는 생성자 테이블과 `innerJoin`하고 공개 필드를 명시적으로 선택한다. 현재 생성자 외래 키와 삭제 시 cascade 정책 때문에 프로젝트가 남아 있는데 생성자만 없는 정상 상태는 없다.

DB 스키마·새 migration·의존성·프론트엔드·문서 목록·수정/삭제 정책은 이번 변경에 포함하지 않는다.

## 검증 계획

- HTTP 테스트: 정확한 성공 응답·ISO 날짜·null 설명, 인증 401, UUID 400, 도메인 404, 일반 오류의 500 변환과 내부 오류 메시지 비노출.
- PostgreSQL 통합 테스트: Owner·생성자·일반 Member 허용, 다른 워크스페이스에만 속한 사용자 차단, 미존재·타 워크스페이스·삭제 프로젝트 차단, 문서가 없는 프로젝트와 null 설명 조회, 제한된 공개 필드와 현재 생성자 이름.
- 통합 테스트는 기존 `RUN_DATABASE_INTEGRATION_TESTS=1` 관례와 Testcontainers를 사용한다. 테스트가 생성한 임시 DB에 기존 migration을 적용하며 사용자 개발 DB는 사용하지 않는다.
- 새 기능은 실패 테스트 확인 → 최소 구현 → 통과 확인 순서로 진행한다.
- 전체 백엔드 테스트, lint, TypeScript build, 변경 파일 Prettier, `git diff --check`를 실행한다.
- 구현 전 기준 검증: 기존 테스트 35개 파일·444개 통과, DB 통합 테스트 1개 파일·3개 기본 제외. Docker 응답 확인 완료. 이 수치는 구현 전 기준이다. 신규 기능의 실제 실행 결과는 구현 계획의 `Implementation Results`에 기록한다.

## 승인 이후 흐름

사용자가 설계·구현 계획·이슈 1건 발행을 승인했고 이슈 #54를 연결했다. 승인된 계획에 따라 구현·리뷰·검증을 수행한다. 이후 사용자가 PR 생성과 merge를 요청했으므로 검증된 변경의 commit·push, dev 대상 PR 생성·merge까지 진행한다.
