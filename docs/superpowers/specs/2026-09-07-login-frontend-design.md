# 로그인 및 인증 세션 기능 (프론트엔드) 설계

- 관련 문서: [`PRODUCT.md`](../../../PRODUCT.md) §7 "로그인", §9 "로그인 페이지", [`DESIGN.md`](../../../DESIGN.md) §7.1 "Auth Shell", §8.1/§8.2 "Button/Input", [`tokens.json`](../../../tokens.json), [`2026-09-06-login-feature-design.md`](./2026-09-06-login-feature-design.md)(백엔드 로그인 설계)
- Figma: `Login (Alt)` 프레임 (node `96:5`), 파일 `Dimhltnal74SHy2NcLz1Lf`

## 1. 목표

Figma `Login (Alt)` 디자인을 기준으로 이메일/비밀번호 로그인 페이지를 구현하고, 백엔드 `POST /auth/login`과 연동한다. 로그인 이후에는 백엔드의 refresh token 계약에 맞춰 access token을 자동 갱신하고, 인증이 끊긴 사용자를 `/login`으로 유도하는 앱 전역 인증 상태 관리까지 함께 확립한다. 이 기능이 프론트엔드 최초의 feature 슬라이스이자 최초의 상태 관리(zustand) 도입이므로, 이후 화면들이 따라갈 기본 패턴(디자인 토큰 배선, API 연동 방식, 폼 처리 방식)도 함께 확립한다.

### Non-Goals

- 워크스페이스/프로젝트 목록 등 로그인 이후 페이지 — 아직 존재하지 않으므로 로그인 성공 시 임시로 `/`(기존 HomePage)로 이동한다. 워크스페이스 기능이 구현되면 리다이렉트 대상을 교체한다.
- 회원가입 UI — `PRODUCT.md`에 따라 회원가입 기능 자체가 없다.
- accessToken을 localStorage/sessionStorage에 영속화하는 기능 — 새로고침 시에는 httpOnly refresh token 쿠키로 `/auth/refresh`를 호출해 메모리 세션을 복원하고, 브라우저 저장소에는 accessToken을 기록하지 않는다.
- 로그인 실패 반복에 대한 프론트 측 rate limit/lockout UI — 백엔드가 별도 제한을 두지 않으므로(백엔드 설계서 §1 Non-Goals) 프론트도 두지 않는다.

## 2. 화면 구조 (DESIGN.md §7.1, §7.2 Auth Shell)

```text
LoginPage
└── center-block (max-width 336px, 중앙 정렬)
    ├── identity-block
    │   ├── logo-row (마크 28x28 + "in2white" 타이틀)
    │   └── tagline ("팀의 화이트보드를 함께 그려요.")
    ├── divider (1px hairline)
    ├── LoginForm
    │   ├── field-email (Label + Input)
    │   ├── field-password (Label + Input, type=password)
    │   ├── (제출 실패 시) 폼 레벨 에러 메시지
    │   └── Submit Button (Primary, Large, "로그인")
    └── footer-caption ("계정은 관리자가 미리 만들어 드려요." / "로그인이 안 되면 워크스페이스 소유자에게 문의해 주세요.")
```

Top Navigation, Breadcrumb, 계정 메뉴 등 인증 후 전용 요소는 두지 않는다(DESIGN.md §7.1). 회원가입 전환 UI도 없다.

## 3. 디자인 토큰 배선

`tokens.json`은 존재하지만 `app/styles/index.css`는 아직 shadcn 기본값(회색조)을 쓰고 있어 실제로 연결되어 있지 않다. 이번 작업에서 다음을 반영한다.

