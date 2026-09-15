# 프로젝트 상세 프론트엔드 설계

## 상태

사용자 설계 승인 완료, 문서 검토 대기

## 목표

워크스페이스 멤버가 프로젝트 상세 페이지에서 해당 프로젝트의 기본 정보를 확인하고, 프로젝트에 속한 화이트보드 문서를 검색·조회·생성·이름 변경·삭제할 수 있게 한다.

## 근거 문서와 기존 구현

### 디자인

Figma `in2white` 파일(`Dimhltnal74SHy2NcLz1Lf`)의 `v1.0` 페이지에 6개 프레임이 있다.

| 노드 | 이름 |
| --- | --- |
| `173:1854` | Project Detail — 카드 |
| `175:1904` | Project Detail — 테이블 |
| `176:1990` | Project Detail — 빈 상태 |
| `176:2183` | Project Detail — 검색 결과 없음 |
| `178:2230` | Project Detail — 카드 메뉴 |
| `178:3068` | Project Detail — 화이트보드 생성 Modal |

`173:1854`의 레이아웃 구조는 `page-header`(top-row → identity → creator-row) → `toolbar`(Search + view-toggle + Button) → `card-grid`(280px 카드 4열, gap 12px) → `pagination-row`다.

### 제품 요구사항 (`PRODUCT.md` 「프로젝트 상세 (화이트보드 문서 목록) 페이지」)

- 필요한 정보: 문서 이름, 생성자, 생성일, 최종 수정 시각, 그리고 상단의 프로젝트 이름·설명·생성자
- Primary Action: 화이트보드 문서 생성
- Secondary Action: 문서 검색, 프로젝트 이름 변경, 문서 삭제, 프로젝트 삭제
- 워크스페이스에 소속된 사용자만 접근한다
- 프로젝트·문서의 이름 변경과 삭제는 워크스페이스 Owner 또는 해당 리소스를 만든 멤버만 할 수 있다

### 디자인 규칙 (`DESIGN.md` §9.3)

프로젝트 상세 Page Header는 위에서 아래로 4단이다.

1. `top-row` — Breadcrumb 한 줄
2. `title-row` — 뒤로가기 Icon Button(`arrow-left`) + H1(프로젝트 이름)
3. `description` — 프로젝트 설명, 있을 때만 렌더링
4. `creator-row` — Avatar(24px) + "생성자 {이름}"

Toolbar는 Page Header 아래 별도 행으로 둔다. Page Header 자체에는 Primary Action을 두지 않는다.

`DESIGN.md` §621은 Table View 컬럼을 이름/생성자/생성일/수정일 + 컨텍스트 메뉴 열로 규정한다.

### 백엔드 (구현 완료, `dev`에 병합됨)

| 메서드 | 경로 | 응답 |
| --- | --- | --- |
| GET | `/workspaces/:workspaceId/projects/:projectId` | `200 { project }` |
| GET | `/workspaces/:workspaceId/projects/:projectId/whiteboard-documents` | `200 { whiteboardDocuments, pagination }` |
| POST | 〃 | `201 { whiteboardDocument }` |
| PATCH | `〃/:documentId` | `200 { whiteboardDocument }` |
| DELETE | `〃/:documentId` | `204` |

목록 항목은 `id`, `projectId`, `name`, `creatorId`, `creator { id, name }`, `createdAt`, `updatedAt`를 가진다. 목록 쿼리는 `page`, `limit`, `search`를 받는다. 생성·수정 본문은 `{ name }`뿐이다.

문서 이름 변경·삭제는 `membership.role !== "owner" && document.creatorId !== userId`일 때 `403`으로 거부한다.

### 기존 프론트엔드 구현

- `features/project/ui/ProjectListContent.tsx` — 워크스페이스 홈의 프로젝트 목록. 툴바·카드/테이블 전환·페이지네이션·빈 상태·Dialog 패턴의 기준이 된다
- `shared/ui/whiteboard-card.tsx` — 디자인 시스템 카드가 이미 있으나 아직 Storybook에서만 쓰인다
- `shared/ui/{breadcrumb,page-header,pagination,search,table,empty-state,dropdown-menu,avatar}.tsx` — 필요한 프리미티브가 모두 존재한다
- `pages/shared/ui/AuthenticatedWorkspaceLayout.tsx` — Sidebar·워크스페이스 선택·접근 권한 거부를 담당하는 render prop 레이아웃
- 화이트보드 문서용 entity·feature·라우트는 **없다**

