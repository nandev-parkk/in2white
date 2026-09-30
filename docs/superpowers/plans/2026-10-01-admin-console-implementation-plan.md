# 어드민 콘솔 구현 계획

- 작성일: 2026-10-01
- 설계: [2026-10-01-admin-console-design.md](../specs/2026-10-01-admin-console-design.md)
- 브랜치: 단계 0은 `refactor/shared-design-system`, 이후 단계는 `feat/admin-console-<단계>`로 분리

모든 단계는 `실패 테스트 → 최소 구현 → 통과 확인 → 리팩터링` 순서로 진행한다. 각 단계는 백엔드와 프런트엔드를 함께 끝내 그 단계만으로 동작하는 상태를 만든다.

## 단계 0. 디자인 시스템 추출 (`packages/ui`)

어드민 전용 디자인 파일을 만들지 않기 위한 선행 작업이다. 기능 변경이 없는 순수 이동으로 제한하고, 어드민 코드는 이 단계에서 한 줄도 추가하지 않는다.

TDD 관점: 새 동작이 없으므로 신규 테스트를 작성하지 않는다. 대신 **기존 테스트를 안전망으로 고정**한다 — 시작 전 `frontend`의 `pnpm test`·`pnpm build`·`pnpm lint` 결과를 기록하고, 각 하위 단계 후 동일하게 통과하는지 확인한다. 이동한 컴포넌트 테스트는 `packages/ui`에서 그대로 실행되어야 한다.

### 0.1 기준선 기록

```bash
cd frontend && pnpm lint && pnpm test && pnpm build
```

통과한 테스트 수를 기록한다. 이 수가 단계 0 종료 시점에도 같아야 한다 (이동만 했으므로).

**기록한 기준선 (2026-10-01, `dev` @ 9c01c35 + 미커밋 uuid 수정)**

| 대상     | lint | test                                                                   | build               |
| -------- | ---- | ---------------------------------------------------------------------- | ------------------- |
| frontend | 통과 | 84 files / 477 tests 통과                                              | 성공                |
| backend  | 통과 | 38 passed + 3 skipped (41 files) / 544 passed + 16 skipped (560 tests) | 미실행(단계 0 무관) |

### 0.2 루트 pnpm workspace 승격

- 루트 `pnpm-workspace.yaml` 생성 — `packages: ['frontend', 'backend', 'admin', 'packages/*']`
- `frontend/pnpm-workspace.yaml`·`backend/pnpm-workspace.yaml`의 `allowBuilds` 설정을 루트로 통합하고 개별 파일 제거
- 루트 `package.json` 생성 (private, 워크스페이스 스크립트만)
- `pnpm install`로 lockfile 재생성 — `frontend`·`backend` 양쪽 테스트 통과 확인

### 0.3 `packages/ui` 스캐폴딩

- `packages/ui/package.json` — 이름 `@in2white/ui`, `exports`로 서브패스 공개, peerDependencies에 react/react-dom
- `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`, Tailwind v4 플러그인 설정을 `frontend/`에서 가져와 구성
- 빈 상태에서 `pnpm build`·`pnpm test` 통과 확인

### 0.4 테마 CSS 이동

- `frontend/src/app/styles/index.css` → `packages/ui/src/styles/theme.css`
- `frontend/src/app/styles/index.css`는 `@import '@in2white/ui/styles/theme.css'`와 앱 고유 스타일만 남긴다
- `frontend/components.json`의 `tailwind.css` 경로 확인 및 갱신
- `frontend` 개발 서버와 빌드에서 스타일이 동일하게 적용되는지 확인 — Storybook도 함께 확인

### 0.5 공통 유틸·문구 이동

- `frontend/src/shared/lib/utils.ts`(+ `utils.test.ts`) → `packages/ui/src/lib/utils.ts`
- `frontend/src/shared/lib/hooks/use-card-motion` → `packages/ui/src/lib/hooks/`
- `frontend/src/shared/constants/messages/common.ts` → `packages/ui/src/constants/common-messages.ts`
- `frontend`의 `constants/messages/index.ts`는 패키지의 `COMMON_MESSAGES`를 re-export해 기존 `MESSAGES.common.*` 접근을 유지한다. 도메인 메시지 모듈은 그대로 `frontend`에 남는다.
- `messages.test.ts`가 계속 통과하는지 확인

