/**
 * ============================================================
 * @module services/ai/foreshadowing
 * @file foreshadowing.ts
 * ============================================================
 * @description AI 작가를 위한 복선 컨텍스트 생성 서비스
 *
 * 설계 철학:
 * - AI 작가가 글에만 집중할 수 있도록 환경을 조성
 * - 복선 정보를 자연스러운 "작가 노트" 형태로 변환
 * - 명령이 아닌 "참고 자료"처럼 제공
 * - AI가 창작의 자유를 유지하면서도 개연성을 지킬 수 있도록
 * ============================================================
 */

import type {
  Novel,
  Foreshadowing,
  ForeshadowingSystem,
  ForeshadowingContext,
  ForeshadowingAnalysisResult,
  ForeshadowingType,
  ForeshadowingUrgency,
} from '@core/types';
import { generateContent } from './config';
import { extractAndParseJson } from './utils';

/**
 * AI 작가에게 주입할 복선 컨텍스트 생성
 *
 * AI가 자연스럽게 참고할 수 있는 "작가 노트" 형태로 변환
 */
export function buildForeshadowingContext(
  novel: Novel,
  currentChapterIndex: number
): ForeshadowingContext | null {
  const system = novel.foreshadowingSystem;
  if (!system || system.items.length === 0) {
    return null;
  }

  // 활성 복선만 필터 (심어졌거나 힌트만 준 것들)
  const activeItems = system.items.filter(
    (item) => ['planted', 'hinted', 'partially_paid'].includes(item.status)
  );

  if (activeItems.length === 0) {
    return null;
  }

  // 회수 후보 판단 (현재 챕터 기준)
  const payoffCandidates = activeItems
    .filter((item) => {
      const chaptersElapsed = currentChapterIndex - item.plantedAt.chapterIndex;

      // 긴급도에 따른 회수 시점 판단
      switch (item.urgency) {
        case 'immediate':
          return chaptersElapsed >= 1; // 1화 이상 지났으면 회수 고려
        case 'short':
          return chaptersElapsed >= 5; // 5화 이상
        case 'medium':
          return chaptersElapsed >= 10; // 10화 이상
        default:
          return false; // 장기/시리즈는 자동 회수 추천 안함
      }
    })
    .map((item) => item.name);

  // 금지 사항 수집
  const prohibitions: string[] = [];
  activeItems.forEach((item) => {
    item.aiGuidance.dontReveal.forEach((dont) => {
      prohibitions.push(`"${item.name}" 관련: ${dont}`);
    });
  });

  // 호흡 조절 지침 생성
  const pacingInstruction = generatePacingInstruction(system, currentChapterIndex);

  return {
    activeForeshadowings: activeItems.map((item) => ({
      name: item.name,
      type: item.type,
      status: item.status,
      urgency: item.urgency,
      aiGuidance: item.aiGuidance,
    })),
    pacingInstruction,
    payoffCandidates,
    prohibitions,
  };
}

/**
 * 호흡 조절 지침 생성
 */
function generatePacingInstruction(
  system: ForeshadowingSystem,
  _currentChapterIndex: number
): string {
  const guide = system.pacingGuide;
  const activeCount = system.items.filter((i) =>
    ['planted', 'hinted', 'partially_paid'].includes(i.status)
  ).length;

  const urgentItems = system.items.filter(
    (i) => i.urgency === 'immediate' && i.status === 'planted'
  );

  const lines: string[] = [];

  // 기본 상태
  if (activeCount === 0) {
    lines.push('현재 활성화된 복선이 없습니다. 새로운 미스터리나 의문점을 심어볼 시점입니다.');
  } else if (activeCount >= 5) {
    lines.push(`현재 ${activeCount}개의 복선이 진행 중입니다. 새 복선보다는 기존 복선의 힌트를 주거나 회수하는 것이 좋겠습니다.`);
  }

  // 긴급 회수 필요
  if (urgentItems.length > 0) {
    lines.push(
      `다음 복선들은 회수 시점이 다가왔습니다: ${urgentItems.map((i) => `"${i.name}"`).join(', ')}`
    );
  }

  // 긴장도 기반 조언
  if (guide.currentTension >= 80) {
    lines.push('현재 긴장도가 높습니다. 약간의 휴식 장면이나 일상 에피소드를 고려해보세요.');
  } else if (guide.currentTension <= 20) {
    lines.push('현재 긴장도가 낮습니다. 새로운 갈등이나 의문점을 던져볼 타이밍입니다.');
  }

  return lines.join(' ');
}