## 범위

### 포함

- 프로젝트 상세 라우트와 페이지
- 프로젝트 단건 조회 API 클라이언트와 쿼리 훅
- 화이트보드 문서 entity(API 클라이언트 4종)와 feature(쿼리·뮤테이션 훅)
- 문서 목록 카드 View와 Table View, 두 View 전환
- 문서 이름 검색, 페이지네이션
- 문서 생성·이름 변경·삭제 Dialog와 Toast
- 프로젝트 수정·삭제 메뉴(Page Header)
- 로딩·오류·빈 상태·검색 결과 없음 상태
- 권한에 따른 컨텍스트 메뉴 노출 제어
- 워크스페이스 홈 프로젝트 카드·행에서 상세로 이동
- 위 동작의 단위·통합 테스트

### 제외

- 화이트보드 캔버스 편집 화면 — 별도 설계·계획 사이클로 분리한다. 문서를 클릭해도 이동하지 않는다
- 실시간 협업, 문서 썸네일 — 백엔드가 썸네일을 제공하지 않으므로 Figma와 동일하게 점 패턴 플레이스홀더를 쓴다
- 백엔드 변경
- 프로젝트 목록 페이지의 동작 변경 — 공통 조각 추출에 따른 내부 구조 변경만 있고 동작은 같다

## 검토한 접근법

### 1. 공통 조각만 좁게 추출 후 재사용 — 선택

문구가 없는 순수 표현 컴포넌트 두 개(뷰 토글, 페이지네이션 블록)만 `shared/ui`로 올리고, 프로젝트 목록도 그것을 쓰도록 바꾼다. 카드·테이블·빈 상태·Dialog는 문구와 컬럼이 다르므로 문서용으로 따로 만든다.

중복 약 50줄을 없애면서 두 화면의 토글·페이지네이션 동작이 어긋날 여지를 없앤다. 기존 테스트가 회귀를 잡는다.

### 2. 제네릭 `ResourceListContent<T>` 추상화

프로젝트와 문서가 설정 객체만 넘기는 방식. 카드 렌더러·메뉴 항목·권한 판정·빈 상태 문구·Dialog가 모두 달라 props가 10개 이상으로 불어난다. 지금 필요한 것보다 큰 추상화라 채택하지 않는다.

### 3. 완전 복제

기존 파일을 건드리지 않아 리뷰 범위가 가장 작지만, 토글·페이지네이션 로직이 두 벌로 갈라져 이후 디자인 변경 때마다 양쪽을 고쳐야 한다.

## 라우팅

```
src/routes/workspaces/$workspaceId/projects_.$projectId.tsx
```

경로는 `/workspaces/$workspaceId/projects/$projectId`다.

`projects_`의 후행 밑줄은 TanStack Router의 비중첩 라우트 규칙이다. 밑줄 없이 `projects.$projectId.tsx`로 만들면 기존 `projects.tsx`가 레이아웃 라우트로 승격되는데, 그 컴포넌트에는 `<Outlet />`이 없어 상세 화면이 렌더링되지 않는다. 밑줄을 쓰면 기존 `projects.tsx`와 그것을 import하는 `account.tsx`를 건드리지 않아도 된다.

설치된 `@tanstack/router-generator` 1.168.35가 이 규칙을 지원하는 것을 확인했다.

라우트는 `beforeLoad: redirectIfUnauthenticated`를 적용하고 `PROJECT_DETAIL_ROUTE` 상수를 export한다. 기존 `PROJECTS_ROUTE` 패턴과 같다.

## API 계약 (프론트엔드 클라이언트)

### 프로젝트 단건 조회

`entities/project/api/project.ts`에 추가한다.

```ts
export async function getProjectRequest(
  workspaceId: string,
  projectId: string,
  accessToken: string,
): Promise<Project>
```

