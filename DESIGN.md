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
- Breadcrumb → 원티드보다 훨씬 자주 등장하는 핵심 내비게이션으로 격상하되, 워크스페이스 표시는 Sidebar Workspace Switcher(§8.21)가 전담하므로 Breadcrumb은 프로젝트 > 문서 경로만 노출한다
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

- 워크스페이스 / 프로젝트 / 화이트보드 문서 / 멤버 목록: High (List Cell 기반, 한 화면에 최대한 많은 행을 담아 빠르게 Scanning)
- 화이트보드 편집 화면 Chrome: Low (Excalidraw 캔버스가 주인공이므로 주변 Chrome은 최소한의 정보만 노출)
- 계정 설정 / 폼 화면: Medium
- 멤버 추가 / 삭제 확인 등 Modal: Medium

제품의 실제 사용 환경(장시간 캔버스 세션, 빈번한 목록 탐색)에 적합한 Density를 우선한다.

**Compact-first 원칙**: in2white는 마케팅 표면이 없는 업무용 도구이고, 사용자는 하루에 여러 번 같은 목록을 훑는다. 따라서 Reference(원티드)의 마케팅 지향 스케일을 그대로 쓰지 않고, Control Height · Font Size · Padding을 한 단계 낮춘 Compact 스케일을 기본값으로 사용한다.

- Reference에서 값을 가져올 때는 그대로 이식하지 않고 Compact 단계로 환산해 적용한다.
- 넓은 여백은 "고급스러움"이 아니라 Scanning 비용으로 취급한다 — 여백을 늘리려면 §5.3의 Grouping 근거가 있어야 한다.
- Density를 낮추고 싶을 땐 Padding을 키우기 전에 표시할 정보량 자체를 줄이는 쪽을 먼저 검토한다.
- 단, Accessibility(§11)의 최소 Interaction Target Size는 Compact 스케일보다 우선한다 — Target이 작아지는 경우 Padding 대신 Hit Area를 확장한다.

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
background/canvas       # Excalidraw 캔버스 표면 전용 (Chrome과 명확히 구분). Auth Shell/App Shell 등 다른 화면의 페이지 배경에는 사용하지 않는다 — 페이지 프레임 배경은 항상 background/default(흰색)를 사용한다.
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
- Card Title (Card 컴포넌트 §8.7 전용 타이틀)
- Heading 3 (리스트 항목 타이틀)
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

**Compact Type Scale**(§5.2): Role의 크기 차이는 Font Size를 키워서 만들지 않고 Weight와 Color(Alpha 위계)로 우선 표현한다.

- Heading 1(페이지 타이틀)은 Reference의 마케팅급 크기를 쓰지 않고 Body보다 한두 단계 위에서 멈춘다 — App Shell의 Page Header는 페이지를 식별하는 라벨이지 Hero Heading이 아니다.
- Heading 3(List Cell Title)은 Body와 같은 크기에서 Weight만 올려 구분한다.
- Caption/Body Small은 목록의 메타 정보 밀도를 위해 Body보다 확실히 작게 유지한다.
- Font Size는 정보 위계를 만드는 마지막 수단이다(§5.1).

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

Compact-first(§5.2)에 따라 Scale의 사용 구간을 다음과 같이 제한한다.

- Component 내부 Padding과 인접 요소 Gap: 4 ~ 16 구간에서 선택한다.
- Section 간 분리: 16 ~ 32 구간에서 선택한다.
- 48 · 64는 Auth Shell의 중앙 정렬 블록, Empty State의 상하 여백처럼 "의도적으로 비어 있어야 하는 표면"에만 사용한다.
- 목록 화면의 어떤 인접 요소도 32를 넘는 Gap으로 분리하지 않는다.

---

### 6.4 Radius

Radius 종류를 최소화한다.

- radius-sm (4) — Badge 등 작은 요소
- radius-md (8) — Button, Input, Card 기본값
- radius-lg (12) — Modal, Dropdown 등 Elevated Surface
- radius-full — Chip, Avatar, Pill Button(검색 필드 등)

Control이 Compact해질수록 Radius도 함께 낮춘다 — 높이가 작은 Control에 큰 Radius를 유지하면 Pill에 가까워져 형태 위계가 무너진다.

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

### 6.8 Iconography

Icon Library로 Lucide Icons를 사용한다(Stroke 기반).

- Icon은 `currentColor`를 상속하고 외부 컬러를 직접 주입하지 않는다(§4 Preserve).
- Stroke Width는 Icon 전체에서 통일한다.
- Decorative Icon을 추가하지 않는다 — 모든 Icon은 실제 의미(Action, Category, Navigation)를 가져야 한다(§12).

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

**App Shell** (워크스페이스 내부 화면 — 프로젝트/화이트보드 문서 목록, 멤버 목록, 계정 설정 등 탐색·관리 화면):

```text
App Shell
├── Sidebar (§8.21 — Workspace Switcher, Projects/Members 내비게이션, 계정/로그아웃)
└── Main
    ├── Page Header (타이틀 + Breadcrumb + Primary Action)
    ├── Search / Filter
    └── List Content
```

로그인 성공 시 사용자는 곧바로 자신의 (마지막 접속) 워크스페이스로 진입하므로(PRODUCT.md §7), App Shell은 항상 하나의 워크스페이스 컨텍스트 안에서 렌더링된다. Sidebar가 이 컨텍스트(어떤 워크스페이스에 있는지, Projects/Members 중 어디에 있는지)를 상시 고정해서 보여주고, 다른 워크스페이스로의 전환·생성·설정은 Sidebar 상단의 Workspace Switcher가 담당한다(§8.21).

