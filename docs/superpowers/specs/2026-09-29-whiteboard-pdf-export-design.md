# 화이트보드 PDF 내보내기 — 설계

- 날짜: 2026-09-29
- 관련: 없음 (이슈 미발행)

## 배경

편집기는 이미 장면을 꺼내는 수단을 하나 가지고 있다. `WhiteboardCanvas.tsx`의
`exportScene()`이 상단바 "더 보기" 드롭다운에서 `.excalidraw` JSON을 내려받는다.
이 경로는 두 가지 목적을 겸한다. 다른 도구로 장면을 옮기는 것, 그리고 동기화가
끊겼을 때 미저장 변경을 손에 쥐는 것이다.

하지만 JSON은 사람이 보는 형식이 아니다. 회의록에 붙이거나 인쇄해서 공유하려면
Excalidraw를 열 수 없는 사람도 열 수 있는 형식이 필요하다. PDF가 그 자리를 채운다.

Excalidraw는 PNG·SVG 내보내기만 제공하고 PDF는 제공하지 않는다. 백엔드에도
렌더링 경로가 없다. 그래서 클라이언트에서 만든다.

## 목표

- 편집 중인 화이트보드를 PDF 한 장으로 내려받는다.
- 화면에서 보던 그림이 잘리거나 여백 없이 그대로 나온다.
- 동기화가 끊긴 상태에서도 내보낼 수 있다.
- 기존 `.excalidraw` 내보내기의 동작을 바꾸지 않는다.

## 비목표

- 여러 페이지 분할, A4 등 인쇄 규격 맞춤. 첫 판에서는 그림 크기 그대로 한 장만 만든다.
- 선택 요소만 내보내기, 프레임 단위 내보내기.
- 서버측 PDF 생성, 예약 내보내기.
- 벡터 PDF. 한글·손글씨 폰트 임베딩 위험을 지금 감수할 이유가 없다.

## 결정

### 페이지 구성: 그림 크기에 맞춘 1페이지

`exportToCanvas`가 돌려준 캔버스의 픽셀 크기를 그대로 PDF 페이지 크기로 쓴다
(`unit: 'px'`, `format: [width, height]`). 이미지를 페이지 전체에 채우므로 축소·여백·
잘림이 모두 사라지고 비율이 1:1로 유지된다.

A4 맞춤을 고르지 않은 이유: 화이트보드는 세로로 긴 회고 보드부터 가로로 넓은
플로우 차트까지 종횡비가 제각각이다. 고정 규격에 밀어 넣으면 대부분의 보드에서
글씨가 읽을 수 없이 작아지거나 큰 여백이 남는다. 인쇄가 필요하면 PDF 뷰어의
"용지에 맞춤"이 이미 그 일을 한다.

### 생성 방식: jsPDF + PNG

`exportToCanvas` → `canvas.toDataURL('image/png')` → jsPDF `addImage`.

| 후보 | 채택 | 이유 |
| --- | --- | --- |
| jsPDF + PNG | ✅ | 검증된 라이브러리, 코드 20줄 수준, 렌더 결과가 화면과 동일 |
| 의존성 없이 PDF 바이트 직접 작성 | ❌ | 번들은 아끼지만 PDF 스펙 코드를 직접 유지보수해야 한다 |
| jsPDF + svg2pdf.js 벡터 | ❌ | 한글·손글씨 폰트 임베딩에서 깨질 위험. 의존성 2개 |

jsPDF는 `await import('jspdf')`로 지연 로딩한다. 편집기 진입 시점의 번들에는
들어가지 않고, 사용자가 메뉴를 누른 뒤에만 내려온다.

### 렌더 옵션

```ts
exportToCanvas({
  elements,
  files,
  appState: {
    exportBackground: true,
    viewBackgroundColor: '#ffffff',
    exportWithDarkMode: false,
  },
  exportPadding: 16,
  maxWidthOrHeight: 4096,
})
```

- **흰 배경 고정**: 다크 테마로 작업하던 중에 내보내도 인쇄·공유에 쓸 수 있는 문서가
  나온다. 화면 테마를 따라가면 어두운 배경이 그대로 박힌 PDF가 만들어진다.
- **`maxWidthOrHeight: 4096`**: 캔버스 크기 상한이 없으면 아주 넓은 보드에서
  브라우저 캔버스 한계에 부딪히거나 수십 MB짜리 PNG가 만들어진다.
