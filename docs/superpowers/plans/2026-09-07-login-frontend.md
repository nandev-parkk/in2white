# 로그인 기능 (프론트엔드) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Figma `Login (Alt)` 디자인대로 `/login` 페이지를 만들고 백엔드 `POST /auth/login`과 연동한다. 로그인 후에는 accessToken을 세션에 저장하고 `/`로 이동하며, accessToken 만료 시 refresh token으로 자동 갱신하고 갱신 실패 시 `/login`으로 이동하는 전역 인증 흐름까지 완성한다.

**Architecture:** FSD(Feature-Sliced Design) 레이어를 따른다 — `shared/ui`(재사용 Input), `entities/session`(zustand 세션 store), `features/auth`(로그인·refresh·로그아웃 API, single-flight refresh, Axios 인터셉터, 전역 인증 가드), `pages/login`(조합), `routes/__root.tsx`(세션 복원과 전역 접근 제어), `routes/login.tsx`(로그인 화면). `tokens.json`의 디자인 토큰을 `app/styles/index.css`에 CSS 변수로 배선해 Figma 참조 코드의 변수명을 그대로 쓸 수 있게 하고, 기존 shadcn 별칭도 같은 값으로 재매핑한다.

**Tech Stack:** React 19, TanStack Router(파일 기반 라우팅) + TanStack Query(`useMutation`), react-hook-form + zod(`@hookform/resolvers/zod`), zustand(세션 store), axios, class-variance-authority + `cn`(스타일), Tailwind CSS v4, vitest + `@testing-library/react`(테스트).

**Spec:** [`docs/superpowers/specs/2026-09-07-login-frontend-design.md`](../specs/2026-09-07-login-frontend-design.md)

## Global Constraints

- 패키지 매니저는 pnpm. 모든 명령은 `frontend/` 디렉터리에서 실행한다(`cd frontend && ...`).
- 모든 새 파일은 `@/*` path alias(`frontend/tsconfig.app.json`, `frontend/vite.config.ts`에 이미 설정됨)를 사용해 import한다.
- 새 의존성을 추가하지 않는다 — `zustand`, `react-hook-form`, `@hookform/resolvers`, `zod`, `lucide-react`, `class-variance-authority`, `cn`, `@tanstack/react-query`, `@tanstack/react-router`가 이미 `frontend/package.json`에 있다.
- accessToken은 zustand store(메모리)에만 저장한다 — localStorage 등 영속 저장소에 절대 쓰지 않는다.
- refresh token은 httpOnly 쿠키로만 사용하며 프론트에서 읽지 않는다. `/auth/refresh`는 `withCredentials`로 호출한다.
- accessToken이 만료되면 동시 요청을 하나의 refresh 요청으로 합치고, refresh 성공 후 보호 요청을 재개한다. refresh 실패는 자동 재시도하지 않고 세션을 정리한 뒤 `/login`으로 이동한다.
- 보호 요청이 401이면 refresh 후 원래 요청을 한 번만 재시도한다. 재시도 후에도 401이면 세션을 정리하고 `/login`으로 이동한다.
- 전역 인증 가드는 새로고침 후 메모리 세션이 없을 때 `/auth/refresh`로 세션 복원을 시도한다. `/login`은 refresh 성공 또는 유효한 세션이 있으면 `/`로 redirect하고, refresh 실패 시에만 접근을 허용한다.
- 에러 메시지 원칙: API 요청 전 클라이언트 검증 실패는 `frontend/src/shared/constants/messages.ts`의 문구를 쓰고, API가 응답한 에러(401/400/5xx)는 응답 body의 `message`를 그대로 노출한다. 응답 자체를 못 받은 경우(네트워크 오류)만 `messages.ts`의 `NETWORK_ERROR`를 fallback으로 쓴다.
- 로그인 성공 시 `/`로 이동한다(워크스페이스 페이지가 아직 없어 임시 조치, 스펙 §1 Non-Goals).
- Figma `Login (Alt)` 프레임: node `96:5`, 파일 키 `Dimhltnal74SHy2NcLz1Lf`. Input 컴포넌트 사양: node `32:22`. Button 컴포넌트 사양: node `30:26`.
- Tailwind 스페이싱 스케일(`p-1`=4px ~ `p-16`=64px)이 `tokens.json`의 spacing 값과 1:1 대응하고, `h-9`(36px)/`h-11`(44px)이 `component.controlHeight.default/large`와 정확히 일치하므로 별도의 컨트롤 높이 CSS 변수는 만들지 않고 Tailwind 기본 스케일을 직접 쓴다(스펙 §3의 "Tailwind 임의값으로 참조"를 이 방식으로 대체 — 시각적 결과는 동일하고 변수 하나를 덜 유지한다).
- 커밋 메시지는 CLAUDE.md의 `#{issue-number}/{type}: name` 형식을 따르되, 이 작업의 GitHub 이슈 번호는 실행 시점에 확인해 채운다(이 문서에서는 이슈 번호 없이 `type: name`만 표기).

---

## Task 1: 디자인 토큰을 index.css에 배선

**Files:**

- Modify: `frontend/src/app/styles/index.css`

**Interfaces:**

- Produces: `--color-background-default`, `--color-background-subtle`, `--color-background-canvas`, `--color-background-elevated`, `--color-foreground-strong`, `--color-foreground-default`, `--color-foreground-secondary`, `--color-foreground-tertiary`, `--color-foreground-disabled`, `--color-border-subtle`, `--color-border-default`, `--color-border-strong`, `--color-action-primary`, `--color-action-primary-hover`, `--color-action-primary-active`, `--color-action-primary-foreground`, `--color-action-secondary`, `--color-action-secondary-hover`, `--color-action-secondary-foreground`, `--color-action-focus-ring`, `--color-status-success`, `--color-status-success-subtle-bg`, `--color-status-warning`, `--color-status-warning-subtle-bg`, `--color-status-danger`, `--color-status-danger-hover`, `--color-status-danger-subtle-bg`, `--color-status-info`, `--color-status-info-subtle-bg` (light in `:root`, dark in `.dark`) — 이후 모든 Task가 사용. Tailwind `rounded-sm`/`rounded-md`/`rounded-lg`가 각각 4px/8px/12px를 가리키도록 재정의됨.

이 Task는 순수 CSS 변경이라 전용 유닛 테스트가 없다. 대신 기존 `HomePage.test.tsx`가 계속 통과하는지로 회귀를 확인한다.

- [ ] **Step 1: 현재 테스트가 통과하는지 베이스라인 확인**

Run: `cd frontend && pnpm test`
Expected: 기존 `HomePage.test.tsx` PASS (아직 아무것도 바꾸지 않았으므로).

- [ ] **Step 2: `frontend/src/app/styles/index.css` 전체를 다음으로 교체**

