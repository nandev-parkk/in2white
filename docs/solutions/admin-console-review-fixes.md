# 어드민 콘솔 재점검에서 확인한 운영 오류

- 키워드: 감사 로그 날짜 필터, 현지 시간, Valkey 무응답, 운영 상태 지연, Compose 포트 바인딩

## 증상과 원인

1. 감사 로그는 브라우저 현지 시간으로 표시하지만 날짜 필터는 UTC 자정으로 전송했다. 현지 날짜의 처음과 끝에 있는 기록이 다른 날짜로 분류됐다.
2. 운영 상태 조회가 Valkey `ping()`을 제한 없이 기다려, 캐시가 응답하지 않으면 상태 화면도 응답하지 않았다.
3. Compose 포트와 배포 문서가 달랐다. 실제 `.env.compose`의 제품 URL은 LAN 주소이며, 어드민도 같은 LAN에서 접속한다. 세 서비스의 호스트 포트 바인딩과 CORS 오리진을 같은 접속 방식으로 맞춰야 한다.

## 해결과 검증

- `admin/src/entities/audit-log/api/audit-log.ts`: 선택한 날짜의 **현지** 시작·끝 시각을 ISO 문자열로 변환한다. `TZ=Asia/Seoul` 및 `TZ=America/New_York`에서 감사 로그 API 테스트를 실행했다.
- `backend/src/services/admin-system.service.ts`: DB·Valkey 점검마다 3초 제한을 두고, 응답하지 않는 의존성은 `down`으로 반환한다. 무응답 회귀 테스트를 추가했다.
- `docker-compose.yml`: 제품 화면·어드민 콘솔·API를 LAN에서 접근할 수 있게 바인딩하고, `ADMIN_CORS_ORIGIN`을 어드민 LAN 주소로 맞췄다. `docs/deployment/docker-compose.md`의 설명을 실제 구성에 맞게 고쳤다. `docker compose --env-file .env.compose config --quiet`로 확인했다.

검증 결과: `admin` 테스트 122건·lint·build 통과, `backend` 테스트 938건(16건 skip)·lint·build 통과. 변경 파일의 Prettier 검사와 `git diff --check`도 통과했다.

날짜 변환은 운영자가 보는 브라우저의 현지 시간대를 기준으로 한다. 운영 상태 제한 시간은 화면 응답에 적용되며, 연결 드라이버 자체의 재시도 정책은 바꾸지 않는다.
