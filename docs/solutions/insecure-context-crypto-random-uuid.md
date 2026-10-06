# 비보안 컨텍스트에서 `crypto.randomUUID is not a function`

## 증상·검색 키워드

LAN의 다른 기기에서 `http://<IP>:8080`으로 접속해 화이트보드를 수정하면 동기화가 실패하고 아래 오류가 뜬다. 같은 빌드를 `http://localhost:8080`에서 열면 재현되지 않는다.

- `crypto.randomUUID is not a function`
- `(In 'crypto.randomUUID()', 'crypto.randomUUID' is undefined)` (WebKit 메시지 형식)
- 키워드: secure context, randomUUID undefined, HTTP IP 접속, LAN 테스트

## 근본 원인

`crypto.randomUUID()`는 **보안 컨텍스트에서만 노출되는** API다. 브라우저는 HTTPS와 `localhost`·`127.0.0.1`만 보안 컨텍스트로 취급하고, `http://192.168.x.x`처럼 평문 HTTP로 IP에 접속하면 `crypto.randomUUID`가 `undefined`다. `crypto.getRandomValues()`에는 이 제약이 없다.

`use-whiteboard-editor.ts`의 `send()`가 장면 업데이트마다 `clientUpdateId: crypto.randomUUID()`를 만들었다. 이 호출은 `try/catch` 안이라 예외가 `fail(cause.message)`로 넘어가 동기화 오류 메시지로 표면화됐다.

호스트에서 개발하거나 HTTPS로 배포하면 항상 보안 컨텍스트여서 드러나지 않았다.

## 해결 방법

UUID 생성을 `uuid` 패키지(v4)에 맡기고, 직접 구현하지 않는다.

```bash
cd client && pnpm add uuid
```

`client/src/features/whiteboard-editor/model/use-whiteboard-editor.ts`

```ts
import { v4 as uuidv4 } from 'uuid'
// ...
clientUpdateId: uuidv4(),
```

`uuid@14`의 `v4`가 정확히 필요한 동작을 한다. `crypto.randomUUID`가 있으면 그대로 쓰고, 없으면 `crypto.getRandomValues`로 16바이트를 받아 버전 니블과 variant 비트를 채운다.

```js
// node_modules/uuid/dist/v4.js
if (!buf && !options && crypto.randomUUID) return crypto.randomUUID()
// dist/rng.js → crypto.getRandomValues(rnds8)
rnds[6] = (rnds[6] & 0x0f) | 0x40
rnds[8] = (rnds[8] & 0x3f) | 0x80
```

형식을 지켜야 하는 이유가 있다. 서버 `whiteboard-protocol.schema.ts:74`가 `clientUpdateId: z.uuid()`를 요구하므로 대체 경로도 RFC 4122 v4 형식이어야 서버 검증을 통과한다.

`uuid@14.0.2`는 이미 `@excalidraw/excalidraw → @excalidraw/mermaid-to-excalidraw → mermaid` 경로로 의존성 트리에 있었고 버전이 하나뿐이다. 직접 의존성으로 올려도 pnpm이 같은 설치본을 재사용해서 `node_modules/.pnpm` 패키지 수는 963개 그대로였다. 새 공급망이 늘지 않는다.

호출부는 이 한 곳이다. 프런트엔드 전체에서 보안 컨텍스트 전용 API는 이것뿐이었다. `crypto.subtle`·`navigator.clipboard`·`navigator.mediaDevices`·`serviceWorker` 사용처는 없다.

## 검증

```bash
cd client
npx vitest run           # 84 files / 477 passed
npx tsc -b --force       # 0건
npx eslint .             # 0건
npx prettier --check .   # 통과
npx vite build           # 성공
```

`use-whiteboard-editor.test.tsx`가 ack 재전송 시 `clientUpdateId`가 유지되는지 이미 검증한다.

빌드 후 이미지 안의 청크에서 가드가 살아 있는지 확인했다.

```bash
docker compose --env-file .env.compose exec -T client \
  grep -o ".\{60\}randomUUID.\{140\}" /usr/share/nginx/html/assets/WhiteboardCanvas-*.js
# → getRandomValues(zO)}function VO(e,t,n){return!t&&!e&&crypto.randomUUID?crypto.randomUUID():HO(e,t,n)}
```

## 적용 조건·재발 방지

- UUID가 필요하면 `crypto.randomUUID()`를 직접 부르지 않고 `uuid`의 `v4`를 쓴다. 직접 구현하면 버전·variant 비트와 형식을 우리가 책임져야 한다.
- 보안 컨텍스트 전용 API(`crypto.randomUUID`, `crypto.subtle`, `navigator.clipboard`, `navigator.mediaDevices`, Service Worker)를 새로 도입할 때는 평문 HTTP + IP 접속 경로에서도 동작해야 하는지 판단한다.
- LAN의 다른 기기로 테스트할 때는 같은 원인의 문제가 하나 더 있다. `NODE_ENV=production`이면 refresh 쿠키에 `Secure`가 붙고(`server/src/utils/auth-cookie.ts:10`), 브라우저가 평문 HTTP + IP에서는 그 쿠키를 저장하지 않아 새로 고침하면 로그아웃된다. 근본 해결은 리버스 프록시로 HTTPS를 붙이는 것이고, 임시로는 `NODE_ENV=development`로 내려 확인한다.
- `localhost`에서만 확인하면 이 부류의 문제는 드러나지 않는다.
