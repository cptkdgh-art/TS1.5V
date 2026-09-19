/**
 * ============================================================
 * @module services/ai/briefing
 * @file briefing.ts
 * ============================================================
 * @description 통합 집필 브리핑 서비스
 *
 * 설계 철학:
 * - AI 작가가 글쓰기에만 집중할 수 있도록 모든 컨텍스트를 한 곳에서 조립
 * - 각 시스템(기록보관자, 복선, 에피소드 아크)은 독립적으로 작동
 * - "있으면 참고, 없으면 패스" - 강제가 아닌 선택적 지원
 * - 토큰 효율성: 중복 제거, 핵심만 전달
 * ============================================================
 */

import type { Novel, Series } from '@core/types';
import { buildLorekeeperBriefing, formatLorekeeperBriefing } from './lorekeeper';
import { buildForeshadowingContext, formatForeshadowingForPrompt } from './foreshadowing';
import { isLorekeeperEnabled } from './lorekeeperPolicy';

/** 통합 브리핑 결과 */
export interface UnifiedBriefing {
  // 각 시스템별 브리핑 (디버깅/로깅용)
  lorekeeper: string | null;
  foreshadowing: string | null;
  episodeArc: string | null;

  // 최종 조립된 브리핑
  combined: string;

  // 메타 정보
  meta: {
    hasLorekeeper: boolean;
    hasForeshadowing: boolean;
    hasEpisodeArc: boolean;
    tokenEstimate: number;
  };
}

/**
 * 에피소드 아크 브리핑 생성 (보완적 맥락 전달)
 *
 * [설계 원칙]
 * - 현재 화의 목표/이벤트/페이싱은 system instruction에서 구조적으로 전달됨
 * - 브리핑에서는 "전후 맥락"만 추가하여 AI가 흐름을 이해하도록 보조
 * - 이중 전달을 피하고, 각 경로의 역할을 분리:
 *   system instruction = "이번 화에서 해야 할 것"
 *   briefing = "앞뒤 화의 흐름 (참고용)"
 */
function buildEpisodeArcBriefing(
  novel: Novel,
  currentChapterIndex: number
): string | null {
  const arc = novel.episodeArc;
  if (!arc || !arc.chapters || arc.chapters.length === 0) {
    return null;
  }

  const relativeIndex = currentChapterIndex - arc.startChapterIndex;
  if (relativeIndex < 0 || relativeIndex >= arc.chapters.length) {
    return null;
  }

  const lines: string[] = [];

  // 아크 진행도 (몇 번째 화인지)
  lines.push(`[아크 진행] ${relativeIndex + 1}/${arc.chapters.length}화`);

  // 이전 화의 엔딩 힌트 (연속성 유지)
  if (relativeIndex > 0) {
    const prevChapter = arc.chapters[relativeIndex - 1];
    if (prevChapter.cliffhanger) {
      lines.push(`[이전 화 엔딩] ${prevChapter.cliffhanger}`);
    }
  }

  // 다음 화 예고 (자연스러운 연결 유도)
  if (relativeIndex + 1 < arc.chapters.length) {
    const nextChapter = arc.chapters[relativeIndex + 1];
    if (nextChapter.goal) {
      lines.push(`[다음 화 방향] ${nextChapter.goal}`);
    }
  }

  if (lines.length <= 1) {
    // 진행도만 있으면 굳이 전달 안 함
    return null;
  }

  return lines.join('\n');
}

/**
 * 마지막 장면 자동 인지 (현재 상황 브리핑)
 *
 * AI 작가가 "지금 어디까지 왔는지"를 자연스럽게 파악할 수 있도록
 * 마지막 화의 끝 부분을 간결하게 요약하여 전달
 *
 * [설계 원칙]
 * - 명령이 아닌 "참고" - AI가 자유롭게 이어갈 수 있도록
 * - 마지막 장면의 분위기, 상황만 짧게
 * - 사용자 개입 없이 자동으로 생성
 */
function buildLastSceneAwareness(novel: Novel): string | null {
  if (novel.chapters.length === 0) return null;

  const lastChapter = novel.chapters[novel.chapters.length - 1];
  if (!lastChapter.content || lastChapter.content.length < 50) return null;

  // 마지막 화의 끝 부분 추출 (300자)
  const ending = lastChapter.content.slice(-300).trim();

  // 첫 문장이 잘렸을 수 있으니 첫 마침표/느낌표/물음표 이후부터
  const firstBreak = ending.search(/[.!?。！？]\s/);
  const cleanEnding = firstBreak > 0 ? ending.slice(firstBreak + 2) : ending;

  if (cleanEnding.length < 30) return null;

  return `[현재 상황] ${novel.chapters.length}화 "${lastChapter.title}" 마지막 장면:\n…${cleanEnding}`;
}

/**
 * 통합 브리핑 생성
 *
 * 모든 시스템의 정보를 수집하고 하나의 브리핑으로 조립
 * 각 시스템은 독립적 - 없으면 해당 섹션 생략
 */
