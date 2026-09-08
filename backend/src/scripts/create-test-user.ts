import { db } from "@/db/client";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { passwordSchema } from "@/schemas/password.schema";

const email = process.env.TEST_USER_EMAIL ?? "test@example.com";
const password = process.env.TEST_USER_PASSWORD ?? "Test1234!";
const name = process.env.TEST_USER_NAME ?? "테스트유저";

async function main() {
  passwordSchema.parse(password);

  const passwordHash = await hashPassword(password);

  await db
    .insert(users)
    .values({ email, name, passwordHash })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash, name },
    });

  console.log(`테스트 유저 생성/갱신 완료: ${email} / ${password}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
