# DESIGN.md

## 1. Source Documents

제품 요구사항:

@PRODUCT.md

이 문서는 제품의 Visual Language와 Interaction Design System을 정의한다.

각 문서의 책임은 다음과 같다.

- PRODUCT.md는 제품이 무엇을 해야 하는지 정의한다.
- DESIGN.md는 그 제품 경험을 어떻게 시각적·인터랙션적으로 표현할지 정의한다.
- tokens.json은 안정화된 exact reusable design value를 관리한다.

PRODUCT.md와 DESIGN.md의 요구사항이 충돌하는 경우 제품 요구사항을 유지하면서 다른 디자인 해결책을 찾는다.

---

## 2. Product Design Context

### Product Characteristics

디자인에 영향을 주는 제품의 특성:

- 실시간 협업 화이트보드 SaaS (Collaboration Tool)
- 워크스페이스 - 프로젝트 - 화이트보드 문서로 이어지는 3단 계층 정보 구조
- Desktop 중심이지만 Tablet/Mobile에서도 접근 가능해야 하는 Responsive 제품
- 회의/브레인스토밍 등 한 세션에 비교적 긴 시간 캔버스에 머무르는 Long Working Session
- 여러 사용자가 동시에 접속해 실시간으로 편집하는 Multi-user Real-time Collaboration (Figma/Google Docs급 Presence 표현이 필요)
- 화이트보드 편집 화면은 외부 라이브러리(Excalidraw)가 캔버스 자체를 렌더링하므로, 우리 Chrome은 캔버스를 침범하지 않고 최소한으로 감싸야 한다
- 워크스페이스/프로젝트/문서/멤버 목록처럼 List 중심 화면 비중이 높다

### Design Priorities

디자인 의사결정의 우선순위:

1. Canvas Focus — 화이트보드 편집 화면에서는 UI Chrome을 최소화해 Excalidraw 캔버스가 시각적으로 주인공이 되게 한다.
2. Collaboration Clarity — 지금 누가 접속해 있고 무엇을 편집 중인지 항상 명확하게 드러난다.
3. Fast Hierarchy Navigation — 워크스페이스 - 프로젝트 - 문서 계층을 빠르게 오갈 수 있어야 한다.
4. Trust in Autosave — 저장/복원 상태를 사용자가 항상 정확히 인지할 수 있어야 한다.
5. Low Cognitive Load in List Screens — 목록형 화면은 빠른 Scanning과 정확한 상태 파악을 우선한다.

상세한 제품 요구사항은 PRODUCT.md를 따른다.

---

## 3. Design Direction

제품이 가져야 할 전반적인 인상:

- Calm (차분함)
- Clear (명료함)
- Focused (캔버스에 집중)
- Collaborative (협업의 온기)
- Trustworthy (저장/동기화에 대한 신뢰)

### Design Statement

사용자가 UI보다 캔버스 위의 협업 자체에 집중할 수 있는, 절제된 Interface를 지향한다.

워크스페이스/프로젝트/문서를 탐색하는 화면에서는 빠른 Scanning과 명확한 상태 파악을 우선하고, 화이트보드 편집 화면에서는 Chrome을 최소화해 Excalidraw 캔버스가 화면을 지배하도록 비워 둔다.

Hierarchy는 Color나 Decoration이 아니라 Layout, Spacing, Typography, Contrast로 표현하며, 실시간 협업이라는 제품 특성상 "지금 무슨 일이 일어나고 있는가"를 사용자가 항상 신뢰할 수 있어야 한다.

Primary Accent Color는 채도 있는 Brand Hue 대신 검은색 기반의 단색을 사용해, 절제됨 안에서도 또렷하고 Confident한 인상을 준다. Calm은 흐릿함이 아니라 명확한 존재감에서 오는 차분함이며, 검은색 Primary는 이를 시각적으로 뒷받침하는 요즘 느낌의 인터랙티브한 톤을 만든다.

---

## 4. Reference Interpretation

### Primary Reference

원티드(Wanted) / 몽타주(Montage) Design System — `REFERNECE-DESIGN.md`

Reference는 복제 대상이 아니라 디자인 판단의 출발점으로 사용한다. 원티드는 채용 마켓플레이스이고 in2white는 내부 협업 도구이므로, 원티드의 시각 언어(Visual Language)만 차용하고 채용 도메인 특화 요소와 마케팅 표면 패턴은 가져오지 않는다.

---

### Preserve

Reference에서 우리 제품에도 적합하여 유지할 요소:

- Dual Neutral + Alpha Multiplier 텍스트 위계 (fg-strong/default/secondary/tertiary/disabled를 alpha 단계로 표현)
- 카드에 그림자를 쓰지 않고 1px Hairline Border로 구조를 표현하는 정책. Shadow는 Modal/Dropdown/Popover/Toast 같은 Elevated Surface에만 사용
- 화면당 단일 Primary Accent Color 정책 (Primary CTA, Active Navigation, Selected State에만 사용)
- 4px 베이스 Spacing Scale (시각 보정이 필요할 때만 2px 단위로 조정)
- Radius 8/12를 기본값으로, Pill 형태(칩·배지·아바타)에는 Radius Full 사용
- 절제된 Motion (Hover 100~150ms ease, spring/bounce/parallax 사용 안 함)
- Icon은 `currentColor`를 상속하고 외부 컬러를 직접 주입하지 않음
- 이모지 미사용, Gradient/Glassmorphism 미사용 정책
- 친근한 존댓말(`-요`/`-어요`) 톤의 한국어 Product Copy
- Component 패턴: Button(Primary/Secondary/Tertiary/Ghost/Danger), Input, Checkbox, Toggle, Avatar, Badge, Tooltip, Modal, Dropdown Menu, Tabs, List Cell, Empty State, Toast, Table

