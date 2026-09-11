# 계정 설정 프론트엔드 설계

## 상태

- 작업 유형: 새 기능
- 워크플로: Standard
- 설계 승인: 사용자 승인 완료
- 구현 상태: 구현 및 검증 완료
- 기준 디자인: Figma `201:3216` (`Account Settings — 계정 설정`)
- 기준 API: 기존 `/account` 및 `/workspaces` API

## 목표

인증된 사용자가 애플리케이션의 어느 워크스페이스 화면에서도 사용자 계정 정보를 관리할 수 있는 계정 페이지를 추가한다. 화면은 Figma `201:3216`과 동일한 계정 설정 레이아웃을 따르되, 저장·비밀번호 변경·워크스페이스 목록을 실제 API와 연결한다.

계정 정보는 사용자 전역 리소스다. 다만 계정 페이지가 워크스페이스 앱 셸 안에서 표현되므로 현재 워크스페이스를 URL query로 보존한다.

```text
/account?workspaceId=<현재 워크스페이스 ID>
```

`workspaceId`는 계정 API의 소유 범위나 권한을 나타내지 않고, 사이드바 선택 상태와 계정 페이지에서 프로젝트 화면으로 돌아갈 컨텍스트만 나타낸다.

## 범위

### 포함

- 보호된 `/account` 라우트 추가
- 기존 인증 앱 셸과 사이드바 재사용
- Figma 기준 기본 정보 섹션 구현
  - 이메일 read-only 표시
  - 이름 수정 및 저장
- Figma 기준 비밀번호 변경 섹션 구현
  - 현재 비밀번호
  - 새 비밀번호
  - 새 비밀번호 확인
  - 기존 비밀번호 정책과 일치하는 클라이언트 검증
- 참여 중인 워크스페이스 목록 표시
  - 최대 4개 행 노출 및 초과 목록 스크롤
  - 기존 워크스페이스 목록과 동일한 이름 검색 및 결과 없음 안내
- 사이드바 하단 사용자 정보 영역에서 `/account?workspaceId=...`로 이동
- 계정 페이지의 프로젝트 메뉴에서 현재 워크스페이스 프로젝트 화면으로 이동
- 이름 변경 후 세션 사용자 정보 갱신
- 비밀번호 변경 후 새 access token과 사용자 정보로 세션 갱신
- API·폼·라우팅·회귀 테스트

### 제외

- 워크스페이스 이름·멤버·권한 설정
- 프로필 이미지 업로드
- 회원 탈퇴
- 새 백엔드 endpoint, DB migration, 권한 모델 변경
- Figma 파일 수정 또는 Code Connect 매핑 추가

## 라우팅 및 워크스페이스 컨텍스트

### Canonical route

```text
/account
```

라우트는 인증 가드로 보호한다. `workspaceId` search parameter는 선택적이다.

### 컨텍스트 결정 규칙

워크스페이스 목록을 조회한 뒤 아래 순서로 현재 컨텍스트를 결정한다.

1. query의 `workspaceId`가 현재 사용자의 워크스페이스 목록에 있으면 그대로 사용한다.
2. query가 없거나 접근할 수 없는 ID면 `selectDefaultWorkspace` 결과를 사용한다.
3. 기본 워크스페이스가 없으면 기존 워크스페이스 없음 상태를 사용한다.

접근할 수 없는 `workspaceId`가 들어와도 계정 설정 자체를 차단하지 않는다. 계정은 사용자 전역 리소스이므로, 사이드바 컨텍스트만 접근 가능한 기본 워크스페이스로 fallback한다.

### 이동 규칙

- 프로젝트 화면의 사이드바 하단 사용자 정보: `/account?workspaceId=<현재 workspaceId>`
- 프로젝트 화면의 사이드바 `설정`: 계정 설정 route로 이동하지 않는다.
- 계정 화면의 사이드바 `프로젝트`: `/workspaces/$workspaceId/projects`
- 계정 화면의 워크스페이스 전환: `/account?workspaceId=<선택 workspaceId>`
- 워크스페이스 전환은 화면 컨텍스트 변경이므로 `replace` navigation을 사용해 브라우저 history를 불필요하게 늘리지 않는다.
- 계정 화면의 참여 워크스페이스 row 클릭은 해당 워크스페이스의 프로젝트 route로 이동한다.

### 소유권과 화면 컨텍스트의 분리

`workspaceId`는 다음 API 요청에 포함하지 않는다.

- `GET /account`
- `PATCH /account`
- `PATCH /account/password`

워크스페이스 목록은 기존 `GET /workspaces`를 사용한다. 계정 데이터는 user ID를 기준으로 관리하고, 워크스페이스 ID는 URL·사이드바·복귀 경로를 위한 표현 계층의 값으로만 사용한다.

## 화면 설계

Figma `201:3216`의 구조를 기존 컴포넌트와 토큰에 맞춰 변환한다.

