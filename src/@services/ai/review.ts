/**
 * ============================================================
 * @module services/ai/review
 * @file review.ts
 * ============================================================
 * @description 원고 검토 및 자동 교정 유틸리티
 * - 반복 단어 검출
 * - 번역체 패턴 검출
 * - AI 슬롭 패턴 검출
 * - 긴 문장 검출
 * - 자동 교정
 * ============================================================
 */

import type { Content } from '@google/genai';
import { generateContent, MODELS } from './config';
import { extractAndParseJson, formatAiErrorForUser } from './utils';

/** 문제 유형 */
export type IssueType = 'repetition' | 'translation' | 'slop' | 'longSentence' | 'markdown';

/** 검출된 문제 */
export interface TextIssue {
  type: IssueType;
  start: number;
  end: number;
  text: string;
  suggestion?: string;
}

/** 검토 결과 */
export interface ReviewResult {
  issues: TextIssue[];
  stats: {
    repetition: number;
    translation: number;
    slop: number;
    longSentence: number;
    markdown: number;
  };
}

// ============================================================
// 패턴 정의
// ============================================================

/** 번역체 패턴 (자동 교정 가능) */
const TRANSLATION_PATTERNS: { pattern: RegExp; replacement: string; label: string }[] = [
  { pattern: /에 의해서?/g, replacement: '(으)로', label: '~에 의해' },
  { pattern: /되어지(다|고|며|는|ㄴ|ㄹ)/g, replacement: '되$1', label: '~되어지다' },
  { pattern: /되어져/g, replacement: '되어', label: '~되어져' },
  // "것이다" 패턴 제거 - "~했을 것이다"(추측) 등 자연스러운 표현까지 잘못 교정됨
  { pattern: /(\w)의 (\w+)의 (\w+)의/g, replacement: '$1의 $2 $3', label: '~의 ~의 ~의' },
  { pattern: /하게 되었다/g, replacement: '했다', label: '~하게 되었다' },
  { pattern: /할 수 있게 되었다/g, replacement: '할 수 있었다', label: '~할 수 있게 되었다' },
];

/** AI 슬롭 패턴 (삭제 또는 대체) */
const SLOP_PATTERNS: { pattern: RegExp; replacement: string; label: string }[] = [
  { pattern: /그야말로 /g, replacement: '', label: '그야말로' },
  { pattern: /말 그대로 /g, replacement: '', label: '말 그대로' },
  { pattern: /^한편[,\s]/gm, replacement: '', label: '한편 (문두)' },
  { pattern: /그러던 중[,\s]/g, replacement: '', label: '그러던 중' },
  { pattern: /바로 그 순간/g, replacement: '그때', label: '바로 그 순간' },
  { pattern: /눈을 반짝이며/g, replacement: '눈을 빛내며', label: '눈을 반짝이며' },
  { pattern: /입꼬리를 올리며/g, replacement: '미소 지으며', label: '입꼬리를 올리며' },
  { pattern: /심장이 두근거렸다/g, replacement: '가슴이 뛰었다', label: '심장이 두근거렸다' },
  { pattern: /숨을 삼켰다/g, replacement: '긴장했다', label: '숨을 삼켰다' },
  { pattern: /눈썹을 찌푸렸다/g, replacement: '미간을 좁혔다', label: '눈썹을 찌푸렸다' },
];

/** 마크다운 패턴 (제거) - AI 생성 텍스트에서 흔히 나타남 */
const MARKDOWN_PATTERNS: { pattern: RegExp; replacement: string; label: string }[] = [
  { pattern: /\*\*([^*]+)\*\*/g, replacement: '$1', label: '**볼드**' },
  { pattern: /\*([^*]+)\*/g, replacement: '$1', label: '*이탤릭*' },
  { pattern: /^#{1,6}\s+/gm, replacement: '', label: '# 헤더' },
  { pattern: /^[-*]\s+/gm, replacement: '', label: '- 리스트' },
  { pattern: /```[^`]*```/gs, replacement: '', label: '코드블록' },
  { pattern: /`([^`]+)`/g, replacement: '$1', label: '`인라인코드`' },
  { pattern: /\[([^\]]+)\]\([^)]+\)/g, replacement: '$1', label: '[링크]()' },
];

