# 어드민 콘솔 설계

- 작성일: 2026-10-01
- 대상: 서비스 전반을 운영·관리하는 내부 어드민 도구
- 관련 문서: `PRODUCT.md` (54, 142, 596행 — 계정은 별도 관리자 도구에서 생성), `docs/deployment/docker-compose.md`

## 1. 배경

`PRODUCT.md`는 제품 범위를 "로그인 이후의 사용자 경험"으로 한정하고, 계정 생성을 **별도 관리자 도구**의 책임으로 명시해 두었다. 현재 그 도구가 없어서 사용자 계정은 `backend/src/scripts/create-test-user.ts` 같은 스크립트로만 만들 수 있고, 워크스페이스·프로젝트·문서에 대한 운영 개입 수단이 전혀 없다.

이 문서는 계정 생성에 그치지 않고 서비스 전반(사용자·워크스페이스·프로젝트·화이트보드 문서·운영 상태)을 관리하는 어드민 콘솔의 설계를 정의한다.

## 2. 목표

- 운영자가 사용자 계정을 생성·조회·수정·비활성화하고 세션을 강제 종료할 수 있다.
- 운영자가 워크스페이스/프로젝트/화이트보드 문서를 전역 범위에서 조회하고, 필요한 경우 이름 변경·소유자 이전·삭제·복구할 수 있다.
- 모든 어드민 변경 작업이 감사 로그로 남아 "누가 무엇을 언제 바꿨는지" 추적 가능하다.
- 어드민 권한과 제품 사용자 권한이 자격증명·토큰·오리진 수준에서 분리되어, 한쪽이 노출되어도 다른 쪽으로 전이되지 않는다.
- 운영자가 서비스 상태(DB/Valkey 연결, 실시간 세션 수, 주요 지표)를 한 화면에서 확인할 수 있다.

### 비목표

- 제품 사용자에게 노출되는 기능은 변경하지 않는다. 제품 SPA는 회원가입 없음 전제를 유지한다.
- 세분화된 어드민 역할 체계(super admin / read-only admin 등)는 이번 범위에서 제외한다. 어드민은 단일 권한으로 시작한다.
- 결제·요금제·조직 계층 같은 존재하지 않는 도메인은 다루지 않는다.
- 감사 로그의 외부 SIEM 연동, 장기 보관 정책은 다루지 않는다.

## 3. 아키텍처 결정

### 3.1 프런트엔드: 별도 앱 (`admin/`)

제품 SPA(`frontend/`)의 `/admin` 경로가 아니라, 레포 루트에 `admin/` 디렉터리로 독립 Vite 앱을 만든다.

**근거**

- **번들 격리** — 계정 생성·전역 삭제 UI와 그에 필요한 API 클라이언트 코드가 일반 사용자에게 전달되는 번들에 포함되지 않는다.
- **오리진 격리** — 어드민 전용 오리진을 갖게 되므로 CORS·쿠키 스코프·rate limit·네트워크 접근 제어를 제품과 독립적으로 설정할 수 있다.
- **배포 격리** — `docker-compose.yml`에 별도 서비스로 올려 내부망 전용 노출이 가능하다. 현재 `frontend`는 `8080:80`으로 공개 노출된다.
- **문서 정합성** — `PRODUCT.md`가 이미 어드민 도구를 제품 범위 밖의 별도 도구로 규정하고 있다.

**대안과 기각 이유**

| 대안 | 기각 이유 |
|---|---|
| `frontend/`에 `/admin` 라우트 추가 | 어드민 코드가 공개 번들에 포함된다. 오리진·쿠키·rate limit을 분리할 수 없다. |
| 완전 별도 레포 | 백엔드 스키마·에러 계약과 동시에 변경해야 하는데 레포가 갈리면 원자적 변경이 불가능하다. |

**비용** — 디자인 시스템과 UI 프리미티브를 공유 패키지로 추출해야 한다. 어드민 전용 디자인 파일을 따로 두지 않는다. 상세는 §3.2.

### 3.2 디자인 시스템: 루트 pnpm workspace + `packages/ui`

어드민 전용 디자인 파일을 만들지 않는다. 레포 루트를 pnpm workspace로 승격하고 `packages/ui`를 만들어 `frontend/`와 `admin/`이 함께 의존한다.