### 0.6 범용 프리미티브 이동

설계 §3.2의 경계 표에 따라 이동한다. 대상 컴포넌트의 `.tsx`·`.test.tsx`·`.stories.tsx`를 함께 옮긴다.

`frontend/`에 잔류: `whiteboard-card`, `live-cursor`, `presence-avatar-stack`, `app-shell-header` — 화이트보드·협업 도메인 컴포넌트다. 이들이 패키지의 프리미티브를 import하도록 경로만 바꾼다.

이동한 컴포넌트 내부의 `@/shared/constants/messages` import는 패키지 자체의 `COMMON_MESSAGES`로 바꾼다 (8개 파일).

### 0.7 `frontend` import 재작성

- 76개 파일, 188개 import 지점의 `@/shared/ui` → `@in2white/ui`
- 기계적 치환 후 `pnpm lint`·`pnpm test`·`pnpm build`로 검증한다. 타입 검사가 누락을 잡는다.
- `frontend/src/shared/ui/`에는 잔류 도메인 컴포넌트만 남는다

### 0.8 Docker 빌드 컨텍스트 조정

- 루트 `.dockerignore` 작성 (`frontend/.dockerignore` 내용을 기준으로 워크스페이스 전체에 맞게)
- `frontend/Dockerfile` — 루트 컨텍스트 기준으로 `pnpm-workspace.yaml`, 루트 `package.json`, `pnpm-lock.yaml`, `packages/ui`, `frontend` 복사 후 `pnpm --filter frontend build`
- `backend/Dockerfile`도 루트 컨텍스트로 맞춘다
- `docker-compose.yml`의 `build.context`를 `.`로, `dockerfile`을 각 경로로 지정
- `docker compose build frontend backend` 성공 확인

### 0.9 종료 확인

```bash
pnpm -r lint && pnpm -r test && pnpm -r build
docker compose build frontend backend
```

0.1에서 기록한 테스트 수와 일치하는지 확인한다. 불일치하면 이동 누락이다.

## 단계 1. 기반 — 권한 모델과 어드민 셸

### 1.1 스키마와 마이그레이션 (backend)

- `src/db/schema/admin-users.ts` — `admin_users` 테이블, `createInsertSchema`/`createSelectSchema` 포함
- `src/db/schema/admin-audit-logs.ts` — `admin_audit_logs` 테이블, `(createdAt desc)`·`(targetType, targetId)`·`(adminId, createdAt desc)` 인덱스
- `src/db/schema/users.ts` — `deactivatedAt` 컬럼 추가
- `src/db/schema/index.ts`·`relations.ts` 에 신규 테이블 등록
- `pnpm drizzle-kit generate`로 마이그레이션 생성 후 `src/db/migrations` 커밋

테스트: 스키마 자체보다 이후 서비스 테스트로 검증한다. 마이그레이션은 테스트 DB 부팅으로 확인한다.

### 1.2 어드민 환경변수 (backend)

- 실패 테스트: `parseEnv`가 `JWT_ADMIN_SECRET` 누락 시 실패하고, 어드민 시크릿이 제품 시크릿과 같으면 실패하는 테스트
- 구현: `config/env.ts`의 `envSchema`에 `JWT_ADMIN_SECRET`, `JWT_ADMIN_REFRESH_SECRET`, `ADMIN_CORS_ORIGIN` 추가 + `superRefine`으로 시크릿 중복 검증
- `.env.example`과 `docs/deployment/docker-compose.md` 갱신

### 1.3 어드민 JWT (backend)

- 실패 테스트: `signAdminAccessToken`으로 만든 토큰이 `verifyAccessToken`(제품)으로 검증 실패하고, 그 역도 실패하는 테스트
- 구현: `src/lib/admin-jwt.ts` — `type: "admin-access"` / `"admin-refresh"`, access 15분, refresh 1일, 어드민 시크릿 사용. `lib/jwt.ts`의 payload 검증 방식을 그대로 따른다.

