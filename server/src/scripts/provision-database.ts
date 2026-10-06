import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const adminUrl = process.env.POSTGRES_ADMIN_URL;

  if (!databaseUrl || !adminUrl) {
    throw new Error("DATABASE_URL과 POSTGRES_ADMIN_URL이 필요합니다.");
  }

  let app: URL;
  try {
    app = new URL(databaseUrl);
    new URL(adminUrl);
  } catch {
    throw new Error("PostgreSQL 연결 URL 형식이 올바르지 않습니다.");
  }

  const role = decodeURIComponent(app.username);
  const password = decodeURIComponent(app.password);
  const database = decodeURIComponent(app.pathname.slice(1));
  if (!role || !password || !database || !["postgres:", "postgresql:"].includes(app.protocol)) {
    throw new Error("DATABASE_URL에 PostgreSQL 계정, 비밀번호, 데이터베이스 이름이 필요합니다.");
  }

  const admin = postgres(adminUrl, { max: 1 });
  try {
    const existingRole = await admin`SELECT 1 FROM pg_roles WHERE rolname = ${role}`;
    if (existingRole.length === 0) {
      const [{ statement }] = await admin<{ statement: string }[]>`
        SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', ${role}::text, ${password}::text) AS statement
      `;
      await admin.unsafe(statement);
    }

    const existingDatabase = await admin<{ owner: string }[]>`
      SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = ${database}
    `;
    if (existingDatabase.length === 0) {
      const [{ statement }] = await admin<{ statement: string }[]>`
        SELECT format('CREATE DATABASE %I OWNER %I', ${database}::text, ${role}::text) AS statement
      `;
      await admin.unsafe(statement);
    } else if (existingDatabase[0].owner !== role) {
      throw new Error("기존 데이터베이스의 소유자가 애플리케이션 계정과 다릅니다.");
    }
  } finally {
    await admin.end();
  }

  const application = postgres(databaseUrl, { max: 1 });
  try {
    await application`SELECT 1`;
  } finally {
    await application.end();
  }
  console.log("PostgreSQL 계정과 데이터베이스 준비 및 연결 확인 완료");
}

main().catch((error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? ` (${String(error.code)})`
      : "";
  console.error(`PostgreSQL 준비 실패${code}`);
  process.exitCode = 1;
});
