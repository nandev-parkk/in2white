import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

// 유효한 형식의 bcrypt 해시(cost=10). 어떤 실제 비밀번호와도 매칭되지 않으며,
// 계정이 없을 때도 동일한 시간이 걸리는 compare를 수행하기 위한 용도로만 사용한다.
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
