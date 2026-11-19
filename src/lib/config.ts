// 환경변수에서 OpenRouter 설정을 읽는다.
// 모델 이름과 제한시간을 코드에 박지 않는다. 무료 모델은 수시로 막히거나 사라진다.

export type 환경꾸러미 = Record<string, string | undefined>;

export type 설정 = {
  키: string;
  모델: string;
  폴백모델: string | null;
  제한시간: number;
  폴백제한시간: number;
  최대글자수: number;
  /** OpenRouter 주소. 시험에서 가짜 서버를 가리키게 하려고 환경변수로 뺐다. */
  기본주소: string;
};

const 기본값 = {
  모델: "nvidia/nemotron-3-ultra-550b-a55b:free",
  제한시간: 40000,
  폴백제한시간: 50000,
  최대글자수: 40000,
  기본주소: "https://openrouter.ai/api/v1/chat/completions",
} as const;

/** 빈 문자열과 공백만 있는 값을 undefined와 똑같이 "없음"으로 다룬다. */
function 글자읽기(값: string | undefined): string | null {
  const 다듬음 = 값?.trim();
  return 다듬음 ? 다듬음 : null;
}

/** 숫자로 읽되, 숫자가 아니면 기본값으로 되돌린다. */
function 숫자읽기(값: string | undefined, 기본: number): number {
  const 글자 = 글자읽기(값);
  if (글자 === null) return 기본;
  const 숫자 = Number(글자);
  return Number.isFinite(숫자) ? 숫자 : 기본;
}

/**
 * 환경변수 꾸러미를 받아 설정을 만든다.
 * `process.env`보다 느슨한 타입을 받는다 — 글자 칸만 읽으므로 그걸로 충분하고,
 * 시험에서 작은 객체를 그대로 넘길 수 있다.
 */
export function 설정읽기(환경: 환경꾸러미): 설정 {
  const 키 = 글자읽기(환경.OPENROUTER_API_KEY);
  if (키 === null) throw new Error("OPENROUTER_API_KEY가 없습니다");

  return {
    키,
    모델: 글자읽기(환경.OPENROUTER_MODEL) ?? 기본값.모델,
    폴백모델: 글자읽기(환경.OPENROUTER_FALLBACK_MODEL),
    제한시간: 숫자읽기(환경.OPENROUTER_TIMEOUT_MS, 기본값.제한시간),
    폴백제한시간: 숫자읽기(
      환경.OPENROUTER_FALLBACK_TIMEOUT_MS,
      기본값.폴백제한시간,
    ),
    최대글자수: 숫자읽기(환경.MAX_CHARS, 기본값.최대글자수),
    기본주소: 글자읽기(환경.OPENROUTER_BASE_URL) ?? 기본값.기본주소,
  };
}