**현재 상태 (확인 결과)**

- 토큰 원본(`tokens.json`, `DESIGN.md`)은 이미 레포 루트에 있다. 앱에 묶여 있는 것은 구현체 두 개뿐이다 — `frontend/src/app/styles/index.css`(custom property 65개)와 `frontend/src/shared/ui`(80개 파일).
- `frontend/src/shared/ui`는 상위 레이어(`entities`/`features`/`widgets`/`pages`/`app`) import이 하나도 없다. 외부 의존은 `@/shared/lib/utils`(28곳), `@/shared/constants/messages`(8곳), `@/shared/ui` 내부뿐이다. `2026-09-28-fsd-boundaries` 작업이 `canvas-top-bar`·`user-picker`를 상위 레이어로 옮기면서 이미 이식 가능한 상태를 만들어 두었다.
- `shared/ui`가 쓰는 메시지 키는 전부 `MESSAGES.common.*`이다. 집계된 `MESSAGES`가 아니라 `constants/messages/common.ts`만 패키지에 필요하다 — 제품 도메인 문구(workspace/project/member/whiteboard)는 끌고 들어오지 않는다.

**패키지 경계**

| 위치 | 대상 |
|---|---|
| `packages/ui`로 이동 | 테마 CSS(토큰 구현체), 범용 프리미티브(button, input, card, dialog, select, badge, avatar, checkbox, radio-group, breadcrumb, dropdown-menu, pagination, search, spinner, empty-state, compact-empty-state, error-state, loading-state, page-header, list-cell, list-pagination, resource-list-skeleton 등), `lib/utils`(`cn`), `lib/hooks/use-card-motion`, `constants/messages/common.ts` |
| `frontend/`에 잔류 | 제품 도메인 컴포넌트 — `whiteboard-card`, `live-cursor`, `presence-avatar-stack`, `app-shell-header`. 그리고 `common.ts`를 제외한 도메인별 메시지 모듈 전체 |

`shared/ui`는 FSD 레이어 규칙은 지켰지만 도메인 청결하지는 않다. 위 4개 컴포넌트는 화이트보드·협업 도메인에 속하므로 공유 패키지에 넣지 않는다.

**대안과 기각 이유**

| 대안 | 기각 이유 |
|---|---|
| `admin/`에서 `frontend/src/shared`를 경로 alias로 직접 참조 | 어드민이 제품 앱 내부를 들여다보는 소유 관계가 된다. Docker 빌드 컨텍스트 문제는 workspace 방식과 동일하게 발생하므로 이득이 없다. |
| 테마 CSS만 공유하고 프리미티브는 `admin/`에서 shadcn CLI 재생성 | import 재작성을 피할 수 있지만, 프로젝트 자체 제작 컴포넌트(list-cell, page-header, empty-state, error-state, loading-state, resource-list-skeleton 등)는 결국 복사된다. 복사본이 갈라지면 두 앱의 시각 언어가 조용히 드리프트한다. |
| 어드민 전용 디자인 파일 신설 | 토큰 원본이 이미 공유 자산인데 구현체를 두 벌 유지하는 것은 순수한 부채다. |

**비용(감수)** — 어드민 기능이 아니라 기존 프런트엔드 구조 변경이다. 구체적으로:

- `frontend/src`의 76개 파일, 188개 import 지점을 `@/shared/ui` → 패키지 경로로 재작성. 기계적이며 타입 검사·eslint·vitest가 실수를 잡는다.
- 루트 `pnpm-workspace.yaml` 도입 — `frontend/`·`backend/`의 lockfile·install 레이아웃 변경.
- `frontend/Dockerfile`이 `./frontend` 컨텍스트에서 `package.json pnpm-lock.yaml pnpm-workspace.yaml`을 복사한다. 빌드 컨텍스트를 레포 루트로 옮기고 루트 `.dockerignore`를 추가하고 `docker-compose.yml`의 `build.context`를 조정해야 한다.
- Storybook·vitest·eslint 설정이 패키지를 인식하도록 조정.