/** 긴 문장 기준 (글자 수) */
const LONG_SENTENCE_THRESHOLD = 80;

/** 반복 단어 최소 횟수 */
const REPETITION_THRESHOLD = 3;

/** 반복 검사 제외 단어 (조사, 접속사 등) */
const EXCLUDED_WORDS = new Set([
  '그', '그녀', '그것', '이', '저', '그리고', '하지만', '그러나', '또한', '그래서',
  '을', '를', '이', '가', '은', '는', '에', '에서', '로', '으로', '와', '과',
  '의', '도', '만', '까지', '부터', '처럼', '같이', '보다', '라고', '하고',
  '있다', '없다', '하다', '되다', '있는', '없는', '하는', '되는',
  '그때', '이때', '그곳', '이곳', '여기', '저기', '거기',
]);

// ============================================================
// 분석 함수
// ============================================================

/**
 * 텍스트에서 반복 단어 찾기
 */
function findRepetitions(text: string): TextIssue[] {
  const issues: TextIssue[] = [];
  const wordCount = new Map<string, { count: number; positions: number[] }>();

  // 단어 추출 (한글 2글자 이상)
  const wordRegex = /[가-힣]{2,}/g;
  let match;

  while ((match = wordRegex.exec(text)) !== null) {
    const word = match[0];
    if (EXCLUDED_WORDS.has(word)) continue;

    const existing = wordCount.get(word);
    if (existing) {
      existing.count++;
      existing.positions.push(match.index);
    } else {
      wordCount.set(word, { count: 1, positions: [match.index] });
    }
  }

  // 반복 임계값 이상인 단어만 추출
  wordCount.forEach((data, word) => {
    if (data.count >= REPETITION_THRESHOLD) {
      data.positions.forEach(pos => {
        issues.push({
          type: 'repetition',
          start: pos,
          end: pos + word.length,
          text: word,
          suggestion: `"${word}" ${data.count}회 반복`,
        });
      });
    }
  });

  return issues;
}

/**
 * 번역체 패턴 찾기
 */
function findTranslationPatterns(text: string): TextIssue[] {
  const issues: TextIssue[] = [];

  TRANSLATION_PATTERNS.forEach(({ pattern, replacement, label }) => {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;

    while ((match = regex.exec(text)) !== null) {
      issues.push({
        type: 'translation',
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        suggestion: `${label} → ${replacement}`,
      });
    }
  });

  return issues;
}

/**
 * AI 슬롭 패턴 찾기
 */
function findSlopPatterns(text: string): TextIssue[] {
  const issues: TextIssue[] = [];

  SLOP_PATTERNS.forEach(({ pattern, replacement, label: _label }) => {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;

    while ((match = regex.exec(text)) !== null) {
      issues.push({
        type: 'slop',
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        suggestion: replacement ? `→ "${replacement}"` : '삭제 권장',
      });
    }
  });

  return issues;
}

/**
 * 긴 문장 찾기
 */
function findLongSentences(text: string): TextIssue[] {
  const issues: TextIssue[] = [];
  const sentenceRegex = /[^.!?。]+[.!?。]/g;
  let match;

  while ((match = sentenceRegex.exec(text)) !== null) {
    const sentence = match[0].trim();
    if (sentence.length > LONG_SENTENCE_THRESHOLD) {
      issues.push({
        type: 'longSentence',
        start: match.index,
        end: match.index + match[0].length,
        text: sentence.substring(0, 30) + '...',
        suggestion: `${sentence.length}자 (${LONG_SENTENCE_THRESHOLD}자 초과)`,
      });
    }
  }

  return issues;
}