---

### Modify

좋은 방향이지만 우리 제품에 맞게 수정할 요소:

- Header의 Search Pill → 워크스페이스/프로젝트/화이트보드 문서 검색에 재사용하되, "내가 속한 범위"로 한정된 결과만 보여주도록 스코프를 명확히 표시
- Avatar의 Brand Gradient → 이미지가 없는 사용자의 기본 아바타에 한해 제한적으로 사용. Presence(실시간 참여자) 표시에는 Gradient 대신 참여자별로 구분되는 단일 Solid Color(Presence Color)를 사용
- Marketing/Dashboard용 12·8 컬럼 그리드 → 마케팅 표면이 없는 내부 도구이므로 단순한 App Shell + List/Detail 구조로 축소
- List Cell 패턴 → 잡 마켓플레이스 리스트가 아니라 워크스페이스/프로젝트/화이트보드 문서/멤버 목록의 기본 행 컴포넌트로 재사용
- Breadcrumb → 원티드보다 훨씬 자주 등장하는 핵심 내비게이션으로 격상(워크스페이스 > 프로젝트 > 문서 경로 상시 노출)
- Primary Accent Color(원티드 Blue `#0066FF`) → 브랜드 Hue를 그대로 가져오지 않고 검은색 기반의 무채색(Near-black Neutral)으로 대체. "화면당 단일 강조색" 정책(§5.5)은 유지하되, 색상 자체는 우리 제품의 절제되고 Confident한 톤에 맞게 교체한다.

---

### Avoid

우리 제품에는 적합하지 않아 가져오지 않을 요소:

- Job Card, Job Detail Hero, Hero Banner(마케팅용), Filter Bar(구인 필터 특화) 등 채용 도메인 컴포지트
- 채용보상금 강조 표시, `#해시태그` 형태의 채용 태그 칩 패턴
- 마케팅 표면을 위한 대형 Display Typography(56px 등)와 풀-블리드 Gradient Hero
- 12컬럼 마케팅 그리드, 마케팅 섹션 간 64–96px Vertical Rhythm
- Job Card 전용 Save/Bookmark 버튼, 회사 로고 타일 같은 채용 특화 Overlay 패턴

---

## 5. Design Principles

### 5.1 Hierarchy

Hierarchy는 다음 순서로 표현하는 것을 우선한다.

1. Layout
2. Spacing
3. Typography
4. Contrast
5. Color

Color와 Font Size만으로 중요도를 과도하게 표현하지 않는다.

한 화면에서 사용자가 가장 먼저 이해해야 하는 정보와 Action이 명확해야 한다. 화이트보드 편집 화면에서는 "지금 접속해 있는 사람"과 "저장 상태"가, 목록 화면에서는 "무엇을 만들 수 있는가(Primary Action)"와 "무엇이 있는가(List)"가 최우선이다.

---

### 5.2 Information Density

Page Type에 따라 Density를 다르게 설정한다.

- 워크스페이스 / 프로젝트 / 화이트보드 문서 / 멤버 목록: Medium-high (List Cell 기반, 빠른 Scanning)
- 화이트보드 편집 화면 Chrome: Low (Excalidraw 캔버스가 주인공이므로 주변 Chrome은 최소한의 정보만 노출)
- 계정 설정 / 폼 화면: Low-medium
- 멤버 추가 / 삭제 확인 등 Modal: Low

제품의 실제 사용 환경(장시간 캔버스 세션, 빈번한 목록 탐색)에 적합한 Density를 우선한다.

---

### 5.3 Whitespace

Whitespace는 Decoration이 아니라 Information Grouping을 표현하기 위해 사용한다.

Rules:

- 관련된 요소(예: 문서 이름 + 최종 수정 시각)는 가깝게 배치한다.
- 다른 의미의 Section(예: 목록 영역과 검색/필터 영역)은 충분히 분리한다.
- 단순히 깔끔해 보이기 위해 큰 여백을 사용하지 않는다.
- 화이트보드 편집 화면의 Top Bar는 캔버스 영역을 침범하지 않도록 최소 높이로 유지한다.

---

### 5.4 Surfaces

Card를 기본 Layout Container로 사용하지 않는다.

Card는 다음 경우에 사용한다.

- 워크스페이스 목록을 Grid Tile 형태로 보여줄 때(선택적 뷰)
- Modal, Dropdown, Popover 같은 Interactive/Elevated Surface
- Empty State
- Presence Avatar Stack처럼 독립적으로 인식되어야 하는 위젯

일반적인 목록(워크스페이스/프로젝트/문서/멤버)의 기본 Row는 List Cell을 사용하며, 다른 Context와의 구분은 다음을 우선한다.

- Spacing
- Typography
- Divider
- Background Difference

---

### 5.5 Color Usage

Primary Color는 의미 있는 Interaction과 State에 사용한다.

사용 가능:

- Primary CTA (워크스페이스/프로젝트/화이트보드 문서 생성 등)
- Selected State
- Active Navigation / Active Tab
- Important Interactive Control

피해야 할 사용:

- 일반 Heading Decoration
- 의미 없는 Icon Coloring
- Decorative Background
- 중요하지 않은 Badge