- `tokens.json`의 `color.light.*`를 Figma 참조 코드가 그대로 사용하는 변수명(`--color-background-default`, `--color-foreground-secondary`, `--color-border-default`, `--color-action-primary`, `--color-action-primary-foreground`, `--color-status-danger` 등)으로 `:root`에 정의한다.
- 기존 shadcn 별칭(`--background`, `--foreground`, `--primary`, `--primary-foreground`, `--border`, `--input`, `--ring`, `--radius`)을 같은 토큰 값으로 재매핑해, `shared/ui/button.tsx`가 수정 없이 올바른 색(검정 계열 `action.primary`)을 사용하게 한다.
- `--radius`(shadcn) 기준값을 `tokens.json.radius.md`(8px)에 맞춰 조정하고, `radius-lg`(Large 컨트롤용, 12px)는 별도 CSS 변수(`--radius-lg-token: 12px`)로 추가한다.
- `component.controlHeight.default/large`(36/44), `spacing.*`는 필요한 곳에서 Tailwind 임의값(`h-[var(--control-height-large)]` 등)으로 직접 참조한다.
- Dark 모드 토큰(`color.dark.*`)은 이번 스코프에서 `.dark` 클래스에 함께 반영해 손이 두 번 가지 않게 하되, 다크 모드 진입 UI(토글)는 만들지 않는다 — 값만 준비해 둔다.

이 배선은 로그인 페이지 전용이 아니라 이후 모든 화면이 공유하는 기반이 된다.

## 4. 컴포넌트

### 4.0 `shared/ui/button.tsx` (수정, 계획 단계에서 발견)

현재 `lg` 사이즈 variant가 36px(`h-9`)로 정의되어 있어 DESIGN.md §8.1이 요구하는 Large(Auth Shell 전용, 44px)와 맞지 않는다. `lg`는 코드베이스 어디에서도 아직 쓰이지 않는 미사용 variant이므로, 44px/12px radius(기존 base 클래스가 이미 제공)/24px 패딩/semibold로 고쳐서 로그인 제출 버튼에 사용한다. 다른 화면에 영향 없음(사용처가 없었으므로).

### 4.1 `shared/ui/input.tsx` (신규)

Figma `Input` 컴포넌트(node `32:22`) 사양을 그대로 따른다 — State(Default/Focus/Disabled/Error) × Size(Default/Large).

- `cva` 기반, 기존 `button.tsx`와 동일한 패턴(`class-variance-authority` + `cn`)을 사용한다.
- Focus는 네이티브 `:focus` 의사 클래스로 처리하고(별도 `state="Focus"` prop 불필요), Error/Disabled는 각각 `aria-invalid` prop과 네이티브 `disabled` attribute로 표현한다 — Figma의 `state` prop을 그대로 옮기면 controlled state를 이중 관리해야 하므로, HTML 네이티브 상태에 대응시켜 단순화한다.
- Size는 `size="default" | "large"` prop으로 노출한다(기본값 `default`). 로그인 폼은 `large`만 사용한다.
- `<Label>`은 별도 컴포넌트로 만들지 않고 `<label>` + Tailwind 클래스를 폼에서 직접 사용한다(DESIGN.md §8.2 — Label을 Placeholder로 대체하지 않는다는 규칙만 지키면 되고, 재사용 빈도가 아직 낮다).

### 4.2 `entities/session` (신규)

- `model/session-store.ts` — zustand store. State: `{ accessToken: string | null, user: { id, name, email } | null }`. Actions: `setSession(accessToken, user)`, `updateAccessToken(accessToken)`, `clearSession()`.
- accessToken은 메모리에만 보관한다(백엔드 설계서 §2와 동일한 정책 — localStorage 등 영속 저장소에 두지 않아 XSS 시 탈취 범위를 최소화).
- JWT payload의 `exp`를 검사하는 `isAccessTokenExpired(accessToken)`를 제공한다. payload가 없거나 malformed이거나 `exp`가 현재 시각 이하이면 만료/무효 토큰으로 판정한다.
- `index.ts`로 `useSessionStore` export.

### 4.3 `features/auth` (신규)