이 변경은 어드민 구현과 섞이지 않게 **단계 0**으로 분리하고, `frontend`의 기존 테스트가 전부 통과하는 것을 확인한 뒤 어드민 작업을 시작한다.

### 3.3 백엔드: 같은 프로세스, 분리된 라우터 네임스페이스

어드민 API는 기존 Express 앱 안에서 `/admin/*` 네임스페이스로 제공한다. 별도 서비스로 분리하지 않는다.

**근거** — 어드민은 제품과 완전히 동일한 DB·Drizzle 스키마·서비스 계층을 다룬다. 프로세스를 나누면 스키마와 비즈니스 규칙이 두 곳에서 드리프트하고, 배포 단위만 늘어난다. 분리해야 하는 실제 경계는 **인증과 오리진**이며 이는 프로세스 분리 없이 달성 가능하다.

**분리 지점**

- `authenticateAdmin` 미들웨어 (`authenticate`와 별개, 어드민 전용 시크릿 검증)
- 어드민 전용 JWT 시크릿 쌍
- `/admin/*`에만 적용되는 CORS 오리진과 rate limit 버킷
- 감사 로그 강제 기록

향후 트래픽·격리 요구가 생기면 `createApp`을 라우터 단위로 분해해 별도 프로세스로 뽑을 수 있도록, 어드민 라우터는 `createAdminRouter()` 팩토리로 만들어 앱 조립부에서만 결합한다.

## 4. 권한 모델

### 4.1 결정: 별도 `admin_users` 테이블

`users`에 전역 role 컬럼을 추가하지 않고, 독립 자격증명을 갖는 `admin_users` 테이블을 만든다.

**근거**

- **사용자 목록 오염 방지가 결정적이다.** `PRODUCT.md` 1157행에 따라 워크스페이스 Owner는 **전체 사용자 목록**에서 멤버를 추가할 수 있다. `users.role = 'admin'`으로 구현하면 어드민 계정이 이 목록에 노출되고, 이를 막으려면 사용자 검색·조회·멤버 추가 등 모든 쿼리에 `role <> 'admin'` 필터를 추가해야 한다. 필터 하나만 빠져도 어드민 계정이 제품 사용자에게 노출된다. 테이블을 나누면 이 실수가 구조적으로 불가능해진다.
- **토큰 혼용 방지** — 시크릿이 다르므로 제품 access token으로 어드민 API를 호출할 수 없고, 그 반대도 성립한다. 검증 로직의 실수에 의존하지 않는다.
- **세션 정책 독립** — 어드민 refresh 만료를 제품(14일)보다 짧게(1일) 둘 수 있다.

**대안과 기각 이유**

| 대안 | 기각 이유 |
|---|---|
| `users.role` enum 확장 | 위 사용자 목록 오염 문제. 모든 사용자 조회 경로에 필터 누락 위험이 영구적으로 남는다. |
| `users.isAdmin` boolean | 위와 동일. |
| 어드민 계정 없이 환경변수 기반 Basic Auth | 감사 로그에 행위자를 특정할 수 없고 자격증명 회전이 불가능하다. |

**비용(감수)** — 로그인/리프레시/로그아웃 로직이 어드민용으로 한 벌 더 생긴다. `lib/jwt.ts`의 서명·검증 함수는 시크릿과 `type` 클레임만 달라지므로 기존 구현을 그대로 따르고, `services/admin-auth.service.ts`는 `services/auth.service.ts`의 구조를 미러링한다. 공통화를 위해 기존 `auth.service.ts`를 제네릭하게 리팩터링하지는 않는다 — 두 흐름의 정책(만료, 세션 키, 비활성화 규칙)이 앞으로 갈라질 가능성이 높다.

### 4.2 어드민 인증 흐름

제품 인증과 동일한 구조(access 15분 + refresh 회전 + Valkey 세션 + `sessionVersion`)를 따른다.

- access token: `type: "admin-access"`, 만료 15분, 시크릿 `JWT_ADMIN_SECRET`
- refresh token: `type: "admin-refresh"`, 만료 **1일**, 시크릿 `JWT_ADMIN_REFRESH_SECRET`
- Valkey 세션 키: `admin-refresh:{adminId}:{sid}` — 제품 키(`refresh:`)와 네임스페이스 분리
- refresh 회전과 재사용 탐지는 `session.service.ts`의 compare-and-set 스크립트 방식을 그대로 재사용한다.
- `admin_users.sessionVersion` 증가로 전체 세션 무효화

