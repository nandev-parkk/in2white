# 워크스페이스 멤버 추가 백엔드 설계

## 상태

사용자 설계 승인 및 문서 검토 완료

## 목표

워크스페이스 Owner가 이미 가입한 사용자를 별도의 수락 절차 없이 해당 워크스페이스의 Member로 즉시 추가할 수 있는 API를 제공한다.

## 근거 문서와 기존 구현

- `PRODUCT.md`의 워크스페이스 멤버 관리
  - Owner가 전체 사용자 목록에서 사용자를 선택해 추가한다.
  - 추가된 사용자는 즉시 멤버가 된다.
  - 멤버 추가와 내보내기는 Owner 전용이다.
  - 역할은 `owner | member` 두 단계다.
- 기존 멤버 목록 API
  - `GET /workspaces/:workspaceId/members`가 `memberRouter`에 등록되어 있다.
  - `authenticate`, `requireUser`, UUID 검증, 멤버십 확인 패턴을 재사용한다.
- 기존 권한 처리
  - 비멤버는 `404 WORKSPACE_NOT_FOUND`로 처리해 워크스페이스 존재를 숨긴다.
  - 멤버이지만 Owner가 아닌 사용자는 작업별 `403` 오류를 반환한다.
- 기존 데이터 모델
  - `users`에 가입된 사용자 정보가 있다.
  - `workspace_memberships`가 워크스페이스와 사용자의 소속, 역할, 합류 시각을 가진다.
  - `(workspace_id, user_id)` unique constraint가 중복 멤버십을 막는다.

## 범위

### 포함

- `POST /workspaces/:workspaceId/members` API
- 요청 본문의 `userId` UUID 검증
- 인증 사용자와 대상 워크스페이스 멤버십 확인
- Owner 전용 멤버 추가 권한
- 대상 사용자 존재 확인
- `member` 역할의 멤버십 생성
- 이미 멤버인 사용자의 중복 요청 처리
- 동시 요청에서 unique constraint 위반을 일관된 충돌 응답으로 변환
- 추가된 멤버 정보 반환
- 인증, 입력, 권한, 대상 사용자, 중복, DB 오류 테스트

### 제외

- 이메일 초대, 초대 링크, 수락/거절 흐름
- 신규 사용자 생성 또는 회원가입
- 전체 사용자 검색/목록 API
- 역할 변경
- 멤버 내보내기
- 데이터베이스 스키마 또는 마이그레이션 변경
- 프론트엔드 멤버 추가 화면
- 알림, 이메일, 이벤트 발행

멤버 추가 API는 프론트엔드가 이미 알고 있는 `userId`를 받는다. 전체 사용자 목록 검색 API는 별도 기능으로 분리한다.

## 검토한 접근법

### 1. 멤버 전용 서비스에 트랜잭션 추가 — 선택

`member.service.ts`에 `addMember`를 추가하고 요청자 권한 확인, 대상 사용자 확인, 중복 확인, 멤버십 생성을 하나의 트랜잭션에서 처리한다. 현재 멤버 목록과 같은 모듈 경계를 유지하면서 이후 멤버 내보내기 확장도 용이하다. 데이터베이스 unique constraint 위반도 서비스 경계에서 `409`로 변환할 수 있다.

### 2. 워크스페이스 서비스에 멤버 추가 로직 추가

기존 워크스페이스 서비스의 멤버십 접근을 재사용할 수 있지만, 워크스페이스 CRUD와 멤버 관리 책임이 한 서비스에 누적된다. 멤버 내보내기와 역할 변경이 추가되면 경계가 더 흐려진다.

### 3. 사전 조회와 별도 insert

구현은 짧지만 중복 확인과 insert 사이에 경쟁 조건이 생긴다. unique constraint에 의존하더라도 트랜잭션 경계와 오류 변환을 호출 계층이 책임져야 하므로 선택하지 않는다.

## API 계약

### 요청

```http
POST /workspaces/:workspaceId/members
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "userId": "550e8400-e29b-41d4-a716-446655440001"
}
```

`workspaceId`와 `userId`는 UUID여야 한다. 요청 본문에는 `userId` 외의 필드를 허용하지 않는다.

### 성공 응답

상태 코드 `201`을 반환한다.