**예외 — 워크스페이스 목록 페이지**: 아직 워크스페이스 컨텍스트가 없는 유일한 인증 후 화면이므로 Sidebar 없이 렌더링된다. 로고와 계정 메뉴만 있는 최소 Top Bar를 사용한다 — Sidebar를 쓰는 다른 App Shell 화면들과의 유일한 예외다.

**Canvas Shell** (화이트보드 실시간 편집 화면 전용):

```text
Canvas Shell
├── Minimal Top Bar (뒤로가기, 문서명, 저장 상태, Presence Stack)
└── Full-bleed Canvas (Excalidraw)
```

Auth Shell과 Canvas Shell 모두 App Shell의 Top Navigation·Sidebar를 두지 않는다 — Auth Shell은 아직 인증되지 않은 사용자이기 때문이고, Canvas Shell은 캔버스가 최대한 넓은 시야를 확보해야 하기 때문이다.

---

### 7.2 Container

- App Shell Main Content: Max Width 1200px, 좌우 Padding 20px
- App Shell Main Content 상하 Padding: 상단 24px / 하단 48px (하단은 Scroll 종료 여유)
- Canvas Shell: Full-width / Full-height (Container 제약 없음), Top Bar만 내부 Padding 16px 적용
- Content Alignment: 목록/폼 화면은 Center Alignment, Canvas는 Full-bleed
- Auth Shell 중앙 블록: Max Width 336px (한 줄 입력 폼에 필요한 최소 너비)

---

### 7.3 Grid

- 목록 화면(프로젝트/화이트보드 문서/멤버)은 기본적으로 단일 컬럼 List를 사용한다.
- 워크스페이스 목록은 필요 시 2~4열 Card Grid로 표시할 수 있다 (Gap 12px, Tile 최소 너비 232px — Compact 스케일 §5.2).
- 별도의 12컬럼 마케팅 그리드는 사용하지 않는다 — 이 제품에는 마케팅 표면이 없다.

---

### 7.4 Navigation

- **Primary Navigation**: Sidebar(§8.21) — Workspace Switcher, Projects/Members, 계정/로그아웃. 워크스페이스 컨텍스트가 없는 워크스페이스 목록 페이지만 예외적으로 로고+계정 메뉴만 있는 최소 Top Bar를 사용한다(§7.1).
- **Secondary Navigation**: Breadcrumb — 프로젝트 > 화이트보드 문서 경로를 노출한다. 워크스페이스는 Sidebar Workspace Switcher가 상시 표시하므로 Breadcrumb에서 반복하지 않는다.
- **Active State**: 현재 위치는 Sidebar Nav Item의 Active 상태(§8.21) 또는 Breadcrumb의 마지막 항목, Tab의 Active Underline으로 표현한다.
- **Collapsed State**: Sidebar는 Icon-only Collapsed 상태를 지원한다(§8.21). Tablet 이하에서는 Search도 Icon Button으로 축약될 수 있다. Collapse/Expand Toggle은 Sidebar 우측 상단에 고정되어 Expanded/Collapsed 두 상태에서 동일한 위치를 유지한다(§8.21) — 콘텐츠 행 안에 두면 상태마다 위치를 다시 정의해야 하므로, 어느 행에도 속하지 않는 독립된 요소로 둔다.
- **Mobile Behavior**: Sidebar는 Drawer로 전환되고, Breadcrumb은 이전 단계로 가는 뒤로가기 버튼 하나로 축약될 수 있다.

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

- App Shell Sidebar → Tablet에서 Collapsed(Icon-only), Mobile에서 Drawer로 전환
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

#### Size

Compact-first(§5.2)에 따라 Button은 두 단계만 둔다.

- **Default** — 목록 화면의 Page Header Action, 검색 영역의 보조 Action 등 App Shell 안에서 쓰는 기본 크기. 화면 밀도에 맞춰 Compact하게 유지한다.
- **Large** — Auth Shell의 로그인 Submit, Modal의 확정 Action처럼 화면에 Action이 하나뿐이고 그것이 곧 화면의 목적인 경우에만 사용한다.

목록 화면 안에서 Large를 사용하지 않는다 — Primary Action은 위치(Page Header 우측)와 색으로 이미 구분되므로 크기까지 키우면 목록보다 무거워진다. 정확한 Control Height 값은 `tokens.json`(§15)에서 관리한다.

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

#### Size

Button(§8.1)과 같은 두 단계를 사용하고, 같은 폼 안에서는 Input과 Submit Button의 높이를 일치시킨다. 목록 화면의 인라인 검색 필드는 Default 단계를 사용해 Page Header와 목록 사이에서 시각적으로 튀지 않게 한다.

#### Textarea

프로젝트 설명처럼 여러 줄 입력이 필요한 선택적 필드에 사용한다(예: 프로젝트 생성 Modal §8.8의 "설명"). Input과 동일한 배경·테두리·Radius·폰트를 사용하되, 높이만 여러 줄에 맞게 확장하고 텍스트를 상단 정렬한다. 별도 State 매트릭스를 새로 정의하지 않고 Input의 Default/Focus/Disabled/Error 규칙을 그대로 따른다.

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

숫자 비교·다단 정렬처럼 진짜 표 형태가 필요한 화면에서만 사용한다. in2white의 워크스페이스/프로젝트/화이트보드 문서/멤버 목록은 기본적으로 List Cell(§8.13)을 행 Component로 사용한다.