```css
@import 'tailwindcss';
@import 'tw-animate-css';
@import '@fontsource-variable/geist';

@custom-variant dark (&:is(.dark *));

:root {
  /* in2white design tokens (tokens.json) — light */
  --color-background-default: oklch(1 0 0);
  --color-background-subtle: oklch(0.972 0.002 286);
  --color-background-canvas: oklch(0.961 0.002 286);
  --color-background-elevated: oklch(1 0 0);

  --color-foreground-strong: oklch(0.148 0.004 277);
  --color-foreground-default: oklch(0.259 0.01 273 / 0.88);
  --color-foreground-secondary: oklch(0.298 0.01 273 / 0.61);
  --color-foreground-tertiary: oklch(0.298 0.01 273 / 0.43);
  --color-foreground-disabled: oklch(0.298 0.01 273 / 0.28);

  --color-border-subtle: oklch(0.521 0.018 273 / 0.08);
  --color-border-default: oklch(0.521 0.018 273 / 0.22);
  --color-border-strong: oklch(0.521 0.018 273 / 0.35);

  --color-action-primary: oklch(0.148 0.004 277);
  --color-action-primary-hover: oklch(0.237 0.008 273);
  --color-action-primary-active: oklch(0.108 0.002 286);
  --color-action-primary-foreground: oklch(1 0 0);
  --color-action-secondary: oklch(0.521 0.018 273 / 0.1);
  --color-action-secondary-hover: oklch(0.521 0.018 273 / 0.16);
  --color-action-secondary-foreground: oklch(0.259 0.01 273 / 0.88);
  --color-action-focus-ring: oklch(0.148 0.004 277 / 0.16);

  --color-status-success: oklch(0.673 0.211 144);
  --color-status-success-subtle-bg: oklch(0.968 0.052 154);
  --color-status-warning: oklch(0.625 0.148 56);
  --color-status-warning-subtle-bg: oklch(0.967 0.03 81);
  --color-status-danger: oklch(0.546 0.22 27);
  --color-status-danger-hover: oklch(0.452 0.188 28);
  --color-status-danger-subtle-bg: oklch(0.951 0.018 18);
  --color-status-info: oklch(0.563 0.241 261);
  --color-status-info-subtle-bg: oklch(0.954 0.022 250);

  /* shadcn 별칭 재매핑 — 기존 컴포넌트(Button 등)가 수정 없이 in2white 톤을 쓰게 함 */
  --background: var(--color-background-default);
  --foreground: var(--color-foreground-default);
  --card: var(--color-background-default);
  --card-foreground: var(--color-foreground-default);
  --popover: var(--color-background-elevated);
  --popover-foreground: var(--color-foreground-default);
  --primary: var(--color-action-primary);
  --primary-foreground: var(--color-action-primary-foreground);
  --secondary: var(--color-action-secondary);
  --secondary-foreground: var(--color-action-secondary-foreground);
  --muted: var(--color-background-subtle);
  --muted-foreground: var(--color-foreground-secondary);
  --accent: var(--color-background-subtle);
  --accent-foreground: var(--color-foreground-default);
  --destructive: var(--color-status-danger);
  --border: var(--color-border-default);
  --input: var(--color-border-default);
  --ring: var(--color-action-focus-ring);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.5rem;
  --sidebar: var(--color-background-default);
  --sidebar-foreground: var(--color-foreground-default);
  --sidebar-primary: var(--color-action-primary);
  --sidebar-primary-foreground: var(--color-action-primary-foreground);
  --sidebar-accent: var(--color-background-subtle);
  --sidebar-accent-foreground: var(--color-foreground-default);
  --sidebar-border: var(--color-border-default);
  --sidebar-ring: var(--color-action-focus-ring);
}

.dark {
  --color-background-default: oklch(0.166 0.005 271);
  --color-background-subtle: oklch(0.135 0.002 286);
  --color-background-canvas: oklch(0.148 0.004 277);
  --color-background-elevated: oklch(0.237 0.008 273);

  --color-foreground-strong: oklch(1 0 0);
  --color-foreground-default: oklch(1 0 0 / 0.88);
  --color-foreground-secondary: oklch(1 0 0 / 0.61);
  --color-foreground-tertiary: oklch(1 0 0 / 0.43);
  --color-foreground-disabled: oklch(1 0 0 / 0.28);

  --color-border-subtle: oklch(1 0 0 / 0.08);
  --color-border-default: oklch(1 0 0 / 0.22);
  --color-border-strong: oklch(1 0 0 / 0.35);

  --color-action-primary: oklch(1 0 0);
  --color-action-primary-hover: oklch(0.929 0.003 286);
  --color-action-primary-active: oklch(0.876 0.006 269);
  --color-action-primary-foreground: oklch(0.148 0.004 277);
  --color-action-secondary: oklch(1 0 0 / 0.1);
  --color-action-secondary-hover: oklch(1 0 0 / 0.16);
  --color-action-secondary-foreground: oklch(1 0 0 / 0.88);
  --color-action-focus-ring: oklch(1 0 0 / 0.16);

  --color-status-success: oklch(0.76 0.18 144);
  --color-status-success-subtle-bg: oklch(0.298 0.1 144 / 0.28);
  --color-status-warning: oklch(0.778 0.158 64);
  --color-status-warning-subtle-bg: oklch(0.298 0.1 56 / 0.32);
  --color-status-danger: oklch(0.715 0.22 27);
  --color-status-danger-hover: oklch(0.643 0.231 27);
  --color-status-danger-subtle-bg: oklch(0.298 0.1 22 / 0.32);
  --color-status-info: oklch(0.715 0.155 255);
  --color-status-info-subtle-bg: oklch(0.149 0.069 257);

  --background: var(--color-background-default);
  --foreground: var(--color-foreground-default);
  --card: var(--color-background-elevated);
  --card-foreground: var(--color-foreground-default);
  --popover: var(--color-background-elevated);
  --popover-foreground: var(--color-foreground-default);
  --primary: var(--color-action-primary);
  --primary-foreground: var(--color-action-primary-foreground);
  --secondary: var(--color-action-secondary);
  --secondary-foreground: var(--color-action-secondary-foreground);
  --muted: var(--color-background-subtle);
  --muted-foreground: var(--color-foreground-secondary);
  --accent: var(--color-background-subtle);
  --accent-foreground: var(--color-foreground-default);
  --destructive: var(--color-status-danger);
  --border: var(--color-border-default);
  --input: var(--color-border-default);
  --ring: var(--color-action-focus-ring);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --sidebar: var(--color-background-elevated);
  --sidebar-foreground: var(--color-foreground-default);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: var(--color-action-primary-foreground);
  --sidebar-accent: var(--color-background-subtle);
  --sidebar-accent-foreground: var(--color-foreground-default);
  --sidebar-border: var(--color-border-default);
  --sidebar-ring: var(--color-action-focus-ring);
}

@theme inline {
  --font-heading: var(--font-sans);
  --font-sans: 'Geist Variable', sans-serif;
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --color-foreground: var(--foreground);
  --color-background: var(--background);
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-3xl: 24px;
  --radius-4xl: 32px;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```