- `api/login.ts` — `loginRequest(email, password)`: `axiosInstance.post('/auth/login', { email, password })`, 응답 타입 `{ accessToken: string, user: { id: string, name: string, email: string } }`.
- `api/session.ts` — `refreshAccessTokenRequest()`: 쿠키를 사용해 `POST /auth/refresh`를 호출하고 `{ accessToken, user }`를 반환한다. `logoutRequest()`: `POST /auth/logout`을 호출한다.
- `model/auth-session.ts` — 동시 요청이 발생해도 `/auth/refresh`를 한 번만 실행하는 single-flight refresh coordinator. 성공하면 store에 accessToken/user를 저장해 앱 부팅 후에도 메모리 세션을 복원한다. 실패한 refresh는 자동 재시도하지 않는다.
- `model/auth-interceptor.ts` — 공통 Axios 요청/응답 인터셉터. 보호 요청 전 만료 토큰을 refresh하고, 보호 API의 401은 refresh 후 원래 요청을 한 번만 재시도한다. refresh 실패 또는 재시도 후 401이면 세션을 비우고 앱이 제공한 `/login` 이동 콜백을 호출한다. `/auth/login`과 `/auth/refresh`의 401은 이 흐름에서 제외한다.
- `model/use-login.ts` — `useLogin()`: `@tanstack/react-query`의 `useMutation`으로 `loginRequest`를 감싸고, 성공 시 `useSessionStore.getState().setSession(...)` 호출.
- `ui/LoginForm.tsx` — react-hook-form + zod(`@hookform/resolvers/zod`)로 클라이언트 검증(이메일 형식, 필수 입력, 문구는 `shared/constants/messages.ts` 참조). 제출 시 `useLogin().mutate`, 서버 응답의 `error.message`(없으면 `NETWORK_ERROR` fallback)를 폼 레벨 에러로 노출(§5), `isPending`을 Button의 로딩 상태에 연결.

### 4.4 `pages/login` (신규)

- `ui/LoginPage.tsx` — 로고(§6)/타이틀/태그라인 + divider + `LoginForm` + footer-caption을 조합한다. 로직을 갖지 않는 순수 조합 컴포넌트로, 기존 `HomePage.tsx`와 동일한 얇은 패턴을 따른다.
- `index.ts`로 `LoginPage` export.

### 4.5 라우트 인증 가드

- `features/auth/model/route-guards.ts`에서 앱 전역 세션 가드를 제공한다.
- `routes/__root.tsx`의 전역 `beforeLoad`는 모든 경로에서 세션을 확인한다. 메모리 세션이 없으면 refresh를 시도하고, `/login`은 유효한 세션이 있거나 refresh 성공 시 `/`로 redirect한다. refresh 실패 시에만 `/login`을 허용한다.
- 보호 경로 진입 시 accessToken이 만료되어 있으면 refresh를 먼저 시도한다. refresh 실패 시 세션을 비우고 `/login`으로 redirect한다.
- `createFileRoute('/login')`에는 별도 인증 가드를 두지 않고, 부모인 `__root.tsx`의 전역 가드가 유효한 세션을 `/`로 redirect한다. 만료 또는 메모리 세션 부재 상태는 refresh 성공 시 `/`로 이동하고, refresh 실패 시 세션을 비운 뒤 로그인 페이지 진입을 허용한다.
- accessToken/user는 메모리에만 보관하며, 라우트 전역 가드가 메모리 세션이 없을 때 refresh cookie로 세션 복원을 시도한다.

### 4.6 앱 인증 초기화 및 로그아웃

- `app/App.tsx`에서 Axios 인증 인터셉터를 한 번 설정하고, 세션 만료 콜백을 TanStack Router의 `/login` 이동에 연결한다.
- `pages/home/ui/HomePage.tsx`의 로그아웃은 `POST /auth/logout`을 호출한다. API 성공 여부와 관계없이 client session을 비우고 `/login`으로 이동한다.
- 세션이 없는 `HomePage`는 로그인 안내를 자체 렌더링하지 않는다. 라우트 가드가 로그인 페이지 이동을 책임진다.

## 5. 에러 처리 및 상태

**원칙**: API 요청이 아예 나가지 않는 경우(클라이언트 검증 실패)는 프론트가 자체 문구를 쓰고, API 요청이 나간 뒤 발생하는 에러(401/400/네트워크 등)는 서버가 응답 body에 담아 보낸 메시지를 그대로 노출해 백엔드와 문구가 항상 일치하게 한다. 단, 서버가 아예 응답하지 못하는 경우(네트워크 단절, CORS 등)는 서버 메시지 자체가 없으므로 프론트가 자체 fallback 문구를 쓴다.

