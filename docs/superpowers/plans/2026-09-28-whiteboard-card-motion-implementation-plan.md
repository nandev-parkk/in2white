# 화이트보드 카드 모션 구현 계획

Refs: #84
설계: `docs/superpowers/specs/2026-09-28-whiteboard-card-motion-design.md`

## 목표

화이트보드 카드에 프로젝트 카드와 동일한 hover·press 모션과 hover shadow를 적용하고, 모션 값을 공용 훅으로 모아 두 카드가 갈라지지 않게 한다.

## 작업 단계

### 1. `useCardMotion` 훅 (TDD)

1. `shared/lib/hooks/use-card-motion.test.ts`를 먼저 작성해 실패를 확인한다.
   - 기본 상태에서 `whileHover.y === -2`, `whileTap.scale === 0.99`, `transition`이 `tween` 160ms `easeOut`이다.
   - `useReducedMotion`이 `true`면 `whileHover`와 `whileTap`이 `undefined`다.
2. `shared/lib/hooks/use-card-motion.ts`를 구현한다. `motion/react`의 `useReducedMotion`을 읽어 모션 props 객체를 반환한다.

### 2. `WhiteboardCard`에 적용 (TDD)

3. `shared/ui/whiteboard-card.test.tsx`를 갱신해 실패를 확인한다.
   - 루트가 `article` 요소다.
   - 기존 표시 항목(제목·생성일·수정일·생성자)과 `menu` 슬롯 계약이 유지된다.
   - `onOpen`을 주면 제목이 버튼으로 렌더되고 클릭 시 호출된다.
4. `shared/ui/whiteboard-card.tsx`를 수정한다.
   - 루트를 `motion.article`로 바꾸고 `useCardMotion()` 결과를 펼친다.
   - props 타입을 `React.ComponentProps<'article'>` 기준으로 맞춘다.
   - `transition-shadow duration-150 hover:shadow-md motion-reduce:transition-none`을 className에 더한다.
   - 프리뷰 영역의 점 패턴 배경과 `overflow-hidden`은 유지한다.
5. `shared/ui/whiteboard-card.stories.tsx`가 새 타입에서 깨지지 않는지 확인하고 필요하면 갱신한다.

### 3. `ProjectCard` 리팩터링

6. `features/project/ui/ProjectCard.tsx`의 인라인 모션 값을 `useCardMotion()`으로 교체한다. 렌더 결과는 동일해야 하며 기존 테스트가 수정 없이 통과해야 한다.

### 4. 검증

7. `pnpm test`로 전체 테스트를 실행한다.
8. `pnpm lint`, `pnpm build`를 실행한다.
9. 브라우저에서 화이트보드 그리드 카드 hover·press를 확인하고, OS 모션 감소 설정에서 이동·축소가 생략되는지 확인한다.

## 주요 동작

- 화이트보드 카드: hover 시 2px 상승 + shadow, press 시 0.99 축소, 160ms ease-out.
- 모션 감소 설정: 이동·축소·shadow 트랜지션 모두 생략.

## 변경 범위

- 신규: `frontend/src/shared/lib/hooks/use-card-motion.ts`, `use-card-motion.test.ts`
- 수정: `frontend/src/shared/ui/whiteboard-card.tsx`, `whiteboard-card.test.tsx`, `whiteboard-card.stories.tsx`
- 수정: `frontend/src/features/project/ui/ProjectCard.tsx`

## 검증 계획

- `useCardMotion` 단위 테스트 2건
- `WhiteboardCard` 회귀 테스트 갱신, `ProjectCard` 기존 테스트 무수정 통과
- `pnpm test` / `pnpm lint` / `pnpm build`
- 브라우저 hover·press 및 모션 감소 설정 확인

## Implementation Results

### 실제 변경 내용

