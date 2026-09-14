import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "@/app";
import { signAccessToken } from "@/lib/jwt";
import { getProjectDetail } from "@/services/project.service";
import { HttpError } from "@/utils/http-error";

vi.mock("@/services/project.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/project.service")>();
  return { ...actual, getProjectDetail: vi.fn() };
});

const workspaceId = "550e8400-e29b-41d4-a716-446655440000";
const projectId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const userId = "7a1e6679-7425-40de-944b-e07fc1f90ae7";
const url = "/workspaces/" + workspaceId + "/projects/" + projectId;
const project = {
  id: projectId,
  workspaceId,
  name: "브랜드 캠페인",
  description: "프로젝트 설명",
  creatorId: userId,
  creator: { id: userId, name: "작성자" },
  createdAt: new Date("2026-09-14T00:00:00.000Z"),
  updatedAt: new Date("2026-09-14T00:05:00.000Z"),
};

async function token() {
  return signAccessToken({
    sub: userId,
    email: "member@example.test",
    sid: "test-session",
    ver: 0,
  });
}

beforeEach(() => {
  vi.mocked(getProjectDetail).mockReset();
  vi.mocked(getProjectDetail).mockResolvedValue(project);
});

describe("프로젝트 상세 조회 HTTP 계약", () => {
  it("프로젝트와 생성자를 ISO 날짜와 함께 반환한다", async () => {
    const response = await request(createApp())
      .get(url)
      .set("Authorization", "Bearer " + (await token()));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      project: {
        ...project,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
    });
    expect(getProjectDetail).toHaveBeenCalledWith({
      workspaceId,
      projectId,
      userId,
    });
  });

  it("설명이 없으면 null을 유지한다", async () => {
    vi.mocked(getProjectDetail).mockResolvedValue({
      ...project,
      description: null,
    });
    const response = await request(createApp())
      .get(url)
      .set("Authorization", "Bearer " + (await token()));
    expect(response.status).toBe(200);
    expect(response.body.project.description).toBeNull();
  });

  it.each([undefined, "Basic invalid", "Bearer invalid"])(
    "인증 헤더 %s는 401이며 서비스를 호출하지 않는다",
    async (authorization) => {
      const pending = request(createApp()).get(url);
      if (authorization !== undefined) pending.set("Authorization", authorization);
      const response = await pending;
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
      expect(getProjectDetail).not.toHaveBeenCalled();
    },
  );

  it.each([
    "/workspaces/invalid/projects/" + projectId,
    "/workspaces/" + workspaceId + "/projects/invalid",
  ])("잘못된 UUID 경로 %s는 400이다", async (path) => {
    const response = await request(createApp())
      .get(path)
      .set("Authorization", "Bearer " + (await token()));
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(getProjectDetail).not.toHaveBeenCalled();
  });

  it.each(["WORKSPACE_NOT_FOUND", "PROJECT_NOT_FOUND"])(
    "%s 도메인 오류를 404로 전달한다",
    async (code) => {
      vi.mocked(getProjectDetail).mockRejectedValue(
        new HttpError(404, code, "리소스를 찾을 수 없습니다."),
      );
      const response = await request(createApp())
        .get(url)
        .set("Authorization", "Bearer " + (await token()));
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe(code);
    },
  );

  it("예상하지 못한 DB 오류의 상세를 숨기고 500을 반환한다", async () => {
    const internalMessage = "테스트용 내부 DB 오류";
    vi.mocked(getProjectDetail).mockRejectedValue(new Error(internalMessage));
    const response = await request(createApp())
      .get(url)
      .set("Authorization", "Bearer " + (await token()));
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(response.body)).not.toContain(internalMessage);
  });
});
