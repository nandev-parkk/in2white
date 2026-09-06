import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

// bcrypt.hash("dummy-password-for-timing-safety", 10)로 미리 생성한 유효한 해시.
// 실제 어떤 계정과도 매칭되지 않으며, 계정이 없을 때도 compare 연산 시간을 맞추기 위해서만 사용한다.
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8y0i1FQrxKAvyDzcRHENpQzR6Bqjh.";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function compareDummyPassword(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_HASH);
}
