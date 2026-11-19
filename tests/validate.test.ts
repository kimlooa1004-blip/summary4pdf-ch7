import { describe, it, expect } from "vitest";
import { 요약파싱 } from "../src/lib/validate";

const 온전한요약 = {
  한줄요약: "이 문서는 서브에이전트를 다룬다.",
  핵심개념: [{ 이름: "서브에이전트", 설명: "역할을 나눈 에이전트" }],
  정의된용어: [{ 용어: "PRD", 뜻: "제품 요구사항 문서" }],
  정의된수식: [],
};

describe("요약파싱", () => {
  it("순수 JSON을 읽는다", () => {
    expect(요약파싱(JSON.stringify(온전한요약)).한줄요약).toBe(
      "이 문서는 서브에이전트를 다룬다.",
    );
  });

  // Review Focus 2: ```json 울타리
  it("```json 울타리를 벗겨낸다", () => {
    const 원문 = "```json\n" + JSON.stringify(온전한요약) + "\n```";
    expect(요약파싱(원문).핵심개념).toHaveLength(1);
  });

  it("앞뒤에 군말이 붙어도 읽는다", () => {
    const 원문 = "요약 결과입니다.\n" + JSON.stringify(온전한요약) + "\n감사합니다.";
    expect(요약파싱(원문).한줄요약).toBe("이 문서는 서브에이전트를 다룬다.");
  });

  // Review Focus 4: 빈 배열은 정상
  it("정의된수식이 비어도 성공이다", () => {
    expect(요약파싱(JSON.stringify(온전한요약)).정의된수식).toEqual([]);
  });

  it("정의된용어·정의된수식 칸이 아예 없으면 빈 배열로 채운다", () => {
    const 없음 = {
      한줄요약: "요약",
      핵심개념: [{ 이름: "ㄱ", 설명: "ㄴ" }],
    };
    const 결과 = 요약파싱(JSON.stringify(없음));
    expect(결과.정의된용어).toEqual([]);
    expect(결과.정의된수식).toEqual([]);
  });

  // Review Focus 3: 스키마 어긋남
  it("핵심개념이 문자열 배열이면 던진다", () => {
    const 어긋남 = { ...온전한요약, 핵심개념: ["서브에이전트"] };
    expect(() => 요약파싱(JSON.stringify(어긋남))).toThrow("요약형식오류");
  });

  it("한줄요약이 비면 던진다", () => {
    const 빈것 = { ...온전한요약, 한줄요약: "  " };
    expect(() => 요약파싱(JSON.stringify(빈것))).toThrow("요약형식오류");
  });

  it("핵심개념이 0개면 던진다", () => {
    const 빈것 = { ...온전한요약, 핵심개념: [] };
    expect(() => 요약파싱(JSON.stringify(빈것))).toThrow("요약형식오류");
  });

  it("JSON이 아니면 던진다", () => {
    expect(() => 요약파싱("죄송합니다 요약할 수 없습니다")).toThrow(
      "요약형식오류",
    );
  });

  it("빈 문자열이면 던진다", () => {
    expect(() => 요약파싱("")).toThrow("요약형식오류");
  });
});
