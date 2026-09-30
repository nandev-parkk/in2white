import http from "node:http";
import https from "node:https";

/*
 * Node 19부터 globalAgent가 keep-alive를 기본으로 켠다. supertest는 테스트마다
 * 서버를 새로 띄우고 닫으므로, 살아남은 소켓이 재사용되면 앞선 요청의 응답을
 * 다음 요청이 읽어 테스트가 산발적으로 다른 상태 코드를 받는다.
 */
http.globalAgent = new http.Agent({ keepAlive: false });
https.globalAgent = new https.Agent({ keepAlive: false });
