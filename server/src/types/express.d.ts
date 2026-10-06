import type { AdminAccessTokenPayload } from "@/lib/admin-jwt";
import type { AccessTokenPayload } from "@/lib/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
      /* 어드민은 별도 필드다. `user`와 겹치면 제품 컨트롤러가 어드민 요청을 일반 요청으로 처리할 수 있다. */
      admin?: AdminAccessTokenPayload;
    }
  }
}

export {};
