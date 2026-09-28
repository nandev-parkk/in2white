# 화이트보드 편집기 저장 상태 배지 구현 계획

Refs: #85
설계: `docs/superpowers/specs/2026-09-28-save-status-badge-design.md`

## 목표

편집기 헤더의 저장 상태 표시 다섯 가지를 `Badge` 기반 pill 하나로 통일하고 `저장됨`을 `저장 완료`로 바꾼다. 같은 형태를 Figma 디자인 시스템에도 반영한다.

## 작업 단계

### 1. 상태 배지 (TDD)

1. `shared/ui/canvas-top-bar.test.tsx`를 먼저 갱신해 실패를 확인한다.
   - `saved`: 라벨 `저장 완료`, 배지 `data-semantic="success"`
   - `saving`: 라벨 `저장 중`, `data-semantic="neutral"`
   - `connecting`: 라벨 `연결 중`, `data-semantic="neutral"`
   - `disconnected`: 라벨 `동기화가 끊겼어요`, `data-semantic="danger"`
   - `error`: 라벨 `저장 상태 확인 필요`, `data-semantic="danger"`
   - `저장됨`이라는 문구가 더 이상 나오지 않는다.
   - 배지에 `role="status"` `aria-live="polite"`가 있고 아이콘은 `aria-hidden`이다.
   - `saveStatus`를 주지 않으면 배지가 렌더되지 않는다.
2. `shared/ui/canvas-top-bar.tsx`를 수정한다.
   - `saveStatusConfig`에 `semantic` 필드를 추가하고 상태별 `className` 필드를 제거한다.
   - 상태 표시를 `Badge`로 감싸고 `role="status"` `aria-live="polite"`를 배지에 둔다.
   - 상태별 아이콘 크기 분기와 `saved` 전용 색 지정을 제거한다. `Spinner`에는 `size-3`을 명시한다.
   - 아이콘에 `aria-hidden="true"`를 유지한다.
3. `shared/ui/canvas-top-bar.stories.tsx`의 상태 라벨 분기를 새 라벨로 갱신하고 다섯 상태 스토리를 확인한다.

### 2. 검증

4. `pnpm test`로 전체 테스트를 실행한다. `features/whiteboard-editor` 쪽 테스트가 라벨에 의존하면 함께 갱신한다.
5. `pnpm lint`, `pnpm build`를 실행한다.
6. 브라우저에서 편집기 헤더의 저장 완료·저장 중·연결 끊김 표시를 확인한다.

### 3. Figma 반영

7. `figma-use` 스킬을 먼저 읽고 진행한다.
8. in2white Design System에서 저장 상태 표시와 편집기 헤더 시안 노드를 찾는다.
9. 파일에 이미 있는 Badge 컴포넌트를 재사용해 다섯 상태 배지를 배치한다. 새 컴포넌트는 만들지 않는다.
10. 갱신한 노드 링크를 이 문서의 Implementation Results에 기록한다.

## 주요 동작

| 상태 | 라벨 | semantic |
| --- | --- | --- |
| `saved` | 저장 완료 | success |
| `saving` | 저장 중 | neutral |
| `connecting` | 연결 중 | neutral |
| `disconnected` | 동기화가 끊겼어요 | danger |
| `error` | 저장 상태 확인 필요 | danger |

아이콘 크기는 `Badge`의 `[&_svg]:size-3`으로 모든 상태에서 같아진다.

## 변경 범위

- 수정: `frontend/src/shared/ui/canvas-top-bar.tsx`, `canvas-top-bar.test.tsx`, `canvas-top-bar.stories.tsx`
- Figma: in2white Design System의 저장 상태·편집기 헤더 시안
- 유지: `SaveStatus` 타입과 `WhiteboardCanvas.tsx`가 넘기는 `editor.status`

## 권한·오류 계약

- 저장·동기화 로직과 재연결 정책은 바꾸지 않는다.
- `disconnected`와 `error`는 계속 위험색으로 남아 경고 강도를 유지한다.

## 검증 계획

- 다섯 상태 라벨·semantic 테스트와 접근성 속성 테스트
- 기존 참여자 아바타 테스트 무수정 통과
- `pnpm test` / `pnpm lint` / `pnpm build`
- 브라우저 헤더 상태 확인
- Figma 시안 갱신 확인

## Implementation Results

### 실제 변경 내용

- `frontend/src/shared/ui/canvas-top-bar.test.tsx`: TDD로 먼저 갱신했다. 다섯 상태의 라벨과 `data-semantic` 검증, `저장됨` 미노출 검증, 배지의 `role="status"`·`aria-live="polite"`와 아이콘 `aria-hidden` 검증, `saveStatus` 미지정 시 배지 미렌더 검증을 `it.each`로 추가했다. 기존 참여자 아바타 테스트는 수정하지 않았다.
- `frontend/src/shared/ui/canvas-top-bar.tsx`: `saveStatusConfig`에 `semantic` 필드를 추가하고 상태별 `className` 필드를 제거했다. 상태 표시를 `shared/ui/badge.tsx`의 `Badge`로 교체하고 `role="status"` `aria-live="polite"`를 배지에 두었다. 상태별 `size-5`/`size-3.5` 분기와 `saved` 전용 `text-status-success` 지정을 삭제했고, 아이콘에는 `size-3`을 명시해 `Spinner`의 `animate-spin`·`motion-reduce:animate-none`을 유지했다. 아이콘의 `aria-hidden="true"`, `saveStatus` 미지정 시 숨김, `saved`/`saving`에서만 아바타 표시 동작은 그대로 두었다.
- `frontend/src/shared/ui/canvas-top-bar.stories.tsx`: 라벨 삼항 분기를 `SAVE_STATUS_LABELS` 맵으로 바꿔 새 라벨을 반영하고, 토글 버튼·`argTypes` 옵션·스토리를 다섯 상태(`connecting`, `error` 추가) 모두로 확장했다.
- `SaveStatus` 타입, `WhiteboardCanvas.tsx`가 넘기는 `editor.status`, `use-whiteboard-editor.ts`의 저장·동기화 로직은 건드리지 않았다.

