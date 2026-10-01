import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";
import { hashPassword } from "@/lib/password";
import { passwordSchema } from "@/schemas/password.schema";
import { createAdminUser } from "@/services/admin-account.service";
import { HttpError } from "@/utils/http-error";

/*
 * 첫 어드민 계정을 만드는 유일한 경로다. 비밀번호는 인자가 아니라 환경변수로 받는다.
 * 인자로 받으면 셸 히스토리와 `ps` 출력에 평문이 남는다.
 */
const USAGE = [
  "사용법: ADMIN_USER_PASSWORD=<비밀번호> pnpm --filter backend create-admin-user <이메일> <이름>",
  "비밀번호는 제품 계정과 같은 정책(8~32자, 영문·숫자·특수문자 포함)을 따른다.",
].join("\n");

const argsSchema = z.object({
  email: z
    .string({ error: ERROR_MESSAGES.EMAIL_REQUIRED })
    .min(1, ERROR_MESSAGES.EMAIL_REQUIRED)
    .email(ERROR_MESSAGES.EMAIL_INVALID_FORMAT),
  name: z
    .string({ error: ERROR_MESSAGES.ACCOUNT_NAME_REQUIRED })
    .trim()
    .min(1, ERROR_MESSAGES.ACCOUNT_NAME_REQUIRED)
    .max(255, ERROR_MESSAGES.ACCOUNT_NAME_TOO_LONG),
  password: passwordSchema,
});

async function main() {
  const [email, name] = process.argv.slice(2);
  const parsed = argsSchema.safeParse({
    email,
    name,
    password: process.env.ADMIN_USER_PASSWORD,
  });

  if (!parsed.success) {
    // 어느 입력이 왜 틀렸는지만 알린다. 값 자체는 출력하지 않는다.
    for (const issue of parsed.error.issues) {
      console.error(`${issue.path.join(".") || "입력"}: ${issue.message}`);
    }
    console.error(`\n${USAGE}`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const admin = await createAdminUser({
    email: parsed.data.email,
    name: parsed.data.name,
    passwordHash,
  });

  console.log(`어드민 계정 생성 완료: ${admin.email} (${admin.id})`);
  process.exit(0);
}

main().catch((err: unknown) => {
  if (err instanceof HttpError && err.code === "EMAIL_ALREADY_EXISTS") {
    console.error(`${err.message} 다른 이메일을 쓰거나 기존 계정을 사용하세요.`);
    process.exit(1);
  }

  console.error(err);
  process.exit(1);
});
