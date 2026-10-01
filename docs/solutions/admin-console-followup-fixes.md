# 어드민 콘솔 후속 점검: 로그인 제한 응답과 실행 환경

- 키워드: 어드민 로그인 429, HTML 오류, API 오류 문구 중복, 어드민 환경 변수, Calendar

## 증상과 원인

- `express-rate-limit`의 기본 429 본문은 HTML이어서 어드민의 공통 API 오류 처리기가 서버 문구를 읽지 못했다.
- `LoginForm`은 이미 존재하는 `apiErrorMessage`와 같은 오류 본문 해석을 자체 구현했다.
- 예시 환경 변수에 어드민 시크릿·오리진이 빠져 있었고, 로컬 어드민 Vite 환경 파일도 없어 앱 실행 설정이 불완전했다.

## 해결과 검증

- 어드민 로그인 429를 `{ error: { code, message } }` JSON으로 응답하게 했다. 회귀 테스트에서 수정 전 `text/html` 실패를 확인했다.
- `LoginForm`이 공통 `apiErrorMessage`를 사용하도록 바꾸고 기존 로그인 오류 테스트를 통과시켰다.
- `backend/.env.example`, `.env.compose.example`, `admin/.env.example`을 채웠다. 로컬 무시 파일에는 서로 다른 임의 어드민 시크릿을 생성했다. 실제 `.env.compose`의 제품 LAN URL을 어드민 API URL에 재사용하고, 어드민 오리진도 LAN 주소의 `10102` 포트로 맞췄다.
- 공유 UI에 `Calendar` 컴포넌트는 없다. 감사 로그의 날짜 입력은 공유 `Input`의 기본 `type="date"`와 브라우저 날짜 선택 기능을 쓴다.

검증 결과: `admin` 테스트 122건·lint·build, `backend` 테스트 938건(16건 skip)·lint·build·typecheck, `docker compose --env-file .env.compose config --quiet`를 통과했다.

어드민 콘솔의 로그인 429에만 JSON 본문을 적용했다. 제품 API의 공통 rate limit 응답 계약은 이번 범위에서 변경하지 않았다.
