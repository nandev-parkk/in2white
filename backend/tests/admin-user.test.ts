import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "@/app";
import { useTestServer } from "./test-server";
import { db } from "@/db/client";
import { signAdminAccessToken } from "@/lib/admin-jwt";
import { signAccessToken } from "@/lib/jwt";
import { comparePassword } from "@/lib/password";
import {
  adminUserListQuerySchema,
  createUserSchema,
  updateUserSchema,
} from "@/schemas/admin-user.schema";
import { recordAuditLog } from "@/services/admin-audit-log.service";
import * as adminUserService from "@/services/admin-user.service";
import { HttpError } from "@/utils/http-error";

vi.mock("@/db/client", () => ({
  db: { select: vi.fn(), transaction: vi.fn() },
}));
vi.mock("@/services/admin-user.service");
vi.mock("@/services/admin-audit-log.service");

const appUrl = useTestServer(() => createApp());

/* 컨트롤러가 트랜잭션 핸들을 서비스와 감사 로그에 같은 값으로 넘기는지 확인하기 위한 표식이다. */
const transactionHandle = { handle: "tx" };

const userId = "550e8400-e29b-41d4-a716-446655440001";
const createdAt = new Date("2026-09-20T00:00:00.000Z");

async function adminAuthHeader(sub = "admin-1") {
  const token = await signAdminAccessToken({
    sub,
    email: "admin@example.com",
    sid: "admin-sid-1",
    ver: 0,
  });
  return `Bearer ${token}`;
}

async function productAuthHeader() {
  const token = await signAccessToken({
    sub: "user-1",
    email: "user@example.com",
    sid: "session-1",
    ver: 0,
  });
  return `Bearer ${token}`;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.transaction).mockImplementation(async (callback) =>
    callback(transactionHandle as never),
  );
});

describe("adminUserListQuerySchema", () => {
  it("페이지·정지 여부 필터의 기본값을 채운다", () => {
    expect(adminUserListQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
      status: "all",
      search: undefined,
    });
  });

  it("정지 여부 필터 값을 허용한다", () => {
    expect(adminUserListQuerySchema.parse({ status: "deactivated" }).status).toBe("deactivated");
    expect(adminUserListQuerySchema.parse({ status: "active" }).status).toBe("active");
  });

  it("정의하지 않은 정지 여부 값을 거부한다", () => {
    expect(() => adminUserListQuerySchema.parse({ status: "suspended" })).toThrow();
  });
});

describe("createUserSchema", () => {
  it("이름을 trim하고 이메일을 소문자로 정규화한다", () => {
    expect(
      createUserSchema.parse({
        email: "  New.User@Example.COM ",
        name: "  새 사용자  ",
        password: "Password1!",
      }),
    ).toEqual({ email: "new.user@example.com", name: "새 사용자", password: "Password1!" });
  });

  it.each([
    { label: "이메일 누락", body: { name: "새 사용자", password: "Password1!" } },
    {
      label: "이메일 형식",
      body: { email: "not-an-email", name: "새 사용자", password: "P1!aaaaa" },
    },
    {
      label: "이름 공백",
      body: { email: "user@example.com", name: "   ", password: "Password1!" },
    },
    {
      label: "약한 비밀번호",
      body: { email: "user@example.com", name: "새 사용자", password: "short" },
    },
    {
      label: "정의하지 않은 필드",
      body: {
        email: "user@example.com",
        name: "새 사용자",
        password: "Password1!",
        role: "admin",
      },
    },
  ])("$label 요청을 거부한다", ({ body }) => {
    expect(() => createUserSchema.parse(body)).toThrow();
  });
});

