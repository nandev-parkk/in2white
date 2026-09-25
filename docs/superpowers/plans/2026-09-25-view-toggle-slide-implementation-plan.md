# 보기 전환 선택 표시 이동 구현 계획

## 목표와 범위

공용 `ViewToggle`의 흰색 선택 표시를 카드·테이블 버튼 사이에서 부드럽게 이동시킨다. 프로젝트와 화이트보드 목록에 동일하게 적용한다. 버튼의 공개 API, 권한·오류 계약, 보기 전환 상태 관리는 바꾸지 않는다.

## 작업 1: 전환 동작 검증 추가

대상: `frontend/src/shared/ui/view-toggle.test.tsx`

1. `value`가 `grid`에서 `table`로 바뀌어도 선택 표시가 하나로 유지되고 오른쪽 위치 상태가 적용되는 검증을 추가한다.
2. 두 버튼의 `aria-pressed` 상태도 함께 확인한다.
3. `pnpm --dir frontend test -- src/shared/ui/view-toggle.test.tsx`로 추가 검증이 실패하는지 확인한다.

## 작업 2: 최소 UI 변경

대상: `frontend/src/shared/ui/view-toggle.tsx`

1. 그룹에 장식용 선택 표시를 추가하고 기존 버튼별 선택 배경·테두리·그림자 스타일을 옮긴다.
2. 선택 값에 따라 표시의 `transform`만 전환한다. 200ms `ease-in-out`과 `motion-reduce:transition-none`을 적용한다.
3. 기존 `onChange`, `aria-pressed`, 버튼 접근성 이름과 포커스 표시를 유지한다.

## 작업 3: 검증 및 기록

1. 컴포넌트 테스트를 다시 실행한다.
2. 프런트엔드 전체 테스트, 린트, 빌드를 실행한다.
3. 설계와 구현 차이, 실행 명령과 결과, 후속 작업을 이 문서의 `Implementation Results`에 기록한다.

## Implementation Results

### 실제 변경 내용

- `ViewToggle`에 장식용 흰색 선택 표시 하나를 추가하고 보기 값에 따라 200ms 동안 좌우로 이동시켰다. 움직임 줄이기 설정에서는 전환을 끈다.
- 컴포넌트 테스트에서 선택 표시의 유지·이동 상태와 버튼의 `aria-pressed`를 확인한다.
- 프로젝트 목록 테스트에서 버튼 자체의 이전 배경 스타일을 검사하던 단언을 제거했다. 동일한 시각 스타일은 공용 컴포넌트 테스트에서 검증한다.

### 계획과 달라진 점

프로젝트 목록의 기존 테스트 2개가 이전 버튼별 스타일을 검사해, 해당 테스트 파일도 수정했다. 그 외 동작과 API 변경은 없다.

### 검증 명령과 결과

- `pnpm --dir frontend exec vitest run src/shared/ui/view-toggle.test.tsx --reporter=dot`: 구현 전 새 검증이 실패함을 확인했다.
- `pnpm --dir frontend exec vitest run src/shared/ui/view-toggle.test.tsx`: 구현 후 3개 테스트 통과.
- `pnpm --dir frontend test`: 프로젝트 목록의 이전 스타일 단언을 갱신한 뒤 전체 테스트 통과.
- `pnpm --dir frontend lint`: 통과.
- `pnpm --dir frontend exec prettier --check src/shared/ui/view-toggle.tsx src/shared/ui/view-toggle.test.tsx src/features/project/ui/ProjectListContent.test.tsx`: 통과.
- `pnpm --dir frontend build`: 통과. 생성된 CSS에 이동, `transition-transform`, 움직임 줄이기 스타일이 포함된 것을 확인했다.

### 남은 후속 작업

없음.
