# 프로젝트 목록 페이지 설계

## 상태

설계 승인 완료

## 목표

로그인한 사용자를 기본 워크스페이스의 프로젝트 목록 경로로 이동시키고, 인증된 사용자가 선택한 워크스페이스의 프로젝트를 Figma 디자인과 동일한 업무용 목록 화면에서 탐색하며 검색·페이지 이동·뷰 전환·프로젝트 생성·권한이 있는 프로젝트의 수정과 삭제를 수행할 수 있도록 한다.

## 근거 문서와 디자인 참조

- [`PRODUCT.md`](../../../PRODUCT.md)
  - 워크스페이스 안에서 프로젝트를 생성·검색·수정·삭제한다.
  - Owner와 Member 모두 프로젝트를 조회하고 생성할 수 있다.
  - 프로젝트 수정·삭제는 Workspace Owner 또는 해당 프로젝트 Creator만 수행할 수 있다.
- [`DESIGN.md`](../../../DESIGN.md)
  - 목록 중심 화면은 Compact density와 Hairline border를 사용한다.
  - 기본 목록은 List Cell, 선택적 뷰는 Grid Tile을 사용한다.
  - 화면당 Near-black primary action을 사용한다.
- Figma 파일 `Dimhltnal74SHy2NcLz1Lf`
  - 기준 캔버스: `84:2`
- 기본 프로젝트 목록: `125:158 Workspace Home`
- 테이블 뷰 참고: `125:274 Workspace Home (Table View)`
- 생성 모달 참고: `141:370 Workspace Home — 프로젝트 생성 Modal`
- 카드 메뉴 참고: `147:735 Workspace Home — 카드 메뉴`
- 접근 불가 전체 화면 레이아웃 참고: `224:4748 Workspace Home — 접근 권한 없음 (전체 화면)`
- 존재하지 않는 workspace 전체 화면: `325:2 Workspace Home — 존재하지 않는 워크스페이스 (전체 화면)`

Figma MCP `get_design_context`로 `125:158`의 레이아웃·타이포그래피·아이콘·스크린샷을 읽었다. Code Connect 매핑은 현재 프로젝트에서 제공되지 않으므로 기존 프로젝트 컴포넌트와 토큰을 우선 재사용한다.
접근 불가 화면은 Figma MCP로 `224:4748`의 1440×640 전체 화면, 중앙 360px Empty State, Users 아이콘, 문구와 버튼 배치를 확인했다. 존재하지 않는 workspace 화면은 해당 프레임을 복제해 동일한 구조를 유지하고 텍스트 레이어만 `325:2` 기준으로 교체했다.

## 범위

### 포함

- 기존 인증 홈(`/`)의 프로젝트 placeholder를 프로젝트 목록 화면으로 교체한다.
- 로그인 성공 후 `/`를 거치지 않고 기본 워크스페이스를 확인해 `/workspaces/:workspaceId/projects`로 직접 이동시킨다.
- 기존 세션으로 `/`에 직접 접근한 경우에는 호환용 진입점에서 기본 워크스페이스 프로젝트 route로 이동시킨다.
- `/workspaces/:workspaceId` 워크스페이스 홈 경로는 만들지 않는다.
- 워크스페이스 선택 변경 시 해당 `/workspaces/:workspaceId/projects` 경로로 이동한다.
- 새 워크스페이스를 생성하면 현재 workspace와 프로젝트 목록을 유지하고, Sidebar 목록에만 새 workspace를 반영한다.
- 선택된 워크스페이스의 프로젝트 목록을 기존 백엔드 API에서 조회한다.
- 카드 그리드를 기본 뷰로 표시한다.
- Figma의 뷰 전환 컨트롤로 테이블 뷰를 표시한다.
- 프로젝트 이름 검색과 서버 페이지네이션을 연결한다.
- `새 프로젝트 생성` 모달에서 이름과 선택적 설명을 입력한다.
- 현재 사용자가 Workspace Owner이거나 프로젝트 Creator인 경우 카드 메뉴에서 이름 수정과 삭제를 제공한다.
- 로딩·조회 실패·빈 결과·mutation 실패 상태를 제공한다.
- 접근할 수 없거나 존재하지 않는 workspace ID로 접근하면 Figma `325:2` 기준 전체 화면 상태를 표시하고 기본 workspace 프로젝트 목록으로 돌아가는 버튼을 제공한다.
- 기존 디자인 시스템 컴포넌트와 토큰, Pretendard, 프로젝트 로고·아이콘 체계를 재사용한다.

### 제외

- 프로젝트 상세 및 화이트보드 문서 화면
- 프로젝트 백엔드 API, DB 스키마, migration 변경
- 프로젝트 이름 중복 방지
- 실시간 프로젝트 협업 상태
- 워크스페이스 멤버/설정 화면 구현
- 새 Code Connect 매핑 작성

