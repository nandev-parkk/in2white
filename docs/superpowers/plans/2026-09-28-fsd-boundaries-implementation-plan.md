# shared 계층 경계 회복 구현 계획

- 날짜: 2026-09-28
- 설계: `docs/superpowers/specs/2026-09-28-fsd-boundaries-design.md`
- 관련: #94 (본 작업), #93 (sidebar 분리)

## 단계

### 1. 파일 이동

`git mv`로 6개 파일을 옮기고 PascalCase로 개명한다.

| 이전 | 이후 |
| --- | --- |
| `shared/ui/canvas-top-bar.tsx` | `features/whiteboard-editor/ui/CanvasTopBar.tsx` |
| `shared/ui/canvas-top-bar.test.tsx` | `features/whiteboard-editor/ui/CanvasTopBar.test.tsx` |
| `shared/ui/canvas-top-bar.stories.tsx` | `features/whiteboard-editor/ui/CanvasTopBar.stories.tsx` |
| `shared/ui/user-picker.tsx` | `features/member/ui/UserPicker.tsx` |
| `shared/ui/user-picker.test.tsx` | `features/member/ui/UserPicker.test.tsx` |
| `shared/ui/user-picker.stories.tsx` | `features/member/ui/UserPicker.stories.tsx` |

import 경로 5곳과 Storybook `title` 2곳을 고친다. 같은 폴더 안에서 쓰는 쪽은 상대 경로로 바꾼다.

### 2. `app-shell-header` 의존 제거

`searchPlaceholder`의 기본값 `MESSAGES.project.form.searchLabel`을 없애고 필수 prop으로 바꾼다. 스토리 `args`와 `brand-assets.test.tsx`에 문구를 넘긴다.

새 문구를 만들지 않는다. 공용 컴포넌트가 검색 대상을 모르는 게 맞다.

### 3. 불변식 테스트

`src/architecture.test.ts`를 새로 만든다. 3건이다.

1. `shared`는 도메인 사전을 참조하지 않는다 — 허용 목록 제외
2. 허용 목록에 이미 정리된 파일을 남겨두지 않는다
3. 옮긴 두 컴포넌트가 이전 위치에 없고 새 위치에 있다

도메인 목록은 `Object.keys(MESSAGES)`에서 뽑는다. 사전에 도메인이 추가되면 검사 범위가 자동으로 늘어난다.

### 4. 계층 lint 규칙

`eslint.config.js`에 `layerRules()` 헬퍼를 더해 계층별 `no-restricted-imports` 블록을 만든다. `SIDEBAR_EXCEPTIONS`에 #93 대상 4개 파일을 명시한다.

### 5. 검증

red 확인을 포함한다. 장치를 넣었다는 사실만으로는 작동을 보장하지 못한다.

## 위험

| 위험 | 대응 |
| --- | --- |
| import 누락 | 타입 검사와 빌드가 잡는다 |
| 허용 목록이 부채를 숨긴다 | 낡은 항목을 잡는 테스트를 함께 둔다. 목록 항목마다 이슈 번호를 주석으로 남긴다 |
| 계층 규칙이 정작 원인을 못 막는다 | 설계에서 확인한 한계다. 불변식 테스트로 보완한다 |

## 커밋 계획

1. `refactor: 도메인 전용 컴포넌트를 feature 계층으로 이동` (1-2)
2. `test: shared 계층의 도메인 의존을 막는 불변식 추가` (3)
3. `build: FSD 계층 방향을 lint 규칙으로 고정` (4)

## 구현 결과

### 실제 변경

- 이동 6개 파일, 수정 8개 파일(`WhiteboardCanvas`, `WhiteboardEditorPage`, `MemberAddDialog`, `app-shell-header` 3종, `eslint.config.js`, 이동한 파일들의 자기 참조)
- 신규 `frontend/src/architecture.test.ts` (3건)
- 신규 문서 2개

### 계획과 달라진 점

| 항목 | 계획 | 실제 | 이유 |
| --- | --- | --- | --- |
| 장치 구성 | 계층 lint 규칙만 | lint 규칙 + 불변식 테스트 | 조사 결과 계층 위반 import가 1건뿐이고, 정작 문제인 두 파일은 속성 접근으로 도메인에 묶여 있었다. lint 규칙만으로는 재발을 못 막는다. |
| `app-shell-header` | 대상 아님 | `searchPlaceholder` 필수화 | 불변식 테스트를 켜려면 이 파일의 `MESSAGES.project` 의존을 먼저 끊어야 했다. 삭제하지 않고 prop으로 올렸다. |
| `sidebar` | 언급 없음 | 허용 목록 + lint 예외로 부채 명시 | 도메인 사전 참조가 20곳이 넘고 파일이 870줄이다. #93으로 분리했다. |

### 실행한 검증

| 명령 | 결과 |
| --- | --- |
| `npx vitest run` | 80파일 443건 통과 (기존 440 + 신규 3) |
| `pnpm lint` | exit 0, 경고 4건 (기존 `react-refresh`) |
| `pnpm build` | exit 0 |

red 확인도 했다.

- `shared/ui/spinner.tsx`의 `MESSAGES.common.a11y.loading`을 `MESSAGES.project.a11y.loading`으로 바꾸자 `expected [ 'shared/ui/spinner.tsx' ] to deeply equal []`로 실패했다. 원복 후 통과.
- 같은 파일에 `import type { Project } from '@/entities/project'`를 넣자 `no-restricted-imports` error가 났다. 원복 후 통과.

### 남은 후속 작업

- #93 `sidebar`를 `shared/ui` 밖으로 옮기고 두 예외 목록을 지운다.
- `app-shell-header.tsx`는 앱에서 쓰이지 않는다. `brand-assets.test.tsx`를 다른 발판으로 바꾸고 삭제할지 결정한다.
- `features/member`·`features/whiteboard-editor`에는 배럴(`index.ts`)이 없어 깊은 경로로 import한다. 다른 5개 피처와 다르다. 통일할지 결정한다.
