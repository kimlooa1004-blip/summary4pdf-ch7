// 모델이 보낸 글에서 요약 JSON을 꺼내고 스키마를 확인한다.
//
// 무료 모델은 JSON만 달라고 해도 ```json 울타리로 감싸거나, 앞뒤에 군말을 붙이거나,
// 지시문의 형식 블록을 그대로 복창한 뒤 답을 내놓는다. 그래서 후보를 여러 개 모아
// 검증을 통과하는 첫 것을 쓴다.
//
// 너그럽게 읽되 빈 요약을 성공처럼 내보내지 않는 것이 요점이다. 실패 기준은
// 사양 §5.4가 못박았다: 한줄요약이 비었거나 핵심개념이 0개일 때'만' 실패다.

export type 개념 = { 이름: string; 설명: string };
export type 용어 = { 용어: string; 뜻: string };
export type 수식 = { 수식: string; 뜻: string };

export type 요약 = {
  한줄요약: string;
  핵심개념: 개념[];
  정의된용어: 용어[];
  정의된수식: 수식[];
};

function 글자인가(값: unknown): 값 is string {
  return typeof 값 === "string";
}

/**
 * 두 칸짜리 객체 배열을 너그럽게 읽는다. **어긋난 항목만 버리고 나머지를 살린다.**
 *
 * 용어·수식 칸이 어긋났다고 멀쩡한 한줄요약과 핵심개념까지 버리면, 폴백이 비어 있는
 * 초기 상태에서 곧바로 전체 실패가 된다. 무료 모델이 이 칸들을 문자열 배열로 보내는
 * 일은 흔하다.
 */
function 짝배열읽기<키1 extends string, 키2 extends string>(
  값: unknown,
  키1: 키1,
  키2: 키2,
): Record<키1 | 키2, string>[] {
  if (!Array.isArray(값)) return [];

  const 결과: Record<키1 | 키2, string>[] = [];
  for (const 칸 of 값) {
    if (typeof 칸 !== "object" || 칸 === null) continue;
    const 그릇 = 칸 as Record<string, unknown>;
    if (!글자인가(그릇[키1]) || !글자인가(그릇[키2])) continue;
    결과.push({ [키1]: 그릇[키1], [키2]: 그릇[키2] } as Record<
      키1 | 키2,
      string
    >);
  }
  return 결과;
}

/** 핵심개념은 엄격하게 본다. 1개 이상이고 항목이 모두 온전해야 한다. */
function 핵심개념읽기(값: unknown): 개념[] | null {
  if (!Array.isArray(값)) return null;
  const 결과: 개념[] = [];
  for (const 칸 of 값) {
    if (typeof 칸 !== "object" || 칸 === null) return null;
    const 그릇 = 칸 as Record<string, unknown>;
    if (!글자인가(그릇.이름) || !글자인가(그릇.설명)) return null;
    결과.push({ 이름: 그릇.이름, 설명: 그릇.설명 });
  }
  return 결과.length > 0 ? 결과 : null;
}

/**
 * JSON 몸통 후보를 그럴듯한 순서로 모은다.
 * 울타리 안쪽을 먼저, 그다음 전문의 첫 `{` ~ 마지막 `}`.
 */
function 후보들찾기(원문: string): string[] {
  const 후보들: string[] = [];

  const 자르기 = (글: string) => {
    const 시작 = 글.indexOf("{");
    const 끝 = 글.lastIndexOf("}");
    if (시작 === -1 || 끝 === -1 || 끝 < 시작) return;
    후보들.push(글.slice(시작, 끝 + 1));
  };

  // 울타리가 여럿일 수 있다. 모델이 형식을 복창한 뒤 답을 내놓는 일이 흔하다.
  for (const 맞음 of 원문.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    자르기(맞음[1]);
  }
  // 닫히지 않은 울타리(잘린 응답)와 울타리 없는 응답까지 덮는다.
  자르기(원문);

  return 후보들;
}

/** 스키마를 확인한다. 어긋나면 null을 돌려준다. 던지지 않는다. */
function 요약만들기(날것: unknown): 요약 | null {
  if (typeof 날것 !== "object" || 날것 === null) return null;
  const 그릇 = 날것 as Record<string, unknown>;

  // 한줄요약은 반드시 내용이 있어야 한다. 빈 요약은 실패다.
  const 한줄요약 = 그릇.한줄요약;
  if (!글자인가(한줄요약) || 한줄요약.trim().length === 0) return null;

  const 핵심개념 = 핵심개념읽기(그릇.핵심개념);
  if (핵심개념 === null) return null;

  // 용어와 수식은 빈 배열이 정상이다. 수식 없는 문서가 대부분이다.
  return {
    한줄요약: 한줄요약.trim(),
    핵심개념,
    정의된용어: 짝배열읽기(그릇.정의된용어, "용어", "뜻"),
    정의된수식: 짝배열읽기(그릇.정의된수식, "수식", "뜻"),
  };
}

/**
 * @throws Error("요약형식오류") 어느 후보도 검증을 통과하지 못할 때
 */
export function 요약파싱(원문: string): 요약 {
  for (const 후보 of 후보들찾기(원문)) {
    let 날것: unknown;
    try {
      날것 = JSON.parse(후보);
    } catch {
      continue;
    }
    const 요약 = 요약만들기(날것);
    if (요약 !== null) return 요약;
  }
  throw new Error("요약형식오류");
}
