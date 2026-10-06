import { createServer, type Server } from "node:http";
import type { Express } from "express";
import { afterAll, beforeAll } from "vitest";

/*
 * supertest에 app을 그대로 넘기면 요청마다 서버를 열고 닫는다. CPU가 포화되면
 * 닫히는 서버의 포트를 다음 서버가 물려받아 앞선 요청의 응답이 섞이거나 커넥션이
 * 끊기므로, 테스트 파일마다 서버를 하나만 열고 그 주소로 요청한다.
 */
export function useTestServer(createHandler: () => Express) {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    server = createServer(createHandler());
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("테스트 서버가 포트에 바인딩되지 않았다");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  return () => baseUrl;
}