### 1.4 어드민 세션 (backend)

- 실패 테스트: `admin-refresh:` 키 네임스페이스 사용, 회전 후 이전 토큰 재사용 시 세션 폐기
- 구현: `src/services/admin-session.service.ts` — `session.service.ts`의 compare-and-set Lua 스크립트 패턴 재사용, TTL 1일

### 1.5 어드민 인증 서비스와 미들웨어 (backend)

- 실패 테스트:
  - 존재하지 않는 어드민 로그인 시 `compareDummyPassword` 경유로 타이밍 노출 없이 401
  - 비밀번호 불일치 401
  - 정상 로그인 시 access/refresh 발급 + `lastLoginAt` 갱신
  - `sessionVersion` 불일치 refresh 401
  - `authenticateAdmin`이 제품 access token을 401로 거부
- 구현: `src/services/admin-auth.service.ts`, `src/middlewares/admin-auth.middleware.ts`, `req.admin` 타입 확장(`src/types`)

### 1.6 감사 로그 서비스 (backend)

- 실패 테스트:
  - 트랜잭션 핸들을 받아 같은 트랜잭션에 기록
  - `metadata`에 `passwordHash`·평문 비밀번호가 들어가면 기록 전에 제거되는지
- 구현: `src/services/admin-audit-log.service.ts` — `recordAuditLog(tx, { adminId, action, targetType, targetId, summary, metadata, ip, userAgent })`

### 1.7 라우터 조립과 CORS/rate limit 분리 (backend)

- 실패 테스트:
  - `/admin/*` 요청이 `ADMIN_CORS_ORIGIN`만 허용하는지
  - 제품 API가 어드민 오리진에서 차단되는지
  - `/admin/auth/login`이 제품 로그인보다 엄격한 rate limit 버킷을 쓰는지
- 구현: `src/routes/admin/index.ts`에 `createAdminRouter()`, `src/app.ts`에서 라우터별 `cors` 적용, `rate-limit.middleware.ts`에 어드민 버킷 추가

### 1.8 정지 계정 처리 (backend, 제품 회귀)

- 실패 테스트(회귀): `deactivatedAt`이 설정된 사용자의 제품 로그인·리프레시가 403 `ACCOUNT_DEACTIVATED`로 차단되는지, 멤버 검색 결과에서 제외되는지
- 구현: `auth.service.login`/`refresh`, `member.service` 사용자 검색 쿼리 수정
- `constants/messages.ts`에 신규 메시지 추가

### 1.9 부트스트랩 스크립트 (backend)

- `src/scripts/create-admin-user.ts` — 이메일·비밀번호·이름 인자, 중복 이메일 시 명확한 실패. `create-test-user.ts` 구조를 따른다.

### 1.10 `admin/` 앱 셸 (frontend)

- `admin/`을 루트 workspace 멤버로 추가하고 `@in2white/ui`를 의존으로 선언. 테마 CSS와 프리미티브는 패키지에서 가져오며 어드민 전용 디자인 파일은 만들지 않는다.
- `frontend/`의 설정 파일(`tsconfig*.json`, `eslint.config.js`, `.prettierrc`, `vite.config.ts`, `components.json`)을 기준으로 `admin/` 초기화
- `Dockerfile`·`nginx.conf`는 루트 빌드 컨텍스트 기준으로 `frontend/` 것을 따라 작성
- FSD 레이어 디렉터리 생성, `shared/api` axios 인스턴스 + refresh 인터셉터(401 자동 재시도 금지)
- `entities/admin-session` zustand 스토어, `features/auth` 로그인 폼 + 라우트 가드
- `widgets/app-shell` 사이드바 + 상단바(환경 배지)
- 라우트: `/login`, `/` (빈 대시보드 자리)
- 실패 테스트: 미인증 시 `/login` 리다이렉트, 로그인 성공 시 `/` 진입, 로그아웃 동작

### 1.11 배포 설정

- `docker-compose.yml`에 `admin` 서비스 추가 (`127.0.0.1:8081:80` 바인딩)
- `docs/deployment/docker-compose.md`에 어드민 서비스와 신규 환경변수 반영

