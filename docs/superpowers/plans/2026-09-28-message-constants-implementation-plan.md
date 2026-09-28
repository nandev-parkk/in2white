# 프런트엔드 사용자 문구 중앙화 구현 계획

- 이슈: #83
- 설계: [2026-09-28-message-constants-design.md](../specs/2026-09-28-message-constants-design.md)
- 브랜치: `refactor/83-message-constants`
- 워크트리: `.claude/worktrees/message-constants`

## 목표

테스트·스토리를 제외한 `frontend/src` 소스의 한글 사용자 문구 약 185개를 `shared/constants/messages/`로 옮기고, 중복 문구를 한 상수로 합친다. 렌더 결과는 바뀌지 않는다.

## 검증 전략

이 작업은 새 동작을 만들지 않는 리팩터링이다. 기존 테스트 437건이 문구 리터럴을 직접 단정하고 있어 그 자체가 회귀 그물이 된다. 따라서 새 테스트를 먼저 쓰는 대신 **각 단계마다 기존 테스트를 실행해 초록을 유지하는 방식**으로 진행한다. 테스트가 깨지면 문구가 바뀐 것이므로 즉시 되돌린다.

단 하나, 사전 자체의 불변식은 새 테스트로 지킨다. 중복 문자열이 다시 생기는 것을 막아야 하기 때문이다.

- `shared/constants/messages/messages.test.ts` (신규)
  - 사전 전체를 순회해 **같은 문자열이 서로 다른 두 경로에 존재하지 않음**을 단정한다. `COMMON_MESSAGES`와 도메인 사전 사이의 중복도 잡는다.
  - 모든 말단 값이 비어 있지 않은 문자열 또는 함수임을 단정한다.
  - 이 테스트를 먼저 실패 상태로 확인한 뒤 사전을 만든다.

## 단계

### 1단계 — 사전 골격과 불변식 테스트

1. `messages.test.ts`를 작성하고 실패를 확인한다.
2. `shared/constants/messages/` 디렉터리를 만들고 `common.ts`, `validation.ts`, `index.ts`를 추가한다.
3. 기존 `messages.ts`의 27개 키를 용도별로 `validation.ts`(검증 21개), `account.ts`(토스트·에러 3개), `workspace.ts`(2개), `common.ts`(`NETWORK_ERROR`)로 나눈다.
4. 단일 파일 `shared/constants/messages.ts`를 삭제한다.
5. 기존 참조 13개 파일 38곳을 새 경로로 고친다. import 경로는 그대로이므로 키 이름만 바뀐다.
6. `pnpm test` 초록 확인.

### 2단계 — 도메인별 이관

파일 수가 많아 도메인 단위로 나눠 각 단위마다 테스트를 돌린다. 순서는 리터럴이 많은 쪽부터다.

| 단위 | 대상 파일 | 사전 |
| --- | --- | --- |
| 2-1 | `features/project/ui/*` (5개), `pages/project-detail/ui/ProjectDetailPage.tsx` | `project.ts` |
| 2-2 | `features/whiteboard-document/ui/*` (4개), `features/whiteboard-editor/**` (3개), `pages/whiteboard-editor/ui/WhiteboardEditorPage.tsx`, `shared/ui/canvas-top-bar.tsx` | `whiteboard.ts` |
| 2-3 | `features/member/ui/*` (2개), `shared/ui/user-picker.tsx` | `member.ts` |
| 2-4 | `features/workspace/ui/*` (2개), `pages/workspace-redirect/ui/WorkspaceRedirectPage.tsx`, `pages/shared/ui/AuthenticatedWorkspaceLayout.tsx` | `workspace.ts` |
| 2-5 | `features/account/ui/AccountPasswordForm.tsx`, `pages/account/ui/AccountPage.tsx` | `account.ts` |
| 2-6 | `features/auth/ui/LoginForm.tsx` | `auth.ts` |
| 2-7 | `shared/ui/*` 잔여 8개 (`sidebar.tsx`, `search.tsx`, `pagination.tsx`, `view-toggle.tsx`, `spinner.tsx`, `error-state.tsx`, `resource-list-skeleton.tsx`, `app-shell-header.tsx`, `password-input.tsx`) | `common.ts` |

각 단위에서:

- 파일의 한글 리터럴을 전부 상수로 옮긴다. 옮길 때 문자열을 **복사**해 오타가 끼지 않게 한다.
- 3곳 이상 반복되는 문구는 `common.ts`로 올린다. 이미 확인된 대상은 `다시 시도`(7), `검색 결과가 없어요`(3), `다른 검색어로 다시 시도해보세요`(3), `취소`, `잠시 후 다시 시도해보세요`다.
- 보간 문구는 함수로 만든다. 확인된 대상은 `` `${member.name} 내보내기` ``, `` `${project.name} 메뉴` ``, 그 외 단위 작업 중 발견되는 템플릿 리터럴이다.
- `pnpm test`를 돌려 초록을 확인한 뒤 다음 단위로 넘어간다.

`shared/ui/` 파일은 여러 도메인이 함께 쓰므로 마지막에 처리한다. 앞 단위에서 도메인 문구가 정리되면 진짜 공통 문구만 남는다.

### 3단계 — 잔여 리터럴 점검

```sh
grep -rn "[가-힣]" frontend/src \
  --include=*.ts --include=*.tsx \
  | grep -v -e '\.test\.' -e '\.stories\.' -e 'constants/messages/' \
  | grep -v '^\s*//' 
```

남은 항목을 하나씩 판정한다. 주석·개발자 로그는 대상이 아니므로 남긴다. 사용자에게 보이는 문구가 남았으면 이관한다. 판정 결과를 이 문서 결과 절에 기록한다.

### 4단계 — 전체 검증

- `pnpm test`
- `pnpm lint`
- `pnpm build`

## 변경 범위

- 신규: `shared/constants/messages/` 9개 파일 + `messages.test.ts`
- 삭제: `shared/constants/messages.ts`
- 수정: 소스 32개 파일 + `MESSAGES` 참조 테스트 4개
- 백엔드·설정·스타일 변경 없음

## 위험과 대응

| 위험 | 대응 |
| --- | --- |
| 이관 중 문구 오타 | 문자열을 복사해 옮기고, 단위마다 테스트로 확인한다 |
| 중복 통합 시 표기 차이 | 더 많이 쓰이는 표기를 택하고 결과 절에 기록한다 |
| `shared/ui` 문구를 도메인 사전에 잘못 넣음 | `shared/ui`는 `common.ts`만 참조하도록 제한한다 |
| 변경 파일이 많아 리뷰가 어려움 | 도메인 단위로 커밋을 나눈다 |

## 커밋 계획

단계별로 나눈다. 모두 검증이 끝난 뒤 한 번에 push한다.

1. `refactor: 사용자 문구 사전 구조 도입` (1단계)
2. `refactor: 프로젝트·화이트보드 문구를 사전으로 이관` (2-1, 2-2)
3. `refactor: 멤버·워크스페이스·계정·인증 문구를 사전으로 이관` (2-3 ~ 2-6)
4. `refactor: 공통 UI 문구를 사전으로 이관` (2-7)

## 구현 결과

작성 예정.
