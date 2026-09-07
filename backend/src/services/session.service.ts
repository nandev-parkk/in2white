import { createHash } from "node:crypto";
import { valkey } from "@/cache/valkey";

const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14;

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

function sessionKey(userId: string, sid: string): string {
  return `refresh:${userId}:${sid}`;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function saveRefreshSession(
  userId: string,
  sid: string,
  refreshToken: string,
): Promise<void> {
  await valkey.set(
    sessionKey(userId, sid),
    hashToken(refreshToken),
    "EX",
    REFRESH_TOKEN_TTL_SECONDS,
  );
}

export async function rotateRefreshSession(
  userId: string,
  sid: string,
  oldRefreshToken: string,
  newRefreshToken: string,
): Promise<boolean> {
  const result = await valkey.eval(
    ROTATE_SCRIPT,
    1,
    sessionKey(userId, sid),
    hashToken(oldRefreshToken),
    hashToken(newRefreshToken),
    REFRESH_TOKEN_TTL_SECONDS,
  );
  return result === 1;
}

export async function deleteRefreshSession(userId: string, sid: string): Promise<void> {
  await valkey.del(sessionKey(userId, sid));
}