- [ ] **Step 3: 기존 테스트가 여전히 통과하는지 확인**

Run: `cd frontend && pnpm test`
Expected: `HomePage.test.tsx` PASS (색이 바뀌었을 뿐 버튼 role/name은 그대로이므로 영향 없음).

- [ ] **Step 4: lint 확인**

Run: `cd frontend && pnpm lint`
Expected: 에러 없음.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/app/styles/index.css
git commit -m "$(cat <<'EOF'
style: tokens.json 디자인 토큰을 index.css에 배선

- Figma가 참조하는 --color-* 변수명으로 light/dark 토큰 정의
- 기존 shadcn 별칭(--primary, --border 등)을 같은 값으로 재매핑
- radius-sm/md/lg를 4/8/12px로 재정의
EOF
)"
```

---

## Task 2: 에러 메시지 상수 파일 + axios withCredentials

**Files:**

- Create: `frontend/src/shared/constants/messages.ts`
- Modify: `frontend/src/shared/api/axios-instance.ts`

**Interfaces:**

- Produces: `MESSAGES.EMAIL_REQUIRED`, `MESSAGES.EMAIL_INVALID_FORMAT`, `MESSAGES.PASSWORD_REQUIRED`, `MESSAGES.NETWORK_ERROR` (모두 `string`) — Task 8(LoginForm)이 사용.

- [ ] **Step 1: `frontend/src/shared/constants/messages.ts` 생성**

```ts
export const MESSAGES = {
  EMAIL_REQUIRED: '이메일을 입력해주세요',
  EMAIL_INVALID_FORMAT: '올바른 이메일 형식이 아닙니다',
  PASSWORD_REQUIRED: '비밀번호를 입력해주세요',
  NETWORK_ERROR: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요',
} as const
```

(`EMAIL_REQUIRED`/`EMAIL_INVALID_FORMAT`/`PASSWORD_REQUIRED`는 `backend/src/constants/messages.ts`의 동일 키와 텍스트를 그대로 맞춘 것이다 — 백엔드가 문구를 바꾸면 이 파일도 함께 갱신한다.)

- [ ] **Step 2: `frontend/src/shared/api/axios-instance.ts`에 `withCredentials` 추가**

전체를 다음으로 교체:

```ts
import axios from 'axios'

import { env } from '@/shared/config/env'

export const axiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 10_000,
  withCredentials: true,
})
```

- [ ] **Step 3: 타입체크 + lint 확인**

Run: `cd frontend && pnpm lint`
Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/shared/constants/messages.ts src/shared/api/axios-instance.ts
git commit -m "feat: 프론트 에러 메시지 상수 추가 및 axios 쿠키 전송 활성화"
```

---

## Task 3: Button "lg" 사이즈를 Figma Large 스펙에 맞추고, Default 사이즈의 라디우스 회귀를 막음

DESIGN.md §8.1은 Button을 Default/Large 2단계로만 정의하고, Large는 Auth Shell/Modal 전용 44px다. 현재 `button.tsx`의 `lg` 사이즈는 36px(h-9)로, 다른 화면에서 아직 쓰이지 않는 미사용 variant다. 로그인 제출 버튼에 쓸 수 있도록 44px/24px 패딩/semibold로 고친다.

**주의(계획 검토 중 발견한 회귀)**: `button.tsx`의 base 클래스가 모든 사이즈에 `rounded-lg`를 무조건 적용하고, `default`/`lg`/`icon`/`icon-lg`는 이를 오버라이드하지 않는다(`xs`/`sm`/`icon-xs`/`icon-sm`만 자체적으로 라디우스를 오버라이드함). Task 1 이전에는 `--radius-lg`가 `var(--radius)`(10px)였으므로 이미 배포된 HomePage의 Default 버튼도 10px로 렌더링되고 있었다. Task 1이 `--radius-lg`를 12px로 하드코딩하면서, 손대지 않은 Default/`icon`/`icon-lg` 버튼까지 조용히 10px→12px로 바뀐다 — `tokens.json`이 명시한 "Default는 radius-md(8px)와 짝을 이룬다"는 의도와 반대 방향으로 더 벌어지는 회귀다. 이번 Task에서 `default`/`lg`/`icon`/`icon-lg`에 명시적 라디우스를 지정해 base의 암묵적 `rounded-lg` 의존을 없애 이 회귀를 막는다(Default 사이즈의 높이/패딩은 로그인 기능과 무관하므로 건드리지 않는다).

**Files:**

- Modify: `frontend/src/shared/ui/button.tsx`
- Create: `frontend/src/shared/ui/button.test.tsx`

**Interfaces:**

- Consumes: 없음 (기존 컴포넌트 수정).
- Produces: `<Button size="lg">`가 `h-11`(44px)+`rounded-lg`(12px) 클래스를 갖는다 — Task 8(LoginForm)의 제출 버튼이 사용. `<Button size="default">`(기본값, 별도 사이즈 미지정 시)는 `rounded-md`(8px)를 갖는다 — 기존 HomePage가 계속 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/shared/ui/button.test.tsx` 생성:

```tsx
import { render, screen } from '@testing-library/react'

import { Button } from './button'

