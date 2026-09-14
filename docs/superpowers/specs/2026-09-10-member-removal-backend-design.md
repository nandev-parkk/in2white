# 워크스페이스 멤버 내보내기 백엔드 설계

## 상태

설계 승인 완료

## 목표

워크스페이스 Owner가 멤버를 워크스페이스에서 내보내고, 일반 Member가 자기 자신을 워크스페이스에서 탈퇴할 수 있는 API를 추가한다. 작업이 성공하면 대상 사용자의 워크스페이스 멤버십만 즉시 제거하고, 해당 사용자가 만든 프로젝트와 화이트보드 문서는 보존한다.

## 근거 문서와 기존 구현

- `PRODUCT.md`의 멤버 관리
  - 멤버 추가와 내보내기는 워크스페이스 Owner만 수행한다.
  - Owner 자신은 내보낼 수 없다.
  - 내보낸 사용자는 즉시 워크스페이스 접근 권한을 잃는다.
- 기존 멤버 API
  - `GET /workspaces/:workspaceId/members`와 `POST /workspaces/:workspaceId/members`가 `memberRouter`에 등록되어 있다.
  - `authenticate`, `requireUser`, UUID 검증, 요청자 멤버십 확인 패턴을 재사용한다.
  - 워크스페이스 비멤버는 `404 WORKSPACE_NOT_FOUND`로 처리해 워크스페이스 존재를 숨긴다.
- 이번 기능의 권한 결정
  - Owner는 다른 Member를 내보낼 수 있다.
  - Member는 자기 자신만 탈퇴할 수 있다.
  - Owner 자기 탈퇴는 Owner 이전 기능이 없으므로 허용하지 않는다.
- 기존 삭제 API
  - 프로젝트와 워크스페이스 삭제는 트랜잭션에서 권한을 확인한 뒤 삭제하고 성공 시 `204 No Content`를 반환한다.
- 기존 데이터 모델
  - `workspace_memberships`가 워크스페이스와 사용자의 소속 및 역할을 저장한다.
  - `projects.creator_id`와 `whiteboard_documents.creator_id`는 사용자 계정을 참조한다.
  - 멤버십 삭제는 사용자 계정 삭제가 아니므로 프로젝트·문서의 생성자 참조를 변경하지 않는다.

## 범위

### 포함

- `DELETE /workspaces/:workspaceId/members/:userId` API
- `workspaceId`와 `userId` UUID 검증
- 인증 사용자 멤버십 확인
- Owner의 타인 내보내기 및 Member 자기 탈퇴 권한
- Owner 자신의 내보내기 차단
- Member의 다른 멤버 내보내기 차단
- 대상 멤버십 존재 확인 및 삭제
- 멤버십 삭제 성공 시 `204 No Content` 응답
- 비멤버·권한 없음·자기 자신·대상 없음·입력 오류·DB 오류 테스트

### 제외

- 사용자 계정 삭제
- 프로젝트·화이트보드 문서 삭제 또는 소유자 변경
- 멤버십 soft delete나 감사 이력 테이블 추가
- 역할 변경 또는 Owner 이전
- 이메일·알림·이벤트 발행
- 프론트엔드 멤버 내보내기 UI
- 실시간 협업 연결 강제 종료
- 데이터베이스 스키마 또는 마이그레이션 변경

## 검토한 접근법

### 1. 트랜잭션 안에서 권한 확인 후 멤버십 삭제 — 선택

`member.service.ts`에 `removeMember`를 추가하고, 요청자 권한 확인부터 대상 멤버십 삭제까지 하나의 `db.transaction`에서 처리한다. 기존 `addMember`와 `deleteProject`의 계층 및 트랜잭션 패턴을 유지하며, 대상 멤버가 없거나 동시 요청으로 먼저 삭제된 경우를 서비스 경계에서 일관된 `404` 오류로 변환할 수 있다.

### 2. Owner 조건을 포함한 단일 DELETE 쿼리

단일 SQL로 삭제할 수 있지만 요청자 비멤버, 일반 Member, 자기 자신, 대상 멤버 없음의 원인을 구분하기 어렵다. 현재 API가 사용하는 권한·오류 계약과도 맞지 않아 선택하지 않는다.

### 3. 멤버십 soft delete

내보내기 이력과 재가입 정책을 세밀하게 관리할 수 있지만, 스키마와 마이그레이션을 변경하고 모든 멤버십 조회에 활성 상태 조건을 추가해야 한다. 현재 제품 요구사항에는 이력이 없어 선택하지 않는다.

## API 계약

### 요청

```http
DELETE /workspaces/:workspaceId/members/:userId
Authorization: Bearer <access-token>
```

요청 본문은 사용하지 않는다. `workspaceId`와 `userId`는 UUID여야 한다.

### 성공 응답

상태 코드 `204`를 반환하며 응답 본문은 없다.

```http
HTTP/1.1 204 No Content
```

내보내기 성공 후 대상 사용자의 `(workspaceId, userId)` 멤버십 행만 삭제된다. 대상 사용자의 계정, 프로젝트, 화이트보드 문서, 해당 리소스의 `creatorId`는 변경되지 않는다.

