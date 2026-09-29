# Hover·Press 모션 일관화 — 설계

## 배경

"hover시에 animation이 없는 부분들이 많아서 너무 정적"이라는 피드백에서 시작한다.

조사 결과 원인은 모션이 없는 것이 아니라 **한 화면 안에서 모션 규칙이 갈리는** 것이었다.
`widgets/sidebar/ui/Sidebar.tsx`는 17곳에서 `transition-[...] duration-150 ease-out
motion-reduce:transition-none` + `active:scale-[0.99]`를 쓴다. 반면 같은 페이지의 프로젝트
카드 메뉴 버튼, 브레드크럼, 드롭다운 메뉴 항목, 표의 행은 hover 색이 툭 바뀌거나 hover
피드백 자체가 없다. 사이드바만 매끄럽고 본문은 정적이라 대비가 두드러진다.

DESIGN.md가 이미 기준을 정해 두었다.

- §Preserve: "절제된 Motion (Hover 100~150ms ease, spring/bounce/parallax 사용 안 함)"
- §10 Interaction States: "State 표현은 Component 간 일관되어야 한다"
- §8.6 Table: "Row Hover는 Subtle하게 표현한다"

즉 이 작업은 새 모션 언어를 만드는 일이 아니라, 이미 정해진 규칙을 지키지 않는 지점을
찾아 맞추는 일이다.

## 목표

- hover·press 상태 전환을 전 컴포넌트에서 같은 곡선·같은 시간으로 애니메이션한다.
- DESIGN.md가 요구하는데 빠져 있는 hover 상태(표의 행)를 채운다.
- `prefers-reduced-motion` 계약을 전환이 있는 모든 곳에 일관되게 적용한다.
- 카드 hover 강조를 DESIGN.md가 정한 표현 수단(테두리)으로 되돌린다.
- 그 밖의 시각 디자인(색·간격)은 바꾸지 않는다.

## 모션 어휘

새 토큰을 만들지 않는다. 저장소가 이미 쓰는 리터럴 유틸리티를 그대로 쓴다. Tailwind
클래스는 Prettier 플러그인이 정렬하고 에디터가 검사하므로 상수로 빼면 두 이점을 잃는다.

| 용도 | 클래스 | 선례 |
| --- | --- | --- |
| hover 색 전환 | `transition-colors duration-150 ease-out motion-reduce:transition-none` | `Sidebar.tsx:302` |
| press 피드백 | `active:scale-[0.99]` | `Sidebar.tsx:302,344,378` |
| 팝오버 열림 | `data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95` + `duration-150 ease-out motion-reduce:!animate-none` | `dialog.tsx:44`, `Sidebar.tsx:262` |

150ms는 DESIGN.md가 정한 상한이다. spring·bounce·parallax는 쓰지 않는다.
`active:scale-[0.99]`는 1% 축소로, 튕김 없는 단순 스케일이라 이 제약 안에 있다.

## 변경 범위

### A. hover는 있는데 전환이 없는 곳 — 7곳

전환만 붙인다. hover 색은 그대로다.

| 파일 | 요소 | 현재 hover |
| --- | --- | --- |
| `shared/ui/breadcrumb.tsx:40` | 브레드크럼 링크 | `hover:text-foreground-default` |
| `shared/ui/search.tsx:36` | 검색어 지우기 버튼 | `hover:text-foreground-default` |
| `shared/ui/password-input.tsx:26` | 비밀번호 표시 토글 | `hover:text-foreground-default` |
| `features/project/ui/ProjectCard.tsx:32` | 카드 컨텍스트 메뉴 트리거 | `hover:bg-action-secondary-hover` |
| `features/project/ui/ProjectDetailHeader.tsx:64` | 헤더 아이콘 버튼 | `hover:bg-action-secondary-hover` |
| `features/project/ui/ProjectDetailHeader.tsx:77` | 컨텍스트 메뉴 트리거 | `hover:bg-action-secondary-hover` |
| `features/whiteboard-document/ui/WhiteboardDocumentMenu.tsx:29` | 컨텍스트 메뉴 트리거 | `hover:bg-action-secondary-hover` |

### B. hover 상태 자체가 없는 곳 — 2곳

- **`shared/ui/dropdown-menu.tsx` `DropdownMenuItem`** — Radix가 hover·키보드 이동에
  `data-[highlighted]`를 붙이고 `bg-background-subtle`이 즉시 적용된다. 전환을 붙인다.
  4개 feature(`ProjectCard`, `ProjectDetailHeader`, `WhiteboardDocumentMenu`,
  `WhiteboardCanvas`)가 쓰는 표면이다.
- **`shared/ui/table.tsx` 행** — `TableRow`에 `transition-colors`가 있는데 정작 hover 배경이
  없다. 전환할 대상이 없는 상태다. DESIGN.md §8.6이 요구하는 subtle row hover를 넣는다.
  단 `TableRow`는 헤더 행과 `resource-list-skeleton.tsx`의 스켈레톤 행도 쓴다. 공통
  컴포넌트에 hover를 박으면 헤더와 로딩 스켈레톤까지 반응한다. 그래서 hover는
  `ProjectTable`·`WhiteboardDocumentTable`의 본문 행에만 명시적으로 준다.

### C. 팝오버 열림 애니메이션 — 1곳

`DropdownMenuContent`에 열림·닫힘 전환이 없다. Dialog(`dialog.tsx:25,44`)와 사이드바
워크스페이스 팝오버(`Sidebar.tsx:262`)는 fade + zoom을 쓰는데 드롭다운만 툭 나타난다.
같은 fade + zoom으로 맞춘다.

