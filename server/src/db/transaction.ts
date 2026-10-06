import type { db } from "@/db/client";

/*
 * `db.transaction` 콜백이 받는 핸들의 타입이다. 어드민 변경은 대상 변경과 감사 로그를
 * 같은 트랜잭션에 넣어야 해서, 서비스가 전역 `db` 대신 이 핸들을 인자로 받는다.
 */
export type TransactionHandle = Parameters<Parameters<typeof db.transaction>[0]>[0];