describe('Button', () => {
  it('renders the "lg" size as a 44px control with a 12px radius', () => {
    render(<Button size="lg">로그인</Button>)

    const button = screen.getByRole('button', { name: '로그인' })

    expect(button.className).toContain('h-11')
    expect(button.className).toContain('rounded-lg')
  })

  it('renders the default size with an 8px radius, unaffected by the lg fix', () => {
    render(<Button>시작하기</Button>)

    const button = screen.getByRole('button', { name: '시작하기' })

    expect(button.className).toContain('rounded-md')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && pnpm test -- button.test`
Expected: FAIL (현재 `lg`는 `h-9`이고, 두 사이즈 모두 명시적 `rounded-md`/`rounded-lg` 클래스가 없다 — base의 암묵적 `rounded-lg`에만 의존).

- [ ] **Step 3: `frontend/src/shared/ui/button.tsx` 수정**

먼저 base 클래스 문자열(파일 7번째 줄)에서 `rounded-lg`를 제거한다. 찾아서:

```ts
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
```

다음으로 교체(`rounded-lg` 부분만 제거):

```ts
  "group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
```

다음으로, `size` variants 객체 안의 `default`/`lg`/`icon`/`icon-lg` 네 줄을 찾아서:

```ts
        default:
          'h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
```

```ts
        lg: 'h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
```

```ts
        icon: 'size-8',
```

```ts
        'icon-lg': 'size-9',
```

각각 다음으로 교체:

```ts
        default:
          'h-8 gap-1.5 rounded-md px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
```

```ts
        lg: 'h-11 gap-2 rounded-lg px-6 font-semibold has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4',
```

```ts
        icon: 'size-8 rounded-md',
```

```ts
        'icon-lg': 'size-9 rounded-lg',
```

(`xs`/`sm`/`icon-xs`/`icon-sm`은 이미 자체 라디우스를 오버라이드하고 있으므로 손대지 않는다.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && pnpm test -- button.test`
Expected: PASS(2개 테스트 모두 통과)

- [ ] **Step 5: 전체 테스트 + lint 확인**

Run: `cd frontend && pnpm test && pnpm lint`
Expected: 모두 PASS/에러 없음. `HomePage.test.tsx`는 버튼 role/name만 확인하므로 영향 없음.

- [ ] **Step 6: Commit**

```bash
cd frontend
git add src/shared/ui/button.tsx src/shared/ui/button.test.tsx
git commit -m "fix: Button lg 사이즈를 Large 스펙(44px)에 맞추고 사이즈별 라디우스를 명시"
```

---

## Task 4: shared/ui/input.tsx 컴포넌트

**Files:**

- Create: `frontend/src/shared/ui/input.tsx`
- Create: `frontend/src/shared/ui/input.test.tsx`

**Interfaces:**

- Consumes: Task 1의 `--color-background-default`, `--color-background-subtle`, `--color-border-default`, `--color-border-subtle`, `--color-action-primary`, `--color-action-focus-ring`, `--color-foreground-default`, `--color-foreground-tertiary`, `--color-foreground-disabled`, `--color-status-danger` CSS 변수, `rounded-md`/`rounded-lg` 유틸리티.
- Produces: `Input` 컴포넌트, `size?: 'default' | 'large'` prop(기본값 `'default'`), 나머지는 네이티브 `<input>` props(`aria-invalid`, `disabled` 포함) — Task 8(LoginForm)이 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/shared/ui/input.test.tsx` 생성:

```tsx
import { render, screen } from '@testing-library/react'

import { Input } from './input'

describe('Input', () => {
  it('renders a large text input with the given placeholder', () => {
    render(
      <Input
        size="large"
        placeholder="you@in2white.team"
        aria-label="이메일"
      />,
    )

    const input = screen.getByRole('textbox', { name: '이메일' })

    expect(input).toHaveAttribute('placeholder', 'you@in2white.team')
    expect(input.className).toContain('h-11')
  })

  it('marks itself invalid when aria-invalid is set', () => {
    render(<Input aria-label="이메일" aria-invalid />)

    expect(screen.getByRole('textbox', { name: '이메일' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('is disabled when the disabled prop is set', () => {
    render(<Input aria-label="이메일" disabled />)

    expect(screen.getByRole('textbox', { name: '이메일' })).toBeDisabled()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && pnpm test -- input.test`
Expected: FAIL(`./input` 모듈이 없음).

- [ ] **Step 3: `frontend/src/shared/ui/input.tsx` 생성**

```tsx
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'

const inputVariants = cva(
  'w-full bg-[var(--color-background-default)] text-[14px] font-medium leading-[1.429] tracking-[0.0145em] text-[var(--color-foreground-default)] placeholder:text-[var(--color-foreground-tertiary)] border border-solid border-[var(--color-border-default)] outline-none transition-colors focus:border-[var(--color-action-primary)] focus:shadow-[0_0_0_3px_var(--color-action-focus-ring)] disabled:cursor-not-allowed disabled:bg-[var(--color-background-subtle)] disabled:border-[var(--color-border-subtle)] disabled:text-[var(--color-foreground-disabled)] aria-invalid:border-[var(--color-status-danger)]',
  {
    variants: {
      size: {
        default: 'h-9 rounded-md px-4',
        large: 'h-11 rounded-lg px-4',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

export interface InputProps
  extends React.ComponentProps<'input'>, VariantProps<typeof inputVariants> {}

function Input({ className, size, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ size, className }))}
      {...props}
    />
  )
}

export { Input, inputVariants }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && pnpm test -- input.test`
Expected: PASS

- [ ] **Step 5: lint 확인**

Run: `cd frontend && pnpm lint`
Expected: 에러 없음.

- [ ] **Step 6: Commit**

```bash
cd frontend
git add src/shared/ui/input.tsx src/shared/ui/input.test.tsx
git commit -m "feat: Figma Input 사양을 따르는 shared/ui/input 컴포넌트 추가"
```

---

## Task 5: entities/session (zustand 세션 store)

**Files:**

- Create: `frontend/src/entities/session/model/session-store.ts`
- Create: `frontend/src/entities/session/model/session-store.test.ts`
- Create: `frontend/src/entities/session/index.ts`

**Interfaces:**

- Produces: `useSessionStore` (zustand store hook). State: `{ accessToken: string | null, user: SessionUser | null }`. Actions: `setSession(accessToken: string, user: SessionUser) => void`, `updateAccessToken(accessToken: string) => void`, `clearSession() => void`. `isAccessTokenExpired(accessToken: string, nowInSeconds?: number) => boolean`은 JWT `exp`를 검사하며 malformed/missing `exp`도 만료로 판정한다. `SessionUser = { id: string, name: string, email: string }`. — 로그인, refresh coordinator, Axios 인터셉터, 라우트 가드가 사용한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/entities/session/model/session-store.test.ts` 생성:

```ts
import { isAccessTokenExpired, useSessionStore } from './session-store'

describe('useSessionStore', () => {
  afterEach(() => {
    useSessionStore.getState().clearSession()
  })

  it('starts with no session', () => {
    expect(useSessionStore.getState().accessToken).toBeNull()
    expect(useSessionStore.getState().user).toBeNull()
  })

  it('stores the access token and user on setSession', () => {
    useSessionStore.getState().setSession('token-1', {
      id: '1',
      name: '테스터',
      email: 'user@in2white.team',
    })

    expect(useSessionStore.getState().accessToken).toBe('token-1')
    expect(useSessionStore.getState().user).toEqual({
      id: '1',
      name: '테스터',
      email: 'user@in2white.team',
    })
  })

  it('updates only the access token after refresh', () => {
    useSessionStore.getState().setSession('token-1', {
      id: '1',
      name: '테스터',
      email: 'user@in2white.team',
    })

    useSessionStore.getState().updateAccessToken('token-2')

    expect(useSessionStore.getState().accessToken).toBe('token-2')
    expect(useSessionStore.getState().user).toEqual({
      id: '1',
      name: '테스터',
      email: 'user@in2white.team',
    })
  })

  it('treats expired, malformed, and missing-exp tokens as expired', () => {
    const payload = btoa(JSON.stringify({ exp: 100 }))
    const validToken = `header.${payload}.signature`

    expect(isAccessTokenExpired(validToken, 99)).toBe(false)
    expect(isAccessTokenExpired(validToken, 100)).toBe(true)
    expect(isAccessTokenExpired('not-a-jwt')).toBe(true)
    expect(
      isAccessTokenExpired(
        `header.${btoa(JSON.stringify({ sub: '1' }))}.signature`,
      ),
    ).toBe(true)
  })

  it('clears the session on clearSession', () => {
    useSessionStore.getState().setSession('token-1', {
      id: '1',
      name: '테스터',
      email: 'user@in2white.team',
    })

    useSessionStore.getState().clearSession()

    expect(useSessionStore.getState().accessToken).toBeNull()
    expect(useSessionStore.getState().user).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && pnpm test -- session-store.test`
Expected: FAIL(`./session-store` 모듈이 없음).

- [ ] **Step 3: `frontend/src/entities/session/model/session-store.ts` 생성**

```ts
import { create } from 'zustand'

export interface SessionUser {
  id: string
  name: string
  email: string
}

interface SessionState {
  accessToken: string | null
  user: SessionUser | null
  setSession: (accessToken: string, user: SessionUser) => void
  updateAccessToken: (accessToken: string) => void
  clearSession: () => void
}

function decodePayload(token: string): unknown {
  const payload = token.split('.')[1]
  if (!payload) return null

  try {
    const normalized = payload.replaceAll('-', '+').replaceAll('_', '/')
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    )
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

export function isAccessTokenExpired(
  accessToken: string,
  nowInSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const payload = decodePayload(accessToken)

  return (
    typeof payload !== 'object' ||
    payload === null ||
    !('exp' in payload) ||
    typeof payload.exp !== 'number' ||
    payload.exp <= nowInSeconds
  )
}

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  user: null,
  setSession: (accessToken, user) => set({ accessToken, user }),
  updateAccessToken: (accessToken) => set({ accessToken }),
  clearSession: () => set({ accessToken: null, user: null }),
}))
```

- [ ] **Step 4: `frontend/src/entities/session/index.ts` 생성**

```ts
export { useSessionStore } from './model/session-store'
export type { SessionUser } from './model/session-store'
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd frontend && pnpm test -- session-store.test`
Expected: PASS

- [ ] **Step 6: lint 확인**

Run: `cd frontend && pnpm lint`
Expected: 에러 없음.

- [ ] **Step 7: Commit**

```bash
cd frontend
git add src/entities/session
git commit -m "feat: 세션(accessToken/user) zustand store 추가"
```

---

## Task 6: features/auth/api/login.ts

**Files:**

- Create: `frontend/src/features/auth/api/login.ts`
- Create: `frontend/src/features/auth/api/login.test.ts`

**Interfaces:**

- Consumes: `axiosInstance` from `@/shared/api`.
- Produces: `loginRequest(email: string, password: string): Promise<LoginResponse>`, `LoginResponse = { accessToken: string, user: { id: string, name: string, email: string } }` — Task 8(useLogin)이 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/features/auth/api/login.test.ts` 생성:

```ts
import { axiosInstance } from '@/shared/api'

import { loginRequest } from './login'

vi.mock('@/shared/api', () => ({
  axiosInstance: { post: vi.fn() },
}))

describe('loginRequest', () => {
  it('posts the credentials to /auth/login and returns the response data', async () => {
    const responseData = {
      accessToken: 'token-1',
      user: { id: '1', name: '테스터', email: 'user@in2white.team' },
    }
    vi.mocked(axiosInstance.post).mockResolvedValueOnce({ data: responseData })

    const result = await loginRequest('user@in2white.team', 'password123')

    expect(axiosInstance.post).toHaveBeenCalledWith('/auth/login', {
      email: 'user@in2white.team',
      password: 'password123',
    })
    expect(result).toEqual(responseData)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && pnpm test -- features/auth/api/login.test`
Expected: FAIL(`./login` 모듈이 없음).

- [ ] **Step 3: `frontend/src/features/auth/api/login.ts` 생성**

```ts
import { axiosInstance } from '@/shared/api'

export interface LoginResponse {
  accessToken: string
  user: {
    id: string
    name: string
    email: string
  }
}

export async function loginRequest(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const { data } = await axiosInstance.post<LoginResponse>('/auth/login', {
    email,
    password,
  })

  return data
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && pnpm test -- features/auth/api/login.test`
Expected: PASS

- [ ] **Step 5: lint 확인**

Run: `cd frontend && pnpm lint`
Expected: 에러 없음.

- [ ] **Step 6: Commit**

```bash
cd frontend
git add src/features/auth/api
git commit -m "feat: POST /auth/login 호출 함수 추가"
```

---

## Task 7: 로고 마크 에셋 다운로드

**Files:**

- Create: `frontend/public/logo-mark.png`

**Interfaces:**

- Produces: 정적 파일 `/logo-mark.png` — Task 9(LoginPage)가 `<img src="/logo-mark.png">`로 사용.

- [ ] **Step 1: Figma 에셋 다운로드**

Run:

```bash
curl -L "https://www.figma.com/api/mcp/asset/25c25967-446f-4f42-b5cd-67a3ec82b718.png" \
  -o frontend/public/logo-mark.png
```

Expected: `frontend/public/logo-mark.png` 파일이 생성된다(28×28 PNG).

> 이 URL은 Figma MCP 세션에서 발급된 임시 URL로 약 7일 후 만료된다. 만료되었다면(다운로드 결과가 0바이트이거나 HTML 에러 페이지라면) Figma MCP `get_design_context`를 node `96:5`(파일 키 `Dimhltnal74SHy2NcLz1Lf`)에 다시 호출해 `imgMark` 상수의 새 URL을 받아 그 URL로 대체 실행한다.

- [ ] **Step 2: 파일이 유효한 이미지인지 확인**

Run: `file frontend/public/logo-mark.png`
Expected: 출력에 `PNG image data`가 포함된다.

- [ ] **Step 3: Commit**

```bash
cd frontend
git add public/logo-mark.png
git commit -m "chore: 로그인 화면용 로고 마크 에셋 추가"
```

---

## Task 8: features/auth/ui/LoginForm.tsx

**Files:**

- Create: `frontend/src/features/auth/model/use-login.ts`
- Create: `frontend/src/features/auth/ui/LoginForm.tsx`
- Create: `frontend/src/features/auth/ui/LoginForm.test.tsx`
- Create: `frontend/src/features/auth/index.ts`

**Interfaces:**

- Consumes: `loginRequest`(Task 6), `useSessionStore`(Task 5), `Input`(Task 4), `Button`(Task 3, `size="lg"`), `MESSAGES`(Task 2), `useNavigate` from `@tanstack/react-router`.
- Produces: `LoginForm` 컴포넌트(props 없음) — Task 9(LoginPage)가 사용. `useLogin()` 훅: `{ mutate, isPending, isError, error }`(TanStack Query `useMutation` 반환값).

- [ ] **Step 1: `frontend/src/features/auth/model/use-login.ts` 생성 (테스트는 LoginForm을 통해 통합 검증한다 — 이 훅은 `loginRequest` + `setSession` 연결만 담당하는 얇은 래퍼라 별도 유닛 테스트 없이 Step 아래 LoginForm 테스트로 커버한다)**

```ts
import { useMutation } from '@tanstack/react-query'

import { useSessionStore } from '@/entities/session'

import { loginRequest } from '../api/login'

export interface LoginCredentials {
  email: string
  password: string
}

export function useLogin() {
  return useMutation({
    mutationFn: ({ email, password }: LoginCredentials) =>
      loginRequest(email, password),
    onSuccess: (data) => {
      useSessionStore.getState().setSession(data.accessToken, data.user)
    },
  })
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`frontend/src/features/auth/ui/LoginForm.test.tsx` 생성:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { axiosInstance } from '@/shared/api'
import { useSessionStore } from '@/entities/session'

import { LoginForm } from './LoginForm'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('@/shared/api', () => ({
  axiosInstance: { post: vi.fn() },
}))

function renderLoginForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <LoginForm />
    </QueryClientProvider>,
  )
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.mocked(axiosInstance.post).mockReset()
    navigateMock.mockReset()
    useSessionStore.getState().clearSession()
  })

  it('renders the email/password fields and submit button', () => {
    renderLoginForm()

    expect(screen.getByLabelText('이메일')).toBeInTheDocument()
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument()
  })

  it('shows client validation errors and does not call the API on empty submit', async () => {
    renderLoginForm()

    await userEvent.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByText('이메일을 입력해주세요')).toBeInTheDocument()
    expect(screen.getByText('비밀번호를 입력해주세요')).toBeInTheDocument()
    expect(axiosInstance.post).not.toHaveBeenCalled()
  })

  it('shows an email format error for an invalid address', async () => {
    renderLoginForm()

    await userEvent.type(screen.getByLabelText('이메일'), 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: '로그인' }))

    expect(
      await screen.findByText('올바른 이메일 형식이 아닙니다'),
    ).toBeInTheDocument()
    expect(axiosInstance.post).not.toHaveBeenCalled()
  })

  it('stores the session and navigates to / on success', async () => {
    vi.mocked(axiosInstance.post).mockResolvedValueOnce({
      data: {
        accessToken: 'token-1',
        user: { id: '1', name: '테스터', email: 'user@in2white.team' },
      },
    })

    renderLoginForm()

    await userEvent.type(screen.getByLabelText('이메일'), 'user@in2white.team')
    await userEvent.type(screen.getByLabelText('비밀번호'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: '로그인' }))

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/' }))
    expect(useSessionStore.getState().accessToken).toBe('token-1')
  })

  it('shows the server error message on 401 and does not navigate', async () => {
    vi.mocked(axiosInstance.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 401,
        data: {
          error: {
            message: '이메일 또는 비밀번호가 올바르지 않습니다',
            code: 'INVALID_CREDENTIALS',
          },
        },
      },
    })

    renderLoginForm()

    await userEvent.type(screen.getByLabelText('이메일'), 'user@in2white.team')
    await userEvent.type(screen.getByLabelText('비밀번호'), 'wrong-password')
    await userEvent.click(screen.getByRole('button', { name: '로그인' }))

    expect(
      await screen.findByText('이메일 또는 비밀번호가 올바르지 않습니다'),
    ).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
    expect(useSessionStore.getState().accessToken).toBeNull()
  })

  it('shows the fallback message when the request fails with no response', async () => {
    vi.mocked(axiosInstance.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: undefined,
    })

    renderLoginForm()

    await userEvent.type(screen.getByLabelText('이메일'), 'user@in2white.team')
    await userEvent.type(screen.getByLabelText('비밀번호'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: '로그인' }))

    expect(
      await screen.findByText(
        '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요',
      ),
    ).toBeInTheDocument()
  })

  it('disables the submit button while the request is pending', async () => {
    let resolveRequest: (value: unknown) => void = () => {}
    vi.mocked(axiosInstance.post).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )

    renderLoginForm()

    await userEvent.type(screen.getByLabelText('이메일'), 'user@in2white.team')
    await userEvent.type(screen.getByLabelText('비밀번호'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: '로그인' }))

    // 로딩 중에는 라벨이 "로그인 중..."으로 바뀌므로(§5 — 아이콘만 남기면 접근 가능한
    // 이름이 사라진다) name 필터 없이 폼의 유일한 버튼을 조회한다.
    const pendingButton = screen.getByRole('button')
    expect(pendingButton).toBeDisabled()
    expect(pendingButton).toHaveTextContent('로그인 중...')

    resolveRequest({
      data: {
        accessToken: 'token-1',
        user: { id: '1', name: '테스터', email: 'a@a.com' },
      },
    })
  })
})
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd frontend && pnpm test -- features/auth/ui/LoginForm.test`
Expected: FAIL(`./LoginForm` 모듈이 없음).

- [ ] **Step 4: `frontend/src/features/auth/ui/LoginForm.tsx` 생성**

```tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { MESSAGES } from '@/shared/constants/messages'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

import { useLogin } from '../model/use-login'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, MESSAGES.EMAIL_REQUIRED)
    .email(MESSAGES.EMAIL_INVALID_FORMAT),
  password: z.string().min(1, MESSAGES.PASSWORD_REQUIRED),
})

type LoginFormValues = z.infer<typeof loginSchema>

function getErrorMessage(error: unknown): string {
  // 백엔드 에러 핸들러(backend/src/middlewares/error-handler.middleware.ts)는
  // 모든 에러를 { error: { message, code } } 형태로 응답한다 — 최상위 message가 아니다.
  if (isAxiosError(error) && error.response) {
    const data = error.response.data as
      { error?: { message?: string } } | undefined
    if (data?.error?.message) {
      return data.error.message
    }
  }

  return MESSAGES.NETWORK_ERROR
}

export function LoginForm() {
  const navigate = useNavigate()
  const login = useLogin()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = (values: LoginFormValues) => {
    login.mutate(values, {
      onSuccess: () => {
        navigate({ to: '/' })
      },
    })
  }

  const formError = login.isError ? getErrorMessage(login.error) : null

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-full flex-col items-start gap-4"
      noValidate
    >
      <div className="flex w-full flex-col items-start gap-1">
        <label
          htmlFor="login-email"
          className="text-[14px] font-semibold leading-[1.429] tracking-[0.0145em] text-[var(--color-foreground-default)]"
        >
          이메일
        </label>
        <Input
          id="login-email"
          type="email"
          size="large"
          placeholder="you@in2white.team"
          aria-invalid={!!errors.email}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-[12px] text-[var(--color-status-danger)]">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="flex w-full flex-col items-start gap-1">
        <label
          htmlFor="login-password"
          className="text-[14px] font-semibold leading-[1.429] tracking-[0.0145em] text-[var(--color-foreground-default)]"
        >
          비밀번호
        </label>
        <Input
          id="login-password"
          type="password"
          size="large"
          placeholder="••••••••"
          aria-invalid={!!errors.password}
          {...register('password')}
        />
        {errors.password && (
          <p className="text-[12px] text-[var(--color-status-danger)]">
            {errors.password.message}
          </p>
        )}
      </div>

      {formError && (
        <p
          role="alert"
          className="w-full text-center text-[12px] text-[var(--color-status-danger)]"
        >
          {formError}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={login.isPending}
      >
        {login.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            로그인 중...
          </>
        ) : (
          '로그인'
        )}
      </Button>
    </form>
  )
}
```

`<label htmlFor>` 값이 각각 `login-email`/`login-password`인데 테스트는 `getByLabelText('이메일')`처럼 라벨 텍스트로 찾으므로 id 값 자체는 테스트에 영향 없다(React Testing Library가 `<label htmlFor>` ↔ `<input id>` 연결을 따라간다) — 두 `id`가 서로 다르기만 하면 된다.

- [ ] **Step 5: `frontend/src/features/auth/index.ts` 생성**

```ts
export { LoginForm } from './ui/LoginForm'
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd frontend && pnpm test -- features/auth/ui/LoginForm.test`
Expected: PASS(7개 테스트 모두 통과)

- [ ] **Step 7: lint 확인**

Run: `cd frontend && pnpm lint`
Expected: 에러 없음.

- [ ] **Step 8: Commit**

```bash
cd frontend
git add src/features/auth
git commit -m "feat: 로그인 폼(검증/제출/에러/로딩 상태) 구현"
```

---

## Task 9: pages/login/ui/LoginPage.tsx

**Files:**

- Create: `frontend/src/pages/login/ui/LoginPage.tsx`
- Create: `frontend/src/pages/login/ui/LoginPage.test.tsx`
- Create: `frontend/src/pages/login/index.ts`

**Interfaces:**

- Consumes: `LoginForm`(Task 8), `frontend/public/logo-mark.png`(Task 7).
- Produces: `LoginPage` 컴포넌트(props 없음) — Task 10(라우트)이 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/pages/login/ui/LoginPage.test.tsx` 생성:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'

import { LoginPage } from './LoginPage'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('@/shared/api', () => ({
  axiosInstance: { post: vi.fn() },
}))

function renderLoginPage() {
  const queryClient = new QueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <LoginPage />
    </QueryClientProvider>,
  )
}

