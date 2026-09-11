# UI 정합성 및 사용성 개선 설계

- 작성일: 2026-09-09
- 대상 브랜치: `feature/ui-refresh`
- Figma 파일: `Dimhltnal74SHy2NcLz1Lf`
- 기준 페이지: `v1.0` (`84:2`)
- 관련 화면: Login (`96:5`), Workspace Home (`125:158`), Table View (`125:274`), 워크스페이스 전환 (`156:1038`), 프로젝트 빈 상태 (`152:925`), 검색 결과 없음 (`154:1062`)

## 1. 목표

현재 구현된 워크스페이스 사이드바와 프로젝트 목록 UI를 Figma의 레이아웃·컴포넌트·상태 표현에 맞추고, 실제 화면에서 발견된 정렬·겹침·스크롤·폼 상태·토스트·카드 깨짐을 함께 수정한다.

이번 작업은 기존 기능의 UI 정합성 개선이다. 새 페이지나 미구현 기능을 만들지 않으며, API·인증·권한·데이터 모델 계약을 변경하지 않는다.

## 2. 범위

### 포함

- 사이드바 워크스페이스 트리거의 텍스트 정렬과 chevron 수직 정렬
- 접힌 사이드바의 토글 버튼 위치·border·radius 보정
- 워크스페이스 목록 간격, scrollbar 표현, 검색 clear button, compact empty state
- 워크스페이스 생성 성공 toast와 form reset
- toast 기본 너비와 긴 텍스트 줄바꿈
- 프로젝트 카드 내부 간격과 overflow 제거
- 프로젝트 page size 12와 pagination 간격
- grid/table toggle의 Figma 정합성
- 프로젝트 검색 결과 없음 상태의 Figma 정합성과 중앙 배치
- Figma에 워크스페이스 검색용 `Empty State / Compact` 컴포넌트와 사용 예시 반영

### 제외

- 멤버·설정·화이트보드 등 현재 미구현 화면 신규 개발
- 사이드바 라우팅·권한 정책 변경
- 프로젝트·워크스페이스 API 수정
- 전체 디자인 시스템 개편
- 로그인 화면 변경

## 3. 기준과 우선순위

1. 사용자가 명시한 동작과 형태를 최우선으로 적용한다.
2. Figma에 명시된 화면·컴포넌트 값은 기존 코드 토큰과 컴포넌트로 변환해 적용한다.
3. 실제 구현 제약 때문에 Figma를 보완해야 하는 경우 Figma MCP로 필요한 컴포넌트와 상태만 추가한다.
4. 기존 접근성, 키보드 탐색, 반응형 동작, 사이드바 resize 동작을 보존한다.

## 4. 상세 설계

### 4.1 사이드바 워크스페이스 트리거

현재 트리거는 네이티브 `button`의 기본 가운데 텍스트 정렬을 명시적으로 덮어쓰지 않았고, chevron이 워크스페이스 이름 행 안에 들어 있어 권한 텍스트를 포함한 전체 블록과 수직 중심이 맞지 않는다.

- 트리거에 왼쪽 텍스트 정렬을 명시한다.
- 내부 구조를 `WorkspaceMark | TextColumn | Chevron`의 한 행으로 만든다.
- `TextColumn`은 이름과 권한을 세로로 쌓고 `items-start` 및 `text-left`를 사용한다.
- chevron은 텍스트 열 바깥의 독립 sibling으로 두고 트리거 행의 수직 중앙에 맞춘다.
- 이름 truncation과 접힘 전환 애니메이션은 유지한다.

### 4.2 접힌 사이드바 토글 버튼

현재 접힌 상태의 버튼은 사이드바 바깥에 전부 배치되어 20px 왼쪽 여백으로 시작하는 페이지 타이틀과 겹친다. 펼침·접힘 상태 모두 토글의 중심축을 유지하면서 접힌 상태에서만 다음 형태로 바꾼다.