/**
 * 복선 컨텍스트를 AI 프롬프트에 삽입할 텍스트로 변환
 *
 * [토큰 최적화 버전]
 * - AI 작가가 집필에 집중할 수 있도록 핵심만 전달
 * - "해야 할 것"과 "하면 안 되는 것"을 명확히 구분
 * - 불필요한 장식과 반복 제거
 */
export function formatForeshadowingForPrompt(context: ForeshadowingContext): string {
  const lines: string[] = [];

  // 1. 회수 시점이 된 복선 (최우선)
  if (context.payoffCandidates.length > 0) {
    lines.push(`[회수 대상] ${context.payoffCandidates.join(', ')}`);
  }

  // 2. 금지 사항 (절대 준수)
  if (context.prohibitions.length > 0) {
    const top3 = context.prohibitions.slice(0, 3);
    lines.push(`[금지] ${top3.join(' / ')}`);
  }

  // 3. 심어진 복선 중 힌트가 필요한 것들 (선택적)
  const needHint = context.activeForeshadowings
    .filter(f => f.status === 'planted' && f.aiGuidance.doHint.length > 0)
    .slice(0, 2); // 최대 2개만

  if (needHint.length > 0) {
    const hints = needHint.map(f => `${f.name}: ${f.aiGuidance.doHint[0]}`);
    lines.push(`[힌트 가능] ${hints.join(' | ')}`);
  }

  // 아무것도 없으면 빈 문자열 반환 (토큰 절약)
  if (lines.length === 0) {
    return '';
  }

  return `[복선] ${lines.join(' ')}`;
}

/** 분석 윈도우 설정 */
const ANALYSIS_WINDOW_SIZE = 5; // 최근 N화만 분석
const MAX_CHARS_PER_CHAPTER = 8000; // 챕터당 최대 글자수 (웹소설 1화 평균 5000-8000자)

/**
 * 본문에서 복선 자동 분석 (슬라이딩 윈도우 방식)
 *
 * 설계 철학:
 * - 전체 텍스트가 아닌 최근 N화만 분석 (토큰 효율화)
 * - 기존 복선 리스트를 "메모리"로 활용
 * - 새 챕터 저장 시점에만 호출 (실시간 분석 X)
 */