**예외 — 프로젝트 목록**: 워크스페이스 홈(프로젝트 목록) 페이지는 Card Grid(§7.3, 기본값)와 Table 두 View를 모두 제공한다. 사용자가 Toolbar의 View Toggle(Card/Table Icon Button)로 전환하며, 마지막 선택은 유지된다. Table View의 컬럼은 PRODUCT.md의 Required Information(이름/생성자/생성일/수정일)에 컨텍스트 메뉴 Icon Button(⋮) 열을 맨 끝에 추가한 구성이다 — 항목은 Card(§8.7)와 동일하게 이름 변경 · 설명 변경 · 프로젝트 삭제(§8.9 "프로젝트 카드 컨텍스트 메뉴" Example 참고)이며, 권한 없는 사용자에게는 열 자체가 표시되지 않는다.

**예외 — 화이트보드 문서 목록**: 프로젝트 상세(화이트보드 문서 목록) 페이지도 동일하게 Card Grid(기본값)와 Table 두 View를 제공한다. Table View 컬럼은 이름/생성자/생성일/수정일 + 컨텍스트 메뉴 Icon Button(⋮) 열이며, Whiteboard Card(§8.7)와 동일한 메뉴(§8.9 "화이트보드 문서 컨텍스트 메뉴" Example)를 연다.

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

독립적인 Surface에만 사용한다. 워크스페이스/프로젝트 목록을 Grid Tile로 보여줄 때, 또는 Empty State/Presence Widget처럼 명확히 분리되어야 하는 Surface에 한정한다.

기본 Section Container로 사용하지 않는다.

Slots: Header(Leading Icon(선택) + 우측 정렬 컨텍스트 메뉴 Icon Button(⋮)) · Title · Description(선택) · Meta(생성일·수정일 등 보조 정보) · Divider · Footer(생성자 Avatar + 이름).

컨텍스트 메뉴 Icon Button은 클릭 시 Dropdown Menu(§8.9)를 연다 — 항목 구성은 §8.9의 "프로젝트 카드 컨텍스트 메뉴" Example 참고. 현재 사용자에게 가능한 Action이 하나도 없으면 아이콘 자체를 표시하지 않는다(§8.13 Trailing Action 규칙과 동일).

**Whiteboard Card**: 화이트보드 문서 목록(§9.3)의 Grid Tile 전용 변형. Project Card와 같은 Surface 스타일(Radius/Border/Shadow 없음)을 공유하지만 구성은 다르다 — 상단에 문서 내용을 암시하는 캔버스 미리보기 영역(dot grid, Excalidraw 캔버스의 기본 그리드를 그대로 차용)을 두고, 그 아래에 Title · Meta(생성일·수정일) · Divider · Footer(생성자 Avatar + 이름)만 둔다. Whiteboard Document는 설명 속성이 없으므로(PRODUCT.md §5) Description Slot이 없다 — 이 차이가 곧 "카드만 봐도 프로젝트가 아니라 문서라는 것"을 드러내는 시각적 구분선이 된다. 컨텍스트 메뉴 Icon Button(⋮)은 Project Card처럼 별도 Header 행을 두지 않고 캔버스 미리보기 위에 겹쳐진 작은 Chip(28px, background/default 배경)으로 표시한다 — 항목 구성은 §8.9의 "화이트보드 문서 컨텍스트 메뉴" Example 참고.

---

### 8.8 Modal

현재 User Flow를 중단해야 할 정도로 중요한 작업에 사용한다.

사용처: 멤버 추가(전체 사용자 목록 검색·선택, §8.19 참고), 워크스페이스·프로젝트·화이트보드 문서 삭제 확인, 멤버 내보내기 확인.

단순 정보 표시에 남용하지 않는다. 파괴적 Action의 확인 Modal에는 항상 Destructive Button을 사용한다.

이름 변경(Rename)에는 사용하지 않는다 — 프로젝트/화이트보드 문서 이름 변경은 Modal이 아니라 인라인 편집(§8.13, §8.16 참고)을 사용한다.

**Example — 프로젝트 생성**: 필드는 이름(필수)·설명(선택, Textarea) 두 개뿐이다. 확정 Action은 Primary Button("만들기")을 사용한다 — 파괴적 Action이 아니므로 Destructive를 쓰지 않는다. Cancel은 Tertiary Button("취소")을 사용한다.

**Example — 워크스페이스 생성**: PRODUCT.md §5 Workspace의 Key Attributes(이름/소유자/생성일/기본 워크스페이스 여부)에 설명이 없으므로 필드는 이름 하나뿐이다 — 프로젝트 생성과 달리 Textarea를 두지 않는다. 나머지 구성(Primary "만들기" / Tertiary "취소")은 동일하다.

**Example — 화이트보드 생성**: Whiteboard Document의 Key Attributes(PRODUCT.md §5 — 이름/생성자/캔버스 콘텐츠/생성일/최종 수정일)에서 사용자가 생성 시점에 직접 입력하는 값은 이름뿐이므로, 워크스페이스 생성과 동일하게 필드는 이름 하나뿐이다. 나머지 구성(Primary "만들기" / Tertiary "취소")도 동일하다.

**Example — 워크스페이스 삭제 확인**: 기존 "Modal / Example — 삭제 확인"과 동일한 구조를 재사용한다 — 제목 "{워크스페이스명}을(를) 삭제할까요?", 본문에 하위 프로젝트·화이트보드 문서가 함께 삭제되고 되돌릴 수 없다는 점을 명시, 확정 Action은 Destructive Button("워크스페이스 삭제"). 워크스페이스 설정 페이지(§9.5)의 위험 구역에서 연다.