/**
 * 마크다운 패턴 찾기
 */
function findMarkdownPatterns(text: string): TextIssue[] {
  const issues: TextIssue[] = [];

  MARKDOWN_PATTERNS.forEach(({ pattern, label }) => {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;

    while ((match = regex.exec(text)) !== null) {
      issues.push({
        type: 'markdown',
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        suggestion: `${label} 제거`,
      });
    }
  });

  return issues;
}

/**
 * 텍스트 종합 검토 (자동 교정 대상만)
 * - 번역체, AI슬롭, 마크다운 패턴 검출
 * - 반복 단어, 긴 문장은 참고용 (자동 교정 대상 아님)
 */
export function reviewText(text: string): ReviewResult {
  const repetitions = findRepetitions(text);
  const translations = findTranslationPatterns(text);
  const slops = findSlopPatterns(text);
  const longSentences = findLongSentences(text);
  const markdowns = findMarkdownPatterns(text);

  const allIssues = [...repetitions, ...translations, ...slops, ...longSentences, ...markdowns];

  // 위치순 정렬
  allIssues.sort((a, b) => a.start - b.start);

  return {
    issues: allIssues,
    stats: {
      repetition: repetitions.length,
      translation: translations.length,
      slop: slops.length,
      longSentence: longSentences.length,
      markdown: markdowns.length,
    },
  };
}

// ============================================================
// 자동 교정 함수
// ============================================================

/**
 * 번역체 자동 교정
 */
function correctTranslationPatterns(text: string): string {
  let result = text;

  TRANSLATION_PATTERNS.forEach(({ pattern, replacement }) => {
    result = result.replace(pattern, replacement);
  });

  return result;
}

/**
 * AI 슬롭 자동 교정
 */
function correctSlopPatterns(text: string): string {
  let result = text;

  SLOP_PATTERNS.forEach(({ pattern, replacement }) => {
    result = result.replace(pattern, replacement);
  });

  return result;
}

/**
 * 마크다운 패턴 제거
 */
function removeMarkdownPatterns(text: string): string {
  let result = text;

  MARKDOWN_PATTERNS.forEach(({ pattern, replacement }) => {
    result = result.replace(pattern, replacement);
  });

  return result;
}

/**
 * 텍스트 자동 교정 (번역체 + 슬롭 + 마크다운 제거)
 */
export function autoCorrect(text: string): { corrected: string; changeCount: number } {
  const original = text;

  let result = correctTranslationPatterns(text);
  result = correctSlopPatterns(result);
  result = removeMarkdownPatterns(result);

  // 변경 횟수 계산 (간단히 길이 차이 또는 diff)
  let changeCount = 0;
  for (let i = 0; i < Math.max(original.length, result.length); i++) {
    if (original[i] !== result[i]) changeCount++;
  }

  return { corrected: result, changeCount };
}

// ============================================================
// 하이라이트 렌더링 헬퍼
// ============================================================

/** 하이라이트된 텍스트 세그먼트 */
export interface HighlightSegment {
  text: string;
  type: IssueType | null;
  suggestion?: string;
}

/**
 * 텍스트를 하이라이트 세그먼트로 분할
 */
