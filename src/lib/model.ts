// OpenRouter를 불러 요약을 받아온다.
//
// 1차 모델이 어떤 이유로 실패하든 — HTTP 오류, 시간 초과, 빈 응답, 형식 오류 —
// 폴백 모델로 딱 한 번 더 시도한다. 둘 다 실패하면 무엇이 어떻게 실패했는지를
// 그대로 돌려준다. 빈 요약을 성공처럼 내보내지 않는다.
//
// 키는 Authorization 헤더로만 나간다. 어디에도 찍지 않는다.

import type { 설정 } from "./config";
import { 요약파싱, type 요약 } from "./validate";

const 기본주소 = "https://openrouter.ai/api/v1/chat/completions";

export type 시도 = { 모델: string; 결과: string };

export type 호출결과 =
  | { 성공: true; 요약: 요약; 쓴모델: string }
  | { 성공: false; 시도기록: 시도[] };

const 지시문 = [
  "너는 한국어로 문서를 요약하는 도우미다.",
  "아래 문서를 읽고 JSON 하나만 내놓아라. 설명도 인사도 붙이지 마라.",
  "",
  "형식:",
  "{",
  '  "한줄요약": "문서 전체를 한 문장으로",',
  '  "핵심개념": [{"이름": "...", "설명": "..."}],',
  '  "정의된용어": [{"용어": "...", "뜻": "..."}],',
  '  "정의된수식": [{"수식": "...", "뜻": "..."}]',
  "}",
  "",
  "규칙:",
  "- 핵심개념은 3개에서 5개 사이로 고른다.",
  "- 정의된용어와 정의된수식에는 문서가 **직접 정의한** 것만 담는다.",
  "  문서에 정의가 없으면 빈 배열([])로 둔다. 지어내지 마라.",
  "- 모든 값은 한국어로 쓴다.",
].join("\n");

/** 모델을 한 번 부른다. 실패하면 사람이 읽을 수 있는 까닭을 던진다. */
async function 한번부르기(
  모델: string,
  글: string,
  키: string,
  제한시간: number,
  주소: string,
): Promise<요약> {
  let 응답: Response;
  try {
    응답 = await fetch(주소, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${키}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: 모델,
        messages: [
          { role: "system", content: 지시문 },
          { role: "user", content: 글 },
        ],
      }),
      signal: AbortSignal.timeout(제한시간),
    });
  } catch (오류) {
    const 이름 = (오류 as { name?: string })?.name;
    if (이름 === "TimeoutError" || 이름 === "AbortError") {
      throw new Error(`시간 초과(${Math.round(제한시간 / 1000)}초)`);
    }
    throw new Error("연결 실패");
  }

  if (!응답.ok) throw new Error(`HTTP ${응답.status}`);

  let 본문: unknown;
  try {
    본문 = await 응답.json();
  } catch {
    throw new Error("응답 형식 오류");
  }

  const 내용 = (본문 as { choices?: { message?: { content?: unknown } }[] })
    ?.choices?.[0]?.message?.content;

  if (typeof 내용 !== "string" || 내용.trim().length === 0) {
    throw new Error("빈 응답");
  }

  try {
    return 요약파싱(내용);
  } catch {
    throw new Error("응답 형식 오류");
  }
}

export async function 요약하기(
  글: string,
  설정값: 설정,
  주소: string = 기본주소,
): Promise<호출결과> {
  const 차례: { 모델: string; 제한시간: number }[] = [
    { 모델: 설정값.모델, 제한시간: 설정값.제한시간 },
  ];
  // 폴백이 설정돼 있을 때만 두 번째 시도를 준비한다.
  if (설정값.폴백모델) {
    차례.push({ 모델: 설정값.폴백모델, 제한시간: 설정값.폴백제한시간 });
  }

  const 시도기록: 시도[] = [];

  for (const { 모델, 제한시간 } of 차례) {
    try {
      const 요약 = await 한번부르기(모델, 글, 설정값.키, 제한시간, 주소);
      console.log(`[summarize] 성공 모델=${모델} 시도=${시도기록.length + 1}`);
      return { 성공: true, 요약, 쓴모델: 모델 };
    } catch (오류) {
      const 까닭 = (오류 as Error).message;
      시도기록.push({ 모델, 결과: 까닭 });
      console.log(`[summarize] 실패 모델=${모델} 까닭=${까닭}`);
    }
  }

  return { 성공: false, 시도기록 };
}