### 4.3 최초 어드민 부트스트랩

`backend/src/scripts/create-admin-user.ts`를 추가한다. 이메일·비밀번호를 인자로 받아 `admin_users`에 행을 삽입한다. 어드민 콘솔에는 어드민 계정 자체를 생성하는 UI를 넣지 않는다 — 권한 상승 경로를 UI로 열지 않고 서버 접근 권한이 있는 사람만 어드민을 늘릴 수 있게 한다.

## 5. 데이터 모델 변경

### 5.1 신규: `admin_users`

```
id             uuid pk default random
email          varchar(255) not null unique
name           varchar(255) not null
passwordHash   varchar(255) not null
sessionVersion integer not null default 0
lastLoginAt    timestamptz nullable
createdAt      timestamptz not null default now
```

### 5.2 신규: `admin_audit_logs`

```
id          uuid pk default random
adminId     uuid not null references admin_users(id) on delete restrict
action      varchar(64) not null      -- 예: "user.create", "workspace.delete"
targetType  varchar(32) not null      -- "user" | "workspace" | "project" | "whiteboard_document" | "admin"
targetId    uuid nullable
summary     varchar(255) not null     -- 목록에 바로 보여줄 한국어 요약
metadata    jsonb not null default {} -- 변경 전/후 값 등
ip          varchar(45) nullable
userAgent   varchar(512) nullable
createdAt   timestamptz not null default now
```

인덱스: `(createdAt desc)`, `(targetType, targetId)`, `(adminId, createdAt desc)`.

`adminId`는 `on delete restrict`로 둔다 — 감사 로그가 어드민 삭제로 사라지면 감사 기능의 목적이 무너진다.

### 5.3 변경: `users.deactivatedAt`

```
deactivatedAt  timestamptz nullable
```

사용자 하드 삭제는 위험하다. `workspaces.ownerId`, `projects.creatorId`, `whiteboard_documents.creatorId`가 모두 `onDelete: "cascade"`이므로, 사용자 한 행을 지우면 그가 소유한 워크스페이스와 그 하위 프로젝트·문서, 그리고 그가 다른 워크스페이스에서 만든 프로젝트·문서까지 연쇄 삭제된다. 따라서 어드민의 기본 "계정 정지"는 `deactivatedAt` 설정(소프트)으로 하고, 하드 삭제는 영향 범위를 미리 집계해 보여준 뒤 별도 확인을 받는 경로로 분리한다.

`deactivatedAt`이 설정된 사용자에 대한 규칙:

- `auth.service.login` — `ACCOUNT_DEACTIVATED` 403으로 차단
- `auth.service.refresh` — 동일하게 차단 (정지 시 `sessionVersion`도 증가시켜 기존 세션을 즉시 무효화)
- 멤버 추가용 사용자 검색 결과에서 제외
- 이미 멤버인 경우 멤버 목록에는 계속 표시된다 (데이터 정합성 유지; 접근은 로그인 단계에서 차단됨)

## 6. API 설계

모든 엔드포인트는 `/admin` prefix 아래, `authenticateAdmin` 적용. 목록 응답은 기존 `listQuerySchema`(`page`, `limit`, `search`)와 페이지네이션 응답 형태를 재사용한다. 오류 응답은 기존 `{ error: { message, code } }` 계약과 `HttpError`를 따르고, 메시지는 `ERROR_MESSAGES`에 상수로 추가한다.

### 인증

| Method | Path | 설명 |
|---|---|---|
| POST | `/admin/auth/login` | 어드민 로그인, refresh는 httpOnly 쿠키 |
| POST | `/admin/auth/refresh` | access 재발급 + refresh 회전 |
| POST | `/admin/auth/logout` | 세션 폐기 |
| GET | `/admin/auth/me` | 현재 어드민 정보 |

### 사용자

