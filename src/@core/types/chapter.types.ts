/**
 * ============================================================
 * @module core/types/chapter
 * @file chapter.types.ts
 * ============================================================
 * @description 챕터(화) 관련 타입 정의
 * ============================================================
 */

import type { Content } from '@google/genai';
import type { ChapterAgentPendingProposal, ChapterAgentRevision } from './chapterAgent.types';

export type ChapterSource = 'ai' | 'manual' | 'imported' | 'legacy' | 'translated';

/** 본문과 분리된 회차 계보. 순서나 제목이 바뀌어도 chapter.id와 함께 유지된다. */
export interface ChapterTrace {
  revision: number;
  createdAt: number;
  updatedAt: number;
  source: ChapterSource;
  originChapterId?: string;
  generationBatchId?: string;
  batchPosition?: number;
  batchSize?: number;
}

/** 소설의 개별 챕터 */
export interface Chapter {
  id?: string; // 고유 식별자 (체크포인트/추적용, 없으면 자동 부여)
  trace?: ChapterTrace;
  title: string;
  content: string;
  feedbackChat?: Content[]; // AI 작가와의 피드백 대화 기록
  agentPendingProposal?: ChapterAgentPendingProposal; // 현재 원고에 대해 아직 선택되지 않은 최신 두 방향
  agentRevisions?: ChapterAgentRevision[]; // 작가 작업의 수정 전후 원고 및 복원 기록
  authorInterlude?: string; // 작가의 막간 (작품 해설)
  chapterNumber?: number; // 수동 설정 챕터 번호 (없으면 인덱스+1 사용)
}