### 접근 결과

멤버십을 삭제하면 대상 사용자의 이후 워크스페이스 관련 API 요청은 멤버십 확인 단계에서 `404 WORKSPACE_NOT_FOUND`가 된다. 다른 멤버가 해당 워크스페이스의 프로젝트나 문서를 조회할 때는 기존 사용자 계정과 `creatorId`를 기준으로 생성자 정보를 계속 표시할 수 있다. 대상 사용자가 이후 다시 추가되면 기존 생성자 정보도 그대로 유지된다.

## 권한 및 오류 계약

권한 검증과 멤버십 삭제는 하나의 데이터베이스 트랜잭션 안에서 실행한다.

1. 요청자의 `(workspaceId, requesterId)` 멤버십을 조회한다.
2. 멤버십이 없으면 `404 WORKSPACE_NOT_FOUND`를 반환한다.
3. `userId`가 요청자 본인이고 요청자 역할이 `member`이면 자기 탈퇴를 허용한다.
4. `userId`가 요청자 본인이고 요청자 역할이 `owner`이면 `403 MEMBER_SELF_REMOVE_FORBIDDEN`을 반환한다.
5. `userId`가 요청자 본인이 아니고 요청자 역할이 `owner`가 아니면 `403 MEMBER_REMOVE_FORBIDDEN`을 반환한다.
6. `(workspaceId, userId)` 멤버십을 삭제한다.
7. 삭제 결과가 없으면 `404 MEMBER_NOT_FOUND`를 반환한다.

요청자 멤버십을 먼저 확인하므로 비멤버 요청은 대상 멤버의 존재 여부와 무관하게 워크스페이스 은닉 오류를 반환한다. 일반 Member가 다른 사용자를 대상으로 요청하면 대상 멤버 정보를 확인하기 전에 권한 오류를 반환한다. 일반 Member가 자기 자신을 대상으로 요청한 경우에만 자기 탈퇴를 허용한다.

| 상황                               | 상태 | 코드                           | 메시지                               |
| ---------------------------------- | ---: | ------------------------------ | ------------------------------------ |
| 인증 실패                          |  401 | `UNAUTHORIZED`                 | 기존 인증 오류 메시지                |
| 잘못된 `workspaceId` 또는 `userId` |  400 | `VALIDATION_ERROR`             | 해당 ID 검증 메시지                  |
| 요청자가 워크스페이스 비멤버       |  404 | `WORKSPACE_NOT_FOUND`          | 워크스페이스를 찾을 수 없습니다      |
| Member가 다른 멤버를 내보냄        |  403 | `MEMBER_REMOVE_FORBIDDEN`      | 멤버를 내보낼 권한이 없습니다        |
| Owner가 자기 자신을 내보냄         |  403 | `MEMBER_SELF_REMOVE_FORBIDDEN` | 자기 자신은 내보낼 수 없습니다       |
| 대상이 워크스페이스 멤버가 아님    |  404 | `MEMBER_NOT_FOUND`             | 워크스페이스 멤버를 찾을 수 없습니다 |
| 예상하지 못한 DB 오류              |  500 | `INTERNAL_SERVER_ERROR`        | 기존 내부 오류 메시지                |

대상 멤버십을 사전 조회하지 않고 `DELETE ... RETURNING` 결과를 기준으로 존재 여부를 판단한다. 따라서 동시에 다른 요청이 같은 멤버십을 먼저 삭제한 경우에도 삭제 결과가 없는 요청은 `MEMBER_NOT_FOUND`가 된다. 사용자 계정이나 리소스에는 삭제 쿼리를 실행하지 않는다.

## 아키텍처와 데이터 흐름

### 계층별 책임

- routes
  - 기존 `memberRouter`에 `DELETE /:userId`를 추가한다.
  - `authenticate`와 `asyncHandler(removeMemberHandler)`를 등록한다.
- controller
  - `requireUser(req)`로 인증 주체를 가져온다.
  - `memberRemoveParamsSchema`로 두 UUID path parameter를 검증한다.
  - 서비스 호출 후 `204 No Content`를 반환한다.
- schema
  - 기존 `memberParamsSchema`를 재사용하거나 확장해 `workspaceId`, `userId` UUID를 검증한다.
  - DELETE 요청에는 body 검증을 추가하지 않는다.
- service
  - 요청자의 멤버십과 역할을 확인한다.
  - Member의 자기 탈퇴는 허용하고, Member의 타인 내보내기와 Owner의 자기 탈퇴는 차단한다.
  - 대상 멤버십을 `workspaceId`와 `userId` 조건으로 삭제하고 결과를 확인한다.
- db/schema
  - 기존 `workspaceMemberships`만 사용한다.
  - 스키마와 마이그레이션은 변경하지 않는다.

### 요청 흐름

