# Hover·Press 모션 일관화 — 구현 계획

- 설계: [2026-09-29-hover-motion-design.md](../specs/2026-09-29-hover-motion-design.md)

## 목표

hover·press 전환을 `duration-150 ease-out motion-reduce:transition-none`으로 통일하고,
DESIGN.md가 요구하는데 빠져 있던 표 행 hover와 드롭다운 열림 애니메이션을 채운다.
시각 디자인은 바꾸지 않는다.

## 단계

### 1. 전환이 없는 hover에 전환 붙이기 (7곳)

각 `className`에 `transition-colors duration-150 ease-out motion-reduce:transition-none`을
추가한다. 색·크기·간격은 건드리지 않는다.

- `shared/ui/breadcrumb.tsx:40`
- `shared/ui/search.tsx:36`
- `shared/ui/password-input.tsx:26`
- `features/project/ui/ProjectCard.tsx:32`
- `features/project/ui/ProjectDetailHeader.tsx:64`
- `features/project/ui/ProjectDetailHeader.tsx:77`
- `features/whiteboard-document/ui/WhiteboardDocumentMenu.tsx:29`

### 2. 드롭다운 메뉴

- `DropdownMenuItem`: `transition-colors duration-150 ease-out
  motion-reduce:transition-none` 추가. `data-[highlighted]` 색은 그대로.
- `DropdownMenuContent`: Dialog와 같은 fade + zoom 추가.

  ```
  data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
  data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
  duration-150 ease-out motion-reduce:!animate-none
  ```

### 3. 표 행 hover

- `shared/ui/table.tsx` `TableRow`: 기존 `transition-colors`에 `duration-150 ease-out
  motion-reduce:transition-none` 명시.
- `features/project/ui/ProjectTable.tsx`의 본문 `<TableRow>`와
  `features/whiteboard-document/ui/WhiteboardDocumentTable.tsx`의 본문 `<TableRow>`에
  `hover:bg-background-subtle` 추가. 헤더 행과 스켈레톤 행에는 넣지 않는다.

### 4. press 피드백과 전환 속성 명시

- `shared/ui/button.tsx:8` — `transition-colors duration-150 ease-out
  active:scale-[0.99] motion-reduce:transition-none`
- `shared/ui/list-cell.tsx:24` — 같은 조합
- `shared/ui/pagination.tsx:28,50,72` — 스케일 없이 duration·ease·motion-reduce만

### 5. reduced-motion 계약 정리

`input.tsx`, `textarea.tsx`, `select.tsx`, `checkbox.tsx`, `radio-group.tsx`, `tabs.tsx`의
`transition-colors`에 `motion-reduce:transition-none`을 붙인다.

### 6. 카드 hover 강조를 테두리로 (설계 F)

- `features/project/ui/ProjectCard.tsx:61` — `transition-shadow hover:shadow-md` →
  `hover:border-border-strong` + `transition-colors`
- `shared/ui/whiteboard-card.tsx:39` — 같은 방식으로 `hover:border-border`

### 7. invariant 테스트 추가

`src/architecture.test.ts`에 `describe('모션 계약')`을 추가한다. `src`의 소스 파일에서
`transition-` 유틸을 쓰는 파일은 `motion-reduce:`도 함께 써야 한다.
`animate-*`만 쓰는 파일(`spinner`, `skeleton`)은 `motion-reduce:animate-none`으로 만족한다.

### 8. 기존 테스트 보강

`dialog.test.tsx`가 reduced-motion 클래스를 단언하는 선례를 따라, 드롭다운 열림
애니메이션과 표 행 hover에 대한 단언을 해당 테스트 파일에 추가한다.

### 9. 검증

- `npx vitest run`
- invariant 테스트 red 확인: 한 파일의 `motion-reduce:`를 지워 실패 확인 후 원복
- `pnpm lint`, `pnpm build`
- 개발 서버에서 hover·press·드롭다운 열림 육안 확인

## 구현 결과

### 실제 변경

코드 25개 파일 수정, 테스트 1개 파일 신규.

- **A. 전환 없던 hover 7곳** — 계획한 7곳 모두에
  `transition-colors duration-150 ease-out motion-reduce:transition-none`을 붙였다.
- **B·C. 드롭다운** — `DropdownMenuItem`에 전환, `DropdownMenuContent`에 Dialog와 같은
  fade + zoom을 넣었다.
- **B. 표 행 hover** — `shared/ui/table.tsx`의 `TableRow`에 duration·ease·motion-reduce를
  명시하고, `ProjectTable.tsx:52`·`WhiteboardDocumentTable.tsx:54`의 본문 행에만
  `hover:bg-background-subtle`을 줬다. 헤더 행과 `resource-list-skeleton.tsx`는 그대로다.
- **D. press 피드백** — `button.tsx`·`list-cell.tsx`에 `active:scale-[0.99]`를 추가하고,
  `pagination.tsx` 3곳에는 스케일 없이 duration·ease·motion-reduce만 명시했다.
- **E. reduced-motion** — `input.tsx`, `textarea.tsx`, `select.tsx`, `radio-group.tsx`,
  `checkbox.tsx`, `tabs.tsx` 6개 파일에 `motion-reduce:transition-none`을 붙였다.
- **F. 카드 hover** — `ProjectCard.tsx`는 `hover:border-border-strong`,
  `whiteboard-card.tsx`는 `hover:border-border`로 바꾸고 `transition-shadow`를
  `transition-colors`로 교체했다.