| Method | Path | 설명 |
|---|---|---|
| GET | `/admin/users` | 목록 — 검색(이름·이메일), 정지 여부 필터 |
| POST | `/admin/users` | 계정 생성 + 기본 워크스페이스(My Workspace) 자동 생성 |
| GET | `/admin/users/:userId` | 상세 — 소속 워크스페이스, 생성 리소스 수 |
| PATCH | `/admin/users/:userId` | 이름·이메일 변경 |
| POST | `/admin/users/:userId/password` | 비밀번호 재설정 (+ 전체 세션 무효화) |
| POST | `/admin/users/:userId/deactivate` | 계정 정지 (+ 전체 세션 무효화) |
| POST | `/admin/users/:userId/reactivate` | 정지 해제 |
| POST | `/admin/users/:userId/sessions/revoke` | 전체 세션 강제 종료 |
| GET | `/admin/users/:userId/deletion-impact` | 하드 삭제 시 연쇄 삭제될 리소스 수 |
| DELETE | `/admin/users/:userId` | 하드 삭제 — 요청 본문에 확인용 이메일 일치 요구 |

계정 생성은 `PRODUCT.md` 596행에 따라 기본 워크스페이스를 같은 트랜잭션에서 생성한다. 기존 `2026-09-08-default-workspace-provisioning-design.md`의 프로비저닝 로직을 재사용한다.

### 워크스페이스

| Method | Path | 설명 |
|---|---|---|
| GET | `/admin/workspaces` | 전역 목록 — 소유자·멤버 수·프로젝트 수 포함 |
| GET | `/admin/workspaces/:workspaceId` | 상세 — 멤버 목록, 프로젝트 목록 |
| PATCH | `/admin/workspaces/:workspaceId` | 이름 변경 |
| POST | `/admin/workspaces/:workspaceId/transfer-owner` | 소유자 이전 (대상은 기존 멤버여야 함) |
| POST | `/admin/workspaces/:workspaceId/members` | 멤버 추가 |
| DELETE | `/admin/workspaces/:workspaceId/members/:userId` | 멤버 제거 (Owner는 제거 불가) |
| DELETE | `/admin/workspaces/:workspaceId` | 하드 삭제 (제품과 동일하게 cascade) |

기본 워크스페이스(`isDefault`)는 어드민도 단독 삭제·이름 변경할 수 없다. 제품의 불변식(모든 사용자는 기본 워크스페이스를 하나 가진다)을 어드민이 깨면 제품 화면이 빈 상태로 붕괴한다. 삭제는 사용자 하드 삭제 경로에서만 연쇄적으로 일어난다.

### 프로젝트 / 화이트보드 문서

| Method | Path | 설명 |
|---|---|---|
| GET | `/admin/projects` | 전역 목록 — 워크스페이스·생성자, 삭제 포함 여부 필터 |
| GET | `/admin/projects/:projectId` | 상세 — 문서 목록 |
| DELETE | `/admin/projects/:projectId` | 소프트 삭제 |
| POST | `/admin/projects/:projectId/restore` | 복구 |
| GET | `/admin/whiteboard-documents` | 전역 목록 |
| DELETE | `/admin/whiteboard-documents/:documentId` | 소프트 삭제 |
| POST | `/admin/whiteboard-documents/:documentId/restore` | 복구 |

프로젝트와 화이트보드 문서는 제품에서 이미 소프트 삭제(`deletedAt`)를 쓴다. 어드민은 이 구조를 그대로 활용해 **복구**를 제공한다 — 제품에는 없는, 어드민만의 실질적 가치다.

복구 의미론은 현재 제품 동작에 맞춘다. `project.service.ts`의 `deleteProject`는 `projects.deletedAt`만 설정하고 하위 `whiteboard_documents.deletedAt`은 건드리지 않는다 (문서는 프로젝트 경유 조회라 자동으로 숨겨진다). 따라서 프로젝트 복구는 `projects.deletedAt`만 비우면 되고, 그 시점에 개별 삭제되지 않았던 문서는 자동으로 다시 보인다. 프로젝트 삭제 전에 개별 삭제된 문서는 삭제 상태로 유지된다 — 별도 처리가 필요 없다.

### 대시보드 / 운영

