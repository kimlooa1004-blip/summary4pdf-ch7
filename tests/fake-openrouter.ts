// 가짜 OpenRouter 서버. 미리 정해 둔 응답을 호출 순서대로 돌려준다.
// 실제 모델을 부르지 않고 폴백·제한시간·형식 오류를 시험하기 위한 것이다.

import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

export type 준비응답 = {
  상태: number;
  본문: string;
  /** 응답을 늦춰 제한시간을 시험할 때 쓴다 (밀리초) */
  지연?: number;
};

export type 가짜서버손잡이 = {
  주소: string;
  호출수: () => number;
  끝: () => Promise<void>;
};

export async function 가짜서버(
  응답들: 준비응답[],
): Promise<가짜서버손잡이> {
  let 호출 = 0;

  const 서버: Server = createServer((요청, 응답) => {
    const 차례 = 호출;
    호출 += 1;
    const 준비 = 응답들[차례];

    // 요청 본문을 다 받아야 클라이언트가 멈추지 않는다.
    요청.resume();

    const 내보내기 = () => {
      if (!준비) {
        응답.writeHead(500, { "Content-Type": "text/plain" });
        응답.end("준비된 응답이 없습니다");
        return;
      }
      응답.writeHead(준비.상태, { "Content-Type": "application/json" });
      응답.end(준비.본문);
    };

    if (준비?.지연) setTimeout(내보내기, 준비.지연);
    else 내보내기();
  });

  await new Promise<void>((풀기) => 서버.listen(0, "127.0.0.1", 풀기));
  const { port } = 서버.address() as AddressInfo;

  return {
    주소: `http://127.0.0.1:${port}/chat/completions`,
    호출수: () => 호출,
    끝: () =>
      new Promise<void>((풀기) => {
        서버.closeAllConnections?.();
        서버.close(() => 풀기());
      }),
  };
}
