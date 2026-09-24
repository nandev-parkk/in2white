# UI Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프로젝트 카드, 공통 모달, 협업 아바타에 짧고 접근성 있는 모션을 적용한다.

**Architecture:** 프로젝트 카드와 참여자 아바타는 설치된 `motion/react`의 Motion 컴포넌트를 사용한다. 공통 Radix 대화상자는 설치된 `tw-animate-css` state 유틸리티를 사용해 열기·닫기 애니메이션을 제공하며 기존 포커스 관리 구조를 유지한다.

**Tech Stack:** React 19, TypeScript, Motion 13, Tailwind CSS 4, Radix UI, tw-animate-css.

**Spec:** `docs/superpowers/specs/2026-09-24-ui-motion-design.md`

## 전역 제약

- 새 런타임 의존성을 추가하지 않는다.
- 모션 감소 설정을 따른다.
- 모달의 Radix 포커스·키보드 동작을 유지한다.
- 캔버스 도형과 서버 동기화 값에는 애니메이션을 적용하지 않는다.
- 기존 참여자 아바타의 접근성 이름, 겹침, 오른쪽 여백을 보존한다.

## 검토 초점

- 모션 감소가 켜져도 hover/press 이동·축소가 적용되지 않는다.
- 초기 참여자 목록에는 나타남 애니메이션이 재생되지 않는다.
- 참여자가 나간 뒤 아바타가 DOM에 남지 않고 `+N` 숫자가 최신 목록과 맞는다.
- 모달 닫기 애니메이션 중 Radix 포커스 트랩과 포커스 복귀가 유지된다.
- 카드를 누르는 동안 메뉴와 문서 열기 동작이 정상적으로 동작한다.

---

### Task 1: 프로젝트 카드 반응

**Files:**
- Modify: `frontend/src/features/project/ui/ProjectCard.tsx`
- Modify: `frontend/src/features/project/ui/ProjectCard.test.tsx`

**Interfaces:**
- 기존 `ProjectCardProps`와 카드 이벤트 계약을 유지한다.
- `motion/react`에서 `motion`과 `useReducedMotion`을 가져온다.

- [x] 카드 `<article>`을 `motion.article`로 바꾸고 hover 때 `y: -2`, press 때 `scale: 0.99`를 각각 짧은 ease-out 전환으로 적용한다.
- [x] `useReducedMotion()`이 참이면 위치·크기 애니메이션 속성을 적용하지 않는다.
- [x] 테스트에서 카드의 제목 버튼·프로젝트 메뉴와 접근성 구조가 Motion 적용 뒤 유지되는지 확인한다.

### Task 2: Radix 모달 상태 전환

**Files:**
- Modify: `frontend/src/shared/ui/dialog.tsx`
- Create: `frontend/src/shared/ui/dialog.test.tsx`

**Interfaces:**
- 공개 Dialog wrapper와 기존 props 타입을 유지한다.

- [x] `DialogOverlay`에 `data-state=open/closed` 페이드 유틸리티를 추가한다.
- [x] `DialogContent`에 열림 페이드·zoom-in과 닫힘 페이드·zoom-out state 유틸리티를 추가한다.
- [x] 150–200ms로 제한하고 `motion-reduce:animate-none`을 추가한다.
- [x] Radix `Portal`, `Overlay`, `Content` 구조와 focus scope는 변경하지 않는다.
- [x] 컴포넌트 테스트로 대화상자 역할과 Escape 닫기·호출자 포커스 복귀를 확인한다.

### Task 3: 참여자 추가·삭제 모션

**Files:**
- Modify: `frontend/src/shared/ui/presence-avatar-stack.tsx`
- Create: `frontend/src/shared/ui/presence-avatar-stack.test.tsx`

**Interfaces:**
- `PresenceAvatarStack`의 props, `PresenceUser`, 표시 인원 제한을 유지한다.

