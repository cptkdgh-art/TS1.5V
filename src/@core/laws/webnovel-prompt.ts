/**
 * ============================================================
 * @module core/laws
 * @file webnovel-prompt.ts
 * ============================================================
 * @description 웹소설 시스템 프롬프트 빌더
 *
 * 장르 공식이나 플랫폼 취향을 강제하지 않고 가독성, 속도, 호흡만 보조한다.
 * ============================================================
 */

import type { WebNovelSettings } from '@core/types/webnovel.types';
import type { ForeshadowingContext, ForeshadowingSystem } from '@core/types';
import { getGenreLaw } from './genre-laws';

// ============================================================
// CORE LAYER - 항상 포함되는 핵심 (압축 버전)
// ============================================================

/**
 * 코어 레이어 - 개연성 + 웹소설 기본을 압축한 핵심 프롬프트
 * 모든 호출에 항상 포함됨 (약 600자)
 */
const CORE_CONSTITUTION = `
[웹소설 가독성 보조]
- 배정된 AI 작가의 정체성 코어, 작품관, 문체의 원인을 가장 먼저 따릅니다. 전역 창작 합의는 그 정체성을 보조합니다.
- 그다음 사용자의 작품·회차 지시와 기존 설정을 따릅니다.
- 긴 설명 덩어리는 의미나 장면이 바뀌는 지점에서 문단을 나눕니다.
- 짧은 문장과 긴 문장을 자연스럽게 섞고 토막문장 반복을 피합니다.
- 빠른 장면은 군더더기를 줄이고, 감정과 정보가 중요한 장면은 작가의 호흡대로 필요한 만큼 머무릅니다.
- 장르 공식, 대화 비율, 사이다, 반전, 클리프행어를 자동으로 강제하지 않습니다.
`.trim();

// ============================================================
// 프롬프트 빌더 함수들
// ============================================================

/**
 * 문체 설정을 프롬프트로 변환
 */
function buildStylePrompt(settings: WebNovelSettings): string {
  const { breathing } = settings.style;

  let prompt = '\n[문체 가이드]\n';

  // 문장 호흡
  prompt += `- 문장 길이: ${breathing.targetLength.min}-${breathing.targetLength.max}자가 적당합니다.\n`;
  prompt += `- 문단: ${breathing.maxLinesPerParagraph}줄을 넘기면 끊어주세요.\n`;

  // 리듬 패턴
  const rhythmDesc: Record<string, string> = {
    'long-long-short': '긴 문장 두 개 후에 짧은 문장으로 리듬을 만듭니다.',
    'short-short-long': '짧은 문장들로 속도감을 내다가 긴 문장으로 마무리합니다.',
    'varied': '다양한 길이를 섞어 단조로움을 피합니다.',
    'consistent': '일정한 호흡을 유지합니다.',
  };
  prompt += `- 리듬: ${rhythmDesc[breathing.rhythmPattern]}\n`;

  return prompt;
}

/**
 * 장르 규칙을 프롬프트로 변환
 */
function buildGenrePrompt(settings: WebNovelSettings): string {
  if (settings.genre === 'custom') {
    return settings.customGenreName
      ? `\n[작품 분류 참고: ${settings.customGenreName}]\n`
      : '';
  }

  const law = getGenreLaw(settings.genre);
  return `\n[작품 분류 참고: ${law.name}]\n`;
}

/**
 * 복선 컨텍스트를 프롬프트로 변환
 */
function buildForeshadowingPrompt(context: ForeshadowingContext | undefined): string {
  if (!context || context.activeForeshadowings.length === 0) {
    return '';
  }

  let prompt = '\n[활성화된 복선들]\n';
  prompt += '다음 복선들이 진행 중입니다. 적절히 힌트를 주거나 회수하세요:\n\n';

  context.activeForeshadowings.forEach((f) => {
    prompt += `• **${f.name}** (${f.type}, ${f.urgency})\n`;
    if (f.aiGuidance.doHint.length > 0) {
      prompt += `  힌트 방법: ${f.aiGuidance.doHint[0]}\n`;
    }
    if (f.aiGuidance.dontReveal.length > 0) {
      prompt += `  아직 밝히지 말 것: ${f.aiGuidance.dontReveal[0]}\n`;
    }
  });

  if (context.payoffCandidates.length > 0) {
    prompt += `\n이번 회차에서 회수 고려: ${context.payoffCandidates.join(', ')}\n`;
  }

  prompt += `\n${context.pacingInstruction}\n`;

  if (context.prohibitions.length > 0) {
    prompt += '\n⚠️ 절대 하지 말 것:\n';
    context.prohibitions.forEach((p) => {
      prompt += `- ${p}\n`;
    });
  }

  return prompt;
}