- 버튼의 수평 중심을 사이드바 우측 border에 맞춘다.
- 구현은 `left: 100%`와 `translateX(-50%)`에 해당하는 배치를 사용한다.
- 버튼 컨테이너는 32px 원형(`rounded-full`)으로 만든다. 펼침 상태에서는 기존 위치와 아이콘 중심을 유지하고, 접힘 상태에서는 흰색 배경과 전체 border를 표시한다.
- 펼침 상태는 `chevron-left`, 접힘 상태는 같은 아이콘의 180도 회전으로 오른쪽을 향하게 한다.
- 토글을 resize handle보다 높은 stacking context에 배치하고 `cursor-default`를 사용해 아이콘 위에서 드래그 커서가 보이지 않게 한다.
- 현재의 세로 위치, 접힘 상태로 전환되는 시점, width·position 애니메이션 타이밍은 유지한다.
- 32px 버튼은 보더 중심에서 양쪽으로 16px만 돌출되며, 현재 페이지 타이틀의 이동 시점과 위치는 변경하지 않는다.

### 4.3 워크스페이스 목록

- 목록 아이템 사이에 8px gap을 둔다. 각 셀은 Figma List Cell 기준 62px 높이를 유지한다.
- 목록 영역은 계속 `overflow-y: auto`로 스크롤된다.
- Firefox의 `scrollbar-width: none`, WebKit scrollbar 숨김을 함께 적용해 scrollbar chrome만 숨긴다.
- 키보드 방향키·Home·End 탐색과 focus 이동은 기존 동작을 유지한다.

### 4.4 검색 입력과 clear 버튼

브라우저 기본 `input[type=search]`의 cancel button은 브라우저마다 모양과 여백이 달라 디자인을 일관되게 맞출 수 없다.

- 공통 Search 컴포넌트의 실제 input은 `type="text"`를 사용한다.
- 검색 의미는 `role="searchbox"`, 접근 가능한 label, 필요 시 `inputMode="search"`로 보존한다.
- 값이 있을 때만 우측에 Lucide `X` 기반 clear button을 표시한다.
- clear button은 접근 가능한 이름을 갖고, 누르면 검색어와 페이지를 초기화하며 input focus를 유지한다.
- 프로젝트 검색과 워크스페이스 검색이 같은 컴포넌트와 clear 패턴을 사용한다.

### 4.5 Compact Empty State

페이지 전체용 Empty State는 워크스페이스 popover에 비해 크고 CTA 중심이므로 별도 compact 표현을 사용한다.

#### 코드 컴포넌트

`shared/ui/compact-empty-state.tsx`를 추가한다.

- Props: `icon`, `title`, optional `description`, 표준 div props
- 구조: 작은 아이콘, 13px title, optional 12px description
- 간격: 8px 중심의 compact vertical stack
- 목록의 남은 높이와 너비를 채우고 수평·수직 가운데 정렬
- 워크스페이스 검색 결과가 없을 때 title `검색 결과가 없어요`, description `다른 검색어로 다시 시도해보세요` 표시

#### Figma 컴포넌트

Figma MCP로 `Empty State / Compact` 컴포넌트를 만든다.

- 기존 Empty State의 색·타입 역할을 재사용하되 크기와 여백만 popover용으로 축소한다.
- 워크스페이스 검색 결과 없음 상태에서 컴포넌트 instance를 사용한다.
- 새 애플리케이션 화면을 추가하는 것이 아니라, 이미 구현된 popover 검색 상태를 문서화하는 디자인 상태로 다룬다.

### 4.6 워크스페이스 생성과 Toast

- 워크스페이스 생성 mutation 성공 후 `워크스페이스를 만들었어요` success toast를 표시한다.
- mutation 실패 시 기존 dialog error 계약을 유지하며 success toast를 표시하지 않는다.
- WorkspaceCreateDialog가 닫히면 입력값과 validation error를 초기화한다.
- 부모가 `open=false`를 전달해 닫는 성공 경로에서도 초기화되도록 open 상태 변화를 기준으로 reset한다.

공통 Toast는 다음 크기 계약을 갖는다.

- 기본 width: 320px
- 작은 viewport: 좌우 24px 안전 여백 안에서 축소
- 긴 텍스트: toast 폭을 늘리지 않고 whitespace wrapping과 word breaking 적용
- 아이콘과 텍스트는 Figma Toast처럼 수직 가운데 정렬하고, 긴 텍스트는 동일 폭 안에서 줄바꿈