`GET /workspaces/{workspaceId}/projects/{projectId}` → `data.project`를 반환한다.

### 화이트보드 문서

`entities/whiteboard-document/api/whiteboard-document.ts`를 새로 만든다.

```ts
export type WhiteboardDocumentCreator = { id: string; name: string }

export type WhiteboardDocument = {
  id: string
  projectId: string
  name: string
  creatorId: string
  creator: WhiteboardDocumentCreator
  createdAt: string
  updatedAt: string
}

export type WhiteboardDocumentListParams = {
  page: number
  limit: number
  search?: string
}

export type ListWhiteboardDocumentsResponse = {
  whiteboardDocuments: WhiteboardDocument[]
  pagination: Pagination
}

/** 생성 응답은 creator를 포함하지 않는다. */
export type CreatedWhiteboardDocument = Omit<WhiteboardDocument, 'creator'>

/** 이름 변경 응답은 변경된 필드만 돌려준다. */
export type UpdatedWhiteboardDocument = {
  id: string
  name: string
  updatedAt: string
}
```

| 함수 | 요청 | 반환 |
| --- | --- | --- |
| `listWhiteboardDocumentsRequest` | `GET …/whiteboard-documents` | `ListWhiteboardDocumentsResponse` |
| `createWhiteboardDocumentRequest` | `POST …/whiteboard-documents` `{ name }` | `CreatedWhiteboardDocument` |
| `updateWhiteboardDocumentRequest` | `PATCH …/whiteboard-documents/{id}` `{ name }` | `UpdatedWhiteboardDocument` |
| `deleteWhiteboardDocumentRequest` | `DELETE …/whiteboard-documents/{id}` | `void` |

백엔드는 엔드포인트마다 다른 형태를 돌려준다 (`backend/src/services/whiteboard-document.service.ts`). 목록 항목만 `creator`를 포함하고, 생성 응답은 `creator` 없이 문서 필드를 돌려주며, 이름 변경 응답은 `{ id, name, updatedAt }`만 돌려준다. 셋을 하나의 타입으로 뭉뚱그리지 않는다. UI는 뮤테이션 반환값을 쓰지 않고 목록 쿼리를 무효화하므로 이 차이가 화면에 영향을 주지 않는다.

`search`는 공백을 제거한 뒤 빈 문자열이면 쿼리에서 뺀다. `Authorization: Bearer {accessToken}` 헤더를 붙인다. 두 규칙 모두 `listProjectsRequest`와 같다.

페이지네이션 응답 구조(`page`, `limit`, `total`, `totalPages`)는 프로젝트 목록과 같다. 다만 `entities/whiteboard-document`가 `entities/project`를 import하면 entity끼리 의존하게 되므로, 공통 타입을 `shared/types/pagination.ts`의 `Pagination`으로 옮기고 양쪽이 그것을 쓴다. 기존 `ProjectPagination`은 `Pagination`의 별칭으로 남겨 소비자를 건드리지 않는다.

## 쿼리 키와 무효화

| 훅 | 쿼리 키 | 무효화 대상 |
| --- | --- | --- |
| `useProject` | `['project', workspaceId, projectId]` | — |
| `useWhiteboardDocuments` | `['whiteboard-documents', workspaceId, projectId, params]` | — |
| `useCreateWhiteboardDocument` | — | `['whiteboard-documents', workspaceId, projectId]` |
| `useUpdateWhiteboardDocument` | — | 〃 |
| `useDeleteWhiteboardDocument` | — | 〃 |

`accessToken`이나 식별자가 없으면 `enabled: false`로 둔다. 기존 `useProjects`와 같은 형태다.

## 화면 구성

### Page Header

```
Breadcrumb        프로젝트(링크) → {프로젝트명}
title-row         ← 뒤로가기   {프로젝트명}            [⋮]
description       {설명}                    ← 있을 때만
creator-row       (Avatar 24px) 생성자 {이름}
```

