# 백엔드 테스트가 타입 검사에서 빠져 있던 문제

## 증상·검색 키워드

- `npm run build`와 `tsc`가 통과하는데도 테스트 코드의 타입 오류가 전혀 잡히지 않는다.
- 테스트만 포함해서 검사하면 `error TS2345`, `error TS2322`, `error TS2339`가 한꺼번에 20건 나온다.
- 대표 메시지
  - `Property 'ver' is missing in type '{ sub: string; email: string; sid: string; }'`
  - `Property 'sessionVersion' is missing in type ...`
  - `Type 'Mock<Procedure | Constructable>' is not assignable to type '(...) => Promise<...>'`
  - `Property 'mockClear' does not exist on type '<T>(transaction: ...) => ...'`

## 근본 원인

`backend/tsconfig.json`은 빌드용 설정이라 `rootDir`이 `src`이고 `include`가 `["src/**/*.ts"]`다. 테스트는 `tests/`에 있어서 이 설정의 검사 대상 밖이다. vitest는 esbuild로 타입을 지우고 트랜스파일만 하므로 테스트 코드의 타입은 아무도 보지 않았다.

그래서 아래 불일치가 런타임에 우연히 통과하며 누적됐다.

- `signAccessToken`에 필수 `ver`를 넘기지 않았다. `verifyAccessToken`이 `payload.ver ?? 0`으로 보정해 테스트는 통과했다.
- `users` fixture에 `sessionVersion`이 없었다.
- `vi.mock`으로 대체한 `db.transaction`·`db.select`에 `vi.mocked()` 없이 `mockClear()`·`.mock`을 직접 호출했다.
- 주입용 mock을 `ReturnType<typeof vi.fn>`으로 선언해 실제 의존성 시그니처와의 대조가 사라졌다.

## 해결 방법

### 1. 테스트 전용 타입 검사 설정 추가

빌드 설정은 그대로 두고 검사용 설정을 분리했다. `rootDir`을 `.`로 올리고 `noEmit`을 켜서 `dist`에 영향이 없다.

`backend/tsconfig.test.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"]
}
```

`backend/package.json`

```json
"typecheck": "tsc -p tsconfig.test.json"
```

### 2. 드러난 20건 수정

| 분류 | 수정 |
| --- | --- |
| `signAccessToken` 호출 7곳 | `ver: 0` 추가 |
| `verifyToken` mock payload 2곳 | `ver: 0` 추가 |
| `user-service.test.ts` fixture | `sessionVersion: 0` 추가 |
| `project.test.ts`·`workspace.test.ts` | `vi.mocked(db.transaction)`, `vi.mocked(db.select)`로 감싸기 |
| `db-schema.test.ts` | `schema.whiteboardDocuments.canvasContent` 접근 대신 `getTableColumns(...)`에 `not.toHaveProperty("canvasContent")` |
| 협업·룸 매니저 테스트 mock 6곳 | `ReturnType<typeof vi.fn>` → `Mock<Deps["..."]>`, `vi.fn<Deps["..."]>()` |

의존성 시그니처는 실제 타입을 참조한다. 서버 쪽 옵션이 바뀌면 테스트가 타입 검사에서 먼저 깨진다.

```ts
type Deps = WhiteboardRoomManagerDependencies;

let saveSnapshot: Mock<Deps["saveSnapshot"]>;
saveSnapshot = vi.fn<Deps["saveSnapshot"]>().mockResolvedValue({ status: "saved", lastSavedAt });
```

`verifyToken`을 정확한 타입으로 바꾸자 기존에 안 보였던 `ver` 누락 1건이 추가로 드러났다.

## 검증

```bash
cd backend
npm run typecheck   # 오류 0건 (수정 전 20건)
npm run build       # 성공
npx eslint .        # 0건
npx vitest run      # 38 files / 544 passed, 3 files / 16 skipped
```

`tsconfig.test.json`이 검사하는 테스트 파일은 43개이고 `*.integration.test.ts` 3개도 포함된다. 검사 시간은 약 2.8초다.

통합 테스트까지 포함한 실행은 아래와 같다. Docker가 떠 있어야 한다.

```bash
npm run test:integration   # 41 files / 560 passed, skip 0
```

## 적용 조건·재발 방지

- 테스트 코드를 고친 뒤에는 `npm run build`가 아니라 `npm run typecheck`로 확인한다. 빌드 설정은 `tests/`를 보지 않는다.
- 새 테스트 디렉터리를 만들면 `tsconfig.test.json`의 `include`에 추가한다.
- `vi.mock`으로 대체한 모듈의 메서드에는 `vi.mocked()`를 거쳐 mock API를 호출한다.
- 주입용 mock은 `ReturnType<typeof vi.fn>`으로 선언하지 않고 `Mock<Deps["키"]>`처럼 실제 의존성 타입을 참조한다.
- 타입에 없는 속성의 부재를 검증할 때는 속성 접근 대신 런타임 키 목록(`getTableColumns` 등)에 `not.toHaveProperty`를 쓴다.
- CI가 없으므로 자동 실행 지점은 pre-commit 훅뿐이다. 훅에 넣으려면 `backend/.husky/pre-commit`을 `cd backend && pnpm exec lint-staged && pnpm run typecheck`로 바꾼다. 다만 `frontend/.husky`와 `core.hooksPath`를 두고 경쟁하므로 어느 쪽이 활성인지 먼저 확인한다.
