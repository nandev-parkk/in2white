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

| 항목                       | 계획                                                       | 실제                                                  | 이유                                                                                                                                                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.6·0.7 커밋 분리          | 이동 커밋과 import 재작성 커밋을 분리                      | 한 커밋으로 합침                                      | 파일을 옮기면 `frontend`의 import 125곳이 즉시 깨진다. 이동만 담은 커밋은 빌드가 실패하는 중간 상태가 되므로 원자적 단위가 아니다.                                                                                                                                     |
| 테스트 수                  | 기준선 84파일 477건과 일치                                 | 85파일 480건                                          | 프리미티브 69개가 `frontend/src/architecture.test.ts`의 검사 범위에서 빠지므로 `packages/ui/src/architecture.test.ts`에 같은 불변식을 세웠다(도메인 문구 비참조 1건 + 모션 계약 2건). 증가분은 정확히 이 3건이다.                                                      |
| 루트 `pnpm-workspace.yaml` | `packages: ['frontend', 'backend', 'admin', 'packages/*']` | `admin` 제외                                          | 디렉터리가 없으면 pnpm이 경고한다. 1.10에서 `admin/`을 만들 때 추가한다.                                                                                                                                                                                               |
| 패키지 내부 경로           | 미정                                                       | 상대 경로만                                           | `#ui/*`(Node subpath imports)를 시도했으나, 소비하는 앱의 `tsc -b`가 패키지 소스를 함께 검사하므로 consumer의 tsconfig에도 `paths` 매핑이 필요해졌다. 패키지 내부 규약이 앱으로 새는 구조여서 되돌렸다. eslint 규칙으로 `@/` 별칭을 금지해 Vite alias 오해석을 막았다. |
| `components.json`          | 경로 갱신                                                  | `packages/ui`로 이동하고 별칭을 패키지 subpath로 교체 | 프리미티브가 패키지에 있으니 CLI도 패키지에서 돌아야 한다. shadcn 4.21은 별칭을 `package.json`의 `imports` → 워크스페이스 패키지 `exports` → tsconfig `paths` 순서로 해석한다. `exports`의 `"./*"`는 CLI가 처리하지 못해서 `imports`에 `#ui/*`를 두어 해석만 맡겼다.   |
| husky                      | 언급 없음                                                  | 루트 훅 하나로 통합                                   | 두 앱의 `prepare`가 `core.hooksPath`를 서로 덮어써서 `backend/.husky/pre-commit`이 실행되지 않고 있었다.                                                                                                                                                               |
| Storybook                  | 언급 없음                                                  | glob에 `packages/ui` 추가                             | 스토리 25개가 패키지로 옮겨가 `frontend/src` glob에서 빠졌다. 수집되는 스토리 파일 수는 33개로 동일하다.                                                                                                                                                               |

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
- ~~**`components.json` 정리.**~~ 완료. 아래 「프리미티브 추가 절차」 참고.
- ~~**`frontend`의 빈 자리표시자.**~~ 완료. `shared/lib/hooks/`는 `use-card-motion`이 패키지로 가면서 비었고, 훅의 정규 위치는 이미 `shared/hooks/`다. 디렉터리째 지웠다. `entities/`·`features/`·`shared/types/`의 `.gitkeep`은 실제 파일이 들어와 있어 함께 지웠다.

## 단계 1 구현 결과 (2026-10-01, `feat/admin-console`)

### 실제 변경

| 커밋                                                       | 내용                                                                                                      |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `feat: 어드민 콘솔 스키마와 마이그레이션 추가`             | `admin_users`·`admin_audit_logs` 테이블과 마이그레이션, 제품 `users.deactivated_at`                       |
| `feat: 어드민 전용 JWT 시크릿과 CORS 오리진 환경변수 추가` | `JWT_ADMIN_SECRET`·`JWT_ADMIN_REFRESH_SECRET`·`ADMIN_CORS_ORIGIN`, 제품 시크릿과 동일한 값이면 부팅 거부  |
| `feat: 어드민 전용 JWT 서명과 검증 추가`                   | `lib/admin-jwt.ts` — 어드민 시크릿으로만 검증, `ver` 불일치 거부                                          |
| `feat: 어드민 refresh 세션 저장소 추가`                    | `lib/admin-session-store.ts` — Valkey 키 공간 분리, 회전과 재사용 폐기                                    |
| `feat: 어드민 인증 서비스와 미들웨어 추가`                 | `admin-auth.service.ts`·`admin-account.service.ts`·`authenticate-admin.middleware.ts`                     |
| `feat: 어드민 감사 로그 기록 서비스 추가`                  | `admin-audit-log.service.ts` — `metadata`에 비밀값을 넣지 않는 계약 포함                                  |
| `feat: 어드민 라우터 마운트와 CORS·rate limit 분리`        | `routes/admin/*`·`controllers/admin-auth.controller.ts`, 경로 기반 CORS delegate, 어드민 로그인 전용 버킷 |
| `feat: 정지된 계정의 제품 접근 차단`                       | 제품 `login`·`refresh` 403, 멤버 후보·멤버 추가에서 정지 계정 제외                                        |
| `feat: 어드민 계정 부트스트랩 스크립트 추가`               | `createAdminUser` + `backend/src/scripts/create-admin-user.ts`                                            |
| `feat: 어드민 콘솔 프런트엔드 앱 셸 추가`                  | `admin/` workspace 신설(FSD 5계층, 55개 파일), pre-commit·`.gitignore`·lockfile 반영                      |
| `feat: 어드민 콘솔 배포 설정 추가`                         | compose `admin` 서비스(`127.0.0.1:8081:80`), 배포 가이드에 신규 변수와 첫 계정 생성 절차                  |