- 뒤로가기 버튼과 Breadcrumb의 "프로젝트" 링크는 모두 `/workspaces/$workspaceId/projects`로 간다
- Breadcrumb은 Figma에 프로젝트명 한 항목만 있으나 `DESIGN.md` §9.3을 따라 두 항목으로 만든다. 상위로 가는 링크가 있어야 Breadcrumb이 제 역할을 하고, 뒤로가기 버튼과 목적이 다르다. 이 차이는 Figma 반영 단계에서 맞춘다
- `⋮` 프로젝트 메뉴는 "수정"과 "삭제"를 갖는다. `PRODUCT.md`가 요구하는 Secondary Action이며 Figma에는 없다. Figma 반영 단계에서 추가한다

### Toolbar

Search(`화이트보드 이름으로 검색`) + 뷰 토글 + Primary Button(`화이트보드 생성`). 기존 프로젝트 목록 툴바와 배치가 같다.

Figma의 Search placeholder는 "프로젝트 이름으로 검색"으로 되어 있으나, 이 화면의 검색 대상은 화이트보드 문서다. 오기로 판단하고 코드에서는 "화이트보드 이름으로 검색"을 쓰며 Figma 반영 단계에서 고친다.

### 목록

- **카드 View** — `shared/ui/whiteboard-card.tsx`를 그리드에 배치한다. 그리드 클래스는 프로젝트 목록과 동일하게 `repeat(auto-fit, minmax(min(100%, 280px), 1fr))` 기반으로 최대 4열이다
- **Table View** — 이름 / 생성자 / 생성일 / 수정일 + 컨텍스트 메뉴 열
- **페이지네이션** — 페이지당 12개. 총 페이지가 2 이상일 때만 렌더링한다

### Dialog

| Dialog | 필드 | 제목 / 확정 라벨 |
| --- | --- | --- |
| 문서 생성 | 이름 | 새 화이트보드 만들기 / 만들기 |
| 문서 이름 변경 | 이름 | 화이트보드 이름 변경 / 저장 |
| 문서 삭제 | — | 확인 문구 + 삭제 |
| 프로젝트 수정·삭제 | 기존 `ProjectFormDialog` · `ProjectDeleteDialog` 재사용 | |

문서 Dialog는 이름 하나만 받으므로 `ProjectFormDialog`(이름 + 설명)를 재사용하지 않고 별도 컴포넌트로 만든다. 백엔드 생성·수정 본문도 `{ name }`뿐이다.

## 권한 및 오류 계약

### 권한

| 동작 | 허용 | 프론트엔드 처리 |
| --- | --- | --- |
| 프로젝트·문서 조회 | 워크스페이스 Owner·Member 전원 | 제한 없음 |
| 문서 생성 | Owner·Member 전원 | 항상 표시 |
| 문서 이름 변경·삭제 | Owner 또는 문서 생성자 | 권한이 없으면 `⋮`를 렌더링하지 않는다 |
| 프로젝트 수정·삭제 | Owner 또는 프로젝트 생성자 | 〃 |

판정식은 `workspaceRole === 'owner' || resource.creatorId === userId`로 기존 `ProjectListContent`와 같다. Disabled 상태로 보여주지 않는 것은 `DESIGN.md` §8.9를 따른다. 백엔드가 최종 권위이며 프론트엔드는 표시만 제어한다.

### 오류와 상태

| 상황 | 표현 |
| --- | --- |
| 프로젝트 404 (없음·타 워크스페이스·삭제됨) | 본문 전체를 `EmptyState`로 대체한다. "프로젝트를 찾을 수 없어요" + "프로젝트 목록으로" 버튼. 문서 목록은 렌더링하지 않는다 |
| 워크스페이스 접근 권한 없음 | 기존 `AuthenticatedWorkspaceLayout`의 `WorkspaceAccessDeniedPage` 경로를 그대로 탄다 |
| 프로젝트 조회 실패 (404 외) | 본문 전체에 안내 문구 + "다시 시도" 버튼. 404와 달리 재시도가 의미 있으므로 구분한다 |
| 프로젝트 조회 로딩 | Page Header 4단과 같은 높이의 Skeleton으로 대체한다 (`DESIGN.md` §9.7 — 비동기 영역만 Skeleton, Layout Shift 없음). Toolbar와 문서 목록은 이때 렌더링하지 않는다 |
| 문서 목록 로딩 | "화이트보드 불러오는 중" |
| 문서 목록 오류 | 안내 문구 + "다시 시도" 버튼 |
| 문서 없음 | `EmptyState` — "아직 화이트보드가 없어요" + "새 화이트보드 만들기" |
| 검색 결과 없음 | `EmptyState` — "검색 결과가 없어요" + "검색 결과 초기화" |
| 생성·수정·삭제 실패 | Dialog 안에 오류 문구를 두고 Dialog를 닫지 않는다 |
| 생성·수정·삭제 성공 | Toast + Dialog 닫기 |