// ============================================================
// 메인 빌더
// ============================================================

export interface WebNovelPromptOptions {
  /** 웹소설 설정 */
  settings: WebNovelSettings;
  /** 복선 컨텍스트 (있으면 포함) */
  foreshadowingContext?: ForeshadowingContext;
  /** 기록보관자 사용 여부 */
  useLorekeeper?: boolean;
  /** 현재 회차 번호 */
  currentChapter?: number;
  /** 총 목표 회차 */
  targetChapters?: number;
}

/**
 * 작가의 개성을 침범하지 않는 웹소설 가독성 프롬프트를 빌드한다.
 */
export function buildWebNovelPrompt(options: WebNovelPromptOptions): string {
  const { settings, foreshadowingContext, useLorekeeper } = options;

  // 비활성화면 빈 문자열
  if (!settings.isEnabled) {
    return '';
  }

  let prompt = '';
  prompt += CORE_CONSTITUTION;
  prompt += '\n\n';

  // 기록보관자 연동 (Core에 이미 언급, useLorekeeper면 도구 사용법 추가)
  if (useLorekeeper) {
    prompt += `[기록보관자 도구]\n→ \`ask_lorekeeper\` 도구로 설정/과거사건을 확인하세요.\n\n`;
  }

  // 장르는 분류 정보로만 전달하고 공식을 자동 주입하지 않는다.
  prompt += buildGenrePrompt(settings);

  // 사용자가 활성화한 경우에만 문장/문단 호흡 설정을 보조한다.
  if (settings.autoApplyRules) {
    prompt += buildStylePrompt(settings);
  }

  // 사용자가 관리하는 복선 정보는 장르 공식과 무관하게 유지한다.
  prompt += buildForeshadowingPrompt(foreshadowingContext);

  return prompt;
}

/**
 * 복선 시스템에서 프롬프트용 컨텍스트 추출
 */
export function extractForeshadowingContext(
  system: ForeshadowingSystem | undefined,
  currentChapterIndex: number
): ForeshadowingContext | undefined {
  if (!system || system.items.length === 0) {
    return undefined;
  }

  // 활성화된 복선 (planted 또는 hinted 상태)
  const active = system.items.filter(
    (f) => f.status === 'planted' || f.status === 'hinted' || f.status === 'partially_paid'
  );

  // 긴급 회수 대상
  const urgent = active.filter((f) => {
    if (f.urgency === 'immediate') return true;
    if (f.urgency === 'short' && currentChapterIndex - f.plantedAt.chapterIndex >= 5) return true;
    if (f.urgency === 'medium' && currentChapterIndex - f.plantedAt.chapterIndex >= 20) return true;
    return false;
  });

  // 호흡 가이드 결정
  let pacingInstruction = '';
  if (system.pacingGuide.recommendation === 'payoff_soon') {
    pacingInstruction = '복선 회수 시점입니다. 하나 이상의 복선을 진전시키세요.';
  } else if (system.pacingGuide.recommendation === 'plant_more') {
    pacingInstruction = '새로운 복선을 심을 여유가 있습니다.';
  } else if (system.pacingGuide.recommendation === 'give_hints') {
    pacingInstruction = '기존 복선에 대한 힌트를 슬쩍 주세요.';
  } else {
    pacingInstruction = '현재 복선 밸런스가 적절합니다.';
  }

  // 금지 사항
  const prohibitions: string[] = [];
  active.forEach((f) => {
    f.aiGuidance.dontReveal.forEach((dont) => {
      prohibitions.push(`[${f.name}] ${dont}`);
    });
  });

  return {
    activeForeshadowings: active.map((f) => ({
      name: f.name,
      type: f.type,
      status: f.status,
      urgency: f.urgency,
      aiGuidance: f.aiGuidance,
    })),
    pacingInstruction,
    payoffCandidates: urgent.map((f) => f.name),
    prohibitions: prohibitions.slice(0, 5), // 너무 많으면 잘라냄
  };
}