export async function analyzeForeshadowingFromText(
  novel: Novel,
  existingForeshadowings: Foreshadowing[]
): Promise<ForeshadowingAnalysisResult> {
  if (novel.chapters.length === 0) {
    return {
      detectedForeshadowings: [],
      progressedForeshadowings: [],
      coherenceWarnings: [],
      pacingSuggestion: '아직 본문이 없습니다. 집필을 시작하면 복선을 분석할 수 있습니다.',
    };
  }

  // 슬라이딩 윈도우: 최근 N화만 추출
  const totalChapters = novel.chapters.length;
  const startIndex = Math.max(0, totalChapters - ANALYSIS_WINDOW_SIZE);
  const recentChapters = novel.chapters.slice(startIndex);

  // 분석 대상 텍스트 구성 (챕터별 글자수 제한)
  const analysisText = recentChapters
    .map((ch, idx) => {
      const chapterNum = startIndex + idx + 1;
      const content = ch.content.length > MAX_CHARS_PER_CHAPTER
        ? ch.content.slice(-MAX_CHARS_PER_CHAPTER) + '...(앞부분 생략)'
        : ch.content;
      return `【${chapterNum}화: ${ch.title}】\n${content}`;
    })
    .join('\n\n---\n\n');

  if (!analysisText.trim()) {
    return {
      detectedForeshadowings: [],
      progressedForeshadowings: [],
      coherenceWarnings: [],
      pacingSuggestion: '분석할 내용이 없습니다.',
    };
  }

  // 기존 복선 정보 (누적된 메모리 역할)
  const existingInfo = existingForeshadowings.length > 0
    ? `\n\n【기존 등록된 복선 (${existingForeshadowings.length}개)】\n${existingForeshadowings
        .map((f) => `- "${f.name}" [${f.status}] (${f.plantedAt.chapterIndex + 1}화): ${f.description.slice(0, 50)}...`)
        .join('\n')}`
    : '';

  const prompt = `당신은 소설 편집자입니다. **최근 ${recentChapters.length}화**를 분석하여 복선(떡밥)을 찾아주세요.

【분석 범위】
- 현재 ${totalChapters}화까지 진행됨
- 분석 대상: ${startIndex + 1}화 ~ ${totalChapters}화 (최근 ${recentChapters.length}화)
${existingInfo}

【분석 기준】
1. 새로운 복선: 최근 챕터에서 새로 등장한 의문점, 암시, 체호프의 총
2. 진행된 복선: 기존 복선 중 힌트가 주어졌거나 회수된 것 (위 리스트 참조)
3. 개연성 문제: 잊힌 복선, 급하게 회수된 복선

【복선 유형】
- chekhov_gun: 의미 있게 언급된 물건, 능력 등
- character_secret: 인물의 숨겨진 과거나 정체
- prophecy: 예언이나 미래 암시
- mystery: 풀어야 할 수수께끼
- relationship: 인물 간 숨겨진 연결
- worldview: 세계관의 숨겨진 진실
- symbolic: 반복되는 모티프나 상징
- red_herring: 독자를 속이는 페이크

【긴급도 판단】
- immediate: 1-3화 내 회수 예상
- short: 5-10화 내 회수
- medium: 이번 권 내 회수
- long: 다음 권에서 회수
- series: 시리즈 완결 시 회수

【최근 ${recentChapters.length}화 본문】
${analysisText}

다음 JSON 형식으로 응답해주세요:
{
  "detectedForeshadowings": [
    {
      "excerpt": "해당 텍스트 발췌 (50자 이내)",
      "suggestedName": "복선 이름",
      "suggestedType": "유형",
      "suggestedUrgency": "긴급도",
      "reason": "왜 복선으로 보이는지"
    }
  ],
  "progressedForeshadowings": [
    {
      "foreshadowingId": "기존 복선 ID",
      "newStatus": "hinted 또는 partially_paid 또는 fully_paid",
      "evidence": "어떤 부분이 힌트/회수인지"
    }
  ],
  "coherenceWarnings": [
    {
      "type": "forgotten | rushed | contradicted | overdue",
      "foreshadowingId": "관련 복선 ID (있으면)",
      "message": "문제 설명",
      "suggestion": "해결 제안"
    }
  ],
  "pacingSuggestion": "전반적인 복선 호흡에 대한 조언"
}`;

  try {
    const response = await generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      usePro: true, // 복선 분석은 정밀도가 중요 → Pro 모델 사용
    });

    const result = extractAndParseJson<ForeshadowingAnalysisResult | null>(response, null);
    if (!result) {
      throw new Error('JSON 응답을 찾을 수 없습니다');
    }

    return result;
  } catch (error) {
    console.error('복선 분석 실패:', error);
    return {
      detectedForeshadowings: [],
      progressedForeshadowings: [],
      coherenceWarnings: [
        {
          type: 'forgotten',
          message: '복선 분석 중 오류가 발생했습니다.',
          suggestion: '잠시 후 다시 시도해주세요.',
        },
      ],
      pacingSuggestion: '분석에 실패했습니다.',
    };
  }
}