**Example — 멤버 내보내기 확인**: "삭제 확인" 패턴(워크스페이스/프로젝트/화이트보드 문서 삭제)과 동일한 구조를 멤버 내보내기에도 재사용한다 — 제목 "{이름}님을 내보낼까요?", 본문에 접근 권한을 잃는다는 결과를 명시, 확정 Action은 Destructive Button("내보내기"). 삭제와 달리 하위 리소스가 함께 제거되는 것은 아니지만(멤버 본인의 워크스페이스 접근 권한만 제거됨), 되돌리기 어려운 Action이므로 동일하게 확인 Modal을 거친다.

---

### 8.9 Dropdown Menu

여러 Secondary Action을 Compact하게 제공할 때 사용한다.

사용처: 프로젝트/화이트보드 문서의 컨텍스트 메뉴(삭제 등), 계정 메뉴(계정 설정, 로그아웃).

파괴적 항목(삭제 등)은 Danger Color로 구분하고, 필요 시 Separator로 일반 항목과 그룹을 나눈다.

**권한 없는 항목은 표시하지 않는다.** Owner 또는 생성자에게만 허용된 Action(삭제 등)은 권한이 없는 사용자에게 Disabled 상태로 보여주지 않고, 메뉴 항목 자체를 렌더링하지 않는다. 예를 들어 본인이 만들지 않은 프로젝트의 컨텍스트 메뉴에는 "삭제" 항목이 처음부터 존재하지 않는다.

"이름 변경"을 메뉴 항목으로 둘 수 있다 — 단, 별도 Modal이나 입력창을 열지 않고 Title을 인라인 편집 모드로 전환하는 진입점으로만 동작한다(§8.13, §8.16 참고). List Cell처럼 더블클릭으로도 같은 편집 모드에 진입할 수 있는 화면에서는 더블클릭과 메뉴 항목이 동일한 인라인 편집을 여는 두 가지 진입 경로가 된다.

**Example — 프로젝트 카드 컨텍스트 메뉴**: 이름 변경 · 설명 변경 · (Separator) · 프로젝트 삭제(Danger). "이름 변경"/"설명 변경"은 각각 Card(§8.7)의 Title/Description을 인라인 편집 모드로 전환하는 진입점이고, "프로젝트 삭제"는 삭제 확인 Modal(§8.8)을 연다. Owner 또는 생성자가 아니면 "이름 변경"·"설명 변경"·"프로젝트 삭제" 항목 자체가 렌더링되지 않는다.

**Example — 화이트보드 문서 컨텍스트 메뉴**: 이름 변경 · (Separator) · 화이트보드 문서 삭제(Danger). Whiteboard Document는 설명 속성이 없으므로(PRODUCT.md §5) "설명 변경" 항목이 없다는 점만 프로젝트 카드 메뉴와 다르다. "이름 변경"은 Whiteboard Card(§8.7)/Table Row의 Title을 인라인 편집 모드로 전환하는 진입점이고, "화이트보드 문서 삭제"는 삭제 확인 Modal(§8.8)을 연다. Owner 또는 생성자가 아니면 두 항목 모두 렌더링되지 않는다.

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

- Title은 가장 강한 Typography Weight를 사용하고, Sub(생성자/최종 수정일 등)는 Secondary Color로 표현한다. Title과 Sub의 크기 차이보다 Weight/Color 차이로 위계를 만든다(§6.2).
- Row의 Vertical Padding은 Compact 단계를 기본값으로 한다(§5.2) — 목록은 한 화면에 최대한 많은 행이 보이는 것이 우선이다.
- Leading Slot의 아이콘/아바타 크기는 Row 높이를 결정하는 요인이 되지 않도록 Title + Sub 두 줄 높이 안에 들어오는 크기로 제한한다.
- Row가 Compact해져 Interaction Target이 부족해지면 Padding을 키우지 않고 클릭 영역을 Row 전체로 확장한다(§11).
- Interactive Row(클릭 시 상세로 이동)는 Hover 시 Subtle Background로 눌리는 느낌을 준다.
- 목록 전체를 Card로 감싸지 않는다 — Divider 또는 Background Difference로 구분한다.
- Trailing Action(⋮ 메뉴 등)은 현재 사용자가 수행 가능한 Action이 하나도 없으면 아이콘 자체를 표시하지 않는다. 일부만 가능하면 가능한 Action만 메뉴에 노출한다(§8.9 참고).

**예외 — 멤버 목록**: 워크스페이스 소유자가 보는 멤버 목록의 Trailing은 예외적으로 메타 정보(역할 Badge, §8.11 · 합류일)와 Action(내보내기 Icon Button)을 함께 표시한다 — 소유자 본인의 Row에는 Action을 표시하지 않는다(자기 자신은 내보낼 수 없음, PRODUCT.md §7). Owner가 아닌 사용자에게는 이 페이지 자체가 읽기 전용이므로 Action이 렌더링되지 않는다.

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

**Member Avatar Group과의 구분**: Sidebar의 Workspace Switcher(§8.21)에 쓰이는 "워크스페이스 멤버 미리보기" 아바타 묶음은 이 Component가 아니다 — 실시간 접속 여부와 무관한 정적 멤버 목록이므로 Presence Color Ring을 사용하지 않는다. Avatar(Initials)를 겹쳐 배치하고 `background/default`(흰색) Ring으로만 구분하며, 본인도 포함한다.

