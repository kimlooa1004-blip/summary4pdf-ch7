# summary4pdf — PDF 요약

PDF를 올리면 AI가 한국어로 요약해 주는 Next.js 웹앱. 모델은 OpenRouter를 거쳐 호출한다.
강의 7장 7.5~7.6절 실습 결과물.

설계 의도와 반목표는 `docs/superpowers/specs/2026-11-19-pdf-요약-앱-design.md`,
구현 계획과 시험 구성은 `docs/superpowers/plans/2026-11-19-pdf-요약-앱.md`.

## 폴더 구조

- `src/app/page.tsx` — 화면 한 장. 업로드 / 진행 / 성공 / 실패 네 상태
- `src/app/api/summarize/route.ts` — 요약 API. 입력 검사는 400, 모델 실패는 200에 시도 기록
- `src/lib/config.ts` — 환경변수 읽기 (`설정읽기`)
- `src/lib/pdf-text.ts` — PDF에서 글자 뽑기 (`글자뽑기`). unpdf를 쓴다
- `src/lib/model.ts` — OpenRouter 호출·폴백 (`요약하기`)
- `src/lib/validate.ts` — 모델 응답 파싱·검증 (`요약파싱`)
- `src/lib/types.ts` — 서버와 화면이 함께 쓰는 응답 모양
- `tests/` — Vitest. `fake-openrouter.ts`가 가짜 서버, `fixtures/`가 시험용 PDF
- `scripts/` — `check-openrouter.mjs`(실제 키·모델 점검), `install-hooks.sh`, `pre-commit`
- 루트 — `.env`(비밀, 커밋 금지), `.env.example`(템플릿)

## API 키

- OpenRouter 키는 `.env`의 `OPENROUTER_API_KEY`에 둔다 (깃 무시, 템플릿은 `.env.example`)
- 항상 환경변수에서 읽는다. 키를 코드에 박거나, 찍거나, 커밋하지 않는다
- 배포하면 `.env` 대신 Vercel의 환경변수에 넣는다
- 클론마다 한 번: `sh scripts/install-hooks.sh` (`.env`와 `sk-or-` 키를 막는다)
- 키를 채팅에 붙여넣지 않는다

## 모델 설정

모델 이름을 코드에 박지 않는다. 무료 모델은 수시로 막히거나 사라진다.
`OPENROUTER_MODEL`, `OPENROUTER_FALLBACK_MODEL`로 바꾼다.
**폴백은 1차와 다른 회사 모델로 고른다.** 같은 회사면 회사 단위로 막힐 때 둘 다 죽는다.
쓸 수 있는 모델은 `npm run check:or`가 알려준다.

## 실행

```
npm install
npm run dev      # http://localhost:3000
npm test         # 가짜 OpenRouter로 단위 시험
npm run lint && npm run build
```

## 실행 시 확인 사항

- OpenRouter API를 거쳐 **실제 AI 모델**이 PDF 내용을 요약하게 한다
- 매번 실행할 때마다 API가 제대로 작동했는지 파악하고, 문제가 있으면 어떤 문제인지 보고한다.
  **실패를 성공처럼 보이게 하거나 이전 결과를 남겨 두지 않는다**
- 화면은 실패하면 "❌ …하지 못했습니다"와 시도 기록(모델별 HTTP 상태)을 그대로 보여준다
- 요약이 6만 자를 넘겨 잘렸으면 그 사실을 화면에 밝힌다. 숨기지 않는다
- 모델이 요약을 못 만들면 빈 요약을 내보내지 말고 실패로 처리한다 (`요약파싱`이 거른다)

## 코드 작성 규칙

- 파일·폴더 이름은 영어, 주석·문서·화면 글·커밋 메시지는 한국어
- 직접 만든 함수·변수명은 한국어 (`요약하기`, `글자뽑기`, `설정읽기`)
- 프레임워크가 정한 이름은 그대로 (`page.tsx`, `route.ts`, `POST`, `useState`)
- **React 컴포넌트 이름만 영어 PascalCase.** eslint `react-hooks/rules-of-hooks`가
  첫 글자 대문자를 요구하는데 한글에는 대문자가 없다 (`Home`, `Block`, `SummaryView`)
- 파일은 UTF-8
- 라우트에 `export const runtime`을 적지 않는다. Next 16의 `cacheComponents`와 함께 쓸 수 없다

## 시험

- 단위 시험은 실제 OpenRouter를 부르지 않는다. `tests/fake-openrouter.ts`가 미리 정한 응답을
  순서대로 돌려준다
- 시험용 PDF는 `npm run fixtures`로 다시 만든다. pdf-lib 기본 글꼴이 한글을 못 그려서
  내용은 라틴 문자다
- 가짜 서버로 하는 시험은 **모델 ID가 아직 사는지를 증명하지 못한다.** 그건 `npm run check:or`가 한다