Semantic Color:

- Success (저장 완료, 멤버 추가 완료 등)
- Warning (네트워크 연결 불안정 등)
- Danger (삭제, 내보내기 등 파괴적 Action)
- Info (일반 안내)

상태를 Color 하나만으로 표현하지 않는다.

**예외 — Presence Color**: 실시간 협업 참여자를 구분하기 위한 Presence Color는 "화면당 단일 강조색" 원칙의 유일한 예외다. 접속한 각 사용자에게 고정된 순환 팔레트(§6.7)에서 하나의 색이 할당되어 커서·아바타 링·이름 라벨에 사용되며, 이는 UI Chrome의 나머지 부분(버튼, 내비게이션 등)의 단일 Primary Color 원칙과는 별개로 운영된다.

---

### 5.6 Visual Noise

새로운 Visual Element를 추가하기 전에 다음을 확인한다.

- 실제 정보 전달에 필요한가?
- Interaction을 이해하는 데 필요한가?
- Hierarchy를 개선하는가?
- (화이트보드 편집 화면의 경우) Excalidraw 캔버스 자체의 시각적 주도권을 방해하지 않는가?

아니라면 추가하지 않는다.

---

## 6. Design Tokens

이 섹션에서는 Token의 의미와 구조를 정의한다.

Exact Value가 안정되면 `tokens.json`으로 분리한다.

### 6.1 Colors

Recommended Semantic Tokens:

```text
background/canvas       # Excalidraw 캔버스 표면 (Chrome과 명확히 구분)
background/default
background/subtle
background/elevated

foreground/strong
foreground/default
foreground/secondary
foreground/tertiary
foreground/disabled

border/subtle
border/default
border/strong

action/primary
action/primary-hover
action/secondary

status/success
status/warning
status/danger
status/info

presence/1 ~ presence/8   # §6.7 참조
```

Component에서는 가능한 한 Raw Palette보다 Semantic Token을 사용한다. Text 위계는 별도 Gray Hex를 늘리는 대신 하나의 베이스 색에 Alpha를 곱하는 방식(예: strong=100%, default=88%, secondary=61%, tertiary=43%, disabled=28%)으로 Light/Dark 양쪽에서 일관되게 표현한다.

`action/primary`는 채도가 있는 Brand Hue가 아니라 채도 없는 짙은 Neutral(거의 검정) 단색을 사용한다. Hover/Active 같은 Interaction State는 Hue Shift가 아니라 명도(밝기) 또는 Alpha 단계로 표현한다 — 예를 들어 `action/primary-hover`는 순수 검정보다 한 단계 밝은 톤을 사용해 클릭 가능함을 드러낸다. Presence Color(§6.7)를 포함한 나머지 팔레트(Semantic Color, Neutral 팔레트)는 이 변경과 무관하게 그대로 유지되며, `action/primary`가 무채색이므로 다른 색상들과 자연스럽게 구분된다.

---

### 6.2 Typography

Typography Hierarchy는 단순하게 유지한다. in2white는 마케팅 표면이 없으므로 Display 단계는 두지 않는다.

Recommended Roles:

- Heading 1 (페이지 타이틀 — 워크스페이스명, 프로젝트명 등)
- Heading 2 (섹션 타이틀)
- Heading 3 (리스트 항목/카드 타이틀)
- Body (기본 본문)
- Body Small (보조 정보)
- Caption (메타 정보 — 생성일, 수정일 등)
- Label (폼 라벨, 버튼 텍스트)

각 Role에 대해 다음을 정의한다.

- Font Family
- Font Size
- Font Weight
- Line Height
- Letter Spacing

Page마다 임의의 Font Size를 추가하지 않는다. 17px 이상 Heading에는 일관된 Negative Tracking을 적용해 타이트한 인상을 유지한다.

---

### 6.3 Spacing

일관된 Spacing Scale을 사용한다.

```text
4
8
12
16
24
32
48
64
```

기본은 4의 배수이며, 시각 보정이 필요할 때만 2px 단위로 조정한다. 임의의 Spacing Value를 가능한 한 추가하지 않는다.

---

### 6.4 Radius

Radius 종류를 최소화한다.

- radius-sm (4)
- radius-md (8) — Button, Input, Card 기본값
- radius-lg (12) — Modal, Dropdown 등 Elevated Surface
- radius-full — Chip, Badge, Avatar, Pill Button

모든 Component에 Rounded Style을 적용하지 않는다. 화이트보드 편집 화면의 Canvas Top Bar처럼 캔버스와 맞닿는 요소는 과한 Radius로 캔버스와 시각적으로 경쟁하지 않도록 절제한다.

---

### 6.5 Borders

Border는 구조 또는 Interaction State를 표현하기 위해 사용한다.

강한 Border를 기본값으로 사용하지 않는다. 기본은 1px `border/subtle` Hairline이며, Input Focus 등 상태 표현에는 `action/primary` 컬러 Border + 옅은 Glow를 사용한다.

---

### 6.6 Shadows

Shadow는 실제 Elevation이 필요한 경우에만 사용한다.

예:

- Modal
- Popover
- Dropdown
- Toast
- Floating UI (Version History Panel 등)

일반 Card와 List Cell, 화이트보드 캔버스 영역에는 강한 Shadow를 사용하지 않는다.

---

### 6.7 Presence Colors

실시간 협업 참여자를 시각적으로 구분하기 위한 전용 팔레트다. 다른 Semantic Token과 달리 의미(성공/경고 등)를 갖지 않고 오직 "구분"만을 목적으로 한다.