**서버 에러 응답 형태**: 백엔드 에러 핸들러(`backend/src/middlewares/error-handler.middleware.ts`)는 모든 에러를 `{ error: { message, code } }` 형태로 응답한다(최상위 `message`가 아니다). 즉 서버가 보낸 문구는 `error.response.data.error.message` 경로로 읽어야 한다. 성공 응답(`{ accessToken, user }`)에는 이 envelope가 없다 — 에러 응답에만 적용된다.

두 경우 모두 문구를 컴포넌트 안에 하드코딩하지 않고 `frontend/src/shared/constants/messages.ts`(신규)에 모아 관리한다 — 백엔드 `backend/src/constants/messages.ts`와 동일한 패턴(대문자 스네이크 케이스 키의 `as const` 객체)이다. 이 파일에는 **프론트가 실제로 소유하는 문구만** 넣는다: 클라이언트 검증 문구(백엔드 `EMAIL_REQUIRED`/`EMAIL_INVALID_FORMAT`/`PASSWORD_REQUIRED`와 동일한 한국어 텍스트를 프론트 zod 스키마용으로 동일하게 유지)와, 서버 응답 자체를 받지 못했을 때의 fallback 문구(`NETWORK_ERROR`) 두 종류다. 401/400처럼 서버가 실제로 보낸 메시지는 이 파일에 넣지 않고 응답의 `error.message` 필드를 그대로 사용한다.

| 상황                                             | 트리거                                                             | 문구 출처                                                              | 표현                                                                                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 클라이언트 검증 실패(이메일 형식/필수 입력 누락) | react-hook-form + zod, API 요청 전에 차단                          | 프론트 `shared/constants/messages.ts` (백엔드 문구와 동일 텍스트 유지) | 해당 Input에 `aria-invalid`(Error variant) + 필드 아래 인라인 메시지                                                                                                             |
| 401 `INVALID_CREDENTIALS`                        | 서버 응답                                                          | 서버 응답의 `error.message` 그대로                                     | 폼 레벨 에러 메시지 (이메일/비밀번호 중 무엇이 틀렸는지 구분 안 함 — 백엔드 정책과 일관)                                                                                         |
| 400 `VALIDATION_ERROR`                           | 서버 응답(클라이언트 검증을 벗어나 도달한 경우에 대한 방어적 처리) | 서버 응답의 `error.message` 그대로                                     | 폼 레벨 에러 메시지                                                                                                                                                              |
| 네트워크 오류(응답 자체를 못 받음)               | axios 에러(`error.response`가 없음)                                | 프론트 `shared/constants/messages.ts`의 `NETWORK_ERROR`                | 폼 레벨 에러 메시지                                                                                                                                                              |
| 5xx                                              | 서버 응답(응답은 왔음)                                             | 서버 응답의 `error.message` 그대로                                     | 폼 레벨 에러 메시지                                                                                                                                                              |
| 제출 중                                          | `useLogin().isPending`                                             | —                                                                      | Submit Button에 스피너(Lucide `Loader2`, `animate-spin`) + `disabled`, 라벨은 "로그인 중..."으로 교체(아이콘만 남기면 버튼의 접근 가능한 이름이 사라지므로 텍스트를 반드시 유지) |

폼 레벨 에러 메시지는 DESIGN.md §8.2 규칙(Label을 대체하지 않음)과는 무관하게 필드 그룹 전체 아래 한 곳에 표시한다 — 401은 특정 필드 문제가 아니라 자격 증명 조합의 문제이기 때문이다.

### 5.1 인증 세션 상태 전이

| 상황                                | 처리                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| 보호 요청 전 accessToken 만료       | single-flight `/auth/refresh` 실행 후 새 accessToken으로 요청 전송             |
| 보호 API가 401 응답                 | refresh 성공 후 기존 요청을 새 token으로 정확히 한 번 재시도                   |
| `/auth/refresh` 실패                | refresh 요청을 다시 시도하지 않고 세션 삭제 후 `/login` 이동                   |
| refresh 후 재시도한 보호 요청도 401 | 세션 삭제 후 `/login` 이동                                                     |
| `/auth/login` 401                   | 전역 만료 처리에서 제외하고 로그인 폼의 자격 증명 오류로 표시                  |
| 로그아웃 API 성공/실패              | refresh 세션 폐기 요청 후 결과와 관계없이 client session 삭제 및 `/login` 이동 |

