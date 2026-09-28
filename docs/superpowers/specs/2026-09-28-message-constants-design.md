# 프런트엔드 사용자 문구 중앙화 설계

- 이슈: #83
- 작성일: 2026-09-28
- 분류: Refactor / Standard

## 배경

`frontend/src/shared/constants/messages.ts`는 지금 검증 문구와 일부 토스트 27개만 담고 있고, 실제로 참조하는 파일은 13개뿐이다. 나머지 사용자 문구는 컴포넌트 안에 리터럴로 흩어져 있다.

전수 조사 결과 테스트·스토리를 제외한 소스 32개 파일에 약 185개의 한글 리터럴이 남아 있다. 상위 파일은 다음과 같다.

| 파일 | 건수 |
| --- | --- |
| `shared/ui/sidebar.tsx` | 20 |
| `features/whiteboard-document/ui/WhiteboardDocumentListContent.tsx` | 18 |
| `features/project/ui/ProjectListContent.tsx` | 18 |
| `features/member/ui/MemberListContent.tsx` | 11 |
| `pages/project-detail/ui/ProjectDetailPage.tsx` | 10 |
| `shared/ui/user-picker.tsx` | 9 |
| `features/whiteboard-editor/model/use-whiteboard-editor.ts` | 9 |

같은 문구가 여러 곳에 중복된 사례도 확인했다. `검색 결과가 없어요`는 3곳, `다른 검색어로 다시 시도해보세요`는 3곳, `다시 시도`는 7곳, `이름 또는 이메일로 검색`은 2곳, `삭제되었거나 접근할 수 없는 ...`은 2곳에 각각 따로 적혀 있다.

백엔드는 `backend/src/constants/messages.ts`로 이미 전부 중앙화되어 있고 그 외 한글 리터럴이 없다. 이 작업은 프런트엔드 전용이다.

## 목표

- 사용자에게 보이는 모든 문구를 한 곳에서 관리한다. 에러, 성공 토스트, 빈 상태, placeholder, 설명, 접근성 라벨, 버튼·제목 문구를 포함한다.
- 중복 문구를 한 상수로 합쳐 표기 흔들림을 막는다.
- 문구를 바꿀 때 컴포넌트를 열지 않아도 되게 한다.

## 범위 밖

- 번역·다국어(i18n) 도입. 이번에는 한국어 단일 사전만 만든다.
- 테스트·스토리 파일의 리터럴. 테스트가 상수를 참조하면 문구가 바뀌어도 테스트가 같이 바뀌어 회귀를 못 잡는다. 기존에 `MESSAGES`를 쓰던 검증 테스트 4개만 새 경로로 갱신한다.
- 백엔드.
- 로그·주석·개발자용 에러 메시지처럼 사용자에게 보이지 않는 문자열.

## 구조

`shared/constants/messages.ts` 단일 파일을 `shared/constants/messages/` 디렉터리로 나눈다. 약 200개 키를 평면 객체 하나에 두면 탐색이 어렵다.

```
shared/constants/messages/
  index.ts        // MESSAGES 루트 조립 + re-export
  common.ts       // 여러 도메인이 공유하는 문구
  validation.ts   // 폼 검증 (기존 21개 이관)
  auth.ts
  workspace.ts
  project.ts
  whiteboard.ts   // 문서 목록 + 편집기
  member.ts
  account.ts
```

기존 import 경로 `@/shared/constants/messages`는 디렉터리 `index.ts`가 그대로 받으므로 바뀌지 않는다.

### 키 네이밍

도메인 → 용도 → 이름 3단계 중첩을 쓴다. 용도는 다음 6가지로 고정한다.

| 용도 키 | 담는 것 |
| --- | --- |
| `toast` | 성공·실패 토스트 |
| `error` | 실패 상태 제목·설명 |
| `empty` | 빈 상태·검색 결과 없음 제목·설명 |
| `form` | 라벨, placeholder, 검증 문구 |
| `action` | 버튼·메뉴 항목 문구 |
| `a11y` | `aria-label`, 로딩 `aria-label` 등 화면에 안 보이는 접근성 문구 |