- 전체 앱 배경: `background-default`
- 사이드바: 기존 `Sidebar`와 `240px` expanded / `64px` collapsed 동작 재사용
- 메인 바깥 영역: 기존 app shell padding 재사용
- 메인 콘텐츠: 최대 `1200px`
- 설정 폼: 화면 중앙의 `480px` 고정 폭, 섹션 사이 `40px`
- 페이지 제목: `계정 설정`
- 기본 정보와 비밀번호 변경의 입력 높이·border·radius는 기존 `Input` 토큰 사용
- 이메일 입력은 `disabled` 상태로 표시
- 비밀번호 입력은 기존 `PasswordInput` 재사용
- 워크스페이스 row는 기존 `ListCell`과 `Avatar`를 조합하고 role을 `소유자` 또는 `멤버`로 표시
- 로고·아이콘은 기존 `/logo-mark.png`와 `lucide-react` 아이콘을 사용한다. Figma의 glyph와 기존 아이콘이 일치하는 경우 프로젝트 자산을 우선한다.

Figma에 보이는 workspace 샘플 데이터는 사용하지 않고 API 결과를 렌더링한다. 워크스페이스가 한 개일 때도 동일한 row 스타일을 유지한다.

## 컴포넌트 및 모듈 경계

기존 컴포넌트를 우선 재사용하고, 계정 도메인에 필요한 모듈만 새로 만든다.

### 계정 API 계층

`entities/account`가 HTTP 계약과 타입을 소유한다.

- `getAccountRequest(accessToken)`
- `updateAccountRequest(name, accessToken)`
- `changeAccountPasswordRequest(input, accessToken)`
- `AccountUser`, `GetAccountResponse`, `UpdateAccountResponse`, `ChangeAccountPasswordResponse`

axios 요청은 기존 entity API와 동일하게 Bearer access token을 사용한다. refresh cookie는 브라우저 cookie와 기존 인증 인터셉터가 관리한다.

### 계정 feature 계층

`features/account`는 TanStack Query와 폼 동작을 소유한다.

- 계정 조회 query
- 이름 변경 mutation
- 비밀번호 변경 mutation
- 성공 시 세션 업데이트 및 관련 query 갱신
- 백엔드 오류 envelope에서 사용자 메시지를 추출하는 공통 처리

계정 조회 query는 TanStack Query의 `AbortSignal`을 GET 요청에 전달한다. 이름·비밀번호 mutation은 시작 시점의 access token과 user ID를 저장하고, 완료 시 현재 session identity가 동일할 때만 session과 account cache를 갱신한다. mutation 시작 전 동일 account query를 취소해 늦은 GET 응답이 mutation 결과를 덮지 않게 한다.

### 인증 앱 셸

현재 `HomePage`에 포함된 인증 워크스페이스 셸 책임을 프로젝트와 계정 화면이 공유할 수 있도록 추출한다. 셸은 다음을 소유한다.

- `useWorkspaces` 조회
- 현재 workspace query/fallback 결정
- 사이드바 collapsed 상태
- workspace switcher 및 create dialog
- logout 처리
- `Sidebar` 렌더링
- active navigation과 route 이동 callback 연결

셸은 기본적으로 workspace query를 required로 처리한다. 계정 페이지는 `workspaceMode="optional"`을 사용해 workspace query loading/error 중에도 인증 콘텐츠를 렌더링하고, `workspaceLoading`, `workspaceError`, `refetchWorkspaces` context를 통해 참여 workspace 섹션에서 상태와 재시도를 표시한다. 프로젝트 화면의 required loading/error/access-denied 차단 동작은 유지한다.

프로젝트 화면과 계정 화면은 셸 내부 콘텐츠만 주입한다. 기존 프로젝트 목록, workspace 생성, 접근 불가 workspace 동작은 변경하지 않는다.

### 계정 페이지 UI

계정 페이지 UI는 다음 책임으로 나눈다.

- 페이지 레이아웃 및 section 배치
- 기본 정보 form
- 비밀번호 변경 form
- 참여 워크스페이스 목록

폼은 기존 `react-hook-form`·Zod·공통 입력 컴포넌트 패턴을 따르며, 계정 페이지 전용 디자인 primitive는 만들지 않는다.

## API 및 데이터 흐름

### 계정 조회

```http
GET /account
Authorization: Bearer <access-token>
```

```json
{
  "user": {
    "id": "user-id",
    "name": "사용자",
    "email": "user@example.com"
  }
}
```

### 이름 변경

```http
PATCH /account
Authorization: Bearer <access-token>
Content-Type: application/json

{ "name": "새 이름" }
```

성공하면 `{ "user": AccountUser }`를 반환한다. 성공한 user를 기존 access token과 함께 session store에 저장해 사이드바와 계정 화면 이름을 즉시 갱신한다.

### 비밀번호 변경

```http
PATCH /account/password
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "currentPassword": "기존 비밀번호",
  "newPassword": "새 비밀번호"
}
```

성공하면 새 access token, user, 새 refresh cookie를 반환한다. 프론트엔드는 응답의 access token과 user로 session store를 갱신한다. 새 비밀번호 확인 값은 서버로 보내지 않는다.

