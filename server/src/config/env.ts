import "dotenv/config";
import { z } from "zod";

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  VALKEY_URL: z.string().min(1, "VALKEY_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN is required").default("http://localhost:5173"),
  JWT_ADMIN_SECRET: z.string().min(32, "JWT_ADMIN_SECRET must be at least 32 characters"),
  JWT_ADMIN_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_ADMIN_REFRESH_SECRET must be at least 32 characters"),
  ADMIN_CORS_ORIGIN: z
    .string()
    .min(1, "ADMIN_CORS_ORIGIN is required")
    .default("http://localhost:5174"),
});

/*
 * 어드민 토큰과 제품 토큰은 서로의 영역에서 거부돼야 한다. 네 시크릿 중 하나라도
 * 겹치면 상대 영역의 토큰이 서명 검증을 통과해버려서, payload의 `type` claim 검사
 * 하나만 방어선으로 남는다. 부팅 시점에 막는다.
 */
const SECRET_KEYS = [
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_ADMIN_SECRET",
  "JWT_ADMIN_REFRESH_SECRET",
] as const;

export const envSchema = baseEnvSchema.superRefine((env, ctx) => {
  SECRET_KEYS.forEach((key, index) => {
    const earlier = SECRET_KEYS.slice(0, index).find((other) => env[other] === env[key]);
    if (!earlier) return;

    ctx.addIssue({
      code: "custom",
      path: [key],
      message: `${key} must differ from ${earlier}`,
    });
  });
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  return parsed.data;
}

let cachedEnv: Env | undefined;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = parseEnv(process.env);
  }
  return cachedEnv;
}