- 최소 6~8개의 서로 뚜렷이 구분되는 Solid Color로 구성한다 (원티드의 Accent Ramp인 lime/cyan/sky/violet/purple/pink 계열 등에서 파생 가능).
- 각 참여자는 세션 접속 시 순환 방식으로 하나의 Presence Color를 할당받는다.
- 커서, 이름 라벨 배경, Presence Avatar Stack의 Ring에 동일한 색을 일관되게 사용한다.
- 색맹 사용자를 고려해 색상만으로 구분하지 않고 항상 이름 라벨(텍스트)을 함께 표시한다.
- Primary Action Color(§6.1 `action/primary`)와 중복되는 색조는 Presence 팔레트에서 제외해 "이것이 내 작업인지 시스템 강조인지" 혼동을 방지한다.

정확한 색상값은 `tokens.json`에서 관리한다.

---

## 7. Layout

### 7.1 Page Structure

in2white는 세 가지 Shell을 갖는다.

**Auth Shell** (로그인 페이지 전용):

```text
Auth Shell
└── Centered Content (화면 중앙 정렬, 단일 컬럼)
    ├── Logo
    └── Login Form (이메일 · 비밀번호)
```

인증 전 화면이므로 Top Navigation, Breadcrumb, 계정 메뉴 등 로그인된 사용자 전용 요소를 전혀 노출하지 않는다. 회원가입 기능이 없으므로 로그인 ↔ 회원가입 모드 전환 UI도 두지 않는다. 화면에는 Logo와 Login Form 하나만 존재하는 최소 구조를 유지한다.

**App Shell** (워크스페이스/프로젝트/문서 목록, 멤버 목록, 계정 설정 등 탐색·관리 화면):

```text
App Shell
├── Top Navigation (로고, 워크스페이스 전환, 계정 메뉴)
└── Main
    ├── Page Header (타이틀 + Breadcrumb + Primary Action)
    ├── Search / Filter
    └── List Content
```

**Canvas Shell** (화이트보드 실시간 편집 화면 전용):

```text
Canvas Shell
├── Minimal Top Bar (뒤로가기, 문서명, 저장 상태, Presence Stack)
└── Full-bleed Canvas (Excalidraw)
```

Auth Shell과 Canvas Shell 모두 App Shell의 Top Navigation·Sidebar를 두지 않는다 — Auth Shell은 아직 인증되지 않은 사용자이기 때문이고, Canvas Shell은 캔버스가 최대한 넓은 시야를 확보해야 하기 때문이다.

---

### 7.2 Container

- App Shell Main Content: Max Width 1200px, 좌우 Padding 24px
- Canvas Shell: Full-width / Full-height (Container 제약 없음), Top Bar만 내부 Padding 16px 적용
- Content Alignment: 목록/폼 화면은 Center Alignment, Canvas는 Full-bleed

---

### 7.3 Grid

- 목록 화면(프로젝트/화이트보드 문서/멤버)은 기본적으로 단일 컬럼 List를 사용한다.
- 워크스페이스 목록은 필요 시 2~4열 Card Grid로 표시할 수 있다 (Gap 16~24px).
- 별도의 12컬럼 마케팅 그리드는 사용하지 않는다 — 이 제품에는 마케팅 표면이 없다.

---

### 7.4 Navigation

- **Primary Navigation**: Top Bar — 로고/워크스페이스 전환, 검색, 계정 메뉴
- **Secondary Navigation**: Breadcrumb — 워크스페이스 > 프로젝트 > 화이트보드 문서 경로를 항상 노출한다. 계층이 3단으로 얕기 때문에 별도의 상시 Sidebar는 두지 않는다.
- **Active State**: 현재 위치는 Breadcrumb의 마지막 항목 또는 Tab의 Active Underline으로 표현한다.
- **Collapsed State**: Tablet 이하에서는 Top Bar의 검색이 Icon Button으로 축약된다.
- **Mobile Behavior**: Breadcrumb은 이전 단계로 가는 뒤로가기 버튼 하나로 축약될 수 있다.

Auth Shell(§7.1)에는 Primary/Secondary Navigation이 전혀 없다 — 인증 전 화면이므로 탐색 요소를 두지 않는다.

Navigation 구조는 PRODUCT.md의 Information Architecture(§8)를 따른다.

---

### 7.5 Responsive

최소 다음 환경을 고려한다.

- Desktop (주 환경)
- Tablet
- Mobile

Responsive에서는 단순히 Width만 줄이지 않는다. 필요하면 구조를 변경한다.

예:

- App Shell Top Navigation → Mobile에서 Hamburger/Drawer
- 워크스페이스 Card Grid → Mobile에서 단일 컬럼 List
- Canvas Shell Top Bar의 Presence Avatar Stack → Mobile에서 개수 축약(+N 표시)
- Modal → Mobile에서 Full-screen Sheet 또는 Bottom Sheet
- Auth Shell → Mobile에서도 동일한 중앙 정렬 단일 컬럼 구조를 유지하며 별도 Collapse가 필요 없다

---

## 8. Components

각 Component에는 가능한 한 다음을 정의한다.

- Purpose
- When to Use
- When Not to Use
- Visual Hierarchy
- Variants
- States
- Accessibility

---

### 8.1 Button

#### Primary

가장 중요한 Action에 사용한다 (워크스페이스/프로젝트/화이트보드 문서 생성, 멤버 추가 등).