## 성공 조건

1. 로그인 후 `/`를 거치지 않고 기본 워크스페이스의 `/workspaces/{workspaceId}/projects`로 이동하고, 해당 프로젝트가 카드 그리드로 표시된다.
2. Figma의 1440×680 기준 구조가 유지된다: 240px 사이드바, 20px 콘텐츠 여백, 1160px 콘텐츠 영역, 4열 카드 그리드와 12px gap.
3. 검색어가 프로젝트 이름 포함 검색으로 API에 전달되고 검색 시 페이지가 1로 돌아간다.
4. pagination meta에 따라 이전/다음 및 페이지 번호를 조작할 수 있다.
5. 그리드/테이블 전환이 같은 조회 결과를 사용하며, 기본값은 그리드다.
6. 이름이 비어 있거나 50자를 초과하면 생성·수정 요청을 보내지 않고 폼 오류를 표시한다.
7. 프로젝트 생성 성공 시 모달이 닫히고 목록 query가 무효화되어 새 프로젝트가 반영된다.
8. 권한 없는 사용자는 수정·삭제 메뉴를 볼 수 없으며, 백엔드가 반환한 403/404/500 오류는 토스트 또는 화면 오류 상태로 안내된다.
9. 존재하지 않거나 접근할 수 없는 workspace URL은 Figma 권한 없음 전체 화면을 표시하고 기본 workspace로 돌아간다.
10. 새 workspace 생성 성공 후 현재 workspace URL과 프로젝트 목록은 변하지 않는다.
11. 기존 프론트엔드 테스트를 깨뜨리지 않고 프로젝트 API·hook·페이지 상호작용을 테스트한다.

## 아키텍처

### 모듈 경계

- `entities/project`
  - Project 도메인 타입과 `/workspaces/:workspaceId/projects` API 호출만 담당한다.
  - HTTP 응답의 날짜는 API 응답 타입에서 ISO 문자열로 받는다.
- `features/project`
  - TanStack Query hook으로 조회·생성·수정·삭제 mutation과 query invalidation을 제공한다.
  - 생성·수정 폼과 카드 메뉴처럼 프로젝트 단위 상호작용을 둔다.
- `pages/home`
  - 인증 세션, 현재 워크스페이스, workspace 접근 상태를 조합한다.
  - 프로젝트 카드 그리드·테이블·페이지네이션을 표시하고, 기존 Sidebar를 그대로 조합한다.
- `pages/workspace-access-denied`
  - 존재하지 않거나 접근할 수 없는 workspace URL의 Figma 전체 화면 상태와 기본 workspace 복귀 동작을 제공한다.
- `routes`
  - `/`는 인증 여부를 확인한 뒤 기본 워크스페이스 프로젝트 경로로 redirect한다.
  - `/workspaces/$workspaceId/projects`만 프로젝트 목록 페이지에 연결한다.
- `shared/ui`
  - 기존 `Sidebar`, `Button`, `Search`, `Pagination`, `Dialog`, `DropdownMenu`, `Card`, `Avatar`, `EmptyState`를 재사용한다.

### 데이터 흐름

```text
session + selected workspace
        ↓
useProjects(accessToken, workspaceId, { search, page, limit: 6 })
        ↓
GET /workspaces/:workspaceId/projects
        ↓
grid/table renderer + pagination
        ↓
create/update/delete mutation → invalidate projects query
```

- 워크스페이스 선택이 바뀌면 페이지를 1로 초기화하고 새 목록을 조회한다.
- 검색어가 바뀌면 페이지를 1로 초기화하고 `search` query parameter로 전달한다.
- Query key는 `['projects', workspaceId, { search, page, limit }]`로 구성해 워크스페이스와 검색 결과를 섞지 않는다.
- 프로젝트가 없으면 오류가 아닌 빈 상태로 표시하고 `새 프로젝트 생성` 진입점을 유지한다.

## 라우팅 및 기본 워크스페이스 이동