`admin/` 최종 구성: `shared`(api·config·constants·validation), `entities/admin-session`, `features/auth`, `widgets/app-shell`, `pages/{login,dashboard}`, `routes/{__root,login,index}`. 테마와 프리미티브는 모두 `@in2white/ui`에서 가져오며 `admin/`에는 디자인 파일이 없다.

### 계획과 달라진 점

| 항목                        | 계획                                        | 실제                                                          | 이유                                                                                                                                                     |
| --------------------------- | ------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.3 `ver` 검증              | 제품처럼 `payload.ver ?? 0`                 | `ver`가 숫자가 아니면 거부                                    | 기본값으로 보정하면 `ver` 없는 토큰이 언제나 최신 세션 버전과 일치할 수 있다. 어드민 토큰은 전 서비스 권한이라 관용을 두지 않았다.                       |
| 1.4 재사용 폐기 위치        | 세션 스토어                                 | `admin-auth.service.ts`                                       | 스토어는 키 조작만 알고, 재사용을 감지했을 때 어떤 세션을 얼마나 폐기할지는 인증 정책이다. 정책을 서비스에 모았다.                                       |
| 1.5 범위                    | 인증 서비스와 미들웨어                      | `admin-account.service.ts` 추가                               | 어드민 계정 조회·`lastLoginAt` 갱신을 인증 서비스에 두면 2단계의 계정 관리와 중복된다. 조회 계층을 처음부터 분리했다.                                    |
| 1.7 컨트롤러·라우트         | 라우터 조립만                               | `admin-auth.controller.ts`·`routes/admin/auth.routes.ts` 신설 | 마운트만으로는 CORS·rate limit 분리를 검증할 엔드포인트가 없다. 로그인·refresh·로그아웃·`me` 4개를 함께 넣어 테스트로 고정했다.                          |
| 1.7 CORS 적용               | 라우터별 `cors()` 미들웨어                  | 경로를 보고 origin을 고르는 단일 delegate                     | `cors`는 `origin`이 문자열이면 비교 없이 헤더에 넣는다. 두 번 쌓으면 뒤쪽이 앞쪽을 덮어써서 제품 오리진이 사라진다. delegate는 요청마다 오리진을 고른다. |
| 1.8 범위                    | 로그인·refresh 차단과 멤버 후보 제외        | `addMember` 대상 조회에서도 제외                              | 후보 검색만 막으면 알고 있는 `userId`를 직접 POST해 그대로 초대할 수 있다. 정지 계정을 `USER_NOT_FOUND`로 취급해 새 오류 코드를 늘리지 않았다.           |
| 1.9 비밀번호 전달           | 위치 인자                                   | `ADMIN_USER_PASSWORD` 환경변수                                | 인자로 받으면 셸 히스토리와 `ps` 출력에 평문이 남는다. 첫 어드민 비밀번호는 서비스 전체 권한이므로 흔적을 남기지 않는다.                                 |
| 1.10 `components.json`      | `frontend/` 것을 기준으로 `admin/`에도 생성 | 만들지 않음                                                   | 프리미티브는 `packages/ui`에 있고 shadcn CLI도 거기서 돈다. `admin/`에 두면 어드민 전용 프리미티브를 만들 경로가 열린다.                                 |
| 1.10 `architecture.test.ts` | 언급 없음                                   | `admin/`에는 두지 않음                                        | `frontend/`의 것은 과거 파일 이동 이력을 고정하는 검사다. 계층 경계는 `eslint.config.js`의 `no-restricted-imports`가 `admin/`에서도 그대로 막는다.       |
| 1.10 정적 자산              | 언급 없음                                   | `admin/public/favicon.svg`(제품과 같은 파일)                  | Vite는 다른 패키지의 `public/`을 참조하지 못한다. 디자인 파일이 아닌 파비콘 하나만 복사했다.                                                             |
| 1.11 compose 빌드           | `context: ./admin`                          | `context: .` + `dockerfile: admin/Dockerfile`                 | 루트 잠금 파일과 `packages/ui`가 필요하므로 빌드 컨텍스트는 워크스페이스 루트여야 한다. 단계 0에서 제품 이미지도 같은 형태로 바꿨다.                     |
| 1.11 환경 변수              | `ADMIN_VITE_API_BASE_URL`만                 | `ADMIN_ENVIRONMENT_LABEL` 추가                                | 상단바 환경 배지 문구는 빌드 시점에 고정된다. 미설정 시 `production`으로 빌드해, 운영을 스테이징으로 오인하는 방향의 실수만 남긴다.                      |

### 실행한 검증