## 6. 에셋

Figma 마크 이미지(28×28, node `96:9`/`96:10`)를 다운로드해 `frontend/public/logo-mark.png`로 커밋한다. 기존 `public/favicon.svg`(마스코트 일러스트)와는 다른 이미지이므로 재사용하지 않는다.

## 7. API 연동 변경

- `shared/api/axios-instance.ts`에 `withCredentials: true`를 추가한다 — refreshToken httpOnly 쿠키를 브라우저가 주고받으려면 필수다(백엔드 설계서 §3, CORS `credentials: true`와 대응).
- `features/auth/model/auth-interceptor.ts`를 앱 시작 시 설정해 현재 accessToken을 보호 요청에 적용하고, 만료/401 refresh 흐름을 공통 처리한다.
- `/auth/refresh`는 요청 body 없이 `withCredentials` 쿠키만 사용하며, 성공 시 로그인과 동일한 `{ accessToken, user: { id, name, email } }`를 반환한다. refresh 실패는 자동 재시도하지 않는다.
- `/auth/logout`은 현재 accessToken을 Authorization 헤더로 보내고, 백엔드가 현재 기기의 refresh 세션을 폐기하도록 한다.
- `.env` 관련: 프론트 `VITE_API_BASE_URL`이 백엔드 `CORS_ORIGIN`(기본 `http://localhost:5173`)과 짝이 맞는지 로컬 개발 시 확인이 필요하다(코드 변경 아님, 개발 환경 확인 사항).

## 8. 파일 구성

```
frontend/src/app/styles/index.css                    (수정) tokens.json 기반 CSS 변수 배선(§3)
frontend/src/shared/api/axios-instance.ts             (수정) withCredentials: true 추가
frontend/src/shared/constants/messages.ts             (신규) 클라이언트 검증 문구 + NETWORK_ERROR fallback(§5)
frontend/src/shared/ui/button.tsx                     (수정) lg 사이즈를 Large(44px) 스펙으로 수정(§4.0)
frontend/src/shared/ui/input.tsx                      (신규) Input 컴포넌트(§4.1)
frontend/src/entities/session/model/session-store.ts  (신규) zustand 세션 store(§4.2)
frontend/src/entities/session/index.ts                (신규)
frontend/src/features/auth/api/login.ts               (신규) loginRequest(§4.3)
frontend/src/features/auth/api/session.ts             (신규) refreshAccessTokenRequest/logoutRequest(§4.3, §4.6)
frontend/src/features/auth/model/auth-session.ts       (신규) single-flight refresh coordinator(§4.3)
frontend/src/features/auth/model/auth-interceptor.ts   (신규) Axios 인증·401 처리(§4.3, §7)
frontend/src/features/auth/model/route-guards.ts      (신규) 전역 세션 복원/인증 가드(§4.5)
frontend/src/features/auth/model/use-login.ts         (신규) useLogin 훅(§4.3)
frontend/src/features/auth/ui/LoginForm.tsx           (신규) 폼 UI/검증/에러 처리(§4.3, §5)
frontend/src/features/auth/index.ts                   (신규)
frontend/src/pages/login/ui/LoginPage.tsx             (신규) 페이지 조합(§4.4)
frontend/src/pages/login/ui/LoginPage.test.tsx         (신규) 렌더링/제출 플로우 테스트
frontend/src/pages/login/index.ts                     (신규)
frontend/src/routes/login.tsx                         (신규) /login 로그인 페이지 라우트(전역 가드 위임, §4.5)
frontend/src/routes/__root.tsx                         (수정) 세션 복원 및 전역 인증 가드(§4.5)
frontend/src/routes/index.tsx                          (수정) 보호 라우트 가드 연결(§4.5)
frontend/src/app/App.tsx                               (수정) Axios 인증 인터셉터 초기화(§4.6)
frontend/src/pages/home/ui/HomePage.tsx                (수정) 로그아웃 API·세션 정리·/login 이동(§4.6)
frontend/public/logo-mark.png                          (신규) Figma 마크 에셋(§6)
```