이전에는 각 페이지 Page Header 우측에 개별 배치했으나, 프로젝트에는 별도 멤버 개념이 없어(PRODUCT.md §5 — 워크스페이스 소속 시 그 안의 모든 프로젝트에 동일하게 접근) 프로젝트 상세 등의 페이지에 두면 "이 프로젝트만의 멤버"처럼 스코프가 잘못 읽히는 문제가 있었다. Sidebar Workspace Switcher는 페이지와 무관하게 항상 "지금 어느 워크스페이스에 있는지"를 표현하는 유일한 자리이므로, 멤버 미리보기도 그 옆으로 옮겨 스코프를 명확히 했다 — Page Header에는 더 이상 두지 않는다.

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
- 저장 상태는 Icon + Label로 표현하고, Color만으로 표현하지 않는다 — 저장됨(`circle-check`, `status/success`) · 저장 중(Spinner) · 동기화 끊김(`circle-alert`, `status/danger`) 세 상태를 Toast(§8.18)와 동일한 아이콘 언어로 표현한다.
- 문서명은 Owner 또는 생성자에게만 인라인 편집이 가능하다(§8.13 Rename Variant와 동일한 방식 — 더블클릭 시 즉시 편집, Modal 없음). 그 외 사용자에게는 읽기 전용 텍스트로 보인다.
- 문서 메뉴의 "삭제" 항목은 Owner 또는 생성자가 아니면 메뉴 자체에 렌더링하지 않는다(§8.9 참고) — Disabled로 보여주지 않는다.
- 동기화가 끊긴 상태에서는 다른 참여자의 Presence Avatar Stack과 Live Cursor를 표시하지 않는다 — 연결이 끊겼으므로 그 시점 이후의 참여자 상태를 신뢰할 수 없기 때문이다.

**Example — Canvas Shell 전체 화면**: Top Bar 아래는 Full-bleed Canvas(Excalidraw 렌더링 영역)이며, 캔버스 내부 콘텐츠(도형·스티커노트 등)는 Excalidraw 라이브러리가 그리므로 디자인 목업에서 직접 그리지 않는다 — Excalidraw 자체의 시각 언어(자체 폰트, 선택 핸들, 툴바)와 다르게 그리면 오히려 잘못된 지시로 읽힐 수 있다. 대신 `background/canvas` 톤의 빈 영역 + "Excalidraw 렌더링 영역" Label로만 표시해 Top Bar가 캔버스를 침범하지 않는 경계(전체 폭 Full-bleed, 좌우 Padding 없음)만 명확히 한다. 네 가지 State를 제공한다 — 기본(저장됨 + Live Cursor 2개), 저장 중, 동기화 끊김(Live Cursor 없음), 초기 로딩(Top Bar의 저장 상태·Presence·문서 메뉴는 아직 렌더링하지 않고, 캔버스 자리에 Spinner Large를 중앙 배치).

---

### 8.17 Empty State

가능하면 다음을 제공한다.

- 현재 상태 (예: "아직 프로젝트가 없어요")
- 비어 있는 이유
- 다음 Action (Primary Button)

단순히 "No data"만 표시하지 않는다. 이모지 대신 Monochrome Icon을 사용하며, 기본 Example(§8.7 참고 컴포넌트 문서)의 Icon은 `folder`다. 새 Variant를 만들 때 이 Example을 복제해서 아이콘만 바꾸는 경우, 기존 Icon Instance를 먼저 지우고 나서 새 Icon을 넣어야 한다 — 지우지 않고 겹쳐 넣으면 두 아이콘이 겹쳐 보여 깨진 것처럼 보인다(과거 실제로 발생했던 실수).

**Example — 검색 결과 없음**: 목록 자체가 비어 있는 경우(예: "아직 프로젝트가 없어요")와 구분한다 — Icon은 Search(§8.20)로, 확정 Action은 Primary Button이 아니라 Secondary Button("검색 결과 초기화", §8.1)을 사용한다. 목록 화면 안의 부분 상태이므로 Large가 아닌 Default Size를 사용한다(§8.1 Size 규칙). Search 필드에는 입력한 검색어를 그대로 유지해 사용자가 무엇을 검색했는지 알 수 있게 한다.

Empty State는 Compact-first(§5.2)의 예외로, 목록보다 넉넉한 상하 여백(§6.3의 48 구간)을 사용할 수 있다 — 비어 있음 자체가 전달해야 하는 정보이기 때문이다. 단, 좌우는 Container 규칙(§7.2)을 따른다.

**Permission Denied Variant**: 워크스페이스 홈/프로젝트 상세/화이트보드 문서/멤버 목록 페이지에 접근 권한이 없을 때도 동일한 구조(아이콘 + 메시지 + Action)를 재사용한다. 메시지는 "이 워크스페이스에 접근할 권한이 없어요"처럼 상황을 명확히 설명하고, Action은 "My Workspace로 돌아가기"처럼 사용자가 이동할 곳을 제공한다(Icon은 `users`, Button은 Secondary — Error Variant와 동일하게 화면의 주 Action처럼 강조하지 않는다). App Shell(Sidebar 포함)을 그대로 두지 않고 화면 전체를 이 메시지로 채운다 — 접근 권한이 없는 워크스페이스의 Sidebar(Workspace Switcher, Primary Nav 등)를 보여주는 것 자체가 그 워크스페이스에 대한 정보 노출이기 때문이다. 대신 Action 하나로 본인의 기본 워크스페이스로 즉시 돌아갈 수 있게 한다. Example — "Workspace Home — 접근 권한 없음 (전체 화면)" 참고.

---

### 8.18 Toast

일시적인 System Feedback에 사용한다.

