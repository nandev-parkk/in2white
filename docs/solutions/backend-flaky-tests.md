# 백엔드 테스트가 부하에서 산발적으로 실패하는 문제

## 증상·검색 키워드

`vitest` 전체 실행에서 매번 다른 테스트가 1개씩 실패하고, 같은 파일을 단독으로 실행하면 통과한다. CPU가 포화된 상태에서 재현율이 높다.

- `expected 401 to be 400`, `expected 403 to be 500`, `expected 401 to be 204`
- `expected undefined to deeply equal`, `Error: socket hang up`
- `AssertionError: expected [] to deep equally contain { code: 'RATE_LIMITED' }`
- 키워드: flaky, supertest, keep-alive, 포트 재사용, 고정 setTimeout 대기

## 근본 원인

두 가지가 겹쳐 있었다.

### 1. supertest가 요청마다 서버를 열고 닫는다

`request(createApp())`은 요청마다 Express 앱과 HTTP 서버를 새로 만들고 응답 후 닫는다. 테스트 스위트 전체에서 서버가 160번 이상 뜨고 닫히는데, CPU가 포화되면

- 닫히는 서버의 포트를 다음 서버가 물려받고,
- Node 19+에서 기본으로 켜진 `http.globalAgent`의 keep-alive 소켓이 `host:port` 키로 재사용되면서

앞선 요청의 응답을 다음 요청이 읽는다. 그래서 `POST` 요청이 `PATCH` 전용 경로에서만 나오는 403을 받는 식으로, 기대와 무관한 상태 코드가 돌아왔다.

판별 근거: 403은 `whiteboard-document.service.ts`의 UPDATE/DELETE 경로에만 존재하는데 실패한 요청은 POST였다. 즉 mock 오염이 아니라 응답 자체가 섞인 것이다.

### 2. 협업 테스트가 고정 시간 대기에 의존한다

`whiteboard-collaboration.test.ts`가 소켓 이벤트 도착을 `await new Promise((resolve) => setTimeout(resolve, 50))` 같은 고정 대기로 기다렸다. 협업 서버는 테스트에서 `now`를 주입받으므로 이 대기는 순전히 이벤트 도착 여유였고, 부하가 걸리면 그 시간 안에 도착하지 않아 실패했다.

## 해결 방법

### 파일마다 서버를 하나만 유지 (`backend/tests/test-server.ts`)

`useTestServer()` 헬퍼가 `beforeAll`에서 서버 하나를 열고 `afterAll`에서 닫으며, 테스트는 그 주소로 요청한다.

```ts
const appUrl = useTestServer(() => createApp());
// request(createApp()) → request(appUrl())
```

적용 파일: `app`, `member`, `member-candidates`, `project`, `project-detail`, `whiteboard-document`, `workspace` 테스트 (총 158곳).

### 커넥션 재사용 차단 (`backend/tests/setup.ts`)

남은 임시 서버에서도 소켓이 재사용되지 않도록 테스트 전역에서 keep-alive를 끈다. `vitest.config.ts`의 `setupFiles`로 연결했다.

```ts
http.globalAgent = new http.Agent({ keepAlive: false });
```

### 고정 대기를 조건 대기로 교체

`setTimeout` 대기를 `vi.waitFor(..., { timeout: WAIT_TIMEOUT_MS })`로 바꿨다. 저장 디바운스 대기는 `expect(saveSnapshot).toHaveBeenCalled()`처럼 실제 신호를 기다린다. "일어나지 않음"을 보는 단언(중복 방출 없음, 연결되지 않음)은 부하에서 실패하는 방향이 아니므로 고정 대기를 남겼다.

## 검증

CPU를 포화시킨 상태(`yes` 8개)에서 전체 스위트를 20회 반복했다.

```bash
cd backend && npx vitest run
```

| 상태 | 부하 20회 결과 |
| --- | --- |
| 수정 전 | 실패 3회 (응답 섞임·오염) |
| 공용 서버 전환 후 | 실패 0회 (통과 20 / 실패 0) |

## 적용 조건·재발 방지

- `request(createApp())`을 새로 추가하지 않는다. 기존 파일에서는 `request(appUrl())`을 쓰고, 새 파일은 `useTestServer()`로 서버를 연다.
- `createApp`에 테스트별 옵션을 넘겨야 하면 공용 서버 생성 시 위임 콜백을 주입하고 테스트에서 대상을 바꾼다.
- 소켓·타이머 이벤트는 고정 `setTimeout`으로 기다리지 않고 `vi.waitFor`로 조건을 기다린다.
- 플레이키를 만나면 단독 실행으로 재현되지 않는지 먼저 확인하고, CPU 부하를 걸어 전체 실행을 반복해 재현한다.
