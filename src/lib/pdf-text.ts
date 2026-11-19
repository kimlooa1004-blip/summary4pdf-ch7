// PDF 바이트에서 글자를 뽑는다. 파일을 디스크에 쓰지 않고 메모리에서만 다룬다.

import { extractText, getDocumentProxy } from "unpdf";

export type 추출결과 = {
  /** PDF에서 뽑은 전체 글자수 (자르기 전) */
  전체글자수: number;
  /** 모델에 보낼 글자. 상한을 넘으면 앞부분만 */
  쓸글자: string;
  /** 상한에 걸려 잘렸는지 */
  잘림: boolean;
};

/**
 * @throws Error("PDF아님") PDF로 읽히지 않을 때
 * @throws Error("글자없음") 글자가 한 자도 없을 때 (스캔 문서 등)
 */
export async function 글자뽑기(
  바이트: Uint8Array,
  최대글자수: number,
): Promise<추출결과> {
  let 전체: string;
  try {
    const 문서 = await getDocumentProxy(바이트);
    const { text } = await extractText(문서, { mergePages: true });
    전체 = Array.isArray(text) ? text.join("\n") : text;
  } catch {
    // unpdf가 어떤 이유로 못 읽든 사용자에게는 같은 뜻이다.
    throw new Error("PDF아님");
  }

  if (전체.trim().length === 0) throw new Error("글자없음");

  const 잘림 = 전체.length > 최대글자수;
  return {
    전체글자수: 전체.length,
    쓸글자: 잘림 ? 전체.slice(0, 최대글자수) : 전체,
    잘림,
  };
}