Rules:

- 한 Viewport에 Visually Dominant한 Primary Action을 과도하게 만들지 않는다.
- 목록 화면당 Primary Button은 원칙적으로 하나다.
- 배경은 검은색 기반 `action/primary`, 텍스트는 흰색을 사용해 충분한 Contrast를 확보한다.

Do Not Use For:

- Cancel
- 일반 Navigation
- 낮은 중요도의 Action

#### Secondary

보조 Action에 사용한다 (검색 결과 초기화, 취소 등). Primary와 시각적으로 경쟁하지 않는다.

#### Tertiary

Secondary보다 약한 위계의 보조 Action에 사용한다 (예: 목록 화면의 "새로고침").

#### Ghost

텍스트에 가까운 가장 약한 위계 (예: "더 보기").

#### Destructive

삭제, 내보내기, 워크스페이스/프로젝트/문서 삭제처럼 되돌리기 어려운 Action에 사용한다. Danger Semantic Token을 사용하며, 삭제 확인 Modal의 확정 버튼에 사용된다.

Required States:

- Default
- Hover
- Focus
- Active
- Disabled
- Loading

---

### 8.2 Input

Rules:

- Label을 Placeholder로 대체하지 않는다.
- Error Message는 해당 Field와 직접 연결한다 (예: 비밀번호 확인 실패).
- 필요한 입력 조건을 명확하게 전달한다.

Required States:

- Default
- Hover
- Focus
- Filled
- Disabled
- Error
- Success

---

### 8.3 Select

제한된 선택지에서 하나 또는 여러 값을 선택할 때 사용한다. in2white에서는 사용 빈도가 낮으며(예: 없음), 향후 확장 시 이 규칙을 따른다.

---

### 8.4 Checkbox

독립적인 Boolean 선택 또는 Multiple Selection에 사용한다 (예: 멤버 목록에서 여러 멤버 선택 후 일괄 내보내기 — 향후 확장 시).

---

### 8.5 Radio

서로 배타적인 소수의 선택지에 사용한다. 현재 in2white에는 구체적으로 적용된 화면이 없다.

---

### 8.6 Table

숫자 비교·다단 정렬처럼 진짜 표 형태가 필요한 화면에서만 사용한다. in2white의 워크스페이스/프로젝트/화이트보드 문서/멤버 목록은 모두 List Cell(§8.13)을 기본 행 Component로 사용하며, 현재는 Table을 실제로 사용하는 화면이 없다 — 향후 다단 데이터 비교가 필요한 화면이 생기면 사용한다.

Rules:

- Text: Left Align
- Number/Date: Right Align
- Actions: Right Align
- Header와 Cell Alignment를 일치시킨다.
- 필요 없는 Vertical Border를 사용하지 않는다.
- Row Hover는 Subtle하게 표현한다.
- 역할(Owner/Member) 같은 중요한 상태는 Badge로 빠르게 Scan할 수 있어야 한다.

정의할 것:

- Row Density
- Header Hierarchy
- Sorting (필요 시)
- Empty State
- Loading

---

### 8.7 Card

독립적인 Surface에만 사용한다. 워크스페이스 목록을 Grid Tile로 보여줄 때, 또는 Empty State/Presence Widget처럼 명확히 분리되어야 하는 Surface에 한정한다.

기본 Section Container로 사용하지 않는다.

---

### 8.8 Modal

현재 User Flow를 중단해야 할 정도로 중요한 작업에 사용한다.

사용처: 멤버 추가(전체 사용자 목록 검색·선택, §8.19 참고), 워크스페이스·프로젝트·화이트보드 문서 삭제 확인, 멤버 내보내기 확인.

단순 정보 표시에 남용하지 않는다. 파괴적 Action의 확인 Modal에는 항상 Destructive Button을 사용한다.

이름 변경(Rename)에는 사용하지 않는다 — 프로젝트/화이트보드 문서 이름 변경은 Modal이 아니라 인라인 편집(§8.13, §8.16 참고)을 사용한다.

---

### 8.9 Dropdown Menu

여러 Secondary Action을 Compact하게 제공할 때 사용한다.

사용처: 프로젝트/화이트보드 문서의 컨텍스트 메뉴(삭제 등), 계정 메뉴(계정 설정, 로그아웃).

파괴적 항목(삭제 등)은 Danger Color로 구분하고, 필요 시 Separator로 일반 항목과 그룹을 나눈다.

**권한 없는 항목은 표시하지 않는다.** Owner 또는 생성자에게만 허용된 Action(삭제 등)은 권한이 없는 사용자에게 Disabled 상태로 보여주지 않고, 메뉴 항목 자체를 렌더링하지 않는다. 예를 들어 본인이 만들지 않은 프로젝트의 컨텍스트 메뉴에는 "삭제" 항목이 처음부터 존재하지 않는다.

"이름 변경"은 별도 메뉴 항목으로 두지 않는다 — Title을 더블클릭하거나 편집 아이콘을 눌러 바로 인라인 편집 모드로 전환한다(§8.13, §8.16 참고).

---

### 8.10 Tabs

같은 Context에서 관련된 Content Group을 전환할 때 사용한다.

현재 in2white에는 구체적으로 적용된 화면이 없다 — 향후 한 화면 안에서 여러 Content Group을 전환해야 하는 요구가 생기면 사용한다.

Navigation Hierarchy(Breadcrumb)를 대체하지 않는다.

---

### 8.11 Badge