| 명령                                 | 결과                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `pnpm -r lint`                       | 4개 패키지 통과                                                                    |
| `pnpm -r format:check`               | 통과                                                                               |
| `pnpm -r test`                       | `packages/ui` 41건, `frontend` 444건, `admin` 12건, `backend` 641건(+16 skip) 통과 |
| `pnpm -r build`                      | 통과 (`admin`은 `vite build && tsc -b`)                                            |
| `pnpm --filter backend typecheck`    | 통과 (테스트 포함)                                                                 |
| `docker compose config`              | `admin` 서비스 해석 확인 (`ADMIN_ENVIRONMENT_LABEL` 기본값 `production`)           |
| `docker build -f admin/Dockerfile .` | 성공. 컨테이너에서 `/` 응답, `/login` SPA fallback, 번들에 환경 배지 값 포함 확인  |
| `pnpm --filter admin dev`            | 5174 포트에서 응답 확인                                                            |

- 1.8은 기존 테스트가 먼저 빨갛게 됐다. 멤버 후보·멤버 추가의 `where` 단정이 정지 계정 필터를 반영하도록 함께 갱신했다.
- 1.10의 라우트 가드·로그인·로그아웃 테스트는 화면 구현과 함께 작성했다. 대신 `AdminAppShell`의 로그아웃 후 이동 호출을 지워 2건이 실패하는 것을 확인하고 원복해, 테스트가 회귀를 실제로 잡는지 검증했다.
- `create-admin-user`는 인자·비밀번호 정책 검증과 중복 이메일 경로까지 확인했다. **DB에 실제로 삽입하는 경로는 검증하지 못했다** — 로컬 `.env`에 어드민 변수가 없어 부팅 검증에서 막히고, 개발 DB에 임의의 자격 증명을 만들지 않았다.

### 남은 후속 작업

- **환경 변수 파일 반영(사용자 작업).** 권한 설정이 `.env*` 쓰기를 막아 반영하지 못했다. `backend/.env.example`과 로컬 `.env`에 `JWT_ADMIN_SECRET`·`JWT_ADMIN_REFRESH_SECRET`·`ADMIN_CORS_ORIGIN`(로컬은 `http://localhost:5174`), 루트 `.env.compose.example`에는 여기에 `ADMIN_VITE_API_BASE_URL`·`ADMIN_ENVIRONMENT_LABEL`까지 추가한다. 세 시크릿은 서로 다른 32자 이상의 값이어야 하며, 로컬 `.env`에 없으면 백엔드가 부팅하지 않는다.
- **첫 어드민 계정 생성(사용자 작업).** `ADMIN_USER_PASSWORD=<비밀번호> pnpm --filter backend create-admin-user <이메일> <이름>`.
- **어드민 429 응답 본문.** `express-rate-limit` 기본 `text/html`이다. 제품 버킷도 같으므로 단계 1에서는 건드리지 않았다. JSON 오류 계약으로 통일할지는 별도로 판단한다.
- **`admin` 컨테이너 포트 바인딩.** 설계대로 `127.0.0.1:8081:80`을 유지했다. 제품 서비스는 작업 트리에서 전체 인터페이스 바인딩으로 바뀌어 있으므로, 어드민도 프록시 앞단에서 노출한다면 함께 정리한다.

## 단계 2 구현 결과 (2026-10-01, `feat/admin-console`)

### 실제 변경

| 커밋                                     | 내용                                                                                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `feat: 어드민 사용자 목록·생성 API 추가` | `GET /admin/users`(정지 여부 필터, 소속 워크스페이스 수 집계), `POST /admin/users`(기본 워크스페이스를 같은 트랜잭션에서 생성)                 |
| `feat: 어드민 사용자 상세·수정 API 추가` | `GET /admin/users/:userId`(소속 워크스페이스·생성 리소스 수), `PATCH /admin/users/:userId`(이름·이메일, 이메일 변경 시 중복 409)               |
| `feat: 어드민 사용자 상태 변경 API 추가` | 비밀번호 재설정·정지·정지 해제·세션 강제 종료 4개 엔드포인트. 상태 변경은 `sessionVersion` 증가로 세션을 끊고 Valkey 키를 정리                 |
| `feat: 어드민 사용자 하드 삭제 API 추가` | `GET /admin/users/:userId/deletion-impact` 집계, `DELETE /admin/users/:userId`(확인 이메일 불일치 400, 하위 리소스는 FK cascade에 위임)        |
| `feat: 어드민 사용자 관리 화면 추가`     | `entities/user`, `features/user`(쿼리·뮤테이션 훅 10개, 모달 5개, TanStack Table 목록), `pages/{users,user-detail}`, 라우트 2개, 사이드바 메뉴 |

백엔드 파일: `src/schemas/admin-user.schema.ts`, `src/services/admin-user.service.ts`, `src/controllers/admin-user.controller.ts`, `src/routes/admin/user.routes.ts`, `src/services/session.service.ts`(`deleteAllRefreshSessions` 추가).
어드민 프런트엔드 추가 구성: `shared/{types/pagination,lib/format-date,lib/api-error}`, `shared/constants/messages/user.ts`, `entities/user`, `features/user`, `pages/users`, `pages/user-detail`, `routes/{users,users_.$userId}`. 디자인 파일은 추가하지 않았고 프리미티브는 모두 `@in2white/ui`에서 가져온다.

### 계획과 달라진 점

