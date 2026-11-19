import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { POST } from "../src/app/api/summarize/route";
import { 가짜서버, type 가짜서버손잡이 } from "./fake-openrouter";

// 라우트는 글자를 뽑기 전에 설정을 읽는다(최대글자수가 설정에 있다).
// 아래 시험들은 모두 모델 호출 전에 끝나므로 키 값은 쓰이지 않는다.
beforeAll(() => {
  process.env.OPENROUTER_API_KEY = "sk-or-test-fake-key";
});

const 보내기 = async (
  이름: string,
  바이트: Uint8Array,
  종류 = "application/pdf",
) => {
  const 폼 = new FormData();
  폼.append("file", new File([바이트 as BlobPart], 이름, { type: 종류 }));
  return POST(
    new Request("http://x/api/summarize", { method: "POST", body: 폼 }),
  );
};

const 읽기 = (이름: string) =>
  new Uint8Array(readFileSync(`tests/fixtures/${이름}`));

describe("POST /api/summarize", () => {
  it("파일이 없으면 400", async () => {
    const 응답 = await POST(
      new Request("http://x/api/summarize", {
        method: "POST",
        body: new FormData(),
      }),
    );
    expect(응답.status).toBe(400);
    expect((await 응답.json()).까닭).toContain("파일");
  });

  it("4MB를 넘으면 400", async () => {
    const 응답 = await 보내기("big.pdf", new Uint8Array(4 * 1024 * 1024 + 1));
    expect(응답.status).toBe(400);
    expect((await 응답.json()).까닭).toContain("4MB");
  });

  // Review Focus 1: PDF로 위장한 파일 — 500이 아니라 400이어야 한다
  it("PDF가 아니면 400이고 500이 아니다", async () => {
    const 응답 = await 보내기("not-a-pdf.pdf", 읽기("not-a-pdf.pdf"));
    expect(응답.status).toBe(400);
    expect((await 응답.json()).까닭).toContain("PDF");
  });

  it("글자가 없으면 400이고 스캔 문서를 안내한다", async () => {
    const 응답 = await 보내기("empty.pdf", 읽기("empty.pdf"));
    expect(응답.status).toBe(400);
    expect((await 응답.json()).까닭).toContain("스캔");
  });

  it("실패 본문에 성공:false를 담는다", async () => {
    const 응답 = await 보내기("empty.pdf", 읽기("empty.pdf"));
    expect((await 응답.json()).성공).toBe(false);
  });
});

// Pre-flight Ruling이 "작업 6에서 확인한다"고 적은 이름 옮기기
// (전체글자수→글자수, 쓸글자.length→쓴글자수)를 여기서 닫는다.
describe("POST /api/summarize — 성공 본문", () => {
  let 서버: 가짜서버손잡이 | undefined;

  afterEach(async () => {
    await 서버?.끝();
    서버 = undefined;
    delete process.env.OPENROUTER_BASE_URL;
    delete process.env.MAX_CHARS;
  });

  const 좋은본문 = JSON.stringify({
    choices: [
      {
        message: {
          content: JSON.stringify({
            한줄요약: "시험 문서 요약",
            핵심개념: [{ 이름: "개념", 설명: "설명" }],
            정의된용어: [],
            정의된수식: [],
          }),
        },
      },
    ],
  });

  it("성공하면 요약·쓴모델·글자수를 담아 돌려준다", async () => {
    서버 = await 가짜서버([{ 상태: 200, 본문: 좋은본문 }]);
    process.env.OPENROUTER_BASE_URL = 서버.주소;
    process.env.OPENROUTER_MODEL = "시험모델";

    const 응답 = await 보내기("sample.pdf", 읽기("sample.pdf"));
    expect(응답.status).toBe(200);

    const 본문 = await 응답.json();
    expect(본문.성공).toBe(true);
    expect(본문.한줄요약).toBe("시험 문서 요약");
    expect(본문.핵심개념).toHaveLength(1);
    expect(본문.쓴모델).toBe("시험모델");
    expect(본문.글자수).toBeGreaterThan(0);
    expect(본문.쓴글자수).toBe(본문.글자수);
    expect(본문.잘림).toBe(false);
  });

  it("잘렸으면 글자수와 쓴글자수가 다르고 잘림이 참이다", async () => {
    서버 = await 가짜서버([{ 상태: 200, 본문: 좋은본문 }]);
    process.env.OPENROUTER_BASE_URL = 서버.주소;
    process.env.OPENROUTER_MODEL = "시험모델";
    process.env.MAX_CHARS = "10";

    const 응답 = await 보내기("sample.pdf", 읽기("sample.pdf"));
    const 본문 = await 응답.json();
    expect(본문.성공).toBe(true);
    expect(본문.잘림).toBe(true);
    expect(본문.쓴글자수).toBe(10);
    expect(본문.글자수).toBeGreaterThan(10);
  });
});
