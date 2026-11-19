import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { POST } from "../src/app/api/summarize/route";

// 라우트는 글자를 뽑기 전에 설정을 읽는다(최대글자수가 설정에 있다).
// 아래 시험들은 모두 모델 호출 전에 끝나므로 키 값은 쓰이지 않는다.
beforeAll(() => {
  process.env.OPENROUTER_API_KEY = "테스트용-가짜-키";
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