사용처: 저장 완료, 저장 오류, 멤버 추가 완료, 멤버 내보내기 완료.

Dismiss 없이 자동으로 사라지며, 중요한 확인이 필요한 정보(예: 삭제 여부)에는 사용하지 않는다 — 그 경우 Modal(§8.8)을 사용한다.

**배치**: Main Content 우측 상단(위 24px, 오른쪽 24px 여백)에 고정한다 — Sidebar를 가리지 않고, 화면 중앙의 작업 콘텐츠와도 겹치지 않는 위치다. 여러 개가 동시에 뜨면 이 지점에서 아래로 쌓인다.

Semantic(Success/Danger/Warning/Info)마다 배경을 해당 색의 Subtle Background(§6.1 `-subtle-bg` 토큰)로 채우고, 좌측에 그 색과 동일한 Semantic Icon을 둔다 — 색상 하나에만 의존하지 않고 아이콘 형태로도 상태를 구분한다(§11 Accessibility). 흰 배경에 작은 색상 Dot만 두던 이전 방식보다 Scanning 시 상태를 더 빠르게 인지할 수 있다.

아이콘은 Lucide 원본 형태를 따른다 — Success/Danger/Info는 원 안에 글리프(circle-check/circle-alert/info)를 둬 셋이 같은 틀을 공유하고, Warning만 예외적으로 원이 아닌 triangle-alert를 사용한다(Lucide 자체가 Warning에 삼각형을 쓰는 관례를 그대로 따름 — 인위적으로 원에 끼워 넣지 않는다).

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

### 8.21 Sidebar

워크스페이스 내부(App Shell)의 Primary Navigation(§7.4). 지금 어떤 워크스페이스에 있는지, 그 안에서 어느 섹션(Projects/Members)에 있는지를 상시 고정해서 보여주고, 다른 워크스페이스로의 이동을 담당한다.

Structure (위에서 아래로):

1. **Brand Row** — in2white 로고 마크(28px)만 둔다. 제품 자체의 정체성을 표현하는 행으로, 워크스페이스 정체성(Workspace Switcher)과는 분리한다 — 하나의 작은 아이콘이 "제품 로고"와 "워크스페이스 아이콘"을 동시에 맡으면 둘 다 존재감이 약해지기 때문이다. 워드마크 텍스트는 두지 않는다(로고 마크 자체로 충분히 식별 가능하고, Sidebar 폭이 좁아 텍스트를 더하면 다른 요소와 경쟁한다).
2. **Workspace Switcher** — 현재 워크스페이스 이름 + 내 역할(소유자/멤버) 2줄 + Chevron만 둔다(별도 아이콘 없음 — 워크스페이스 식별은 이름 텍스트로 충분하고, 아이콘은 위 Brand Row와 중복된다). 그 아래 두 번째 행에 현재 워크스페이스에 소속된 멤버 미리보기를 배치한다. 클릭하면 멤버 목록 페이지로 이동한다 — "지금 어디에 있는지"(워크스페이스)와 "누가 있는지"(멤버)를 같은 정보 블록에 묶어 모호함을 없앤다. 멤버 미리보기는 Avatar 2~3개를 겹쳐 표시하고, 그 뒤에 남은 인원 수를 "+N" Chip(Avatar와 같은 크기의 원, `background/subtle` 배경)으로 붙인다 — Avatar 개수와 별도로 "멤버 N명" 텍스트를 병기하면 "아바타는 3개인데 왜 5명이라 적혀 있지"처럼 숫자가 어긋나 보이므로, 전체 인원을 Avatar 자체로만(보이는 것 + "+N") 정확히 표현한다. 이 표현은 §8.14의 Member Avatar Group과 동일한 방식(정적 멤버 목록, `background/default` 흰색 Ring, 본인 포함)을 쓰되 더 작은 크기(20px)를 사용한다. Collapsed 상태에서는 공간이 부족하므로 이 행을 표시하지 않는다.

   Workspace Switcher의 이름/역할/Chevron 부분을 클릭하면 Sidebar 바로 아래 Popover Panel이 열리며, 위에서 아래로 다음을 제공한다.
   - **워크스페이스 검색** (Search, §8.20) — 소속 워크스페이스가 많아질 때를 대비해 최상단에 배치한다.
   - **워크스페이스 목록** (List Cell, §8.13) — Leading에 워크스페이스 Avatar(Initials), Body에 이름 + 내 역할(Sub)을 표시하고, 선택 시 해당 워크스페이스로 전환한다. 현재 워크스페이스는 Row 배경(`background/subtle`)으로 구분한다 — Checkmark 같은 추가 아이콘을 쓰지 않는다.
   - **Divider**
   - **새 워크스페이스 생성** — 목록 맨 아래, 박스형 Button이 아니라 Plus Icon + Label로 구성된 가벼운 List 행이다. Search와 시각적으로 경쟁하지 않도록 Secondary Color를 사용한다. 클릭하면 워크스페이스 생성 Modal(§8.8 Example — 워크스페이스 생성 참고, 이름 한 필드만 입력)이 열린다.
   - 모든 워크스페이스 보기, 워크스페이스 설정(소유자 전용 — 이름 변경 · 삭제)은 이 Panel이 아니라 각각 워크스페이스 목록 페이지, 워크스페이스 설정 화면(§9.5 Settings 패턴)에서 별도로 제공한다. 기본 워크스페이스(My Workspace)는 삭제할 수 없으므로 Destructive 영역 자체를 렌더링하지 않는다 — PRODUCT.md §5 Workspace.