| Method | Path | 설명 |
|---|---|---|
| GET | `/admin/dashboard/metrics` | 사용자·워크스페이스·프로젝트·문서 총계, 최근 7일 생성 추이 |
| GET | `/admin/system/status` | DB/Valkey 연결 상태, 실시간 화이트보드 세션 수 |
| GET | `/admin/audit-logs` | 감사 로그 — 어드민·액션·대상 타입·기간 필터 |

## 7. 감사 로그 계약

- 모든 상태 변경(POST/PATCH/DELETE) 어드민 엔드포인트는 감사 로그를 **1건 이상** 기록한다. 조회(GET)는 기록하지 않는다.
- 기록은 대상 변경과 **같은 트랜잭션**에서 수행한다. 변경은 성공했는데 로그가 없는 상태를 허용하지 않는다.
- `metadata`에는 변경 전/후 값을 담되 `passwordHash`와 평문 비밀번호는 절대 포함하지 않는다. 비밀번호 재설정은 `{ "passwordReset": true }`만 남긴다.
- 서비스 계층이 아니라 컨트롤러 계층에서 호출한다 — 어드민 서비스가 제품 서비스를 재사용할 때 제품 경로에서 감사 로그가 발생하지 않도록.

## 8. 오류 계약

추가할 코드와 상태:

| code | status | 상황 |
|---|---|---|
| `UNAUTHORIZED` | 401 | 어드민 토큰 누락·무효 (기존 코드 재사용) |
| `ADMIN_NOT_FOUND` | 404 | 어드민 계정 없음 |
| `ACCOUNT_DEACTIVATED` | 403 | 정지된 계정의 제품 로그인·리프레시 시도 |
| `EMAIL_ALREADY_EXISTS` | 409 | 계정 생성 시 이메일 중복 |
| `USER_DELETE_CONFIRMATION_MISMATCH` | 400 | 하드 삭제 확인 이메일 불일치 |
| `WORKSPACE_DEFAULT_DELETE_FORBIDDEN` | 403 | 기본 워크스페이스 삭제 시도 (기존 코드 재사용) |
| `TRANSFER_TARGET_NOT_MEMBER` | 400 | 소유자 이전 대상이 멤버가 아님 |
| `RESOURCE_NOT_DELETED` | 400 | 삭제되지 않은 리소스 복구 시도 |

## 9. 환경변수와 배포

### 신규 환경변수 (backend)

| 변수 | 설명 |
|---|---|
| `JWT_ADMIN_SECRET` | 어드민 access 서명 키 (32자 이상) |
| `JWT_ADMIN_REFRESH_SECRET` | 어드민 refresh 서명 키 (32자 이상) |
| `ADMIN_CORS_ORIGIN` | 어드민 콘솔 오리진 |

`config/env.ts`의 `envSchema`에 추가한다. 제품 시크릿과 동일한 값을 쓰면 토큰 분리가 무의미하므로, 어드민 시크릿이 제품 시크릿과 같으면 부팅 실패하도록 검증을 넣는다.

### CORS 적용 방식 변경

현재 `createApp`은 `cors({ origin: getEnv().CORS_ORIGIN })`를 앱 전역에 한 번 적용한다. 어드민 오리진이 추가되므로 라우터별로 CORS를 나눈다 — `/admin/*`에는 `ADMIN_CORS_ORIGIN`, 나머지에는 `CORS_ORIGIN`. 전역에 두 오리진을 모두 허용하면 제품 API가 어드민 오리진에서도 호출 가능해져 격리가 약해진다.

### rate limit

`/admin/auth/login`은 제품 로그인보다 엄격한 버킷을 적용한다 (어드민 계정은 수가 적고 무차별 대입의 가치가 크다). `rate-limit.middleware.ts`에 어드민 버킷을 추가한다.

### docker-compose

`admin` 서비스를 추가한다.

```
admin:
  build:
    context: ./admin
    args:
      VITE_API_BASE_URL: ${ADMIN_VITE_API_BASE_URL:?...}
  restart: unless-stopped
  ports:
    - "127.0.0.1:8081:80"
```

`127.0.0.1` 바인딩으로 기본적으로 로컬/내부망 전용이다. 외부 노출이 필요하면 리버스 프록시에서 인증·IP 제한을 앞단에 둔다. `docs/deployment/docker-compose.md`에 함께 반영한다.

