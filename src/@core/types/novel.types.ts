/**
 * ============================================================
 * @module core/types/novel
 * @file novel.types.ts
 * ============================================================
 * @description 소설 메인 타입 정의
 * ============================================================
 */

import type { Content } from '@google/genai';
import type { Chapter } from './chapter.types';
import type { Character } from './character.types';
import type { WorldviewFile, LorekeeperCacheValue } from './worldview.types';
import type { ContextManagement, ContextSummary, ContextCachingConfig } from './context.types';
import type { EpisodePacing, EpisodeArc } from './episode.types';
import type { Treatment } from './treatment.types';
import type { ChapterGenerationMode, GenerationLog, PendingChapterGeneration } from './generation.types';
import type { NovelAnalysis } from './analysis.types';
import type { Snapshot } from './snapshot.types';
import type { ForeshadowingSystem } from './foreshadowing.types';
import type { WebNovelSettings } from './webnovel.types';
import type { SeriesVolumePlanSnapshot } from './series.types';
import type { CanonFact } from './canon.types';

/** 소설 */
export interface Novel {
  id: string;
  title: string;
  subject: string;
  mood: string;
  /** 작품 분류용 메타데이터. 집필 공식이 아니라 사용자 선택 가이드로만 사용한다. */
  primaryGenre?: string;
  subgenres?: string[];
  themes?: string[];
  plotSummary: string; // 해당 권의 줄거리
  chapters: Chapter[];
  history: Content[];
  createdAt: number;
  aiAuthorId: string | null; // 이 소설을 담당하는 AI 작가 ID
  /** 담당 작가가 이 작품에서만 사용하는 기억. 다른 작품으로 전파하지 않는다. */
  authorMemoryByAuthor?: Record<string, string[]>;
  seriesId?: string; // 이 소설이 속한 시리즈의 ID
  volumeNumber?: number; // 시리즈 내에서의 권수
  seriesVolumeId?: string; // 연결된 권 청사진의 안정적인 내부 ID
  seriesVolumePlanSnapshot?: SeriesVolumePlanSnapshot; // 연결 해제 후에도 보존되는 마지막 권 계획
  targetCharacterCount?: number; // 목표 글자 수
  targetChapterCount?: number; // 목표 챕터 수
  preventAutoEnding?: boolean; // AI 자동 완결 방지

  // 독립 소설용 (시리즈가 아닐 경우)
  characters: Character[];
  worldviewFiles?: WorldviewFile[];

  // 분석 결과
  analysis?: NovelAnalysis;
  coverImage?: string; // 표지 이미지 (base64)

  // 세계관 전문가 AI
  useLorekeeper?: boolean;
  lorekeeperCache?: { [question: string]: LorekeeperCacheValue };
  canonFacts?: CanonFact[];

  // 버전 관리
  snapshots?: Snapshot[];

  // 대화 기록
  liveFeedbackChat?: Content[]; // 실시간 협업 피드백 대화 기록
  writingDirectives?: Content[]; // 확정된 글쓰기 지시사항
  directingChatHistory?: Content[]; // 소설 전체 방향성 논의

  // 문맥 관리
  contextManagement?: ContextManagement;
  contextSummary?: ContextSummary;
  contextCaching?: ContextCachingConfig;

  // 집필 설정
  avoidRepetition?: boolean; // 반복 서사 방지
  episodePacing?: EpisodePacing;
  episodeArc?: EpisodeArc;
  treatment?: Treatment; // 트리트먼트 (총괄설계도 v2)
  generationLogs?: GenerationLog[];
  generationEngine?: GenerationEngine; // 집필 엔진 선택
  targetedGenerationEnabled?: boolean; // 목표 분량·자동 이어쓰기·연속 집필 사용 여부
  chapterGenerationMode?: ChapterGenerationMode; // 1화, 긴 1화, 2화 연속, 3화 연속
  pendingChapterGeneration?: PendingChapterGeneration; // 중단된 묶음/긴 1화 재개 상태
  chapterTargetCharacters?: number; // 한 화당 목표 본문 글자 수 (기본: 6000)
  maxTokens?: number; // 레거시 제작 패키지 호환용. 실제 호출 상한은 앱이 자동 계산

  // 개연성 관리 - 복선/떡밥 시스템
  foreshadowingSystem?: ForeshadowingSystem;

  // 웹소설 시스템 설정 (장르, 플랫폼, 문체)
  webnovelSettings?: WebNovelSettings;

  // 오프닝 설정 (1화 시작 방식)
  openingStyle?: OpeningStyle;
  startingPoint?: StartingPoint;
}

/** 집필 엔진 타입 */
export type GenerationEngine =
  // Gemini
  | 'gemini-3.8-flash'
  | 'gemini-3.7-flash'
  | 'gemini-3-flash-preview'
  | 'gemini-3.6-flash'
  | 'gemini-2.5-flash'
  | 'gemini-3.5-flash-lite'
  | 'gemini-3.1-flash-lite'
  | 'gemini-3.1-pro-preview'
  | 'gemini-2.5-pro'
  // xAI Grok
  | 'grok-4-fast'
  | 'grok-4'
  | 'grok-3'
  // GLM (智谱 Z.AI)
  | 'glm-5';

/**
 * 오프닝 스타일 - 1화 시작 방식
 *
 * - intense: 사건 한복판에서 시작 (인 메디아스 레스)
 * - buildup: 일상 → 균열 → 사건으로 빌드업
 * - mystery: 의문을 던지며 시작
 * - prologue: 미래/결말 힌트 → 과거로 돌아가기
 */
export type OpeningStyle = 'intense' | 'buildup' | 'mystery' | 'prologue';

/**
 * 시작 시점 - 어디서부터 이야기를 시작할지
 *
 * - daily: 평범한 일상에서 시작
 * - crack: 이미 뭔가 이상한 조짐이 있는 상태
 * - before-incident: 사건 직전의 긴장감
 * - mid-incident: 사건 한복판 (in medias res)
 */
export type StartingPoint = 'daily' | 'crack' | 'before-incident' | 'mid-incident';