3. **Primary Nav** — 프로젝트, 멤버, 설정 세 항목. 각 항목은 Icon(§6.8) + Label로 구성하고 현재 위치는 Active 상태(§5.5)로 표현한다.
   - 멤버 항목에는 소유자에게만 보이는 초대(Invite) Quick Action을 나란히 배치한다 — 항목 자체를 누르면 멤버 목록 페이지로 이동하고, Invite Action은 바로 User Picker(§8.19) Modal을 연다.
   - **설정** 항목(Icon `sliders-horizontal`)은 워크스페이스 소유자에게만 보인다 — Member에게는 항목 자체가 렌더링되지 않는다(§8.9의 "권한 없는 항목은 표시하지 않는다"와 동일한 원칙, Disabled로 보여주지 않음). 클릭하면 워크스페이스 설정 페이지(§9.5)로 이동해 워크스페이스 이름 변경과 삭제를 수행한다. 멤버 목록과 별도 페이지로 두는 이유는 §9.5 참고.
4. **로그아웃** — Primary Nav 아래, Divider 위에 위치한 별도 행.
5. **Divider** — `border/subtle` Hairline로 로그아웃과 Account Footer를 분리한다.
6. **Account Footer** — 내 정보(이름/이메일 + Avatar). 화면 높이와 무관하게 항상 Sidebar 맨 하단에 고정된다(Primary Nav와 로그아웃 사이의 Spacer가 남는 세로 공간을 모두 흡수). 클릭 시 계정 설정(§9.5)으로 이동한다.

Variants:

- **Expanded** — Icon + Label 모두 노출.
- **Collapsed** — Icon만 노출, Label은 Tooltip(§8.12)으로 대체한다. Workspace Switcher는 Collapsed 상태에서도 워크스페이스를 식별할 수 있는 최소 표시(이니셜 등)를 유지한다. 모든 Row의 높이는 Expanded와 동일하게 고정해, Collapse/Expand 전환 시 각 메뉴 항목의 세로 위치가 흔들리지 않게 한다.

Rules:

- Collapse/Expand를 전환하는 Toggle Control(Icon Button, `panel-left`)은 Sidebar 우측 상단 안쪽 모서리에 고정된다 — Brand Row·Workspace Switcher·Primary Nav 등 어떤 콘텐츠 행에도 속하지 않는 독립 요소로, Expanded/Collapsed 두 상태에서 항상 같은 위치를 유지한다. 예전에는 각 페이지 Page Header의 Title 왼쪽에 뒀으나, 페이지마다 반복되는 데다 Collapsed 상태에서 위치를 다시 정의해야 하는 문제가 있어 Sidebar 쪽으로 옮겼다. Sidebar 컴포넌트 하나에만 정의하며 페이지마다 별도로 배치하지 않는다. (Sidebar/Main Content 경계선에 절반씩 걸치는 형태도 시도했으나 시각적으로 어색해 안쪽 모서리 배치로 되돌렸다.)
- Collapsed 상태의 모든 Icon-only 항목은 Tooltip으로 Label을 제공한다(§11 — Icon-only Button에 Accessible Label 제공).
- Active 상태는 Color만으로 표현하지 않고 배경(§5.5 Selected State) + Icon/Label Weight로 함께 표현한다.
- Icon은 Lucide Icons를 사용한다(§6.8).

When Not to Use:

- Auth Shell, Canvas Shell에는 사용하지 않는다(§7.1) — 인증 전 화면이거나 캔버스 시야를 최우선해야 하는 화면이기 때문이다.
- 워크스페이스 컨텍스트가 없는 워크스페이스 목록 페이지에도 사용하지 않는다(§7.1 예외).

---

### 8.22 Pagination

긴 목록(프로젝트/화이트보드 문서/멤버 등)을 페이지 단위로 나눌 때 사용한다.

Structure: 이전 Icon Button(`chevron-left`) · 페이지 번호 버튼들 · 다음 Icon Button(`chevron-right`).

Rules:

- 현재 페이지는 `action/secondary` 배경 + `foreground/strong` Semi Bold 텍스트로 표현한다.
- 첫 페이지에서는 이전 버튼이, 마지막 페이지에서는 다음 버튼이 Disabled(40% Opacity) 상태가 된다.
- List Content 하단, Main Content와 같은 좌측 정렬을 유지한다.

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

**Page Header 구조 — 프로젝트 상세**: 위에서 아래로 다음 4단으로 구성한다.

1. **top-row**: Breadcrumb(§56:52, "프로젝트" 라벨 → 현재 프로젝트명) 한 줄만 둔다. Breadcrumb의 마지막 항목(현재 프로젝트명, strong)이 "지금 어떤 프로젝트에 들어와 있는지"를 드러낸다 — 별도 Badge를 새로 만들지 않는다. Sidebar Collapse Toggle과 워크스페이스 멤버 미리보기는 더 이상 Page Header에 두지 않는다 — 전자는 Sidebar 우측 상단에, 후자는 Sidebar Workspace Switcher(§8.21)에 고정된 위치를 갖는다.
2. **title-row**: 뒤로가기 Icon Button(`arrow-left`, 프로젝트 목록으로 이동) + H1(프로젝트 이름, Heading 1 Role).
3. **description**: 프로젝트 설명(있는 경우만 렌더링, foreground/secondary).
4. **creator-row**: Avatar(24px) + "생성자 {이름}" 텍스트(foreground/secondary) — Card(§8.7) Footer와 동일한 시각 언어를 재사용한다.