## 단계 2. 사용자 관리

### 2.1 백엔드

각 엔드포인트마다 실패 테스트를 먼저 작성한다. 공통 4종 검증(정상 / 미인증 401 / 제품 토큰 401 / 감사 로그 1건)을 모든 변경 엔드포인트에 적용한다.

- `GET /admin/users` — `listQuerySchema` 재사용, 정지 여부 필터, 소속 워크스페이스 수 집계
- `POST /admin/users` — 이메일 중복 409, 비밀번호는 `password.schema.ts` 재사용, 기본 워크스페이스 동일 트랜잭션 생성
- `GET /admin/users/:userId` — 소속 워크스페이스 목록, 생성 리소스 수
- `PATCH /admin/users/:userId` — 이름·이메일, 이메일 변경 시 중복 검사
- `POST /admin/users/:userId/password` — 재설정 + `sessionVersion` 증가 + Valkey 세션 삭제
- `POST /admin/users/:userId/deactivate` / `reactivate` — 정지 시 `sessionVersion` 증가
- `POST /admin/users/:userId/sessions/revoke`
- `GET /admin/users/:userId/deletion-impact` — cascade 대상 집계
- `DELETE /admin/users/:userId` — 확인 이메일 불일치 400

파일: `src/schemas/admin-user.schema.ts`, `src/services/admin-user.service.ts`, `src/controllers/admin-user.controller.ts`, `src/routes/admin/user.routes.ts`

### 2.2 프런트엔드

- `entities/user` 타입·API, `features/user` 목록/생성/수정/정지/삭제
- `pages/users`, `pages/user-detail`
- TanStack Table 기반 목록(검색·페이지네이션·정지 필터)
- 하드 삭제 모달: `deletion-impact` 표시 + 이메일 입력 일치 시에만 버튼 활성화
- 실패 테스트: 목록 렌더, 생성 폼 검증, 삭제 모달의 이메일 확인 게이트

## 단계 3. 워크스페이스 관리

### 3.1 백엔드

- `GET /admin/workspaces` — 소유자·멤버 수·프로젝트 수
- `GET /admin/workspaces/:workspaceId` — 멤버·프로젝트 목록
- `PATCH /admin/workspaces/:workspaceId` — 기본 워크스페이스 이름 변경 403
- `POST /admin/workspaces/:workspaceId/transfer-owner` — 대상 비멤버 400, 멤버십 role 갱신 포함
- `POST /admin/workspaces/:workspaceId/members`, `DELETE .../members/:userId` — Owner 제거 403
- `DELETE /admin/workspaces/:workspaceId` — 기본 워크스페이스 403

소유자 이전은 `workspaces.ownerId`와 `workspace_memberships.role` 두 곳을 같은 트랜잭션에서 바꿔야 한다. 이전 Owner는 `member`로 강등한다.

### 3.2 프런트엔드

- `entities/workspace`, `features/workspace`
- `pages/workspaces`, `pages/workspace-detail` (멤버 탭 + 프로젝트 탭)
- 소유자 이전은 현재 멤버 중에서만 선택 가능한 셀렉트

## 단계 4. 프로젝트·문서 관리와 복구

### 4.1 백엔드

- `GET /admin/projects`, `GET /admin/projects/:projectId`
- `DELETE /admin/projects/:projectId` — 소프트 삭제, 이미 삭제된 경우 404
- `POST /admin/projects/:projectId/restore` — 삭제되지 않은 리소스 복구 시 400 `RESOURCE_NOT_DELETED`
- `GET /admin/whiteboard-documents`, `DELETE`, `POST .../restore`

복구 테스트에서 고정할 동작: `deleteProject`는 `projects.deletedAt`만 설정하고 하위 문서는 건드리지 않음을 확인했다. 따라서 프로젝트 복구는 `projects.deletedAt`만 비우고, 개별 삭제되지 않았던 문서가 자동으로 다시 보이는지, 개별 삭제된 문서는 삭제 상태로 남는지를 테스트로 고정한다.

### 4.2 프런트엔드

