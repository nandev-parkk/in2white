# 멤버 관리 프론트엔드 구현 계획

## 상태

2026-09-14 사용자 설계·계획 및 사용자 검색 API 추가 승인 완료. Orca Run에서 구현·독립 리뷰·검증 완료.

설계: [멤버 관리 프론트엔드 설계](../specs/2026-09-14-members-frontend-design.md)

목표는 피그마 멤버 목록·검색·페이지 이동·추가·내보내기를 실제 API에 연결하는 것이다. 사용자 검색 API 추가를 포함한 Deep / Orca 작업으로 진행한다. 현재 `feature/members`를 재사용한다. GitHub 이슈: https://github.com/nandev-parkk/in2white/issues/53. Orca Run: `run_639515da71be`. 커밋·푸시·PR은 별도 요청 시 수행한다.

## 작업 순서

- [x] 1. 사용자 설계·계획 승인 및 사용자 검색 API 포함 범위를 확인한다. 이슈를 연결하고 현재 테스트 기준선을 확인한다.
- [x] 2. 피그마 로딩·빈 검색·토스트 프레임의 design context를 추가 확인하고 기존 UI와 토큰·아이콘 크기를 대조한다.
- [x] 3. 후보 검색 API의 권한·검색·페이지·응답 필드 테스트를 먼저 작성하고 실패를 확인한 뒤 구현한다. 기존 검색 유틸리티와 페이지 검증을 재사용한다.
- [x] 4. `entities/member`의 GET/POST/DELETE 및 후보 검색 요청 함수를 타입과 함께 작성한다. 인증 헤더·쿼리·응답 처리를 테스트한다.
- [x] 5. 멤버 조회·후보 검색·추가·삭제 훅을 구현한다. 사용자/워크스페이스별 캐시 격리와 성공·중복·대상 없음에 대한 갱신을 테스트한다.
- [x] 6. 멤버 목록, 검색, 페이지 이동, 로딩·오류·빈 결과 UI를 구현한다. 소유자 버튼 표시와 날짜·페이지 보정을 테스트한다.
- [x] 7. 기존 UserPicker를 확장하고 추가·내보내기 모달을 연결한다. 키보드 조작, 비활성화, 중복 요청 차단, 실패 후 재시도와 성공 토스트를 테스트한다.
- [x] 8. 멤버 경로와 사이드바 내비게이션을 연결한다. 워크스페이스 전환과 기존 프로젝트 경로 회귀를 검증한다. 사이드바 멤버 미리보기에 실제 목록을 연결한다.
- [x] 9. 전체 검증과 직접 코드 리뷰를 수행한다. 권한 없는 후보 조회, 캐시 누출, 접근 상실, 기존 프로젝트 화면 회귀를 중점 확인한다.
- [x] 10. 아래 구현 결과에 실제 변경, 차이, 검증 명령·결과, 후속 작업을 기록한다.

## 검증 명령과 화면 확인

- frontend: `npm test`, `npm run lint`, `npm run build`
- backend: package.json에 정의된 테스트·린트·빌드 명령 확인 후 실행
- 변경 파일: 프로젝트 Prettier 설정으로 포맷 확인, `git diff --check`
- 브라우저: 1440px 데스크톱 및 390px 모바일에서 목록·검색·페이지·모달·오류와 포커스 복귀 확인
- 실데이터 검증에 필요한 로컬 서비스·테스트 계정의 가용성을 확인하고, 모의 데이터 검증과 구분해 보고

## Implementation Results

### 실제 변경

- 소유자 전용 `GET /workspaces/:workspaceId/member-candidates`와 서비스·HTTP 테스트 22개를 추가했다. 사용자 조회 전에 권한을 검사하고 공개 필드와 현재 워크스페이스의 멤버 여부만 반환한다.
- 멤버 목록·후보·추가·제거 API 타입과 React Query 훅, 사용자/워크스페이스별 캐시 격리를 추가했다.
- 피그마 목록·추가/내보내기 모달·로딩·빈 검색·토스트를 기존 UI와 토큰으로 구성했다. 검색 300ms 디바운스, 서버 페이지 처리, 한국 시간 합류일, owner 액션, 중복 제출 차단과 실패 재시도를 연결했다.
- 멤버 경로·프로젝트 경로 이동, 워크스페이스 전환 시 목록 종류 유지, 실제 사이드바 멤버 미리보기와 접근 상실 처리를 구현했다.
- UserPicker와 사이드바 초대 버튼에 키보드 조작, 실제 disabled, 포커스 복귀를 적용했다.