| 항목                       | 계획                                           | 실제                                                                                                                                  | 이유                                                                                                                                                                                                          |
| -------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 서비스·컨트롤러 경계   | 언급 없음                                      | 상태 변경 서비스가 트랜잭션 핸들을 첫 인자로 받고, 컨트롤러가 `db.transaction` 안에서 서비스와 `recordAuditLog`를 함께 호출           | 설계 §7의 "대상 변경과 같은 트랜잭션"과 "컨트롤러 계층에서 호출"을 동시에 만족하는 배치는 이것뿐이다. 서비스가 로그를 쓰면 호출 계층 계약이 깨지고, 컨트롤러가 트랜잭션을 열지 않으면 같은 트랜잭션이 아니다. |
| 2.1 Valkey 세션 키 삭제    | 상태 변경과 함께 삭제                          | 커밋 뒤 best-effort(실패 시 `logger.warn`)                                                                                            | 세션 무효화의 실효는 `sessionVersion` 증가가 담당한다. 남은 키만으로는 refresh가 통과하지 않으므로, 키 삭제 실패로 이미 커밋된 변경을 500으로 뒤집지 않는다.                                                  |
| 2.1 `reactivate`           | 정지 시 `sessionVersion` 증가만 명시           | 해제는 `deactivatedAt`만 비움                                                                                                         | 정지 시점에 세션을 이미 끊었다. 해제가 버전을 또 올릴 이유가 없다.                                                                                                                                            |
| 2.1 `deactivate` 멱등성    | 언급 없음                                      | `coalesce(deactivatedAt, now())`                                                                                                      | 이미 정지된 계정에 새 오류 코드(설계 §8에 없는 코드)를 만들지 않으면서 첫 정지 시각을 보존한다.                                                                                                               |
| 2.1 `deletion-impact` 집계 | "cascade 대상 집계"                            | 소유 워크스페이스 id를 먼저 뽑아 멤버십은 `notInArray`로 제외하고, 프로젝트·문서는 `creatorId` OR 소유 워크스페이스의 합집합으로 센다 | 소유 워크스페이스의 멤버십·프로젝트를 두 번 세면 어드민이 실제보다 큰 삭제 범위를 보고 판단한다.                                                                                                              |
| 2.2 TanStack Table         | v8 API(`useReactTable`·`getCoreRowModel`) 가정 | v9 API(`tableFeatures({})`, `createColumnHelper<typeof features, T>()`, `useTable`, `table.FlexRender`)                               | 설치된 버전이 9.2.4다. v9는 기능을 명시적으로 등록하는 구조로 바뀌었다.                                                                                                                                       |
| 2.2 테이블 기능            | 언급 없음                                      | 정렬·필터 기능을 등록하지 않음                                                                                                        | 검색·필터·페이지네이션은 서버가 처리한다. 클라이언트 정렬을 켜면 현재 페이지 안에서만 정렬돼 전체 순서와 다르게 보인다.                                                                                       |
| 2.2 상세 라우트 파일명     | `pages/user-detail`만 언급                     | `routes/users_.$userId.tsx`                                                                                                           | `users.$userId`로 두면 목록 라우트가 부모 레이아웃이 된다. 상세는 목록 안의 중첩 화면이 아니다. URL은 `/users/$userId`로 같다.                                                                                |
| 2.2 쿼리 재시도 정책       | 언급 없음                                      | 공용 `queryClient`에서 4xx 재시도를 끔                                                                                                | 없는 사용자를 두 번 더 조회해도 같은 404가 온다. `useUser`에만 예외를 두면 다음 화면에서 같은 문제가 되살아난다.                                                                                              |
| 2.2 수정 모달 전송 범위    | 언급 없음                                      | 바뀐 항목만 PATCH                                                                                                                     | 전체를 보내면 건드리지 않은 이메일까지 중복 검사를 타고 감사 로그 `metadata`에 변경으로 남는다.                                                                                                               |
| 2.2 하드 삭제 확인         | 프런트엔드 이메일 게이트                       | 프런트엔드 게이트 + 서비스에서 실제 레코드와 재대조                                                                                   | 게이트는 UI에만 있으면 우회된다. 사용자 레코드를 가진 서비스가 최종 판단을 한다.                                                                                                                              |

### 실행한 검증

