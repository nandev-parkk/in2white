# in2white client

in2white 프론트엔드. Vite + React + TypeScript, FSD(Feature-Sliced Design) 구조.

## 스택

- 빌드: Vite
- 언어: TypeScript
- 라우팅: TanStack Router (파일 기반, `src/routes/`는 `pages/`로의 얇은 매핑만 담당)
- 페칭/서버 상태: axios, TanStack Query
- 클라이언트 상태: zustand
- 폼/검증: react-hook-form, zod, @hookform/resolvers
- 테이블: TanStack Table
- 스타일: Tailwind CSS v4, shadcn/ui(Radix UI 기반)
- 테스트: vitest, @testing-library/react

## 폴더 구조 (FSD)

```
src/
├─ app/       # 앱 초기화 — providers, router 인스턴스, 전역 스타일
├─ routes/    # TanStack Router 라우트 정의 (pages를 연결만 함)
├─ pages/     # 라우트 단위 페이지
├─ widgets/   # 여러 feature/entity를 조합한 독립 UI 블록
├─ features/  # 사용자 상호작용 단위 기능
├─ entities/  # 비즈니스 엔티티
└─ shared/    # 공용 UI(shadcn), api 클라이언트, config, lib, types
```

## 스크립트

```bash
pnpm dev            # 개발 서버
pnpm build          # 타입체크 + 프로덕션 빌드
pnpm preview         # 빌드 결과 미리보기
pnpm lint            # eslint
pnpm lint:fix        # eslint --fix
pnpm format          # prettier --write
pnpm format:check    # prettier --check
pnpm test            # vitest run
pnpm test:watch      # vitest (watch)
```

## Storybook

브라우저에서 공용 UI 컴포넌트를 확인하려면 다음 명령을 실행합니다.

```bash
pnpm storybook
```

정적 Storybook 빌드를 생성하려면 다음 명령을 실행합니다.

```bash
pnpm build-storybook
```

## 환경 변수

`.env`에 다음 값을 설정:

```
VITE_API_BASE_URL=http://localhost:4000
```

## Git hooks

커밋 전 `eslint --fix` + `prettier --write`가 staged 파일에 자동 실행됨(lint-staged).
저장소 루트에 `.husky/`가 있으며, `pnpm install` 시 루트 `prepare` 스크립트가 Git hook 경로를 설정한다.