### 계획과 달라진 점

- 아이콘 `size-3`을 `Spinner`에만 조건부로 주는 대신 단일 `StatusIcon` 렌더에 일괄로 주었다. 상태별 분기를 되살리지 않기 위한 선택이며, `Badge`의 `[&_svg]:size-3`과 값이 같아 `CircleCheck`·`CircleAlert`에는 결과 차이가 없다.
- `Badge`는 기본 `gap`이 없어 아이콘과 라벨이 붙으므로 `className="gap-1.5"`만 덧붙였다. 기존 헤더의 간격을 유지하기 위한 로컬 오버라이드이고 `Badge` 자체나 다른 사용처는 바꾸지 않았다.
- 스토리의 라벨 분기를 단순 치환하지 않고 상태→라벨 맵으로 정리했다. 다섯 상태를 모두 다루면서 삼항 중첩을 늘리지 않기 위한 정리이며, 공용 상수 파일로 빼는 작업(#83)은 하지 않았다.
- `features/whiteboard-editor` 쪽에 라벨 문구를 단정하는 테스트는 없어 갱신 대상이 없었다. `model/scene-sync.test.ts`의 테스트 제목에 나오는 `저장됨`은 UI 라벨이 아니라 내부 상태를 가리키는 서술이라 그대로 두었다.

### 실행한 검증 명령과 결과

- `pnpm vitest run src/shared/ui/canvas-top-bar.test.tsx` (구현 전, 실패 확인): 11 failed | 6 passed (17). 배지 미존재·`저장됨` 노출·`role="status"`가 배지가 아님이라는 의도한 이유로 실패했다.
- `pnpm test`: 통과. Test Files 76 passed (76), Tests 428 passed (428).
- `pnpm lint`: 통과. 0 errors, 4 warnings. 네 경고는 모두 기존 `react-refresh/only-export-components`(`badge.tsx`, `button.tsx`, `input.tsx`, `toast.tsx`)로 이번 변경과 무관하다.
- `pnpm build`: 통과 (`✓ built in 1.55s`). 청크 크기 경고는 기존과 동일하다.

### 남은 후속 작업

- 브라우저에서 편집기 헤더의 저장 완료·저장 중·연결 끊김 배지를 눈으로 확인하는 절차(계획 6단계)는 아직 실행하지 않았다.
- `Spinner`의 기본 색인 `text-foreground-strong`이 배지 텍스트 색보다 우선해 neutral 배지에서 스피너만 약간 더 진하게 보인다. 색 통일이 필요하면 별도로 다룬다.
- 저장 상태 라벨 문구의 공용 상수화는 #83에서 다룬다.

### Figma 반영

in2white Design System(`Dimhltnal74SHy2NcLz1Lf`)의 두 페이지를 모두 갱신했다. 새 컴포넌트는 만들지 않고 기존 `Badge` 컴포넌트셋(`36:16`)의 스펙을 `save-status` 프레임에 그대로 옮겼다.

적용한 스펙 — auto-layout HORIZONTAL, padding `spacing/4`·`spacing/8`, radius `radius/sm`, itemSpacing 6, 아이콘 12px, 텍스트는 기존 caption 스타일 유지.

| 상태 | 라벨 | 배경 변수 | 전경 변수 |
| --- | --- | --- | --- |
| 저장 완료 | 저장 완료 | `color/status/success-subtle-bg` | `color/status/success` |
| 저장 중 | 저장 중 | `color/background/subtle` | `color/foreground/default` |
| 동기화 끊김 | 동기화가 끊겼어요 | `color/status/danger-subtle-bg` | `color/status/danger` |

- Components 페이지(`38:2`) — `Canvas Top Bar` 프레임(`51:34`)의 예시 3종 `51:21`·`231:173`·`231:193`. 예시 프레임 이름을 `— 저장 완료`로 바꾸고 문서 텍스트(`51:15`)에 배지 규칙과 상태별 semantic을 추가했다.
- v1.0 페이지(`84:2`) — `save-status` 6곳 `231:4396`·`231:4454`·`231:4503`·`231:4535`·`424:4334`·`425:4697`. 로딩 목업에 숨겨져 있는 뒤 3곳도 같이 갱신했다. `Canvas 저장됨` 프레임 이름은 `Canvas 저장 완료`로 바꿨다.
- `Spinner` 인스턴스는 `resize()`만으로는 자식 원이 20px로 남아 라벨과 겹쳐서, `rescale(0.6)`으로 자식까지 12px로 줄였다.
- Components 페이지 스크린샷으로 세 배지가 같은 높이(24px)·같은 radius·같은 아이콘 크기로 정렬되는 것을 확인했다.
- Figma의 Canvas Top Bar 예시는 기존대로 3종만 유지했다. 코드의 `connecting`·`error` 두 상태는 예시 프레임이 원래 없었고, 문서 텍스트에 semantic 매핑만 기록했다.
