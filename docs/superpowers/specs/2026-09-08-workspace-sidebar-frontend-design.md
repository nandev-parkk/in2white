# 워크스페이스 사이드바 프론트엔드 설계

## 목적

Figma `in2white` 파일의 `v1.0` 페이지에 있는 `Workspace Home`과 워크스페이스 전환 상태를 기준으로, 로그인 후 첫 화면에 워크스페이스 중심 사이드바를 연결한다. 기존에 만들어 둔 `shared/ui/sidebar.tsx`의 폴딩·내비게이션 골격을 실제 워크스페이스 API와 연결하고, 사이드바에서 워크스페이스 전환과 생성까지 수행할 수 있게 한다.

## 범위

이번 슬라이스에는 다음 동작을 포함한다.

- `GET /workspaces`를 호출해 현재 사용자가 접근할 수 있는 워크스페이스를 표시한다.
- 목록의 기본 워크스페이스를 초기 선택하고, 사용자가 다른 워크스페이스를 선택하면 현재 선택 상태를 갱신한다.
- 사이드바의 워크스페이스 버튼을 누르면 Figma의 272×320 전환 팝오버를 연다.
- 팝오버 안에서 워크스페이스 이름을 검색하고, 목록 항목을 키보드·마우스로 선택할 수 있게 한다.
- `새 워크스페이스 생성`을 누르면 Figma의 360×227 생성 모달을 열고 `POST /workspaces`로 생성한다.
- 사이드바를 240px에서 64px로 접고 다시 펼친다. 접힌 상태에서는 메뉴 아이콘과 툴팁을 유지하고 워크스페이스 전환 팝오버는 사이드바 오른쪽에 연다.
- 프로젝트·멤버·설정 내비게이션은 현재 화면의 로컬 활성 상태만 바꾼다. 각 상세 화면은 별도 기능으로 남긴다.

## Figma 기준

- 기본 사이드바: `240×640`, 흰색 배경, 오른쪽 `border/subtle`, 내부 패딩 12px, 세로 간격 12px
- 접힌 사이드바: 폭 64px
- 워크스페이스 전환 팝오버: `272×320`, 패딩 12px, 세로 간격 8px, `background/elevated`, 외곽 그림자
- 전환 팝오버 구성: 검색 입력, 워크스페이스 목록, 구분선, `+ 새 워크스페이스 생성`
- 생성 모달: `360×227`, 패딩 32px, 세로 간격 20px, 모서리 12px
- 기존 `frontend/src/app/styles/index.css`의 디자인 토큰과 Pretendard를 사용하며 새 색상 토큰이나 외부 UI 라이브러리를 추가하지 않는다.

## API 계약

백엔드에 이미 구현된 계약을 그대로 사용한다.

```typescript
type WorkspaceRole = 'owner' | 'member'

type WorkspaceSummary = {
  id: string
  name: string
  ownerId: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
  role: WorkspaceRole
}

type ListWorkspacesResponse = {
  workspaces: WorkspaceSummary[]
}

type CreateWorkspaceResponse = {
  workspace: Omit<WorkspaceSummary, 'role'>
}
```

워크스페이스 요청에는 세션 저장소의 access token을 `Authorization: Bearer <token>` 헤더로 전달한다. refresh token은 백엔드가 httpOnly 쿠키로 관리하므로 프론트에서 읽거나 저장하지 않는다.

## 상태와 책임

- `entities/workspace`: API 타입과 요청 함수만 소유한다.
- `features/workspace`: 목록 조회·생성 React Query 훅과 전환 팝오버·생성 모달 UI를 소유한다.
- `shared/ui/sidebar.tsx`: 접힘 상태, 메뉴 레이아웃, 워크스페이스 선택 UI를 조합할 수 있는 표현 컴포넌트로 유지한다.
- `pages/home/ui/HomePage.tsx`: 세션 사용자, 현재 워크스페이스, 접힘 상태, 활성 메뉴를 조합하고 사이드바에 전달한다.

멤버 목록 API는 아직 없으므로 임의의 멤버 데이터를 만들지 않는다. 상단 아바타에는 현재 로그인 사용자를 표시하고, 실제 멤버 수가 필요한 표현은 멤버 API가 추가된 뒤 확장한다.

## 상태별 동작

- 로딩: 워크스페이스 트리거에 스켈레톤 또는 `워크스페이스 불러오는 중`을 표시하고 팝오버 항목을 비활성화한다.
- 빈 목록: `워크스페이스가 없습니다`와 `새 워크스페이스 생성` 액션을 표시한다.
- 조회 실패: `워크스페이스를 불러오지 못했어요`와 `다시 시도` 액션을 표시한다.
- 생성 실패: 모달을 닫지 않고 `워크스페이스를 만들지 못했어요`를 표시한다.
- 생성 성공: 목록 캐시를 무효화하고 생성된 워크스페이스를 선택한 뒤 모달과 팝오버를 닫는다.
- 세션 없음: API 쿼리를 실행하지 않고 로그인 화면으로 이동시키는 기존 인증 흐름과 충돌하지 않도록 HomePage 테스트에서 세션을 명시한다. 이번 작업에서는 인증 영속화나 새 route guard를 추가하지 않는다.

## 제외 범위

- 워크스페이스 설정 화면 및 이름 수정·삭제
- 멤버 초대·삭제·목록 API와 멤버 화면
- 프로젝트 카드·테이블·검색·페이지네이션 구현
- 선택 워크스페이스 영속화(localStorage 등)
- 백엔드 API나 스키마 변경

## 완료 기준

- 로그인 성공 후 `/`에서 Figma와 같은 기본 사이드바 구조가 보인다.
- 워크스페이스 목록 조회·검색·전환·생성이 실제 API와 연결된다.
- 240px↔64px 폴딩과 접힌 상태의 접근 가능한 툴팁이 동작한다.
- API 요청 함수, 팝오버, 생성 모달, HomePage 조합 테스트가 통과한다.
- `pnpm --dir frontend test`, `pnpm --dir frontend lint`, `pnpm --dir frontend build`가 모두 성공한다.