Status 또는 Category처럼 실제 Semantic Meaning이 있을 때 사용한다.

사용처: 멤버 역할(Owner/Member).

Decoration 용도로 사용하지 않는다.

---

### 8.12 Tooltip

Icon-only Control 또는 추가 설명이 필요한 경우 사용한다.

사용처: 헤더의 Icon Button 설명, Presence Avatar Stack에서 각 아바타 Hover 시 이름 표시.

중요한 정보를 Tooltip 안에만 숨기지 않는다.

---

### 8.13 List Cell

워크스페이스/프로젝트/화이트보드 문서/멤버 목록의 기본 행 Component.

Slots: Leading(아이콘/아바타) · Body(Title + Sub) · Trailing(메타 정보, Chevron, 또는 Action).

Rules:

- Title은 가장 강한 Typography Weight를 사용하고, Sub(생성자/최종 수정일 등)는 Secondary Color로 표현한다.
- Interactive Row(클릭 시 상세로 이동)는 Hover 시 Subtle Background로 눌리는 느낌을 준다.
- 목록 전체를 Card로 감싸지 않는다 — Divider 또는 Background Difference로 구분한다.
- Trailing Action(⋮ 메뉴 등)은 현재 사용자가 수행 가능한 Action이 하나도 없으면 아이콘 자체를 표시하지 않는다. 일부만 가능하면 가능한 Action만 메뉴에 노출한다(§8.9 참고).

**Rename Variant** (프로젝트/화이트보드 문서 목록에서 사용):

- Owner 또는 생성자에게는 Title을 더블클릭(또는 Trailing의 편집 아이콘 클릭)하면 즉시 편집 가능한 텍스트 필드로 전환된다. 별도 Modal을 띄우지 않는다.
- Enter 또는 Blur 시 자동 저장되며, Esc로 취소할 수 있다.
- Owner도 생성자도 아닌 사용자에게는 Title이 읽기 전용 텍스트로만 보인다(더블클릭해도 편집 모드로 전환되지 않는다).

---

### 8.14 Presence Avatar Stack

현재 화이트보드 문서에 접속 중인 사용자를 겹쳐서 보여주는 Component.

Rules:

- 각 Avatar는 §6.7 Presence Color의 Ring으로 감싸 참여자를 구분한다.
- Hover 시 Tooltip으로 이름을 노출한다.
- 접속 인원이 많을 경우 일정 개수 이후 "+N"으로 축약한다.
- Canvas Shell Top Bar의 우측에 고정 위치로 배치한다.
- 본인은 이 Stack에 포함하지 않는다 — 현재 접속 중인 다른 사용자만 표시한다.

---

### 8.15 Live Cursor

다른 참여자가 캔버스에서 실시간으로 움직이는 커서를 표현하는 Component.

Rules:

- 커서 색상은 해당 참여자의 Presence Color를 따른다.
- 커서 옆에 작은 이름 라벨을 함께 표시해 색상만으로 구분하지 않는다.
- Excalidraw 캔버스 좌표계 위에 오버레이되며, App Chrome 스타일(Radius, Shadow 등)과 직접 통일할 필요는 없다 — 캔버스 라이브러리의 시각 언어를 우선한다.

---

### 8.16 Canvas Top Bar

화이트보드 편집 화면(Canvas Shell) 전용 최소 Chrome.

Slots: 뒤로가기 · 문서명 · 저장 상태(Saving/Saved 표시) · Presence Avatar Stack · 문서 메뉴(삭제 등, Owner 또는 생성자에게만 표시).

Rules:

- 높이를 최소화해 캔버스 영역을 최대한 확보한다.
- 배경은 `background/default`를 사용하고, 캔버스(`background/canvas`)와 명확히 구분되는 하단 Hairline Border를 둔다.
- 저장 상태는 Icon + Label로 표현하고, Color만으로 표현하지 않는다.
- 문서명은 Owner 또는 생성자에게만 인라인 편집이 가능하다(§8.13 Rename Variant와 동일한 방식 — 더블클릭 시 즉시 편집, Modal 없음). 그 외 사용자에게는 읽기 전용 텍스트로 보인다.
- 문서 메뉴의 "삭제" 항목은 Owner 또는 생성자가 아니면 메뉴 자체에 렌더링하지 않는다(§8.9 참고) — Disabled로 보여주지 않는다.

---

### 8.17 Empty State

가능하면 다음을 제공한다.

- 현재 상태 (예: "아직 프로젝트가 없어요")
- 비어 있는 이유
- 다음 Action (Primary Button)

단순히 "No data"만 표시하지 않는다. 이모지 대신 Monochrome Icon을 사용한다.

**Permission Denied Variant**: 워크스페이스 홈/프로젝트 상세/화이트보드 문서/멤버 목록 페이지에 접근 권한이 없을 때도 동일한 구조(아이콘 + 메시지 + Action)를 재사용한다. 메시지는 "이 워크스페이스에 접근할 권한이 없어요"처럼 상황을 명확히 설명하고, Action은 "워크스페이스 목록으로 돌아가기"처럼 사용자가 이동할 곳을 제공한다. 다른 페이지로 자동 리다이렉트하지 않고, 요청한 페이지 자리에 그대로 표시한다.

---

### 8.18 Toast

일시적인 System Feedback에 사용한다.

사용처: 저장 완료, 저장 오류, 멤버 추가 완료, 멤버 내보내기 완료.

