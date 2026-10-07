# client 공유 미리보기 구현 계획

1. `feat/client-share-metadata`에서 기존 HTML·브랜드 자산·정적 배포 구성을 확인한다.
2. 초기 HTML과 대표 이미지의 공유 계약 테스트를 작성하고 실패를 확인한다.
3. 메타데이터와 대표 이미지를 추가한다. 실제 서비스 URL 확인 후 절대 주소를 연결한다.
4. 관련 테스트, lint, build, 포맷과 빌드 산출물 HTTP 응답을 검증한다.

## 실제 변경·계획 차이

- `client/index.html`에 한국어 문서 언어, description, Open Graph, Twitter 큰 이미지 카드 메타데이터를 추가했다. 초기 브라우저 제목과 페이지별 제목 훅은 유지했다.
- 사용자가 확인한 `https://whiteboard.in2wise.com/`과 `/og-image.png` 절대 주소를 적용했다.
- 기존 `logo.png`와 흑백 스타일을 재사용해 1200×630 PNG(약 170 KB)를 만들었다. 편집 가능한 HTML 원본은 `docs/assets/client-share-card.html`에 보관했다. 새 의존성은 없다.
- 계획대로 서비스 공통 미리보기를 제공한다. 권한·API·데이터 모델 변경은 없다.

## 검증 결과·후속 작업

- TDD: 테스트가 기존 `lang="en"`에서 실패함을 확인한 뒤 구현했다.
- `pnpm --filter in2white-client test src/share-metadata.test.ts`: 1개 통과. 초기 HTML 메타데이터·절대 URL·이미지 형식·PNG 실제 크기를 검증했다.
- `pnpm --filter in2white-client lint`: 통과.
- `pnpm --filter in2white-client build`: 통과. 기존 대형 청크 경고가 있다.
- Vite preview에서 Python 표준 라이브러리로 `/`, `/login`, `/workspaces/share-preview-check` 초기 HTTP 응답의 메타데이터와 `/og-image.png`의 200 응답·Content-Type·크기·원본 일치를 검증했다.
- 대표 이미지 시각 확인 완료. 변경 파일 Prettier 검사와 `git diff --check` 통과.
- 배포는 수행하지 않았다. 실제 공유 서비스의 카드 표시는 배포 후 확인해야 하며, 기존 공유 캐시가 있으면 갱신이 필요할 수 있다.

## 이미지 재생성

저장소 루트에서 아래 명령을 실행한다. 원본 HTML은 macOS의 `Apple SD Gothic Neo`를 우선 사용하므로 같은 폰트 환경에서 재생성한다.

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1200,630 --screenshot="$PWD/client/public/og-image.png" \
  "file://$PWD/docs/assets/client-share-card.html"
```