- URL 리소스명은 복수형으로 고정한다: `workspaces`, `projects`.
- 동적 경로 파라미터는 단수 의미의 `$workspaceId`를 사용한다.
- 파일 기반 라우트는 `frontend/src/routes/workspaces/$workspaceId/projects.tsx`로 둔다.
- 기존 `frontend/src/routes/index.tsx`는 화면을 렌더링하지 않고 인증 세션의 사용자로 워크스페이스 목록을 조회한다.
- `isDefault === true`인 워크스페이스를 우선 선택하고, 데이터가 항상 최소 하나라는 제품 규칙에 따라 없으면 첫 번째 워크스페이스를 fallback으로 사용한다.
- 기본 워크스페이스 조회 중에는 `/`에서 `워크스페이스로 이동하는 중` 상태를 표시하고, 실패하면 `워크스페이스로 이동하지 못했어요`와 다시 시도 버튼을 제공한다.
- 로그인 성공 시 workspace 목록을 조회하고 `isDefault` workspace를 선택해 `/workspaces/$workspaceId/projects`로 직접 navigate한다. workspace 조회에 실패하면 로그인 화면에서 오류를 안내하고 프로젝트 route로 이동하지 않는다.
- 기존 세션 사용자의 `/` 직접 접근은 `WorkspaceRedirectPage`로 처리해 동일한 기본 workspace 선택 규칙을 유지한다.
- 프로젝트 목록 페이지는 route의 `$workspaceId`를 현재 선택 workspace로 사용한다. Sidebar에서 다른 workspace를 선택하면 같은 collection 경로의 새 ID로 navigate한다.
- 사용자가 접근할 수 없는 workspace ID를 직접 입력하면 프로젝트 API를 호출하기 전에 workspace 목록과 대조한다. 목록에 없으면 프로젝트 목록 대신 권한 없음 전체 화면을 표시하고, 기본 workspace 복귀 버튼이 canonical project route로 이동한다.

## API 및 권한 계약

기존 백엔드 계약을 변경하지 않고 그대로 사용한다.

### 조회

아래 API 예시의 `limit=20`은 백엔드가 허용하는 일반적인 요청 예시이며, 프로젝트 목록 UI는 Figma 기준에 따라 `limit=6`을 보낸다.

```http
GET /workspaces/:workspaceId/projects?page=1&limit=20&search=브랜드
Authorization: Bearer <access-token>
```

응답은 `{ projects, pagination }`이며 프로젝트 항목은 `id`, `workspaceId`, `name`, `description`, `creatorId`, `creator`, `createdAt`, `updatedAt`을 포함한다.

### 생성

```http
POST /workspaces/:workspaceId/projects
Content-Type: application/json

{ "name": "2026 브랜드 리뉴얼", "description": "..." }
```

이름은 trim 후 1~50자, 설명은 trim 후 최대 200자이며 빈 설명은 `null`로 보낸다. Owner와 Member 모두 생성할 수 있다.

### 수정·삭제

- `PATCH /workspaces/:workspaceId/projects/:projectId`
- `DELETE /workspaces/:workspaceId/projects/:projectId`
- Workspace Owner 또는 프로젝트 Creator만 수행할 수 있다.
- 권한이 없으면 UI에서 메뉴를 숨기고, 경쟁 상태로 403/404가 반환되면 mutation 모달 오류를 표시하고 현재 목록을 유지한다.

## UI 동작과 상태

- 기본 뷰: Figma `125:158`의 카드 그리드.
- 그리드: 1440px 기준 카드 280px, 12px gap, 4열을 유지하고, 가용 폭에 따라 카드가 4→3→2→1열로 줄어든다. 카드가 Figma 기준보다 과도하게 좁아지지 않도록 CSS grid의 최소 열 폭과 breakpoint를 함께 조정한다.
- 카드: folder 아이콘, 더보기 메뉴, 이름, 설명, 생성일, 수정일, 생성자 아바타/이름을 표시한다.
- 날짜: 기존 서버 ISO 날짜를 한국어 상대 시간 또는 `YYYY.MM.DD` 형식으로 변환한다. 카드의 생성일은 날짜, 수정일은 상대 시간으로 표시한다.
- 테이블: Figma `125:274`의 열 구조(이름, 생성자, 생성일, 수정일, 메뉴)를 따른다.
- 생성 모달: Figma `141:370`의 360px modal, 이름 required, 설명 optional, 취소/생성 버튼을 따른다.
- 카드 메뉴: 이름 수정은 동일한 폼 계약을 사용하고, 삭제는 확인 모달을 거친다.
- Mutation 성공은 `toast.success`, 실패는 모달 안의 화면 오류로 안내하고 현재 목록은 유지한다.
- 존재하지 않는 workspace: Figma `325:2`처럼 Sidebar 없이 전체 화면 중앙에 Users 아이콘, `존재하지 않는 워크스페이스예요`, `입력한 워크스페이스를 찾을 수 없어요`, `[기본 workspace명]로 돌아가기`를 표시한다.

## 반응형 및 접근성

- 1440px 기준 Figma의 4열·280px 카드·12px gap을 고정한다.
- 가용 콘텐츠 폭에 따라 4→3→2→1열로 줄이고, 좁은 화면에서는 카드가 콘텐츠를 침범하지 않도록 최소 폭을 사용한다. 테이블은 가로 스크롤을 허용한다.
- 모든 아이콘 버튼에는 한국어 `aria-label`을 제공한다.
- 검색은 `label` 또는 `aria-label="프로젝트 검색"`을 제공한다.
- 모달은 Radix Dialog의 focus trap과 Escape 닫기를 사용한다.
- 삭제·생성 중에는 중복 제출과 닫기를 방지한다.

