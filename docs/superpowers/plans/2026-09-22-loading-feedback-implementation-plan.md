# 로딩 표시 및 검색 전환 개선 구현 계획

> 실행 지침: 2026-09-22 사용자 승인 후 `superpowers:executing-plans`로 직접 구현했다. 독립 코드 리뷰와 검증 결과는 아래에 기록한다.

**목표:** 300ms 미만 로딩 표시를 생략하고 긴 첫 로딩을 정렬하며 검색 중 기존 데이터를 유지한다.

**구조:** 기존 Spinner·Skeleton을 감싸는 작은 지연 표시 컴포넌트를 사용한다. 목록 query의 이전 데이터 유지는 동일 사용자·워크스페이스·프로젝트 범위로 제한한다. 전역 QueryClient 정책과 서버는 변경하지 않는다.

**기술:** React 19, TanStack Query 5, 기존 Tailwind 토큰, Vitest·Testing Library.

**설계:** [로딩 개선 설계](../specs/2026-09-22-loading-feedback-design.md)

**작업 공간:** `/Users/nandev/orca/workspaces/in2white/fix-loading-feedback`, `fix/loading-feedback`.

## 공통 제약

- 기존 dev 작업 공간의 lockfile·workspace 설정 변경을 덮어쓰거나 이 작업에 포함하지 않는다.
- 승인 전 제품 구현 금지. commit·push·PR은 별도 요청이 있을 때만 수행한다.
- 최초 표시 임계값 300ms, 최소 표시 시간 없음, 새로운 라이브러리 없음.
- 오류·권한 상실을 지연하거나 이전 결과로 가리지 않는다.
- 다른 사용자·워크스페이스·프로젝트의 데이터는 유지하지 않는다.
- mutation 버튼의 기존 진행 표시는 보존한다.

## 리뷰 초점

1. 299ms에 끝난 요청 이후 타이머가 뒤늦게 로딩을 표시하지 않는가.
2. 검색 결과 없음과 재조회 오류가 이전 성공 데이터에 가려지지 않는가.
3. 다른 계정·워크스페이스·프로젝트에서 이전 목록이 노출되지 않는가.
4. 화이트보드 조회와 lazy 모듈 사이에서 표시와 높이가 다시 흔들리지 않는가.
5. 모바일·모션 감소·화면 낭독기에서 상태 안내와 검색 조작이 유지되는가.

## 1. 지연 표시와 중앙 로딩

파일: 새 `frontend/src/shared/ui/loading-state.tsx`, `loading-state.test.tsx`; 기존 `spinner.tsx` 재사용.

- [x] 기존 Spinner API와 테마 토큰을 확인한다.
- [x] 가짜 타이머로 299ms에는 status 없음, 300ms에는 status 있음, unmount 후 재표시 없음의 실패 테스트를 작성한다.
- [x] `DelayedLoading({ children, className })`를 구현한다. 마운트 시 300ms 타이머를 시작하고 정리한다. 래퍼는 레이아웃을 유지하되 대기 중 children을 접근성 트리와 시각 화면에 노출하지 않는다.
- [x] `LoadingState({ label, className })`는 기존 Spinner와 문구를 16px 간격으로 중앙 정렬한다. 전체 화면 또는 목록 높이는 호출자가 전달한다.
- [x] 테스트와 빠른 재마운트 검증을 통과시킨다. CSS 애니메이션 지연만으로 해결하면 숨긴 상태의 접근성도 동등하게 검증한다.

## 2. 목록 query의 동일 범위 데이터 유지

파일: `features/project/model/use-projects.ts`, `features/whiteboard-document/model/use-whiteboard-documents.ts`, `features/member/model/use-members.ts` 및 관련 query/UI 테스트.

- [x] 실제 query key와 사용자 세션 구분 방식을 읽고 모든 목록 호출자를 확인한다.
- [x] 검색·정렬·페이지 변경 중 이전 목록이 남는 테스트와 workspace/project/user 전환 시 사라지는 테스트를 먼저 실패시킨다.
- [x] `placeholderData(previousData, previousQuery)`에서 리소스 범위 key가 일치할 때만 이전 데이터를 반환한다. 개념적 계약은 다음과 같다.