| 명령                              | 결과                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm -r lint`                    | 4개 패키지 통과                                                                    |
| `pnpm -r format:check`            | 통과                                                                               |
| `pnpm -r test`                    | `packages/ui` 41건, `backend` 753건(+16 skip), `admin` 41건, `frontend` 444건 통과 |
| `pnpm -r build`                   | 통과                                                                               |
| `pnpm --filter backend typecheck` | 통과 (테스트 포함)                                                                 |

- TDD 순서를 밟았고 red를 실제로 확인했다. `deleteAllRefreshSessions`가 없어 27건, `getUserDeletionImpact`·`deleteUser`가 없어 15건이 먼저 실패했다. 어드민 화면은 신규 모듈 import 해석 실패(목록·생성·삭제 모달 테스트 3종)를 먼저 확인했다.
- 비밀번호 재설정 테스트는 감사 로그 `metadata`에 평문이 섞이지 않는지 `JSON.stringify(entry)` 단정으로 고정했고, Valkey 삭제가 실패해도 200과 커밋이 유지되는 경로를 함께 고정했다.
- `UserEditDialog`의 "바꾼 내용 없음" 안내는 페이지 수준 테스트(이름만 바꾸면 바뀐 항목만 전송) 뒤에 단위 테스트를 붙였다. 이 한 건은 테스트가 구현보다 늦었다.
- **화면과 백엔드의 실제 연동은 검증하지 못했다.** 로컬 `.env`에 어드민 변수가 없어 백엔드가 부팅하지 않는다. 어드민 테스트는 모두 API 요청을 모킹한다.

### 남은 후속 작업

- **환경 변수 파일 반영과 첫 어드민 계정 생성(사용자 작업).** 단계 1의 후속 작업 그대로다. 이것이 끝나기 전에는 어드민 화면을 실제 API와 함께 확인할 수 없다.
- **목록 화면의 삭제 후 페이지 보정.** 삭제는 상세 화면에서만 하고 성공 시 목록 1페이지로 이동하므로 지금은 빈 페이지가 생기지 않는다. 단계 3에서 목록 안 삭제가 생기면 제품의 `ProjectListContent`처럼 마지막 항목 삭제 시 이전 페이지로 내리는 보정을 함께 넣는다.
- **오류 문구 공통화.** `shared/lib/api-error.ts`는 백엔드 메시지를 그대로 보여준다. `features/auth/ui/LoginForm`은 자체 매핑을 쓰고 있어, 단계 3에서 화면이 늘면 한쪽으로 모은다.

## 단계 3 구현 결과 (2026-10-01, `feat/admin-console`)

### 실제 변경

| 커밋                                       | 내용                                                                                                                                                                                         |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feat: 어드민 워크스페이스 관리 API 추가`  | `GET /admin/workspaces`(검색, 멤버 수·프로젝트 수 집계), `GET /admin/workspaces/:workspaceId`(소유자·멤버·프로젝트), 이름 변경·소유자 이전·멤버 추가·멤버 제거·하드 삭제 5개 변경 엔드포인트 |
| `feat: 어드민 워크스페이스 관리 화면 추가` | `entities/workspace`, `features/workspace`(쿼리·뮤테이션 훅 8개, 모달 4개, TanStack Table 목록), `pages/{workspaces,workspace-detail}`, 라우트 2개, 사이드바 메뉴                            |

백엔드 파일: `src/schemas/admin-workspace.schema.ts`, `src/services/admin-workspace.service.ts`, `src/controllers/admin-workspace.controller.ts`, `src/routes/admin/workspace.routes.ts`, `src/constants/messages.ts`(오류 문구 3건), `src/schemas/workspace.schema.ts`(`workspaceNameSchema` 추출).
어드민 프런트엔드 추가 구성: `shared/types/workspace-role.ts`, `shared/api/query-keys.ts`, `shared/constants/messages/workspace.ts`, `entities/workspace`, `features/workspace`, `pages/workspaces`, `pages/workspace-detail`, `routes/{workspaces,workspaces_.$workspaceId}`. 단계 2와 같이 디자인 파일은 추가하지 않았고 프리미티브는 모두 `@in2white/ui`에서 가져온다.

### 계획과 달라진 점

