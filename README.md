# in2white

실시간 협업 화이트보드 SaaS. 팀이 워크스페이스와 프로젝트 단위로 화이트보드 문서를 만들고, 여러 사용자가 동시에 접속해 [Excalidraw](https://github.com/excalidraw/excalidraw) 기반 캔버스를 함께 편집한다.

## 현재 상태

이 저장소는 아직 **기획/디자인 문서만 존재하는 단계**다. 애플리케이션 코드, 패키지 매니페스트, 빌드 도구는 아직 없다. 실제 구현은 아래 문서들을 기준으로 진행될 예정이다.

## 문서 구성

| 문서 | 역할 |
|---|---|
| [`PRODUCT.md`](./PRODUCT.md) | **무엇을** 만들 것인가 — 제품 목표, 사용자, 정보 구조(IA), 페이지별 요구사항과 비즈니스 룰을 정의한다. |
| [`DESIGN.md`](./DESIGN.md) | **어떻게** 보이고 동작할 것인가 — 디자인 원칙, 컴포넌트 스펙, 레이아웃 규칙을 정의한다. |
| [`tokens.json`](./tokens.json) | 색상·타이포그래피·spacing·radius 등 안정화된 디자인 값의 실제 수치. `DESIGN.md`에서 문서화한 규칙 중 재사용 가능한 값만 추출한 결과물이다. |
| [`REFERENCE-DESIGN.md`](./REFERENCE-DESIGN.md) | `DESIGN.md`가 시각적 톤/컬러 팔레트의 소스로 참조하는 원본 레퍼런스 디자인 정리. |

세 문서(`PRODUCT.md` → `DESIGN.md` → `tokens.json`)는 상위→하위 순서로 서로를 근거로 삼는다. 제품 요구사항이 바뀌면 `PRODUCT.md`부터, 시각적 규칙이 바뀌면 `DESIGN.md`부터 갱신하고, `tokens.json`은 그 결과가 값으로 안정된 뒤에만 갱신한다.

## 디자인 산출물

모든 화면/컴포넌트 목업은 Figma에서 관리한다: [in2white Design System](https://www.figma.com/design/Dimhltnal74SHy2NcLz1Lf)

## 핵심 개념

- **워크스페이스 → 프로젝트 → 화이트보드 문서** 3단 계층으로 협업 콘텐츠를 관리한다.
- 워크스페이스 소유자(Owner)가 전체 사용자 목록에서 멤버를 선택해 추가한다(이메일/링크 초대 없음).
- 화이트보드 문서는 여러 사용자가 동시 편집 가능하며, 편집 내용은 실시간으로 자동 저장된다.
- 권한 체계는 Owner/Member 2단계만 존재한다.

제품 범위와 Non-Goals에 대한 자세한 내용은 [`PRODUCT.md`](./PRODUCT.md)를 참고한다.