## 9. 테스트 전략

기존 컨벤션(vitest + `@testing-library/react`, `HomePage.test.tsx` 패턴)을 따른다. `axiosInstance`는 `vi.mock`으로 모킹한다.

- `LoginForm.test.tsx`(또는 `LoginPage.test.tsx`에 통합):
  - 이메일/비밀번호 필드와 "로그인" 버튼이 렌더링된다.
  - 빈 값으로 제출 시 클라이언트 검증 에러가 표시되고 API가 호출되지 않는다.
  - 잘못된 이메일 형식 입력 시 검증 에러가 표시된다.
  - 유효한 값 제출 시 `loginRequest`가 올바른 payload로 호출된다.
  - API가 200을 응답하면 세션 store에 accessToken/user가 저장되고 `/`로 네비게이션된다.
  - API가 401을 응답하면 폼 레벨 에러 메시지가 표시되고 세션 store는 변경되지 않는다.
  - 제출 중에는 버튼이 `disabled` 상태다.
- 라우트 가드: 세션 store에 accessToken이 있는 상태로 `/login`에 진입하면 `/`로 리다이렉트된다(TanStack Router 테스트 유틸 또는 `beforeLoad` 함수 단위 테스트로 검증).
- 세션 store: 만료/유효/malformed token 판별과 refresh 응답의 accessToken/user 저장 동작을 검증한다.
- 인증 API: `/auth/refresh`와 `/auth/logout` 호출 계약을 검증한다.
- 인증 세션: refresh 성공, refresh 실패, 동시 refresh single-flight를 검증한다.
- Axios 인터셉터: 요청 전 만료 토큰 refresh, 보호 API 401 후 1회 재시도, refresh 실패, 재시도 후 401, 로그인 401 제외를 검증한다.
- 전역 라우트 가드: 새로고침 후 메모리 세션 복원, 보호 경로의 refresh 성공/실패, 로그인 상태의 `/login` 접근 차단을 검증한다.
- 로그아웃: API 성공·실패 모두 세션 정리 및 `/login` 이동을 검증한다.

## 10. 완료 기준 (Definition of Done)

- Figma `Login (Alt)` 디자인과 시각적으로 일치하는 `/login` 페이지가 렌더링된다(로고/타이틀/태그라인/divider/폼/footer-caption).
- 유효한 이메일/비밀번호로 제출 시 `POST /auth/login`이 호출되고, 성공 응답을 받으면 accessToken/user가 세션 store에 저장되며 `/`로 이동한다.
- 빈 필드/잘못된 이메일 형식은 클라이언트 단에서 막히고 Input이 Error variant로 표시된다.
- 401 응답 시 한국어 에러 메시지가 폼에 표시되고 페이지 이동이 일어나지 않는다.
- 제출 중 버튼이 로딩 상태(스피너 + disabled)로 전환된다.
- `pnpm lint`, `pnpm test`(frontend)가 통과한다.
- `tokens.json`의 색상/spacing/radius 값이 하드코딩 없이 CSS 변수를 통해 적용된다.
- 유효한 로그인 세션에서 `/login`에 접근하면 `/`로 리다이렉트된다.
- 새로고침 후 유효한 refresh token 쿠키가 있으면 accessToken/user 세션이 복원되고 기존 보호 화면에 머문다.
- accessToken 만료 시 refresh token 쿠키로 자동 갱신되고, refresh 실패 시 `/login`으로 리다이렉트된다.
- 보호 API의 401은 refresh 성공 시 한 번만 재시도하며, 재시도 후에도 401이면 `/login`으로 리다이렉트된다.
- 비로그인 상태에서 `/login` 외 모든 경로 접근이 `/login`으로 차단된다.
- 로그인 상태에서 `/login` 접근이 `/`로 차단된다.
- 로그아웃 시 백엔드 현재 기기 세션을 폐기하고 `/login`으로 이동한다.
