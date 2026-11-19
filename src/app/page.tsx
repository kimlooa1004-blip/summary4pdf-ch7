"use client";

// PDF 요약 화면. 사양 §5.3의 네 가지 상태를 그린다.
//
// 요약 중에는 모델 이름을 띄우지 않는다(사양 §5.8). 모델 이름은 서버 환경변수에만
// 있고, 진행 중에 보여주려면 설정 조회용 API를 더 두거나 스트리밍으로 바꿔야 한다.
// 모델 이름은 끝난 뒤 응답에 담겨 오는 쓴모델과 시도기록에서만 보여준다.

import { useRef, useState } from "react";
import type { 성공응답, 시도 } from "../lib/types";

const 최대바이트 = 4 * 1024 * 1024;
const 화면제한시간 = 115000;

type 상태 =
  | { 종류: "대기" }
  | { 종류: "요약중" }
  | { 종류: "성공"; 결과: 성공응답 }
  | { 종류: "실패"; 까닭: string; 시도기록?: 시도[]; 도움말?: string };

function 크기글(바이트: number): string {
  return `${(바이트 / 1024 / 1024).toFixed(1)}MB`;
}

export default function Home() {
  const [파일, 파일설정] = useState<File | null>(null);
  const [상태값, 상태설정] = useState<상태>({ 종류: "대기" });
  const [끌고있음, 끌고있음설정] = useState(false);
  const 입력칸 = useRef<HTMLInputElement>(null);
  // 날아가 있는 요청이 돌아와 새 파일의 결과인 양 화면을 덮는 것을 막는다.
  // 번호가 바뀌면 그 전에 보낸 응답은 버린다.
  const 요청번호 = useRef(0);

  function 파일고르기(고른것: File | null) {
    요청번호.current += 1;
    상태설정({ 종류: "대기" });
    if (!고른것) {
      파일설정(null);
      return;
    }
    if (!고른것.name.toLowerCase().endsWith(".pdf")) {
      파일설정(null);
      상태설정({ 종류: "실패", 까닭: "PDF 파일만 올릴 수 있습니다" });
      return;
    }
    if (고른것.size > 최대바이트) {
      파일설정(null);
      상태설정({
        종류: "실패",
        까닭: `파일이 너무 큽니다 (${크기글(고른것.size)} · 최대 4MB)`,
      });
      return;
    }
    파일설정(고른것);
  }

  async function 요약보내기() {
    if (!파일) return;
    const 내번호 = (요청번호.current += 1);
    /** 그 사이 다른 파일을 골랐으면 이 응답은 버린다. */
    const 아직내차례 = () => 요청번호.current === 내번호;

    상태설정({ 종류: "요약중" });

    const 중단기 = new AbortController();
    const 시계 = setTimeout(() => 중단기.abort(), 화면제한시간);

    try {
      const 폼 = new FormData();
      폼.append("file", 파일);
      const 응답 = await fetch("/api/summarize", {
        method: "POST",
        body: 폼,
        signal: 중단기.signal,
      });

      // 서버가 JSON을 주지 않으면 꾸며내지 않고 무응답으로 다룬다.
      let 본문;
      try {
        본문 = await 응답.json();
      } catch {
        if (!아직내차례()) return;
        // Vercel이 함수를 끊으면 JSON이 아니라 HTML 504가 돌아온다.
        // "115초 초과"라고 적지는 않는다 — 빨리 온 응답에 그렇게 쓰면 거짓이 된다.
        상태설정({
          종류: "실패",
          까닭: "서버가 요약을 돌려주지 않았습니다",
          시도기록: [{ 모델: "—", 결과: "서버 무응답" }],
          도움말:
            "서버 응답이 JSON이 아닙니다. Vercel의 Fluid compute가 켜져 있는지 확인하고, 함수 로그에서 [summarize] 줄을 보세요.",
        });
        return;
      }

      if (!아직내차례()) return;

      if (본문?.성공 === true) {
        상태설정({ 종류: "성공", 결과: 본문 as 성공응답 });
      } else {
        상태설정({
          종류: "실패",
          까닭: 본문?.까닭 ?? "요약하지 못했습니다",
          시도기록: 본문?.시도기록,
          도움말: 본문?.시도기록
            ? "OpenRouter 설정에서 무료 모델 사용이 허용돼 있는지 확인해 보세요."
            : undefined,
        });
      }
    } catch (오류) {
      if (!아직내차례()) return;
      const 끊김 = (오류 as { name?: string })?.name === "AbortError";
      상태설정({
        종류: "실패",
        까닭: 끊김
          ? "서버가 응답하지 않았습니다 (115초 초과)"
          : "서버에 연결하지 못했습니다",
        시도기록: 끊김 ? [{ 모델: "—", 결과: "서버 무응답" }] : undefined,
        도움말: 끊김
          ? "Vercel의 Fluid compute가 켜져 있는지 확인해 보세요."
          : undefined,
      });
    } finally {
      clearTimeout(시계);
    }
  }

  const 진행중 = 상태값.종류 === "요약중";

  return (
    <main className="mx-auto w-full max-w-2xl grow px-4 py-10 sm:py-16">
      <h1 className="text-2xl font-bold sm:text-3xl">PDF 요약</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        PDF를 올리면 한국어로 요약해 드립니다
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          // 요약 중에는 받지 않는다. 받으면 앞 파일의 결과가 새 파일 이름 아래 뜬다.
          if (진행중) return;
          끌고있음설정(true);
        }}
        onDragLeave={() => 끌고있음설정(false)}
        onDrop={(e) => {
          e.preventDefault();
          끌고있음설정(false);
          if (진행중) return;
          파일고르기(e.dataTransfer.files?.[0] ?? null);
        }}
        className={`mt-8 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          끌고있음
            ? "border-black/40 bg-black/5 dark:border-white/50 dark:bg-white/5"
            : "border-black/15 dark:border-white/20"
        }`}
      >
        <p className="text-sm">여기에 PDF를 끌어다 놓거나</p>
        <button
          type="button"
          onClick={() => 입력칸.current?.click()}
          disabled={진행중}
          className="mt-3 rounded-full border border-black/15 px-5 py-2 text-sm font-medium transition-colors hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
        >
          파일 고르기
        </button>
        <input
          ref={입력칸}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => 파일고르기(e.target.files?.[0] ?? null)}
        />
        <p className="mt-3 text-xs text-black/50 dark:text-white/50">
          최대 4MB · 스캔 문서(글자가 이미지인 PDF)는 요약할 수 없습니다
        </p>
      </div>

      {파일 && (
        <div className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-black/10 px-4 py-3 dark:border-white/15">
          <span className="truncate text-sm">
            {파일.name}{" "}
            <span className="text-black/50 dark:text-white/50">
              ({크기글(파일.size)})
            </span>
          </span>
          <button
            type="button"
            onClick={요약보내기}
            disabled={진행중}
            className="shrink-0 rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40 dark:bg-white dark:text-black"
          >
            {진행중 ? "요약하는 중…" : "요약하기"}
          </button>
        </div>
      )}

      {진행중 && (
        <div className="mt-6 rounded-lg border border-black/10 p-4 dark:border-white/15">
          <p className="text-sm">⏳ 요약하는 중… 최대 2분 걸립니다</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-black/50 dark:bg-white/60" />
          </div>
        </div>
      )}

      {상태값.종류 === "성공" && <SummaryView 결과={상태값.결과} />}

      {상태값.종류 === "실패" && (
        <section className="mt-6 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <h2 className="font-semibold text-red-700 dark:text-red-400">
            ❌ {상태값.까닭}
          </h2>

          {상태값.시도기록 && 상태값.시도기록.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-black/60 dark:text-white/60">
                시도 기록
              </p>
              <ul className="mt-1 space-y-1">
                {상태값.시도기록.map((시도, 번호) => (
                  <li key={번호} className="font-mono text-xs">
                    · {시도.모델} → {시도.결과}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {상태값.도움말 && (
            <p className="mt-3 text-xs text-black/60 dark:text-white/60">
              {상태값.도움말}
            </p>
          )}

          {파일 && (
            <button
              type="button"
              onClick={요약보내기}
              className="mt-4 rounded-full border border-black/15 px-4 py-1.5 text-sm transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              다시 시도
            </button>
          )}
        </section>
      )}
    </main>
  );
}

function Block({
  제목,
  children,
}: {
  제목: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-black/70 dark:text-white/70">
        ■ {제목}
      </h2>
      <div className="mt-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function SummaryView({ 결과 }: { 결과: 성공응답 }) {
  return (
    <div className="mt-8 border-t border-black/10 pt-2 dark:border-white/15">
      <Block 제목="한 문장 요약">
        <p>{결과.한줄요약}</p>
      </Block>

      <Block 제목="핵심 개념">
        <ol className="list-decimal space-y-1 pl-5">
          {결과.핵심개념.map((개념, 번호) => (
            <li key={번호}>
              <span className="font-medium">{개념.이름}</span> — {개념.설명}
            </li>
          ))}
        </ol>
      </Block>

      <Block 제목="문서가 정의한 용어">
        {결과.정의된용어.length === 0 ? (
          <p className="text-black/50 dark:text-white/50">
            정의된 용어가 없습니다
          </p>
        ) : (
          <ul className="space-y-1">
            {결과.정의된용어.map((용어, 번호) => (
              <li key={번호}>
                · <span className="font-medium">{용어.용어}</span> — {용어.뜻}
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block 제목="문서가 정의한 수식">
        {결과.정의된수식.length === 0 ? (
          <p className="text-black/50 dark:text-white/50">
            정의된 수식이 없습니다
          </p>
        ) : (
          <ul className="space-y-1">
            {결과.정의된수식.map((수식, 번호) => (
              <li key={번호}>
                · <span className="font-mono">{수식.수식}</span> — {수식.뜻}
              </li>
            ))}
          </ul>
        )}
      </Block>

      {결과.잘림 && (
        <p className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
          ⚠ 문서가 길어 앞부분 {결과.쓴글자수.toLocaleString("ko-KR")}자까지만
          요약했습니다 (전체 {결과.글자수.toLocaleString("ko-KR")}자)
        </p>
      )}

      <p className="mt-4 text-xs text-black/50 dark:text-white/50">
        요약에 쓴 모델: <span className="font-mono">{결과.쓴모델}</span>
      </p>
    </div>
  );
}