```ts
placeholderData: (previousData, previousQuery) =>
  previousQuery?.queryKey[1] === workspaceId ? previousData : undefined
```

위 예시는 workspace만 있는 key의 형태다. 실제 구현에서는 사용자와 프로젝트가 포함된 실제 key 위치를 함께 비교한다. 전역 helper나 전역 기본값은 만들지 않는다. 기존 후보 검색에도 범위 변경 보호를 적용한다.

- [x] `isPlaceholderData` 동안 페이지 정보는 응답의 기존 pagination을 사용하고, 기존 요청 중 pagination 비활성화 조건을 유지한다.
- [x] 빈 결과, 검색 실패, 권한 상실, 취소된 이전 요청의 늦은 응답을 검증한다.

## 3. 로딩 UI 적용

파일:

- `features/project/ui/ProjectListContent.tsx`
- `features/whiteboard-document/ui/WhiteboardDocumentListContent.tsx`
- `features/member/ui/MemberListContent.tsx`
- `shared/ui/user-picker.tsx`, `shared/ui/sidebar.tsx`
- `pages/shared/ui/AuthenticatedWorkspaceLayout.tsx`
- `pages/workspace-redirect/ui/WorkspaceRedirectPage.tsx`
- `pages/account/ui/AccountPage.tsx`
- `pages/project-detail/ui/ProjectDetailPage.tsx`
- `pages/whiteboard-editor/ui/WhiteboardEditorPage.tsx`

- [x] 기존 테스트에서 즉시 로딩 노출 기대를 300ms 경계로 바꿔 실패를 확인한다.
- [x] 텍스트 로딩을 중앙 LoadingState로 바꾸되 셸·툴바·결과 영역 높이를 유지한다.
- [x] 스켈레톤은 그룹 단위 DelayedLoading으로 감싼다. 느린 최초 요청 외에는 렌더링하지 않는다.
- [x] 계정 워크스페이스 영역과 사이드바는 해당 작은 영역의 배치를 유지한다. 전체 화면 로딩으로 확대하지 않는다.
- [x] 편집기는 같은 프레임을 쓰는 pending과 Suspense 상태로 맞춘다. 연속 대기 타이머를 유지할 수 있는 최소 구조를 선택하고 별도 범용 로딩 상태 머신은 만들지 않는다.
- [x] 데이터 없음·접근 오류·다시 시도·미저장 보호의 기존 동작을 확인한다.

## 4. 통합 검증 및 기록

- [x] 관련 테스트부터 실행하고 실패를 해결한다: `cd frontend && pnpm exec vitest run src/shared/ui/loading-state.test.tsx`와 수정된 페이지·목록 테스트 경로.
- [x] `cd frontend && pnpm test`.
- [x] `cd frontend && pnpm lint`.
- [x] `cd frontend && pnpm build`.
- [x] Figma 시안과 실제 화면을 빠른 응답·1초 지연에서 비교한다. 모바일, 검색 중 기존 목록, 300ms 직후 완료, 편집기 연속 로딩을 확인한다.
- [x] `git diff --check`와 diff를 확인해 관련 변경만 남긴다.
- [x] 아래 결과에 실제 변경, 계획 차이, 실행 명령·결과, 남은 후속 작업을 기록한다.

## Implementation Results

### 실제 변경