## 오류 처리

- 프로젝트 조회 실패: `프로젝트를 불러오지 못했어요`와 `다시 시도` 버튼을 표시한다.
- 워크스페이스가 선택되지 않음: `워크스페이스 없음` 상태를 표시한다.
- workspace ID가 workspace 목록에 없음: 프로젝트 API를 호출하지 않고 Figma 존재하지 않는 workspace 전체 화면을 표시한다. 복귀 버튼은 기본 workspace 프로젝트 route로 이동한다.
- 로그인 직후 workspace 목록 조회 실패: 로그인 화면에 `워크스페이스로 이동하지 못했어요`를 표시하고 세션은 유지하되 프로젝트 route로 이동하지 않는다.
- 생성·수정 validation 오류: 입력 필드 아래에 서버/클라이언트 메시지를 표시한다.
- 삭제·mutation 네트워크 오류: 해당 모달 안에 오류를 안내하고 현재 목록을 유지한다.
- 인증 만료 처리는 기존 세션/라우팅 계약을 변경하지 않는다.

## 테스트 전략

- `entities/project/api/project.test.ts`
  - query string, Authorization header, create/update/delete 요청 경로와 body를 검증한다.
- `features/project/model/use-projects.test.tsx`
  - query key, 조회 enabled 조건, mutation 성공 시 `projects` query invalidation을 검증한다.
- `features/project/ui/ProjectFormDialog.test.tsx`, `features/project/ui/ProjectDeleteDialog.test.tsx`
  - required/length validation, submit, loading, error 상태를 검증한다.
- `features/project/ui/ProjectListContent.test.tsx`, `pages/home/ui/HomePage.test.tsx`
  - 프로젝트 로딩/오류/빈 상태, 카드 렌더링, 검색, 뷰 전환, pagination, 생성·삭제 진입과 권한 메뉴를 검증한다.
- `routes/index.test.tsx`
  - 인증 사용자가 `/`에서 기본 워크스페이스 프로젝트 경로로 이동하는지, 워크스페이스 조회 실패 시 재시도 상태를 표시하는지 검증한다.
- `features/auth/ui/LoginForm.test.tsx`
  - 로그인 성공 후 workspace 목록에서 기본 workspace를 선택해 canonical project route로 직접 이동하는지, workspace 조회 실패 시 이동하지 않는지 검증한다.
- `routes/workspaces/$workspaceId/projects.test.tsx`
  - project route가 URL의 workspace ID로 목록 페이지를 렌더링하고 비인증 사용자를 로그인으로 redirect하는지 검증한다.
- `pages/workspace-access-denied/ui/WorkspaceAccessDeniedPage.test.tsx`
  - Figma 문구·버튼을 표시하고 기본 workspace 복귀 callback을 호출하는지 검증한다.
- `pages/home/ui/HomePage.test.tsx`
  - 알 수 없는 workspace ID에서 권한 없음 화면을 표시하고 프로젝트 query를 호출하지 않는지, 새 workspace 생성 후 현재 workspace 선택과 URL을 유지하는지 검증한다.

검증 명령:

```bash
pnpm --dir frontend test
pnpm --dir frontend lint
pnpm --dir frontend build
pnpm --dir frontend format:check
git diff --check
```

## 결정 사항

- 로그인 성공 후 진입점은 `/`를 거치지 않고 기본 workspace 프로젝트 route로 직접 이동한다. `/`는 기존 세션 사용자의 직접 접근을 위한 호환용 redirect route로만 유지한다.
- 프로젝트 목록 화면의 canonical route는 `/workspaces/:workspaceId/projects`다.
- `/workspaces/:workspaceId` 워크스페이스 홈 route는 추가하지 않는다.
- route resource명은 복수형(`workspaces`, `projects`)으로 표기하고 dynamic parameter명은 `$workspaceId`로 표기한다.
- 프로젝트 데이터는 mock이 아니라 이미 구현된 백엔드 API를 사용한다.
- 기본 page size는 Figma 카드 그리드에 보이는 6개 기준으로 고정하고, 백엔드의 가변 `limit` 계약을 사용한다.
- Figma 접근 불가 프레임은 project query보다 우선하는 route-level empty state로 구현한다.
- 새 workspace 생성은 현재 URL과 프로젝트 query를 유지하고 Sidebar 목록만 갱신한다.
- 검색은 프로젝트 이름에 대한 서버 검색을 사용한다.
- Code Connect는 새로 도입하지 않는다. Figma MCP context를 참고하되 기존 코드 컴포넌트·토큰에 맞춰 적응한다.
- Git commit, push, PR은 사용자 요청 없이는 실행하지 않는다.
