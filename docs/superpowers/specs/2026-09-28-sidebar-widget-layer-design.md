# Sidebar를 widgets 계층으로 이동 — 설계

- 이슈: #93
- 선행 작업: #94 / PR #95 (`shared` 계층의 도메인 의존 제거와 경계 고정)

## 목표

`shared/ui/sidebar.tsx`는 `shared`에 있으면서 `@/entities/workspace`를 import하고 도메인
문구를 참조한다. #94에서 만든 두 경계 장치는 이 파일만 예외로 두고 통과시켰다.
파일을 제 계층으로 옮겨 예외 목록 두 개를 지우는 것이 이 작업의 목표다.

- `shared`가 상위 계층을 참조하는 마지막 지점을 없앤다.
- `eslint.config.js`의 `SIDEBAR_EXCEPTIONS`와 `architecture.test.ts`의
  `DOMAIN_COUPLED_IN_SHARED`를 빈 상태로 만든다.
- 동작은 바꾸지 않는다. 위치와 import 경로만 바뀐다.

## 목적지: `widgets/sidebar`

#94의 설계 문서는 "FSD라면 `widgets` 계층이지만 이 저장소에는 없고"라고 적었다.
이는 사실과 다르다. 확인한 내용은 다음과 같다.

- `frontend/src/widgets/.gitkeep`이 이미 추적되고 있다. 계층 자리가 예약돼 있다.
- `frontend/README.md:24`가 `widgets/`를 "여러 feature/entity를 조합한 독립 UI 블록"으로
  문서화한다.
- README의 계층 순서는 `app → routes → pages → widgets → features → entities → shared`다.

`Sidebar`는 워크스페이스 전환, 내비게이션, 멤버 프레즌스, 사용자 메뉴를 한 블록에 조합한다.
README의 `widgets` 정의와 정확히 일치한다. `pages/shared/ui`도 후보였지만, 사용처가
`AuthenticatedWorkspaceLayout` 하나라는 사실은 "페이지 전용"이라는 근거가 되지 못한다.
셸 UI는 원래 한 곳에서만 쓰인다. 계층의 성격으로 판단해 `widgets`를 택한다.

## 변경 범위

### 파일 이동

```
shared/ui/sidebar.tsx         → widgets/sidebar/ui/Sidebar.tsx
shared/ui/sidebar.test.tsx    → widgets/sidebar/ui/Sidebar.test.tsx
shared/ui/sidebar.stories.tsx → widgets/sidebar/ui/Sidebar.stories.tsx
```

- 파일명은 PascalCase로 바꾼다. `features/*/ui`가 쓰는 관례이고, `shared/ui`의 kebab-case는
  shadcn 원본 규칙이라 이 파일에 더 이상 해당하지 않는다.
- `widgets/sidebar/index.ts` barrel을 둔다. 7개 feature 중 5개가 barrel을 쓰는 다수 관례다.
- `widgets/.gitkeep`은 실제 내용이 생겼으므로 지운다.

### 공개 API

barrel이 `Sidebar`와 `SidebarNavKey`만 내보낸다. 파일 내부의 `WorkspaceMark`,
`WorkspaceSwitcher`, `SidebarNavItem`은 지금도 export되지 않으므로 그대로 둔다.

```ts
export { Sidebar, type SidebarNavKey } from './ui/Sidebar'
```

### import 갱신

| 파일 | 현재 | 변경 후 |
| --- | --- | --- |
| `pages/shared/ui/AuthenticatedWorkspaceLayout.tsx` | `@/shared/ui/sidebar` | `@/widgets/sidebar` |
| `pages/home/ui/HomePage.tsx` | `@/shared/ui/sidebar` | `@/widgets/sidebar` |
| `pages/project-detail/ui/ProjectDetailPage.tsx` | `@/shared/ui/sidebar` | `@/widgets/sidebar` |
| `pages/account/ui/AccountPage.tsx` | `@/shared/ui/sidebar` | `@/widgets/sidebar` |

### `brand-assets.test.tsx` 분리

`shared/ui/brand-assets.test.tsx`는 `AppShellHeader`와 `Sidebar`의 로고를 한 파일에서
검증하고, 그 때문에 `WorkspaceSummary`를 import한다. Sidebar 케이스를
`widgets/sidebar/ui/Sidebar.test.tsx`로 옮기면 검증은 그대로 남고 `shared`의 entities
의존이 사라진다. 남는 `brand-assets.test.tsx`는 `AppShellHeader` 케이스 하나가 된다.

### Storybook

`title: 'Shared UI/Compositions/Sidebar'` → `'Widgets/Sidebar'`.
`Features/Whiteboard Editor/Canvas Top Bar`와 같은 계층 기준 분류다.

## 경계 장치 갱신

### `eslint.config.js`

`SIDEBAR_EXCEPTIONS` 상수와 `layerRules()`의 `ignores` 분기를 삭제한다. 동시에 계층 표를
README 순서대로 채운다. 지금은 `shared / entities / features / pages` 네 줄뿐이다.

```js
...layerRules({
  shared: ['app', 'routes', 'pages', 'widgets', 'features', 'entities'],
  entities: ['app', 'routes', 'pages', 'widgets', 'features'],
  features: ['app', 'routes', 'pages', 'widgets'],
  widgets: ['app', 'routes', 'pages'],
  pages: ['app', 'routes'],
})
```

`routes`를 막는 항목을 넣어도 새 위반은 생기지 않는다. 저장소 어디도 `@/routes`를
import하지 않고, `routes/`는 `pages`·`features`·`entities`·`shared`만 참조한다.
`@/routeTree.gen`은 `@/routes` 패턴에 걸리지 않는다.

`routes` 자신에 대한 규칙(= `app`만 금지)은 넣지 않는다. `app`을 import하는 곳은
`main.tsx` 하나뿐이고 이 파일은 어느 계층에도 속하지 않는다.

### `architecture.test.ts`

- `DOMAIN_COUPLED_IN_SHARED`를 빈 배열로 만든다. 상수와 두 번째 테스트("허용 목록에 이미
  정리된 파일을 남겨두지 않는다")는 남긴다. 다음 위반을 잡는 장치가 사라지면 안 된다.
- 세 번째 테스트의 이동 목록에 `shared/ui/sidebar.tsx → widgets/sidebar/ui/Sidebar.tsx`를
  추가한다.

## 오류 계약

동작 변경 없음. 타입·props·접근성 속성 모두 그대로다. import 경로 누락은 타입 검사가 잡는다.

## 검증 계획

- `npx vitest run` — 기존 443건 전부 통과 (이동·분리로 파일 수만 바뀐다)
- 계층 규칙 red 확인: `widgets` 파일에 `@/pages` import를 심어 error를 본 뒤 원복
- `architecture.test.ts` red 확인: 허용 목록이 빈 상태에서 `shared` 파일에 도메인 참조를
  심어 실패를 본 뒤 원복
- `pnpm lint` exit 0, `pnpm build` exit 0