## 10. 프런트엔드 설계 (`admin/`)

`frontend/`와 동일한 스택·규약을 따른다 — Vite, TypeScript, TanStack Router(파일 기반), TanStack Query, zustand, react-hook-form + zod, TanStack Table, Tailwind v4 + shadcn/ui, vitest + @testing-library/react. FSD 레이어 구조와 `src/routes/`는 `pages/`로의 얇은 매핑만 담당하는 규약도 그대로 유지한다.

UI는 §3.2의 `packages/ui`를 의존한다. `admin/`에는 테마 CSS도 프리미티브 컴포넌트도 두지 않는다 — 어드민 전용 디자인 파일은 존재하지 않는다. `admin/src/shared/ui`에는 패키지에 없는 어드민 전용 조합(예: 감사 로그 표 셸)만 들어간다.

어드민임을 즉시 구분할 수 있도록 상단 바에 환경 배지를 둔다. 운영 도구는 밀도 높은 표 중심 레이아웃을 우선하므로, 공유 프리미티브를 쓰되 `DESIGN.md`의 제품 여백 규칙을 그대로 옮기지는 않는다. 밀도 차이는 레이아웃 레벨에서 조정하고 토큰을 어드민용으로 오버라이드하지 않는다.

### 레이어 구조와 네이밍

```
app/       providers, router 인스턴스, 전역 스타일(packages/ui 테마 import)
routes/    TanStack Router 파일 기반 — pages 연결만
pages/     login, home(대시보드), users, user-detail, workspaces,
           workspace-detail, projects, project-detail,
           whiteboard-documents, audit-logs, system
widgets/   app-shell(사이드바 + 환경 배지 상단바)
features/  auth, user, workspace, project, whiteboard-document, audit-log
entities/  admin-session, user, workspace, project, whiteboard-document, audit-log
shared/    api(axios + refresh 인터셉터), config, lib, types, ui
```

`admin/` 앱 안에서는 모든 것이 어드민이므로 슬라이스 이름에 `admin-` 접두사를 붙이지 않는다. `frontend/`의 `entities/project`·`features/member` 네이밍과 일관되게 유지한다.

예외는 `entities/admin-session` 하나다. 어드민 본인의 로그인 세션과 관리 대상인 사용자 세션이 함께 등장하므로 구분이 필요하다.

**백엔드는 반대 규칙이다.** `src/services/`에 제품용 `user.service.ts`와 어드민용 서비스가 같은 디렉터리에 나란히 놓이므로 `admin-user.service.ts`처럼 접두사를 붙인다. 컨트롤러·스키마·라우트도 동일하다.

`shared/ui`는 거의 비어 있다 — 프리미티브는 §3.2의 `packages/ui`에서 오고, 여기에는 패키지에 없는 어드민 전용 조합만 둔다.

### 라우트 구조

```
/login                       어드민 로그인
/                            대시보드
/users                       사용자 목록
/users/$userId               사용자 상세
/workspaces                  워크스페이스 목록
/workspaces/$workspaceId     워크스페이스 상세
/projects                    프로젝트 목록
/projects/$projectId         프로젝트 상세
/whiteboard-documents        화이트보드 문서 목록
/audit-logs                  감사 로그
/system                      운영 상태
```

`redirectIfUnauthenticated`에 대응하는 어드민 가드를 `admin/src/features/auth/model/route-guards.ts`에 둔다. 제품 구현(`frontend/src/features/auth/model/route-guards.ts`)의 refresh-후-재시도 패턴을 따르고, `auth.service.refresh`의 재사용 탐지 주석에 명시된 대로 401을 자동 재시도하지 않는다.

### 파괴적 작업의 UI 계약

- 삭제·정지·소유자 이전은 확인 모달을 거친다 (`PRODUCT.md`의 확인 단계 원칙과 일관).
- 사용자 하드 삭제는 `deletion-impact` 결과(연쇄 삭제될 워크스페이스/프로젝트/문서 수)를 표시하고, 대상 이메일을 직접 입력해야 버튼이 활성화된다.
- 복구 가능한 소프트 삭제와 복구 불가능한 하드 삭제를 문구로 명확히 구분한다.

## 11. 위험과 완화

