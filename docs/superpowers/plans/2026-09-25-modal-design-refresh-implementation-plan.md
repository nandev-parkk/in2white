# 모달 디자인 정비 구현 계획

> 실행자는 `superpowers:executing-plans`를 적용한다. 각 작업의 검증을 마친 뒤 다음 작업으로 진행한다. 사용자가 요청하지 않았으므로 커밋·푸시·PR은 만들지 않는다.

**목표:** 기존 확인 모달의 메시지를 아이콘과 중앙 정렬로 명확히 표시하고 입력 모달의 구성과 간격을 통일한다.

**구성:** 기존 Radix 기반 `Dialog` 구성 요소와 의미 색상 토큰을 재사용한다. 확인 모달 네 곳의 메시지 영역만 중앙 정렬하고 버튼은 오른쪽에 둔다. 입력 모달은 아이콘 없이 제목·설명·필드·버튼 간격을 맞춘다.

**기술:** React 19, TypeScript, Tailwind CSS 4, Radix UI, Lucide, Vitest, Storybook.

**설계:** `docs/superpowers/specs/2026-09-25-modal-design-refresh-design.md`

## 공통 제약

- 새 의존성·새 아이콘 API·공유 Dialog 동작 변경 없이 현재 컴포넌트를 조합한다.
- 삭제·내보내기·생성·수정·검색의 API 호출, 권한, 검증, 로딩, 취소, 닫기, 포커스 복귀를 유지한다.
- 제목과 설명의 접근성을 유지한다. 아이콘에는 `aria-hidden="true"`, 실패 문구에는 기존 `role="alert"`를 사용한다.
- `DESIGN.md`의 의미 색상, 4px 간격 체계, Elevated Surface 규칙과 친근한 한국어 문장 톤을 따른다.

## 검토 초점

1. **긴 이름:** 워크스페이스·프로젝트·화이트보드·멤버 이름이 길어도 제목이 모달 밖으로 넘치지 않는지 작업 1·2의 좁은 화면 확인에서 본다.
2. **좁은 화면:** 320px 내외 화면에서도 버튼과 메시지가 잘리지 않는지 작업 2·5의 화면 확인에서 본다.
3. **실패·로딩:** 오류 문구가 보이고 진행 중 중복 제출이 막히는지 작업 1~4의 기존 테스트로 확인한다.
4. **키보드:** Escape로 닫은 뒤 포커스가 원래 위치로 돌아오는지 작업 4·5의 기존 테스트와 화면 확인으로 본다.
5. **테마:** 위험 아이콘 배경, 경계선, 설명 글자의 대비가 밝은·어두운 화면에서 유지되는지 작업 5에서 본다.

## 작업 1. 삭제·내보내기 확인 모달

**파일:**

- 수정: `frontend/src/features/project/ui/ProjectDeleteDialog.tsx`
- 수정: `frontend/src/features/whiteboard-document/ui/WhiteboardDocumentDeleteDialog.tsx`
- 수정: `frontend/src/features/member/ui/MemberListContent.tsx`
- 테스트: `frontend/src/features/project/ui/ProjectDeleteDialog.test.tsx`

**변경:** 프로젝트에는 `FolderX`, 화이트보드에는 `FileX`, 멤버 내보내기에는 `UserRoundMinus`를 사용한다. 각 메시지 영역은 원형 위험 배경 아이콘 → 제목 → 설명 → 조건부 오류 순서로 중앙 정렬한다. 하단 버튼은 기존 라벨·핸들러·오른쪽 정렬을 유지하고 얇은 상단 경계선으로 구분한다. 모달은 화면 너비에서 양쪽 16px 여백을 남기고 최대 440px로 제한한다.

- [x] 기존 프로젝트 삭제 테스트에 접근 가능한 설명과 장식 아이콘 검증을 추가한다. 예:

  ```tsx
  const dialog = screen.getByRole("dialog", { name: "프로젝트 삭제" });
  expect(dialog).toHaveAccessibleDescription(/홈페이지 개편.*되돌릴 수 없어요/);
  expect(dialog.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
  ```