export function getHighlightedSegments(text: string, issues: TextIssue[]): HighlightSegment[] {
  if (issues.length === 0) {
    return [{ text, type: null }];
  }

  const segments: HighlightSegment[] = [];
  let lastEnd = 0;

  // 중복 제거 및 정렬
  const sortedIssues = [...issues].sort((a, b) => a.start - b.start);
  const mergedIssues: TextIssue[] = [];

  sortedIssues.forEach(issue => {
    const lastMerged = mergedIssues[mergedIssues.length - 1];
    if (!lastMerged || issue.start >= lastMerged.end) {
      mergedIssues.push(issue);
    }
    // 겹치는 경우 우선순위: slop > translation > repetition > longSentence
  });

  mergedIssues.forEach(issue => {
    // 이슈 전 텍스트
    if (issue.start > lastEnd) {
      segments.push({
        text: text.substring(lastEnd, issue.start),
        type: null,
      });
    }

    // 이슈 텍스트
    segments.push({
      text: text.substring(issue.start, issue.end),
      type: issue.type,
      suggestion: issue.suggestion,
    });

    lastEnd = issue.end;
  });

  // 마지막 이슈 후 텍스트
  if (lastEnd < text.length) {
    segments.push({
      text: text.substring(lastEnd),
      type: null,
    });
  }

  return segments;
}

/**
 * 이슈 타입별 CSS 클래스
 */
export function getIssueClassName(type: IssueType): string {
  switch (type) {
    case 'repetition':
      return 'bg-yellow-200/60 dark:bg-yellow-500/30';
    case 'translation':
      return 'bg-orange-200/60 dark:bg-orange-500/30';
    case 'slop':
      return 'bg-red-200/60 dark:bg-red-500/30';
    case 'longSentence':
      return 'underline decoration-blue-500 decoration-wavy';
    case 'markdown':
      return 'bg-purple-200/60 dark:bg-purple-500/30';
    default:
      return '';
  }
}

// ============================================================
// 웹소설 편집자 피드백
// ============================================================

/** 점수 항목 */
interface ScoreItem {
  score: number;
  comment: string;
}

/** 웹소설 편집자 피드백 타입 */
export interface WebNovelEditorFeedback {
  // 훅/몰입 (30점)
  hook: {
    firstHook: ScoreItem;      // 첫 훅 (10점)
    pacing: ScoreItem;         // 페이싱 (10점)
    cliffhanger: ScoreItem;    // 절단마공 (10점)
  };
  // 표현/연출 (30점)
  style: {
    dialogueRatio: ScoreItem;     // 대사 비율 (8점)
    descriptionDensity: ScoreItem; // 묘사 밀도 (7점)
    sentenceRhythm: ScoreItem;     // 문장 리듬 (8점)
    showDontTell: ScoreItem;       // Show don't Tell (7점)
  };
  // 서사/일관성 (40점)
  narrative: {
    characterConsistency: ScoreItem;   // 캐릭터 일관성 (10점)
    emotionalArc: ScoreItem;           // 감정선 (10점)
    foreshadowingBalance: ScoreItem;   // 복선 균형 (10점)
    tensionBalance: ScoreItem;         // 전개 긴장감 (10점)
  };
  totalScore: number;
  maxTotalScore: number;
  summary: string;
  topIssues: { priority: number; issue: string; suggestion: string }[];
  goodPoints: string[];
  editorNote: string;
}

function clampScore(value: unknown, maxScore: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return Math.round(maxScore * 0.7);
  return Math.max(0, Math.min(maxScore, Math.round(numeric)));
}

function normalizeScoreItem(item: unknown, maxScore: number, fallback: string): ScoreItem {
  const source = item && typeof item === 'object' ? item as Partial<ScoreItem> : {};
  return {
    score: clampScore(source.score, maxScore),
    comment: String(source.comment || fallback),
  };
}

