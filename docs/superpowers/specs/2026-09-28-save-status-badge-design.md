# 화이트보드 편집기 저장 상태 배지 설계

Refs: #85

## 목표

화이트보드 편집기 헤더의 저장 상태 표시를 상태별로 다른 형태가 아니라 하나의 배지 형태로 통일한다. `저장됨` 라벨은 `저장 완료`로 바꾼다. 같은 변경을 Figma 디자인 시스템에도 반영해 코드와 시안이 갈라지지 않게 한다.

## 현재 상태

`shared/ui/canvas-top-bar.tsx`의 `saveStatusConfig`가 상태마다 다른 시각 규칙을 갖는다.

| 상태 | 라벨 | 아이콘 | 크기 | 색 |
| --- | --- | --- | --- | --- |
| `saved` | 저장됨 | `CircleCheck` | `size-3.5` | 아이콘만 성공색, 텍스트는 회색 |
| `saving` | 저장 중... | `Spinner` | `size-5` | 전체 회색 |
| `connecting` | 연결 중... | `Spinner` | `size-5` | 전체 회색 |
| `disconnected` | 동기화가 끊겼어요 | `CircleAlert` | `size-3.5` | 아이콘과 텍스트 모두 위험색 |
| `error` | 저장 상태 확인 필요 | `CircleAlert` | `size-3.5` | 아이콘과 텍스트 모두 위험색 |

아이콘 크기가 두 종류이고, 색 적용 범위가 상태마다 달라 헤더에서 세 가지 다른 표현으로 보인다.

## 확정된 동작

- 다섯 상태를 배경 tint가 있는 pill 배지 하나로 통일한다. 새 스타일을 만들지 않고 이미 있는 `shared/ui/badge.tsx`의 `Badge`를 재사용한다. `Badge`는 `bg-status-*-subtle-bg` + `text-status-*` 조합과 `rounded-sm px-2 py-1`, `text-caption`, `[&_svg]:size-3`을 이미 제공한다.

| 상태 | 라벨 | 아이콘 | `Badge` semantic |
| --- | --- | --- | --- |
| `saved` | 저장 완료 | `CircleCheck` | `success` |
| `saving` | 저장 중 | `Spinner` | `neutral` |
| `connecting` | 연결 중 | `Spinner` | `neutral` |
| `disconnected` | 동기화가 끊겼어요 | `CircleAlert` | `danger` |
| `error` | 저장 상태 확인 필요 | `CircleAlert` | `danger` |

- 아이콘 크기는 `Badge`의 `[&_svg]:size-3` 규칙에 맡겨 모든 상태에서 동일해진다. `canvas-top-bar.tsx`에 있던 상태별 `size-5`/`size-3.5` 분기와 `saved` 전용 색 지정을 제거한다.
- `Spinner`에는 `size-3`을 명시해 `animate-spin`과 `motion-reduce:animate-none`은 유지하고 크기만 배지에 맞춘다.
- 라벨의 말줄임표를 없앤다. `저장 중...` → `저장 중`, `연결 중...` → `연결 중`. 배지 형태에서는 진행 중임을 스피너가 이미 알리고, 다른 상태 라벨과 문장 형태가 어긋난다.
- `Badge`는 `span`이므로 `role="status"` `aria-live="polite"`를 배지 자체에 두고, 아이콘에는 `aria-hidden="true"`를 유지한다. 라벨만 읽히도록 현재 계약을 지킨다.
- `saveStatus`가 없을 때 배지를 숨기는 현재 동작과, `saved`/`saving`에서만 참여자 아바타를 보여주는 현재 동작은 그대로 둔다.

## Figma 반영

- 대상 파일: [in2white Design System](https://www.figma.com/design/Dimhltnal74SHy2NcLz1Lf/in2white)
- `Components`의 저장 상태 표시와 화이트보드 편집기 헤더 시안을 위 배지 형태와 라벨로 갱신한다. 배지는 파일에 이미 있는 Badge 컴포넌트를 재사용하고 새 컴포넌트를 만들지 않는다.
- 다섯 상태를 모두 보여주는 시안을 남겨 코드의 `saveStatusConfig`와 1:1로 대응시킨다.

## 범위

- 수정: `frontend/src/shared/ui/canvas-top-bar.tsx`, `canvas-top-bar.test.tsx`, `canvas-top-bar.stories.tsx`
- Figma: in2white Design System의 저장 상태·편집기 헤더 시안
- 유지: `features/whiteboard-editor/ui/WhiteboardCanvas.tsx`가 넘기는 `editor.status` 값과 `SaveStatus` 타입

## 권한·오류 계약

- 저장·동기화 로직은 건드리지 않는다. `use-whiteboard-editor.ts`의 상태 전이와 재연결 동작은 그대로다.
- `disconnected`와 `error`는 계속 위험색으로 남아 사용자가 변경이 아직 안전하지 않다는 사실을 놓치지 않게 한다. 표현만 배지로 바뀌고 경고 강도는 낮추지 않는다.

## 검증 계획

- 다섯 상태 각각에서 라벨과 `Badge` semantic이 맞는지 테스트한다. `저장 완료` 라벨과 `저장됨`이 더 이상 나오지 않는 것을 확인한다.
- `role="status"` `aria-live="polite"`가 유지되고 아이콘이 접근성 트리에서 제외되는지 확인한다.
- 기존 참여자 아바타 테스트가 그대로 통과하는지 확인한다.
- `pnpm test`, `pnpm lint`, `pnpm build`를 실행한다.
- 브라우저에서 편집기 헤더의 저장 완료·저장 중·연결 끊김 표시를 확인한다.

## 범위 밖

- 저장 상태 전이 로직과 재연결 정책 변경
- 헤더의 제목·뒤로 가기·액션 영역 재배치
- 다른 화면의 배지 사용처 변경
