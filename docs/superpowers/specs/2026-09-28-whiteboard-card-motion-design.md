# 화이트보드 카드 모션 설계

Refs: #84

## 목표

화이트보드 목록의 그리드 카드가 프로젝트 카드와 같은 방식으로 포인터에 반응하게 한다. 두 카드가 같은 목록 UI 패턴을 공유하는데 한쪽만 정지해 있어 상호작용 가능 여부가 다르게 읽힌다.

## 현재 상태

- `features/project/ui/ProjectCard.tsx`: `motion.article`에 `whileHover={{ y: -2 }}`, `whileTap={{ scale: 0.99 }}`, `transition={{ type: 'tween', duration: 0.16, ease: 'easeOut' }}`, `useReducedMotion` 분기, `transition-shadow duration-150 hover:shadow-md motion-reduce:transition-none`.
- `shared/ui/whiteboard-card.tsx`: 루트가 평범한 `div`이며 모션과 hover shadow가 없다.
- 두 카드 모두 `features/whiteboard-document/ui/WhiteboardDocumentListContent.tsx`와 `features/project/ui/ProjectListContent.tsx`의 그리드 뷰에서 같은 자리를 차지한다.

## 확정된 동작

- `shared/lib/hooks`에 `useCardMotion()`을 추가한다. `useReducedMotion()`을 읽어 `whileHover`, `whileTap`, `transition`을 담은 객체를 돌려주고, 모션 감소 설정에서는 `whileHover`와 `whileTap`을 `undefined`로 만든다.
- `ProjectCard`와 `WhiteboardCard`가 모두 이 훅을 쓴다. 모션 값이 한 곳에만 존재하게 해서 이후 한쪽만 바뀌는 일을 막는다.
- `WhiteboardCard` 루트를 `div`에서 `motion.article`로 바꾼다. 프로젝트 카드와 같은 시맨틱을 쓰고, 현재 호출부가 `div` 전용 속성을 넘기지 않으므로 외부 계약은 유지된다. props 타입은 `React.ComponentProps<'article'>` 기준으로 맞춘다.
- hover shadow도 프로젝트 카드와 같게 `transition-shadow duration-150 hover:shadow-md motion-reduce:transition-none`을 적용한다.
- 카드 상단 프리뷰 영역의 점 패턴 배경, 오버플로 처리(`overflow-hidden`), 메뉴 버튼과 제목 버튼의 클릭·포커스 동작은 그대로 둔다.

## 범위

- 신규: `frontend/src/shared/lib/hooks/use-card-motion.ts`
- 수정: `frontend/src/shared/ui/whiteboard-card.tsx`, `frontend/src/features/project/ui/ProjectCard.tsx`
- 수정: `frontend/src/shared/ui/whiteboard-card.test.tsx`, `whiteboard-card.stories.tsx`

## 검증 계획

- `WhiteboardCard`가 `article` 요소로 렌더되고 기존 표시 항목(제목·생성일·수정일·생성자)과 메뉴 슬롯 계약을 유지하는지 테스트한다.
- `useCardMotion`이 모션 감소 설정에서 `whileHover`·`whileTap`을 생략하는지 테스트한다.
- `ProjectCard` 기존 테스트가 그대로 통과하는지 확인한다.
- `pnpm test`, `pnpm lint`, `pnpm build`를 실행한다.
- 브라우저에서 화이트보드 그리드 hover·press와 모션 감소 설정 동작을 확인한다.

## 범위 밖

- 카드 목록의 순차 등장 애니메이션
- 테이블 뷰 행 모션
- 카드 레이아웃·간격·타이포그래피 변경
