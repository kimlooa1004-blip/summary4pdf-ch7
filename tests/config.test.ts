import { describe, it, expect } from "vitest";
import { 설정읽기 } from "../src/lib/config";

describe("설정읽기", () => {
  it("기본값을 채운다", () => {
    const 결과 = 설정읽기({
      OPENROUTER_API_KEY: "k",
      OPENROUTER_MODEL: "m",
    } as NodeJS.ProcessEnv);
    expect(결과.제한시간).toBe(40000);
    expect(결과.폴백제한시간).toBe(50000);
    expect(결과.최대글자수).toBe(40000);
  });

  it("폴백 모델이 비면 null이다", () => {
    const 결과 = 설정읽기({
      OPENROUTER_API_KEY: "k",
      OPENROUTER_MODEL: "m",
      OPENROUTER_FALLBACK_MODEL: "",
    } as NodeJS.ProcessEnv);
    expect(결과.폴백모델).toBeNull();
  });

  it("키가 없으면 던진다", () => {
    expect(() => 설정읽기({} as NodeJS.ProcessEnv)).toThrow(
      "OPENROUTER_API_KEY가 없습니다",
    );
  });

  it("환경변수 값이 기본값을 덮어쓴다", () => {
    const 결과 = 설정읽기({
      OPENROUTER_API_KEY: "k",
      OPENROUTER_MODEL: "m",
      MAX_CHARS: "1000",
    } as NodeJS.ProcessEnv);
    expect(결과.최대글자수).toBe(1000);
  });

  it("숫자가 아닌 값이 오면 기본값으로 되돌린다", () => {
    const 결과 = 설정읽기({
      OPENROUTER_API_KEY: "k",
      OPENROUTER_MODEL: "m",
      MAX_CHARS: "많이",
    } as NodeJS.ProcessEnv);
    expect(결과.최대글자수).toBe(40000);
  });
});