Toolbar(Search + View Toggle + Primary Action "화이트보드 생성")는 워크스페이스 홈과 동일하게 Page Header 아래 별도 행으로 유지한다 — Page Header 자체에는 Primary Action을 두지 않는다.

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

**계정 설정 페이지 구조**: App Shell(§7.1) 위에서 렌더링되며(Sidebar 유지, Primary Nav는 프로젝트/멤버 어느 쪽도 Active로 표시하지 않는다 — 계정 설정은 그 둘과 나란한 별개 영역), Page Header는 Breadcrumb 없이 타이틀 "계정 설정"만 사용한다(§8.13/§8.6 List·Table 페이지들과 달리 Toolbar·Primary Action이 없다). 본문은 List 화면과 달리 §7.2의 Center Alignment 규칙에 따라 480px 폭 Form Column을 Main Content 안에서 가운데 정렬하고, 세 Section을 위에서 아래로 배치한다(§9.4 Form Grouping) — 각 Section은 Heading 2 타이틀 + Section별 확정 Action(Primary Button, Default Size)을 갖는다.

1. **기본 정보** — 아이디(이메일, Input Disabled 상태로 조회 전용 표현) + 이름(Input, 수정 가능) + "저장" 버튼.
2. **비밀번호 변경** — 현재 비밀번호 · 새 비밀번호 · 새 비밀번호 확인 세 Input + "변경" 버튼.
3. **참여 중인 워크스페이스** — 소속된 모든 워크스페이스를 List Cell(§8.13)로 나열한다(Card로 감싸지 않음, Divider로 구분). Leading은 워크스페이스 Avatar(Initials), Body는 이름 + 내 역할(Sub), Trailing은 Chevron — 클릭하면 Sidebar Workspace Switcher(§8.21)와 동일하게 해당 워크스페이스로 이동한다. 현재 보고 있는 워크스페이스는 Row 배경(`background/subtle`)으로 구분한다(Workspace Switcher Popover와 동일한 표현 방식).

**워크스페이스 설정 페이지 구조**(Sidebar "설정" 항목의 목적지, Owner 전용, PRODUCT.md §9): 멤버 목록 페이지와는 별도 페이지다 — 멤버 목록은 Owner·Member 모두가 보는 조회 중심 화면이고, 워크스페이스 설정은 Owner만 접근하는 관리 전용 화면이라 목적이 다르며, 같은 페이지에 섞으면 "누가 이걸 볼 수 있는지"가 Section마다 달라져 오히려 헷갈린다. List 화면이 아니라 Form에 가까우므로 Account Settings(§9.5 계정 설정)와 동일하게 Center Alignment를 따르지 않고, 다른 List 페이지처럼 좌측 정렬을 유지한다(콘텐츠가 2개 Section뿐이라 원래 List 페이지들과 리듬이 비슷하기 때문). Page Header 타이틀은 "설정". 위에서 아래로 2개 Section을 배치한다.

1. **일반** — 워크스페이스 이름 Input(400px 폭으로 제한) + "저장" 버튼.
2. **위험 구역** — 현재 워크스페이스가 기본 워크스페이스(My Workspace)가 아닐 때만 렌더링한다. `status/danger-subtle-bg` 배경의 Card 형태로 일반 Section과 시각적으로 분리하고(§9.5), 안에는 "워크스페이스 삭제" 설명 텍스트 + Destructive Button을 한 행에 둔다. 기본 워크스페이스에서는 이 Section 자체를 렌더링하지 않는다(Disabled로 보여주지 않음 — §8.9와 동일한 원칙). 확정 시 §8.8의 "삭제 확인" Modal 패턴(Example — 워크스페이스 삭제 확인)을 연다.

---

### 9.6 Empty State

§8.17 참조.

---

### 9.7 Loading

Layout Shift를 최소화한다.

상황에 따라 다음을 사용한다.

- Skeleton (목록/Table 초기 로딩) — List Cell(§8.13)과 동일한 Padding/크기를 유지해 실제 데이터로 전환될 때 Layout Shift가 없어야 한다. Example — "Members — 로딩": 멤버 목록 영역만 Skeleton List Cell로 대체하고, 값이 이미 정해진 정적 영역(Page Header 등)은 그대로 유지한다 — 실제로 서버에서 오는(비동기) 부분만 Skeleton 처리한다.
- Spinner (Canvas 초기 로딩)
- Optimistic State (텍스트/이름 변경 등 즉시 반영 후 서버 확인)

---

### 9.8 Error

Error는 사용자가 다음을 이해할 수 있어야 한다.

- 무엇이 실패했는가? (예: "동기화가 끊겼어요")
- 사용자가 다음에 무엇을 할 수 있는가? (예: "다시 연결을 시도해 주세요")

목록 전체를 불러오지 못한 경우 Empty State(§8.17)와 동일한 구조(Icon + 메시지 + Action)를 재사용한다 — Icon은 `circle-alert`을 `status/danger` 색으로, Action은 Secondary Button("다시 시도")을 사용한다(Primary가 아닌 이유는 §8.17 "검색 결과 없음"과 동일 — 목록 화면 안의 부분 상태이므로 화면의 주 Action처럼 강조하지 않는다). Example — "Workspace Home — 오류" 참고.

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
- 목록 화면에 마케팅급 큰 Heading·Control·여백을 사용해 한 화면에 보이는 행 수를 줄이기 (§5.2)
- Reference의 Font Size / Control Height / Padding을 Compact 환산 없이 그대로 이식하기 (§5.2)
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
- Control Heights (Default / Large 두 단계 — §8.1)
- List Cell Row Padding
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