Dismiss 없이 자동으로 사라지며, 중요한 확인이 필요한 정보(예: 삭제 여부)에는 사용하지 않는다 — 그 경우 Modal(§8.8)을 사용한다.

---

### 8.19 User Picker (멤버 추가)

워크스페이스 소유자가 전체 사용자 목록에서 검색해 워크스페이스 멤버로 직접 추가하는 Component.

Rules:

- Modal(§8.8) 안에서 사용된다.
- 이름/이메일로 검색하면 전체 사용자 목록이 필터링되어 표시된다.
- 이미 해당 워크스페이스 멤버인 사용자는 "이미 멤버" 상태로 표시되어 중복 선택을 방지한다.
- 목록의 각 행은 List Cell(§8.13)을 재사용한다 (아바타 + 이름/이메일).
- 사용자를 선택해 추가하면 별도 수락 절차 없이 즉시 워크스페이스 멤버가 된다 — 초대 승인 대기 상태가 없으므로 추가 확인 Modal은 필요하지 않다.

---

### 8.20 Search

워크스페이스/프로젝트/화이트보드 문서/멤버 목록에서 원하는 항목을 빠르게 찾는 Component. User Picker(§8.19)의 전체 사용자 검색에도 동일하게 재사용된다.

Rules:

- 입력하는 즉시(짧은 디바운스 적용) 같은 화면의 목록을 실시간으로 필터링한다 — Enter 입력이나 별도 "검색" 버튼을 요구하지 않는다.
- 검색 결과는 별도 드롭다운 미리보기 패널이 아니라, 화면에 있는 List Cell 목록 자체를 다시 그리는 방식으로 보여준다.
- 검색 범위는 항상 현재 컨텍스트로 한정된다 — 예를 들어 프로젝트 상세 페이지의 검색은 해당 프로젝트 안의 화이트보드 문서만 대상으로 하고, 다른 프로젝트의 문서는 포함하지 않는다.
- 검색어를 지우면 즉시 전체 목록으로 돌아간다.

States: Default, Focus, Empty(검색 결과 없음 — §8.17 Empty State의 구조를 재사용).

---

## 9. Product Patterns

### 9.1 Dashboard

in2white에는 별도의 Metric Dashboard가 없다. 워크스페이스 목록 페이지가 사실상 진입 화면 역할을 하며, PRODUCT.md에 정의되지 않은 Metric이나 Chart를 임의로 추가하지 않는다.

---

### 9.2 List

Recommended Structure (워크스페이스/프로젝트/화이트보드 문서/멤버 목록에 공통 적용):

```text
Page Header (+ Breadcrumb)
↓
Search(§8.20) / Primary Action
↓
List Cell
↓
Empty State (목록이 비어 있을 때)
```

---

### 9.3 Detail

in2white에는 전형적인 "Detail 페이지"보다 Canvas 편집 화면이 그 역할을 겸한다. 다만 프로젝트 상세(화이트보드 문서 목록)처럼 List형 Detail 화면에는 다음을 적용한다.

Rules:

- 핵심 Identity(프로젝트/워크스페이스 이름)와 Breadcrumb을 상단에서 빠르게 이해할 수 있어야 한다.
- 정보 관계를 기준으로 Section을 나눈다.
- 모든 Section을 Card로 만들지 않는다.

---

### 9.4 Form

Rules:

- 관련 Field를 Grouping한다 (예: 계정 설정의 이름 변경과 비밀번호 변경을 별도 그룹으로 분리).
- Section 간 Spacing은 일반 List보다 넓게 사용할 수 있다.
- Submit Action은 명확해야 한다.
- Validation은 문제 발생 위치와 가까워야 한다 (예: 기존 비밀번호 확인 실패 메시지는 해당 Input 바로 아래).

로그인 폼은 Auth Shell(§7.1) 위에서 렌더링되며 위 규칙을 동일하게 따른다.

---

### 9.5 Settings

계정 설정은 이해하기 쉽고 예측 가능해야 한다.

위험한 설정(워크스페이스 삭제 등)은 일반 설정과 명확히 구분한다 — 별도 Section 또는 Destructive Button으로 시각적으로 분리한다.

---

### 9.6 Empty State

§8.17 참조.

---

### 9.7 Loading

Layout Shift를 최소화한다.

상황에 따라 다음을 사용한다.

- Skeleton (목록/Table 초기 로딩)
- Spinner (Canvas 초기 로딩)
- Optimistic State (텍스트/이름 변경 등 즉시 반영 후 서버 확인)

---

### 9.8 Error

Error는 사용자가 다음을 이해할 수 있어야 한다.

- 무엇이 실패했는가? (예: "동기화가 끊겼어요")
- 사용자가 다음에 무엇을 할 수 있는가? (예: "다시 연결을 시도해 주세요")

---

### 9.9 Canvas (화이트보드 실시간 편집)

in2white의 핵심 Product Pattern이다.

Rules:

- Canvas Shell(§7.1)을 사용하며, App Shell의 Top Navigation/Sidebar를 노출하지 않는다.
- Canvas Top Bar(§8.16)는 최소 높이를 유지해 캔버스 시야를 확보한다.
- Presence Avatar Stack(§8.14)과 Live Cursor(§8.15)로 실시간 협업 상태를 항상 드러낸다.
- 저장 상태(Saving/Saved)는 항상 눈에 띄되 방해되지 않는 위치(Top Bar)에 고정한다.
- 캔버스 자체의 Visual Language(Radius, Shadow, Color)는 Excalidraw 라이브러리의 기본값을 존중하고, App Chrome의 Design Token을 캔버스 내부 요소에 강제하지 않는다.