- [x] `cd frontend && pnpm test src/features/project/ui/ProjectDeleteDialog.test.tsx`를 실행한다. 새 아이콘 검증이 실패해야 한다.
- [x] 세 모달의 아이콘과 메시지 배치를 변경한다. 공통 배치의 핵심 형태는 아래와 같다. 각 화면의 제목·설명·오류·버튼 콜백은 기존 값을 쓴다.

  ```tsx
  <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[440px] overflow-y-auto p-0 [&>div]:gap-0">
    <div className="flex flex-col px-6 py-7 text-center">
      <span className="bg-status-danger-subtle-bg text-status-danger flex size-12 items-center justify-center self-center rounded-full">
        <FolderX aria-hidden="true" className="size-6" />
      </span>
      <DialogTitle className="mt-4 break-words">프로젝트 삭제</DialogTitle>
      <DialogDescription className="mt-2">
        <strong className="text-foreground-default">{projectName}</strong>
        을(를) 삭제하면 되돌릴 수 없어요.
      </DialogDescription>
      {error && (
        <p className="text-caption text-status-danger mt-4" role="alert">
          {error}
        </p>
      )}
    </div>
    <DialogFooter className="border-border w-full border-t px-6 py-4">
      <Button
        type="button"
        variant="tertiary"
        disabled={loading}
        onClick={() => onOpenChange(false)}
      >
        취소
      </Button>
      <Button
        type="button"
        variant="destructive"
        loading={loading}
        onClick={onConfirm}
      >
        삭제
      </Button>
    </DialogFooter>
  </DialogContent>
  ```

- [x] `cd frontend && pnpm test src/features/project/ui/ProjectDeleteDialog.test.tsx src/features/member/ui/MemberListContent.test.tsx`를 실행한다. 모두 통과해야 한다.

## 작업 2. 워크스페이스 삭제 모달

**파일:**

- 수정: `frontend/src/features/workspace/ui/WorkspaceSettingsContent.tsx`
- 검증: `frontend/src/features/workspace/ui/WorkspaceSettingsContent.test.tsx`

**변경:** 기존 `CircleAlert`를 유지한다. 아이콘·제목·영향 범위·복구 불가 안내·실패 문구를 중앙 정렬한다. `DialogContent`의 내부 flex 컨테이너 간격도 제거해 메시지 영역과 경계선이 있는 버튼 영역이 붙도록 한다. 버튼과 삭제 호출은 유지한다.

- [x] 메시지 영역에 `items-center text-center`를 적용하고 긴 이름에 `break-words`를 적용한다. `DialogContent`에는 `[&>div]:gap-0`을, 하단 `DialogFooter`에는 기존 오른쪽 정렬과 경계선을 유지한다.
- [x] `cd frontend && pnpm test src/features/workspace/ui/WorkspaceSettingsContent.test.tsx`를 실행한다. 삭제 대상·취소·오류·삭제 호출 검증이 통과해야 한다.

## 작업 3. 생성·수정 입력 모달

**파일:**

- 수정: `frontend/src/features/workspace/ui/WorkspaceCreateDialog.tsx`
- 수정: `frontend/src/features/project/ui/ProjectFormDialog.tsx`
- 수정: `frontend/src/features/whiteboard-document/ui/WhiteboardDocumentFormDialog.tsx`
- 테스트: `frontend/src/features/project/ui/ProjectFormDialog.test.tsx`
- 검증: `frontend/src/features/workspace/ui/WorkspaceCreateDialog.test.tsx`, `frontend/src/features/whiteboard-document/ui/WhiteboardDocumentFormDialog.test.tsx`

**변경:** 세 모달은 최대 너비 440px, 화면 양쪽 16px 여백, 24~28px 패딩, 20px 제목, 짧은 설명, 일정한 필드 간격을 적용한다. 설명 문구는 각각 “함께 작업할 워크스페이스의 이름을 정해 주세요.”, “프로젝트 이름과 설명을 입력해 주세요.”, “화이트보드의 이름을 정해 주세요.”로 한다. 버튼 영역은 상단 경계선과 간격으로 분리하고 오른쪽 정렬한다. 기존 필드 값·라벨·오류·제출 로직은 그대로 둔다.