| 항목                       | 계획                                 | 실제                                                                                         | 이유                                                                                                                                                                                                  |
| -------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 기본 워크스페이스 보호 | 403                                  | 403을 쓰되 제품 `deleteWorkspace`는 같은 코드로 400을 유지                                   | 어드민은 "권한이 없는 요청"이라 403이 맞고, 제품 오류 계약은 이미 400으로 굳어 있다. 코드는 같고 상태만 라우터별로 다르다. 제품 상태를 바꾸면 기존 프런트엔드 처리가 깨진다.                          |
| 3.1 목록 집계              | 조인으로 멤버 수·프로젝트 수 계산    | 상관 서브쿼리                                                                                | 멤버 조인과 프로젝트 조인을 함께 걸면 행이 곱해져 두 수가 모두 부풀어 오른다. 서브쿼리는 페이지 크기(20)만큼만 돈다.                                                                                  |
| 3.1 상세 멤버·프로젝트     | 언급 없음                            | 둘 다 페이지네이션 없이 전체 반환                                                            | 한 워크스페이스의 멤버·프로젝트는 운영 중 수백 건 규모다. 화면이 탭 하나에 전부 보여주므로 페이지네이션을 넣으면 쓰이지 않는 파라미터만 늘어난다. 규모가 커지면 그때 목록 API와 같은 방식으로 넣는다. |
| 3.1 멤버 추가 대상         | 언급 없음                            | 정지된 사용자도 추가 가능                                                                    | 정지는 로그인을 막는 상태다. 멤버십 정리는 정지와 별개로 진행해야 하고, 정지 해제 후 다시 넣게 만들면 어드민이 두 번 일한다. 화면에서 `정지` 배지로 구분한다.                                         |
| 3.1 소유자 제거            | `DELETE .../members/:userId` 403     | 403 유지, 화면에서는 버튼 자체를 숨김                                                        | 눌러도 실패하는 버튼을 두면 403을 오류로 읽는다. 소유자를 바꾸려면 소유자 이전을 쓰는 게 유일한 경로다.                                                                                               |
| 3.1 하드 삭제 확인         | 사용자 삭제처럼 확인 입력 가정       | 확인 본문 없이 `DELETE`                                                                      | 워크스페이스 이름은 중복될 수 있어 재입력이 신원 확인 수단이 되지 못한다. 확인은 화면 모달이 맡고, 서버는 기본 워크스페이스만 막는다.                                                                 |
| 3.2 삭제된 프로젝트        | 언급 없음                            | 프로젝트 탭에 `삭제됨` 상태로 함께 표시                                                      | 단계 4의 복구 화면이 소프트 삭제 리소스를 다룬다. 워크스페이스 상세에서 안 보이면 어드민이 복구 대상의 존재를 모른다.                                                                                 |
| 3.2 멤버 추가 대상 조회    | 언급 없음                            | `GET /admin/users?search=`(limit 10) 재사용                                                  | 어드민용 사용자 검색이 이미 있다. 워크스페이스 전용 후보 엔드포인트를 더하면 같은 쿼리가 두 벌이 된다. `features/workspace`의 훅이 `entities/user`를 직접 쓰므로 FSD 계층도 깨지지 않는다.            |
| 3.2 `WorkspaceRole`        | 언급 없음                            | `entities/user`에 있던 타입을 `shared/types/workspace-role.ts`로 옮김                        | 사용자 응답과 워크스페이스 응답이 같은 값을 쓴다. `entities/workspace`가 `entities/user`를 import하면 동일 계층 의존이 생긴다.                                                                        |
| 3.2 쿼리 키                | 언급 없음                            | `shared/api/query-keys.ts`로 모으고 `features/user/model/use-users.ts`를 리팩터링            | 멤버를 넣고 빼면 사용자 목록의 워크스페이스 수가 바뀐다. 키가 기능마다 흩어져 있으면 리터럴을 베껴 쓰다 한쪽만 무효화한다.                                                                            |
| 3.2 삭제 후 캐시 무효화    | 언급 없음                            | 삭제만 상세 키를 무효화하지 않음                                                             | 사라진 워크스페이스를 다시 불러 404 화면을 잠깐 띄울 뿐이다. 성공 시 목록으로 이동한다.                                                                                                               |
| 3.2 확인 모달              | 언급 없음                            | `WorkspaceConfirmDialog`를 `UserConfirmDialog`와 별도로 둠                                   | 공통화하려면 `admin/src/shared/ui/`를 새로 열어야 한다. 디자인 파일을 추가하지 않는다는 결정과 충돌하고, 지금 공유 대상은 두 곳뿐이다. 세 번째가 생기면 `@in2white/ui`로 올린다.                      |
| 3.2 타입 검사 명령         | `pnpm --filter admin typecheck` 가정 | `admin`에는 `typecheck` 스크립트가 없어 `build`(`vite build && tsc -b`)가 타입 검사까지 수행 | 단계 1에서 만든 구성 그대로다. 스크립트를 더하면 CI에서 같은 `tsc -b`를 두 번 돌린다.                                                                                                                 |

### 실행한 검증

| 명령                              | 결과                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm -r lint`                    | 4개 패키지 통과                                                                    |
| `pnpm -r format:check`            | 통과                                                                               |
| `pnpm -r test`                    | `packages/ui` 41건, `backend` 825건(+16 skip), `admin` 71건, `frontend` 444건 통과 |
| `pnpm -r build`                   | 통과                                                                               |
| `pnpm --filter backend typecheck` | 통과 (테스트 포함)                                                                 |

- TDD 순서를 밟았고 red를 실제로 확인했다. 백엔드는 `admin-workspace.schema`·`admin-workspace.service`가 없어 테스트 파일 2개가 import 해석 단계에서 먼저 실패했고(`Tests no tests`), 어드민 화면은 신규 모듈 6개의 import 해석 실패를 먼저 확인했다.
- 감사 로그는 변경 엔드포인트 5개 모두에서 같은 트랜잭션 안에 1건씩 기록되는지 테스트로 고정했다. 멤버 제거·워크스페이스 삭제는 행이 사라져 `targetId`로 아무것도 조회되지 않으므로 `metadata.before`에 식별 정보를 남기는 것까지 단정했다.
- **화면과 백엔드의 실제 연동은 여전히 검증하지 못했다.** 로컬 `.env`에 어드민 변수가 없어 백엔드가 부팅하지 않는다. 어드민 테스트는 모두 API 요청을 모킹한다.

### 남은 후속 작업

- **환경 변수 파일 반영과 첫 어드민 계정 생성(사용자 작업).** 단계 1·2의 후속 작업 그대로다. 단계 3까지 쌓인 화면을 실제 API와 함께 확인하려면 이것이 먼저다.
- **목록 화면의 삭제 후 페이지 보정.** 단계 3도 삭제를 상세 화면에서만 하고 성공 시 목록 1페이지로 이동한다. 단계 4에서 목록 안 삭제·복구가 생기면 제품의 `ProjectListContent`처럼 보정을 넣는다.
- **오류 문구 공통화.** 단계 2의 후속 작업 그대로다. 단계 4에서 화면이 또 늘어나므로 그때 `shared/lib/api-error.ts` 한쪽으로 모은다.
- **상세 탭의 대량 데이터.** 멤버·프로젝트 목록이 커지면 상세 응답이 통째로 커진다. 단계 4에서 프로젝트 목록 API가 생기면 워크스페이스 상세의 프로젝트 탭을 그 API의 필터 조회로 바꾸는 것을 검토한다.

## 단계 4 구현 결과 (2026-10-01, `feat/admin-console`)

### 실제 변경

| 커밋                                                   | 내용                                                                                                                                                                                                                              |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feat: 어드민 프로젝트·화이트보드 문서 관리 API 추가`  | `GET /admin/projects`(검색·워크스페이스·삭제 상태 필터, 문서 수 집계), `GET /admin/projects/:projectId`(프로젝트 + 하위 문서), 프로젝트·문서 각각의 `DELETE`(소프트 삭제)와 `POST .../restore`, `GET /admin/whiteboard-documents` |
| `refactor: 확인 모달을 공용 ConfirmDialog로 올린다`    | `UserConfirmDialog`·`WorkspaceConfirmDialog`를 `@in2white/ui/confirm-dialog` 하나로 합침                                                                                                                                          |
| `feat: 어드민 프로젝트·화이트보드 문서 관리 화면 추가` | `entities/{project,whiteboard-document}`, `features/{project,whiteboard-document}`, `pages/{projects,project-detail,whiteboard-documents}`, 라우트 3개, 사이드바 메뉴 2개                                                         |