- `entities/project`, `entities/whiteboard-document`, `features/project`, `features/whiteboard-document`
- `pages/projects`, `pages/project-detail`, `pages/whiteboard-documents`
- 삭제 상태 포함 토글, 복구 버튼, 소프트/하드 삭제 문구 구분

## 단계 5. 대시보드·감사 로그·운영 상태

### 5.1 백엔드

- `GET /admin/dashboard/metrics` — 총계 4종 + 최근 7일 일별 생성 추이
- `GET /admin/system/status` — DB `select 1`, Valkey `ping`, 실시간 화이트보드 세션 수 (`src/realtime` 조회)
- `GET /admin/audit-logs` — 어드민·액션·대상 타입·기간 필터, 페이지네이션

### 5.2 프런트엔드

- `pages/home` 대시보드 — 지표 카드 + 추이
- `pages/audit-logs` — 필터 + 표
- `pages/system` — 상태 표시

## 위험

| 위험                                            | 대응                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 사용자 하드 삭제의 cascade 범위가 예상보다 넓다 | 단계 2에서 `deletion-impact` 집계 테스트를 먼저 작성해 실제 cascade 범위를 테스트로 고정한다            |
| `users.deactivatedAt` 도입이 기존 인증을 깬다   | 단계 1.8에서 제품 인증 회귀 테스트를 먼저 추가한다. `frontend` 테스트도 함께 실행한다                   |
| 라우터별 CORS 전환이 기존 제품 요청을 깬다      | 전환 시 제품 오리진 허용·어드민 오리진 차단을 검증하는 테스트를 먼저 작성한다                           |
| 감사 로그 누락이 조용히 발생                    | 모든 변경 엔드포인트 테스트에 로그 1건 생성 검증을 필수로 포함한다                                      |
| 두 앱의 시각 언어 드리프트                      | 단계 0에서 테마 CSS와 프리미티브를 `packages/ui`로 단일화한다. 어드민용 토큰 오버라이드를 만들지 않는다 |
| 단계 0의 import 재작성이 제품 회귀를 유발       | 0.1에서 기준선(테스트 수)을 기록하고 0.9에서 일치를 확인한다. 기능 변경 없는 순수 이동으로 제한한다     |
| Docker 빌드 컨텍스트 변경이 배포를 깬다         | 0.8에서 `docker compose build frontend backend` 성공을 확인한 뒤 단계 1로 넘어간다                      |
| 단계 1이 커서 리뷰가 어렵다                     | 아래 커밋 계획대로 원자적으로 쪼갠다                                                                    |

## 커밋 계획

단계 0 (기능 변경 없음 — 전부 `refactor`/`build`):

1. `refactor: 루트 pnpm workspace로 승격`
2. `build: 공유 UI 패키지 스캐폴딩 추가`
3. `refactor: 테마 CSS를 공유 UI 패키지로 이동`
4. `refactor: 공통 유틸과 공통 문구를 공유 UI 패키지로 이동`
5. `refactor: 범용 UI 프리미티브를 공유 패키지로 이동`
6. `refactor: 프런트엔드 UI import를 공유 패키지 경로로 변경`
7. `build: Docker 빌드 컨텍스트를 워크스페이스 루트로 변경`

단계 1:

1. `feat: 어드민 사용자·감사 로그 스키마와 마이그레이션 추가`
2. `feat: 어드민 전용 환경변수와 검증 추가`
3. `feat: 어드민 JWT와 세션 서비스 추가`
4. `feat: 어드민 인증 서비스와 미들웨어 추가`
5. `feat: 어드민 감사 로그 서비스 추가`
6. `refactor: CORS와 rate limit을 라우터 단위로 분리`
7. `feat: 정지된 계정의 로그인과 검색 노출 차단`
8. `feat: 어드민 계정 부트스트랩 스크립트 추가`
9. `feat: 어드민 콘솔 앱 셸과 로그인 구현`
10. `build: 어드민 콘솔 배포 구성 추가`

단계 2~5는 각 엔드포인트 묶음과 대응 화면을 한 커밋으로 묶는다.

## 검증 명령

```bash
# 워크스페이스 전체
pnpm -r lint && pnpm -r test && pnpm -r build

# 단계 0 배포 회귀
docker compose build frontend backend
```