- [x] 프로젝트 폼 테스트에 모달의 접근 가능한 설명 검증을 추가한다. 예:

  ```tsx
  expect(
    screen.getByRole("dialog", { name: "새 프로젝트 만들기" }),
  ).toHaveAccessibleDescription("프로젝트 이름과 설명을 입력해 주세요.");
  ```

- [x] `cd frontend && pnpm test src/features/project/ui/ProjectFormDialog.test.tsx`를 실행한다. 새 설명 검증이 실패해야 한다.
- [x] 세 폼에 `DialogDescription`을 제목 바로 아래 배치하고 `DialogContent` 크기·패딩과 `DialogFooter` 경계·간격을 통일한다. 예:

  ```tsx
  <div>
    <DialogTitle className="text-[20px] leading-7 font-semibold">
      {title}
    </DialogTitle>
    <DialogDescription className="mt-2">
      프로젝트 이름과 설명을 입력해 주세요.
    </DialogDescription>
  </div>
  ```

- [x] `cd frontend && pnpm test src/features/project/ui/ProjectFormDialog.test.tsx src/features/workspace/ui/WorkspaceCreateDialog.test.tsx src/features/whiteboard-document/ui/WhiteboardDocumentFormDialog.test.tsx`를 실행한다. 기존 검증·제출·취소 사례를 포함해 통과해야 한다.

## 작업 4. 멤버 검색 모달과 예시

**파일:**

- 수정: `frontend/src/shared/ui/user-picker.tsx`
- 수정: `frontend/src/shared/ui/dialog.stories.tsx`
- 검증: `frontend/src/shared/ui/user-picker.test.tsx`, `frontend/src/shared/ui/dialog.test.tsx`, `frontend/src/features/member/ui/MemberAddDialog.test.tsx`

**변경:** 멤버 검색 모달은 제목과 기존 설명을 한 묶음으로 배치해 설명을 읽을 수 있게 표시하고, 입력 모달과 너비·패딩을 맞춘다. 목록·검색·선택·페이지 이동은 유지한다. Dialog Storybook의 삭제와 프로젝트 생성 예시는 실제 적용된 배치로 갱신한다.

- [x] `UserPicker`의 `DialogDescription`에서 시각적 숨김을 제거하고 제목 아래에 둔다. 검색창과 목록의 간격은 현재 값에서 크게 벗어나지 않게 한다.
- [x] Storybook 두 예시의 제목·설명·아이콘·버튼 영역을 새 규칙에 맞춘다. 기능 화면을 shared 계층으로 import하지 않고 기존 Storybook의 구성 요소를 사용한다.
- [x] `cd frontend && pnpm test src/shared/ui/user-picker.test.tsx src/shared/ui/dialog.test.tsx src/features/member/ui/MemberAddDialog.test.tsx`를 실행한다. 검색·선택·포커스 동작이 통과해야 한다.

## 작업 5. 전체 검증과 실행 기록

**파일:** 이 계획 문서에 실행 결과를 추가한다.

- [x] `cd frontend && pnpm test`를 실행한다. 전체 테스트가 통과해야 한다.
- [x] `cd frontend && pnpm lint`를 실행한다. 오류가 없어야 한다.
- [x] `cd frontend && pnpm build`를 실행한다. 타입 검사와 빌드가 통과해야 한다.
- [x] 변경한 TSX 파일에 `pnpm exec prettier --check`를 실행하고 필요하면 해당 파일만 포맷한다.
- [x] Storybook 또는 실행 화면에서 320px 내외·일반 데스크톱 폭, 밝은·어두운 테마, 긴 이름·오류 상태를 확인한다. 아이콘과 메시지는 중앙, 버튼은 오른쪽, 폼 필드는 왼쪽인지 확인한다.
- [x] 이 문서 끝에 **실제 변경 내용**, **계획과 달라진 점**, **실행한 검증 명령과 결과**, **남은 후속 작업**을 기록한다.
- [x] `git diff --check`와 `git status --short`로 불필요한 변경이 없는지 확인한다. 커밋·푸시·PR은 실행하지 않는다.

