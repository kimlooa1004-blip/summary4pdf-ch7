import { describe, it, expect, afterEach } from "vitest";
import { 요약하기 } from "../src/lib/model";
import { 가짜서버, type 가짜서버손잡이 } from "./fake-openrouter";
import type { 설정 } from "../src/lib/config";

const 기본설정: 설정 = {
  키: "k",
  모델: "일차",
  폴백모델: "이차",
  제한시간: 300,
  폴백제한시간: 300,
  최대글자수: 40000,
};

const 좋은본문 = JSON.stringify({
  choices: [
    {
      message: {
        content: JSON.stringify({
          한줄요약: "요약",
          핵심개념: [{ 이름: "ㄱ", 설명: "ㄴ" }],
          정의된용어: [],
          정의된수식: [],
        }),
      },
    },
  ],
});

let 서버: 가짜서버손잡이 | undefined;
afterEach(async () => {
  await 서버?.끝();
  서버 = undefined;
});

describe("요약하기", () => {
  it("1차가 성공하면 폴백을 부르지 않는다", async () => {
    서버 = await 가짜서버([{ 상태: 200, 본문: 좋은본문 }]);
    const 결과 = await 요약하기("글", 기본설정, 서버.주소);
    expect(결과.성공).toBe(true);
    if (결과.성공) expect(결과.쓴모델).toBe("일차");
    expect(서버.호출수()).toBe(1);
  });

  it("1차가 HTTP 오류면 폴백으로 성공한다", async () => {
    서버 = await 가짜서버([
      { 상태: 429, 본문: "" },
      { 상태: 200, 본문: 좋은본문 },
    ]);
    const 결과 = await 요약하기("글", 기본설정, 서버.주소);
    expect(결과.성공).toBe(true);
    if (결과.성공) expect(결과.쓴모델).toBe("이차");
  });

  it("1차가 시간 초과면 폴백으로 넘어간다", async () => {
    서버 = await 가짜서버([
      { 상태: 200, 본문: 좋은본문, 지연: 1000 },
      { 상태: 200, 본문: 좋은본문 },
    ]);
    const 결과 = await 요약하기("글", 기본설정, 서버.주소);
    expect(결과.성공).toBe(true);
    if (결과.성공) expect(결과.쓴모델).toBe("이차");
  });

  it("1차 응답이 형식 오류면 폴백으로 넘어간다", async () => {
    const 나쁜본문 = JSON.stringify({
      choices: [{ message: { content: "미안합니다" } }],
    });
    서버 = await 가짜서버([
      { 상태: 200, 본문: 나쁜본문 },
      { 상태: 200, 본문: 좋은본문 },
    ]);
    const 결과 = await 요약하기("글", 기본설정, 서버.주소);
    expect(결과.성공).toBe(true);
  });

  it("둘 다 실패하면 시도 기록 2개를 돌려준다", async () => {
    서버 = await 가짜서버([
      { 상태: 429, 본문: "" },
      { 상태: 500, 본문: "" },
    ]);
    const 결과 = await 요약하기("글", 기본설정, 서버.주소);
    expect(결과.성공).toBe(false);
    if (!결과.성공) {
      expect(결과.시도기록).toHaveLength(2);
      expect(결과.시도기록[0].결과).toContain("429");
      expect(결과.시도기록[0].모델).toBe("일차");
      expect(결과.시도기록[1].모델).toBe("이차");
    }
  });

  // Review Focus 5: 폴백 미설정
  it("폴백이 없으면 1차만 시도하고 기록 1개를 돌려준다", async () => {
    서버 = await 가짜서버([{ 상태: 429, 본문: "" }]);
    const 결과 = await 요약하기(
      "글",
      { ...기본설정, 폴백모델: null },
      서버.주소,
    );
    expect(결과.성공).toBe(false);
    if (!결과.성공) expect(결과.시도기록).toHaveLength(1);
    expect(서버.호출수()).toBe(1);
  });

  it("폴백은 한 번만 돈다", async () => {
    서버 = await 가짜서버([
      { 상태: 429, 본문: "" },
      { 상태: 429, 본문: "" },
      { 상태: 200, 본문: 좋은본문 },
    ]);
    const 결과 = await 요약하기("글", 기본설정, 서버.주소);
    expect(결과.성공).toBe(false);
    expect(서버.호출수()).toBe(2);
  });

  it("시간 초과 기록에 초 단위를 적는다", async () => {
    서버 = await 가짜서버([{ 상태: 200, 본문: 좋은본문, 지연: 1000 }]);
    const 결과 = await 요약하기(
      "글",
      { ...기본설정, 폴백모델: null },
      서버.주소,
    );
    expect(결과.성공).toBe(false);
    if (!결과.성공) expect(결과.시도기록[0].결과).toContain("시간 초과");
  });

  it("빈 응답이면 실패로 치고 기록에 적는다", async () => {
    const 빈본문 = JSON.stringify({ choices: [{ message: { content: "" } }] });
    서버 = await 가짜서버([{ 상태: 200, 본문: 빈본문 }]);
    const 결과 = await 요약하기(
      "글",
      { ...기본설정, 폴백모델: null },
      서버.주소,
    );
    expect(결과.성공).toBe(false);
    if (!결과.성공) expect(결과.시도기록[0].결과).toContain("빈 응답");
  });
});