export function buildUnifiedBriefing(
  novel: Novel,
  series: Series | null,
  userPrompt: string,
  currentChapterIndex?: number
): UnifiedBriefing {
  const chapterIndex = currentChapterIndex ?? novel.chapters.length;

  // 0. 현재 상황 (마지막 장면 자동 인지)
  const lastSceneAwareness = buildLastSceneAwareness(novel);

  // 1. 기록보관자 브리핑 (세계관/캐릭터)
  let lorekeeperBriefing: string | null = null;
  if (isLorekeeperEnabled(novel.useLorekeeper)) {
    const briefingData = buildLorekeeperBriefing(novel, series, userPrompt);
    if (briefingData) {
      lorekeeperBriefing = formatLorekeeperBriefing(briefingData);
    }
  }

  // 2. 복선 브리핑
  let foreshadowingBriefing: string | null = null;
  const foreshadowingContext = buildForeshadowingContext(novel, chapterIndex);
  if (foreshadowingContext) {
    const formatted = formatForeshadowingForPrompt(foreshadowingContext);
    if (formatted) {
      foreshadowingBriefing = formatted;
    }
  }

  // 3. 에피소드 아크 브리핑 (사용자가 설정했을 때만)
  let episodeArcBriefing: string | null = null;
  if (novel.episodeArc) {
    episodeArcBriefing = buildEpisodeArcBriefing(novel, chapterIndex);
  }

  // 최종 조립
  const sections: string[] = [];

  // 현재 상황이 있으면 맨 앞 (AI가 "지금 여기"를 인지)
  if (lastSceneAwareness) {
    sections.push(lastSceneAwareness);
  }

  // 에피소드 아크가 있으면 그 다음 (이번 화 방향 설정)
  if (episodeArcBriefing) {
    sections.push(episodeArcBriefing);
  }

  // 복선 (회수/금지 사항)
  if (foreshadowingBriefing) {
    sections.push(foreshadowingBriefing);
  }

  // 기록보관자 (세계관 참고 자료)
  if (lorekeeperBriefing) {
    sections.push(lorekeeperBriefing);
  }

  const combined = sections.length > 0
    ? `--- [집필 브리핑] ---\n${sections.join('\n\n')}\n---`
    : '';

  // 토큰 추정 (대략 4자 = 1토큰)
  const tokenEstimate = Math.ceil(combined.length / 4);

  return {
    lorekeeper: lorekeeperBriefing,
    foreshadowing: foreshadowingBriefing,
    episodeArc: episodeArcBriefing,
    combined,
    meta: {
      hasLorekeeper: !!lorekeeperBriefing,
      hasForeshadowing: !!foreshadowingBriefing,
      hasEpisodeArc: !!episodeArcBriefing,
      tokenEstimate,
    },
  };
}

/**
 * 프롬프트에 브리핑 주입 (편의 함수)
 *
 * generation.ts에서 간단하게 호출할 수 있도록
 */
export function injectUnifiedBriefing(
  novel: Novel,
  series: Series | null,
  userPrompt: string,
  currentChapterIndex?: number
): string {
  const briefing = buildUnifiedBriefing(novel, series, userPrompt, currentChapterIndex);
  return briefing.combined;
}

/**
 * 브리핑 메타 정보만 가져오기 (UI/로깅용)
 */
export function getBriefingMeta(
  novel: Novel,
  series: Series | null,
  userPrompt: string
): UnifiedBriefing['meta'] {
  const briefing = buildUnifiedBriefing(novel, series, userPrompt);
  return briefing.meta;
}

// ============================================================
// 챕터 저장 후 훅 (피드백 루프)
// ============================================================

import { analyzeForeshadowingFromText, updatePacingGuide, createForeshadowingFromAnalysis } from './foreshadowing';
import type { ForeshadowingSystem } from '@core/types';
import { logger } from '@shared/utils/logger';

/** 챕터 저장 후 분석 결과 */
export interface PostChapterAnalysis {
  // 새로 감지된 복선들 (사용자 확인 후 추가)
  detectedForeshadowings: Array<{
    suggested: ReturnType<typeof createForeshadowingFromAnalysis>;
    reason: string;
  }>;

  // 진행된 복선들 (자동 업데이트 가능)
  progressedForeshadowings: Array<{
    id: string;
    newStatus: 'hinted' | 'partially_paid' | 'fully_paid';
    evidence: string;
  }>;

  // 경고 (UI에 표시)
  warnings: string[];

  // 업데이트된 호흡 가이드
  updatedPacingGuide: ForeshadowingSystem['pacingGuide'] | null;

  // 다음 챕터 제안
  nextChapterSuggestion: string;
}

/** 복선 분석 주기 설정 */
const FORESHADOWING_ANALYSIS_INTERVAL = 5; // N화마다 자동 분석

/**
 * 복선 분석이 필요한 챕터인지 확인
 *
 * 실제 챕터 개수 기준 (배열 인덱스 아님)
 * 챕터 삭제해도 실시간으로 현재 상태 인식
 *
 * 예: 5, 10, 15, 20화... 에서만 분석 실행
 */