/**
 * 호흡 조절 가이드 업데이트
 *
 * 복선 상태를 기반으로 현재 서사의 긴장도와 추천을 계산
 */
export function updatePacingGuide(system: ForeshadowingSystem): ForeshadowingSystem['pacingGuide'] {
  const items = system.items;

  const plantedCount = items.filter((i) => i.status === 'planted').length;
  const awaitingCount = items.filter((i) =>
    ['planted', 'hinted', 'partially_paid'].includes(i.status)
  ).length;

  const urgentItems = items.filter(
    (i) => i.urgency === 'immediate' && i.status === 'planted'
  );

  // 긴장도 계산 (복선 수, 긴급도, 중요도 기반)
  let tension = 50; // 기본값

  // 활성 복선이 많으면 긴장도 상승
  tension += awaitingCount * 5;

  // 긴급 복선이 있으면 추가 상승
  tension += urgentItems.length * 15;

  // 고중요도 복선이 있으면 추가
  const highImportanceActive = items.filter(
    (i) => i.importance >= 4 && ['planted', 'hinted'].includes(i.status)
  );
  tension += highImportanceActive.length * 10;

  // 최대 100으로 제한
  tension = Math.min(100, Math.max(0, tension));

  // 추천 결정
  let recommendation: ForeshadowingSystem['pacingGuide']['recommendation'] = 'balanced';

  if (awaitingCount === 0) {
    recommendation = 'plant_more';
  } else if (urgentItems.length >= 2) {
    recommendation = 'payoff_soon';
  } else if (plantedCount >= 5 && items.filter((i) => i.status === 'hinted').length === 0) {
    recommendation = 'give_hints';
  }

  return {
    currentTension: tension,
    plantedCount,
    awaitingPayoffCount: awaitingCount,
    recommendation,
    urgentPayoffs: urgentItems.map((i) => i.id),
  };
}

/**
 * 챕터 생성 시 복선 컨텍스트를 시스템 프롬프트에 추가
 *
 * generation.ts에서 호출하여 AI 작가에게 복선 정보 제공
 */
export function injectForeshadowingContext(
  systemPrompt: string,
  novel: Novel,
  currentChapterIndex: number
): string {
  const context = buildForeshadowingContext(novel, currentChapterIndex);

  if (!context) {
    return systemPrompt;
  }

  const foreshadowingSection = formatForeshadowingForPrompt(context);

  // 시스템 프롬프트 끝에 복선 컨텍스트 추가
  return `${systemPrompt}

${foreshadowingSection}`;
}

// ============================================================
// AI 응답에서 복선 자동 추출 (자동 기록용)
// ============================================================

/** AI가 보고한 복선 메모 */
export interface AutoForeshadowingMemo {
  planted: Array<{ content: string; description: string }>;
  recalled: Array<{ content: string; description: string }>;
}

/**
 * AI 응답에서 복선 메모 섹션 추출
 *
 * AI 응답 끝에 있는 ---복선메모--- 섹션을 파싱
 * 본문에서 해당 섹션은 제거하고 반환
 */