- 신규 `frontend/src/shared/lib/hooks/use-card-motion.ts`: `useReducedMotion()`을 읽어 `whileHover: { y: -2 }`, `whileTap: { scale: 0.99 }`, `transition: { type: 'tween', duration: 0.16, ease: 'easeOut' }`를 담은 `CardMotionProps`를 반환한다. 모션 감소 설정에서는 `whileHover`·`whileTap`을 `undefined`로 만들고 `transition`은 유지한다.
- 신규 `frontend/src/shared/lib/hooks/use-card-motion.test.ts`: `vi.mock('motion/react')`으로 `useReducedMotion`을 대체해 기본 모션 값과 모션 감소 분기를 각각 검증한다(2건).
- 수정 `frontend/src/shared/ui/whiteboard-card.tsx`: 루트를 `div` → `motion.article`로 바꾸고 `useCardMotion()` 결과를 펼쳤다. className에 `transition-shadow duration-150 hover:shadow-md motion-reduce:transition-none`을 더했다. 프리뷰 점 패턴, `overflow-hidden`, 메뉴 슬롯 위치, 메타데이터 행, 구분선, 생성자 아바타 행은 그대로 유지했다.
- 수정 `frontend/src/shared/ui/whiteboard-card.test.tsx`: 루트가 `article`로 렌더되는지, `onOpen`을 주면 제목이 버튼으로 렌더되고 클릭 시 호출되는지를 추가했다(3건 → 5건). `renderCard` 헬퍼를 props 오버라이드 방식으로 바꿨다.
- 수정 `frontend/src/features/project/ui/ProjectCard.tsx`: 인라인 `useReducedMotion`/`whileHover`/`whileTap`/`transition`을 `useCardMotion()` 스프레드로 교체했다. 렌더 결과는 동일하다.

### 계획과 달라진 점

- `WhiteboardCardProps`의 기준 타입을 `React.ComponentProps<'article'>` 그대로 쓰지 못하고 `Omit<React.ComponentProps<'article'>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd'>`로 좁혔다. 이 다섯 핸들러는 `HTMLMotionProps<'article'>`에서 motion 전용 시그니처로 재정의되어 있어 `{...props}`를 `motion.article`에 펼칠 때 `TS2322`가 발생한다. 현재 호출부가 쓰지 않는 핸들러만 제외했으므로 외부 계약 변화는 없다.
- `frontend/src/shared/lib/hooks/`는 `.gitkeep`만 있는 빈 디렉터리였다. 파일명·export 규칙은 기존 `src/shared/hooks/use-scroll-active-item.ts`(kebab-case 파일명, named `export function`)를 따랐다.
- `whiteboard-card.stories.tsx`는 새 props 타입에서 타입 오류가 없어 수정하지 않았다.
- `WhiteboardDocumentListContent.tsx`도 선언된 props만 넘기고 있어 수정하지 않았다.
- 브라우저 수동 확인(hover·press, OS 모션 감소 설정)은 이 작업에서 실행하지 않았다.

### 실행한 검증 명령과 결과

`frontend` 디렉터리에서 실행했다.

- `pnpm test` → exit 0, 77개 테스트 파일 / 416개 테스트 전부 통과.
- `pnpm lint` → exit 0. `badge.tsx`, `button.tsx`, `input.tsx`, `toast.tsx`의 `react-refresh/only-export-components` 경고 4건은 이번 변경과 무관한 기존 경고다.
- `pnpm build` (`vite build && tsc -b`) → exit 0. 500kB 초과 청크 경고는 기존 경고다.
- `pnpm exec prettier --check` (변경 파일 5개) → exit 0.
- `ProjectCard.test.tsx`는 수정하지 않았고 hover 시 `translateY(-2px)` 검증을 포함해 그대로 통과했다.

### 남은 후속 작업

- 브라우저에서 화이트보드 그리드 카드 hover·press 동작과 OS 모션 감소 설정에서 이동·축소가 생략되는지 확인한다.
- `src/shared/hooks/`와 `src/shared/lib/hooks/`로 공용 훅 위치가 두 곳으로 나뉘어 있다. 별도 작업에서 한쪽으로 모으는 것을 검토한다.
