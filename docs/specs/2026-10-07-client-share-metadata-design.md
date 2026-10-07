# client 공유 미리보기

- 목표: 링크 공유 시 in2white의 제목·설명·대표 이미지를 표시한다.
- 정적 `client/index.html`에 description, Open Graph, Twitter 큰 이미지 카드 메타데이터를 넣는다. JavaScript 실행이나 로그인 없이 읽을 수 있어야 한다.
- 제목은 `in2white | 실시간 협업 화이트보드`, 설명은 `아이디어를 펼치고, 팀과 함께 그려요. in2white에서 실시간으로 화이트보드를 만들고 협업하세요.`로 설정한다.
- 기존 로고와 흑백 디자인을 사용한 1200×630 PNG를 공개 정적 자산으로 제공한다. 서비스 주소는 사용자가 확인한 `https://whiteboard.in2wise.com/`, 이미지 주소는 `https://whiteboard.in2wise.com/og-image.png`를 사용한다.
- 모든 경로에 서비스 공통 미리보기를 적용한다. 비공개 프로젝트·문서 이름이나 내용은 포함하지 않는다. 기존 페이지별 브라우저 제목은 유지한다.
- 검증: 초기 HTML의 메타데이터, 절대 이미지 URL, PNG 크기, 빌드 산출물과 정적 HTTP 응답을 확인한다.
