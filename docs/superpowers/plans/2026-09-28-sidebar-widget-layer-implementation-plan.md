# Sidebar를 widgets 계층으로 이동 — 구현 계획

- 설계: [2026-09-28-sidebar-widget-layer-design.md](../specs/2026-09-28-sidebar-widget-layer-design.md)
- 이슈: #93

## 목표

`shared/ui/sidebar.*`를 `widgets/sidebar/`로 옮기고, #94에서 남긴 예외 목록 두 개를 지운다.
동작은 그대로 두고 위치와 import 경로만 바꾼다.

## 단계

### 1. 파일 이동

```bash
mkdir -p src/widgets/sidebar/ui
git mv src/shared/ui/sidebar.tsx         src/widgets/sidebar/ui/Sidebar.tsx
git mv src/shared/ui/sidebar.test.tsx    src/widgets/sidebar/ui/Sidebar.test.tsx
git mv src/shared/ui/sidebar.stories.tsx src/widgets/sidebar/ui/Sidebar.stories.tsx
git rm src/widgets/.gitkeep
```

`widgets/sidebar/index.ts`를 만든다.

```ts
export { Sidebar, type SidebarNavKey } from './ui/Sidebar'
```

### 2. 이동한 파일의 import 경로 수정

- `Sidebar.tsx`: `@/shared/*` 상대 참조가 없으므로 그대로. 자기 자신을 가리키는 경로 없음.
- `Sidebar.test.tsx`: `from './sidebar'` → `from './Sidebar'`
- `Sidebar.stories.tsx`: `from '@/shared/ui/sidebar'` → `from './Sidebar'`,
  `title`을 `'Widgets/Sidebar'`로 변경

### 3. 사용처 4곳 갱신

`pages/shared/ui/AuthenticatedWorkspaceLayout.tsx`, `pages/home/ui/HomePage.tsx`,
`pages/project-detail/ui/ProjectDetailPage.tsx`, `pages/account/ui/AccountPage.tsx`의
`@/shared/ui/sidebar` → `@/widgets/sidebar`.

### 4. `brand-assets.test.tsx` 분리

- Sidebar 로고 케이스를 `Sidebar.test.tsx`로 옮긴다. 이미 있는 `sidebarFixture`를 쓴다.
- `brand-assets.test.tsx`에서 `Sidebar` import, `WorkspaceSummary` import,
  `workspace`·`members` 픽스처를 지운다.

### 5. 경계 장치 갱신

- `eslint.config.js`: `SIDEBAR_EXCEPTIONS` 상수와 `layerRules()`의 `ignores` 분기 삭제,
  계층 표에 `routes`·`widgets` 반영.
- `architecture.test.ts`: `DOMAIN_COUPLED_IN_SHARED`를 `[]`로, 이동 목록에 sidebar 추가.

### 6. 선행 문서의 사실 오류 수정

`specs/2026-09-28-fsd-boundaries-design.md`의 "`widgets` 계층이지만 이 저장소에는 없고"를
정정한다. `widgets/.gitkeep`과 README가 이미 계층을 예약해 두었다.

### 7. 검증

- `npx vitest run`
- `pnpm lint`, `pnpm build`
- 계층 규칙 red: `widgets` 파일에 `@/pages` import → error 확인 → 원복
- architecture 테스트 red: `shared` 파일에 `MESSAGES.workspace` 참조 → 실패 확인 → 원복

## 구현 결과

### 실제 변경

**이동 (`git mv`, 내용 변경 없음)**

| 이전 | 이후 |
| --- | --- |
| `shared/ui/sidebar.tsx` (883줄) | `widgets/sidebar/ui/Sidebar.tsx` |
| `shared/ui/sidebar.test.tsx` | `widgets/sidebar/ui/Sidebar.test.tsx` |
| `shared/ui/sidebar.stories.tsx` | `widgets/sidebar/ui/Sidebar.stories.tsx` |

**신규**

- `widgets/sidebar/index.ts` — `Sidebar`, `SidebarNavKey` barrel

**삭제**

- `widgets/.gitkeep` — 계층에 실제 내용이 생겼다

**수정**