```ts
// shared/constants/messages/project.ts
export const PROJECT_MESSAGES = {
  toast: {
    created: '프로젝트를 만들었어요',
    updated: '프로젝트를 수정했어요',
    deleted: '프로젝트를 삭제했어요',
  },
  error: {
    loadFailed: '프로젝트를 불러오지 못했어요',
    notFound: '프로젝트를 찾을 수 없어요',
    notFoundDescription: '삭제되었거나 접근할 수 없는 프로젝트예요',
  },
  empty: {
    title: '아직 프로젝트가 없어요',
    description: '새 프로젝트를 만들어 팀과 화이트보드로 협업을 시작해보세요',
  },
  form: {
    namePlaceholder: '예: 홈페이지 개편',
    descriptionPlaceholder: '프로젝트에 대한 설명을 입력해주세요',
  },
  a11y: {
    search: '프로젝트 검색',
    loading: '프로젝트를 불러오는 중',
    menu: (name: string) => `${name} 메뉴`,
  },
} as const
```

### 값 보간

`` `${member.name} 내보내기` ``처럼 값이 끼어드는 문구는 문자열 대신 함수로 둔다. 템플릿 리터럴을 호출부에 남기면 문구가 다시 흩어진다.

```ts
removeMember: (name: string) => `${name} 내보내기`,
```

### 공통 문구

3곳 이상에서 반복되는 문구만 `common.ts`로 올린다. 한 도메인에서만 쓰는 문구를 공통으로 올리면 나중에 한쪽만 바꾸고 싶을 때 걸린다.

```ts
export const COMMON_MESSAGES = {
  action: { retry: '다시 시도', cancel: '취소', confirm: '확인', close: '닫기' },
  error: { retryHint: '잠시 후 다시 시도해보세요' },
  empty: { searchTitle: '검색 결과가 없어요', searchDescription: '다른 검색어로 다시 시도해보세요' },
  form: { searchByNameOrEmail: '이름 또는 이메일로 검색' },
}
```

### 기존 27개 키 이관

기존 평면 키(`MESSAGES.EMAIL_REQUIRED`)를 중첩 경로(`MESSAGES.validation.emailRequired`)로 옮긴다. 평면과 중첩이 섞이면 새 문구를 어디에 둘지 매번 흔들린다. 참조하는 13개 파일(사용처 38곳)을 함께 고친다. 하위 호환용 별칭은 남기지 않는다.

## 권한·오류 계약

- 동작 변경 없음. 문구 문자열 자체는 한 글자도 바꾸지 않는다. 같은 뜻의 중복 문구를 합칠 때는 더 많이 쓰이는 쪽 표기를 택하고 계획 문서에 기록한다.
- 에러 처리 분기, `refetch`, 권한 판정 로직은 건드리지 않는다.

## 검증 계획

- 기존 테스트 437건이 문구 단정을 그대로 유지한 채 통과해야 한다. 테스트가 깨지면 문구가 바뀐 것이므로 되돌린다.
- `MESSAGES`를 참조하던 검증 테스트 4개(`account-form-schema.test.ts`, `use-account.test.tsx`, `password-schema.test.ts`, `WhiteboardDocumentFormDialog.test.tsx`)는 새 경로로 갱신한다.
- 잔여 리터럴 점검: 소스(테스트·스토리 제외)에 남은 한글 리터럴을 grep으로 세어 0에 수렴하는지 확인하고, 남긴 것은 사유와 함께 기록한다.
- `pnpm test` / `pnpm lint` / `pnpm build`.

## 알려진 트레이드오프

`aria-label="작업"` 같은 짧은 단발 문구까지 상수로 빼면 컴포넌트만 봐서는 무슨 문구가 렌더되는지 알 수 없어 읽기가 나빠진다. 일반적인 React 관행은 i18n 도입 시점에 한 번에 추출하는 쪽이다. 이번에는 요청대로 전부 옮기되, 이 점을 기록해 둔다.