문구와 표현 방식은 `ProjectListContent`의 대응 상태와 같은 형태를 쓴다.

삭제로 현재 페이지가 비면 이전 페이지로 이동한다. 프로젝트 삭제 성공 시에는 Toast를 띄우고 프로젝트 목록으로 이동한다.

## 파일 경계

### 추가

| 파일 | 책임 |
| --- | --- |
| `routes/workspaces/$workspaceId/projects_.$projectId.tsx` | 라우트 정의, 인증 가드, params → 페이지 전달, 네비게이션 콜백 |
| `entities/whiteboard-document/api/whiteboard-document.ts` | 타입과 HTTP 요청 4종 |
| `entities/whiteboard-document/index.ts` | barrel |
| `features/whiteboard-document/model/use-whiteboard-documents.ts` | 쿼리·뮤테이션 훅 |
| `features/whiteboard-document/index.ts` | barrel |
| `features/whiteboard-document/ui/WhiteboardDocumentListContent.tsx` | 검색·뷰 전환·페이지네이션·Dialog 상태를 가진 목록 컨테이너 |
| `features/whiteboard-document/ui/WhiteboardDocumentTable.tsx` | Table View |
| `features/whiteboard-document/ui/WhiteboardDocumentFormDialog.tsx` | 생성·이름 변경 공용 Dialog |
| `features/whiteboard-document/ui/WhiteboardDocumentDeleteDialog.tsx` | 삭제 확인 Dialog |
| `features/project/ui/ProjectDetailHeader.tsx` | 4단 Page Header와 프로젝트 메뉴 |
| `pages/project-detail/ui/ProjectDetailPage.tsx` | 레이아웃 조립, 프로젝트 조회, 404 처리 |
| `pages/project-detail/index.ts` | barrel |
| `shared/ui/view-toggle.tsx` | 카드/목록 전환 토글 |
| `shared/ui/list-pagination.tsx` | 페이지 번호 목록 페이지네이션 |
| `shared/lib/resource-date.ts` | `formatCreatedAt` · `formatUpdatedAt` |
| `shared/types/pagination.ts` | 목록 응답 공통 `Pagination` 타입 |

### 수정

| 파일 | 변경 |
| --- | --- |
| `shared/ui/whiteboard-card.tsx` | 고정폭 `w-58` → `w-full`, `onMenuClick` → `menu?: ReactNode` 슬롯 |
| `features/project/ui/ProjectListContent.tsx` | 추출한 `ViewToggle` · `ListPagination` 사용 |
| `features/project/ui/ProjectCard.tsx` | `onOpen` 추가, 날짜 헬퍼 경로 변경 |
| `features/project/ui/ProjectTable.tsx` | 〃 |
| `features/project/model/use-projects.ts` | `useProject` 추가 |
| `features/project/index.ts` | `useProject` export |
| `entities/project/api/project.ts` | `getProjectRequest` 추가, `ProjectPagination`을 `Pagination` 별칭으로 변경 |
| `entities/project/index.ts` | `getProjectRequest` export |

`shared/ui/whiteboard-card.tsx`는 현재 Storybook에서만 쓰이므로 API 변경의 영향 범위가 stories 파일뿐이다.

### 삭제

`features/project/lib/project-date.ts` — `shared/lib/resource-date.ts`로 옮긴다. 프로젝트와 화이트보드 문서가 같은 날짜 표기(`yyyy.MM.dd`, 한국어 상대 시각)를 쓰므로 feature 계층에 두면 교차 의존이 생긴다.

