# Figma UI 정합성 구현 계획

목표: 승인된 디자인 점검 결과를 기존 프론트엔드 컴포넌트에 반영한다.
설계: ../specs/2026-09-22-figma-ui-alignment-design.md
기술: React, TypeScript, Tailwind CSS, Vitest. 이슈 #72의 `fix/72-figma-ui-alignment` 브랜치에서 진행한다.

- [x] 공통 클래스 병합: 토큰 보존 회귀 테스트를 실패시킨 후 shared/lib의 cn 함수에 custom font-size 그룹을 등록하고 모든 호출자를 연결한다.
- [x] 기존 sidebar, ProjectCard, table, dialog의 확정된 크기·간격을 수정한다. 기존 검색·접근성·권한을 유지한다.
- [x] ProjectListContent 및 문서 목록의 로딩을 Skeleton으로 교체한다. WhiteboardEditorPage에 헤더를 유지하는 로딩 화면을 적용한다.
- [x] CanvasTopBar 상태색·아이콘 크기·참여자 노출을 수정하고 WhiteboardCanvas 내보내기를 기존 DropdownMenu에 연결한다.
- [x] corepack pnpm test, lint, build 및 브라우저 화면을 검증하고 결과·차이·후속 작업을 아래에 기록한다.

## 검토 초점

긴 제목, 연결 끊김, 초기 로딩, 빈 목록과 검색 결과 없음, 모바일 폭에서 기존 기능과 오류 복구가 유지되어야 한다.

## 실행 결과

### 실제 변경

- 공통 cn 함수를 추가해 31개 기존 UI 호출자가 사용자 정의 글자 크기를 보존한다. 기존 설치된 clsx와 tailwind-merge만 사용한다.
- 사이드바 트리거·내비게이션·프로필, 프로젝트 카드·테이블·폼, 계정 화면 간격을 수정했다.
- 프로젝트/문서/워크스페이스/계정 초기 로딩에 스켈레톤을 적용했다. 빈 프로젝트에서는 중복 생성 도구 모음을 숨긴다.
- 화이트보드 로딩 중 헤더와 중앙 스피너를 유지한다. 저장 성공·연결 끊김 색상, 참여자 노출, 긴 제목 잘림을 수정했다. 내보내기는 기존 메뉴로 이동하고 오류 복구는 보존했다.

### 계획과 차이

- 모바일은 기존 자동 접힘이 정상 작동했다. 390px에서 전환 완료 후 사이드바 64px, 문서 폭 390px으로 확인하여 별도 반응형 로직을 추가하지 않았다.
- 기존 계정 검색, 비밀번호 표시 토글, 멤버 스켈레톤 62px은 기능과 로딩 전후 높이를 유지하기 위해 보존했다.
- 새로운 외부 의존성을 추가하지 않았다. 기존 lockfile로 설치해 socket.io-client 누락을 해결했다.

### 검증

- 클래스 병합 회귀 테스트는 기존 cn에서 글자 크기 소실로 실패함을 확인한 후 수정했다.
- corepack pnpm test: 68개 파일, 356개 테스트 통과.
- corepack pnpm lint: 오류 0, 기존 Fast Refresh 경고 4개.
- corepack pnpm build: 성공.
- git diff --check: 통과.
- 실제 API 연결 브라우저: 제목 20px/검색 14px, 화이트보드 헤더 56px, 저장 성공색, 더 보기 18px, 내보내기 메뉴 노출 확인.
- 모바일 390px 가로 넘침 없음. 데스크톱 1440px 카드 너비 281px/높이 약206px으로 유동 폭과 기존 Pretendard 타이포그래피를 유지한다.

### 후속 작업 및 제한

- 워크스페이스 설정 신규 구현은 별도 범위다.
- 모든 화면의 픽셀 단위 일치나 전체 저장 장애의 실제 네트워크 재현을 완료했다고 주장하지 않는다. 연결 끊김 참여자 노출은 컴포넌트 테스트로 검증했다.
- `origin/dev` (`096dc90`, PR #71)를 fast-forward한 뒤 변경을 복원했다. upstream `ResourceListSkeleton`을 재사용하고, 프로젝트·화이트보드 목록의 지연 로딩과 `kind` API를 유지했다.
- 화이트보드 캔버스의 upstream `reconcileElements` 동기화와 문서별 초기화 키를 보존하면서 내보내기 메뉴를 통합했다. 내보내기 콜백과 헤더의 빈 대체 버튼도 검증 중 발견한 회귀를 바로잡았다.
- 최신 트리에서 `corepack pnpm install --frozen-lockfile`, `corepack pnpm test`, `corepack pnpm lint`, `corepack pnpm build`, `git diff --check`를 실행했고 모두 통과했다.
- 사용자가 요청한 이슈 #72 커밋·PR·`dev` 병합·로컬 pull 작업을 진행한다. 로컬 개발 서버는 종료 상태다.