describe("GET /admin/users", () => {
  const listResult = {
    users: [
      {
        id: userId,
        name: "Kim User",
        email: "user@example.com",
        deactivatedAt: null,
        workspaceCount: 2,
        createdAt,
      },
    ],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  it("인증된 어드민에게 직렬화된 사용자 목록을 반환한다", async () => {
    vi.mocked(adminUserService.listUsers).mockResolvedValue(listResult);

    const response = await request(appUrl())
      .get("/admin/users")
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      users: [
        {
          id: userId,
          name: "Kim User",
          email: "user@example.com",
          deactivatedAt: null,
          workspaceCount: 2,
          createdAt: createdAt.toISOString(),
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it("검색어를 trim하고 페이지·정지 여부 필터를 서비스에 전달한다", async () => {
    vi.mocked(adminUserService.listUsers).mockResolvedValue({
      users: [],
      pagination: { page: 2, limit: 5, total: 0, totalPages: 0 },
    });

    const response = await request(appUrl())
      .get("/admin/users")
      .query({ search: "  Kim  ", page: "2", limit: "5", status: "deactivated" })
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(adminUserService.listUsers).toHaveBeenCalledWith({
      search: "Kim",
      page: 2,
      limit: 5,
      status: "deactivated",
    });
  });

  it("조회는 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminUserService.listUsers).mockResolvedValue(listResult);

    await request(appUrl())
      .get("/admin/users")
      .set("Authorization", await adminAuthHeader());

    expect(recordAuditLog).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("인증이 없으면 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl()).get("/admin/users");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(adminUserService.listUsers).not.toHaveBeenCalled();
  });

  /* 제품 토큰으로 어드민 API에 들어오면 모든 사용자가 서비스 전체를 조작할 수 있다. */
  it("제품 Access Token은 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl())
      .get("/admin/users")
      .set("Authorization", await productAuthHeader());

    expect(response.status).toBe(401);
    expect(adminUserService.listUsers).not.toHaveBeenCalled();
  });

  it.each([
    { label: "page", query: { page: "0" } },
    { label: "limit", query: { limit: "101" } },
    { label: "search", query: { search: "a".repeat(101) } },
    { label: "status", query: { status: "suspended" } },
  ])("잘못된 $label query는 400이며 서비스를 호출하지 않는다", async ({ query }) => {
    const response = await request(appUrl())
      .get("/admin/users")
      .query(query)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(adminUserService.listUsers).not.toHaveBeenCalled();
  });

  it("DB 오류를 공통 500 응답으로 변환한다", async () => {
    vi.mocked(adminUserService.listUsers).mockRejectedValue(new Error("user list failed"));

    const response = await request(appUrl())
      .get("/admin/users")
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});

describe("POST /admin/users", () => {
  const createdUser = {
    id: userId,
    name: "새 사용자",
    email: "new.user@example.com",
    deactivatedAt: null,
    createdAt,
  };
  const body = { email: "New.User@example.com", name: "새 사용자", password: "Password1!" };

  it("사용자를 생성하고 비밀번호 해시만 서비스에 넘긴다", async () => {
    vi.mocked(adminUserService.createUser).mockResolvedValue(createdUser);

    const response = await request(appUrl())
      .post("/admin/users")
      .set("Authorization", await adminAuthHeader())
      .send(body);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      user: {
        id: userId,
        name: "새 사용자",
        email: "new.user@example.com",
        deactivatedAt: null,
        createdAt: createdAt.toISOString(),
      },
    });

    const [handle, input] = vi.mocked(adminUserService.createUser).mock.calls[0]!;
    expect(handle).toBe(transactionHandle);
    expect(input.email).toBe("new.user@example.com");
    expect(input.name).toBe("새 사용자");
    expect(input).not.toHaveProperty("password");
    await expect(comparePassword(body.password, input.passwordHash)).resolves.toBe(true);
  });

  it("생성 성공 시 같은 트랜잭션에 감사 로그를 1건 남긴다", async () => {
    vi.mocked(adminUserService.createUser).mockResolvedValue(createdUser);

    const response = await request(appUrl())
      .post("/admin/users")
      .set("Authorization", await adminAuthHeader())
      .set("User-Agent", "admin-console-test")
      .send(body);

    expect(response.status).toBe(201);
    expect(recordAuditLog).toHaveBeenCalledOnce();
    expect(recordAuditLog).toHaveBeenCalledWith(
      transactionHandle,
      expect.objectContaining({
        adminId: "admin-1",
        action: "user.create",
        targetType: "user",
        targetId: userId,
        metadata: { email: "new.user@example.com", name: "새 사용자" },
        userAgent: "admin-console-test",
      }),
    );

    const [, entry] = vi.mocked(recordAuditLog).mock.calls[0]!;
    expect(JSON.stringify(entry)).not.toContain(body.password);
    expect(JSON.stringify(entry)).not.toContain("passwordHash");
  });

  it("인증이 없으면 401이며 트랜잭션을 열지 않는다", async () => {
    const response = await request(appUrl()).post("/admin/users").send(body);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(db.transaction).not.toHaveBeenCalled();
    expect(adminUserService.createUser).not.toHaveBeenCalled();
  });

  it("제품 Access Token은 401이며 트랜잭션을 열지 않는다", async () => {
    const response = await request(appUrl())
      .post("/admin/users")
      .set("Authorization", await productAuthHeader())
      .send(body);

    expect(response.status).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(adminUserService.createUser).not.toHaveBeenCalled();
  });

  it.each([
    { label: "이메일 누락", payload: { name: "새 사용자", password: "Password1!" } },
    {
      label: "약한 비밀번호",
      payload: { email: "user@example.com", name: "새 사용자", password: "short" },
    },
    {
      label: "정의하지 않은 필드",
      payload: {
        email: "user@example.com",
        name: "새 사용자",
        password: "Password1!",
        role: "admin",
      },
    },
  ])("$label 요청은 400이며 트랜잭션을 열지 않는다", async ({ payload }) => {
    const response = await request(appUrl())
      .post("/admin/users")
      .set("Authorization", await adminAuthHeader())
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("이메일이 중복되면 409를 반환하고 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminUserService.createUser).mockRejectedValue(
      new HttpError(409, "EMAIL_ALREADY_EXISTS", "이미 사용 중인 이메일입니다"),
    );

    const response = await request(appUrl())
      .post("/admin/users")
      .set("Authorization", await adminAuthHeader())
      .send(body);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    expect(recordAuditLog).not.toHaveBeenCalled();
  });
});

describe("updateUserSchema", () => {
  it("이름만 또는 이메일만 수정할 수 있다", () => {
    expect(updateUserSchema.parse({ name: "  바뀐 이름  " })).toEqual({ name: "바뀐 이름" });
    expect(updateUserSchema.parse({ email: " Changed@Example.COM " })).toEqual({
      email: "changed@example.com",
    });
  });

  it("수정할 필드가 없으면 거부한다", () => {
    expect(() => updateUserSchema.parse({})).toThrow();
  });

  it("정의하지 않은 필드를 거부한다", () => {
    expect(() => updateUserSchema.parse({ name: "바뀐 이름", deactivatedAt: null })).toThrow();
  });
});

describe("GET /admin/users/:userId", () => {
  const detail = {
    user: {
      id: userId,
      name: "Kim User",
      email: "user@example.com",
      deactivatedAt: null,
      createdAt,
    },
    workspaces: [
      {
        id: "550e8400-e29b-41d4-a716-446655440010",
        name: "My Workspace",
        isDefault: true,
        role: "owner" as const,
        joinedAt: createdAt,
      },
    ],
    createdProjectCount: 3,
    createdWhiteboardDocumentCount: 7,
  };

  it("소속 워크스페이스와 생성 리소스 수를 반환하고 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminUserService.getUserDetail).mockResolvedValue(detail);

    const response = await request(appUrl())
      .get(`/admin/users/${userId}`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(adminUserService.getUserDetail).toHaveBeenCalledWith(userId);
    expect(response.body).toEqual({
      user: {
        id: userId,
        name: "Kim User",
        email: "user@example.com",
        deactivatedAt: null,
        createdAt: createdAt.toISOString(),
      },
      workspaces: [
        {
          id: "550e8400-e29b-41d4-a716-446655440010",
          name: "My Workspace",
          isDefault: true,
          role: "owner",
          joinedAt: createdAt.toISOString(),
        },
      ],
      createdProjectCount: 3,
      createdWhiteboardDocumentCount: 7,
    });
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("인증이 없으면 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl()).get(`/admin/users/${userId}`);

    expect(response.status).toBe(401);
    expect(adminUserService.getUserDetail).not.toHaveBeenCalled();
  });

  it("제품 Access Token은 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl())
      .get(`/admin/users/${userId}`)
      .set("Authorization", await productAuthHeader());

    expect(response.status).toBe(401);
    expect(adminUserService.getUserDetail).not.toHaveBeenCalled();
  });

  it("UUID가 아닌 userId는 400이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl())
      .get("/admin/users/not-a-uuid")
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(adminUserService.getUserDetail).not.toHaveBeenCalled();
  });

  it("없는 사용자는 404를 반환한다", async () => {
    vi.mocked(adminUserService.getUserDetail).mockRejectedValue(
      new HttpError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다"),
    );

    const response = await request(appUrl())
      .get(`/admin/users/${userId}`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("USER_NOT_FOUND");
  });
});

describe("PATCH /admin/users/:userId", () => {
  const previousUser = {
    id: userId,
    name: "Kim User",
    email: "user@example.com",
    deactivatedAt: null,
    createdAt,
  };
  const updatedUser = { ...previousUser, name: "바뀐 이름", email: "changed@example.com" };

  it("이름·이메일을 수정하고 변경 전후를 같은 트랜잭션의 감사 로그에 남긴다", async () => {
    vi.mocked(adminUserService.updateUser).mockResolvedValue({
      previousUser,
      user: updatedUser,
    });

    const response = await request(appUrl())
      .patch(`/admin/users/${userId}`)
      .set("Authorization", await adminAuthHeader())
      .send({ name: "  바뀐 이름  ", email: "Changed@Example.com" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: {
        id: userId,
        name: "바뀐 이름",
        email: "changed@example.com",
        deactivatedAt: null,
        createdAt: createdAt.toISOString(),
      },
    });
    expect(adminUserService.updateUser).toHaveBeenCalledWith(transactionHandle, {
      userId,
      name: "바뀐 이름",
      email: "changed@example.com",
    });
    expect(recordAuditLog).toHaveBeenCalledOnce();
    expect(recordAuditLog).toHaveBeenCalledWith(
      transactionHandle,
      expect.objectContaining({
        adminId: "admin-1",
        action: "user.update",
        targetType: "user",
        targetId: userId,
        metadata: {
          before: { name: "Kim User", email: "user@example.com" },
          after: { name: "바뀐 이름", email: "changed@example.com" },
        },
      }),
    );
  });

  it("인증이 없으면 401이며 트랜잭션을 열지 않는다", async () => {
    const response = await request(appUrl())
      .patch(`/admin/users/${userId}`)
      .send({ name: "바뀐 이름" });

    expect(response.status).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("제품 Access Token은 401이며 트랜잭션을 열지 않는다", async () => {
    const response = await request(appUrl())
      .patch(`/admin/users/${userId}`)
      .set("Authorization", await productAuthHeader())
      .send({ name: "바뀐 이름" });

    expect(response.status).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it.each([
    { label: "빈 본문", path: userId, payload: {} },
    { label: "UUID가 아닌 userId", path: "not-a-uuid", payload: { name: "바뀐 이름" } },
    { label: "이메일 형식", path: userId, payload: { email: "not-an-email" } },
    { label: "정의하지 않은 필드", path: userId, payload: { sessionVersion: 3 } },
  ])("$label 요청은 400이며 트랜잭션을 열지 않는다", async ({ path, payload }) => {
    const response = await request(appUrl())
      .patch(`/admin/users/${path}`)
      .set("Authorization", await adminAuthHeader())
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("이메일이 다른 사용자와 겹치면 409이며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminUserService.updateUser).mockRejectedValue(
      new HttpError(409, "EMAIL_ALREADY_EXISTS", "이미 사용 중인 이메일입니다"),
    );

    const response = await request(appUrl())
      .patch(`/admin/users/${userId}`)
      .set("Authorization", await adminAuthHeader())
      .send({ email: "taken@example.com" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("없는 사용자는 404이며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminUserService.updateUser).mockRejectedValue(
      new HttpError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다"),
    );

    const response = await request(appUrl())
      .patch(`/admin/users/${userId}`)
      .set("Authorization", await adminAuthHeader())
      .send({ name: "바뀐 이름" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("USER_NOT_FOUND");
    expect(recordAuditLog).not.toHaveBeenCalled();
  });
});