개별 실행이 필요할 때:

```bash
pnpm --filter @in2white/ui test
pnpm --filter frontend test
pnpm --filter backend test
pnpm --filter admin test
```

## 구현 결과

<!-- 각 단계 완료 시 실제 변경, 계획과 달라진 점, 실행한 검증, 남은 후속 작업을 기록한다 -->

## 단계 0 구현 결과 (2026-10-01, `refactor/shared-design-system`)

### 실제 변경

| 커밋                                                      | 내용                                                                                               |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `refactor: 루트 pnpm workspace로 승격`                    | 두 앱의 `pnpm-workspace.yaml`·lockfile을 루트로 통합, 루트 `package.json`·`.husky/pre-commit` 신설 |
| `build: 공유 UI 패키지 스캐폴딩 추가`                     | `packages/ui` (`@in2white/ui`) 생성, `frontend`가 `workspace:*`로 의존                             |
| `refactor: 테마 CSS를 공유 UI 패키지로 이동`              | `frontend/src/app/styles/index.css` → `packages/ui/src/styles/theme.css`                           |
| `refactor: 공통 유틸과 공통 문구를 공유 UI 패키지로 이동` | `lib/utils`, `lib/hooks/use-card-motion`, `constants/messages/common.ts` 이동                      |
| `refactor: 범용 UI 프리미티브를 공유 패키지로 이동`       | `shared/ui` 69개 파일 이동 + `frontend` import 125곳·`vi.mock` 6곳 재작성                          |
| `build: Docker 빌드 컨텍스트를 워크스페이스 루트로 변경`  | 두 Dockerfile을 워크스페이스 기준으로 재작성, 루트 `.dockerignore`로 통합                          |

`packages/ui` 최종 구성: `src/ui` 69개, `src/lib`(utils·use-card-motion), `src/constants/common-messages.ts`, `src/styles/theme.css`, `src/architecture.test.ts`.
`frontend/src/shared/ui` 잔류 11개: `app-shell-header`, `live-cursor`, `presence-avatar-stack`, `whiteboard-card`와 각 스토리·테스트, `brand-assets.test.tsx`.

### 계획과 달라진 점

| 항목                       | 계획                                                       | 실제                                | 이유                                                                                                                                                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.6·0.7 커밋 분리          | 이동 커밋과 import 재작성 커밋을 분리                      | 한 커밋으로 합침                    | 파일을 옮기면 `frontend`의 import 125곳이 즉시 깨진다. 이동만 담은 커밋은 빌드가 실패하는 중간 상태가 되므로 원자적 단위가 아니다.                                                                                                                                     |
| 테스트 수                  | 기준선 84파일 477건과 일치                                 | 85파일 480건                        | 프리미티브 69개가 `frontend/src/architecture.test.ts`의 검사 범위에서 빠지므로 `packages/ui/src/architecture.test.ts`에 같은 불변식을 세웠다(도메인 문구 비참조 1건 + 모션 계약 2건). 증가분은 정확히 이 3건이다.                                                      |
| 루트 `pnpm-workspace.yaml` | `packages: ['frontend', 'backend', 'admin', 'packages/*']` | `admin` 제외                        | 디렉터리가 없으면 pnpm이 경고한다. 1.10에서 `admin/`을 만들 때 추가한다.                                                                                                                                                                                               |
| 패키지 내부 경로           | 미정                                                       | 상대 경로만                         | `#ui/*`(Node subpath imports)를 시도했으나, 소비하는 앱의 `tsc -b`가 패키지 소스를 함께 검사하므로 consumer의 tsconfig에도 `paths` 매핑이 필요해졌다. 패키지 내부 규약이 앱으로 새는 구조여서 되돌렸다. eslint 규칙으로 `@/` 별칭을 금지해 Vite alias 오해석을 막았다. |
| `components.json`          | 경로 갱신                                                  | `tailwind.css`만 패키지 테마로 변경 | 컴포넌트 별칭을 패키지로 돌리려면 shadcn이 별칭을 tsconfig `paths`로 해석해야 하는데, 위와 같은 이유로 패키지에 `paths`를 둘 수 없다. 후속 작업으로 남긴다.                                                                                                            |
| husky                      | 언급 없음                                                  | 루트 훅 하나로 통합                 | 두 앱의 `prepare`가 `core.hooksPath`를 서로 덮어써서 `backend/.husky/pre-commit`이 실행되지 않고 있었다.                                                                                                                                                               |
| Storybook                  | 언급 없음                                                  | glob에 `packages/ui` 추가           | 스토리 25개가 패키지로 옮겨가 `frontend/src` glob에서 빠졌다. 수집되는 스토리 파일 수는 33개로 동일하다.                                                                                                                                                               |

