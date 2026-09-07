# 로그인 기능 (프론트엔드) 설계

- 관련 문서: [`PRODUCT.md`](../../../PRODUCT.md) §7 "로그인", §9 "로그인 페이지", [`DESIGN.md`](../../../DESIGN.md) §7.1 "Auth Shell", §8.1/§8.2 "Button/Input", [`tokens.json`](../../../tokens.json), [`2026-09-06-login-feature-design.md`](./2026-09-06-login-feature-design.md)(백엔드 로그인 설계)
- Figma: `Login (Alt)` 프레임 (node `96:5`), 파일 `Dimhltnal74SHy2NcLz1Lf`

## 1. 목표

Figma `Login (Alt)` 디자인을 기준으로 이메일/비밀번호 로그인 페이지를 구현하고, 백엔드 `POST /auth/login`과 연동한다. 이 기능이 프론트엔드 최초의 feature 슬라이스이자 최초의 상태 관리(zustand) 도입이므로, 이후 화면들이 따라갈 기본 패턴(디자인 토큰 배선, API 연동 방식, 폼 처리 방식)도 함께 확립한다.

### Non-Goals

- 워크스페이스/프로젝트 목록 등 로그인 이후 페이지 — 아직 존재하지 않으므로 로그인 성공 시 임시로 `/`(기존 HomePage)로 이동한다. 워크스페이스 기능이 구현되면 리다이렉트 대상을 교체한다.
- 회원가입 UI — `PRODUCT.md`에 따라 회원가입 기능 자체가 없다.
- accessToken 만료 시 자동 `/auth/refresh` 갱신, axios 인터셉터 기반 401 재시도 — 이번 스코프는 로그인 자체만 다루며, refresh 플로우는 앱 전역 인증 상태 관리(로그인 유지, 새로고침 시 세션 복원)와 함께 별도 기능으로 다룬다. `2026-09-06-login-feature-design.md` §1이 명시한 계약대로, refresh 실패를 자동 재시도하지 않는다는 원칙만 지금 단계에서도 지킨다(애초에 이번 스코프엔 refresh 호출이 없다).
- 새로고침(F5) 후에도 로그인 상태가 유지되도록 세션을 복원하는 기능 — accessToken이 메모리에만 있어 새로고침하면 사라진다. 이를 살리려면 refresh 토큰 쿠키로 앱 부팅 시 세션을 복원하는 별도 기능이 필요하며, 이번 스코프에서는 다루지 않는다. (단, 같은 SPA 세션 안에서의 가드는 §4.5에서 다룬다 — 이건 새로고침 생존과는 별개다.)
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

- `model/session-store.ts` — zustand store. State: `{ accessToken: string | null, user: { id, name, email } | null }`. Actions: `setSession(accessToken, user)`, `clearSession()`.
- accessToken은 메모리에만 보관한다(백엔드 설계서 §2와 동일한 정책 — localStorage 등 영속 저장소에 두지 않아 XSS 시 탈취 범위를 최소화).
- `index.ts`로 `useSessionStore` export.

### 4.3 `features/auth` (신규)

- `api/login.ts` — `loginRequest(email, password)`: `axiosInstance.post('/auth/login', { email, password })`, 응답 타입 `{ accessToken: string, user: { id: string, name: string, email: string } }`.
- `model/use-login.ts` — `useLogin()`: `@tanstack/react-query`의 `useMutation`으로 `loginRequest`를 감싸고, 성공 시 `useSessionStore.getState().setSession(...)` 호출.
- `ui/LoginForm.tsx` — react-hook-form + zod(`@hookform/resolvers/zod`)로 클라이언트 검증(이메일 형식, 필수 입력, 문구는 `shared/constants/messages.ts` 참조). 제출 시 `useLogin().mutate`, 서버 응답의 `error.message`(없으면 `NETWORK_ERROR` fallback)를 폼 레벨 에러로 노출(§5), `isPending`을 Button의 로딩 상태에 연결.

### 4.4 `pages/login` (신규)

- `ui/LoginPage.tsx` — 로고(§6)/타이틀/태그라인 + divider + `LoginForm` + footer-caption을 조합한다. 로직을 갖지 않는 순수 조합 컴포넌트로, 기존 `HomePage.tsx`와 동일한 얇은 패턴을 따른다.
- `index.ts`로 `LoginPage` export.

### 4.5 `routes/login.tsx` (신규)

- `createFileRoute('/login')({ beforeLoad, component: LoginPage })` — 기존 `routes/index.tsx` 패턴과 동일하되, `beforeLoad`에서 `useSessionStore.getState().accessToken`이 존재하면 `redirect({ to: '/' })`로 보낸다.
- 이 가드는 같은 SPA 세션(새로고침 없이) 안에서 로그인 직후 뒤로가기나 `/login` 재접근을 막는다. accessToken이 메모리에만 있으므로 새로고침 이후에는 store가 비어 있어 가드가 통과시키는데, 이는 §1 Non-Goals에 적은 "새로고침 후 세션 복원" 기능이 없기 때문이며 별개 이슈로 남긴다.

## 5. 에러 처리 및 상태

**원칙**: API 요청이 아예 나가지 않는 경우(클라이언트 검증 실패)는 프론트가 자체 문구를 쓰고, API 요청이 나간 뒤 발생하는 에러(401/400/네트워크 등)는 서버가 응답 body에 담아 보낸 메시지를 그대로 노출해 백엔드와 문구가 항상 일치하게 한다. 단, 서버가 아예 응답하지 못하는 경우(네트워크 단절, CORS 등)는 서버 메시지 자체가 없으므로 프론트가 자체 fallback 문구를 쓴다.