describe('LoginPage', () => {
  it('renders the logo, tagline, form, and footer caption', () => {
    renderLoginPage()

    expect(screen.getByText('in2white')).toBeInTheDocument()
    expect(
      screen.getByText('팀의 화이트보드를 함께 그려요.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('이메일')).toBeInTheDocument()
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument()
    expect(
      screen.getByText('계정은 관리자가 미리 만들어 드려요.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        '로그인이 안 되면 워크스페이스 소유자에게 문의해 주세요.',
      ),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && pnpm test -- pages/login/ui/LoginPage.test`
Expected: FAIL(`./LoginPage` 모듈이 없음).

- [ ] **Step 3: `frontend/src/pages/login/ui/LoginPage.tsx` 생성**

```tsx
import { LoginForm } from '@/features/auth'

export function LoginPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-[var(--color-background-default)]">
      <div className="flex w-[336px] flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="" className="size-7 rounded-sm" />
            <p className="text-[20px] font-bold leading-[1.4] tracking-[-0.24px] text-[var(--color-foreground-strong)]">
              in2white
            </p>
          </div>
          <p className="text-[14px] font-medium leading-[1.429] tracking-[0.0145em] text-[var(--color-foreground-secondary)]">
            팀의 화이트보드를 함께 그려요.
          </p>
        </div>

        <div className="h-px w-full bg-[var(--color-border-subtle)]" />

        <LoginForm />

        <p className="text-center text-[12px] leading-[1.334] tracking-[0.0252em] text-[var(--color-foreground-tertiary)]">
          계정은 관리자가 미리 만들어 드려요.
          <br />
          로그인이 안 되면 워크스페이스 소유자에게 문의해 주세요.
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: `frontend/src/pages/login/index.ts` 생성**

```ts
export { LoginPage } from './ui/LoginPage'
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd frontend && pnpm test -- pages/login/ui/LoginPage.test`
Expected: PASS

- [ ] **Step 6: 전체 테스트 + lint 확인**

Run: `cd frontend && pnpm test && pnpm lint`
Expected: 모두 PASS/에러 없음.

- [ ] **Step 7: Commit**

```bash
cd frontend
git add src/pages/login
git commit -m "feat: 로그인 페이지(로고/태그라인/폼/footer) 조합"
```

---

## Task 10: 라우트 인증 가드 및 전역 세션 복원

**Files:**

- Create: `frontend/src/routes/login.tsx`
- Create: `frontend/src/features/auth/model/route-guards.ts`
- Create: `frontend/src/routes/root.test.tsx`
- Delete: `frontend/src/routes/login.test.tsx` (루트 전역 가드 테스트로 통합)
- Modify: `frontend/src/routes/__root.tsx`
- Modify: `frontend/src/routes/index.tsx`

**Interfaces:**

- Consumes: `LoginPage`(Task 9), `useSessionStore`(Task 5), `refreshAccessToken()`(Task 10-A).
- Produces: `Route`(TanStack Router 파일 라우트), `redirectIfUnauthenticated()` 비동기 전역 가드. 모든 경로에서 메모리 세션을 확인하고, 없거나 만료된 경우 refresh를 시도한다. `/login`은 유효한 세션이면 `/`로 redirect한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/routes/root.test.tsx`에 전역 가드 테스트를 작성한다:

```tsx
import { useSessionStore } from '@/entities/session'

import { redirectIfUnauthenticated } from './__root'

const mockRefreshAccessToken = vi.fn()

vi.mock('@/features/auth/model/auth-session', () => ({
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
}))

const user = { id: '1', name: '테스터', email: 'user@in2white.team' }

function createToken(exp: number) {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '')

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp })}.signature`
}

describe('redirectIfUnauthenticated', () => {
  afterEach(() => {
    useSessionStore.getState().clearSession()
    mockRefreshAccessToken.mockReset()
  })

  it('allows the login route when refresh fails', async () => {
    mockRefreshAccessToken.mockRejectedValueOnce(new Error('no refresh cookie'))

    await expect(
      redirectIfUnauthenticated({ location: { pathname: '/login' } }),
    ).resolves.toBeUndefined()
  })

  it('restores a missing session before allowing a protected route', async () => {
    mockRefreshAccessToken.mockImplementationOnce(async () => {
      useSessionStore.getState().setSession(createToken(2_000_000_000), user)
      return 'restored-token'
    })

    await expect(
      redirectIfUnauthenticated({ location: { pathname: '/' } }),
    ).resolves.toBeUndefined()
  })

  it('redirects a logged-in session away from the login route', async () => {
    useSessionStore.getState().setSession(createToken(2_000_000_000), user)

    await expect(
      redirectIfUnauthenticated({ location: { pathname: '/login' } }),
    ).rejects.toMatchObject({ options: { to: '/' } })
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && pnpm test -- routes/root.test`
Expected: FAIL(세션 복원 및 로그인 경로 redirect가 아직 구현되지 않음).

- [ ] **Step 3: `frontend/src/routes/login.tsx` 생성**

```tsx
import { createFileRoute } from '@tanstack/react-router'

import { LoginPage } from '@/pages/login'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})
```

`frontend/src/routes/__root.tsx`는 `beforeLoad: redirectIfUnauthenticated`를 설정해 앱의 모든 경로에서 세션 복원과 접근 제어를 수행한다. `frontend/src/routes/login.tsx`에는 별도 인증 가드를 두지 않고 루트 가드에 위임한다. `frontend/src/routes/index.tsx`는 같은 공통 가드를 명시적으로 연결하며, guard 단위 테스트는 다음을 검증한다.

- accessToken/user가 없으면 refresh 성공 후 세션을 복원한다.
- 보호 경로에서 refresh 실패 시 세션을 비운 뒤 `/login`으로 redirect한다.
- `/login`에서 유효한 세션 또는 refresh 성공 세션은 `/`로 redirect하고, refresh 실패 시 로그인 페이지 진입을 허용한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && pnpm test -- routes/root.test routes/index.test`
Expected: PASS

이 라우트 파일이 새로 생기면 `@tanstack/router-plugin`이 다음 `pnpm dev`/`pnpm build` 실행 시 `src/routeTree.gen.ts`를 자동 갱신한다(수동 편집 금지 파일, `.gitignore`/eslint에 이미 제외 설정됨).

- [ ] **Step 5: 라우트 트리 생성 확인을 겸한 빌드 체크**

Run: `cd frontend && pnpm build`
Expected: 에러 없이 빌드 완료(`src/routeTree.gen.ts`에 `/login` 라우트가 추가됨).

- [ ] **Step 6: 전체 테스트 + lint 확인**

Run: `cd frontend && pnpm test && pnpm lint`
Expected: 모두 PASS/에러 없음.

- [ ] **Step 7: Commit**

```bash
cd frontend
git add src/routes/login.tsx src/routes/root.test.tsx src/routes/__root.tsx src/routes/index.tsx src/features/auth/model/route-guards.ts src/routeTree.gen.ts
git commit -m "feat: restore auth session on route loading"
```

---

## Task 10-A: 앱 전역 인증 세션 및 로그아웃

로그인 라우트만 보호하는 것으로 끝내지 않고, 백엔드 refresh token 계약을 앱 전역 Axios 요청과 로그아웃 흐름에 연결한다.

**Files:**

- Create: `frontend/src/features/auth/api/session.ts`
- Create: `frontend/src/features/auth/model/auth-session.ts`
- Create: `frontend/src/features/auth/model/auth-interceptor.ts`
- Modify: `frontend/src/features/auth/index.ts`
- Modify: `frontend/src/app/App.tsx`
- Modify: `frontend/src/pages/home/ui/HomePage.tsx`
- Create/Modify: `frontend/src/features/auth/model/auth-session.test.ts`, `auth-interceptor.test.ts`, `frontend/src/pages/home/ui/HomePage.test.tsx`

**Interfaces and behavior:**

- `refreshAccessTokenRequest()`는 body 없이 `POST /auth/refresh`를 호출하고 httpOnly refresh token 쿠키로 `{ accessToken, user }`를 받는다. `logoutRequest()`는 `POST /auth/logout`을 호출한다. Axios instance의 `withCredentials: true` 설정을 사용한다.
- `refreshAccessToken()`은 동시 요청을 하나의 Promise로 합치는 single-flight coordinator다. 성공하면 `setSession(accessToken, user)`로 accessToken/user를 함께 저장한다. refresh 실패는 자동 재시도하지 않는다.
- Axios 요청 인터셉터는 로그인/refresh 요청을 제외하고, 보호 요청 직전에 만료 accessToken을 refresh한다. 보호 API가 401을 반환하면 refresh 후 원래 요청을 정확히 한 번만 재시도하며, 재시도 401 또는 refresh 실패 시 세션을 비우고 `/login` 이동 콜백을 호출한다. `_authRetry`로 무한 재시도를 막는다.
- `App.tsx`는 Axios 인증 인터셉터를 한 번 초기화하고, 세션 만료 콜백을 TanStack Router의 `router.navigate({ to: '/login', replace: true })`에 연결한다. `/auth/login`의 401은 전역 세션 만료 처리에서 제외한다.
- `HomePage`의 로그아웃은 API 성공/실패와 관계없이 client session을 비우고 `/login`으로 이동한다. 세션 없는 `HomePage`는 로그인 안내를 렌더링하지 않고 null을 반환한다.

**Tests:**

- refresh API의 body/응답 계약(`accessToken`, `user`)과 logout API 호출을 검증한다.
- 동시 refresh가 한 번만 실행되고, 실패가 재시도되지 않는지 검증한다.
- 요청 전 만료 refresh, 보호 API 401의 1회 재시도, refresh 실패, 재시도 후 401, 로그인 401 제외를 검증한다.
- 로그아웃 API 성공/실패 모두 clearSession과 `/login` 이동이 실행되는지 검증한다.

---

## Task 11: 수동 시각 검증 (Figma 대조)

자동 테스트로 검증할 수 없는 시각적 정확성을 개발 서버에서 직접 확인한다.

- [ ] **Step 1: 개발 서버 실행**

Run: `cd frontend && pnpm dev`

- [ ] **Step 2: 브라우저에서 `/login` 접속 후 Figma `Login (Alt)` 프레임과 대조**

확인 항목:

- 로고 마크 + "in2white" + 태그라인이 중앙 정렬로 표시된다.
- divider 아래 이메일/비밀번호 라벨+입력창(44px 높이, 12px radius)이 보인다.
- "로그인" 버튼이 검정 배경/흰 글씨로 전체 너비를 채운다.
- footer 안내 문구 두 줄이 보인다.
- 빈 값으로 제출 시 필드 아래 빨간 에러 문구가 뜬다.
- 이메일/비밀번호를 채우고 제출하면(실제 백엔드가 떠 있다면) 로딩 스피너가 잠깐 보이고 성공 시 `/`로 이동하거나, 틀린 자격증명이면 폼 하단에 에러 문구가 뜬다.

- 로그인 후 새로고침해도 유효한 refresh token 쿠키로 세션이 복원되어 원래 화면이 유지된다.
- 만료된 accessToken과 유효한 refresh token 쿠키로 보호 경로에 접근하면 refresh 후 원래 화면이 유지된다.
- refresh token이 만료되었거나 무효하면 `/login`으로 이동하고, 브라우저 뒤로가기나 다른 보호 경로 접근으로 다시 보호 화면에 들어갈 수 없다.
- 로그아웃하면 `/auth/logout` 호출 결과와 관계없이 `/login`으로 이동하고, 보호 경로 접근이 차단된다.

- [ ] **Step 3: 브라우저 뒤로가기로 가드 확인**

로그인 성공 후 브라우저 뒤로가기 또는 주소창 입력으로 `/login`에 접근하면 즉시 `/`로 다시 리다이렉트되는지 확인한다. 로그아웃 또는 refresh 실패 후에는 `/login`에 머물고 보호 경로로 돌아갈 수 없는지 확인한다.

이 Task는 코드 변경이나 커밋이 없다 — 확인 전용이다.