### 계획과 달라진 점

- 사용자 요청에 따라 Direct에서 Orca 실행으로 변경했다. 기능·권한 계약 변경은 없다.
- 기존 사이드바의 SVG 클릭 액션을 native button으로 바꿔 키보드 진입을 보장했다. 모바일 제목과 사이드바 토글 사이 여백 12px을 보완했다.
- 긴 페이지 목록은 현재 페이지 주변 최대 5개 번호를 표시해 모바일 넘침을 방지했다.
- 첫 라우트 테스트에서 lazy 페이지의 최초 Vite 변환 비용 때문에 5000ms timeout이 발생했다. HomePage 사전 로드와 렌더 전 router.load 대기로 테스트를 안정화했으며 제한 시간은 늘리지 않았다. 수정 후 단독 첫 테스트 181ms 및 전체 테스트 통과를 확인했다.

### 실행한 검증과 결과

| 수행자·경로                  | 명령                                                                                    | 결과                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 백엔드 worker / backend      | `npm test`                                                                              | 22개 파일, 269개 테스트 통과. 구현 전 신규 22개 실패 후 구현 후 통과하는 TDD 확인                                                     |
| 백엔드 worker / backend      | `npm run lint`, `npm run build`                                                         | 모두 exit 0                                                                                                                           |
| 백엔드 worker / backend      | `npx prettier --check` 변경 5개 파일                                                    | 통과                                                                                                                                  |
| coordinator / backend        | `npm test`                                                                              | 269개 통과. `/tmp/in2white-members-backend-coordinator-test.log`                                                                      |
| 백엔드 독립 리뷰 / backend   | `npm test -- --no-cache --configLoader runner --silent`, `npm run lint`, `tsc --noEmit` | 269개 통과, 린트·타입 검사 통과                                                                                                       |
| 프론트엔드 worker / frontend | `npm test`, `npm run lint`, `npm run build`                                             | 최종 36개 파일/189개 테스트 통과, 린트 오류 0·기존 경고 4, 빌드 통과                                                                  |
| 프론트엔드 worker / frontend | `npx prettier --check` 변경 파일                                                        | 통과                                                                                                                                  |
| coordinator / frontend       | `npm test`                                                                              | 초기 188개 통과/라우트 timeout 1개. 원인 수정 후 최종 189개 통과, exit 0. `/tmp/in2white-members-frontend-coordinator-final-test.log` |
| coordinator / frontend       | `npm run lint`, `npm run build`                                                         | 오류 0·기존 Fast Refresh 경고 4, 빌드 exit 0                                                                                          |
| coordinator / 루트           | `git diff --check`                                                                      | 통과                                                                                                                                  |

백엔드 기준선에서 기존 프로젝트 HTTP 테스트의 socket hang up이 1회 발생했으나 이후 worker·coordinator·독립 리뷰의 전체 검증은 모두 통과했다. 백엔드 전체 포맷 검사에는 수정하지 않은 pnpm-lock.yaml과 기존 마이그레이션 스냅샷 경고가 있으며 이번 변경 파일 포맷은 통과했다. 프론트엔드 Fast Refresh 경고는 기존 badge/button/input/toast 파일의 4건이다.

### 브라우저와 실제 API 확인