## 실행 중 결정

- 작업 3: 이전 Figma 치수와 내부 스크롤 클래스만 확인하던 테스트 4개가 승인된 디자인 변경과 충돌했다. 해당 단언을 제거하고 생성 모달의 접근 가능한 설명 검증으로 대체했다. 치수와 스크롤은 작업 5의 실제 화면 확인에서 검증한다.
- 작업 5: 코드 리뷰에서 공백 없는 긴 영문 이름이 `items-center`가 적용된 확인 모달에서 넘치는 것을 발견했다. Storybook의 실제 레이아웃에서 긴 영문 100자로 재현한 뒤 메시지 영역의 flex 항목을 가용 너비로 펼치고 아이콘만 `self-center`로 중앙 정렬하도록 수정했다.

## 실제 변경 내용

- 프로젝트·화이트보드·워크스페이스 삭제와 멤버 내보내기 확인 모달에 대상별 아이콘, 중앙 정렬 메시지, 오른쪽 정렬 버튼 영역을 적용했다. 메시지 요소는 가용 너비 안에서 줄바꿈되고 아이콘만 별도로 중앙 정렬된다.
- 워크스페이스·프로젝트·화이트보드 생성·수정 모달과 멤버 검색 모달의 제목·설명·필드·버튼 간격을 정리했다.
- Dialog Storybook 예시와 접근 가능한 설명·장식 아이콘 관련 테스트를 갱신했다.
- Figma Components/Modal과 v1.0 화면 예시의 입력 래퍼를 카드 폭에 맞게 설정하고 파란 정보·노란 경고 아이콘 모달 예시를 추가했다.

## 계획과 달라진 점

- 기존 고정 치수 검증 4개는 승인된 새 치수와 충돌해 제거하고 접근 가능한 설명 검증으로 대체했다.
- Orca 브라우저 캡처가 창 비활성 상태에서 시간 초과되어 Storybook 화면을 Chrome 헤드리스 캡처로 확인했다. 긴 이름과 오류 문구는 Storybook 확인 예시에 임시로 넣어 화면 폭과 줄바꿈을 확인했다. 제품 코드에는 추가하지 않았다.
- 후속 요청에 따라 Figma 정보·경고 모달 예시와 입력 모달의 폭 설정을 추가로 정리했다.

## 실행한 검증 명령과 결과

- `cd frontend && pnpm test`: 테스트 파일 76개, 테스트 412개 통과.
- `cd frontend && pnpm lint`: 오류 0건, 기존 `react-refresh/only-export-components` 경고 4건.
- `cd frontend && pnpm build`: 타입 검사와 빌드 통과. 기존 큰 청크 경고는 유지된다.
- `cd frontend && pnpm format:check`: 변경하지 않은 기존 파일 8개의 서식 문제로 실패. 이번 작업에서 변경한 파일은 아래 개별 검사에서 모두 통과했다.
- `cd frontend && git diff --relative --name-only -z -- '*.tsx' | xargs -0 pnpm exec prettier --check`: 변경한 TSX 파일 전부 통과.
- Storybook 프로젝트 삭제·프로젝트 생성 예시: 데스크톱 1280px 밝은 테마와 모바일 320px 어두운 테마에서 아이콘·메시지·버튼·필드 배치를 확인했다. 모바일의 긴 이름과 오류 문구에서도 가로 스크롤이나 잘림이 없었다. 추가로 공백 없는 영문 50자 제목·설명의 320px 화면을 확인했으며 문서·모달·텍스트 스크롤 너비가 각각 320px·288px·240px로 가용 너비와 같았다.
- Figma Components/Modal과 v1.0 예시에서 440px 카드의 입력 폭 384px, 좌우 여백 28px을 확인하고 정보·경고 모달의 렌더를 검토했다.
- `git diff --check`: 통과. `git status --short`: 변경 범위는 모달 관련 TSX 12개와 승인된 설계·계획 문서 2개로 한정됨.

## 남은 후속 작업

- 없음.
