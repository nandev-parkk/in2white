# PostgreSQL `format()` 매개변수 타입 추론 오류

- 증상·검색어: 프로비저닝 통합 테스트에서 `42P18` (`could not determine data type of parameter`) 발생. `format('%I', ...)`와 `format('%L', ...)`에 `postgres.js` 매개변수를 전달할 때 재현된다.
- 원인: PostgreSQL의 `format()` 가변 인자에 전달한 바인딩 값의 타입을 서버가 추론할 수 없다.
- 해결: [프로비저닝 스크립트](../../server/src/scripts/provision-database.ts)의 `format()` 인자에 `::text`를 명시한다. 식별자·문자열 인용은 각각 `%I`, `%L`을 계속 사용한다.
- 검증: `RUN_DATABASE_INTEGRATION_TESTS=1 pnpm --filter server exec vitest run tests/provision-database.integration.test.ts` — 1개 통과.
- 적용 조건: PostgreSQL `format()`의 가변 인자에 타입이 지정되지 않은 바인딩 값을 전달할 때.