function normalizeEditorFeedback(raw: Partial<WebNovelEditorFeedback>): WebNovelEditorFeedback {
  const feedback: WebNovelEditorFeedback = {
    hook: {
      firstHook: normalizeScoreItem(raw.hook?.firstHook, 10, '도입부의 독자 유입력을 점검했습니다.'),
      pacing: normalizeScoreItem(raw.hook?.pacing, 10, '전개 속도와 장면 배치를 점검했습니다.'),
      cliffhanger: normalizeScoreItem(raw.hook?.cliffhanger, 10, '다음 화 기대감을 점검했습니다.'),
    },
    style: {
      dialogueRatio: normalizeScoreItem(raw.style?.dialogueRatio, 8, '대사와 지문의 균형을 점검했습니다.'),
      descriptionDensity: normalizeScoreItem(raw.style?.descriptionDensity, 7, '묘사 밀도를 점검했습니다.'),
      sentenceRhythm: normalizeScoreItem(raw.style?.sentenceRhythm, 8, '문장 호흡과 리듬을 점검했습니다.'),
      showDontTell: normalizeScoreItem(raw.style?.showDontTell, 7, '감정 전달 방식을 점검했습니다.'),
    },
    narrative: {
      characterConsistency: normalizeScoreItem(raw.narrative?.characterConsistency, 10, '캐릭터 일관성을 점검했습니다.'),
      emotionalArc: normalizeScoreItem(raw.narrative?.emotionalArc, 10, '감정선 흐름을 점검했습니다.'),
      foreshadowingBalance: normalizeScoreItem(raw.narrative?.foreshadowingBalance, 10, '복선 배치를 점검했습니다.'),
      tensionBalance: normalizeScoreItem(raw.narrative?.tensionBalance, 10, '긴장감 조절을 점검했습니다.'),
    },
    totalScore: 0,
    maxTotalScore: 100,
    summary: String(raw.summary || '원고의 강점과 보완점을 종합 검토했습니다.'),
    topIssues: Array.isArray(raw.topIssues) ? raw.topIssues.slice(0, 5).map((issue, index) => ({
      priority: clampScore(issue?.priority ?? index + 1, 5),
      issue: String(issue?.issue || '개선 포인트'),
      suggestion: String(issue?.suggestion || '장면 목적이 더 선명하게 보이도록 다듬어보세요.'),
    })) : [],
    goodPoints: Array.isArray(raw.goodPoints) ? raw.goodPoints.slice(0, 5).map(String) : [],
    editorNote: String(raw.editorNote || '다음 회차에서 독자가 기대할 한 가지 감정을 더 선명하게 밀어주세요.'),
  };

  feedback.totalScore =
    feedback.hook.firstHook.score +
    feedback.hook.pacing.score +
    feedback.hook.cliffhanger.score +
    feedback.style.dialogueRatio.score +
    feedback.style.descriptionDensity.score +
    feedback.style.sentenceRhythm.score +
    feedback.style.showDontTell.score +
    feedback.narrative.characterConsistency.score +
    feedback.narrative.emotionalArc.score +
    feedback.narrative.foreshadowingBalance.score +
    feedback.narrative.tensionBalance.score;

  if (feedback.topIssues.length === 0) {
    feedback.topIssues = [
      { priority: 1, issue: '장면 목표', suggestion: '이번 화에서 독자가 붙잡아야 할 갈등을 첫 1~2문단 안에 더 또렷하게 배치하세요.' },
      { priority: 2, issue: '후킹', suggestion: '마지막 문단에 다음 장면의 질문이나 위험을 하나 남겨주세요.' },
    ];
  }
  if (feedback.goodPoints.length === 0) {
    feedback.goodPoints = ['원고의 기본 흐름을 유지하고 있습니다.'];
  }

  return feedback;
}

