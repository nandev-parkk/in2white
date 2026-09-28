# shared 계층 경계 회복 설계

- 날짜: 2026-09-28
- 관련: #94 (본 작업), #93 (sidebar 분리), #83 (문구 사전 도입)

## 목표

`shared`가 도메인을 모르는 상태로 되돌리고, 다시 섞이지 않게 막는다.

## 문제

#83에서 문구를 사전으로 모으는 과정에 `shared/ui`의 도메인 의존이 드러났다.

| 파일 | 실제 소속 | 앱 내 사용처 |
| --- | --- | --- |
| `shared/ui/canvas-top-bar.tsx` | 화이트보드 에디터 | `WhiteboardCanvas`, `WhiteboardEditorPage` |
| `shared/ui/user-picker.tsx` | 멤버 | `MemberAddDialog` |
| `shared/ui/app-shell-header.tsx` | 프로젝트 문구에 의존 | 없음 |
| `shared/ui/sidebar.tsx` | 앱 셸 위젯 | `AuthenticatedWorkspaceLayout` |

`shared`는 도메인을 몰라야 한다는 약속이 깨져 있으면, 다음 사람이 같은 자리에 또 도메인 코드를 넣는다.

## 핵심 판단: lint 규칙만으로는 못 막는다

계층 위반 import를 전수 조사했다. 저장소 전체에 **1건**이었다.

```text
shared/ui/sidebar.tsx:16  import type { WorkspaceSummary } from '@/entities/workspace'
```

정작 문제였던 `canvas-top-bar`·`user-picker`는 `shared` 안에서만 import한다. 이들이 도메인에 묶이는 경로는 import가 아니라 **`MESSAGES.whiteboard`·`MESSAGES.member` 같은 속성 접근**이다. `no-restricted-imports`는 속성 접근을 보지 못한다.

즉 애초에 계획했던 계층 lint 규칙을 그때 켰더라도 이 문제는 통과했을 것이다. 그래서 장치를 두 개로 나눈다.

| 장치 | 막는 것 | 한계 |
| --- | --- | --- |
| `eslint.config.js`의 계층 규칙 | 상위 계층을 향하는 import | 속성 접근을 못 본다 |
| `src/architecture.test.ts` | `shared`의 도메인 사전 참조 | import 방향은 보지 않는다 |

둘을 합쳐야 경계가 닫힌다.

## 설계

### 계층 방향 규칙

의존은 한 방향으로만 흐른다.

```text
app → pages → features → entities → shared
```

내장 `no-restricted-imports`로 표현한다. 새 dependency를 넣지 않는다. `eslint-plugin-boundaries`는 기능이 더 많지만, 이 저장소의 계층이 5개로 고정돼 있어 얻는 게 없다.

`import type`도 막는다. 타입만 가져와도 계층 결합은 생긴다.

### 도메인 사전 참조 규칙

`shared`는 `MESSAGES.common`과 `MESSAGES.validation`까지만 안다. 나머지 도메인 묶음을 짚으면 테스트가 실패한다.

허용 목록은 `src/architecture.test.ts`에 경로로 명시한다. 목록에 없는 위반은 실패다. #83의 `messages.test.ts`가 쓰는 `intentional` 허용 목록과 같은 방식이라 읽는 사람이 새로 배울 게 없다.

허용 목록이 낡는 것도 막는다. 이미 정리된 파일이 목록에 남아 있으면 별도 테스트가 실패한다.

### 파일 배치

`features/*/ui`는 PascalCase를 쓴다. `shared/ui`는 kebab-case를 쓴다. 옮길 때 개명한다. Storybook `title`도 `Features/...`로 맞춘다. `features/auth/ui/LoginForm.stories.tsx`가 선례다.

## 범위

### 이번에 한다

- `canvas-top-bar` → `features/whiteboard-editor/ui/CanvasTopBar`
- `user-picker` → `features/member/ui/UserPicker`
- `app-shell-header`의 `searchPlaceholder` 기본값에서 도메인 의존 제거
- 두 장치 추가

### 하지 않는다

- **`sidebar.tsx` 이동.** 도메인 사전을 20곳 넘게 참조하고 파일이 870줄이다. 목적지도 결정이 필요하다. FSD라면 `widgets` 계층이고 `pages/shared/ui`도 후보다. #93으로 분리한다.

> 정정(#93): 이 문단은 처음에 "`widgets` 계층이지만 이 저장소에는 없고"라고 적었다.
> 사실이 아니다. `src/widgets/.gitkeep`이 추적되고 있었고 `frontend/README.md`가 계층을
> 문서화하고 있었다. #93은 `widgets/sidebar`를 목적지로 택했다.

- **`app-shell-header.tsx` 삭제.** 앱에서 쓰이지 않지만 `brand-assets.test.tsx`가 로고 검증의 발판으로 쓴다. 죽은 코드 정리는 성격이 다른 작업이다.

## 오류 계약

동작 변경 없음. 파일 위치와 import 경로만 바뀐다. 단 `AppShellHeader`의 `searchPlaceholder`가 선택에서 필수로 바뀐다. 앱 내 사용처가 없어 런타임 영향은 없고, 타입 검사가 누락을 잡는다.

## 검증 계획

- `npx vitest run` — 기존 440건 + 신규 3건
- 신규 테스트의 red 확인: `shared` 파일에 도메인 참조를 심어 실패를 본 뒤 원복
- 계층 규칙의 red 확인: `shared` 파일에 `@/entities` import를 심어 error를 본 뒤 원복
- `pnpm lint` exit 0, `pnpm build` exit 0
