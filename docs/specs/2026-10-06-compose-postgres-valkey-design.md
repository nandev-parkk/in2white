# Compose PostgreSQL·Valkey 구성 설계

## 목표

Compose 배포에 `postgres:18`과 `valkey/valkey:9.1.0-alpine`을 포함해 앱이 같은 Compose 네트워크에서 두 서비스를 사용하게 한다.

## 동작

- PostgreSQL 관리자 계정은 컨테이너 초기화에 사용하고, 일회성 `db-provision` 서비스가 기존 프로비저닝 스크립트로 앱 전용 역할과 DB를 준비한다.
- 앱 서비스 식별자는 프로젝트 디렉터리·패키지 이름과 맞춰 `client`와 `server`로 사용한다. 어드민 서비스는 `admin`이다.
- `server`는 DB 준비 완료와 Valkey healthcheck 통과 후 시작한다. 스키마 마이그레이션은 기존처럼 별도 명령으로 실행한다.
- PostgreSQL 18은 `/var/lib/postgresql`, Valkey는 AOF와 `/data`를 named volume에 저장한다. 두 저장소 포트는 호스트에 공개하지 않는다.
- 관리자 자격 증명은 `db-provision`에만 전달한다. DB URL은 Compose 서비스 주소와 URL에 안전한 hex 비밀번호로 구성한다.

## 범위

Compose, 환경 변수 예시, 배포 가이드, 설계·구현 계획 문서를 갱신한다. 컨테이너는 이 변경 과정에서 시작하지 않는다.