```json
{
  "member": {
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Kim Member",
    "email": "member@example.com",
    "role": "member",
    "joinedAt": "2026-09-10T00:00:00.000Z"
  }
}
```

응답 항목은 기존 멤버 목록의 항목과 동일한 `userId`, `name`, `email`, `role`, `joinedAt` 필드를 사용한다.

## 권한 및 오류 계약

권한 확인과 멤버십 생성은 하나의 데이터베이스 트랜잭션에서 실행한다.

1. 요청자의 `(workspaceId, requesterId)` 멤버십을 조회한다.
2. 멤버십이 없으면 `404 WORKSPACE_NOT_FOUND`를 반환한다.
3. 멤버십 역할이 `owner`가 아니면 `403 MEMBER_ADD_FORBIDDEN`을 반환한다.
4. Owner 권한 확인 후 대상 사용자를 조회한다.
5. 대상 사용자가 없으면 `404 USER_NOT_FOUND`를 반환한다.
6. 대상 사용자가 이미 멤버이면 `409 MEMBER_ALREADY_EXISTS`를 반환한다.
7. `role: member`로 멤버십을 추가한다.

| 상황                               | 상태 | 코드                    | 메시지                          |
| ---------------------------------- | ---: | ----------------------- | ------------------------------- |
| 인증 실패                          |  401 | `UNAUTHORIZED`          | 기존 인증 오류 메시지           |
| 잘못된 `workspaceId` 또는 `userId` |  400 | `VALIDATION_ERROR`      | 해당 ID 검증 메시지             |
| 요청자가 워크스페이스 비멤버       |  404 | `WORKSPACE_NOT_FOUND`   | 워크스페이스를 찾을 수 없습니다 |
| 요청자가 일반 Member               |  403 | `MEMBER_ADD_FORBIDDEN`  | 멤버를 추가할 권한이 없습니다   |
| 대상 사용자 없음                   |  404 | `USER_NOT_FOUND`        | 사용자를 찾을 수 없습니다       |
| 대상 사용자가 이미 멤버            |  409 | `MEMBER_ALREADY_EXISTS` | 이미 워크스페이스 멤버입니다    |
| 멤버십 unique constraint 충돌      |  409 | `MEMBER_ALREADY_EXISTS` | 이미 워크스페이스 멤버입니다    |
| 예상하지 못한 DB 오류              |  500 | `INTERNAL_SERVER_ERROR` | 기존 내부 오류 메시지           |

비멤버에게 404를 반환하는 기존 정보 은닉 규칙을 유지한다. Owner 자신을 추가하는 요청은 이미 Owner 멤버십이 존재하므로 `MEMBER_ALREADY_EXISTS`가 된다. 트랜잭션 내부의 unique constraint 오류는 PostgreSQL 오류 코드 `23505`일 때만 중복 멤버 오류로 변환하고, 그 외 오류는 공통 500 처리로 넘긴다.

## 아키텍처와 데이터 흐름

### 계층별 책임

- `routes`
  - 기존 `memberRouter`에 `POST /`를 추가한다.
  - `authenticate`와 `asyncHandler(addMemberHandler)`를 등록한다.
- `controller`
  - `requireUser`, path parameter schema, body schema를 실행한다.
  - 서비스 결과를 `{ member }`로 감싸 HTTP 201로 반환한다.
- `schema`
  - 기존 `memberParamsSchema`를 재사용한다.
  - `addMemberBodySchema`가 `userId` UUID와 본문 구조를 검증한다.
- `service`
  - 요청자의 Owner 권한, 대상 사용자, 기존 멤버십을 확인한다.
  - 트랜잭션 안에서 멤버십을 생성하고 응답용 사용자/멤버십 데이터를 반환한다.
  - unique constraint 충돌을 도메인 HTTP 오류로 변환한다.
- `db/schema`
  - 기존 `users`와 `workspaceMemberships`를 사용하며 스키마를 변경하지 않는다.

### 요청 흐름