### 실행한 검증

| 명령                                    | 결과                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| `pnpm -r lint`                          | 3개 패키지 모두 통과                                                                        |
| `pnpm -r test`                          | `packages/ui` 17파일 39건, `frontend` 68파일 441건, `backend` 38+3파일 544+16건 — 모두 통과 |
| `pnpm -r build`                         | 통과 (`tsc -b` / `vite build && tsc -b` / `tsc && tsc-alias`)                               |
| `pnpm -r format:check`                  | 통과                                                                                        |
| `docker compose build frontend backend` | 성공                                                                                        |

동작 보존 근거는 개수 일치만으로 두지 않았다.

- 테마 이동 후 `vite build` 산출 CSS가 이동 전 소스로 빌드한 결과와 **바이트 단위로 동일**했다(`index-DIIMsjDh.css`). `@font-face` 4개, `woff2` 8개, `animate-in` 유틸 모두 유지된다.
- 컨테이너 이미지 안의 CSS도 같은 해시이고, `backend` 이미지의 `/app/backend/dist/server.js`와 작업 디렉터리가 이전과 같다.
- 새로 세운 불변식은 red 확인을 했다. `packages/ui`의 한 파일에 `MESSAGES.project`를 넣으면 `ui/badge.tsx`로 검출되고, `motion-reduce:` 없는 `transition-colors`를 넣어도 검출된다. 원복 후 3건 통과.
- `backend` 테스트 수는 기준선과 완전히 동일하다. 단계 0은 백엔드를 건드리지 않았다.

### 남은 후속 작업

- ~~**`frontend` 전역 아이콘 계약 복구.**~~ 완료 (`test: frontend 전역 아이콘 계약 검사 복구`). `frontend/src` 전체를 대상으로 걷어낸 아이콘·인라인 `<svg>`·타 아이콘 라이브러리 금지 3건을 다시 세웠고, 각 검사에 위반을 주입해 실패를 확인했다.
- ~~**`cn` 불일치 정리.**~~ 완료 (`refactor: cn 구현을 저장소 것으로 통일`). `loading-state.tsx`·`spinner.tsx`만 npm `cn`을 쓰고 있었다. npm `cn`은 `text-body`를 색상으로 오인해 색상 유틸과 함께 쓰면 한쪽을 버린다. 현재 호출부는 둘을 같이 넘기지 않아 실제 출력은 동일했고, 회귀 테스트로 고정한 뒤 의존성을 제거했다.
- **`components.json` 정리 (미결).** 프리미티브가 `packages/ui`로 옮겨졌는데 `frontend/components.json`의 `components`·`ui`·`utils`·`lib`·`hooks` 별칭은 여전히 `@/shared/*`를 가리킨다. 지금 shadcn CLI로 프리미티브를 추가하면 `frontend/src/shared/ui`에 떨어진다. 별칭을 패키지로 돌리려면 shadcn이 별칭을 tsconfig `paths`로 해석해야 하는데, `#ui/*`를 되돌린 것과 같은 이유로 패키지에 `paths`를 둘 수 없다. 당장은 CLI 산출물을 `packages/ui/src/ui`로 옮기고 import를 상대 경로로 고치는 수동 절차로 두고, 단계 1에서 실제로 프리미티브를 추가할 때 결정한다.
- **`frontend`의 빈 자리표시자 (미결).** `src/shared/lib/hooks/`에 `.gitkeep`만 남았다. `src/shared/types/`와 함께 유지할지 정한다.
