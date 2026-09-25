# 워크스페이스 설정 보호와 삭제 UI 구현 계획

## 목표

- 기본 워크스페이스의 이름 변경을 화면과 API에서 차단한다.
- 이름 변경과 삭제가 성공하면 토스트를 표시한다.
- 삭제 영향과 복구 불가 상태가 잘 보이도록 삭제 UI를 정리한다.

## 설계 요약

- 기본 워크스페이스 이름 입력은 읽기 전용으로 표시하고, API는 `403 WORKSPACE_DEFAULT_UPDATE_FORBIDDEN`으로 거부한다.
- 이름 변경과 삭제는 mutation이 성공한 뒤 기존 토스트 유틸을 호출한다. 실패하면 성공 토스트를 표시하지 않는다.
- 삭제 위험 구역과 확인 모달에 경고 아이콘, 함께 삭제되는 항목, 복구 불가 안내를 표시한다.

## 변경 범위

- `backend/src/services/workspace.service.ts`, `backend/src/constants/messages.ts`: 기본 워크스페이스 이름 변경 차단
- `backend/tests/workspace.test.ts`: 기본 워크스페이스 변경 거부 회귀 테스트
- `frontend/src/features/workspace/ui/WorkspaceSettingsContent.tsx`: 읽기 전용 이름 입력, 성공 토스트, 삭제 확인 UI
- `frontend/src/features/workspace/ui/WorkspaceSettingsContent.test.tsx`: 이름 변경·삭제 토스트와 실패 동작 테스트
- 이 설계 문서와 구현 계획 문서

## 작업 순서

1. API 및 화면의 기본 워크스페이스 변경 거부 테스트를 작성한다.
2. 변경을 차단하고 이름 변경·삭제 성공 토스트와 삭제 확인 UI를 구현한다.
3. 실패 시 성공 토스트가 뜨지 않는지 포함해 관련 테스트를 실행한다.
4. 관련 lint·build, `git diff --check`, 최종 작업 트리 상태를 확인한다.

## 완료 조건

- 기본 워크스페이스 이름 변경이 UI와 API 모두에서 거부된다.
- 이름 변경과 삭제 성공 때 각각 성공 토스트가 표시된다.
- mutation 실패 때 성공 토스트가 표시되지 않는다.
- 삭제 확인 UI가 삭제 영향과 복구 불가 상태를 설명한다.
- 검증 결과와 남은 후속 작업을 이 문서에 기록한다.

## 실행 결과

### 최종 검증 (2026-09-25)

- 실제 변경: 기본 워크스페이스 이름 변경을 백엔드에서 거부하고, 설정 UI에서 기본 워크스페이스 이름을 읽기 전용으로 표시한다. 이름 변경·삭제 성공 토스트와 삭제 확인 UI를 추가했다.
- 계획과 달라진 점: 전체 프론트 테스트에서 발견한 Radix 메뉴 4건의 실패를 테스트 초기 포커스 보정으로 해결했다. 실패 원인은 `user-event`의 body 포커스 이동 중 발생한 Window blur였다.
- 검증: frontend `pnpm exec vitest run`, `pnpm lint`, `pnpm build` 통과. backend `pnpm exec vitest run --reporter=dot`, `pnpm lint`, `pnpm build` 통과. 관련 메뉴 테스트 32개 통과.
- 남은 후속 작업: 없음.

### 구현 당시 기록

- 실제 변경: 기본 워크스페이스 이름은 읽기 전용으로 표시하고 API PATCH 요청도 403으로 차단했다. 이름 변경 성공 토스트와 삭제 성공 토스트(`워크스페이스를 삭제했어요`)를 추가했다. 삭제 확인 UI를 경고 아이콘, 삭제 영향 설명, 복구 불가 안내가 있는 형태로 정리했다. 삭제 실패 시 성공 토스트가 호출되지 않는 테스트를 추가했다.
- 계획과 달라진 점: 기능 동작은 계획대로 구현했다. 삭제 실패 시 토스트가 뜨지 않는 조건을 명시적으로 테스트해 성공 피드백의 경계를 확인했다.
- 검증:
  - `pnpm exec vitest run src/features/workspace/ui/WorkspaceSettingsContent.test.tsx --reporter=dot` (frontend): 통과, 1개 파일·9개 테스트.
  - `pnpm test -- src/features/workspace/ui/WorkspaceSettingsContent.test.tsx` (frontend): 인자 전달 방식 때문에 전체 테스트가 실행됨. 412개 중 408개 통과, 4개 메뉴 테스트 실패(ProjectListContent, ProjectDetailHeader, WhiteboardDocumentListContent). 이는 앞선 전체 실행에서도 확인된 미해결 실패다.
  - 이전 전체 검증: 백엔드 테스트 544개 통과·16개 건너뜀, 백엔드 lint/build 통과. 프론트엔드 lint 오류 없음(기존 경고 4개), build 통과.
  - `git diff --check`: 통과.
- 남은 후속 작업: 세 화면의 메뉴 테스트 4건 실패 원인을 별도 수정으로 다룬다. 이 작업에서는 수정하지 않는다.