1. 요청이 `/workspaces/:workspaceId/members/:userId`의 `memberRouter`에 도달한다.
2. `authenticate`가 Access Token을 검증한다.
3. controller가 인증 사용자와 두 path parameter를 검증한다.
4. service가 트랜잭션을 시작하고 요청자의 멤버십을 조회한다.
5. 요청자가 비멤버면 `WORKSPACE_NOT_FOUND`로 종료한다.
6. 대상이 요청자 본인이고 요청자 역할이 `member`이면 자기 탈퇴를 진행한다.
7. 대상이 요청자 본인이고 요청자 역할이 `owner`이면 `MEMBER_SELF_REMOVE_FORBIDDEN`으로 종료한다.
8. 대상이 요청자 본인이 아니고 요청자 역할이 `owner`가 아니면 `MEMBER_REMOVE_FORBIDDEN`으로 종료한다.
9. service가 대상 멤버십을 삭제하고 삭제된 ID를 반환받는다.
10. 삭제된 행이 없으면 `MEMBER_NOT_FOUND`로 종료한다.
11. controller가 HTTP 204를 응답한다.

## 서비스 인터페이스

```ts
export interface RemoveMemberInput {
  workspaceId: string;
  requesterId: string;
  userId: string;
}

export async function removeMember(input: RemoveMemberInput): Promise<void>;
```

`requesterId`는 권한을 확인할 인증 사용자의 ID이고, `userId`는 내보낼 대상 사용자의 ID다. 두 필드의 역할을 이름으로 분리해 호출부에서 혼동하지 않도록 한다.

## 파일 경계

### 수정 파일

- `backend/src/constants/messages.ts`
  - `MEMBER_REMOVE_FORBIDDEN`, `MEMBER_SELF_REMOVE_FORBIDDEN`, `MEMBER_NOT_FOUND` 메시지 추가
- `backend/src/schemas/member.schema.ts`
  - `memberRemoveParamsSchema` 추가
- `backend/src/services/member.service.ts`
  - `RemoveMemberInput`, `removeMember` 추가
- `backend/src/controllers/member.controller.ts`
  - `removeMemberHandler` 추가
- `backend/src/routes/member.routes.ts`
  - `DELETE /:userId` 라우트 추가
- `backend/tests/member.test.ts`
  - 스키마·서비스·HTTP 계약 테스트 추가

### 변경하지 않는 파일

- `backend/src/db/schema/**`
- `backend/src/db/migrations/**`
- `frontend/**`
- `PRODUCT.md`

## 테스트 설계

### 스키마

- `workspaceId`와 `userId`가 유효한 UUID이면 통과한다.
- 두 path parameter 중 하나라도 UUID가 아니면 거부한다.

### 서비스

- Owner가 다른 멤버를 내보내면 트랜잭션과 멤버십 삭제가 실행된다.
- Member가 자기 자신을 탈퇴하면 트랜잭션과 멤버십 삭제가 실행된다.
- 비멤버 요청자는 `WORKSPACE_NOT_FOUND`를 받고 대상 삭제를 시작하지 않는다.
- Member가 다른 멤버를 대상으로 요청하면 `MEMBER_REMOVE_FORBIDDEN`을 받고 대상 삭제를 시작하지 않는다.
- Owner가 자기 자신을 내보내면 `MEMBER_SELF_REMOVE_FORBIDDEN`을 받고 삭제하지 않는다.
- 대상 멤버십이 없으면 `MEMBER_NOT_FOUND`를 받는다.
- 삭제 쿼리는 `workspaceId`와 대상 `userId`를 모두 조건으로 사용한다.
- 멤버십 삭제 DB 오류는 공통 오류 처리로 전파된다.

### HTTP

- 인증되지 않은 요청은 `401`을 반환한다.
- 잘못된 path parameter는 DB 접근 전에 `400 VALIDATION_ERROR`를 반환한다.
- Owner의 정상 내보내기와 Member의 자기 탈퇴 요청은 `204`와 빈 body를 반환한다.
- 각 권한·대상 없음·DB 오류 계약이 지정된 상태 코드와 오류 코드로 매핑된다.

## 보안 및 운영 고려사항

- 모든 경로에서 `workspaceId` 조건을 함께 사용해 다른 워크스페이스의 멤버십을 삭제하지 않는다.
- 요청자 멤버십 확인을 대상 멤버십 확인보다 먼저 수행해 비멤버에게 워크스페이스와 멤버 정보를 노출하지 않는다.
- Member의 자기 탈퇴 외에는 Owner만 다른 사용자의 멤버십을 삭제할 수 있다.
- 사용자 계정과 프로젝트·문서 데이터는 삭제하지 않아 참조 무결성을 유지한다.
- 기존 HTTP 로거의 Authorization 헤더 마스킹과 공통 rate limit을 그대로 적용한다.
- 별도 감사 로그·알림·실시간 연결 종료는 이번 범위에 포함하지 않는다.

## 검증 계획

구현 후 다음 명령을 실행한다.

```bash
cd backend
pnpm test
pnpm lint
pnpm build
```

추가로 `git diff --check`와 변경 파일 검토를 수행하고, 구현 계획 문서의 `Implementation Results`에 실제 변경 내용·계획과의 차이·검증 결과·남은 후속 작업을 기록한다.