백엔드 파일: `src/schemas/admin-project.schema.ts`, `src/schemas/admin-whiteboard-document.schema.ts`, `src/schemas/admin-resource.schema.ts`(삭제 상태 필터 공용), `src/services/admin-project.service.ts`, `src/services/admin-whiteboard-document.service.ts`, 컨트롤러·라우터 각 2개, `src/utils/resource-status.ts`, `src/constants/messages.ts`(오류 문구 2건).
어드민 프런트엔드 추가 구성: `shared/types/resource-status.ts`, `shared/lib/clamp-page.ts`, `shared/constants/messages/{project,whiteboard-document}.ts`, `shared/api/query-keys.ts`(`projects`·`projectDetails`·`project(id)`·`whiteboardDocuments`), `routes/{projects,projects_.$projectId,whiteboard-documents}`.

### 계획과 달라진 점

| 항목                  | 계획                                                           | 실제                                                                                                                                  | 이유                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4.1 삭제 상태 필터    | 언급 없음                                                      | 프로젝트·문서 목록이 같은 `status`(`all`\|`active`\|`deleted`, 기본 `all`) 쿼리를 공유하고 스키마를 `admin-resource.schema.ts`로 분리 | 두 목록의 목적이 같다 — 복구 대상 찾기다. 기본값이 `active`면 어드민이 필터를 바꾸기 전까지 복구 대상이 아예 보이지 않는다.                                  |
| 4.1 상세 조회         | 언급 없음                                                      | `getProjectDetail`은 삭제 여부로 걸러내지 않고 하위 문서도 삭제된 것까지 반환                                                         | 삭제된 프로젝트의 상세를 열 수 없으면 복구 화면이 성립하지 않는다.                                                                                           |
| 4.1 문서 복구 조건    | 언급 없음                                                      | 프로젝트가 삭제된 상태에서도 문서 복구를 허용하고 응답에 `project.deletedAt`을 담음                                                   | 막으면 어드민이 복구 순서를 추측해야 한다. 한계는 화면에서 배지와 모달 문구로 알린다.                                                                        |
| 4.1 문서 본문         | 언급 없음                                                      | `whiteboard_document_contents`를 읽지 않음                                                                                            | 어드민은 문서를 열어보지 않는다. 본문은 사용자의 것이고, 조회 경로를 만들면 감사 로그 없는 열람 경로가 생긴다.                                               |
| 4.1 문서 상세         | 언급 없음                                                      | `GET /admin/whiteboard-documents/:id` 없음                                                                                            | 문서 단건에 더 보여줄 정보가 없다. 목록과 프로젝트 상세에서 삭제·복구가 모두 가능하다.                                                                       |
| 4.1 생성·수정         | 언급 없음                                                      | 프로젝트·문서 모두 어드민 `POST`/`PATCH` 없음                                                                                         | 내용은 사용자의 것이다. 어드민의 일은 감추기와 되살리기뿐이다.                                                                                               |
| 4.2 확인 모달         | 단계 3에서 "세 번째가 생기면 `@in2white/ui`로 올린다"로 미뤄둠 | `@in2white/ui/confirm-dialog`로 올리고 기본 variant를 `primary`, 파괴적 작업만 `destructive`로 둠                                     | 단계 4에서 삭제·복구 4종이 늘어 사용처가 여섯 곳이 됐다. 복구는 되돌릴 수 있으니 같은 빨간 버튼을 쓰면 위험도 구분이 사라진다.                               |
| 4.2 목록 페이지 보정  | 단계 2·3에서 미뤄둔 후속 작업                                  | `shared/lib/clamp-page.ts`(순수 함수)로 응답을 받을 때마다 현재 페이지를 유효 범위로 끌어내림                                         | 훅으로 만들면 `totalPages`를 아는 시점이 그 `page`를 쓰는 쿼리 뒤라서 순서가 꼬인다. placeholder 응답에서는 보정하지 않아 페이지 전환 중 되돌아가지 않는다.  |
| 4.2 상세 삭제 후 이동 | 워크스페이스처럼 목록 이동 가정                                | 프로젝트 상세는 삭제 후에도 그 화면에 머물고 복구 버튼으로 바뀜                                                                       | 소프트 삭제라 바로 되돌릴 수 있다. 목록으로 보내면 방금 지운 것을 다시 찾아야 한다.                                                                          |
| 4.2 행 단위 작업      | 언급 없음                                                      | 한 행에 삭제·복구 중 하나만 노출                                                                                                      | 둘 다 두면 상태에 따라 반드시 실패하는 버튼이 생긴다. 단계 3의 소유자 제거와 같은 판단이다.                                                                  |
| 4.2 뮤테이션 인자     | 언급 없음                                                      | 요청 함수를 `mutationFn`에 그대로 넘기지 않고 `(id) => request(id)`로 감쌈                                                            | TanStack Query가 `mutationFn`에 두 번째 인자로 컨텍스트를 넘긴다. 그대로 넘기면 요청 함수의 선택 인자 자리에 들어간다(테스트가 2개 인자 호출로 실패해 발견). |