1. 요청이 `/workspaces/:workspaceId/members`의 `memberRouter`에 도달한다.
2. `authenticate`가 Access Token을 검증한다.
3. controller가 인증 사용자와 path/body 입력을 검증한다.
4. service가 트랜잭션을 시작하고 요청자의 멤버십을 확인한다.
5. Owner가 아니면 적절한 404 또는 403 오류로 종료한다.
6. service가 `users.id = userId`로 대상 사용자를 확인한다.
7. service가 동일 워크스페이스의 대상 멤버십을 확인한다.
8. 중복이 없으면 `role = member`로 멤버십을 insert한다.
9. 생성된 멤버십과 대상 사용자 정보를 조합한다.
10. controller가 HTTP 201과 `{ member }`를 응답한다.

## 트랜잭션 및 동시성

요청자 권한 확인부터 멤버십 insert까지 `db.transaction`으로 묶는다. 애플리케이션 수준의 사전 중복 확인은 정상적인 오류 메시지를 제공하기 위한 것이고, 최종 중복 방지는 기존 `(workspace_id, user_id)` unique constraint가 담당한다. 두 Owner 요청이 동시에 같은 사용자를 추가하더라도 하나는 성공하고 다른 하나는 `MEMBER_ALREADY_EXISTS`가 된다.

별도의 lock, isolation level 변경, 재시도 정책은 읽기/단순 추가 API의 범위를 넘어가므로 도입하지 않는다.

## 파일 경계

### 추가 또는 수정 파일

- `backend/src/constants/messages.ts`
  - 사용자 없음, 멤버 중복, Owner 전용 권한 오류 메시지 추가
- `backend/src/schemas/member.schema.ts`
  - `addMemberBodySchema` 추가
- `backend/src/services/member.service.ts`
  - `AddMemberInput`, `addMember` 추가
- `backend/src/controllers/member.controller.ts`
  - `addMemberHandler` 추가
- `backend/src/routes/member.routes.ts`
  - `POST /` 등록
- `backend/tests/member.test.ts`
  - schema, service, HTTP 계약 테스트 추가
- `docs/superpowers/plans/2026-09-10-member-addition-backend-implementation-plan.md`
  - 단계별 구현 계획과 결과 기록

### 변경하지 않는 파일

- `backend/src/db/schema/**`
- `backend/src/db/migrations/**`
- 기존 workspace/project API 구현
- `frontend/**`
- `PRODUCT.md`
- `DESIGN.md`

## 테스트 전략

Vitest, Supertest, 기존 DB transaction mock 패턴으로 다음을 검증한다.

1. Owner가 존재하는 사용자를 추가하면 `201`과 멤버 정보가 반환된다.
2. 추가 역할이 `member`이고 `joinedAt`이 직렬화된다.
3. 인증되지 않은 요청은 `401`이며 DB transaction을 호출하지 않는다.
4. 잘못된 workspace/user UUID 또는 잘못된 body는 `400`이며 DB를 호출하지 않는다.
5. 비멤버 요청은 `404 WORKSPACE_NOT_FOUND`이며 insert를 실행하지 않는다.
6. 일반 Member 요청은 `403 MEMBER_ADD_FORBIDDEN`이며 insert를 실행하지 않는다.
7. 존재하지 않는 대상 사용자는 `404 USER_NOT_FOUND`를 반환한다.
8. 대상 사용자가 이미 멤버이면 `409 MEMBER_ALREADY_EXISTS`를 반환한다.
9. insert의 PostgreSQL unique 오류 `23505`도 `409 MEMBER_ALREADY_EXISTS`로 변환한다.
10. 멤버십 조회, 사용자 조회, 기존 멤버십 조회, insert의 예기치 않은 오류는 공통 500으로 변환된다.
11. 기존 멤버 목록과 백엔드 전체 테스트가 계속 통과한다.
12. lint, build, 변경 파일 Prettier 검사가 통과한다.

## 완료 기준

- Owner가 `userId`로 기존 사용자를 즉시 Member로 추가할 수 있다.
- 일반 Member와 비멤버가 멤버를 추가할 수 없다.
- 잘못된 입력, 대상 사용자 없음, 중복 멤버십이 명세된 오류 계약을 따른다.
- 동시 중복 요청이 unique constraint를 통해 안전하게 처리된다.
- 기존 DB 스키마·마이그레이션을 변경하지 않는다.
- 관련 테스트, 전체 백엔드 테스트, lint, build, formatting 검사가 통과한다.
- 구현 계획 문서에 실제 변경, 계획과의 차이, 검증 결과, 후속 작업이 기록된다.