### D. press 피드백과 전환 속성 명시 — 3곳

| 파일 | 지금 | 바꿀 것 |
| --- | --- | --- |
| `shared/ui/button.tsx:8` | `transition-colors` | duration·ease·motion-reduce 명시 + `active:scale-[0.99]` |
| `shared/ui/list-cell.tsx:24` | `transition-colors` | duration·ease·motion-reduce 명시 + `active:scale-[0.99]` |
| `shared/ui/pagination.tsx:28,50,72` | `transition-colors` | duration·ease·motion-reduce 명시 |

`transition-colors`만 쓰면 Tailwind 기본값(150ms, `ease`)에 기대게 된다. 결과 시간은
비슷하지만 곡선이 사이드바(`ease-out`)와 다르고, 기본값이 바뀌면 함께 흔들린다.
명시해서 고정한다.

페이지네이션에는 press 스케일을 주지 않는다. 7×7 크기라 1% 축소가 눌림으로 읽히지 않는다.

### E. reduced-motion 계약 정리 — 6곳

`motion-reduce:transition-none` 없이 `transition-*`만 쓰는 공용 컴포넌트가 남아 있다:
`input.tsx`, `textarea.tsx`, `select.tsx`, `checkbox.tsx`, `radio-group.tsx`, `tabs.tsx`.
전환이 있는 곳에는 예외를 두지 않는다. 이 계약을 `src/architecture.test.ts`의
invariant 테스트로 고정한다 — #94·#95에서 쓴 회귀 방지 장치와 같은 방식이다.

### F. 카드 hover 강조를 그림자에서 테두리로 — 2곳

`ProjectCard.tsx:61`과 `whiteboard-card.tsx:39`는 `transition-shadow duration-150
hover:shadow-md`를 쓴다. 전환은 이미 있지만 두 가지가 어긋난다.

**첫째, 디자인 시스템을 우회한다.** 테마(`src/app/styles/index.css:186-189`)는
`--shadow-sm`과 `--shadow-lg`만 정의한다. `--shadow-md`는 없다. Tailwind v4에서 `@theme`에
없는 크기를 쓰면 오류가 아니라 프레임워크 기본값으로 조용히 떨어진다. 빌드한 CSS로
확인했다.

```css
/* Tailwind 기본값 — 디자인 토큰이 아니다 */
.hover\:shadow-md:hover{--tw-shadow:0 4px 6px -1px var(--tw-shadow-color,#0000001a), 0 2px 4px -2px var(--tw-shadow-color,#0000001a)}
/* 테마가 정의한 값 */
.shadow-sm{--tw-shadow:0 6px 16px var(--tw-shadow-color,oklch(0% 0 0/.08)), 0 2px 4px var(--tw-shadow-color,oklch(15.5% 0 0/.06))}
```

**둘째, 정책과 어긋난다.** DESIGN.md §Preserve는 "카드에 그림자를 쓰지 않고 1px Hairline
Border로 구조를 표현... Shadow는 Modal/Dropdown/Popover/Toast 같은 Elevated Surface에만
사용"이라고 정하고, §6.6은 "일반 Card와 List Cell은 강한 Shadow를 사용하지 않는다"고
못박는다.

그래서 hover 강조를 테두리 색 한 단계 강화로 바꾼다. 카드가 들리는 느낌은 이미 있는
`useCardMotion`의 `translateY(-2px)`가 담당하므로 강조가 사라지지 않는다.

| 파일 | 평상시 테두리 | hover |
| --- | --- | --- |
| `features/project/ui/ProjectCard.tsx:61` | `border-border` | `hover:border-border-strong` |
| `shared/ui/whiteboard-card.tsx:39` | `border-border-subtle` | `hover:border-border` |

각각 한 단계만 올린다. `transition-shadow`는 `transition-colors`로 바꾼다.

## 하지 않는 것

- **`shared/ui/tabs.tsx`의 hover 상태** — 탭 트리거에 hover가 없지만 `Tabs`는 자기 파일
  밖에서 쓰이지 않는다. 죽은 코드에 새 상태를 넣지 않는다. E의 reduced-motion만 맞춘다.
- **`hover:underline` 4곳** (`ProjectCard.tsx:76`, `ProjectTable.tsx:58`,
  `whiteboard-card.tsx:52`, `WhiteboardDocumentTable.tsx:60`) — `text-decoration`은 전환
  대상이 아니다. `text-decoration-color`로 우회해 밑줄을 서서히 띄울 수 있지만 절제된
  Motion 원칙에 비해 과하다.
- **진입·목록 stagger 애니메이션** — 요청은 hover다. 목록이 순차로 나타나는 연출은
  범위가 다르고 `motion` 의존을 새로 끌어들인다.

## 오류 계약

동작·상태·접근성 속성 변경 없음. 클래스 문자열만 바뀐다. `prefers-reduced-motion: reduce`
환경에서는 모든 전환이 꺼지고 최종 상태만 즉시 적용된다.

## 검증 계획

- `npx vitest run` — 기존 443건 통과. 클래스 문자열을 단언하는 테스트가 있으면 갱신한다.
- 신규 invariant 테스트: `transition-*`를 쓰는 `src` 소스에 `motion-reduce:`가 함께 있는지
  검사. 위반을 심어 red 확인 후 원복한다.
- `pnpm lint` exit 0, `pnpm build` exit 0
- 개발 서버에서 hover·press·드롭다운 열림을 눈으로 확인한다.