- 공통 `DelayedLoading`/`LoadingState`를 추가했다. 300ms 전에는 visibility·aria-hidden·inert로 숨기면서 크기를 유지한다. 완료 시 즉시 해제하고 unmount에서 타이머를 정리한다.
- 프로젝트·문서 목록, 워크스페이스 셸·리다이렉트·계정, 사이드바, 멤버 목록·사용자 선택기·프로젝트 상세 헤더에 적용했다.
- 기존 Spinner 28px와 의미 기반 색상·타이포 토큰을 재사용했다. Spinner/Skeleton에는 모션 감소 설정을 반영했다.
- 목록 query의 `placeholderData`는 같은 사용자·워크스페이스·프로젝트에서만 이전 데이터를 반환한다. 프로젝트·문서 목록 key에 세션 사용자 ID를 추가했고 기존 mutation 무효화 prefix는 유지했다.
- 요청 중 페이지 번호는 현재 표시 데이터의 pagination과 일치시킨다. 페이지 버튼은 요청 중 비활성화하고 검색 입력은 계속 허용한다.
- 편집기 조회와 lazy 준비는 시작 시점을 공유한다. 문서가 바뀌면 초기화하고 재시도는 새 시점부터 지연한다. 기존 미저장 편집 보존 테스트를 유지했다.
- Figma v1.0에 기존 컴포넌트를 재사용한 시안을 추가했다. [화이트보드 목록 시안](https://www.figma.com/design/Dimhltnal74SHy2NcLz1Lf?node-id=426-4756)도 실제 프로젝트 상세 셸로 맞췄다.

### 계획과 달라진 점

- 검색 결과가 0건인 상태에서 검색어를 지울 때 문구가 먼저 바뀌는 문제를 독립 리뷰가 발견했다. 회귀 테스트 2개로 실패를 확인한 후 이전 결과의 검색 기준 `resultSearch`도 유지하도록 보완했다. 멤버 목록·후보에도 같은 처리를 적용했다.
- `DelayedLoading`에 인라인 사이드바를 위한 `as="span"`, 연속 편집기 로딩을 위한 `startedAt`만 추가했다. 범용 상태 머신이나 새 라이브러리는 도입하지 않았다.
- 최초 구현 전에 전체 테스트를 실행했으며 기존 메뉴 테스트 4개가 이미 실패했다. 이번 변경과 분리해 기록하고 관련 없는 메뉴 코드는 수정하지 않았다.
- worktree의 의존성 설치 대신 기존 frontend/node_modules를 임시 심볼릭 링크로 재사용했다. 도구가 생성한 worktree lockfile·pnpm-workspace 변경은 제거했으며 원본 작업 공간의 사용자 변경은 보존했다.

### 실행한 검증 명령과 결과

작업 경로: `/Users/nandev/orca/workspaces/in2white/fix-loading-feedback/frontend`.

| 검증 | 결과 |
| --- | --- |
| 변경 전 `pnpm test` | 354개 중 350 통과, 기존 4 실패 |
| 로딩·query 관련 4개 파일의 `pnpm exec vitest run ...` | 초기 구현 23개 통과 |
| 빈 검색 초기화 회귀 테스트 `pnpm exec vitest run src/features/project/ui/ProjectListContent.test.tsx src/features/whiteboard-document/ui/WhiteboardDocumentListContent.test.tsx -t '빈 검색을'` | 수정 전 2 실패 → 수정 후 2 통과 |
| 최종 `pnpm test` | 367개 중 363 통과, 기준선과 동일한 기존 4 실패. 새 테스트 13개 모두 통과 |
| `pnpm lint` | 종료 0, 오류 0, 기존 Fast Refresh 경고 4 |
| `pnpm build` | 종료 0, TypeScript·Vite 빌드 통과. 500kB 초과 chunk 경고 |
| `git diff --check` | 종료 0 |

기존 실패 목록:

1. `ProjectDetailHeader.test.tsx`: 메뉴에서 수정과 삭제를 호출한다.
2. `ProjectListContent.test.tsx`: 프로젝트 메뉴에서 수정과 삭제 모달을 연다.
3. `WhiteboardDocumentListContent.test.tsx`: 이름 변경을 확정하면 문서 id와 새 이름을 전달한다.
4. `WhiteboardDocumentListContent.test.tsx`: 삭제를 확정하면 문서 id를 전달한다.

모두 메뉴 클릭 후 menuitem을 찾지 못하는 기존 실패다. 따라서 전체 테스트가 모두 통과했다고 표현하지 않는다.

### 브라우저 및 리뷰

- Orca 임베디드 브라우저에서 실제 Vite 컴포넌트를 로드하고 조회 응답을 제어하는 임시 검증 화면을 사용했다. 서버 데이터는 쓰지 않았다.
- 799×1779 화면: 100ms에는 로딩 미표시, 350ms에는 표시, 로딩 컨테이너와 status 중심 오차 x/y 모두 0px.
- 검색을 400ms 이상 지연시켜도 기존 프로젝트가 남고 로딩 UI가 없었으며, 응답 완료 후 새 프로젝트로 교체됐다.
- 390×844 화면: 빠른 완료 뒤 뒤늦은 로딩 없음, 긴 로딩 중앙 오차 0px, 가로 넘침 없음. 실제 스크린샷을 확인했다.
- 가짜 타이머 테스트로 299/300ms 경계, 재진입, unmount 정리, 연속 편집기 준비를 확인했다. query 테스트로 범위 전환, 빈 응답, 오류, 늦은 이전 응답 무시를 확인했다.
- 독립 리뷰의 빈 상태 문제를 수정했고 재리뷰에서 추가 확정 결함이 없었다.
- 모든 실제 사용자 페이지의 백엔드 연동 E2E와 OS 모션 감소 설정 전환은 별도로 실행하지 않았다.

### 남은 후속 작업

- 이번 범위 밖인 기존 메뉴 테스트 4개의 실패 원인은 별도 작업으로 조사한다.
- 변경은 `fix/loading-feedback` worktree에 있으며 commit·push·merge·PR은 하지 않았다. 통합은 사용자 요청 시 수행한다.

## 후속 실행: 스켈레톤 일관성 (사용자 승인 완료)

- [x] Figma의 프로젝트·화이트보드 카드/테이블 로딩 시안과 워크스페이스·상세 초기 상태를 기존 토큰으로 갱신한다.
- [x] `shared/ui/resource-list-skeleton.tsx`에 카드/테이블 자리 표시를 작성한다. 기존 Skeleton·Table을 재사용하고 타이머는 기존 DelayedLoading이 담당한다. 카드6개/행5개를 표시한다.
- [x] 프로젝트·문서 목록의 최초 LoadingState를 보기 방식에 맞는 스켈레톤으로 교체한다. 검색 중 이전 결과 유지 코드는 보존한다.
- [x] 프로젝트 상세의 헤더·툴바·목록 스켈레톤을 구성하고 최초 시작 시점을 문서 목록 로딩에 전달한다. 오류·권한 게이트 이전에 문서 요청을 실행하도록 바꾸지 않는다.
- [x] 워크스페이스 초기 본문·사이드바 이름·계정 참여 목록을 스켈레톤으로 맞춘다. 셸에서 리소스 화면으로 넘어갈 때 초기 대기 시점을 전달하되 새 경로의 로딩은 새로 측정한다.
- [x] 먼저 보기별 로딩·300ms 경계·상세 placeholder 테스트를 실패시킨 후 구현한다. 관련 테스트·전체 테스트·린트·빌드·브라우저 검증을 실행하고 실제 변경·차이·결과를 추가 기록한다.

### 후속 구현 결과

- 공통 카드 6개/테이블 5행 골격을 추가하고 실제 목록의 반응형 그리드·열 너비·가로 스크롤을 재사용했다. 문서 카드는 104px 미리보기 영역을 유지한다.
- 상세는 헤더·검색 도구·문서 영역을 처음부터 확보한다. 워크스페이스 셸→프로젝트 상세→문서 최초 조회는 대기 시작 시각을 공유한다. 경로/사용자 전환과 명시적 재시도는 새 시각을 사용한다.
- 워크스페이스 본문, 사이드바 이름/역할, 계정 참여 목록에 골격을 적용했다. 멤버와 후보의 기존 행 골격, 검색 중 이전 결과, 권한·오류 게이트는 유지했다.
- 도구 영역은 실제 검색창처럼 줄바꿈하며 모바일에서 두 줄 높이를 확보한다. 표시 전에는 자리만 유지하고 접근성 트리에서 제외한다.
- Figma: [프로젝트 카드](https://www.figma.com/design/Dimhltnal74SHy2NcLz1Lf?node-id=424-4234), [프로젝트 테이블](https://www.figma.com/design/Dimhltnal74SHy2NcLz1Lf?node-id=428-5167), [문서 카드](https://www.figma.com/design/Dimhltnal74SHy2NcLz1Lf?node-id=426-4756), [문서 테이블](https://www.figma.com/design/Dimhltnal74SHy2NcLz1Lf?node-id=432-4996), [상세 초기](https://www.figma.com/design/Dimhltnal74SHy2NcLz1Lf?node-id=430-4870), [워크스페이스 초기](https://www.figma.com/design/Dimhltnal74SHy2NcLz1Lf?node-id=424-4398).

### 후속 계획과 실제 차이

- 독립 리뷰에서 오래된 시작 시각이 오류 후 재시도에도 적용되는 문제를 발견했다. 각 재시도에서 시작 시각을 초기화하고 299/300ms 회귀 테스트를 추가했다. 재리뷰에서 추가 결함은 없었다.
- 목적지를 결정하는 리다이렉트와 편집기 준비는 페이지 콘텐츠 조회와 구분해 기존 지연 스피너를 유지했다. 별도 로딩 상태 머신이나 의존성은 추가하지 않았다.
- Figma는 기존 화면·토큰을 재사용했으며 새 테이블/상세 프레임은 기존 화면과 겹치지 않게 배치했다.

### 후속 검증 결과

의존성 설치 없이 기존 node_modules를 사용했다. 아래 명령은 frontend 디렉터리에서 실행했다.

| 명령/검증 | 결과 |
| --- | --- |
| `node node_modules/vitest/vitest.mjs run src/shared/ui/resource-list-skeleton.test.tsx src/pages/project-detail/ui/ProjectDetailPage.test.tsx --reporter=dot` | 구현 전 파일 누락/복합 골격 누락 실패 → 구현 후 6개 통과 |
| `node node_modules/vitest/vitest.mjs run --reporter=dot` | 373개 중 369개 통과, 기존 메뉴 4개 실패. 이번 후속 추가 테스트 6개 통과 |
| 마지막 반응형 수정 후 loading-state/resource-list-skeleton/AuthenticatedWorkspaceLayout/HomePage/ProjectDetailPage 관련 실행 | 5개 파일 37개 통과 |
| `node node_modules/eslint/bin/eslint.js .` | 종료 0, 기존 Fast Refresh 경고 4개 |
| `node node_modules/typescript/bin/tsc -b && node node_modules/vite/bin/vite.js build` | 종료 0, 기존 대형 chunk 경고 |
| `git diff --check` | 종료 0 |
| 실제 React 목록 + 제어한 조회 응답 | 100ms 완료는 미표시, 350ms 대기는 표시, 검색 대기 450ms에도 이전 결과 유지 |
| 실제 HomePage 셸 + 제어한 조회 응답 | 초기 100ms 숨김/350ms 표시, 워크스페이스 응답 후 프로젝트 골격은 다시 숨겨지지 않음 |
| 390×844 / 1440×900 브라우저 | 모바일 본문 가로 넘침 없음, 테이블 내부만 가로 스크롤. 모바일 도구 골격 높이 84px. 데스크톱 4열 카드 위치/너비 확인 |

브라우저 검증은 별도 탭에서 실제 컴포넌트·조회 훅과 임시 axios adapter로 수행했으며 서버 데이터는 수정하지 않았다. 모든 페이지의 실제 백엔드 E2E를 수행한 것은 아니다. 기존 메뉴 테스트 4개는 후속 조사 대상이다. 서버는 localhost:5173/4000을 유지하고 commit·push·merge·PR은 하지 않는다.

### 통합 승인 및 커밋 전 재검증

- 사용자가 이슈 생성·커밋·PR 생성·병합·로컬 pull을 명시적으로 요청했다. 위의 미통합 상태 기록은 요청 이전 상태이며, 이 승인에 따라 통합한다.
- 이슈: [#64](https://github.com/nandev-parkk/in2white/issues/64). 작업 브랜치를 `fix/64-loading-feedback`으로 연결하고 기본 브랜치 `dev`에 PR로 병합한다.
- 커밋 전 전체 테스트 재실행: 373개 중 369개 통과, 기존 메뉴 테스트 4개만 실패. ESLint 오류 0/기존 경고 4, TypeScript·Vite 빌드 성공, diff 공백 검사 통과.
- 원본 dev의 backend/frontend lockfile 변경과 미추적 pnpm-workspace 파일은 통합 대상에서 제외하고 보존한다. 개발 서버가 사용하는 worktree와 node_modules 심볼릭 링크는 제거하지 않는다.
