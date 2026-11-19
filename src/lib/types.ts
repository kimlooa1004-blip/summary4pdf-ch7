// 서버와 화면이 함께 쓰는 응답 모양. 사양 §5.4.

import type { 개념, 용어, 수식 } from "./validate";

export type 시도 = { 모델: string; 결과: string };

export type 성공응답 = {
  성공: true;
  한줄요약: string;
  핵심개념: 개념[];
  정의된용어: 용어[];
  정의된수식: 수식[];
  쓴모델: string;
  글자수: number;
  쓴글자수: number;
  잘림: boolean;
};

export type 실패응답 = {
  성공: false;
  까닭: string;
  시도기록?: 시도[];
};

export type 요약응답 = 성공응답 | 실패응답;