## 검증 및 오류 계약

### 클라이언트 검증

- 이름: trim 후 필수, 최대 255자
- 현재 비밀번호: 필수
- 새 비밀번호: 기존 `passwordSchema` 재사용
- 새 비밀번호 확인: 새 비밀번호와 일치해야 함
- 제출 중에는 해당 버튼을 비활성화하고 중복 요청을 막는다.

### 서버 오류

기존 `{ error: { message, code } }` envelope의 `message`를 사용자에게 표시한다.

- `CURRENT_PASSWORD_MISMATCH`: 현재 비밀번호 오류 안내
- `VALIDATION_ERROR`: 입력 오류 안내
- `PASSWORD_CHANGED_REAUTH_REQUIRED`: 세션을 정리하고 로그인 화면으로 이동
- 네트워크·예상하지 못한 오류: 기존 `NETWORK_ERROR` fallback 사용

성공 시 이름 변경과 비밀번호 변경은 각각 성공 toast를 표시한다. 서버 오류는 폼의 `role="alert"` 영역 또는 toast로 표시하며 비밀번호 원문은 상태·로그·메시지에 포함하지 않는다.

### 인증 및 권한

- `/account`는 기존 `redirectIfUnauthenticated`로 보호한다.
- account API 호출은 인증 인터셉터와 Bearer header를 사용한다.
- workspace query parameter는 권한 판단의 근거로 사용하지 않고, `GET /workspaces` 결과로 검증한다.
- 계정 응답에는 password hash, session version 등 민감 필드를 사용하지 않는다.

## 접근성 및 반응형

- 모든 입력은 visible label과 연결한다.
- disabled 이메일 필드는 읽기 전용 계정 정보임을 유지한다.
- 오류 필드는 `aria-invalid`, `aria-describedby`, `role="alert"`를 사용한다.
- 버튼에는 `type`, loading/disabled 상태, 명확한 한글 label을 제공한다.
- 기존 Sidebar의 keyboard navigation, dialog focus trap, responsive collapse를 유지한다.
- 480px 폼은 좁은 viewport에서 `w-full`로 줄어들고 메인 horizontal padding만 유지한다.

## 테스트 전략

### API

- GET/PATCH `/account` 경로·header·body·응답 envelope
- PATCH `/account/password` 요청 body와 access token/user 반환
- 확인 비밀번호가 API body에 포함되지 않는지

### 상태 및 폼

- 계정 조회 성공/실패
- 이름 trim·required·길이 검증
- 이름 변경 성공 시 session user 갱신
- pristine profile form의 server user 동기화와 dirty draft 보존
- 이름 저장 성공 후 profile form reset
- 비밀번호 정책·확인 값 불일치 검증
- 비밀번호 변경 성공 시 access token/user 갱신
- logout·재로그인·사용자 전환 중 늦게 도착한 mutation 응답 무시
- account PATCH와 진행 중인 GET의 응답 순서 경합
- 참여 워크스페이스 이름 검색과 검색 결과 없음 상태
- 참여 워크스페이스 목록 4행 높이 제한과 overflow scroll
- 오류 시 제출 중 상태 해제 및 메시지 표시
- re-auth 필요 오류 시 session 정리와 `/login` 이동

### 라우트 및 셸

- `/account`가 인증되지 않은 사용자를 로그인으로 보낸다.
- `/account` query workspace ID가 목록에 있으면 해당 workspace를 선택한다.
- query가 없거나 접근 불가하면 기본 workspace로 fallback한다.
- 프로젝트 화면 하단 사용자 정보가 `/account?workspaceId=...`로 이동한다.
- 프로젝트 화면 설정 메뉴는 계정 설정 route를 호출하지 않는다.
- 계정 화면 프로젝트 메뉴가 동일 workspace project route로 이동한다.
- workspace switcher가 query만 교체하고 account API 요청에는 workspace ID를 넣지 않는다.
- 기존 프로젝트·로그인·사이드바 회귀 테스트를 유지한다.
- AccountPage는 workspace query loading/error에서도 제목과 form을 유지하고 참여 workspace 섹션에서 재시도할 수 있다.

### 최종 검증

```bash
pnpm --dir frontend test
pnpm --dir frontend lint
pnpm --dir frontend build
pnpm --dir frontend format:check
git diff --check
```

구현 계획 완료 후 위 명령 결과와 계획 대비 변경점을 계획 문서의 `Implementation Results`에 기록한다.

## 결정 사항

- canonical route는 `/account`로 한다.
- `workspaceId`는 optional query parameter이며 화면 컨텍스트만 나타낸다.
- 계정 API는 사용자 전역 범위를 유지하고 workspace ID를 받지 않는다.
- workspace settings와 account settings의 URL 의미를 분리한다.
- 기존 인증 셸을 공통화해 Sidebar와 workspace 전환 UI를 중복 구현하지 않는다.
- 기존 백엔드 변경사항은 수정하지 않는다.
- 사용자가 요청하기 전까지 commit, push, merge, PR을 실행하지 않는다.