### 4.7 프로젝트 카드

현재 204px 고정 height와 설명 영역의 강제 2줄 높이를 동시에 사용해 콘텐츠 총높이가 카드 내부 가용 높이를 초과한다. 이로 인해 수정일과 divider가 붙고 footer가 아래 border에 잘린 것처럼 보인다.

- 고정 `height: 204px` 대신 `min-height: 204px`를 사용한다.
- 설명의 강제 최소 높이를 제거하고 최대 2줄 제한만 유지한다.
- CSS Grid의 기본 row stretch로 같은 행의 카드는 가장 높은 카드에 맞춘다.
- 날짜 영역과 divider/footer 사이에 8px 간격을 보장한다.
- divider와 사용자 footer 내부에도 8px 상단 간격을 유지한다.
- 카드의 16px 외부 padding을 보존해 footer가 아래 border와 떨어지도록 한다.
- 이름·설명·날짜·사용자 truncation 규칙은 유지한다.

### 4.8 프로젝트 목록, 페이지네이션, 툴바

- 프로젝트 API 요청의 기본 page size를 6에서 12로 변경한다.
- 검색어 변경 시 page를 1로 초기화하는 기존 동작을 유지한다.
- 페이지 헤더·툴바·목록·페이지네이션의 section gap을 Figma 기준 24px로 통일한다.
- 카드 행이 Figma처럼 204px 또는 내용에 따라 224px가 되면, 2행 grid와 pagination 사이의 24px 간격이 자연스럽게 유지된다.

View toggle은 Figma `125:158`, `125:274`를 따른다.

- outer: 36px height, subtle background, 8px radius, 4px padding, 2px item gap, 별도 border 없음
- item: 28×28px, 4px radius
- active item: default background with `border/default` ring and subtle shadow so the selected state is unmistakable
- inactive item: transparent background
- 프로젝트 생성 Button은 기존 default size 36px를 유지해 toggle과 높이를 맞춘다.
- `aria-pressed`, group label, focus ring을 유지한다.
- Figma의 grid/table active view button에도 같은 border emphasis를 반영한다.

### 4.9 프로젝트 검색 결과 없음

Figma `154:1062`의 표현을 따른다.

- Search icon
- title: `검색 결과가 없어요`
- description: `다른 검색어로 다시 시도해보세요`
- secondary action: `검색 결과 초기화`
- action은 검색어를 비우고 page를 1로 초기화한다.
- Empty State가 프로젝트 section의 남은 공간을 채우도록 해 수평·수직 가운데 정렬한다.

프로젝트 자체가 없는 기본 빈 상태는 Figma `152:925`에 맞춰 Folder icon, 설명, Large Primary `새 프로젝트 만들기` CTA를 사용한다.

## 5. 컴포넌트 및 변경 범위

주요 변경 예상 파일:

- `frontend/src/shared/ui/sidebar.tsx`
- `frontend/src/shared/ui/search.tsx`
- `frontend/src/shared/ui/compact-empty-state.tsx` (신규)
- `frontend/src/shared/ui/toast.tsx`
- `frontend/src/features/workspace/ui/WorkspaceCreateDialog.tsx`
- `frontend/src/pages/home/ui/HomePage.tsx`
- `frontend/src/features/project/ui/ProjectListContent.tsx`
- `frontend/src/features/project/ui/ProjectCard.tsx`
- 관련 테스트 및 Storybook story
- 이 구현 계획 문서

Figma 변경:

- `Empty State / Compact` component creation
- workspace switcher search empty state uses its instance

## 6. 권한·오류 계약

- Workspace Owner/Member 또는 Project Creator에 따른 기존 메뉴 노출 조건은 변경하지 않는다.
- 워크스페이스 생성 권한과 API 요청 형태는 변경하지 않는다.
- 성공 toast는 mutation이 resolve된 뒤에만 표시한다.
- 실패는 기존 dialog error를 유지하고 입력값을 자동 삭제하지 않는다. 사용자가 dialog를 닫을 때만 reset한다.
- 검색·clear·empty state는 서버 오류 상태와 독립적으로 동작한다.
- 사이드바의 키보드 resize, collapse button label, focus ring, listbox keyboard navigation을 보존한다.

