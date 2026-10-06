import { closeDatabase } from "@/db/client";
import { hashPassword } from "@/lib/password";
import { createUserSchema } from "@/schemas/admin-user.schema";
import { createAdminUser, hasAdminUsers } from "@/services/admin-account.service";

async function main() {
  try {
    if (await hasAdminUsers()) {
      console.log("기존 관리자 계정이 있어 초기 생성을 건너뜁니다.");
      return;
    }

    const parsed = createUserSchema.safeParse({
      email: process.env.ADMIN_BOOTSTRAP_EMAIL,
      name: process.env.ADMIN_BOOTSTRAP_NAME,
      password: process.env.ADMIN_BOOTSTRAP_PASSWORD,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        console.error(`${issue.path.join(".") || "입력"}: ${issue.message}`);
      }
      throw new Error("초기 관리자 환경 변수를 확인하세요.");
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await createAdminUser({
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
    });
    console.log("초기 관리자 계정을 생성했습니다.");
  } finally {
    await closeDatabase();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
