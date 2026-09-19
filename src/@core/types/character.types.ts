/**
 * ============================================================
 * @module core/types/character
 * @file character.types.ts
 * ============================================================
 * @description 등장인물 관련 타입 정의
 * ============================================================
 */

import type { Content } from '@google/genai';

/** 등장인물 */
export interface Character {
  id: string;
  name: string;
  personality: string;
  appearance: string;
  background: string;
  log: string; // 캐릭터의 성장 및 변화 기록
  interviewHistory?: Content[]; // 등장인물과의 인터뷰 기록
}

/** 스캔된 캐릭터 (AI 분석 결과) - Character와 호환되는 구조 */
export interface ScannedCharacter {
  name: string;
  personality: string; // 성격 특성
  appearance: string; // 외모 묘사
  background: string; // 배경 설명
}

/** 캐릭터 업데이트 로그 */
export interface CharacterUpdateLog {
  characterName: string; // Match by name
  suggestedLogEntry: string; // The new log entry to append
}

/** 캐릭터 분석 결과 */
export interface CharacterAnalysisResult {
  newCharacters: ScannedCharacter[];
  characterUpdates: CharacterUpdateLog[];
}