export function extractForeshadowingMemo(aiResponse: string): {
  cleanedContent: string;
  memo: AutoForeshadowingMemo | null;
} {
  // 복선메모 섹션 패턴
  const memoPattern = /---복선메모---\s*([\s\S]*?)\s*---끝---/;
  const match = aiResponse.match(memoPattern);

  if (!match) {
    return { cleanedContent: aiResponse, memo: null };
  }

  // 복선메모 섹션 제거한 본문
  const cleanedContent = aiResponse.replace(memoPattern, '').trim();

  // 메모 파싱
  const memoText = match[1];
  const planted: Array<{ content: string; description: string }> = [];
  const recalled: Array<{ content: string; description: string }> = [];

  // [심음] 패턴 파싱
  const plantedPattern = /\[심음\]\s*(.+?):\s*(.+)/g;
  let plantedMatch;
  while ((plantedMatch = plantedPattern.exec(memoText)) !== null) {
    planted.push({
      content: plantedMatch[1].trim(),
      description: plantedMatch[2].trim(),
    });
  }

  // [회수] 패턴 파싱
  const recalledPattern = /\[회수\]\s*(.+?):\s*(.+)/g;
  let recalledMatch;
  while ((recalledMatch = recalledPattern.exec(memoText)) !== null) {
    recalled.push({
      content: recalledMatch[1].trim(),
      description: recalledMatch[2].trim(),
    });
  }

  // 아무것도 없으면 null
  if (planted.length === 0 && recalled.length === 0) {
    return { cleanedContent: aiResponse, memo: null };
  }

  return {
    cleanedContent,
    memo: { planted, recalled },
  };
}

/**
 * 자동 추출된 복선 메모를 Foreshadowing 객체로 변환
 *
 * "심은" 복선은 새로 생성, "회수한" 복선은 기존 복선 상태 업데이트
 */
export function convertMemoToForeshadowings(
  memo: AutoForeshadowingMemo,
  chapterIndex: number,
  existingItems: Foreshadowing[]
): {
  newItems: Foreshadowing[];
  updatedIds: Array<{ id: string; newStatus: Foreshadowing['status'] }>;
} {
  const now = Date.now();
  const newItems: Foreshadowing[] = [];
  const updatedIds: Array<{ id: string; newStatus: Foreshadowing['status'] }> = [];

  // 심은 복선 → 새 항목 생성
  memo.planted.forEach((p, idx) => {
    newItems.push({
      id: `fs_auto_${now}_${idx}`,
      name: p.content,
      description: p.description,
      type: 'mystery', // 기본값, 나중에 수정 가능
      urgency: 'medium', // 기본값
      status: 'planted',
      causality: {
        premise: p.description,
        implication: '',
        consequence: '',
      },
      plantedAt: {
        chapterIndex,
        briefContext: p.content,
      },
      hints: [],
      linkedCharacterIds: [],
      linkedForeshadowingIds: [],
      aiGuidance: {
        doHint: [],
        dontReveal: [],
        payoffTiming: '',
      },
      createdAt: now,
      updatedAt: now,
      importance: 3,
    });
  });

  // 회수한 복선 → 기존 항목 상태 업데이트
  memo.recalled.forEach((r) => {
    // 이름으로 기존 복선 찾기 (유사도 매칭)
    const existing = existingItems.find((item) => {
      const nameMatch = item.name.toLowerCase().includes(r.content.toLowerCase()) ||
                       r.content.toLowerCase().includes(item.name.toLowerCase());
      return nameMatch && ['planted', 'hinted', 'partially_paid'].includes(item.status);
    });

    if (existing) {
      updatedIds.push({
        id: existing.id,
        newStatus: 'fully_paid', // 회수됨
      });
    }
  });

  return { newItems, updatedIds };
}

/**
 * 분석 결과에서 새 복선 생성
 */
