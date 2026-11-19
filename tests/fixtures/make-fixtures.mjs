// 테스트용 PDF 세 개를 만든다. `npm run fixtures`로 다시 만들 수 있다.
//
// 기본 글꼴(Helvetica)은 한글을 그리지 못한다. 한글 글꼴을 끌어오면 저장소가
// 무거워지므로, 글자가 뽑히는지만 보면 되는 시험에는 라틴 문자를 쓴다.

import { PDFDocument, StandardFonts } from "pdf-lib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const 여기 = dirname(fileURLToPath(import.meta.url));

/** 글자가 든 PDF */
async function 글자있는문서() {
  const 문서 = await PDFDocument.create();
  const 글꼴 = await 문서.embedFont(StandardFonts.Helvetica);
  const 쪽 = 문서.addPage([400, 200]);
  쪽.drawText("This is a test document for summary4pdf.", {
    x: 20,
    y: 150,
    size: 12,
    font: 글꼴,
  });
  쪽.drawText("It has two lines of extractable text.", {
    x: 20,
    y: 130,
    size: 12,
    font: 글꼴,
  });
  return 문서.save();
}

/** 쪽은 있으나 글자가 없는 PDF */
async function 글자없는문서() {
  const 문서 = await PDFDocument.create();
  문서.addPage([400, 200]);
  return 문서.save();
}

const 내보내기 = [
  ["sample.pdf", await 글자있는문서()],
  ["empty.pdf", await 글자없는문서()],
  // PDF가 아닌데 확장자만 .pdf인 파일
  ["not-a-pdf.pdf", Buffer.from("이것은 PDF가 아닙니다\n", "utf8")],
];

for (const [이름, 내용] of 내보내기) {
  writeFileSync(join(여기, 이름), 내용);
  console.log(`만듦: ${이름} (${내용.length} 바이트)`);
}
