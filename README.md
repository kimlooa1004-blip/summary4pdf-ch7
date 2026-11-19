# summary4pdf — PDF 요약

PDF를 올리면 AI가 한국어로 요약해 주는 웹앱이다. 강의 7장 7.5~7.6절 실습 결과물.

요약은 네 덩어리로 나온다.

1. 한 문장 요약
2. 핵심 개념 3~5개
3. 문서가 직접 정의한 용어
4. 문서가 직접 정의한 수식

올린 파일과 요약 결과는 서버에 저장하지 않는다. 메모리에서만 다룬다.

## 준비

Node 24 이상이 필요하다 (개발은 26.13 LTS에서 했다).

```bash
npm install
cp .env.example .env
```

`.env`를 열어 `OPENROUTER_API_KEY`를 채운다. 키는 OpenRouter(https://openrouter.ai/keys)에서 받는다.
`.env`는 깃이 무시한다. 절대 커밋하지 않는다.

커밋에 비밀이 섞이는 것을 막는 훅을 한 번 켜 둔다.

```bash
sh scripts/install-hooks.sh
```

## 쓸 수 있는 모델 고르기

무료 모델은 수시로 막히거나 사라진다. 그래서 모델 이름을 코드에 박지 않고 `.env`로 뺐다.
지금 무엇을 쓸 수 있는지는 점검 스크립트가 알려준다.

```bash
npm run check:or
```

무료 모델 목록과 각 문맥 창 크기, `.env`에 적힌 모델이 아직 사는지, 실제 호출이 되는지,
`MAX_CHARS`가 문맥 창에 맞는지를 알려준다.

`OPENROUTER_FALLBACK_MODEL`은 비어 있는 채로 나온다. **1차 모델과 다른 회사 모델**을
골라 채우자. 같은 회사 무료 모델 둘을 쓰면 회사 단위로 막힐 때 1차와 폴백이 한꺼번에 죽는다.

OpenRouter 개인정보 설정에서 무료 모델 사용을 허용해야 한다. 안 하면 호출이 404로 돌아온다.

## 실행

```bash
npm run dev
```

http://localhost:3000 에서 열린다.

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm test` | 단위 시험 (가짜 OpenRouter 서버를 쓴다) |
| `npm run lint` | ESLint |
| `npm run build` | 운영 빌드 + 타입 검사 |
| `npm run check:or` | 실제 키·모델 점검 (키 필요) |
| `npm run fixtures` | 시험용 PDF 다시 만들기 |

## 환경변수

| 변수 | 뜻 | 기본값 |
|---|---|---|
| `OPENROUTER_API_KEY` | 키 | 없음 (반드시 채운다) |
| `OPENROUTER_MODEL` | 1차 모델 | `nvidia/nemotron-3-ultra-550b-a55b:free` |
| `OPENROUTER_FALLBACK_MODEL` | 폴백 모델 | 비어 있음 |
| `OPENROUTER_TIMEOUT_MS` | 1차 제한시간 | `40000` |
| `OPENROUTER_FALLBACK_TIMEOUT_MS` | 폴백 제한시간 | `50000` |
| `MAX_CHARS` | 모델에 보낼 최대 글자수 | `40000` |

폴백은 한 번만 돈다. 1차가 HTTP 오류·시간 초과·빈 응답·형식 오류 중 무엇으로 실패하든
똑같이 폴백으로 넘어간다. 폴백이 비어 있으면 1차만 시도한다.

## 한계

- 파일 크기 **4MB**까지
- 모델에 보내는 글자는 **40,000자**까지. 넘으면 앞부분만 쓰고 화면에 그 사실을 밝힌다
- **스캔 PDF는 지원하지 않는다.** 글자가 이미지로 들어 있으면 뽑을 글자가 없다
- 한 번에 한 파일

## 실패했을 때

이 앱은 실패를 성공처럼 보이게 하지 않는다. 요약을 못 만들면 빈 화면이나 지어낸 요약 대신
**어느 모델이 어떻게 실패했는지**를 그대로 보여준다.

```
❌ 모든 모델이 실패했습니다
시도 기록
 · nvidia/…:free → HTTP 429
 · mistralai/…:free(폴백) → 시간 초과(50초)
```

- `HTTP 401` — 키가 틀렸다
- `HTTP 404` — OpenRouter에서 무료 모델 사용이 허용돼 있지 않거나, 모델이 사라졌다.
  `npm run check:or`로 확인한다
- `HTTP 429` — 무료 티어 한도. 잠시 뒤 다시 하거나 다른 회사 모델로 바꾼다
- `시간 초과` — 문서가 길거나 모델이 느리다. `OPENROUTER_TIMEOUT_MS`를 늘린다
- `서버가 응답하지 않았습니다 (115초 초과)` — 배포 환경에서 함수가 끊겼다. 아래 참조

## Vercel 배포

1. 저장소를 Vercel에 import 한다
2. **환경변수를 등록한다.** 최소한 `OPENROUTER_API_KEY`. 나중에 추가했다면 다시 배포해야 한다
3. **Fluid compute가 켜져 있는지 확인한다.** 요약 API는 `maxDuration = 120`을 쓴다.
   꺼져 있으면 함수가 중간에 끊기고 화면에 "서버가 응답하지 않았습니다"가 뜬다
4. 요약이 실패하면 Vercel 함수 로그에서 `[summarize]`로 시작하는 줄을 본다.
   키와 요청 헤더는 로그에 남기지 않는다

## 문서

- `docs/superpowers/specs/` — 설계 문서 (왜 이렇게 만들었는지, 반목표)
- `docs/superpowers/plans/` — 구현 계획 (작업 9개, 시험 포함)