- [x] 기존 `Avatar`를 Motion wrapper로 감싼다.
- [x] `AnimatePresence initial={false}`와 사용자 id key를 사용해 새 참여자의 짧은 opacity/scale 입장과 퇴장을 적용한다.
- [x] 남아 있는 참여자는 `layout="position"`으로 위치만 보정하고, 모션 감소 설정에서는 opacity 외 변형을 생략한다.
- [x] 겹침 순서, `+N`, 마지막 아바타 여백, 이름 기반 접근성 라벨을 유지한다.
- [x] 테스트에서 사용자 목록 변경 뒤 퇴장 중 아바타와 최종 제거 동작을 확인한다.

### Task 4: 수동 확인과 기록

**Files:**
- Modify: `docs/superpowers/plans/2026-09-24-ui-motion-implementation-plan.md`

- [x] 관련 테스트 4개 파일·6개 테스트를 통과시킨다. 전체 suite에서 기존 메뉴 테스트 실패 4개를 확인해 기록한다.
- [x] 프런트엔드 lint와 production build를 실행한다.
- [x] 브라우저에서 카드 hover, 모달 열기와 키보드 포커스 복귀, 참여자 입·퇴장을 확인한다.
- [x] 이 계획 문서에 실제 변경, 계획 차이, 실행한 검증과 결과, 남은 작업을 기록한다.

## Implementation Results

### 최종 리뷰 보완
- Tailwind v4 생성 CSS에서 `data-state` 애니메이션 선택자가 기본 모션 감소 클래스보다 우선하는 문제를 확인했다. overlay와 content를 `motion-reduce:!animate-none`으로 바꾸고 두 요소를 확인하는 회귀 테스트를 추가했다. 새 테스트는 수정 전 실패하고 수정 후 통과했다.
- 최종 검증: 전체 테스트는 380개 중 376개 통과했다. 실패한 기존 메뉴 테스트 4개는 기준 `dev`에서도 같은 테스트로 재현됐다. 관련 모션 테스트 6개, 린트(오류 0개, 기존 경고 4개), 빌드, `git diff --check`는 통과했다.
- 남은 작업: 기준 `dev`에서 재현된 메뉴 테스트 4개는 별도 작업이 필요하다.

- 실제 변경: 프로젝트 카드에 hover 2px 상승과 press 축소를 적용하고 `useReducedMotion`을 연결했다. 공통 Radix 모달 overlay/content에 열기·닫기 페이드와 zoom 애니메이션을 추가했다. 참여자 아바타에 `AnimatePresence` 입·퇴장 및 위치 전환을 추가했다.
- 계획 차이: 기존 `canvas-top-bar.test.tsx`는 참여자 삭제 즉시 DOM 제거를 기대했다. 퇴장 애니메이션 중 유지된 뒤 제거되도록 기다리게 갱신했다. API·서버 동작과 의존성 변경은 없다.
- 검증: 관련 테스트 4개 파일·6개 테스트 통과. 전체 `pnpm test`: 72개 파일 중 69개 통과, 380개 테스트 중 376개 통과. 나머지 4개는 `ProjectDetailHeader`, `ProjectListContent`, `WhiteboardDocumentListContent`의 기존 메뉴 항목 탐색 실패로, 원본 `dev`에서도 확인된 항목이다. `pnpm lint`: 오류 0개, 기존 경고 4개. `pnpm build`: 통과, 기존 번들 크기 경고. `git diff --check`: 통과.
- 실제 브라우저: 앱 서버에서 미리보기용 프로젝트를 생성했다. 카드 hover 시 계산된 transform `translateY(-2px)`를 확인했다. 수정 모달과 overlay/content에서 Radix `data-state=open`, CSS animation `enter`를 확인했으며 Escape 테스트에서 포커스가 트리거로 돌아왔다.
- 남은 확인: 운영체제의 모션 감소 설정을 켠 브라우저에서 별도 시각 확인은 하지 않았다. 관련 훅과 Tailwind 감소 설정은 적용했다.
- 미리보기: `http://localhost:5173/workspaces/7174e1d7-8805-4385-8f1e-c82fef8a063f/projects`. 프런트엔드는 이 worktree에서 실행 중이며, 로컬 미리보기 프로젝트 `모션 미리보기`와 편집 모달을 열어 둔 상태다. 백엔드 health는 HTTP 200.