### 변경하지 않는 파일

- `routes/workspaces/$workspaceId/projects.tsx`와 그것을 import하는 `routes/account.tsx`
- `pages/shared/ui/AuthenticatedWorkspaceLayout.tsx`
- `pages/home/ui/HomePage.tsx` 외 워크스페이스 홈 조립부
- 백엔드 전체

## 테스트 전략

`test-driven-development`에 따라 각 단위마다 실패하는 테스트를 먼저 확인한다.

| 테스트 파일 | 검증 |
| --- | --- |
| `entities/whiteboard-document/api/whiteboard-document.test.ts` | 요청 URL·쿼리·헤더, 빈 검색어 제거, 응답 매핑 |
| `features/whiteboard-document/model/use-whiteboard-documents.test.tsx` | 쿼리 키, `enabled` 조건, 뮤테이션 성공 시 무효화 |
| `features/whiteboard-document/ui/WhiteboardDocumentListContent.test.tsx` | 카드·테이블 전환, 검색 시 페이지 초기화, 페이지네이션, 권한별 메뉴 노출, 생성·이름 변경·삭제의 성공과 실패, 마지막 항목 삭제 시 이전 페이지 이동 |
| `features/whiteboard-document/ui/WhiteboardDocumentFormDialog.test.tsx` | 이름 검증, 로딩 중 닫기 차단, 오류 표시 |
| `features/project/ui/ProjectDetailHeader.test.tsx` | 4단 구조, 설명 없을 때 미렌더링, 권한별 메뉴, 뒤로가기·Breadcrumb 이동 |
| `pages/project-detail/ui/ProjectDetailPage.test.tsx` | 로딩 Skeleton, 404 시 EmptyState, 404 외 오류 시 재시도, 정상 시 목록 렌더링 |
| `routes/workspaces/$workspaceId/projects_.$projectId.test.tsx` | 비인증 리다이렉트, params 전달, 경로 상수 |
| `shared/ui/view-toggle.test.tsx` | `aria-pressed` 전환, 키보드 접근 |
| `shared/ui/list-pagination.test.tsx` | 이전·다음 비활성, 페이지 선택 |

회귀 대상은 기존 `ProjectListContent.test.tsx`, `ProjectCard.test.tsx`, `ProjectTable.test.tsx`, `projects.test.tsx`다. 공통 조각 추출 후에도 수정 없이 통과해야 한다.

검증 명령(`frontend` 디렉터리): `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm format:check`.

## Figma 반영

구현과 검증이 끝난 뒤 별도 단계로 진행한다. 공유 디자인 파일이므로 쓰기 직전에 변경안을 다시 확인받는다.

Project Detail 프레임 6종에 반영할 내용은 다음 세 가지다.

1. `title-row` 우측에 프로젝트 컨텍스트 메뉴(`⋮`) 추가
2. Search placeholder를 "화이트보드 이름으로 검색"으로 수정
3. Breadcrumb을 "프로젝트 → {프로젝트명}" 두 항목으로 수정

## 완료 기준

- 프로젝트 상세 경로에서 프로젝트 이름·설명·생성자와 화이트보드 문서 목록이 보인다
- 카드 View와 Table View를 전환할 수 있고 두 View 모두 컨텍스트 메뉴가 동작한다
- 문서 검색·페이지네이션·생성·이름 변경·삭제가 동작하고 성공·실패 피드백이 표시된다
- 프로젝트 수정·삭제가 Page Header 메뉴에서 동작하고, 삭제 후 프로젝트 목록으로 이동한다
- 권한이 없는 사용자에게 컨텍스트 메뉴가 보이지 않는다
- 없는 프로젝트, 접근 권한 없는 워크스페이스, 목록 오류, 빈 상태, 검색 결과 없음이 설계대로 표현된다
- 워크스페이스 홈에서 프로젝트를 클릭하면 상세로 이동한다
- 신규·회귀 테스트, lint, build, 포맷 검사를 통과한다
- Figma에 위 세 가지가 반영된다