---

## 10. Interaction States

Interactive Component는 필요에 따라 다음 상태를 제공한다.

- Default
- Hover
- Focus
- Active
- Selected
- Disabled
- Loading
- Error
- Success

State 표현은 Component 간 일관되어야 한다. Presence/Live Cursor처럼 실시간 협업에 특화된 상태(접속 중/편집 중)는 §8.14, §8.15, §9.9의 규칙을 따른다.

---

## 11. Accessibility

최소 다음 원칙을 따른다.

- 충분한 Color Contrast
- Keyboard Focus 표시
- 상태를 Color만으로 표현하지 않음
- Placeholder를 Label 대신 사용하지 않음
- Icon-only Button에 Accessible Label 제공
- 충분한 Interaction Target Size
- Keyboard Navigation 고려
- Semantic Structure 유지
- Presence Color는 색상만으로 참여자를 구분하지 않고 항상 이름 라벨을 함께 표시한다 (색맹 사용자 고려)

---

## 12. AI Anti-Patterns

AI-generated UI에서 다음 패턴을 기본적으로 피한다.

- 모든 Section을 Rounded Card로 감싸기
- 모든 Button을 Pill 형태로 만들기
- 필요 없는 Gradient
- Glassmorphism
- Glow Effect
- 과도한 Shadow
- 의미 없는 Decorative Icon
- 의미 없는 Badge
- 거대한 Dashboard Hero Heading
- Metric Card 4개 자동 생성
- 과도한 Border Radius
- 임의의 Color 생성
- 임의의 Spacing 생성
- 임의의 Font Size 생성
- 같은 목적의 Component 중복 생성
- 기존 Component가 있는데 새로운 Component 생성
- PRODUCT.md에 없는 Chart / Metric / Action 추가
- Reference의 채용 도메인 컴포넌트(Job Card, Hero Banner, Filter Bar 등)를 그대로 이식하기
- 화이트보드 편집 화면에 App Shell Navigation을 그대로 노출해 캔버스 시야를 침해하기
- Presence Color를 8개를 초과해 늘리거나, Primary Action Color와 겹치게 만들기

제품 목적과 정보 구조가 Visual Decoration보다 항상 우선한다.

---

## 13. Design Decision Rules

새로운 UI를 설계할 때 다음 순서로 판단한다.

1. PRODUCT.md의 User Goal과 Requirement를 확인한다.
2. 기존 Product Pattern(§9)으로 해결 가능한지 확인한다.
3. 기존 Component(§8)로 해결 가능한지 확인한다.
4. 기존 Design Token(§6)으로 표현 가능한지 확인한다.
5. 새로운 Visual Pattern이 정말 필요한지 확인한다 — 특히 Canvas Shell에 새로운 Chrome을 추가하는 경우 더 엄격히 검토한다.
6. 반복적으로 사용될 결정이면 DESIGN.md에 일반 Rule로 추가한다.

Page 하나를 위한 일회성 Visual Exception은 가능한 한 만들지 않는다.

---

## 14. Design Feedback Workflow

디자인 결과에 문제가 있으면 현재 화면만 수정하기 전에 문제를 분류한다.

### Page-Specific Issue

현재 Page의 특수한 정보 구조나 요구사항 때문에 발생한 문제.

해당 Page에서 해결한다.

### Systemic Design Issue

다른 Page에서도 반복될 가능성이 있는 문제.

예:

- List Cell이 항상 너무 널널하다.
- Primary Button이 너무 많이 등장한다.
- Card가 지나치게 많다.
- Canvas Top Bar가 캔버스 시야를 과도하게 침해한다.

이 경우:

1. 문제를 일반적인 Design Rule로 변환한다.
2. DESIGN.md를 업데이트한다.
3. 필요한 경우 Token 또는 Component를 업데이트한다.
4. 영향을 받는 Page에 다시 적용한다.

---

## 15. Token Extraction

DESIGN.md가 충분히 안정되면 exact reusable value를 `tokens.json`으로 추출한다.

DESIGN.md에 유지할 것:

- Design Intent
- Design Principles
- Semantic Meaning
- Component Usage Rule
- Product Pattern
- Design Decision Rule

tokens.json으로 이동할 것:

- Exact Colors (Presence Color Palette 포함)
- Spacing Values
- Font Sizes
- Line Heights
- Radius Values
- Shadows
- Control Heights
- Breakpoints
- 반복되는 Numeric Design Value

같은 Exact Value를 DESIGN.md와 tokens.json 양쪽에서 중복 관리하지 않는다.

---

## 16. Relationship With Other Documents

```text
PRODUCT.md
=
제품이 무엇을 해야 하는가.

DESIGN.md
=
제품 경험을 어떻게 표현해야 하는가.

tokens.json
=
정확한 reusable design value.

CLAUDE.md
=
AI Agent가 위 문서들을 어떻게 사용해야 하는가.
```

PRODUCT.md 변경:

- Product Requirement
- User Flow
- Information Architecture
- Business Rule
- Permission

등이 변경된 경우.

DESIGN.md 변경:

- Design Principle
- Component Usage Rule
- Product Pattern
- 반복 가능한 Visual Decision

이 변경된 경우.

tokens.json 변경:

- Exact Color
- Spacing
- Typography Value
- Radius
- Shadow
- Dimension
- Breakpoint

등 정확한 값이 변경된 경우.