export function shouldRunForeshadowingAnalysis(chapterCount: number): boolean {
  // 5화 미만이면 아직 분석 안 함
  if (chapterCount < FORESHADOWING_ANALYSIS_INTERVAL) {
    return false;
  }
  // N화 주기 체크 (5, 10, 15, 20...)
  return chapterCount % FORESHADOWING_ANALYSIS_INTERVAL === 0;
}

/**
 * 챕터 저장 후 자동 분석 (피드백 루프)
 *
 * 호출 시점: 챕터가 저장된 직후
 * 목적: 복선 상태 업데이트, 새 복선 감지, 개연성 경고
 *
 * [토큰 최적화] 5화마다 한 번만 분석 실행
 * - 1~4화: 분석 안 함
 * - 5화: 분석 ✓
 * - 6~9화: 분석 안 함
 * - 10화: 분석 ✓ ...
 *
 * 비동기로 실행되며, UI에서 결과를 받아 처리
 */
export async function analyzeAfterChapterSave(
  novel: Novel
): Promise<PostChapterAnalysis> {
  const system = novel.foreshadowingSystem;
  const existingForeshadowings = system?.items || [];
  const chapterCount = novel.chapters.length;
  const lastChapterIndex = chapterCount - 1;

  // 복선 시스템이 없거나 챕터가 없으면 빈 결과 반환
  if (chapterCount === 0) {
    return {
      detectedForeshadowings: [],
      progressedForeshadowings: [],
      warnings: [],
      updatedPacingGuide: null,
      nextChapterSuggestion: '첫 챕터를 작성해보세요.',
    };
  }

  // [토큰 절약] 5화 주기 체크 - 해당 안 되면 스킵
  if (!shouldRunForeshadowingAnalysis(chapterCount)) {
    const nextAnalysisAt = Math.ceil(chapterCount / FORESHADOWING_ANALYSIS_INTERVAL) * FORESHADOWING_ANALYSIS_INTERVAL;
    return {
      detectedForeshadowings: [],
      progressedForeshadowings: [],
      warnings: [],
      updatedPacingGuide: null,
      nextChapterSuggestion: `복선 자동분석: ${nextAnalysisAt}화에 실행 예정 (현재 ${chapterCount}화)`,
    };
  }

  try {
    // AI 분석 실행 (5, 10, 15... 화에서만)
    logger.log(`[복선 분석] ${chapterCount}화 도달 - 자동 분석 실행`);
    const analysisResult = await analyzeForeshadowingFromText(novel, existingForeshadowings);

    // 새로 감지된 복선 변환
    const detectedForeshadowings = analysisResult.detectedForeshadowings.map((detected) => ({
      suggested: createForeshadowingFromAnalysis(detected, lastChapterIndex),
      reason: detected.reason,
    }));

    // 진행된 복선
    const progressedForeshadowings = analysisResult.progressedForeshadowings.map((prog) => ({
      id: prog.foreshadowingId,
      newStatus: prog.newStatus,
      evidence: prog.evidence,
    }));

    // 경고 메시지
    const warnings = analysisResult.coherenceWarnings.map((w) => w.message);

    // 호흡 가이드 업데이트
    let updatedPacingGuide: ForeshadowingSystem['pacingGuide'] | null = null;
    if (system) {
      updatedPacingGuide = updatePacingGuide(system);
    }

    return {
      detectedForeshadowings,
      progressedForeshadowings,
      warnings,
      updatedPacingGuide,
      nextChapterSuggestion: analysisResult.pacingSuggestion,
    };
  } catch (error) {
    console.error('[analyzeAfterChapterSave] 분석 실패:', error);
    return {
      detectedForeshadowings: [],
      progressedForeshadowings: [],
      warnings: ['복선 분석 중 오류가 발생했습니다.'],
      updatedPacingGuide: null,
      nextChapterSuggestion: '',
    };
  }
}

/**
 * 복선 시스템에 분석 결과 적용
 *
 * 사용자가 확인 후 호출하거나, 자동 적용 설정 시 호출
 */
export function applyForeshadowingAnalysis(
  system: ForeshadowingSystem,
  analysis: PostChapterAnalysis,
  options: {
    autoAddDetected?: boolean; // 감지된 복선 자동 추가
    autoUpdateProgressed?: boolean; // 진행된 복선 자동 업데이트
  } = {}
): ForeshadowingSystem {
  const { autoAddDetected = false, autoUpdateProgressed = true } = options;

  let items = [...system.items];

  // 진행된 복선 업데이트
  if (autoUpdateProgressed && analysis.progressedForeshadowings.length > 0) {
    items = items.map((item) => {
      const progress = analysis.progressedForeshadowings.find((p) => p.id === item.id);
      if (progress) {
        return {
          ...item,
          status: progress.newStatus,
          updatedAt: Date.now(),
        };
      }
      return item;
    });
  }

  // 새로 감지된 복선 추가
  if (autoAddDetected && analysis.detectedForeshadowings.length > 0) {
    const newItems = analysis.detectedForeshadowings.map((d) => d.suggested);
    items = [...items, ...newItems];
  }

  // 호흡 가이드 업데이트
  const pacingGuide = analysis.updatedPacingGuide || updatePacingGuide({ ...system, items });

  return {
    ...system,
    items,
    pacingGuide,
  };
}
