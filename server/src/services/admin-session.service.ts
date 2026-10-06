import { createHash } from "node:crypto";
import { valkey } from "@/cache/valkey";

/*
 * 어드민 refresh TTL은 제품의 2주가 아니라 1일이다. `lib/admin-jwt.ts`의 토큰
 * 만료와 같은 값이어야 한다 — 저장소가 먼저 사라지면 유효한 토큰이 거부되고,
 * 토큰이 먼저 만료되면 죽은 키가 남는다.
 */
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24;

// KEYS[1] = 세션 키, ARGV[1] = 기대하는 이전 해시, ARGV[2] = 새 해시, ARGV[3] = TTL(초)
// 저장된 값이 기대한 이전 해시와 같을 때만 새 해시로 교체한다 (compare-and-set).
const ROTATE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])
  return 1
else
  return 0
end
`;

/*
 * 제품 세션의 `refresh:` 와 접두사를 나눈다. 같은 공간을 쓰면 제품의
 * `deleteOtherRefreshSessions`가 도는 `refresh:{id}:*` 스캔에 어드민 세션이 걸리고,
 * 그 반대도 성립한다.
 */
function sessionKey(adminId: string, sid: string): string {
  return `admin-refresh:${adminId}:${sid}`;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function saveAdminRefreshSession(
  adminId: string,
  sid: string,
  refreshToken: string,
): Promise<void> {
  await valkey.set(
    sessionKey(adminId, sid),
    hashToken(refreshToken),
    "EX",
    REFRESH_TOKEN_TTL_SECONDS,
  );
}

export async function rotateAdminRefreshSession(
  adminId: string,
  sid: string,
  oldRefreshToken: string,
  newRefreshToken: string,
): Promise<boolean> {
  const result = await valkey.eval(
    ROTATE_SCRIPT,
    1,
    sessionKey(adminId, sid),
    hashToken(oldRefreshToken),
    hashToken(newRefreshToken),
    REFRESH_TOKEN_TTL_SECONDS,
  );
  return result === 1;
}

export async function deleteAdminRefreshSession(adminId: string, sid: string): Promise<void> {
  await valkey.del(sessionKey(adminId, sid));
}

export async function deleteOtherAdminRefreshSessions(
  adminId: string,
  keepSid: string,
): Promise<void> {
  let cursor = "0";
  const keepKey = sessionKey(adminId, keepSid);

  do {
    const [nextCursor, keys] = await valkey.scan(
      cursor,
      "MATCH",
      `admin-refresh:${adminId}:*`,
      "COUNT",
      100,
    );
    const staleKeys = keys.filter((key) => key !== keepKey);
    if (staleKeys.length > 0) {
      await valkey.del(...staleKeys);
    }
    cursor = nextCursor;
  } while (cursor !== "0");
}