**서버 에러 응답 형태**: 백엔드 에러 핸들러(`backend/src/middlewares/error-handler.middleware.ts`)는 모든 에러를 `{ error: { message, code } }` 형태로 응답한다(최상위 `message`가 아니다). 즉 서버가 보낸 문구는 `error.response.data.error.message` 경로로 읽어야 한다. 성공 응답(`{ accessToken, user }`)에는 이 envelope가 없다 — 에러 응답에만 적용된다.

두 경우 모두 문구를 컴포넌트 안에 하드코딩하지 않고 `frontend/src/shared/constants/messages.ts`(신규)에 모아 관리한다 — 백엔드 `backend/src/constants/messages.ts`와 동일한 패턴(대문자 스네이크 케이스 키의 `as const` 객체)이다. 이 파일에는 **프론트가 실제로 소유하는 문구만** 넣는다: 클라이언트 검증 문구(백엔드 `EMAIL_REQUIRED`/`EMAIL_INVALID_FORMAT`/`PASSWORD_REQUIRED`와 동일한 한국어 텍스트를 프론트 zod 스키마용으로 동일하게 유지)와, 서버 응답 자체를 받지 못했을 때의 fallback 문구(`NETWORK_ERROR`) 두 종류다. 401/400처럼 서버가 실제로 보낸 메시지는 이 파일에 넣지 않고 응답의 `error.message` 필드를 그대로 사용한다.

| 상황 | 트리거 | 문구 출처 | 표현 |
|---|---|---|---|
| 클라이언트 검증 실패(이메일 형식/필수 입력 누락) | react-hook-form + zod, API 요청 전에 차단 | 프론트 `shared/constants/messages.ts` (백엔드 문구와 동일 텍스트 유지) | 해당 Input에 `aria-invalid`(Error variant) + 필드 아래 인라인 메시지 |
| 401 `INVALID_CREDENTIALS` | 서버 응답 | 서버 응답의 `error.message` 그대로 | 폼 레벨 에러 메시지 (이메일/비밀번호 중 무엇이 틀렸는지 구분 안 함 — 백엔드 정책과 일관) |
| 400 `VALIDATION_ERROR` | 서버 응답(클라이언트 검증을 벗어나 도달한 경우에 대한 방어적 처리) | 서버 응답의 `error.message` 그대로 | 폼 레벨 에러 메시지 |
| 네트워크 오류(응답 자체를 못 받음) | axios 에러(`error.response`가 없음) | 프론트 `shared/constants/messages.ts`의 `NETWORK_ERROR` | 폼 레벨 에러 메시지 |
| 5xx | 서버 응답(응답은 왔음) | 서버 응답의 `error.message` 그대로 | 폼 레벨 에러 메시지 |
| 제출 중 | `useLogin().isPending` | — | Submit Button에 스피너(Lucide `Loader2`, `animate-spin`) + `disabled`, 라벨은 "로그인 중..."으로 교체(아이콘만 남기면 버튼의 접근 가능한 이름이 사라지므로 텍스트를 반드시 유지) |

폼 레벨 에러 메시지는 DESIGN.md §8.2 규칙(Label을 대체하지 않음)과는 무관하게 필드 그룹 전체 아래 한 곳에 표시한다 — 401은 특정 필드 문제가 아니라 자격 증명 조합의 문제이기 때문이다.

## 6. 에셋

Figma 마크 이미지(28×28, node `96:9`/`96:10`)를 다운로드해 `frontend/public/logo-mark.png`로 커밋한다. 기존 `public/favicon.svg`(마스코트 일러스트)와는 다른 이미지이므로 재사용하지 않는다.

## 7. API 연동 변경

- `shared/api/axios-instance.ts`에 `withCredentials: true`를 추가한다 — refreshToken httpOnly 쿠키를 브라우저가 주고받으려면 필수다(백엔드 설계서 §3, CORS `credentials: true`와 대응).
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
frontend/src/features/auth/model/use-login.ts         (신규) useLogin 훅(§4.3)
frontend/src/features/auth/ui/LoginForm.tsx           (신규) 폼 UI/검증/에러 처리(§4.3, §5)
frontend/src/features/auth/index.ts                   (신규)
frontend/src/pages/login/ui/LoginPage.tsx             (신규) 페이지 조합(§4.4)
frontend/src/pages/login/ui/LoginPage.test.tsx         (신규) 렌더링/제출 플로우 테스트
frontend/src/pages/login/index.ts                     (신규)
frontend/src/routes/login.tsx                         (신규) /login 라우트(§4.5)
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

## 10. 완료 기준 (Definition of Done)

- Figma `Login (Alt)` 디자인과 시각적으로 일치하는 `/login` 페이지가 렌더링된다(로고/타이틀/태그라인/divider/폼/footer-caption).
- 유효한 이메일/비밀번호로 제출 시 `POST /auth/login`이 호출되고, 성공 응답을 받으면 accessToken/user가 세션 store에 저장되며 `/`로 이동한다.
- 빈 필드/잘못된 이메일 형식은 클라이언트 단에서 막히고 Input이 Error variant로 표시된다.
- 401 응답 시 한국어 에러 메시지가 폼에 표시되고 페이지 이동이 일어나지 않는다.
- 제출 중 버튼이 로딩 상태(스피너 + disabled)로 전환된다.
- `pnpm lint`, `pnpm test`(frontend)가 통과한다.
- `tokens.json`의 색상/spacing/radius 값이 하드코딩 없이 CSS 변수를 통해 적용된다.
- 로그인 상태(세션 store에 accessToken 존재)에서 `/login`에 접근하면 `/`로 리다이렉트된다(새로고침 이후 동작은 별도 기능 범위).
