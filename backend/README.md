# in2white backend

Express + TypeScript(ESM) + MVC 패턴 기반 백엔드. 자세한 설계 배경은
[`../docs/superpowers/specs/2026-09-05-backend-scaffolding-design.md`](../docs/superpowers/specs/2026-09-05-backend-scaffolding-design.md)를 참고한다.

## 요구 사항

- Node.js >= 20
- pnpm

## 시작하기

```bash
cd backend
pnpm install
cp .env.example .env   # 값을 환경에 맞게 수정
pnpm dev
```

`GET http://localhost:4000/health`로 서버가 떠 있는지 확인할 수 있다.

## 스크립트

| 명령                        | 설명                                                                          |
| --------------------------- | ----------------------------------------------------------------------------- |
| `pnpm dev`                  | 개발 서버 실행 (파일 변경 시 자동 재시작)                                     |
| `pnpm build`                | `dist/`로 프로덕션 빌드 (경로 alias는 `tsc-alias`가 상대경로+확장자로 재작성) |
| `pnpm start`                | 빌드된 `dist/server.js` 실행                                                  |
| `pnpm lint` / `pnpm format` | ESLint 검사 / Prettier 포맷팅                                                 |
| `pnpm test`                 | vitest 테스트 실행                                                            |
| `pnpm db:generate`          | drizzle 스키마로부터 마이그레이션 SQL 생성                                    |
| `pnpm db:migrate`           | 생성된 마이그레이션을 DB에 적용                                               |
| `pnpm db:studio`            | drizzle-kit studio 실행                                                       |

## 폴더 구조

`routes` → `controllers` → `services` → `db/schema`로 이어지는 계층형 MVC 구조를 따른다. 새 도메인 기능을 추가할 때도 이 계층 구조를 그대로 따라 파일을 추가한다.

## 범위

이 프로젝트는 현재 기술 기반(스캐폴딩) 단계다. 로그인, Workspace/Project/Whiteboard Document CRUD, 실시간 협업 등 실제 도메인 기능은 아직 구현되어 있지 않다.