- **`exportPadding: 16`**: 그림이 종이 가장자리에 붙지 않게 하는 최소 여백.

## 모듈 경계

`exportScene()`은 지금 `WhiteboardCanvas.tsx` 안에 인라인으로 있다. 여기에 PDF 경로를
더하면 렌더링 컴포넌트가 파일 생성 책임까지 떠안는다. 내보내기 로직을 모델로 뺀다.

```
features/whiteboard-editor/model/export-scene.ts   (신규)
  downloadSceneFile(scene, name)   ← WhiteboardCanvas에서 이동
  downloadScenePdf(scene, name)    ← 신규
```

계약:

| 함수 | 입력 | 동작 | 실패 |
| --- | --- | --- | --- |
| `downloadSceneFile` | `{ elements, files }`, 문서 이름 | `.excalidraw` 다운로드 | 없음 (동기) |
| `downloadScenePdf` | `{ elements, files }`, 문서 이름 | `.pdf` 다운로드, Promise | `throw` — 호출부가 토스트 |

두 함수 모두 Excalidraw 인스턴스가 아니라 평범한 장면 객체를 받는다. 덕분에 모델
테스트가 컴포넌트 렌더링 없이 돈다.

파일명 sanitize 규칙(`/[\\/:*?"<>|]/g` → `_`)은 두 함수가 공유한다.

## 동작

1. 사용자가 상단바 "더 보기" → `PDF로 내려받기` 선택
2. 캔버스에서 **삭제되지 않은** 요소를 읽는다 (`api.getSceneElements()`)
3. 요소가 0개면 생성하지 않고 `내보낼 내용이 없어요` 토스트 후 중단
4. 메뉴 항목을 비활성화하고 PDF를 만든다
5. 성공: 브라우저 다운로드. 별도 성공 토스트는 없다
6. 실패: `PDF를 만들지 못했어요` 토스트

### 왜 성공 토스트가 없는가

브라우저 다운로드 표시가 이미 완료 신호다. 기존 `.excalidraw` 내보내기도 토스트를
띄우지 않는다. 같은 메뉴의 두 항목이 다르게 반응하면 그게 더 혼란스럽다.

### 권한·상태 계약

PDF 내보내기는 `viewModeEnabled`(읽기 전용)와 `disconnected` 상태에서도 허용한다.
내보내기는 읽기 동작이고, 동기화가 끊겼을 때 손에 쥔 변경을 꺼내는 것이
기존 내보내기 경로의 설계 의도였다. PDF도 같은 계약을 따른다.

## 문구

`MESSAGES.whiteboard`에 3개를 추가한다.

| 키 | 문구 |
| --- | --- |
| `action.exportPdf` | PDF로 내려받기 |
| `error.exportEmpty` | 내보낼 내용이 없어요 |
| `error.exportPdfFailed` | PDF를 만들지 못했어요 |

`error.exportEmpty`는 실패가 아니라 조건 미충족이지만, 사용자 입장에서는
"눌렀는데 아무 일도 없었다"를 막는 것이 목적이므로 같은 토스트 계열에 둔다.

## 의존성

`frontend/package.json` dependencies에 `jspdf`를 추가한다. 동적 import이므로
초기 번들 크기는 변하지 않는다.

## 검증

### `model/export-scene.test.ts` (신규)

- 요소가 없으면 PDF를 만들지 않는다
- 가로로 넓은 캔버스는 `landscape`, 세로로 긴 캔버스는 `portrait`
- 페이지 크기가 캔버스 픽셀 크기와 같다
- 파일명에서 경로 문자가 `_`로 바뀌고 `.pdf`가 붙는다
- 흰 배경·다크모드 해제 옵션이 `exportToCanvas`로 전달된다
- `.excalidraw` 내보내기가 기존과 같은 JSON을 만든다 (이동 회귀)

### `ui/WhiteboardCanvas.test.tsx` (보강)

- 메뉴에서 `PDF로 내려받기`를 고르면 `downloadScenePdf`를 호출한다
- 생성이 끝나기 전에는 항목이 비활성화돼 두 번 실행되지 않는다
- 생성 실패 시 `PDF를 만들지 못했어요` 토스트가 뜬다

### 명령

`pnpm test`, `pnpm lint`, `pnpm build`