export function createForeshadowingFromAnalysis(
  detected: ForeshadowingAnalysisResult['detectedForeshadowings'][0],
  chapterIndex: number
): Foreshadowing {
  const now = Date.now();

  return {
    id: `fs_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name: detected.suggestedName,
    description: detected.reason,
    type: detected.suggestedType as ForeshadowingType,
    urgency: detected.suggestedUrgency as ForeshadowingUrgency,
    status: 'planted',
    causality: {
      premise: '(AI가 감지한 잠재적 복선 - 인과관계를 추가해주세요)',
      implication: '',
      consequence: '',
    },
    plantedAt: {
      chapterIndex,
      briefContext: detected.excerpt,
    },
    hints: [],
    linkedCharacterIds: [],
    linkedForeshadowingIds: [],
    aiGuidance: {
      doHint: [],
      dontReveal: [],
      payoffTiming: '',
    },
    createdAt: now,
    updatedAt: now,
    importance: 3,
  };
}

// ============================================================
// 복선 본문 존재 여부 로컬 체크 (API 비용 없음)
// ============================================================

/**
 * 복선이 본문에서 사라졌는지 체크 (로컬, API 비용 없음)
 *
 * 복선의 trackingKeywords가 본문에 하나도 없으면 "사라짐"으로 판단
 */
export function checkForeshadowingExistence(
  novel: Novel,
  foreshadowing: Foreshadowing
): {
  exists: boolean;
  lastSeenChapter?: number;
  suggestion: string;
} {
  // 키워드가 없으면 체크 불가
  if (!foreshadowing.trackingKeywords || foreshadowing.trackingKeywords.length === 0) {
    return {
      exists: true, // 키워드 없으면 존재한다고 가정
      suggestion: '추적 키워드가 없어 본문 존재 여부를 확인할 수 없습니다.',
    };
  }

  // 설치된 챕터부터 검사
  const startChapter = foreshadowing.plantedAt.chapterIndex;
  let lastSeenChapter: number | undefined;

  // 각 챕터에서 키워드 검사
  for (let i = startChapter; i < novel.chapters.length; i++) {
    const content = novel.chapters[i].content.toLowerCase();
    const hasAnyKeyword = foreshadowing.trackingKeywords.some((kw) =>
      content.includes(kw.toLowerCase())
    );

    if (hasAnyKeyword) {
      lastSeenChapter = i;
    }
  }

  // 결과 판단
  if (lastSeenChapter === undefined) {
    return {
      exists: false,
      suggestion: `복선 "${foreshadowing.name}"의 키워드가 본문에서 발견되지 않습니다. 삭제하거나 다시 설치하세요.`,
    };
  }

  // 설치 챕터에서 발견됐으면 존재
  if (lastSeenChapter >= startChapter) {
    return {
      exists: true,
      lastSeenChapter,
      suggestion: `${lastSeenChapter + 1}화에서 마지막으로 발견됨`,
    };
  }

  return {
    exists: false,
    lastSeenChapter,
    suggestion: `복선 "${foreshadowing.name}"이 ${lastSeenChapter + 1}화 이후 사라졌습니다.`,
  };
}

/**
 * 모든 활성 복선의 본문 존재 여부 일괄 체크
 *
 * 챕터 저장 시 호출하여 사라진 복선 경고
 */
export function checkAllForeshadowings(novel: Novel): Array<{
  foreshadowing: Foreshadowing;
  exists: boolean;
  lastSeenChapter?: number;
  suggestion: string;
}> {
  const system = novel.foreshadowingSystem;
  if (!system || system.items.length === 0) {
    return [];
  }

  // 활성 복선만 체크 (완료/폐기된 건 제외)
  const activeItems = system.items.filter((item) =>
    ['planted', 'hinted', 'partially_paid'].includes(item.status)
  );

  return activeItems.map((item) => ({
    foreshadowing: item,
    ...checkForeshadowingExistence(novel, item),
  }));
}

/**
 * 복선 등록 시 키워드 자동 추출 (간단한 로컬 처리)
 *
 * briefContext에서 핵심 단어 추출
 */
export function extractTrackingKeywords(
  briefContext: string,
  name: string
): string[] {
  const keywords: string[] = [];

  // 복선 이름에서 키워드 추출
  const nameWords = name.split(/[\s,.:;!?]+/).filter((w) => w.length >= 2);
  keywords.push(...nameWords);

  // briefContext에서 키워드 추출 (2자 이상 단어)
  const contextWords = briefContext
    .split(/[\s,.:;!?""'']+/)
    .filter((w) => w.length >= 2)
    .slice(0, 5); // 최대 5개
  keywords.push(...contextWords);

  // 중복 제거
  return [...new Set(keywords)];
}