## 7. 검증 계획

### 자동 테스트

- Sidebar: 이름/권한 왼쪽 정렬 구조, chevron sibling 구조, 접힌 토글의 full border/radius/centered border placement, list gap, hidden scrollbar, compact empty state, custom clear 동작
- WorkspaceCreateDialog: 입력 후 취소·부모 제어 close·성공 close 뒤 재오픈 시 값과 오류가 초기화됨
- HomePage: 워크스페이스 생성 성공 toast와 실패 시 미표시
- Toast: 320px 기본 폭과 wrapping class
- ProjectCard: fixed height 제거, min-height, divider/footer spacing
- ProjectListContent: limit 12, Figma toggle style, 검색 초기화 CTA, centered empty state, pagination spacing
- Search: native search cancel 미사용, accessible clear button, focus 유지

### 정적 검증

- `pnpm test`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`

### 시각 검증

- Sidebar expanded/collapsed/intermediate resize width
- 1440px 기준 grid/table toolbar 및 toggle
- 한 줄·두 줄 프로젝트 설명이 섞인 카드 행
- 긴 toast message와 좁은 viewport
- workspace popover with many items, empty query result, and keyboard navigation
- project empty/search empty/error states
- Figma component instance와 실제 compact empty state의 typography·spacing 비교

## 8. 성공 조건

- 사용자가 요청한 17개 항목이 코드 또는 Figma에 반영된다.
- 접힌 사이드바 토글이 border 중앙에 배치되고 페이지 타이틀을 가리지 않는다.
- 프로젝트 카드의 날짜·divider·footer가 겹치거나 잘리지 않는다.
- 검색 clear와 empty state가 일관되고 키보드로 사용할 수 있다.
- 프로젝트 요청 limit이 12다.
- 관련 테스트·lint·build·format check가 통과한다.
- Figma의 compact empty state가 component instance로 사용된다.
- 구현 결과와 계획 차이가 구현 계획 문서에 기록된다.

## 9. 후속 디자인 피드백 반영

추가 피드백은 기존 화면의 동작·레이아웃 보정으로 한정하며, 새 화면이나 데이터 계약은 만들지 않는다.

- 사이드바 토글은 펼침 상태에서 `chevron-left`, 접힘 상태에서 `chevron-right`가 되도록 동일 아이콘을 회전시킨다. 토글 컨테이너는 원형으로 만들고, 버튼을 resize handle보다 높은 stacking context에 배치해 아이콘 위에서는 `cursor-col-resize`가 노출되지 않도록 한다.
- 사이드바는 `min-h-svh` 기반으로 콘텐츠가 길어져도 화면 높이를 채우며 고정된 열로 유지한다. 기존 본문 스크롤과 resize/collapse 상태 모델은 보존한다.
- 워크스페이스 popover의 검색창과 목록 사이 여백을 명시하고, 목록 셀은 Figma List Cell의 62px 높이와 8px 간격을 사용한다. 목록 스크롤 동작과 검색 빈 상태는 유지한다.
- 프로젝트 view toggle의 active item은 기존 흰색 배경에 border/ring과 shadow를 추가해 선택 상태를 명확히 표시한다. Figma의 `view-btn-active`에도 같은 시각적 강조를 반영한다.
- 프로젝트 카드 외곽선은 `border` semantic token으로 한 단계 진하게 하고, Figma Card component의 border도 동일하게 조정한다. 내부 divider는 기존 subtle 단계로 유지한다.
- workspace member avatar stack은 Figma 기준처럼 workspace mark 안쪽에서 시작하도록 좌측 inset을 추가한다.

## 10. 이미지 기반 후속 보정

추가 스크린샷에서 확인된 회귀는 사이드바 경계의 overflow 클리핑과 workspace list item의 flex shrink로 분류한다.

- Sidebar는 `sticky`와 `h-svh`를 유지하되 루트에 가로 overflow를 유발하는 `overflow-y-auto`를 적용하지 않는다. 이를 통해 workspace popover와 border 중앙의 collapse toggle이 사이드바 바깥으로 자연스럽게 표시된다.
- Workspace list option은 Figma List Cell 기준 `62px` 높이를 `min-height`와 `shrink-0`로 고정한다. 현재 적용된 option 사이의 `8px` gap은 유지한다.
- 데이터가 많아도 셀이 납작해지거나 텍스트가 겹치지 않아야 하며, 목록 자체의 스크롤 동작은 유지한다.

## 11. 선택 항목 자동 중앙 스크롤 및 미세 조정

추가 피드백에 따라 기존 사이드바의 시각 밀도를 조정하고, 선택 항목이 긴 목록의 아래쪽에 있을 때도 즉시 인지할 수 있도록 공통 동작을 추가한다.

- 접힌 Sidebar 토글은 `24px` 원형으로 축소한다. 기존의 사이드바 보더 중앙 배치, `top`/`left` 전환 시점, chevron 회전, resize handle보다 높은 stacking context는 유지한다.
- 펼침·접힘 모두 `top-4`를 사용해 세로 위치는 고정하고, 접힐 때는 `left-full`과 `translateX(-50%)`로 수평 위치만 이동한다.
- 토글의 회색 hover 면은 제거하고 흰색 배경(`background-default`)과 아이콘 색상·미세 shadow 중심의 hover 상태를 사용해 보더가 회색 블록처럼 보이지 않도록 한다.
- Workspace option의 셀 높이는 `58px`(`h-[58px] min-h-[58px] shrink-0`)로 조정하고, 셀 간격은 `6px`(`gap-1.5`)로 줄인다. 셀 내부 정렬과 검색·스크롤 동작은 유지한다.
- 공통 `useScrollActiveItem` hook을 추가한다. `activeKey`, `enabled`, `behavior`, `block`, `inline`을 받고 `containerRef`와 `registerItem(key)`를 반환한다.
- hook은 `useLayoutEffect`에서 활성 항목이 등록된 경우 `scrollIntoView({ block: 'center', inline: 'nearest' })`를 호출한다. WorkspaceSwitcher는 popover가 열리거나 선택 키가 변경될 때 이 hook을 사용한다.
- hook은 Workspace 목록에 종속되지 않으며 이후 Select·Dropdown에서도 같은 callback-ref 계약으로 재사용할 수 있다.

### 권한·오류 계약

- 자동 스크롤은 화면·데이터·권한을 변경하지 않고 현재 선택 항목의 표시 위치만 조정한다.
- 활성 항목이 필터 결과에서 제거됐거나 등록되지 않은 경우 hook은 아무 동작도 하지 않는다.
- 사용자 지정 `behavior`/`block`/`inline` 값이 있으면 해당 값을 그대로 전달하고, 기본값은 즉시 이동·수직 중앙·수평 nearest다.

### 검증 계획

- `useScrollActiveItem` 단위 테스트에서 활성 키 등록, 열림 전환, 선택 변경 시 `scrollIntoView` 호출과 중앙 정렬 옵션을 검증한다.
- Sidebar 통합 테스트에서 아래쪽 Workspace를 선택한 상태로 popover를 열었을 때 해당 option이 중앙 스크롤 대상이 되는지 검증한다.
- Sidebar 토글의 `24px` 클래스와 hover 계약, Workspace option의 `58px`/`6px` 계약을 회귀 테스트로 고정한다.

## 12. Workspace 전환 시 Sidebar 접힘 상태 보존

- Workspace route는 `workspaceId` 변경만으로 `HomePage`를 재마운트하지 않는다. 따라서 Sidebar의 접힘 상태는 사용자가 토글을 직접 누른 경우에만 변경된다.
- Workspace 선택, 목록·검색·로딩 상태 갱신처럼 부모가 다시 렌더링되는 동작은 현재 접힘/펼침 상태를 유지한다.
- route-level `key` 제거로 기존 Sidebar의 로컬 상태 모델과 API 계약은 유지하고, workspace 전환 동작만 보정한다.
- route 통합 테스트에서 workspace 이동 전후 HomePage 인스턴스가 동일한지 검증하고, 전체 test/lint/build/format 검사를 실행한다.
