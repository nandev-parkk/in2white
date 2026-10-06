# Compose DB 마이그레이션 및 초기 관리자 생성 설계

## 목표

`docker compose up -d` 시 Compose PostgreSQL에 앱 데이터베이스를 준비하고, 현재 Drizzle migration을 적용한 다음 초기 관리자 계정이 없으면 생성한다. 호스트 PostgreSQL의 기존 데이터는 복사하거나 수정하지 않는다.

## 동작 흐름

1. Compose PostgreSQL healthcheck 통과
2. `db-provision`이 앱 전용 PostgreSQL 사용자와 데이터베이스 준비
3. `db-migrate`가 `pnpm --filter in2white-server db:migrate` 실행
4. `admin-bootstrap`이 관리자 계정 존재 여부를 확인하고, 없을 때만 환경 변수로 계정 생성
5. 위 작업이 성공한 뒤 API 서버 시작

이미 적용된 Drizzle migration은 실행 기록을 기준으로 건너뛴다. 초기 관리자 계정이 이미 있으면 bootstrap을 건너뛰며, 암호를 재설정하거나 추가 계정을 만들지 않는다. 새 DB에 계정이 없고 초기 계정 정보가 빠졌거나 유효하지 않으면 bootstrap이 실패하고 API 서버도 시작하지 않는다.

## 초기 관리자 설정

Compose 호스트 `.env`에서 `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_NAME`, `ADMIN_BOOTSTRAP_PASSWORD`를 전달한다. 비밀번호는 기존 계정 생성 정책으로 검증하고 bcrypt 해시를 저장한다. 평문 비밀번호는 일회성 bootstrap 컨테이너에만 전달한다.

## 범위

- Compose 전용 PostgreSQL의 앱 DB에만 DB provisioning 및 schema migration을 적용한다.
- 호스트 PostgreSQL의 데이터 덤프·복원은 수행하지 않는다.
- 마이그레이션이나 bootstrap 실패 시 API 서버 시작을 차단한다.

## 검증

- 초기 계정이 없는 경우 생성되고, 이미 계정이 있으면 생성 동작을 건너뛰는 단위 테스트
- `docker compose config --quiet`로 Compose 환경 변수와 의존성 구성을 검증
- 서버 테스트와 Docker Compose 서비스 구성을 검증
