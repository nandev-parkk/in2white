# 파비콘과 브라우저 탭 제목 구현 계획

1. 작업 브랜치 `feat/122-favicon-page-titles`에서 기존 페이지와 데이터 흐름을 확인한다.
2. 공용 제목 훅과 client/admin 상세 화면 제목의 실패 테스트를 먼저 작성한다.
3. 공용 훅을 추가하고 모든 라우트에 대응하는 페이지에 고정·동적 제목을 적용한다.
4. 로고 PNG를 두 앱의 파비콘으로 연결하고 기존 기본 SVG를 제거한다.
5. 관련 테스트 통과 후 client/admin/UI 테스트·린트·빌드를 실행한다.

## 실제 변경·계획 차이

- client의 로그인·워크스페이스 이동·계정·프로젝트·멤버·설정·프로젝트 상세·화이트보드 상세에 제목을 적용했다.
- admin의 로그인·대시보드·사용자·워크스페이스·프로젝트·화이트보드 문서·감사 로그·운영 상태 및 사용자·워크스페이스·프로젝트 상세에 제목을 적용했다.
- `packages/ui/src/lib/use-document-title.ts`는 제목 변경과 해제 시 복구만 담당한다. 기존 조회 결과를 사용하므로 API 호출과 의존성을 추가하지 않았다.
- 기존 로고 심볼을 두 앱의 `public/favicon.png`로 복사하고 HTML 링크를 교체했다. admin 초기 제목도 `in2white admin`으로 맞췄다.
- Codebase Memory 인덱싱 도구가 종료 코드 1로 실패하여 관련 소스를 직접 조회했다.
- 제품 동작은 계획대로 구현했다. 사용자 앱 전체 테스트에는 변경 전에도 존재하는 실패가 남아 있다.

## 검증 결과·후속 작업

- TDD: 공용 훅 미구현과 client/admin 제목 미설정으로 테스트가 실패함을 확인한 뒤 구현했다.
- `pnpm --filter @in2white/ui test src/lib/use-document-title.test.ts`: 1개 통과. 제목 변경과 해제 시 기본 제목 복구를 검증했다.
- client의 `WhiteboardEditorPage.test.tsx`, `ProjectDetailPage.test.tsx`, `routes/workspaces/$workspaceId/members.test.tsx`: 15개 통과. 문서명 갱신·오류 fallback·프로젝트명·페이지 이동·뒤로가기 제목을 검증했다.
- `pnpm --filter in2white-admin test src/pages/project-detail/ui/ProjectDetailPage.test.tsx`: 8개 통과. 상세 이름과 로딩 중 기본 제목을 검증했다.
- `pnpm --filter in2white-client --filter in2white-admin --filter @in2white/ui -r test`: UI 51개, admin 123개 통과. client 450개 통과, 1개 실패, 미처리 오류 9건.
- 위와 같은 필터의 `-r lint`, `-r build`: 모두 통과. 빌드에는 기존 대형 청크 경고가 있다.
- 변경된 TS/TSX/HTML과 새 훅 파일의 `prettier --check`, `git diff --check`: 통과.
- 빌드된 두 앱의 PNG 시그니처·84×84 크기·원본 로고 일치·HTML 파비콘 링크를 Python으로 검증했다.

### 변경 전부터 존재하는 테스트 문제

별도 임시 디렉터리에 `git archive HEAD`로 변경 전 코드를 추출하고 아래 두 테스트를 실행해 동일한 실패를 확인했다. 이번 변경 범위에는 포함하지 않았다.

```sh
pnpm --dir "$baseline_dir/client" exec vitest run \
  src/pages/home/ui/HomePage.test.tsx \
  src/features/whiteboard-editor/ui/WhiteboardCanvas.export.test.tsx
```

- `HomePage.test.tsx`: 모바일에서 접힌 사이드바의 `complementary` 역할을 기대하지만 현재 UI는 사이드바 열기 버튼을 표시한다. 실패 1개.
- `WhiteboardCanvas.export.test.tsx`: Excalidraw mock에 `refresh` 메서드가 없어 `excalidrawApi?.refresh is not a function` 미처리 오류 9건이 발생한다.
- 후속 작업: 위 두 기존 테스트의 기대값과 mock을 현재 UI/API에 맞추는 별도 정비가 필요하다.
