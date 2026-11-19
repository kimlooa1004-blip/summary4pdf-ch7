import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { 글자뽑기 } from "../src/lib/pdf-text";

const 읽기 = (이름: string) =>
  new Uint8Array(readFileSync(`tests/fixtures/${이름}`));

describe("글자뽑기", () => {
  it("글자를 뽑는다", async () => {
    const 결과 = await 글자뽑기(읽기("sample.pdf"), 40000);
    expect(결과.쓸글자).toContain("test document");
    expect(결과.잘림).toBe(false);
    expect(결과.전체글자수).toBeGreaterThan(0);
  });

  it("상한을 넘기면 자르고 잘림을 알린다", async () => {
    const 결과 = await 글자뽑기(읽기("sample.pdf"), 5);
    expect(결과.쓸글자.length).toBe(5);
    expect(결과.잘림).toBe(true);
    expect(결과.전체글자수).toBeGreaterThan(5);
  });

  it("글자가 없으면 글자없음을 던진다", async () => {
    await expect(글자뽑기(읽기("empty.pdf"), 40000)).rejects.toThrow("글자없음");
  });

  // Review Focus 1: PDF로 위장한 파일
  it("PDF가 아니면 PDF아님을 던진다", async () => {
    await expect(글자뽑기(읽기("not-a-pdf.pdf"), 40000)).rejects.toThrow(
      "PDF아님",
    );
  });
});