- `Sidebar.test.tsx` — import를 `./Sidebar`로, `brand-assets.test.tsx`에서 옮겨온
  로고 검증 케이스 추가
- `Sidebar.stories.tsx` — import를 `./Sidebar`로, `title`을 `'Widgets/Sidebar'`로
- `shared/ui/brand-assets.test.tsx` — 58줄 → 22줄. Sidebar 케이스와 함께
  `@/entities/workspace` import, `workspace`·`members` 픽스처가 사라졌다
- `pages/shared/ui/AuthenticatedWorkspaceLayout.tsx`, `pages/home/ui/HomePage.tsx`,
  `pages/project-detail/ui/ProjectDetailPage.tsx`, `pages/account/ui/AccountPage.tsx` —
  `@/shared/ui/sidebar` → `@/widgets/sidebar`
- `eslint.config.js` — `SIDEBAR_EXCEPTIONS` 상수와 `layerRules()`의 `ignores` 분기 삭제,
  계층 표를 4줄에서 5줄로(`widgets` 추가) 넓히고 모든 줄에 `routes` 반영
- `src/architecture.test.ts` — `DOMAIN_COUPLED_IN_SHARED`를 `[]`로, 이동 목록에 sidebar 추가
- `specs/2026-09-28-fsd-boundaries-design.md` — `widgets` 계층이 없다는 서술 정정

### 계획과 달라진 점

| 항목 | 계획 | 실제 | 이유 |
| --- | --- | --- | --- |
| 세 번째 architecture 테스트 이름 | 그대로 | `feature에 있다` → `상위 계층에 있다` | sidebar 목적지가 `widgets`라 이름이 사실과 달라졌다 |
| `DOMAIN_COUPLED_IN_SHARED` 주석 | 그대로 | `남은 도메인 의존` → `남긴 도메인 의존. 지금은 비어 있다` | 빈 배열에 맞는 서술로 바꿨다 |
| 선행 문서 정정 방식 | 문장 교체 | 문장 교체 + 정정 블록 추가 | 원래 서술이 왜 틀렸는지 남겨 두는 편이 낫다 |
| 스토리 import 그룹 | 언급 없음 | 상대 import를 빈 줄로 분리 | 저장소의 import 그룹 관례를 맞췄다 |
| 사전 준비 | 언급 없음 | `pnpm install` 먼저 실행 | 새 워크트리에 `node_modules`가 없었다 |

### 검증

| 명령 | 결과 |
| --- | --- |
| `npx vitest run` | 80 파일 / 443건 통과 (이동 전과 동일) |
| `pnpm lint` | exit 0. 기존 `react-refresh/only-export-components` 경고 4건만 남음 |
| `pnpm build` | exit 0 |
| `npx prettier --check src` | 기존 8개 파일 경고. 이번에 건드린 파일은 모두 통과 |

red 확인:

- `widgets/sidebar/index.ts`에 `@/pages/home/ui/HomePage` import를 심자
  `no-restricted-imports` error 1건 발생 — 메시지에 `widgets 계층은 상위 계층(app, routes,
  pages)을 참조할 수 없다`가 나온다. 원복 확인.
- `shared/ui/app-shell-header.tsx`에 `MESSAGES.workspace` 참조를 심자
  `shared는 도메인 사전을 참조하지 않는다`가 실패 —
  `expected [ 'shared/ui/app-shell-header.tsx' ] to deeply equal []`. 원복 확인.

### 남은 후속 작업

- `shared/ui/app-shell-header.tsx`는 앱에서 쓰이지 않는 죽은 코드다. 지금은
  `brand-assets.test.tsx`가 유일한 사용처다. 삭제하면 그 테스트 파일도 사라진다.
- `features/member`, `features/whiteboard-editor`에 barrel(`index.ts`)이 없다. 나머지
  5개 feature와 다르고, 이번에 `widgets/sidebar`도 barrel을 뒀다.
- `routes` 계층 자체에 대한 import 규칙은 넣지 않았다. `app`을 참조하는 곳이
  `main.tsx` 하나뿐이고 이 파일은 어느 계층에도 속하지 않는다.
