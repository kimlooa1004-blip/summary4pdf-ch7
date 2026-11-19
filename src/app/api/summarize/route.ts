// PDF를 받아 요약을 돌려준다.
//
// 요청 자체가 잘못된 경우(파일 없음, 크기 초과, PDF 아님, 글자 없음)는 400으로
// 돌려보낸다. 모델 호출이 실패한 경우는 200에 `성공: false`와 시도 기록을 담는다.
// 화면이 "무엇이 어떻게 실패했는지"를 그려야 하기 때문이다.
//
// 파일은 메모리에서만 다룬다. 디스크에 쓰지 않는다.

import { 설정읽기 } from "../../../lib/config";
import { 글자뽑기 } from "../../../lib/pdf-text";
import { 요약하기 } from "../../../lib/model";

export const runtime = "nodejs";
export const maxDuration = 120;

const 최대바이트 = 4 * 1024 * 1024;

function 거절(까닭: string) {
  return Response.json({ 성공: false, 까닭 }, { status: 400 });
}

export async function POST(요청: Request): Promise<Response> {
  let 폼: FormData;
  try {
    폼 = await 요청.formData();
  } catch {
    return 거절("파일을 읽지 못했습니다");
  }

  const 올린것 = 폼.get("file");
  if (!(올린것 instanceof File)) {
    return 거절("파일이 없습니다");
  }

  if (올린것.size > 최대바이트) {
    return 거절("파일이 너무 큽니다 (최대 4MB)");
  }

  const 바이트 = new Uint8Array(await 올린것.arrayBuffer());

  // 설정은 글자 추출보다 먼저 확인한다. 키가 없으면 어차피 요약할 수 없다.
  let 설정값;
  try {
    설정값 = 설정읽기(process.env);
  } catch (오류) {
    console.log(`[summarize] 설정 오류: ${(오류 as Error).message}`);
    return Response.json(
      { 성공: false, 까닭: "서버에 API 키가 설정되지 않았습니다" },
      { status: 500 },
    );
  }

  let 추출;
  try {
    추출 = await 글자뽑기(바이트, 설정값.최대글자수);
  } catch (오류) {
    const 까닭 = (오류 as Error).message;
    if (까닭 === "글자없음") {
      return 거절("글자가 없는 PDF입니다 (스캔 문서는 지원하지 않습니다)");
    }
    return 거절("PDF 파일이 아닙니다");
  }

  console.log(
    `[summarize] 시작 글자수=${추출.전체글자수} 쓴글자수=${추출.쓸글자.length} 잘림=${추출.잘림}`,
  );

  const 결과 = await 요약하기(추출.쓸글자, 설정값);

  if (!결과.성공) {
    return Response.json({
      성공: false,
      까닭: "모든 모델이 실패했습니다",
      시도기록: 결과.시도기록,
    });
  }

  return Response.json({
    성공: true,
    ...결과.요약,
    쓴모델: 결과.쓴모델,
    글자수: 추출.전체글자수,
    쓴글자수: 추출.쓸글자.length,
    잘림: 추출.잘림,
  });
}
