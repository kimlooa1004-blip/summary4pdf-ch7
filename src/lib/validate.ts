// 모델이 보낸 글에서 요약 JSON을 꺼내고 스키마를 확인한다.
//
// 무료 모델은 JSON만 달라고 해도 ```json 울타리로 감싸거나 앞뒤에 군말을 붙인다.
// 멀쩡한 요약을 형식 때문에 버리지 않도록 너그럽게 파싱하되, 칸이 어긋나면
// 실패로 쳐서 폴백으로 넘긴다. 빈 요약을 성공처럼 내보내지 않는 것이 요점이다.

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

/** 두 칸짜리 객체 배열인지 본다. 배열이 아니거나 칸이 없으면 null. */
function 짝배열읽기<키1 extends string, 키2 extends string>(
  값: unknown,
  키1: 키1,
  키2: 키2,
): Record<키1 | 키2, string>[] | null {
  if (값 === undefined || 값 === null) return [];
  if (!Array.isArray(값)) return null;

  const 결과: Record<키1 | 키2, string>[] = [];
  for (const 칸 of 값) {
    if (typeof 칸 !== "object" || 칸 === null) return null;
    const 그릇 = 칸 as Record<string, unknown>;
    if (!글자인가(그릇[키1]) || !글자인가(그릇[키2])) return null;
    결과.push({ [키1]: 그릇[키1], [키2]: 그릇[키2] } as Record<
      키1 | 키2,
      string
    >);
  }
  return 결과;
}

/** 울타리와 군말을 걷어내고 JSON 몸통만 남긴다. */
function JSON몸통찾기(원문: string): string | null {
  const 울타리 = 원문.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const 후보 = 울타리 ? 울타리[1] : 원문;

  const 시작 = 후보.indexOf("{");
  const 끝 = 후보.lastIndexOf("}");
  if (시작 === -1 || 끝 === -1 || 끝 < 시작) return null;
  return 후보.slice(시작, 끝 + 1);
}

/**
 * @throws Error("요약형식오류") 파싱이나 스키마 확인에 실패할 때
 */
export function 요약파싱(원문: string): 요약 {
  const 몸통 = JSON몸통찾기(원문);
  if (몸통 === null) throw new Error("요약형식오류");

  let 날것: unknown;
  try {
    날것 = JSON.parse(몸통);
  } catch {
    throw new Error("요약형식오류");
  }

  if (typeof 날것 !== "object" || 날것 === null) {
    throw new Error("요약형식오류");
  }
  const 그릇 = 날것 as Record<string, unknown>;

  // 한줄요약은 반드시 내용이 있어야 한다. 빈 요약은 실패다.
  const 한줄요약 = 그릇.한줄요약;
  if (!글자인가(한줄요약) || 한줄요약.trim().length === 0) {
    throw new Error("요약형식오류");
  }

  // 핵심개념은 1개 이상이어야 한다.
  const 핵심개념 = 짝배열읽기(그릇.핵심개념, "이름", "설명");
  if (핵심개념 === null || 핵심개념.length === 0) {
    throw new Error("요약형식오류");
  }

  // 용어와 수식은 빈 배열이 정상이다. 수식 없는 문서가 대부분이다.
  const 정의된용어 = 짝배열읽기(그릇.정의된용어, "용어", "뜻");
  const 정의된수식 = 짝배열읽기(그릇.정의된수식, "수식", "뜻");
  if (정의된용어 === null || 정의된수식 === null) {
    throw new Error("요약형식오류");
  }

  return { 한줄요약: 한줄요약.trim(), 핵심개념, 정의된용어, 정의된수식 };
}