### 실행한 검증

| 명령                              | 결과                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm -r lint`                    | 4개 패키지 통과                                                                    |
| `pnpm -r format:check`            | 통과                                                                               |
| `pnpm -r test`                    | `packages/ui` 46건, `backend` 892건(+16 skip), `admin` 95건, `frontend` 444건 통과 |
| `pnpm -r build`                   | 통과 (`admin`은 `vite build && tsc -b`가 타입 검사까지 수행)                       |
| `pnpm --filter backend typecheck` | 통과 (테스트 포함)                                                                 |

- TDD 순서를 밟았고 red를 실제로 확인했다. 백엔드는 스키마·서비스가 없어 테스트 파일 2개가 import 해석에서 먼저 실패했고(`Tests no tests`), 어드민은 페이지 3개의 import 해석 실패를 먼저 확인했다.
- 감사 로그는 변경 엔드포인트 4개(프로젝트·문서의 삭제·복구) 모두에서 같은 트랜잭션 안에 1건씩 기록되는지 테스트로 고정했다. 조회 엔드포인트는 기록하지 않는 것도 단정했다.
- 프로젝트 복구가 개별 삭제되지 않았던 문서만 다시 보이게 하고 개별 삭제된 문서는 삭제 상태로 남기는지, 이미 삭제된 리소스의 `DELETE`가 404, 삭제되지 않은 리소스의 복구가 400 `RESOURCE_NOT_DELETED`인지를 테스트로 고정했다.
- **화면과 백엔드의 실제 연동은 여전히 검증하지 못했다.** 로컬 `.env`에 어드민 변수가 없어 백엔드가 부팅하지 않는다.

### 남은 후속 작업

- **환경 변수 파일 반영과 첫 어드민 계정 생성(사용자 작업).** 단계 1~3의 후속 작업 그대로다. 단계 5의 대시보드·운영 상태는 실제 데이터를 봐야 값이 맞는지 확인할 수 있으므로 이것이 먼저다.
- **오류 문구 공통화.** 단계 2·3의 후속 작업 그대로 남았다. 단계 5에서 화면이 마지막으로 늘어나므로 그때 `shared/lib/api-error.ts` 한쪽으로 모은다.
- **워크스페이스 상세의 프로젝트 탭.** 이제 프로젝트 목록 API에 `workspaceId` 필터가 있다. 상세 응답에서 프로젝트 배열을 떼고 그 API로 바꾸면 탭에서도 삭제·복구를 쓸 수 있고 프로젝트 이름을 `/projects/$projectId`로 연결할 수 있다.
- **어드민 429 응답 본문.** 단계 1의 후속 작업 그대로다. `express-rate-limit` 기본 `text/html`이라 화면이 JSON 오류로 읽지 못한다.

## 프리미티브 추가 절차

`components.json`은 `packages/ui/`에 있다. 프리미티브가 거기 있으므로 CLI도 거기서 돈다.

```bash
pnpm --filter @in2white/ui exec shadcn search @shadcn -q <검색어>
pnpm --filter @in2white/ui exec shadcn docs <이름>
pnpm --filter @in2white/ui exec shadcn add <이름> --dry-run
pnpm --filter @in2white/ui exec shadcn add <이름>
```

`--dry-run`을 먼저 돌린다. 레지스트리 항목이 다른 프리미티브에 의존하면 CLI가 우리가 손본 파일을 덮어쓰려 한다. 예를 들어 `alert-dialog`는 `button.tsx` 덮어쓰기를 함께 제안한다.

내려온 파일은 두 곳을 고친다.

1. `import { cn } from 'cn'` → `import { cn } from '../lib/utils'`. 레지스트리는 npm `cn`을 쓰지만 이 저장소의 `cn`만 타이포 토큰을 알고 있다. eslint가 막는다.
2. `'use client'` 지시문 제거. Vite SPA에는 의미가 없다.

그다음 `pnpm --filter @in2white/ui lint`·`format`·`test`를 돌린다. 프리미티브가 공개 API이므로 스토리와 테스트를 함께 추가한다.

별칭 해석은 `packages/ui/package.json`의 `imports`에 있는 `#ui/*`가 담당한다. shadcn 4.21이 `imports` → 워크스페이스 패키지 `exports` → tsconfig `paths` 순으로 별칭을 푸는데, 우리 `exports`의 루트 와일드카드(`"./*"`)는 CLI가 별칭 키로 환원하지 못한다. `imports`는 패키지 외부에 노출되지 않으므로 공개 경로가 늘지 않는다. 코드에서 `#ui/*`를 쓰는 것은 eslint가 막는다. 패키지 내부는 상대 경로만 쓴다.