- **테스트** — `src/architecture.test.ts`에 `describe('모션 계약')` 2건,
  `src/shared/ui/dropdown-menu.test.tsx` 신규 1건, 표 본문 행 hover 2건,
  카드 테두리 hover 2건. 총 7건 추가.

### 계획과 달라진 점

- **카드 변경(F)이 범위에 들어왔다.** 처음 설계에서는 "시각 디자인 변경"이라 범위 밖으로
  뒀다. 빌드한 CSS를 확인해 `hover:shadow-md`가 테마에 없는 Tailwind 기본값으로 떨어지는
  것을 확인하고 사용자에게 보고했고, 권장안대로 진행하라는 승인을 받아 포함했다.
- **드롭다운 테스트를 하나로 합쳤다.** 열림 애니메이션과 항목 강조를 별개 `it`으로 나눴을
  때 같은 포털을 두 번 렌더링해 두 번째 테스트에서 `menuitem`을 찾지 못했다. 한 흐름의
  단일 테스트로 합쳐 해결했다.
- **`duration-150` 상한을 검사하는 invariant 테스트는 넣지 않았다.** `transition-*`에서
  거꾸로 `duration-(\d+)`를 찾는 정규식이 신뢰할 만하지 않아 거짓 결과를 낼 수 있었다.
- **카드 테스트에서 클래스 문자열로 부재를 단언하지 않는다.**
  `expect(card).not.toHaveClass('hover:shadow-md')`로 썼더니 Tailwind가 테스트 파일까지
  스캔해 `.hover\:shadow-md` 규칙을 프로덕션 CSS에 다시 만들어 넣었다. 빌드 산출물에서
  발견해 `expect(card.className).not.toMatch(/shadow/)`로 바꿨고, 재빌드 후 그림자 유틸이
  `.shadow-sm`·`.shadow-lg`(테마 정의값)만 남는 것을 확인했다.

### 검증 결과

| 명령 | 결과 |
| --- | --- |
| `npx vitest run` | 81개 파일 450건 통과 (기존 443 + 신규 7) |
| invariant red 확인 | `input.tsx`의 `motion-reduce:`를 지워 `모션 계약` 테스트 실패 확인 후 원복 |
| `pnpm lint` | exit 0 (기존 `react-refresh` 경고 4건, 이 작업과 무관) |
| `pnpm build` | exit 0 |
| `npx prettier --write` | 변경한 26개 파일 정렬 완료 |
| 컴파일된 CSS | `hover:shadow-md` 0건, `hover:border-border-strong`·`hover:border-border` 생성 확인 |
| `pnpm storybook` 육안·계산값 확인 | 카드·드롭다운·버튼·표·목록·페이지네이션·브레드크럼·비밀번호 입력 확인 |

브라우저 확인은 Storybook(`localhost:6006`)에서 했다. 로그인·백엔드 없이 바뀐 컴포넌트를
직접 띄울 수 있고, 실제 계산된 스타일을 읽어 확인할 수 있어서다.

| 대상 | 평상시 → hover | 전환 |
| --- | --- | --- |
| `whiteboard-card` | 테두리 알파 `0.08` → `0.22`, `box-shadow: none` 유지 | `0.15s cubic-bezier(0,0,0.2,1)` |
| `dropdown-menu` 열림 | `animation-name: enter` | `0.15s`, reduced-motion에서 `none` |
| `dropdown-menu` 항목 | 강조 색 전환 | `0.15s`, reduced-motion에서 `transition-property: none` |
| `button` | 배경 `L 0.148` → `0.237`, 누름 중 `scale: 0.99` | `0.15s`, 누름 해제 시 원복 |
| `TableRow` | 헤더·본문 모두 전환만 보유 | `0.15s` |
| `list-cell`·`pagination` | 배경 전환 | `0.15s` |
| `breadcrumb`·`password-input` | 글자색 전환 | `0.15s` |

카드는 그리드 상태로 스크린샷을 찍어 hover 카드만 2px 떠오르고 테두리가 진해지는 것을
확인했다. 그림자는 어느 상태에서도 생기지 않는다.

invariant red 확인 과정에서 체크아웃으로 원복하는 바람에 같은 파일에 넣었던 E 단계 변경까지
함께 지워졌다. 곧바로 다시 넣고 테스트로 확인했다.

### 남은 후속 작업

- `ProjectTable`·`WhiteboardDocumentTable`의 본문 행 hover는 Storybook에 스토리가 없어
  브라우저로 보지 못했다. 단위 테스트와 컴파일된 CSS(`.hover\:bg-background-subtle:hover`가
  실제 색으로 해석됨)로만 확인했다. 실제 화면 확인은 백엔드·로그인이 필요하다.
- **폼 컨트롤의 easing이 다르다.** `input`·`textarea`·`select`·`checkbox`·`radio-group`·`tabs`는
  Tailwind 기본값을 그대로 써서 `0.15s`지만 easing이 `ease-in-out`이다. 나머지는 `ease-out`이다.
  E 단계는 reduced-motion만 붙이는 범위였으므로 그대로 뒀다.
- **누름 축소는 전환 대상이 아니다.** Tailwind v4의 `scale-[0.99]`는 `transform`이 아니라
  `scale` 속성을 쓰고, 이 속성은 `transition-colors`에 들어 있지 않아 즉시 바뀐다.
  reduced-motion에서도 그대로 적용된다. 크기 변화가 1%라 문제로 보지 않았다.
- `hover:underline` 4곳, `tabs.tsx` hover, 목록 stagger는 설계의 "하지 않는 것"에 남아 있다.
