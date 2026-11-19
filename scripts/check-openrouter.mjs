// 실제 OpenRouter를 불러 지금 쓸 수 있는 무료 모델과 .env 설정을 점검한다.
//
// 가짜 서버로 하는 Vitest는 "모델 ID가 아직 살아 있는지"를 증명하지 못한다.
// 무료 모델은 수시로 막히거나 사라지므로 이 스크립트가 따로 있다.
//
//   npm run check:or
//
// 키가 필요하므로 사람이 직접 돌린다. 키를 화면에 찍지 않는다.

const 키 = process.env.OPENROUTER_API_KEY?.trim();
const 모델 = process.env.OPENROUTER_MODEL?.trim();
const 폴백모델 = process.env.OPENROUTER_FALLBACK_MODEL?.trim();
const 최대글자수 = Number(process.env.MAX_CHARS ?? 40000);

if (!키) {
  console.error("OPENROUTER_API_KEY가 없습니다.");
  console.error(".env.example을 .env로 복사하고 키를 채운 뒤 다시 돌리세요.");
  process.exit(1);
}

/** 모델 이름에서 회사 부분만 떼어낸다. nvidia/foo:free -> nvidia */
function 회사(이름) {
  return 이름?.split("/")[0] ?? "";
}

async function 본론() {
  // 1. 무료 모델 목록과 문맥 창 크기
  const 응답 = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${키}` },
  });
  if (!응답.ok) {
    console.error(`모델 목록을 받지 못했습니다: HTTP ${응답.status}`);
    process.exit(1);
  }
  const { data } = await 응답.json();
  const 무료 = data
    .filter((모델정보) => 모델정보.id.endsWith(":free"))
    .map((모델정보) => ({
      id: 모델정보.id,
      문맥: 모델정보.context_length ?? 0,
    }))
    .sort((가, 나) => 나.문맥 - 가.문맥);

  console.log(`무료 모델 ${무료.length}개를 찾았습니다 (문맥 창 큰 순):\n`);
  for (const { id, 문맥 } of 무료.slice(0, 20)) {
    console.log(`  ${id}  (문맥 ${문맥.toLocaleString("ko-KR")} 토큰)`);
  }
  if (무료.length > 20) console.log(`  … 그 밖에 ${무료.length - 20}개`);
  console.log();

  // 2. .env의 모델이 목록에 있는지
  const 찾기 = (이름) => 무료.find((칸) => 칸.id === 이름);
  const 일차정보 = 찾기(모델);

  console.log("─ .env 점검 ─");
  if (!모델) {
    console.log("✗ OPENROUTER_MODEL이 비어 있습니다");
  } else if (일차정보) {
    console.log(`✓ 1차 모델 ${모델} — 쓸 수 있습니다`);
  } else {
    console.log(`✗ 1차 모델 ${모델} — 무료 목록에 없습니다. 위에서 고르세요`);
  }

  if (!폴백모델) {
    console.log(
      "✗ 폴백 모델이 비어 있습니다. 위 목록에서 1차와 **다른 회사** 모델을 골라 .env에 채우세요",
    );
  } else if (!찾기(폴백모델)) {
    console.log(`✗ 폴백 모델 ${폴백모델} — 무료 목록에 없습니다`);
  } else if (회사(폴백모델) === 회사(모델)) {
    console.log(
      `⚠ 폴백 모델이 1차와 같은 회사(${회사(모델)})입니다. 회사 단위로 막히면 둘 다 죽습니다`,
    );
  } else {
    console.log(`✓ 폴백 모델 ${폴백모델} — 쓸 수 있고 1차와 다른 회사입니다`);
  }

  // 3. 1차 모델로 실제 호출
  if (모델) {
    console.log("\n─ 실제 호출 ─");
    const 시작 = Date.now();
    const 호출 = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${키}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: 모델,
          messages: [
            { role: "user", content: "한 문장으로 자기소개를 해 보세요." },
          ],
        }),
      },
    );
    const 걸린시간 = ((Date.now() - 시작) / 1000).toFixed(1);
    if (호출.ok) {
      const 본문 = await 호출.json();
      const 답 = 본문?.choices?.[0]?.message?.content?.trim();
      console.log(`✓ HTTP ${호출.status} (${걸린시간}초)`);
      console.log(`  답: ${답 ? 답.slice(0, 80) : "(빈 응답)"}`);
    } else {
      console.log(`✗ HTTP ${호출.status} (${걸린시간}초)`);
      if (호출.status === 404) {
        console.log(
          "  OpenRouter 개인정보 설정에서 무료 모델 사용이 허용돼 있는지 확인하세요",
        );
      }
    }
  }

  // 4. MAX_CHARS가 문맥 창에 맞는지
  if (일차정보) {
    console.log("\n─ MAX_CHARS 점검 ─");
    // 한국어 기준 대략 3글자가 1토큰. 넉넉히 2로 잡아 안전한 쪽으로 센다.
    const 어림토큰 = Math.ceil(최대글자수 / 2);
    const 여유 = 일차정보.문맥 - 어림토큰;
    console.log(
      `  MAX_CHARS=${최대글자수.toLocaleString("ko-KR")}자 ≈ 최대 ${어림토큰.toLocaleString("ko-KR")}토큰`,
    );
    console.log(
      `  1차 모델 문맥 창 ${일차정보.문맥.toLocaleString("ko-KR")}토큰`,
    );
    if (여유 < 1000) {
      const 권장 = Math.floor((일차정보.문맥 - 2000) * 2);
      console.log(
        `✗ 너무 큽니다. MAX_CHARS를 ${Math.max(권장, 1000).toLocaleString("ko-KR")} 아래로 낮추세요`,
      );
    } else {
      console.log(`✓ 여유 ${여유.toLocaleString("ko-KR")}토큰 — 괜찮습니다`);
    }
  }
}

본론().catch((오류) => {
  console.error(`점검 중 오류: ${오류.message}`);
  process.exit(1);
});
