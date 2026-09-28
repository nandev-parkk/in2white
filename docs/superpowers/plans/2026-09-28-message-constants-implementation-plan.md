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

### 실제 변경

- 신규 사전 10개 파일: `shared/constants/messages/{index,common,validation,auth,account,member,nav,project,whiteboard,workspace}.ts`
- 신규 테스트 1개: `shared/constants/messages/messages.test.ts` (3건)
- 삭제: `shared/constants/messages.ts`
- 수정: 소스 36개 파일 + 기존 `MESSAGES` 참조 테스트 4개
- 사전을 참조하는 파일은 49개가 되었다.

### 계획과 달라진 점

| 항목 | 계획 | 실제 | 이유 |
| --- | --- | --- | --- |
| 기존 키 수 | 27개 | 25개 | 조사 단계의 집계 오류였다. 실제 파일에는 25개가 있었다. |
| `validation.ts` 배치 | 검증 21개 전부 | 도메인 무관한 11개만 | 워크스페이스·프로젝트·화이트보드·계정의 이름 검증 문구는 각 도메인 `form`에 두는 쪽이 일관됐다. |
| 용도 버킷 | 6개(`toast`·`error`·`empty`·`form`·`action`·`a11y`) | 10개 | 모달 제목·섹션 제목을 담을 `heading`, 확인 문구 `confirm`, 역할 배지 `role`, 화면 라벨 `label`이 필요했다. 화이트보드는 `saveStatus`·`sync`를, 인증은 `intro`를 추가로 쓴다. |
| 파일 수 | 9개 | 10개 | 사이드바·앱 셸 내비게이션 문구를 담을 `nav.ts`를 더했다. |
| 대상 파일 수 | 32개 | 36개 | 조사에서 빠졌던 `AppProviders.tsx`, `HomePage.tsx`, `WorkspaceAccessDeniedPage.tsx`, `LoginPage.tsx`를 포함했다. |
| `shared/ui`는 `common.ts`만 참조 | 규칙 | 3개 파일 예외 | `canvas-top-bar.tsx`, `user-picker.tsx`, `app-shell-header.tsx`는 위치만 `shared/ui`이고 내용은 각각 화이트보드·멤버·프로젝트 전용이다. 파일을 옮기는 편이 맞지만 이번 범위를 넘어서므로 도메인 사전을 참조하게 두었다. |
| 중복 통합 기준 | 3곳 이상 | 2곳도 포함 | 불변식 테스트가 같은 문자열의 두 경로 공존을 금지하므로, 도메인이 다르면 건수와 무관하게 `common`으로 올려야 했다. |

`common.ts`로 올린 문구는 다음과 같다. `수정`·`삭제`·`취소`·`저장`·`만들기`·`닫기`·`다시 시도`·`검색 결과 초기화`·`카드 보기`·`목록 보기`·`검색 결과가 없어요`·`다른 검색어로 다시 시도해보세요`·`잠시 후 다시 시도해보세요`·`이름`·`생성자`·`생성일`·`수정일`·`작업`·`을(를) 삭제하면 되돌릴 수 없어요.`·`${name} 메뉴` 등.

### 불변식 테스트의 허용 목록

`member.heading.list`와 `member.role.member`는 둘 다 `멤버`다. 페이지 제목과 역할 배지로 뜻이 달라 경로를 나눠 두고, 테스트의 `intentional` 목록에 명시했다. 이 목록에 없는 중복은 실패로 잡는다.

### 발견한 문구 불일치 (미수정)

문구를 바꾸지 않는다는 원칙에 따라 그대로 두었지만, 같은 뜻을 다르게 쓰는 곳이 있다. 별도 작업으로 다룰 대상이다.

- `워크스페이스를 불러오는 중` (레이아웃·계정 설정) vs `워크스페이스 불러오는 중` (사이드바) — `workspace.a11y.loading`과 `workspace.a11y.loadingShort`로 나눠 두었다.
- `멤버 불러오는 중`·`사용자 불러오는 중`은 조사가 없고, `프로젝트를 불러오는 중`·`화이트보드를 불러오는 중`은 있다.

### 실행한 검증

| 명령 | 결과 |
| --- | --- |
| `pnpm test` | 79파일 440건 통과 (기존 437건 + 신규 3건) |
| `pnpm lint` | exit 0, 경고 4건 (`badge`·`button`·`input`·`toast`의 기존 `react-refresh/only-export-components`) |
| `pnpm build` | exit 0 |

잔여 리터럴 점검 결과 소스(테스트·스토리 제외)에 남은 한글은 주석 20줄뿐이다. 사용자에게 보이는 문구는 남아 있지 않다.

### 남은 후속 작업

- 위에 적은 문구 불일치 통일.
- `canvas-top-bar.tsx`·`user-picker.tsx`·`app-shell-header.tsx`를 해당 feature 폴더로 이동해 `shared/ui`의 도메인 의존을 없애기.
- 테스트·스토리의 리터럴은 회귀 그물로 남겨 두었다. i18n을 도입할 때 함께 정리한다.