| 위험 | 완화 |
|---|---|
| 사용자 하드 삭제의 광범위한 cascade | 기본 경로를 소프트 정지로 제공, 하드 삭제는 영향 범위 집계 + 이메일 확인 입력 |
| 어드민 자격증명 탈취 | 자격증명·시크릿·오리진 완전 분리, refresh 1일, 로그인 rate limit 강화, 기본 내부망 바인딩 |
| 어드민이 제품 불변식 위반 | 기본 워크스페이스 삭제·이름 변경 차단, 소유자 이전 대상 멤버십 검증, Owner 멤버 제거 차단 |
| 감사 누락 | 변경과 같은 트랜잭션에서 기록, 컨트롤러 계층에 강제, 라우터 테스트로 로그 생성 검증 |
| 어드민 계정이 제품 사용자 목록 노출 | 테이블 분리로 구조적 차단 |
| 두 프런트엔드의 시각 언어 드리프트 | 테마 CSS와 프리미티브를 `packages/ui` 한 곳에 두어 구조적으로 차단. 어드민용 토큰 오버라이드를 금지 |
| 단계 0의 import 재작성이 제품 회귀를 유발 | 추출 전후로 `frontend`의 `pnpm test`·`pnpm build`를 실행해 동일 통과를 확인. 기능 변경 없는 순수 이동으로 제한 |
| Docker 빌드 컨텍스트 변경이 배포를 깬다 | 단계 0에서 `docker compose build`로 frontend 이미지 빌드 성공을 확인한 뒤 진행 |

## 12. 단계 구분

| 단계 | 내용 |
|---|---|
| 0 | 디자인 시스템 추출 — 루트 pnpm workspace, `packages/ui`(테마 CSS + 범용 프리미티브), `frontend` import 재작성, Docker 빌드 컨텍스트 조정 |
| 1 | 기반 — `admin_users`, `admin_audit_logs`, `users.deactivatedAt` 마이그레이션, 어드민 JWT·세션·`authenticateAdmin`, CORS/rate limit 분리, 부트스트랩 스크립트, `admin/` 앱 셸 + 로그인 + 레이아웃 |
| 2 | 사용자 관리 — 목록/상세/생성/수정/비밀번호 재설정/정지/세션 종료/하드 삭제 |
| 3 | 워크스페이스 관리 — 목록/상세/이름 변경/소유자 이전/멤버 관리/삭제 |
| 4 | 프로젝트·문서 관리 — 목록/상세/삭제/복구 |
| 5 | 대시보드·감사 로그 뷰·운영 상태 |

각 단계는 백엔드와 프런트엔드를 함께 완료해 그 단계만으로 동작하는 상태를 만든다.

## 13. 검증 계획

- 백엔드: `backend` 기존 vitest 구조를 따라 서비스 단위 테스트와 라우터 통합 테스트를 작성한다. 각 변경 엔드포인트는 (1) 정상 동작 (2) 어드민 미인증 401 (3) 제품 access token으로 호출 시 401 (4) 감사 로그 1건 생성 — 네 가지를 최소로 검증한다.
- 제품 회귀: `users.deactivatedAt` 도입으로 `auth.service`의 login/refresh가 바뀌므로 기존 인증 테스트에 정지 계정 케이스를 추가한다. 멤버 검색에서 정지 계정 제외도 회귀 테스트를 추가한다.
- 프런트엔드: `admin/`에 vitest + @testing-library/react로 라우트 가드, 목록 렌더, 파괴적 작업 확인 모달 동작을 검증한다.
- 단계 0: 기능 변경이 없는 순수 이동이므로 신규 테스트를 작성하지 않는다. 대신 이동한 테스트가 `packages/ui`에서 그대로 통과하고, `frontend`의 `pnpm test`·`pnpm build`·`pnpm lint`가 추출 전과 동일하게 통과하는 것을 검증 기준으로 삼는다. `docker compose build frontend` 성공도 확인한다.
- 완료 전 `backend`·`admin`·`packages/ui` 각각에서 `pnpm lint`, `pnpm test`, `pnpm build`를 실행하고, `frontend`는 회귀 확인을 위해 `pnpm test`와 `pnpm build`를 실행한다.