/** 웹소설 편집자 피드백 가져오기 */
export async function getWebNovelEditorFeedback(
  title: string,
  content: string,
  novelTitle: string,
  novelSubject: string,
  chapterNumber: number,
  previousChapterSummary?: string,
  characters?: { name: string; personality: string }[]
): Promise<WebNovelEditorFeedback> {
  const localReview = reviewText(content);
  const systemInstruction = `당신은 한국 웹소설 편집장 K입니다.

[평가 원칙]
- 플랫폼 웹소설 관점으로 냉정하지만 실행 가능한 피드백을 줍니다.
- 원고를 다시 쓰지 말고 분석만 합니다.
- 점수는 후킹 30점, 표현/연출 30점, 서사/일관성 40점 합계 100점입니다.
- 반드시 JSON만 반환합니다.`;

  const prompt = `작품명: ${novelTitle}
장르/주제: ${novelSubject || '(미입력)'}
챕터: ${chapterNumber}화 "${title}"

이전 요약:
${previousChapterSummary || '(없음)'}

주요 인물:
${characters?.map((c) => `- ${c.name}: ${c.personality}`).join('\n') || '(없음)'}

로컬 기계 검토:
- 반복 표현: ${localReview.stats.repetition}
- 번역체 의심: ${localReview.stats.translation}
- AI식 상투 표현: ${localReview.stats.slop}
- 긴 문장: ${localReview.stats.longSentence}
- 마크다운 잔여: ${localReview.stats.markdown}

원고:
${content.slice(0, 30000)}

반환 JSON 형식:
{
  "hook": {
    "firstHook": {"score": 0, "comment": ""},
    "pacing": {"score": 0, "comment": ""},
    "cliffhanger": {"score": 0, "comment": ""}
  },
  "style": {
    "dialogueRatio": {"score": 0, "comment": ""},
    "descriptionDensity": {"score": 0, "comment": ""},
    "sentenceRhythm": {"score": 0, "comment": ""},
    "showDontTell": {"score": 0, "comment": ""}
  },
  "narrative": {
    "characterConsistency": {"score": 0, "comment": ""},
    "emotionalArc": {"score": 0, "comment": ""},
    "foreshadowingBalance": {"score": 0, "comment": ""},
    "tensionBalance": {"score": 0, "comment": ""}
  },
  "summary": "",
  "topIssues": [{"priority": 1, "issue": "", "suggestion": ""}],
  "goodPoints": [""],
  "editorNote": ""
}`;

  try {
    const response = await generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction,
      model: MODELS.FLASH_STABLE,
      thinkingLevel: 'medium',
      maxTokens: 4096,
      jsonMode: true,
      timeoutMs: 35000,
      retryAttempts: 2,
    });
    const parsed = extractAndParseJson<Partial<WebNovelEditorFeedback>>(response, {});
    return normalizeEditorFeedback(parsed);
  } catch (error) {
    console.error('[getWebNovelEditorFeedback] 실패:', error);
    throw new Error(formatAiErrorForUser(error, error instanceof Error ? error.message : '편집자 피드백 생성 실패'));
  }
}

/** 웹소설 편집자와 대화하기 */
export async function chatWithWebNovelEditor(
  userMessage: string,
  chatHistory: Content[],
  title: string,
  content: string,
  feedback: WebNovelEditorFeedback
): Promise<string> {
  const historyText = chatHistory
    .slice(-8)
    .map((msg) => `${msg.role === 'user' ? '작가' : '편집장 K'}: ${msg.parts?.map((part) => part.text || '').join('') || ''}`)
    .join('\n');

  const prompt = `챕터: ${title}

원고 일부:
${content.slice(0, 12000)}

현재 피드백 요약:
${feedback.summary}

핵심 개선 포인트:
${feedback.topIssues.map((issue) => `- ${issue.issue}: ${issue.suggestion}`).join('\n')}

대화 기록:
${historyText}

작가의 최신 질문:
${userMessage}

편집장 K로서 3~6문단으로 구체적으로 답하세요.`;

  try {
    const response = await generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: '당신은 한국 웹소설 편집장 K입니다. 원고 개선 방향을 구체적이고 현실적으로 답하세요.',
      model: MODELS.FLASH_STABLE,
      thinkingLevel: 'medium',
      maxTokens: 2048,
      timeoutMs: 30000,
      retryAttempts: 2,
    });
    return response.trim();
  } catch (error) {
    console.error('[chatWithWebNovelEditor] 실패:', error);
    throw new Error(formatAiErrorForUser(error, error instanceof Error ? error.message : '편집자 대화 실패'));
  }
}