- 실제 로컬 PostgreSQL·Valkey·백엔드·프론트엔드로 로그인, 프로젝트→멤버 이동, 후보 검색, 4명 추가, 기존 멤버 비활성화, 1명 내보내기와 성공 토스트를 확인했다.
- 최종 API smoke: 멤버 GET 200/총 4명, 후보 GET 200/총 5명, 기존 멤버 4명 표시, 제거한 사용자 재선택 가능.
- 390px 모바일: scrollWidth 390, 사이드바 64, 제거 모달 358로 가로 넘침 없음. 목록·추가·내보내기·빈 결과·로딩 캡처 확인.
- 1440px 데스크톱: scrollWidth 1440, 사이드바 240, 검색 320, 목록 행 62, 추가 모달 380 측정.
- Orca의 데스크톱 캡처에 화면 일부 반복 현상이 있어 완전한 픽셀 비교에는 한계가 있다. 모바일 캡처와 데스크톱 DOM 치수·접근성 snapshot으로 검증했다.
- 증거: `/tmp/in2white-members-visual/`의 `api-smoke.json`, `desktop-metrics.json`, `list-mobile.png`, `add-mobile.png`, `remove-mobile.png`, `empty-mobile.png`, `loading-mobile.png`.
- 다페이지·권한 상실·오류의 모든 조합은 실브라우저가 아닌 자동 테스트로 검증했다. DB 쿼리 계획·대량 데이터 성능은 검증 범위 밖이다.

### 리뷰 결과

- 백엔드 독립 리뷰: Critical/Important/Minor 결함 없음. 실제 Drizzle SQL 생성·바인딩·불리언 변환 추가 검증 통과. `/tmp/in2white-members-backend-review.md`.
- 프론트엔드 독립 리뷰: Critical 0 / Important 0 / Minor 1. 관련 저장소 테스트 80개와 임시 통합 경계 테스트 8개 통과. `/tmp/in2white-members-frontend-review.md`. Minor M1은 접근 상실 및 409/404 후 최종 화면의 통합 회귀 사례를 저장소에 보존하자는 권고다. 현재 동작은 추가 통합 테스트에서 통과했고 기존 단위·라우트 테스트가 있어 필수 수정 없이 후속 개선으로 기록한다.

### 남은 후속 작업

- 기능 완료를 위해 필요한 필수 후속 작업 없음. 선택적 개선: Minor M1 통합 회귀 테스트의 저장소 편입.
- 데스크톱 전체 캡처의 Orca 반복 렌더 문제는 도구 한계로 남는다.
- 검증용 로컬 서버와 고유 테스트 데이터는 사용자 확인을 위해 유지한다. 기존 계정 비밀번호 변경은 없으며 인증정보는 문서·로그에 기록하지 않았다.
- commit·push·PR·merge·배포는 실행하지 않았다.

## Orca 실행과 충돌 검토

- 설치된 Orca 1.4.200에는 `orca run`이 없으며 `orca orchestration run-create` + `worker-start`를 사용한다.
- 현재 세션만 coordinator를 맡고 Orca Run에서 백엔드·프론트엔드 worker를 감독한다. SDD coordinator를 병행하지 않는다.
- 백엔드 worker는 backend만, 프론트엔드 worker는 frontend만 수정한다. 설계·계획·이슈와 결과 취합은 coordinator가 소유한다.
- worker는 승인된 설계와 계획을 재사용한다. 추가 설계 승인이나 이슈를 중복 생성하지 않는다.
- worker에 TDD, 리뷰·검증 증거 제출, 자동 commit/push/PR/merge/배포 금지를 명시한다. 완료 후 직접 통합 확인 및 리뷰 worker 검증을 거친다.
- 사용자 요청에 따라 실행 모드만 Direct에서 Orca로 변경했으며 공개 기능 계약은 동일하다.

## Orca 실행 결과

| Task                                     | Dispatch           | 결과                                                 |
| ---------------------------------------- | ------------------ | ---------------------------------------------------- |
| 백엔드 구현 `task_7e793deb9ee9`          | `ctx_ec262e3deb85` | succeeded, 269개 테스트·린트·빌드 통과               |
| 프론트엔드 구현 `task_c6367e8d4d44`      | `ctx_a587aa7dd71b` | succeeded, 189개 테스트·빌드 및 실제 API·모바일 검증 |
| 백엔드 독립 리뷰 `task_4eacbb595a06`     | `ctx_cece930fe733` | succeeded, 결함 없음                                 |
| 프론트엔드 독립 리뷰 `task_be17eb35d163` | `ctx_7f375564464a` | succeeded, 필수 수정 없음·Minor 1건                  |

모든 worker_done을 해당 Task/Dispatch와 대조해 수신했고 결과 보관 후 worker-release를 완료했다. 실행 모드 충돌 없이 하나의 coordinator와 기존 작업 공간·설계·계획·이슈를 사용했다.
